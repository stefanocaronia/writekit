import { Command } from "commander";
import { join } from "node:path";
import { readdir, rm } from "node:fs/promises";
import { loadConfig, loadChapters } from "../project/parse.js";
import { loadTheme } from "../support/theme.js";
import { assertProject } from "../support/fs-utils.js";
import { checkProject, printCheckResults } from "./check.js";
import { syncProject } from "./sync.js";
import { loadType, hasType } from "../project/project-type.js";
import { loadTypePlugin, typeOptions as resolveTypeOptions } from "../project/type-plugin.js";
import { allFormatNames, hasFormat, resolveConfiguredFormats, buildFormat as runFormatBuild } from "../formats/format-registry.js";

async function cleanBuild(projectDir: string): Promise<void> {
    const { c, icon } = await import("../support/ui.js");
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

async function resolveFormats(
    projectDir: string,
    format: string | undefined,
    config: Awaited<ReturnType<typeof loadConfig>>,
): Promise<string[]> {
    const available = await allFormatNames(projectDir);

    if (format === "all") return available;

    if (format) {
        if (await hasFormat(format, projectDir)) return [format];
        console.error(`\nUnknown format: "${format}". Supported: ${available.join(", ")}, all\n`);
        process.exit(1);
    }

    return resolveConfiguredFormats(projectDir, config.build_formats);
}

export const buildCommand = new Command("build")
    .description("Build the project (pdf, epub, html, docx, md, all, clean)")
    .argument("[format]", "Output format (default: from config or html)")
    .action(async (format: string | undefined) => {
        const { c, icon } = await import("../support/ui.js");
        const projectDir = process.cwd();

        if (format === "clean") {
            await assertProject(projectDir);
            await cleanBuild(projectDir);
            return;
        }

        await assertProject(projectDir);

        console.log(`\n${icon.report} ${c.bold("Syncing project...")}\n`);
        const syncResult = await syncProject(projectDir);
        if (syncResult.roles > 0) {
            console.log(`  ${c.dim(`✓ Updated ${syncResult.roles} contributor role(s)`)}`);
        }
        if (syncResult.chapters > 0) {
            console.log(`  ${c.dim(`✓ Renumbered ${syncResult.chapters} chapter file(s)`)}`);
        }
        console.log(`  ${c.dim("✓ AGENTS.md refreshed")}`);

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
        const formats = await resolveFormats(projectDir, format, config);

        const typeName = config.type || "novel";
        const typeDef = await hasType(typeName, projectDir) ? await loadType(typeName, projectDir) : undefined;
        const typePlugin = typeDef ? await loadTypePlugin(typeName, projectDir) : null;

        if (typeDef && typePlugin?.onBuild) {
            await typePlugin.onBuild({
                projectDir,
                typeName,
                typeDef,
                config,
                chapters,
                theme,
                formats,
                typeOptions: resolveTypeOptions(config),
            });
        }

        for (const fmt of formats) {
            console.log(`\n${icon.build} ${c.bold(`Building ${fmt}...`)}\n`);
            await runFormatBuild(
                fmt,
                projectDir,
                config,
                chapters,
                theme,
                typeDef?.sections,
                typeDef?.features,
                typeDef?.default_preset,
            );
        }

        console.log(`\n${icon.report} ${c.bold("Generating reports...")}\n`);
        const { generateReports } = await import("../project/reports.js");
        const reports = await generateReports(projectDir);
        console.log(`  ${c.dim(`✓ ${reports.join(", ")}`)}`);

        console.log(`\n${icon.done} ${c.green("Done!")}\n`);
    });
