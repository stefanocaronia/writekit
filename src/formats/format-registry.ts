import { mkdir, readdir, writeFile } from "node:fs/promises";
import { basename, extname, join } from "node:path";
import { pathToFileURL } from "node:url";
import { renderBook } from "./html.js";
import { buildEpub as buildEpubFile } from "./epub.js";
import { buildPdf as buildPdfFile } from "./pdf.js";
import { buildDocx as buildDocxFile } from "./docx.js";
import { renderBookMd } from "./md.js";
import { loadTypography } from "../support/typography.js";
import { resolvePrintPreset } from "./print-presets.js";
import { bookFilename, dirExists, fileExists } from "../support/fs-utils.js";
import {
    findInstalledPluginPackage,
    listInstalledPluginPackages,
    packageWritekitConfig,
    resolvePluginPackageEntry,
    resolvePluginPackageFile,
} from "../support/plugin-packages.js";
import { loadContributors, loadBackcover, resolveCover, type BookConfig, type Chapter } from "../project/parse.js";
import type { Theme } from "../support/theme.js";
import type { Section, TypeFeatures } from "../project/project-type.js";
import type { Schema } from "../project/schema.js";

const BUILTIN_FORMATS = ["pdf", "epub", "html", "docx", "md"] as const;
const LOCAL_PLUGIN_EXTS = new Set([".mjs", ".js", ".cjs"]);

export interface FormatBuildContext {
    projectDir: string;
    buildDir: string;
    config: BookConfig;
    chapters: Chapter[];
    theme: Theme;
    contributors: Awaited<ReturnType<typeof loadContributors>>;
    backcover: string;
    coverPath: string | null;
    sections?: Section[];
    features?: TypeFeatures;
    typeDefaultPreset?: string;
    options: Record<string, unknown>;
    filenameFor: (ext: string) => string;
    writeOutput: (ext: string, content: string | Buffer) => Promise<string>;
}

export interface FormatBuildResult {
    content?: string | Buffer;
    extension?: string;
    path?: string;
}

export interface FormatPlugin {
    name: string;
    extension?: string;
    description?: string;
    configSchema?: Schema;
    build: (context: FormatBuildContext) => Promise<void | string | Buffer | FormatBuildResult>;
}

function contentResult(content: string | Buffer, extension?: string): FormatBuildResult {
    return { content, extension };
}

function pathResult(path: string): FormatBuildResult {
    return { path };
}

function buildFilename(config: BookConfig, ext: string): string {
    return bookFilename(config.title, config.author, ext);
}

async function createContext(
    formatName: string,
    projectDir: string,
    config: BookConfig,
    chapters: Chapter[],
    theme: Theme,
    sections?: Section[],
    features?: TypeFeatures,
    typeDefaultPreset?: string,
): Promise<FormatBuildContext> {
    const contributors = await loadContributors(projectDir);
    const backcover = await loadBackcover(projectDir);
    const coverPath = await resolveCover(projectDir, config);
    const buildDir = join(projectDir, "build");
    await mkdir(buildDir, { recursive: true });

    return {
        projectDir,
        buildDir,
        config,
        chapters,
        theme,
        contributors,
        backcover,
        coverPath,
        sections,
        features,
        typeDefaultPreset,
        options: resolveFormatOptions(config, formatName),
        filenameFor: (ext: string) => buildFilename(config, ext),
        writeOutput: async (ext: string, content: string | Buffer) => {
            const outPath = join(buildDir, buildFilename(config, ext));
            await writeFile(outPath, content);
            return outPath;
        },
    };
}

function resolveFormatOptions(config: BookConfig, formatName: string): Record<string, unknown> {
    const options = config.format_options?.[formatName];
    return options && typeof options === "object" && !Array.isArray(options) ? options : {};
}

const builtinPlugins: Record<string, FormatPlugin> = {
    html: {
        name: "html",
        extension: "html",
        description: "Build as a web page",
        async build(ctx) {
            const typography = await loadTypography(ctx.projectDir);
            const html = await renderBook(
                ctx.config,
                ctx.chapters,
                ctx.theme,
                ctx.contributors,
                ctx.backcover,
                ctx.coverPath,
                ctx.projectDir,
                typography,
                ctx.sections,
                ctx.features,
            );
            return contentResult(html, "html");
        },
    },
    epub: {
        name: "epub",
        extension: "epub",
        description: "Build as an ePub ebook",
        async build(ctx) {
            const path = await buildEpubFile(
                ctx.projectDir,
                ctx.config,
                ctx.chapters,
                ctx.theme,
                ctx.filenameFor("epub"),
                ctx.contributors,
                ctx.backcover,
                ctx.coverPath,
                ctx.sections,
                ctx.features,
            );
            return pathResult(path);
        },
    },
    pdf: {
        name: "pdf",
        extension: "pdf",
        description: "Build as a PDF document",
        async build(ctx) {
            const path = await buildPdfFile(
                ctx.projectDir,
                ctx.config,
                ctx.chapters,
                ctx.theme,
                ctx.filenameFor("pdf"),
                ctx.contributors,
                ctx.backcover,
                ctx.coverPath,
                ctx.sections,
                ctx.features,
                ctx.typeDefaultPreset,
            );
            return pathResult(path);
        },
    },
    docx: {
        name: "docx",
        extension: "docx",
        description: "Build as a Word document",
        async build(ctx) {
            const preset = resolvePrintPreset(ctx.config, ctx.typeDefaultPreset);
            const path = await buildDocxFile(
                ctx.projectDir,
                ctx.config,
                ctx.chapters,
                ctx.filenameFor("docx"),
                ctx.contributors,
                ctx.backcover,
                ctx.coverPath,
                ctx.theme.docx,
                ctx.sections,
                ctx.features,
                preset,
            );
            return pathResult(path);
        },
    },
    md: {
        name: "md",
        extension: "md",
        description: "Build as a single Markdown file",
        async build(ctx) {
            const md = await renderBookMd(
                ctx.projectDir,
                ctx.config,
                ctx.chapters,
                ctx.contributors,
                ctx.backcover,
                ctx.sections,
                ctx.features,
            );
            return contentResult(md, "md");
        },
    },
};

function localFormatsDir(projectDir: string): string {
    return join(projectDir, "formats");
}

async function resolveLocalFormatFile(projectDir: string, name: string): Promise<string | null> {
    const dir = localFormatsDir(projectDir);
    for (const ext of LOCAL_PLUGIN_EXTS) {
        const file = join(dir, `${name}${ext}`);
        if (await fileExists(file)) return file;
    }
    return null;
}

async function loadLocalPlugin(projectDir: string, name: string): Promise<FormatPlugin | null> {
    const file = await resolveLocalFormatFile(projectDir, name);
    if (!file) return null;

    const mod = await import(pathToFileURL(file).href);
    const plugin = (mod.default ?? mod.plugin ?? mod) as Partial<FormatPlugin>;

    if (!plugin || typeof plugin.build !== "function") {
        throw new Error(`Invalid format plugin "${name}" in ${file}: missing build()`);
    }

    return {
        name,
        extension: plugin.extension,
        description: plugin.description,
        configSchema: plugin.configSchema,
        build: plugin.build,
    };
}

async function loadExternalPlugin(projectDir: string, name: string): Promise<FormatPlugin | null> {
    const pluginPackage = await findInstalledPluginPackage("format", name, projectDir);
    if (!pluginPackage) return null;

    const formatConfig = packageWritekitConfig(pluginPackage)?.format;
    const entry = formatConfig?.entry
        ? resolvePluginPackageFile(pluginPackage, formatConfig.entry)
        : resolvePluginPackageEntry(pluginPackage, projectDir);

    const mod = await import(pathToFileURL(entry).href);
    const plugin = (mod.default ?? mod.plugin ?? mod) as Partial<FormatPlugin>;

    if (!plugin || typeof plugin.build !== "function") {
        throw new Error(`Invalid format plugin "${name}" in ${pluginPackage.packageName}: missing build()`);
    }

    return {
        name: pluginPackage.pluginName,
        extension: plugin.extension,
        description: plugin.description,
        configSchema: plugin.configSchema,
        build: plugin.build,
    };
}

export function builtinFormatNames(): readonly string[] {
    return BUILTIN_FORMATS;
}

export async function allFormatNames(projectDir?: string): Promise<string[]> {
    const names = new Set<string>(builtinFormatNames());
    if (projectDir && await dirExists(localFormatsDir(projectDir))) {
        const entries = await readdir(localFormatsDir(projectDir));
        for (const entry of entries) {
            const ext = extname(entry);
            if (!LOCAL_PLUGIN_EXTS.has(ext)) continue;
            names.add(basename(entry, ext));
        }
    }
    if (projectDir) {
        for (const pluginPackage of await listInstalledPluginPackages("format", projectDir)) {
            names.add(pluginPackage.pluginName);
        }
    }
    return [...names].sort();
}

export async function resolveConfiguredFormats(projectDir: string, configured: unknown): Promise<string[]> {
    if (!Array.isArray(configured)) return ["html"];

    const validConfigured: string[] = [];
    for (const entry of configured) {
        if (typeof entry === "string" && await hasFormat(entry, projectDir)) {
            validConfigured.push(entry);
        }
    }

    return validConfigured.length > 0 ? validConfigured : ["html"];
}

export async function hasFormat(name: string, projectDir?: string): Promise<boolean> {
    if (name in builtinPlugins) return true;
    if (!projectDir) return false;
    if ((await resolveLocalFormatFile(projectDir, name)) !== null) return true;
    return (await findInstalledPluginPackage("format", name, projectDir)) !== null;
}

export async function resolveFormatPlugin(name: string, projectDir?: string): Promise<FormatPlugin | null> {
    if (name in builtinPlugins) return builtinPlugins[name];
    if (!projectDir) return null;
    const localPlugin = await loadLocalPlugin(projectDir, name);
    if (localPlugin) return localPlugin;
    return loadExternalPlugin(projectDir, name);
}

export async function buildFormat(
    name: string,
    projectDir: string,
    config: BookConfig,
    chapters: Chapter[],
    theme: Theme,
    sections?: Section[],
    features?: TypeFeatures,
    typeDefaultPreset?: string,
): Promise<string | undefined> {
    const plugin = await resolveFormatPlugin(name, projectDir);
    if (!plugin) {
        const available = await allFormatNames(projectDir);
        throw new Error(`Unknown format: "${name}". Supported: ${available.join(", ")}`);
    }

    const context = await createContext(name, projectDir, config, chapters, theme, sections, features, typeDefaultPreset);
    const result = await plugin.build(context);

    if (result === undefined) return;
    if (typeof result === "string" || Buffer.isBuffer(result)) {
        return context.writeOutput(plugin.extension ?? plugin.name, result);
    }
    if (result.content !== undefined) {
        return context.writeOutput(result.extension ?? plugin.extension ?? plugin.name, result.content);
    }
    if (typeof result.path === "string" && result.path.length > 0) {
        return result.path;
    }

    throw new Error(`Invalid build result from format "${plugin.name}": expected content or path`);
}
