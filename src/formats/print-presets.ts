/**
 * Print presets for PDF generation.
 * Dimensions in millimeters, margins in millimeters.
 */
import { readdir } from "node:fs/promises";
import { basename, extname, join } from "node:path";
import { pathToFileURL } from "node:url";
import type { LayoutOverrides } from "../project/parse.js";
import { dirExists, fileExists } from "../support/fs-utils.js";
import {
    findInstalledPluginPackage,
    listInstalledPluginPackages,
    packageWritekitConfig,
    resolvePluginPackageEntry,
    resolvePluginPackageFile,
} from "../support/plugin-packages.js";

export interface PrintPreset {
    name: string;
    description: string;
    width: number;      // mm
    height: number;     // mm
    margin: {
        top: number;    // mm
        bottom: number;
        inner: number;  // gutter side
        outer: number;
    };
    bleed: number;      // mm (0 for non-print presets)
    mirrorMargins: boolean;   // swap inner/outer on recto/verso
    pageNumbers: boolean;     // show page numbers
    runningHeader: boolean;   // show running header (title/chapter)
    rectoStart: boolean;      // chapters start on right page
}

export interface PresetPlugin {
    name?: string;
    preset: PrintPreset;
}

// Layout flags for screen/draft presets (no print features)
const SCREEN_LAYOUT = { mirrorMargins: false, pageNumbers: false, runningHeader: false, rectoStart: false };
// Layout flags for print presets (full book layout)
const PRINT_LAYOUT = { mirrorMargins: true, pageNumbers: true, runningHeader: true, rectoStart: true };

const LOCAL_PLUGIN_EXTS = new Set([".mjs", ".js", ".cjs"]);

const builtinPresets: Record<string, PrintPreset> = {
    screen: {
        name: "Screen",
        description: "Screen reading — no print features",
        width: 210,
        height: 297,
        margin: { top: 20, bottom: 20, inner: 20, outer: 20 },
        bleed: 0,
        ...SCREEN_LAYOUT,
    },
    a4: {
        name: "A4",
        description: "A4 — draft / home printing",
        width: 210,
        height: 297,
        margin: { top: 20, bottom: 20, inner: 25, outer: 20 },
        bleed: 0,
        ...SCREEN_LAYOUT,
        pageNumbers: true,
    },
    a5: {
        name: "A5",
        description: "A5 — standard EU book",
        width: 148,
        height: 210,
        margin: { top: 15, bottom: 15, inner: 20, outer: 15 },
        bleed: 0,
        ...PRINT_LAYOUT,
    },
    pocket: {
        name: "Pocket",
        description: "4.25×7in — pocket book",
        width: 108,
        height: 178,
        margin: { top: 13, bottom: 13, inner: 16, outer: 13 },
        bleed: 0,
        ...PRINT_LAYOUT,
    },
    digest: {
        name: "Digest",
        description: "5.5×8.5in — digest / mass market",
        width: 140,
        height: 216,
        margin: { top: 15, bottom: 15, inner: 19, outer: 15 },
        bleed: 0,
        ...PRINT_LAYOUT,
    },
    trade: {
        name: "US Trade",
        description: "6×9in — US trade paperback (most common)",
        width: 152,
        height: 229,
        margin: { top: 18, bottom: 18, inner: 22, outer: 18 },
        bleed: 0,
        ...PRINT_LAYOUT,
    },
    royal: {
        name: "Royal",
        description: "6.14×9.21in — Royal format",
        width: 156,
        height: 234,
        margin: { top: 18, bottom: 18, inner: 22, outer: 18 },
        bleed: 0,
        ...PRINT_LAYOUT,
    },
    kdp: {
        name: "KDP",
        description: "6×9in — Amazon KDP ready (with bleed & margins)",
        width: 152,
        height: 229,
        margin: { top: 19, bottom: 19, inner: 25, outer: 19 },
        bleed: 3.2,
        ...PRINT_LAYOUT,
    },
    ingramspark: {
        name: "IngramSpark",
        description: "6×9in — IngramSpark ready (with bleed & margins)",
        width: 152,
        height: 229,
        margin: { top: 19, bottom: 19, inner: 25, outer: 19 },
        bleed: 3.2,
        ...PRINT_LAYOUT,
    },
    lulu: {
        name: "Lulu",
        description: "6×9in — Lulu ready (with bleed & margins)",
        width: 152,
        height: 229,
        margin: { top: 19, bottom: 19, inner: 22, outer: 16 },
        bleed: 3.2,
        ...PRINT_LAYOUT,
    },
};

export const DEFAULT_PRESET = "screen";

function normalizePreset(name: string, preset: PrintPreset): PrintPreset {
    return {
        ...preset,
        name: preset.name || name,
    };
}

function normalizePresetPlugin(name: string, value: Partial<PresetPlugin> | Partial<PrintPreset>): PrintPreset {
    if (!value || typeof value !== "object") {
        throw new Error(`Invalid print preset "${name}": expected an object export`);
    }

    const preset = "preset" in value && value.preset ? value.preset : value as Partial<PrintPreset>;
    if (!preset || typeof preset !== "object") {
        throw new Error(`Invalid print preset "${name}": expected an object export`);
    }

    const requiredKeys = [
        "description",
        "width",
        "height",
        "margin",
        "bleed",
        "mirrorMargins",
        "pageNumbers",
        "runningHeader",
        "rectoStart",
    ] as const;
    for (const key of requiredKeys) {
        if (!(key in preset)) {
            throw new Error(`Invalid print preset "${name}": missing ${key}`);
        }
    }

    return normalizePreset(name, preset as PrintPreset);
}

function localPresetsDir(projectDir: string): string {
    return join(projectDir, "presets");
}

async function resolveLocalPresetFile(projectDir: string, name: string): Promise<string | null> {
    const dir = localPresetsDir(projectDir);
    for (const ext of LOCAL_PLUGIN_EXTS) {
        const file = join(dir, `${name}${ext}`);
        if (await fileExists(file)) return file;
    }
    return null;
}

async function loadPresetFromModule(file: string, name: string): Promise<PrintPreset> {
    const mod = await import(pathToFileURL(file).href);
    return normalizePresetPlugin(name, (mod.default ?? mod.plugin ?? mod) as Partial<PresetPlugin> | Partial<PrintPreset>);
}

async function loadLocalPreset(projectDir: string, name: string): Promise<PrintPreset | null> {
    const file = await resolveLocalPresetFile(projectDir, name);
    if (!file) return null;
    return loadPresetFromModule(file, name);
}

async function loadExternalPreset(projectDir: string, name: string): Promise<PrintPreset | null> {
    const pluginPackage = await findInstalledPluginPackage("preset", name, projectDir);
    if (!pluginPackage) return null;

    const presetConfig = packageWritekitConfig(pluginPackage)?.preset;
    const entry = presetConfig?.entry
        ? resolvePluginPackageFile(pluginPackage, presetConfig.entry)
        : resolvePluginPackageEntry(pluginPackage, projectDir);

    return loadPresetFromModule(entry, pluginPackage.pluginName);
}

export async function getPreset(name: string, projectDir?: string): Promise<PrintPreset | null> {
    const builtin = builtinPresets[name.toLowerCase()];
    if (builtin) return builtin;
    if (!projectDir) return null;

    const localPreset = await loadLocalPreset(projectDir, name);
    if (localPreset) return localPreset;

    return loadExternalPreset(projectDir, name);
}

function applyLayoutOverrides(
    preset: PrintPreset,
    layout?: LayoutOverrides,
): PrintPreset {
    if (!layout) return preset;

    return {
        ...preset,
        ...(typeof layout.page_numbers === "boolean" ? { pageNumbers: layout.page_numbers } : {}),
        ...(typeof layout.running_header === "boolean" ? { runningHeader: layout.running_header } : {}),
        ...(typeof layout.recto_start === "boolean" ? { rectoStart: layout.recto_start } : {}),
        margin: {
            ...preset.margin,
            ...(typeof layout.margin?.inner === "number" ? { inner: layout.margin.inner } : {}),
            ...(typeof layout.margin?.outer === "number" ? { outer: layout.margin.outer } : {}),
        },
    };
}

export async function resolvePrintPreset(
    config: { print_preset?: string; layout?: LayoutOverrides },
    typeDefaultPreset?: string,
    projectDir?: string,
): Promise<PrintPreset> {
    const presetName = config.print_preset ?? typeDefaultPreset ?? DEFAULT_PRESET;
    const basePreset = await getPreset(presetName, projectDir) ?? builtinPresets[DEFAULT_PRESET];
    return applyLayoutOverrides(basePreset, config.layout);
}

export async function listPresets(projectDir?: string): Promise<{ key: string; preset: PrintPreset }[]> {
    const entries = new Map<string, PrintPreset>(Object.entries(builtinPresets));

    if (projectDir && await dirExists(localPresetsDir(projectDir))) {
        const localEntries = await readdir(localPresetsDir(projectDir));
        for (const entry of localEntries) {
            const ext = extname(entry);
            if (!LOCAL_PLUGIN_EXTS.has(ext)) continue;
            const key = basename(entry, ext);
            const preset = await loadLocalPreset(projectDir, key);
            if (preset) entries.set(key, preset);
        }
    }

    if (projectDir) {
        for (const pluginPackage of await listInstalledPluginPackages("preset", projectDir)) {
            const preset = await loadExternalPreset(projectDir, pluginPackage.pluginName);
            if (preset) entries.set(pluginPackage.pluginName, preset);
        }
    }

    return [...entries.entries()]
        .map(([key, preset]) => ({ key, preset }))
        .sort((a, b) => a.key.localeCompare(b.key));
}

export async function presetNames(projectDir?: string): Promise<string[]> {
    const presets = await listPresets(projectDir);
    return presets.map(({ key }) => key);
}
