import { Command } from "commander";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { execSync } from "node:child_process";
import { stringify } from "yaml";
import { input, select } from "@inquirer/prompts";
import { frontmatter } from "../lib/fs-utils.js";
import { loadType, allTypeNames, type ProjectType, type TypeName } from "../lib/project-type.js";

interface InitOptions {
    title: string;
    author: string;
    language: string;
    type: TypeName;
}

async function promptOptions(name: string, skip: boolean, typeFlag?: string): Promise<InitOptions> {
    if (skip) {
        return {
            title: name,
            author: "",
            language: "it",
            type: (typeFlag as TypeName) || "novel",
        };
    }

    const type = typeFlag
        ? (typeFlag as TypeName)
        : await select({
            message: "Project type:",
            choices: allTypeNames().map((t) => ({ value: t, name: t })),
            default: "novel",
        }) as TypeName;

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
        choices: [
            { value: "it", name: "Italiano" },
            { value: "en", name: "English" },
            { value: "es", name: "Español" },
            { value: "fr", name: "Français" },
            { value: "de", name: "Deutsch" },
            { value: "pt", name: "Português" },
        ],
        default: "it",
    });

    return { title, author, language, type };
}

function buildConfigYaml(options: InitOptions): string {
    const copyrightLine = options.author
        ? `\u00A9 ${new Date().getFullYear()} ${options.author}`
        : "";

    return `# Project
type: ${options.type}

# Identity
title: ${JSON.stringify(options.title)}
subtitle: ""
${options.type === "novel" ? 'series: ""\nvolume: 1\n' : ""}
# People
author: ${JSON.stringify(options.author)}
${options.type === "novel" ? 'translator: ""\neditor: ""\nillustrator: ""\n' : ""}
# Publication
language: ${options.language}
genre: ""
${options.type === "paper" ? 'doi: ""\n' : ""}isbn: ""
publisher: ""
edition: 1
date: ""

# Build
build_formats:
    - html
theme: default

# Legal
license: All rights reserved
license_url: ""
copyright: ${JSON.stringify(copyrightLine)}
`;
}

function buildReadme(options: InitOptions, typeDef: ProjectType): string {
    const lines: string[] = [
        `# ${options.title}`,
        options.author ? `\nby ${options.author}\n` : "",
        `A ${options.type} project powered by [writekit](https://github.com/stefanocaronia/writekit).`,
        "",
        "## Project Structure",
        "",
        "| Path | Purpose |",
        "|---|---|",
        "| `config.yaml` | Project metadata |",
    ];

    if (typeDef.files.includes("style.yaml"))
        lines.push("| `style.yaml` | Writing rules — POV, tense, tone |");
    if (typeDef.files.includes("timeline.yaml"))
        lines.push("| `timeline.yaml` | Chronological events |");
    if (typeDef.files.includes("synopsis.md"))
        lines.push("| `synopsis.md` | Short summary / pitch |");
    if (typeDef.files.includes("bibliography.yaml"))
        lines.push("| `bibliography.yaml` | Sources and references |");

    for (const dir of typeDef.dirs) {
        if (dir === "build") continue;
        const purposes: Record<string, string> = {
            outline: "Story/argument structure",
            "outline/chapters": "Per-chapter outlines",
            manuscript: "The actual text",
            characters: "Character sheets",
            world: "Worldbuilding — locations, systems",
            notes: "Free-form ideas and research",
            reference: "External material",
            assets: "Cover, illustrations",
        };
        if (purposes[dir]) {
            lines.push(`| \`${dir}/\` | ${purposes[dir]} |`);
        }
    }

    lines.push("| `build/` | Generated output |");
    lines.push("");
    lines.push("## Commands");
    lines.push("");
    lines.push("```bash");
    lines.push("wk check              # Validate project");
    lines.push("wk build [format]     # Build (pdf, epub, html, docx, all)");
    lines.push("wk watch [format]     # Watch and rebuild on changes");

    for (const cmd of typeDef.add_commands) {
        const argName = cmd === "event" ? "<desc>" : `<${cmd === "chapter" ? "title" : "name"}>`;
        lines.push(`wk add ${cmd} ${argName}`);
    }

    lines.push("```");

    return lines.join("\n") + "\n";
}

async function writeSampleFiles(
    projectDir: string,
    typeDef: ProjectType,
): Promise<string[]> {
    const created: string[] = [];

    for (const [path, sample] of Object.entries(typeDef.sample_files)) {
        const fullPath = join(projectDir, path);
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
    .option("-t, --type <type>", "Project type (novel, collection, essay, paper, article)")
    .action(async (name: string, opts: { yes?: boolean; type?: string }) => {
        const projectDir = join(process.cwd(), name);
        const options = await promptOptions(name, !!opts.yes, opts.type);
        const typeDef = await loadType(options.type);

        const { c, icon } = await import("../lib/ui.js");
        console.log(`\n${icon.book} ${c.bold("Creating project:")} ${c.cyan(name)} ${c.dim(`(${typeDef.name})`)}\n`);

        // Create directories
        for (const dir of typeDef.dirs) {
            await mkdir(join(projectDir, dir), { recursive: true });
        }

        // config.yaml
        await writeFile(join(projectDir, "config.yaml"), buildConfigYaml(options));

        // Type-specific YAML files
        if (typeDef.files.includes("style.yaml")) {
            await writeFile(
                join(projectDir, "style.yaml"),
                stringify({
                    pov: "third-person",
                    tense: "past",
                    tone: "",
                    voice: "",
                    rules: [],
                }),
            );
        }

        if (typeDef.files.includes("timeline.yaml")) {
            await writeFile(
                join(projectDir, "timeline.yaml"),
                stringify({
                    events: [{ date: "", description: "Example event", chapter: "" }],
                }),
            );
        }

        if (typeDef.files.includes("synopsis.md")) {
            await writeFile(
                join(projectDir, "synopsis.md"),
                `# ${options.title}\n\nWrite your synopsis here...\n`,
            );
        }

        if (typeDef.files.includes("bibliography.yaml")) {
            await writeFile(
                join(projectDir, "bibliography.yaml"),
                stringify({
                    sources: [{ author: "", title: "", year: "", url: "" }],
                }),
            );
        }

        // Novel-specific: plot.md with acts
        if (options.type === "novel") {
            await writeFile(
                join(projectDir, "outline", "plot.md"),
                frontmatter(
                    {
                        acts: [
                            { name: "Act 1", summary: "" },
                            { name: "Act 2", summary: "" },
                            { name: "Act 3", summary: "" },
                        ],
                    },
                    "# Plot\n\nDescribe the overall story arc here...\n",
                ),
            );
        }

        // Sample files from type definition
        const createdFiles = await writeSampleFiles(projectDir, typeDef);

        // README.md
        await writeFile(join(projectDir, "README.md"), buildReadme(options, typeDef));

        // .gitignore
        await writeFile(join(projectDir, ".gitignore"), "build/\n");

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
        console.log(c.gray("  └── README.md"));

        if (gitOk) console.log(`\n  ${icon.git} ${c.dim("git repository initialized")}`);
        console.log(`\n${icon.done} ${c.green("Done!")} Start writing with:\n`);
        console.log(`  ${c.cyan(`cd ${name}`)}`);
        console.log(`  ${c.cyan("wk build html")}\n`);
    });
