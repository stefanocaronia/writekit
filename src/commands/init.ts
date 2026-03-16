import { Command } from "commander";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { execSync } from "node:child_process";
import { stringify } from "yaml";
import { input, select } from "@inquirer/prompts";

const DIRS = [
    "outline",
    "outline/chapters",
    "manuscript",
    "characters",
    "world",
    "notes",
    "reference",
    "assets",
    "build",
];

import { frontmatter } from "../lib/fs-utils.js";

interface InitOptions {
    title: string;
    author: string;
    language: string;
}

async function promptOptions(name: string, skip: boolean): Promise<InitOptions> {
    if (skip) {
        return { title: name, author: "", language: "it" };
    }

    const title = await input({
        message: "Book title:",
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

    return { title, author, language };
}

export const initCommand = new Command("init")
    .description("Create a new writing project")
    .argument("<name>", "Project name (directory)")
    .option("-y, --yes", "Skip prompts, use defaults")
    .action(async (name: string, opts: { yes?: boolean }) => {
        const projectDir = join(process.cwd(), name);
        const options = await promptOptions(name, !!opts.yes);

        const { c, icon } = await import("../lib/ui.js");
        console.log(`\n${icon.book} ${c.bold("Creating project:")} ${c.cyan(name)}\n`);

        // Create directory structure
        for (const dir of DIRS) {
            await mkdir(join(projectDir, dir), { recursive: true });
        }

        // --- YAML config files ---

        const copyrightLine = options.author
            ? `\u00A9 ${new Date().getFullYear()} ${options.author}`
            : "";

        await writeFile(
            join(projectDir, "config.yaml"),
            `# Identity
title: ${JSON.stringify(options.title)}
subtitle: ""
series: ""
volume: 1

# People
author: ${JSON.stringify(options.author)}
translator: ""
editor: ""
illustrator: ""

# Publication
language: ${options.language}
genre: ""
isbn: ""
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
`,
        );

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

        await writeFile(
            join(projectDir, "timeline.yaml"),
            stringify({
                events: [
                    {
                        date: "",
                        description: "Example event",
                        chapter: "",
                    },
                ],
            }),
        );

        // --- Markdown files ---

        await writeFile(
            join(projectDir, "synopsis.md"),
            `# ${options.title}\n\nWrite your synopsis here...\n`,
        );

        // outline/plot.md
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
                `# Plot\n\nDescribe the overall story arc here...\n`,
            ),
        );

        // outline/chapters/01.md
        await writeFile(
            join(projectDir, "outline", "chapters", "01.md"),
            frontmatter(
                {
                    chapter: 1,
                    title: "Capitolo Primo",
                    pov: "",
                    characters: [],
                    location: "",
                },
                `# Chapter 1 — Outline\n\nWhat happens in this chapter...\n`,
            ),
        );

        // manuscript/01-capitolo-primo.md
        await writeFile(
            join(projectDir, "manuscript", "01-capitolo-primo.md"),
            frontmatter(
                {
                    chapter: 1,
                    title: "Capitolo Primo",
                    pov: "",
                    draft: 1,
                },
                `# Capitolo Primo\n\nScrivi qui il tuo testo...\n`,
            ),
        );

        // characters/example.md
        await writeFile(
            join(projectDir, "characters", "protagonist.md"),
            frontmatter(
                {
                    name: "",
                    role: "protagonist",
                    age: "",
                    relationships: [],
                },
                `# Character Name\n\n## Appearance\n\n## Personality\n\n## Backstory\n\n## Arc\n\n## Notes\n`,
            ),
        );

        // world/example.md
        await writeFile(
            join(projectDir, "world", "example-location.md"),
            frontmatter(
                {
                    name: "",
                    type: "location",
                },
                `# Location Name\n\n## Description\n\n## Details\n\n## Notes\n`,
            ),
        );

        // notes/ideas.md
        await writeFile(
            join(projectDir, "notes", "ideas.md"),
            `# Ideas\n\nFree-form notes, ideas, research...\n`,
        );

        // README.md
        await writeFile(
            join(projectDir, "README.md"),
            `# ${options.title}
${options.author ? `\nby ${options.author}\n` : ""}
A novel project powered by [writekit](https://github.com/stefanocaronia/writekit).

## Project Structure

| Path | Format | Purpose |
|---|---|---|
| \`config.yaml\` | YAML | Book metadata — title, author, language, genre |
| \`style.yaml\` | YAML | Writing rules — POV, tense, tone, voice |
| \`timeline.yaml\` | YAML | Chronological events |
| \`synopsis.md\` | Markdown | Short book summary / pitch |
| \`outline/plot.md\` | MD + frontmatter | Overall story arc and acts |
| \`outline/chapters/\` | MD + frontmatter | Per-chapter outline (one file each) |
| \`manuscript/\` | MD + frontmatter | The actual book text (one file per chapter) |
| \`characters/\` | MD + frontmatter | Character sheets (one file per character) |
| \`world/\` | MD + frontmatter | Worldbuilding — locations, systems, cultures |
| \`notes/\` | Free markdown | Ideas, research, background — no fixed schema |
| \`reference/\` | Any | External material — images, PDFs, source texts |
| \`assets/\` | Any | Book assets — cover, illustrations |
| \`build/\` | Generated | Output files (PDF, ePub, HTML, DOCX) |

## Commands

\`\`\`bash
wk init <name>        # Create a new project
wk add chapter <title> # Add a chapter
wk add character <name> # Add a character sheet
wk add location <name>  # Add a worldbuilding entry
wk add note <title>     # Add a note
wk add event <desc>     # Add a timeline event
wk check              # Validate project structure
wk build [format]     # Build the book (pdf, epub, html, docx, all)
wk watch [format]     # Watch and rebuild on changes
\`\`\`

## Workflow

1. \`wk init my-book\` — scaffold the project
2. Fill in \`config.yaml\`, \`style.yaml\`, \`synopsis.md\`
3. Plan your story in \`outline/\`
4. Create characters in \`characters/\` and world in \`world/\`
5. Write chapters in \`manuscript/\`
6. Run \`wk check\` to validate
7. Run \`wk build\` to generate output
`,
        );

        // .gitignore
        await writeFile(
            join(projectDir, ".gitignore"),
            `build/\n`,
        );

        // git init
        let gitOk = false;
        try {
            execSync("git init", { cwd: projectDir, stdio: "ignore" });
            gitOk = true;
        } catch {
            console.log(`  ${icon.warn} ${c.yellow("git init failed (git not installed?)")}\n`);
        }

        // Print created structure
        console.log(`  ${c.bold(name + "/")}`);
        console.log(c.gray(`  ├── config.yaml`));
        console.log(c.gray(`  ├── style.yaml`));
        console.log(c.gray(`  ├── timeline.yaml`));
        console.log(c.gray(`  ├── synopsis.md`));
        console.log(c.gray(`  ├── .gitignore`));
        console.log(c.gray(`  ├── outline/`));
        console.log(c.gray(`  │   ├── plot.md`));
        console.log(c.gray(`  │   └── chapters/01.md`));
        console.log(c.gray(`  ├── manuscript/`));
        console.log(c.gray(`  │   └── 01-capitolo-primo.md`));
        console.log(c.gray(`  ├── characters/`));
        console.log(c.gray(`  │   └── protagonist.md`));
        console.log(c.gray(`  ├── world/`));
        console.log(c.gray(`  │   └── example-location.md`));
        console.log(c.gray(`  ├── notes/`));
        console.log(c.gray(`  │   └── ideas.md`));
        console.log(c.gray(`  ├── reference/`));
        console.log(c.gray(`  ├── assets/`));
        console.log(c.gray(`  ├── build/`));
        console.log(c.gray(`  └── README.md`));
        if (gitOk) console.log(`\n  ${icon.git} ${c.dim("git repository initialized")}`);
        console.log(`\n${icon.done} ${c.green("Done!")} Start writing with:\n`);
        console.log(`  ${c.cyan(`cd ${name}`)}`);
        console.log(`  ${c.cyan("wk build html")}\n`);
    });
