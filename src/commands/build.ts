import { Command } from "commander";
import { join } from "node:path";
import { mkdir, readdir, rm, writeFile } from "node:fs/promises";
import { loadConfig, loadChapters, type BookConfig, type Chapter } from "../lib/parse.js";
import { renderBook } from "../lib/html.js";
import { buildEpub as buildEpubFile } from "../lib/epub.js";
import { buildPdf as buildPdfFile } from "../lib/pdf.js";
import { buildDocx as buildDocxFile } from "../lib/docx.js";
import { generateReports } from "../lib/reports.js";
import { loadTheme, type Theme } from "../lib/theme.js";
import { assertProject, bookFilename } from "../lib/fs-utils.js";
import { checkProject, printCheckResults } from "./check.js";

const SUPPORTED_FORMATS = ["pdf", "epub", "html", "docx"] as const;
type Format = (typeof SUPPORTED_FORMATS)[number];

function buildFilename(config: BookConfig, ext: string): string {
    return bookFilename(config.title, config.author, ext);
}

async function buildHtml(
    projectDir: string,
    config: BookConfig,
    chapters: Chapter[],
    theme: Theme,
): Promise<void> {
    const html = await renderBook(config, chapters, theme);
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
): Promise<void> {
    const outPath = await buildEpubFile(projectDir, config, chapters, theme, buildFilename(config,"epub"));
    console.log(`  → ${outPath}`);
    console.log(`  ${chapters.length} chapter(s)`);
}

async function buildPdf(
    projectDir: string,
    config: BookConfig,
    chapters: Chapter[],
    theme: Theme,
): Promise<void> {
    const outPath = await buildPdfFile(projectDir, config, chapters, theme, buildFilename(config,"pdf"));
    console.log(`  → ${outPath}`);
    console.log(`  ${chapters.length} chapter(s)`);
}

async function buildDocx(
    projectDir: string,
    config: BookConfig,
    chapters: Chapter[],
    _theme: Theme,
): Promise<void> {
    const outPath = await buildDocxFile(projectDir, config, chapters, buildFilename(config,"docx"));
    console.log(`  → ${outPath}`);
    console.log(`  ${chapters.length} chapter(s)`);
}

const builders: Record<
    Format,
    (dir: string, config: BookConfig, chapters: Chapter[], theme: Theme) => Promise<void>
> = {
    html: buildHtml,
    epub: buildEpub,
    pdf: buildPdf,
    docx: buildDocx,
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
    .description("Build the novel (pdf, epub, html, docx, all, clean)")
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

        // Validate before building
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

        for (const fmt of formats) {
            console.log(`\n${icon.build} ${c.bold(`Building ${fmt}...`)}\n`);
            await builders[fmt](projectDir, config, chapters, theme);
        }

        console.log(`\n${icon.report} ${c.bold("Generating reports...")}\n`);
        await generateReports(projectDir);
        console.log(`  ${c.dim("→ build/reports/ (status, cast, locations, timeline)")}`);
        console.log(`\n${icon.done} ${c.green("Done!")}\n`);
    });
