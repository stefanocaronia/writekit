/**
 * Print presets for PDF generation.
 * Dimensions in millimeters, margins in millimeters.
 */
import type { LayoutOverrides } from "./parse.js";

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

// Layout flags for screen/draft presets (no print features)
const SCREEN_LAYOUT = { mirrorMargins: false, pageNumbers: false, runningHeader: false, rectoStart: false };
// Layout flags for print presets (full book layout)
const PRINT_LAYOUT = { mirrorMargins: true, pageNumbers: true, runningHeader: true, rectoStart: true };

const presets: Record<string, PrintPreset> = {
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

export function getPreset(name: string): PrintPreset | null {
    return presets[name.toLowerCase()] ?? null;
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

export function resolvePrintPreset(
    config: { print_preset?: string; layout?: LayoutOverrides },
    typeDefaultPreset?: string,
): PrintPreset {
    const presetName = config.print_preset ?? typeDefaultPreset ?? DEFAULT_PRESET;
    const basePreset = getPreset(presetName) ?? getPreset(DEFAULT_PRESET)!;
    return applyLayoutOverrides(basePreset, config.layout);
}

export function listPresets(): { key: string; preset: PrintPreset }[] {
    return Object.entries(presets).map(([key, preset]) => ({ key, preset }));
}

export function presetNames(): string[] {
    return Object.keys(presets);
}
