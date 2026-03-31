import { Command } from "commander";
import { mkdir, writeFile, readFile, copyFile, cp } from "node:fs/promises";
import { join, resolve, dirname } from "node:path";
import { stringify } from "yaml";
import { assertProject, fileExists, dirExists } from "../support/fs-utils.js";
import { loadConfig, type BookConfig } from "../project/parse.js";
import { loadType, resolveTypeFile } from "../project/project-type.js";
import { supportedLanguages } from "../support/i18n.js";
import {
    buildTranslationConfig,
    extractGlossary,
    serializeGlossary,
    scaffoldManuscript,
    getContextDirs,
    buildTranslationAgentsMd,
    buildTranslationReadme,
    loadTranslationConfig,
    resolveSourceDir,
    loadGlossary,
    getTranslationStatus,
    verifyTranslation,
    syncTranslation,
} from "../project/translation.js";

interface TranslateInitOptions {
    to: string;
    output?: string;
    context?: boolean;
    translator?: string;
}

const translateInit = new Command("init")
    .description("Initialize a translation target project")
    .requiredOption("--to <lang>", "Target language code (en, it, fr, ...)")
    .option("--output <path>", "Output directory (default: translations/<lang>/)")
    .option("--context", "Copy context directories (outline, characters, world, concepts)")
    .option("--translator <name>", "Translator name")
    .action(async (opts: TranslateInitOptions) => {
        const sourceDir = process.cwd();
        await assertProject(sourceDir);

        const { c, icon } = await import("../support/ui.js");
        const config = await loadConfig(sourceDir);
        const typeName = config.type || "novel";
        const typeDef = await loadType(typeName, sourceDir);
        const sourceLang = config.language || "en";
        const targetLang = opts.to;

        // Validate language
        if (!supportedLanguages.includes(targetLang)) {
            console.error(`\n${icon.error} ${c.red(`Unsupported language: "${targetLang}"`)}`);
            console.error(`  ${c.dim(`Available: ${supportedLanguages.join(", ")}`)}\n`);
            process.exit(1);
        }

        if (targetLang === sourceLang) {
            console.error(`\n${icon.error} ${c.red("Target language is the same as source language.")}\n`);
            process.exit(1);
        }

        // Resolve target directory
        const targetDir = opts.output
            ? resolve(process.cwd(), opts.output)
            : join(sourceDir, "translations", targetLang);

        if (await fileExists(join(targetDir, "config.yaml"))) {
            console.error(`\n${icon.error} ${c.red(`Translation target already exists at ${targetDir}`)}`);
            console.error(`  ${c.dim("Remove it first or use a different --output.")}\n`);
            process.exit(1);
        }

        console.log(`\n${icon.translate} ${c.bold("Initializing translation:")} ${sourceLang} → ${c.cyan(targetLang)}\n`);

        // 1. Create directories
        for (const dir of typeDef.dirs) {
            await mkdir(join(targetDir, dir), { recursive: true });
        }

        // 2. Generate config.yaml — copy source config, update language + translator
        const newConfig: Record<string, unknown> = { ...(config as unknown as Record<string, unknown>) };
        newConfig.language = targetLang;
        if (opts.translator) {
            newConfig.translator = opts.translator;
        }
        // Remove build artifacts and internal fields
        delete newConfig.format_options;
        await writeFile(join(targetDir, "config.yaml"), stringify(newConfig));

        // 3. Copy root files (style.yaml, synopsis.md, backcover.md, etc.)
        for (const file of typeDef.files) {
            const sourcePath = join(sourceDir, file);
            if (await fileExists(sourcePath)) {
                const targetPath = join(targetDir, file);
                await mkdir(dirname(targetPath), { recursive: true });
                await copyFile(sourcePath, targetPath);
            }
        }

        // 4. Scaffold manuscript (empty bodies + source_hash)
        const msFiles = await scaffoldManuscript(sourceDir, targetDir);

        // 5. Copy contributors
        const contribDir = join(sourceDir, "contributors");
        if (await dirExists(contribDir)) {
            await cp(contribDir, join(targetDir, "contributors"), { recursive: true });
        }

        // 6. Copy context directories (optional)
        if (opts.context) {
            for (const dir of getContextDirs(typeDef)) {
                const srcDir = join(sourceDir, dir);
                if (await dirExists(srcDir)) {
                    await cp(srcDir, join(targetDir, dir), { recursive: true });
                }
            }
        }

        // 7. Generate translation.yaml
        const translationConfig = buildTranslationConfig(sourceDir, targetDir, sourceLang, targetLang);
        await writeFile(join(targetDir, "translation.yaml"), stringify(translationConfig));

        // 8. Generate translation-glossary.yaml
        const glossary = await extractGlossary(sourceDir, config, typeDef);
        await writeFile(join(targetDir, "translation-glossary.yaml"), serializeGlossary(glossary));

        // 9. AGENTS.md
        await writeFile(join(targetDir, "AGENTS.md"), buildTranslationAgentsMd(translationConfig));

        // 10. .gitignore + README.md
        await writeFile(join(targetDir, ".gitignore"), "build/\n");
        await writeFile(join(targetDir, "README.md"), buildTranslationReadme(config, targetLang));

        // 11. Copy custom local type if applicable
        const typeSource = await resolveTypeFile(typeName, sourceDir);
        if (typeSource?.source === "local") {
            const targetTypeDir = join(targetDir, "types", typeName);
            await mkdir(targetTypeDir, { recursive: true });
            await cp(dirname(typeSource.path), targetTypeDir, { recursive: true, force: true });
        }

        // Print summary
        const relTarget = opts.output ?? `translations/${targetLang}/`;
        console.log(`  ${c.bold(relTarget)}`);
        console.log(c.gray("  ├── config.yaml"));
        console.log(c.gray("  ├── translation.yaml"));
        console.log(c.gray("  ├── translation-glossary.yaml"));
        for (const file of typeDef.files) {
            if (await fileExists(join(targetDir, file))) {
                console.log(c.gray(`  ├── ${file}`));
            }
        }
        console.log(c.gray("  ├── manuscript/"));
        for (const f of msFiles.filter((f) => f.startsWith("manuscript/"))) {
            const name = f.split("/").pop();
            console.log(c.gray(`  │   └── ${name}`));
        }
        if (await dirExists(join(targetDir, "contributors"))) {
            console.log(c.gray("  ├── contributors/"));
        }
        console.log(c.gray("  ├── AGENTS.md"));
        console.log(c.gray("  └── README.md"));

        // Glossary summary
        const totalEntries = glossary.characters.length + glossary.locations.length
            + glossary.concepts.length + glossary.people.length + glossary.titles.length;
        if (totalEntries > 0) {
            console.log(`\n  ${icon.report} ${c.dim(`Glossary: ${totalEntries} entries extracted`)}`);
        }

        console.log(`\n${icon.done} ${c.green("Translation project ready!")}`);
        console.log(`\n  ${c.dim("Next steps:")}`);
        console.log(`  ${c.cyan(`cd ${relTarget}`)}`);
        console.log(`  ${c.dim("1. Fill in")} translation-glossary.yaml`);
        console.log(`  ${c.dim("2. Translate each file in")} manuscript/`);
        console.log(`  ${c.dim("3.")} ${c.cyan("wk check")} ${c.dim("→")} ${c.cyan("wk build")}\n`);
    });

// ---------------------------------------------------------------------------
// wk translate glossary
// ---------------------------------------------------------------------------

const translateGlossary = new Command("glossary")
    .description("Show translation glossary and highlight untranslated entries")
    .action(async () => {
        const projectDir = process.cwd();
        await assertProject(projectDir);
        const { c, icon } = await import("../support/ui.js");

        await loadTranslationConfig(projectDir); // validate it's a translation project
        const glossary = await loadGlossary(projectDir);

        const sections: [string, typeof glossary.characters][] = [
            ["Characters", glossary.characters],
            ["Locations", glossary.locations],
            ["Concepts", glossary.concepts],
            ["People", glossary.people],
            ["Titles", glossary.titles],
        ];

        let total = 0;
        let translated = 0;

        console.log(`\n${icon.translate} ${c.bold("Translation Glossary")}\n`);

        for (const [label, entries] of sections) {
            if (entries.length === 0) continue;
            console.log(`  ${c.bold(label)}`);
            for (const entry of entries) {
                total++;
                const src = entry.source;
                const tgt = entry.translation;
                if (tgt) {
                    translated++;
                    console.log(`    ${c.green("✓")} ${src} → ${c.cyan(tgt)}`);
                } else {
                    console.log(`    ${c.yellow("○")} ${src} → ${c.dim("(untranslated)")}`);
                }
            }
            console.log();
        }

        if (total === 0) {
            console.log(`  ${c.dim("No glossary entries.")}\n`);
        } else {
            const pct = Math.round((translated / total) * 100);
            const color = pct === 100 ? c.green : pct > 50 ? c.yellow : c.red;
            console.log(`  ${color(`${translated}/${total}`)} entries translated (${color(`${pct}%`)})\n`);
        }
    });

// ---------------------------------------------------------------------------
// wk translate status
// ---------------------------------------------------------------------------

const translateStatus = new Command("status")
    .description("Show translation progress and detect source drift")
    .action(async () => {
        const projectDir = process.cwd();
        await assertProject(projectDir);
        const { c, icon } = await import("../support/ui.js");

        const tc = await loadTranslationConfig(projectDir);
        const sourceDir = resolveSourceDir(projectDir, tc);

        if (!(await dirExists(sourceDir))) {
            console.error(`\n${icon.error} ${c.red(`Source project not found at ${sourceDir}`)}\n`);
            process.exit(1);
        }

        const statuses = await getTranslationStatus(projectDir, sourceDir);

        console.log(`\n${icon.translate} ${c.bold("Translation Status")} (${tc.source_language} → ${tc.target_language})\n`);

        const counts = { translated: 0, untranslated: 0, outdated: 0, source_missing: 0 };
        for (const fs of statuses) {
            counts[fs.status]++;
            const statusIcon = fs.status === "translated" ? c.green("✓")
                : fs.status === "outdated" ? c.yellow("△")
                : fs.status === "source_missing" ? c.red("✗")
                : c.dim("○");
            const label = fs.status === "outdated" ? c.yellow("outdated")
                : fs.status === "source_missing" ? c.red("source missing")
                : fs.status === "translated" ? c.green("translated")
                : c.dim("untranslated");
            console.log(`  ${statusIcon} ${fs.relPath} ${c.dim("—")} ${label}`);
        }

        console.log();
        const total = statuses.length;
        if (total === 0) {
            console.log(`  ${c.dim("No manuscript files found.")}\n`);
            return;
        }

        const pct = Math.round((counts.translated / total) * 100);
        console.log(`  ${c.bold("Progress:")} ${counts.translated}/${total} translated (${pct}%)`);
        if (counts.outdated > 0) console.log(`  ${c.yellow(`${counts.outdated} file(s) outdated`)} — source changed since translation`);
        if (counts.source_missing > 0) console.log(`  ${c.red(`${counts.source_missing} file(s) source missing`)} — source file removed`);
        console.log();
    });

// ---------------------------------------------------------------------------
// wk translate verify
// ---------------------------------------------------------------------------

const translateVerify = new Command("verify")
    .description("Verify glossary consistency in translated text")
    .action(async () => {
        const projectDir = process.cwd();
        await assertProject(projectDir);
        const { c, icon } = await import("../support/ui.js");

        const tc = await loadTranslationConfig(projectDir);
        const sourceDir = resolveSourceDir(projectDir, tc);
        const glossary = await loadGlossary(projectDir);

        console.log(`\n${icon.quill} ${c.bold("Verifying translation...")}\n`);

        const issues = await verifyTranslation(projectDir, sourceDir, glossary);

        if (issues.length === 0) {
            console.log(`  ${icon.check} ${c.green("No issues found.")}\n`);
            return;
        }

        for (const issue of issues) {
            const levelIcon = issue.level === "error" ? icon.error : icon.warn;
            const colorFn = issue.level === "error" ? c.red : c.yellow;
            console.log(`  ${levelIcon} ${colorFn(`${issue.file}: ${issue.message}`)}`);
        }

        const errors = issues.filter((i) => i.level === "error").length;
        const warnings = issues.filter((i) => i.level === "warning").length;
        console.log(`\n  ${c.bold(`${errors} error(s), ${warnings} warning(s)`)}\n`);
    });

// ---------------------------------------------------------------------------
// wk translate sync
// ---------------------------------------------------------------------------

const translateSync = new Command("sync")
    .description("Synchronize target structure with source project")
    .action(async () => {
        const projectDir = process.cwd();
        await assertProject(projectDir);
        const { c, icon } = await import("../support/ui.js");

        const tc = await loadTranslationConfig(projectDir);
        const sourceDir = resolveSourceDir(projectDir, tc);

        if (!(await dirExists(sourceDir))) {
            console.error(`\n${icon.error} ${c.red(`Source project not found at ${sourceDir}`)}\n`);
            process.exit(1);
        }

        console.log(`\n${icon.translate} ${c.bold("Syncing translation structure...")}\n`);

        const result = await syncTranslation(projectDir, sourceDir);

        if (result.added.length === 0 && result.removed.length === 0 && result.updated.length === 0) {
            console.log(`  ${icon.check} ${c.green("Already in sync.")}\n`);
            return;
        }

        for (const f of result.added) {
            console.log(`  ${c.green("+")} ${f} ${c.dim("(new from source)")}`);
        }
        for (const f of result.removed) {
            console.log(`  ${c.yellow("!")} ${f} ${c.dim("(source removed — review manually)")}`);
        }
        for (const f of result.updated) {
            console.log(`  ${c.cyan("↻")} ${f} ${c.dim("(hash updated)")}`);
        }

        console.log(`\n  ${c.bold(`${result.added.length} added, ${result.removed.length} flagged, ${result.updated.length} updated`)}\n`);
    });

// ---------------------------------------------------------------------------
// wk translate diff
// ---------------------------------------------------------------------------

const translateDiff = new Command("diff")
    .description("Show which target files are behind the source")
    .action(async () => {
        const projectDir = process.cwd();
        await assertProject(projectDir);
        const { c, icon } = await import("../support/ui.js");

        const tc = await loadTranslationConfig(projectDir);
        const sourceDir = resolveSourceDir(projectDir, tc);

        if (!(await dirExists(sourceDir))) {
            console.error(`\n${icon.error} ${c.red(`Source project not found at ${sourceDir}`)}\n`);
            process.exit(1);
        }

        const statuses = await getTranslationStatus(projectDir, sourceDir);
        const outdated = statuses.filter((s) => s.status === "outdated");
        const missing = statuses.filter((s) => s.status === "source_missing");

        console.log(`\n${icon.translate} ${c.bold("Translation Diff")}\n`);

        if (outdated.length === 0 && missing.length === 0) {
            console.log(`  ${icon.check} ${c.green("All files up to date with source.")}\n`);
            return;
        }

        for (const fs of outdated) {
            console.log(`  ${c.yellow("△")} ${fs.relPath}`);
            console.log(`    ${c.dim(`source: ${fs.sourcePath}`)}`);
            console.log(`    ${c.dim(`stored hash:  ${fs.sourceHash.slice(0, 12)}...`)}`);
            console.log(`    ${c.dim(`current hash: ${fs.currentSourceHash?.slice(0, 12)}...`)}`);
        }

        for (const fs of missing) {
            console.log(`  ${c.red("✗")} ${fs.relPath} ${c.dim("— source file removed")}`);
        }

        console.log(`\n  ${c.bold(`${outdated.length} outdated, ${missing.length} source missing`)}\n`);
    });

// ---------------------------------------------------------------------------
// Parent command
// ---------------------------------------------------------------------------

export const translateCommand = new Command("translate")
    .description("Translation management");

translateCommand.addCommand(translateInit);
translateCommand.addCommand(translateGlossary);
translateCommand.addCommand(translateStatus);
translateCommand.addCommand(translateVerify);
translateCommand.addCommand(translateSync);
translateCommand.addCommand(translateDiff);
