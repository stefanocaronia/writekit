import { Command } from "commander";
import { cp, mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { execSync } from "node:child_process";
import { input, select } from "@inquirer/prompts";
import { frontmatter } from "../support/fs-utils.js";
import { loadConfig } from "../project/parse.js";
import { loadType, allTypeNames, resolveTypeFile, type ProjectType } from "../project/project-type.js";
import { loadTypePlugin, typeOptions as resolveTypeOptions } from "../project/type-plugin.js";
import { languageChoices } from "../support/i18n.js";
import { ensureAgentsMd } from "../project/agents.js";
import { generateDocs } from "../project/docs.js";

interface InitOptions {
    title: string;
    author: string;
    language: string;
    type: string;
}

async function promptOptions(name: string, skip: boolean, typeFlag?: string): Promise<InitOptions> {
    if (skip) {
        return {
            title: name,
            author: "",
            language: "it",
            type: typeFlag || "novel",
        };
    }

    const availableTypes = await allTypeNames(process.cwd());

    const type = typeFlag
        ? typeFlag
        : await select({
            message: "Project type:",
            choices: availableTypes.map((t) => ({ value: t, name: t })),
            default: "novel",
        });

    const title = await input({
        message: "Title:",
        default: name,
    });

    const author = await input({
        message: "Author:",
        default: "",
    });

    const language = await select({
        message: "Language:",
        choices: languageChoices,
        default: "en",
    });

    return { title, author, language, type };
}

function serializeConfigFields(fields: Record<string, unknown>): string {
    let result = "";
    for (const [key, value] of Object.entries(fields)) {
        if (Array.isArray(value) && value.length === 0) {
            result += `${key}: []\n`;
        } else if (typeof value === "string") {
            result += `${key}: ${JSON.stringify(value)}\n`;
        } else {
            result += `${key}: ${value}\n`;
        }
    }
    return result;
}

function buildConfigYaml(options: InitOptions, typeDef: ProjectType): string {
    const copyrightLine = options.author
        ? `\u00A9 ${new Date().getFullYear()} ${options.author}`
        : "";

    const extra = typeDef.config_extra ?? {};

    let yaml = `# Project
type: ${options.type}

# Identity
title: ${JSON.stringify(options.title)}
subtitle: ""
`;
    if (extra.identity) yaml += serializeConfigFields(extra.identity);

    yaml += `
# People
author: ${JSON.stringify(options.author)}
`;
    if (extra.people) yaml += serializeConfigFields(extra.people);

    if (extra.academic) {
        yaml += `\n# Academic\n`;
        yaml += serializeConfigFields(extra.academic);
    }

    yaml += `
# Publication
language: ${options.language}
genre: ""
isbn: ""
publisher: ""
`;
    if (extra.publication) yaml += serializeConfigFields(extra.publication);
    yaml += `date: ""

# Build
build_formats:
    - html
theme: default
`;
    if (extra.build) yaml += serializeConfigFields(extra.build);

    yaml += `
# Legal
license: All rights reserved
license_url: ""
copyright: ${JSON.stringify(copyrightLine)}
`;
    return yaml;
}

export function buildReadme(options: InitOptions, typeDef: ProjectType): string {
    const lines: string[] = [
        `# ${options.title}`,
        options.author ? `\nby ${options.author}\n` : "",
        `> ${typeDef.description}`,
        "",
        `A **${options.type}** project powered by [writekit](https://www.npmjs.com/package/writekit).`,
        "",
        "## Getting started",
        "",
        "```bash",
        "wk check          # validate project",
        "wk build html     # preview as web page",
        "wk build all      # build all formats (pdf, epub, html, docx, md)",
        "wk stats          # word count and chapter balance",
        "```",
        "",
        "For the full command reference, configuration, and guide, see [`docs/writekit.md`](docs/writekit.md).",
        "",
        "## Project structure",
        "",
        "| Path | Purpose |",
        "|---|---|",
        "| `config.yaml` | Title, author, language, build settings |",
    ];

    if (typeDef.files.includes("style.yaml"))
        lines.push("| `style.yaml` | Writing rules — POV, tense, tone, text normalization |");
    if (typeDef.files.includes("synopsis.md"))
        lines.push("| `synopsis.md` | Short summary / pitch |");
    if (typeDef.files.includes("timeline.yaml"))
        lines.push("| `timeline.yaml` | Chronological events |");
    if (typeDef.files.includes("thesis.md"))
        lines.push("| `thesis.md` | Central thesis statement |");
    if (typeDef.files.includes("abstract.md"))
        lines.push("| `abstract.md` | Paper abstract |");
    if (typeDef.files.includes("bibliography.yaml"))
        lines.push("| `bibliography.yaml` | Sources and references |");

    lines.push("| `manuscript/` | Your text — chapters, front/back matter |");

    const dirDescriptions: Record<string, string> = {
        outline: "Planning and structure",
        "outline/chapters": "Per-chapter outlines",
        characters: "Character sheets (name, role, backstory)",
        world: "Locations, cultures, systems",
        arguments: "Argument sheets (claim, support, counterpoint)",
        concepts: "Key terms and definitions",
        contributors: "Author/translator/editor bios",
        notes: "Free-form ideas and research",
        reference: "External material",
        assets: "Cover image, illustrations, fonts",
    };

    for (const dir of typeDef.dirs) {
        if (dir === "build" || dir === "manuscript") continue;
        if (dirDescriptions[dir]) {
            lines.push(`| \`${dir}/\` | ${dirDescriptions[dir]} |`);
        }
    }

    lines.push("| `docs/` | writekit guide (auto-generated) |");
    lines.push("| `build/` | Generated output |");

    return lines.join("\n") + "\n";
}

async function writeSampleFiles(
    projectDir: string,
    typeDef: ProjectType,
): Promise<string[]> {
    const created: string[] = [];

    for (const [path, sample] of Object.entries(typeDef.sample_files)) {
        const fullPath = join(projectDir, path);
        await mkdir(dirname(fullPath), { recursive: true });
        let content: string;

        if (sample.frontmatter) {
            content = frontmatter(sample.frontmatter, sample.body);
        } else {
            content = sample.body;
        }

        await writeFile(fullPath, content);
        created.push(path);
    }

    return created;
}

export const initCommand = new Command("init")
    .description("Create a new writing project")
    .argument("<name>", "Project name (directory)")
    .option("-y, --yes", "Skip prompts, use defaults")
    .option("-t, --type <type>", "Project type (novel, collection, essay, paper)")
    .action(async (name: string, opts: { yes?: boolean; type?: string }) => {
        const projectDir = join(process.cwd(), name);
        const options = await promptOptions(name, !!opts.yes, opts.type);
        const typeDef = await loadType(options.type, process.cwd());
        const typeSource = await resolveTypeFile(options.type, process.cwd());

        const { c, icon } = await import("../support/ui.js");
        console.log(`\n${icon.book} ${c.bold("Creating project:")} ${c.cyan(name)} ${c.dim(`(${typeDef.name})`)}\n`);

        // Create directories
        for (const dir of typeDef.dirs) {
            await mkdir(join(projectDir, dir), { recursive: true });
        }

        // config.yaml
        await writeFile(join(projectDir, "config.yaml"), buildConfigYaml(options, typeDef));

        // Sample files from type definition (includes all root files and subdirectory samples)
        const createdFiles = await writeSampleFiles(projectDir, typeDef);

        // Create contributor sheet for author if provided
        if (options.author) {
            const { slugify } = await import("../support/slug.js");
            const contribDir = join(projectDir, "contributors");
            await mkdir(contribDir, { recursive: true });
            const slug = slugify(options.author);
            await writeFile(
                join(contribDir, `${slug}.md`),
                frontmatter(
                    { name: options.author, roles: ["author"] },
                    `# ${options.author}\n\nBiography...\n`,
                ),
            );
        }

        // README.md
        await writeFile(join(projectDir, "README.md"), buildReadme(options, typeDef));

        // .gitignore
        await writeFile(join(projectDir, ".gitignore"), "build/\n");

        // AGENTS.md + docs
        await ensureAgentsMd(projectDir, options.type);
        await generateDocs(projectDir, typeDef);

        // Copy custom local type into the new project so future commands can resolve it.
        if (typeSource?.source === "local") {
            const targetDir = join(projectDir, "types", options.type);
            await mkdir(targetDir, { recursive: true });
            await cp(dirname(typeSource.path), targetDir, { recursive: true, force: true });
        }

        const typePlugin = await loadTypePlugin(options.type, process.cwd());
        if (typePlugin?.onInit) {
            const config = await loadConfig(projectDir);
            await typePlugin.onInit({
                projectDir,
                typeName: options.type,
                typeDef,
                config,
                typeOptions: resolveTypeOptions(config),
            });
        }

        // git init
        let gitOk = false;
        try {
            execSync("git init", { cwd: projectDir, stdio: "ignore" });
            gitOk = true;
        } catch {
            console.log(`  ${icon.warn} ${c.yellow("git init failed (git not installed?)")}\n`);
        }

        // Print tree
        console.log(`  ${c.bold(name + "/")}`);
        console.log(c.gray("  ├── config.yaml"));
        for (const file of typeDef.files) {
            console.log(c.gray(`  ├── ${file}`));
        }
        console.log(c.gray("  ├── .gitignore"));
        for (const dir of typeDef.dirs) {
            const sampleInDir = createdFiles.filter((f) => f.startsWith(dir + "/") || f.startsWith(dir + "\\"));
            if (sampleInDir.length > 0) {
                console.log(c.gray(`  ├── ${dir}/`));
                for (const f of sampleInDir) {
                    const fileName = f.split("/").pop() || f.split("\\").pop();
                    console.log(c.gray(`  │   └── ${fileName}`));
                }
            } else {
                console.log(c.gray(`  ├── ${dir}/`));
            }
        }
        console.log(c.gray("  ├── docs/"));
        console.log(c.gray("  │   └── writekit.md"));
        console.log(c.gray("  ├── AGENTS.md"));
        console.log(c.gray("  └── README.md"));

        if (gitOk) console.log(`\n  ${icon.git} ${c.dim("git repository initialized")}`);
        console.log(`\n${icon.done} ${c.green("Done!")} Start writing with:\n`);
        console.log(`  ${c.cyan(`cd ${name}`)}`);
        console.log(`  ${c.cyan("wk build html")}\n`);
    });
