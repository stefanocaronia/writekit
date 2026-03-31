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

export const translateCommand = new Command("translate")
    .description("Translation management");

translateCommand.addCommand(translateInit);
