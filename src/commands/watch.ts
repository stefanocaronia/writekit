import { Command } from "commander";
import { watch, type FSWatcher } from "node:fs";
import { join } from "node:path";
import { checkProject, printCheckResults } from "./check.js";
import { loadConfig, loadChapters } from "../project/parse.js";
import { syncProject } from "./sync.js";
import { loadTheme } from "../support/theme.js";
import { loadType, hasType } from "../project/project-type.js";
import { assertProject, dirExists } from "../support/fs-utils.js";
import { resolveConfiguredFormats, buildFormat as runFormatBuild } from "../formats/format-registry.js";
import { c, icon } from "../support/ui.js";

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
        const formats = await resolveConfiguredFormats(projectDir, config.build_formats);
        const chapters = await loadChapters(projectDir);
        if (chapters.length === 0) {
            console.log(`${timestamp()} ${c.dim("No chapters — skipping build")}`);
        } else {
            const theme = await loadTheme(config.theme, projectDir);
            const typeName = config.type || "novel";
            const typeDef = await hasType(typeName, projectDir) ? await loadType(typeName, projectDir) : undefined;

            for (const fmt of formats) {
                const buildStart = Date.now();
                console.log(`${timestamp()} Starting ${c.yellow(`build ${fmt}`)}...`);
                try {
                    await runFormatBuild(fmt, projectDir, config, chapters, theme, typeDef?.sections, typeDef?.features, typeDef?.default_preset);
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
        const formats = await resolveConfiguredFormats(projectDir, config.build_formats);

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
                const w = watch(fullPath, (_eventType: string, filename: string | null) => onChange(dir, filename));
                watchers.push(w);
            }
        }

        process.on("SIGINT", () => {
            console.log(`\n\n${icon.done} ${c.dim("Stopping watch.")}\n`);
            for (const w of watchers) w.close();
            process.exit(0);
        });
    });
