import { Command } from "commander";
import { watch, type FSWatcher } from "node:fs";
import { join } from "node:path";
import { mkdir, writeFile } from "node:fs/promises";
import { checkProject, printCheckResults } from "./check.js";
import { loadConfig, loadChapters } from "../lib/parse.js";
import { renderBook } from "../lib/html.js";
import { buildEpub } from "../lib/epub.js";
import { syncProject } from "./sync.js";
import { loadTheme } from "../lib/theme.js";
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

// Dirs/files that trigger a full rebuild (affect output content)
const BUILD_TRIGGERS = new Set([
    "manuscript", "config.yaml", "style.yaml", "synopsis.md",
    "backcover.md", "assets", "contributors", "timeline.yaml",
    "thesis.md", "abstract.md",
]);

function shouldRebuild(changedPath: string): boolean {
    const dir = changedPath.split("/")[0];
    return BUILD_TRIGGERS.has(dir) || BUILD_TRIGGERS.has(changedPath);
}

const WATCHABLE_FORMATS = ["html", "epub"] as const;
type WatchFormat = (typeof WATCHABLE_FORMATS)[number];

const DEBOUNCE_MS = 300;

function timestamp(): string {
    return c.dim(`[${new Date().toLocaleTimeString()}]`);
}

function elapsed(start: number): string {
    const ms = Date.now() - start;
    return ms < 1000 ? `${ms}ms` : `${(ms / 1000).toFixed(1)}s`;
}

async function runCycle(
    projectDir: string,
    format: WatchFormat,
    changedFile?: string,
): Promise<void> {
    // Show what changed
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

    // Build (skip if change was in a non-content dir like notes/, characters/)
    const config = await loadConfig(projectDir);
    const chapters = await loadChapters(projectDir);

    if (needsBuild && chapters.length > 0) {
        const theme = await loadTheme(config.theme, projectDir);
        const buildStart = Date.now();
        console.log(`${timestamp()} Starting ${c.yellow(`build ${format}`)}...`);

        if (format === "html") {
            const html = await renderBook(config, chapters, theme);
            const buildDir = join(projectDir, "build");
            await mkdir(buildDir, { recursive: true });
            const fname = bookFilename(config.title, config.author, "html");
            await writeFile(join(buildDir, fname), html, "utf-8");
            console.log(`${timestamp()} Finished ${c.yellow(`build ${format}`)} ${c.green("✓")} ${c.dim(elapsed(buildStart))} ${c.dim(`→ ${fname}`)}`);
        } else if (format === "epub") {
            const fname = bookFilename(config.title, config.author, "epub");
            await buildEpub(projectDir, config, chapters, theme, fname);
            console.log(`${timestamp()} Finished ${c.yellow(`build ${format}`)} ${c.green("✓")} ${c.dim(elapsed(buildStart))} ${c.dim(`→ ${fname}`)}`);
        }
    } else if (!needsBuild && changedFile) {
        console.log(`${timestamp()} ${c.dim("Build skipped (non-content change)")}`);
    }

    // Sync (reports, agents, contributor roles)
    const syncStart = Date.now();
    await syncProject(projectDir);
    console.log(`${timestamp()} Finished ${c.yellow("sync")} ${c.green("✓")} ${c.dim(elapsed(syncStart))}`);

    console.log();
}

export const watchCommand = new Command("watch")
    .description("Watch for changes, run check and rebuild")
    .argument(
        "[format]",
        `Output format to rebuild (${WATCHABLE_FORMATS.join(", ")})`,
        "html",
    )
    .action(async (format: string) => {
        if (!WATCHABLE_FORMATS.includes(format as WatchFormat)) {
            console.error(
                `\n${icon.error} ${c.red(`Format "${format}" is not supported for watch.`)} Use: ${WATCHABLE_FORMATS.join(", ")}`,
            );
            console.error(`${c.dim("For PDF and DOCX, use: wk build pdf")}\n`);
            process.exit(1);
        }

        const projectDir = process.cwd();
        await assertProject(projectDir);

        console.log(`\n${icon.watch} ${c.bold("Watching for changes...")} ${c.dim(`(build: ${format})`)}`);
        console.log(`${c.dim("  Press Ctrl+C to stop.")}\n`);

        // Initial run
        await runCycle(projectDir, format as WatchFormat);

        // Debounce timer
        let timer: ReturnType<typeof setTimeout> | null = null;

        const onChange = (dir: string, filename: string | null) => {
            if (!filename) return;
            if (filename.startsWith(".")) return;

            const rel = dir === "." ? filename : `${dir}/${filename}`;

            if (timer) clearTimeout(timer);
            timer = setTimeout(async () => {
                await runCycle(projectDir, format as WatchFormat, rel);
            }, DEBOUNCE_MS);
        };

        // Set up watchers on each directory
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
