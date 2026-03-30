import { Command } from "commander";
import { join } from "node:path";
import { mkdir, readdir, rm, writeFile } from "node:fs/promises";
import { loadConfig, loadChapters, loadContributors, loadBackcover, resolveCover, type BookConfig, type Chapter } from "../lib/parse.js";
import { renderBook } from "../lib/html.js";
import { buildEpub as buildEpubFile } from "../lib/epub.js";
import { buildPdf as buildPdfFile } from "../lib/pdf.js";
import { buildDocx as buildDocxFile } from "../lib/docx.js";
import { renderBookMd } from "../lib/md.js";
import { loadTheme, type Theme } from "../lib/theme.js";
import { assertProject, bookFilename } from "../lib/fs-utils.js";
import { checkProject, printCheckResults } from "./check.js";
import { syncProject } from "./sync.js";
import { loadTypography } from "../lib/typography.js";
import { loadType, isValidType, type Section, type TypeFeatures } from "../lib/project-type.js";
import { resolvePrintPreset } from "../lib/print-presets.js";

const SUPPORTED_FORMATS = ["pdf", "epub", "html", "docx", "md"] as const;
type Format = (typeof SUPPORTED_FORMATS)[number];

function buildFilename(config: BookConfig, ext: string): string {
    return bookFilename(config.title, config.author, ext);
}

async function buildHtml(
    projectDir: string,
    config: BookConfig,
    chapters: Chapter[],
    theme: Theme,
    sections?: Section[],
    features?: TypeFeatures,
): Promise<void> {
    const contributors = await loadContributors(projectDir);
    const backcover = await loadBackcover(projectDir);
    const coverPath = await resolveCover(projectDir, config);
    const typography = await loadTypography(projectDir);
    const html = await renderBook(config, chapters, theme, contributors, backcover, coverPath, projectDir, typography, sections, features);
    const buildDir = join(projectDir, "build");
    await mkdir(buildDir, { recursive: true });

    const outPath = join(buildDir, buildFilename(config,"html"));
    await writeFile(outPath, html, "utf-8");
    console.log(`  → ${outPath}`);
    console.log(`  ${chapters.length} chapter(s), ${html.length} bytes`);
}

async function buildEpub(
    projectDir: string,
    config: BookConfig,
    chapters: Chapter[],
    theme: Theme,
    sections?: Section[],
    features?: TypeFeatures,
): Promise<void> {
    const contributors = await loadContributors(projectDir);
    const backcover = await loadBackcover(projectDir);
    const coverPath = await resolveCover(projectDir, config);
    const outPath = await buildEpubFile(projectDir, config, chapters, theme, buildFilename(config,"epub"), contributors, backcover, coverPath, sections, features);
    console.log(`  → ${outPath}`);
    console.log(`  ${chapters.length} chapter(s)`);
}

async function buildPdf(
    projectDir: string,
    config: BookConfig,
    chapters: Chapter[],
    theme: Theme,
    sections?: Section[],
    features?: TypeFeatures,
    typeDefaultPreset?: string,
): Promise<void> {
    const contributors = await loadContributors(projectDir);
    const backcover = await loadBackcover(projectDir);
    const coverPath = await resolveCover(projectDir, config);
    const outPath = await buildPdfFile(projectDir, config, chapters, theme, buildFilename(config,"pdf"), contributors, backcover, coverPath, sections, features, typeDefaultPreset);
    console.log(`  → ${outPath}`);
    console.log(`  ${chapters.length} chapter(s)`);
}

async function buildDocx(
    projectDir: string,
    config: BookConfig,
    chapters: Chapter[],
    theme: Theme,
    sections?: Section[],
    features?: TypeFeatures,
    typeDefaultPreset?: string,
): Promise<void> {
    const contributors = await loadContributors(projectDir);
    const backcover = await loadBackcover(projectDir);
    const coverPath = await resolveCover(projectDir, config);
    const preset = resolvePrintPreset(config, typeDefaultPreset);
    const outPath = await buildDocxFile(projectDir, config, chapters, buildFilename(config,"docx"), contributors, backcover, coverPath, theme.docx, sections, features, preset);
    console.log(`  → ${outPath}`);
    console.log(`  ${chapters.length} chapter(s)`);
}

async function buildMd(
    projectDir: string,
    config: BookConfig,
    chapters: Chapter[],
    _theme: Theme,
    sections?: Section[],
    features?: TypeFeatures,
): Promise<void> {
    const contributors = await loadContributors(projectDir);
    const backcover = await loadBackcover(projectDir);
    const md = await renderBookMd(projectDir, config, chapters, contributors, backcover, sections, features);
    const buildDir = join(projectDir, "build");
    await mkdir(buildDir, { recursive: true });
    const outPath = join(buildDir, buildFilename(config, "md"));
    await writeFile(outPath, md, "utf-8");
    console.log(`  → ${outPath}`);
    console.log(`  ${chapters.length} chapter(s), ${md.length} bytes`);
}

const builders: Record<
    Format,
    (dir: string, config: BookConfig, chapters: Chapter[], theme: Theme, sections?: Section[], features?: TypeFeatures, typeDefaultPreset?: string) => Promise<void>
> = {
    html: buildHtml,
    epub: buildEpub,
    pdf: buildPdf,
    docx: buildDocx,
    md: buildMd,
};

const ALL_FORMATS = [...SUPPORTED_FORMATS];

async function cleanBuild(projectDir: string): Promise<void> {
    const { c, icon } = await import("../lib/ui.js");
    const buildDir = join(projectDir, "build");
    try {
        const entries = await readdir(buildDir);
        for (const entry of entries) {
            await rm(join(buildDir, entry), { recursive: true, force: true });
        }
        console.log(`\n${icon.clean} ${c.green("Cleaned build/")}\n`);
    } catch {
        console.log(`\n${icon.clean} ${c.dim("build/ is already empty")}\n`);
    }
}

function resolveFormats(format: string | undefined, config: BookConfig): Format[] {
    if (format === "all") return ALL_FORMATS;

    if (format && SUPPORTED_FORMATS.includes(format as Format)) {
        return [format as Format];
    }

    if (format) {
        console.error(
            `\nUnknown format: "${format}". Supported: ${SUPPORTED_FORMATS.join(", ")}, all\n`,
        );
        process.exit(1);
    }

    // No argument: use config.build_formats or default to html
    const configured = config.build_formats;
    if (Array.isArray(configured) && configured.length > 0) {
        const valid = configured.filter((f) =>
            SUPPORTED_FORMATS.includes(f as Format),
        ) as Format[];
        if (valid.length > 0) return valid;
    }

    return ["html"];
}

export const buildCommand = new Command("build")
    .description("Build the project (pdf, epub, html, docx, all, clean)")
    .argument("[format]", "Output format (default: from config or html)")
    .action(async (format: string | undefined) => {
        const { c, icon } = await import("../lib/ui.js");
        const projectDir = process.cwd();

        if (format === "clean") {
            await assertProject(projectDir);
            await cleanBuild(projectDir);
            return;
        }

        await assertProject(projectDir);

        // Sync first (fix numbering, roles, etc.)
        console.log(`\n${icon.report} ${c.bold("Syncing project...")}\n`);
        const syncResult = await syncProject(projectDir);
        if (syncResult.roles > 0) {
            console.log(`  ${c.dim(`✓ Updated ${syncResult.roles} contributor role(s)`)}`);
        }
        if (syncResult.chapters > 0) {
            console.log(`  ${c.dim(`✓ Renumbered ${syncResult.chapters} chapter file(s)`)}`);
        }
        console.log(`  ${c.dim("✓ AGENTS.md refreshed")}`);

        // Validate after sync
        console.log(`\n${icon.quill} ${c.bold("Checking project...")}\n`);
        const result = await checkProject(projectDir);
        if (result.errors.length > 0) {
            await printCheckResults(result);
            console.log(`  ${c.red("Fix errors before building.")}\n`);
            process.exit(1);
        }
        if (result.warnings.length > 0) {
            await printCheckResults(result);
        } else {
            console.log(`  ${c.green("✓")} ${c.dim("No issues")}`);
        }

        const config = await loadConfig(projectDir);
        const chapters = await loadChapters(projectDir);

        if (chapters.length === 0) {
            console.log(`\n  ${icon.warn}  ${c.yellow("No chapters found in manuscript/")}\n`);
            return;
        }

        const theme = await loadTheme(config.theme, projectDir);
        const formats = resolveFormats(format, config);

        // Load type sections
        const typeName = config.type || "novel";
        const typeDef = isValidType(typeName) ? await loadType(typeName) : undefined;
        const typeSections = typeDef?.sections;
        const typeFeatures = typeDef?.features;

        const typeDefaultPreset = typeDef?.default_preset;

        for (const fmt of formats) {
            console.log(`\n${icon.build} ${c.bold(`Building ${fmt}...`)}\n`);
            await builders[fmt](projectDir, config, chapters, theme, typeSections, typeFeatures, typeDefaultPreset);
        }

        // Reports (generated after build so they reflect latest content)
        console.log(`\n${icon.report} ${c.bold("Generating reports...")}\n`);
        const { generateReports } = await import("../lib/reports.js");
        const reports = await generateReports(projectDir);
        console.log(`  ${c.dim(`✓ ${reports.join(", ")}`)}`);

        console.log(`\n${icon.done} ${c.green("Done!")}\n`);
    });
