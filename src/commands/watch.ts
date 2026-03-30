import { Command } from "commander";
import { watch, type FSWatcher } from "node:fs";
import { join } from "node:path";
import { mkdir, writeFile } from "node:fs/promises";
import { checkProject, printCheckResults } from "./check.js";
import { loadConfig, loadChapters, loadContributors, loadBackcover, resolveCover } from "../lib/parse.js";
import { renderBook } from "../lib/html.js";
import { buildEpub as buildEpubFile } from "../lib/epub.js";
import { buildPdf as buildPdfFile } from "../lib/pdf.js";
import { buildDocx as buildDocxFile } from "../lib/docx.js";
import { renderBookMd } from "../lib/md.js";
import { syncProject } from "./sync.js";
import { loadTheme } from "../lib/theme.js";
import { loadTypography } from "../lib/typography.js";
import { loadType, isValidType } from "../lib/project-type.js";
import { resolvePrintPreset } from "../lib/print-presets.js";
import { assertProject, bookFilename, dirExists } from "../lib/fs-utils.js";
import { c, icon } from "../lib/ui.js";

const WATCH_DIRS = [
    ".",
    "outline",
    "outline/chapters",
    "manuscript",
    "characters",
    "world",
    "contributors",
    "arguments",
    "concepts",
    "notes",
    "assets",
];

const BUILD_TRIGGERS = new Set([
    "manuscript", "config.yaml", "style.yaml", "synopsis.md",
    "backcover.md", "assets", "contributors", "timeline.yaml",
    "thesis.md", "abstract.md",
]);

function shouldRebuild(changedPath: string): boolean {
    const dir = changedPath.split("/")[0];
    return BUILD_TRIGGERS.has(dir) || BUILD_TRIGGERS.has(changedPath);
}

const DEBOUNCE_MS = 500;
const IGNORE_FILES = new Set(["AGENTS.md"]);
const IGNORE_DIRS = new Set(["build", "node_modules", ".git"]);

function timestamp(): string {
    return c.dim(`[${new Date().toLocaleTimeString()}]`);
}

function elapsed(start: number): string {
    const ms = Date.now() - start;
    return ms < 1000 ? `${ms}ms` : `${(ms / 1000).toFixed(1)}s`;
}

async function buildFormat(
    fmt: string, projectDir: string, config: ReturnType<typeof Object>,
    chapters: Awaited<ReturnType<typeof loadChapters>>,
    theme: Awaited<ReturnType<typeof loadTheme>>,
    typeSections: any, typeFeatures: any, typeDefaultPreset: string | undefined,
): Promise<void> {
    const contributors = await loadContributors(projectDir);
    const backcover = await loadBackcover(projectDir);
    const coverPath = await resolveCover(projectDir, config as any);
    const fname = bookFilename((config as any).title, (config as any).author, fmt);
    const buildDir = join(projectDir, "build");
    await mkdir(buildDir, { recursive: true });

    if (fmt === "html") {
        const typography = await loadTypography(projectDir);
        const html = await renderBook(config as any, chapters, theme, contributors, backcover, coverPath, projectDir, typography, typeSections, typeFeatures);
        await writeFile(join(buildDir, fname), html, "utf-8");
    } else if (fmt === "epub") {
        await buildEpubFile(projectDir, config as any, chapters, theme, fname, contributors, backcover, coverPath, typeSections, typeFeatures);
    } else if (fmt === "pdf") {
        await buildPdfFile(projectDir, config as any, chapters, theme, fname, contributors, backcover, coverPath, typeSections, typeFeatures, typeDefaultPreset);
    } else if (fmt === "docx") {
        const preset = resolvePrintPreset(config as any, typeDefaultPreset);
        await buildDocxFile(projectDir, config as any, chapters, fname, contributors, backcover, coverPath, theme.docx, typeSections, typeFeatures, preset);
    } else if (fmt === "md") {
        const md = await renderBookMd(projectDir, config as any, chapters, contributors, backcover, typeSections, typeFeatures);
        await writeFile(join(buildDir, fname), md, "utf-8");
    }
}

async function runCycle(
    projectDir: string,
    changedFile?: string,
): Promise<void> {
    if (changedFile) {
        console.log(`${timestamp()} ${c.magenta("changed")} ${c.cyan(changedFile)}`);
    }

    const needsBuild = !changedFile || shouldRebuild(changedFile);

    // Check
    const checkStart = Date.now();
    console.log(`${timestamp()} Starting ${c.yellow("check")}...`);
    const result = await checkProject(projectDir);

    if (result.errors.length > 0 || result.warnings.length > 0) {
        await printCheckResults(result);
        if (result.errors.length > 0) {
            console.log(`${timestamp()} ${c.red("check failed")} ${c.dim(`after ${elapsed(checkStart)}`)}\n`);
            return;
        }
    }
    console.log(`${timestamp()} Finished ${c.yellow("check")} ${c.green("✓")} ${c.dim(elapsed(checkStart))}`);

    // Build — reload config every cycle to pick up changes
    if (needsBuild) {
        const config = await loadConfig(projectDir);
        const formats = config.build_formats ?? ["html"];
        const chapters = await loadChapters(projectDir);
        if (chapters.length === 0) {
            console.log(`${timestamp()} ${c.dim("No chapters — skipping build")}`);
        } else {
            const theme = await loadTheme(config.theme, projectDir);
            const typeName = config.type || "novel";
            const typeDef = isValidType(typeName) ? await loadType(typeName) : undefined;

            for (const fmt of formats) {
                const buildStart = Date.now();
                console.log(`${timestamp()} Starting ${c.yellow(`build ${fmt}`)}...`);
                try {
                    await buildFormat(fmt, projectDir, config, chapters, theme, typeDef?.sections, typeDef?.features, typeDef?.default_preset);
                    console.log(`${timestamp()} Finished ${c.yellow(`build ${fmt}`)} ${c.green("✓")} ${c.dim(elapsed(buildStart))}`);
                } catch (e) {
                    console.log(`${timestamp()} ${c.red(`build ${fmt} failed`)} ${c.dim(elapsed(buildStart))} ${c.dim(String(e))}`);
                }
            }
        }
    } else if (changedFile) {
        console.log(`${timestamp()} ${c.dim("Build skipped (non-content change)")}`);
    }

    // Sync
    const syncStart = Date.now();
    await syncProject(projectDir);
    console.log(`${timestamp()} Finished ${c.yellow("sync")} ${c.green("✓")} ${c.dim(elapsed(syncStart))}`);

    console.log();
}

export const watchCommand = new Command("watch")
    .description("Watch for changes, run check and rebuild all configured formats")
    .action(async () => {
        const projectDir = process.cwd();
        await assertProject(projectDir);

        const config = await loadConfig(projectDir);
        const formats = config.build_formats ?? ["html"];

        console.log(`\n${icon.watch} ${c.bold("Watching for changes...")} ${c.dim(`(build: ${formats.join(", ")})`)}`);
        console.log(`${c.dim("  Press Ctrl+C to stop.")}\n`);

        // Initial run
        await runCycle(projectDir);

        // Build lock: finish current build, then re-run if changes arrived
        let building = false;
        let pendingChange: string | null = null;
        let timer: ReturnType<typeof setTimeout> | null = null;

        async function scheduleBuild(rel: string) {
            if (building) {
                pendingChange = rel; // will re-run after current build
                return;
            }
            building = true;
            try {
                await runCycle(projectDir, rel);
                // If changes arrived during build, run again
                while (pendingChange) {
                    const next = pendingChange;
                    pendingChange = null;
                    await runCycle(projectDir, next);
                }
            } finally {
                building = false;
            }
        }

        const onChange = (dir: string, filename: string | null) => {
            if (!filename) return;
            if (filename.startsWith(".")) return;
            if (IGNORE_FILES.has(filename)) return;
            if (dir === "." && IGNORE_DIRS.has(filename)) return;

            const rel = dir === "." ? filename : `${dir}/${filename}`;

            if (timer) clearTimeout(timer);
            timer = setTimeout(() => scheduleBuild(rel), DEBOUNCE_MS);
        };

        const watchers: FSWatcher[] = [];
        for (const dir of WATCH_DIRS) {
            const fullPath = join(projectDir, dir);
            if (await dirExists(fullPath)) {
                const w = watch(fullPath, (_, filename) => onChange(dir, filename));
                watchers.push(w);
            }
        }

        process.on("SIGINT", () => {
            console.log(`\n\n${icon.done} ${c.dim("Stopping watch.")}\n`);
            for (const w of watchers) w.close();
            process.exit(0);
        });
    });
