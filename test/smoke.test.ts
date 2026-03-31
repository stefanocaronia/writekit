import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { execSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

const ROOT = process.cwd();
const CLI = `node ${join(ROOT, "dist", "cli.js")}`;
const SANDBOX = join(ROOT, "sandbox");
const TEST_DIR = join(SANDBOX, "test-smoke");

function run(cmd: string, cwd?: string): string {
    return execSync(cmd, {
        cwd: cwd ?? process.cwd(),
        encoding: "utf-8",
        timeout: 30_000,
    });
}

function writeFiles(baseDir: string, files: Record<string, string>): void {
    for (const [relativePath, content] of Object.entries(files)) {
        const fullPath = join(baseDir, relativePath);
        mkdirSync(dirname(fullPath), { recursive: true });
        writeFileSync(fullPath, content, "utf-8");
    }
}

describe("writekit smoke tests", () => {
    beforeAll(() => {
        rmSync(TEST_DIR, { recursive: true, force: true });
        mkdirSync(SANDBOX, { recursive: true });
    });

    afterAll(() => {
        rmSync(TEST_DIR, { recursive: true, force: true });
    });

    it("shows help", { timeout: 15_000 }, () => {
        const out = run(`${CLI} --help`);
        expect(out).toContain("CLI toolkit for writing");
        expect(out).toContain("init");
        expect(out).toContain("build");
        expect(out).toContain("check");
        expect(out).toContain("watch");
        expect(out).toContain("add");
        expect(out).toContain("theme");
    });

    it("shows version", () => {
        const out = run(`${CLI} --version`);
        expect(out.trim()).toMatch(/^\d+\.\d+\.\d+$/);
    });

    it("init creates a project", () => {
        run(`${CLI} init test-smoke --yes`, SANDBOX);
        expect(existsSync(join(TEST_DIR, "config.yaml"))).toBe(true);
        expect(existsSync(join(TEST_DIR, "style.yaml"))).toBe(true);
        expect(existsSync(join(TEST_DIR, "timeline.yaml"))).toBe(true);
        expect(existsSync(join(TEST_DIR, "synopsis.md"))).toBe(true);
        expect(existsSync(join(TEST_DIR, "manuscript"))).toBe(true);
        expect(existsSync(join(TEST_DIR, "characters"))).toBe(true);
        expect(existsSync(join(TEST_DIR, "world"))).toBe(true);
        expect(existsSync(join(TEST_DIR, "outline"))).toBe(true);
        expect(existsSync(join(TEST_DIR, "notes"))).toBe(true);
        expect(existsSync(join(TEST_DIR, "reference"))).toBe(true);
        expect(existsSync(join(TEST_DIR, "assets"))).toBe(true);
        expect(existsSync(join(TEST_DIR, "build"))).toBe(true);
        expect(existsSync(join(TEST_DIR, ".gitignore"))).toBe(true);
        expect(existsSync(join(TEST_DIR, "README.md"))).toBe(true);
        expect(existsSync(join(TEST_DIR, "AGENTS.md"))).toBe(true);
        const agents = readFileSync(join(TEST_DIR, "AGENTS.md"), "utf-8");
        expect(agents).toContain("writekit:start");
        const instructions = readFileSync(join(ROOT, "dist", "agents", "instructions.md"), "utf-8");
        expect(instructions).toContain("Recommended workflow after `wk init`");
        expect(instructions).toContain("Back cover");
        const config = readFileSync(join(TEST_DIR, "config.yaml"), "utf-8");
        expect(config).not.toContain("print_preset:");
        expect(config).toContain('cover: ""');
    });

    it("check passes on fresh project", () => {
        const out = run(`${CLI} check`, TEST_DIR);
        expect(out).toContain("All good");
    });

    it("add chapter works", () => {
        run(`${CLI} add chapter "La Tempesta"`, TEST_DIR);
        expect(existsSync(join(TEST_DIR, "manuscript", "02-la-tempesta.md"))).toBe(true);
        expect(existsSync(join(TEST_DIR, "outline", "chapters", "02.md"))).toBe(true);
    });

    it("add character works", () => {
        run(`${CLI} add character "Marco Polo"`, TEST_DIR);
        expect(existsSync(join(TEST_DIR, "characters", "marco-polo.md"))).toBe(true);
    });

    it("add location works", () => {
        run(`${CLI} add location "Piazza San Marco"`, TEST_DIR);
        expect(existsSync(join(TEST_DIR, "world", "piazza-san-marco.md"))).toBe(true);
    });

    it("add note works", () => {
        run(`${CLI} add note "Research"`, TEST_DIR);
        expect(existsSync(join(TEST_DIR, "notes", "research.md"))).toBe(true);
    });

    it("add event works", () => {
        run(`${CLI} add event "Marco arrives" --date "day 1" --chapter 1`, TEST_DIR);
        const timeline = readFileSync(join(TEST_DIR, "timeline.yaml"), "utf-8");
        expect(timeline).toContain("Marco arrives");
    });

    it("add part works", () => {
        run(`${CLI} add part "Test Part"`, TEST_DIR);
        expect(existsSync(join(TEST_DIR, "manuscript", "part-01"))).toBe(true);
        expect(existsSync(join(TEST_DIR, "manuscript", "part-01", "part.yaml"))).toBe(true);
    });

    it("add chapter --part works", () => {
        run(`${CLI} add chapter "Part Chapter" --part 1`, TEST_DIR);
        expect(existsSync(join(TEST_DIR, "manuscript", "part-01", "01-part-chapter.md"))).toBe(true);
    });

    it("add prologue works", () => {
        run(`${CLI} add prologue`, TEST_DIR);
        expect(existsSync(join(TEST_DIR, "manuscript", "prologue.md"))).toBe(true);
    });

    it("add epilogue works", () => {
        run(`${CLI} add epilogue`, TEST_DIR);
        expect(existsSync(join(TEST_DIR, "manuscript", "epilogue.md"))).toBe(true);
    });

    it("add dedication works", () => {
        run(`${CLI} add dedication`, TEST_DIR);
        expect(existsSync(join(TEST_DIR, "manuscript", "dedication.md"))).toBe(true);
    });

    it("build html works", () => {
        run(`${CLI} build html`, TEST_DIR);
        const buildDir = join(TEST_DIR, "build");
        const files = existsSync(buildDir);
        expect(files).toBe(true);
        // Check that an html file was generated
        const htmlFiles = readdirSync(buildDir)
            .filter((f: string) => f.endsWith(".html"));
        expect(htmlFiles.length).toBeGreaterThan(0);
    });

    it("build generates reports", () => {
        expect(existsSync(join(TEST_DIR, "build", "reports", "status.md"))).toBe(true);
        expect(existsSync(join(TEST_DIR, "build", "reports", "cast.md"))).toBe(true);
        expect(existsSync(join(TEST_DIR, "build", "reports", "relationships.md"))).toBe(true);
        expect(existsSync(join(TEST_DIR, "build", "reports", "locations.md"))).toBe(true);
        expect(existsSync(join(TEST_DIR, "build", "reports", "timeline.md"))).toBe(true);
        expect(existsSync(join(TEST_DIR, "build", "reports", "changelog.md"))).toBe(true);
    });

    it("changelog tracks differences between builds", () => {
        writeFileSync(join(TEST_DIR, "manuscript", "02-la-tempesta.md"), `---
chapter: 2
title: La Tempesta
draft: 2
---

# La Tempesta

The storm is louder now.
`, "utf-8");

        run(`${CLI} build html`, TEST_DIR);
        const changelog = readFileSync(join(TEST_DIR, "build", "reports", "changelog.md"), "utf-8");
        expect(changelog).toContain("## Updated chapters");
        expect(changelog).toContain("02-la-tempesta.md");
        expect(changelog).toContain("draft:");
    });

    it("build epub works", () => {
        run(`${CLI} build epub`, TEST_DIR);
        const buildDir = join(TEST_DIR, "build");
        const epubFiles = readdirSync(buildDir)
            .filter((f: string) => f.endsWith(".epub"));
        expect(epubFiles.length).toBeGreaterThan(0);
    });

    it("build docx works", () => {
        run(`${CLI} build docx`, TEST_DIR);
        const buildDir = join(TEST_DIR, "build");
        const docxFiles = readdirSync(buildDir)
            .filter((f: string) => f.endsWith(".docx"));
        expect(docxFiles.length).toBeGreaterThan(0);
    });

    it("build supports a local custom format plugin", () => {
        mkdirSync(join(TEST_DIR, "formats"), { recursive: true });
        writeFileSync(join(TEST_DIR, "formats", "plaintext.mjs"), `export default {
  name: "plaintext",
  extension: "txt",
  async build(ctx) {
    return "# " + ctx.config.title + "\\n" + ctx.chapters.map((ch) => ch.title).join("\\n");
  }
};
`, "utf-8");

        run(`${CLI} build plaintext`, TEST_DIR);
        const txtFiles = readdirSync(join(TEST_DIR, "build"))
            .filter((f: string) => f.endsWith(".txt"));
        expect(txtFiles.length).toBeGreaterThan(0);
    });

    it("add author works and creates contributor sheet", () => {
        run(`${CLI} add author "Lucia Bianchi"`, TEST_DIR);
        const config = readFileSync(join(TEST_DIR, "config.yaml"), "utf-8");
        expect(config).toContain("Lucia Bianchi");
        expect(existsSync(join(TEST_DIR, "contributors", "lucia-bianchi.md"))).toBe(true);
        const sheet = readFileSync(join(TEST_DIR, "contributors", "lucia-bianchi.md"), "utf-8");
        expect(sheet).toContain("name: Lucia Bianchi");
    });

    it("remove author works", () => {
        run(`${CLI} remove author "Lucia Bianchi"`, TEST_DIR);
        const config = readFileSync(join(TEST_DIR, "config.yaml"), "utf-8");
        expect(config).not.toContain("Lucia Bianchi");
    });

    it("remove character works", () => {
        expect(existsSync(join(TEST_DIR, "characters", "marco-polo.md"))).toBe(true);
        run(`${CLI} remove character "Marco Polo"`, TEST_DIR);
        expect(existsSync(join(TEST_DIR, "characters", "marco-polo.md"))).toBe(false);
    });

    it("remove chapter works and renumbers", () => {
        // We have chapters 01 and 02. Remove 01, 02 becomes 01.
        run(`${CLI} remove chapter 1`, TEST_DIR);
        expect(existsSync(join(TEST_DIR, "manuscript", "01-capitolo-primo.md"))).toBe(false);
        // The former 02-la-tempesta.md should now be 01-la-tempesta.md
        expect(existsSync(join(TEST_DIR, "manuscript", "01-la-tempesta.md"))).toBe(true);
    });

    it("remove prologue works", () => {
        expect(existsSync(join(TEST_DIR, "manuscript", "prologue.md"))).toBe(true);
        run(`${CLI} remove prologue`, TEST_DIR);
        expect(existsSync(join(TEST_DIR, "manuscript", "prologue.md"))).toBe(false);
    });

    it("remove part moves chapters to manuscript root", () => {
        // part-01 has 01-part-chapter.md; remove part 1 moves it to manuscript root
        expect(existsSync(join(TEST_DIR, "manuscript", "part-01"))).toBe(true);
        run(`${CLI} remove part 1`, TEST_DIR);
        expect(existsSync(join(TEST_DIR, "manuscript", "part-01"))).toBe(false);
        // The chapter should now be in manuscript root (renumbered after existing 01-la-tempesta.md)
        expect(existsSync(join(TEST_DIR, "manuscript", "02-part-chapter.md"))).toBe(true);
    });

    it("theme list works", () => {
        const out = run(`${CLI} theme list`, TEST_DIR);
        expect(out.toLowerCase()).toContain("default");
    });

    it("stats works", () => {
        const out = run(`${CLI} stats`, TEST_DIR);
        expect(out).toContain("Chapters");
        expect(out).toContain("Total words");
    });

    it("build clean works", () => {
        run(`${CLI} build clean`, TEST_DIR);
        const buildDir = join(TEST_DIR, "build");
        const remaining = readdirSync(buildDir);
        expect(remaining.length).toBe(0);
    });
});

// ---------------------------------------------------------------------------
// Project types
// ---------------------------------------------------------------------------

const TYPES_TO_TEST = ["essay", "paper", "collection"] as const;

interface TypeExpectation {
    dirs: string[];
    missingDirs: string[];
    files: string[];
    missingFiles: string[];
    hasCharacterAdd: boolean;
}

const TYPE_EXPECTATIONS: Record<string, TypeExpectation> = {
    essay: {
        dirs: ["outline", "manuscript", "notes", "reference", "assets", "build"],
        missingDirs: ["characters", "world", "outline/chapters"],
        files: ["config.yaml", "style.yaml", "synopsis.md", ".gitignore", "README.md", "AGENTS.md"],
        missingFiles: ["timeline.yaml", "bibliography.yaml"],
        hasCharacterAdd: false,
    },
    paper: {
        dirs: ["outline", "manuscript", "notes", "reference", "assets", "build"],
        missingDirs: ["characters", "world", "outline/chapters"],
        files: ["config.yaml", "style.yaml", "synopsis.md", "bibliography.yaml", ".gitignore", "README.md", "AGENTS.md"],
        missingFiles: ["timeline.yaml"],
        hasCharacterAdd: false,
    },
    collection: {
        dirs: ["outline", "manuscript", "notes", "reference", "assets", "build"],
        missingDirs: ["characters", "world", "outline/chapters"],
        files: ["config.yaml", "style.yaml", "synopsis.md", ".gitignore", "README.md", "AGENTS.md"],
        missingFiles: ["timeline.yaml", "bibliography.yaml"],
        hasCharacterAdd: false,
    },
};

describe("project types", () => {
    for (const typeName of TYPES_TO_TEST) {
        describe(typeName, () => {
            const TYPE_DIR = join(ROOT, "sandbox", `test-${typeName}`);
            const expected = TYPE_EXPECTATIONS[typeName];

            beforeAll(() => {
                rmSync(TYPE_DIR, { recursive: true, force: true });
                mkdirSync(join(ROOT, "sandbox"), { recursive: true });
                run(`${CLI} init test-${typeName} --yes --type ${typeName}`, join(ROOT, "sandbox"));
            });

            afterAll(() => {
                rmSync(TYPE_DIR, { recursive: true, force: true });
            });

            it("init creates the right directories", () => {
                for (const dir of expected.dirs) {
                    expect(existsSync(join(TYPE_DIR, dir)), `expected dir: ${dir}`).toBe(true);
                }
                for (const dir of expected.missingDirs) {
                    expect(existsSync(join(TYPE_DIR, dir)), `should not exist: ${dir}`).toBe(false);
                }
            });

            it("init creates the right files", () => {
                for (const file of expected.files) {
                    expect(existsSync(join(TYPE_DIR, file)), `expected file: ${file}`).toBe(true);
                }
                for (const file of expected.missingFiles) {
                    expect(existsSync(join(TYPE_DIR, file)), `should not exist: ${file}`).toBe(false);
                }
            });

            it("config.yaml has the correct type", () => {
                const config = readFileSync(join(TYPE_DIR, "config.yaml"), "utf-8");
                expect(config).toContain(`type: ${typeName}`);
                expect(config).not.toContain("print_preset:");
            });

            it("check passes on fresh project (no errors)", () => {
                // run() throws on non-zero exit; check exits 1 only for errors
                const out = run(`${CLI} check`, TYPE_DIR);
                expect(out).toContain("Checking project");
            });

            it("add chapter works", () => {
                run(`${CLI} add chapter "Test Chapter"`, TYPE_DIR);
                expect(existsSync(join(TYPE_DIR, "manuscript", "02-test-chapter.md"))).toBe(true);
            });

            it("add character fails for non-novel type", () => {
                expect(() => {
                    run(`${CLI} add character "Test Char"`, TYPE_DIR);
                }).toThrow();
            });

            it("build html works", () => {
                run(`${CLI} build html`, TYPE_DIR);
                const buildDir = join(TYPE_DIR, "build");
                expect(existsSync(buildDir)).toBe(true);
                const htmlFiles = readdirSync(buildDir)
                    .filter((f: string) => f.endsWith(".html"));
                expect(htmlFiles.length).toBeGreaterThan(0);
            });
        });
    }

    // Verify that 'add character' DOES work for novel (the default type)
    describe("novel (character add)", () => {
        const NOVEL_DIR = join(ROOT, "sandbox", "test-novel-type");

        beforeAll(() => {
            rmSync(NOVEL_DIR, { recursive: true, force: true });
            mkdirSync(join(ROOT, "sandbox"), { recursive: true });
            run(`${CLI} init test-novel-type --yes --type novel`, join(ROOT, "sandbox"));
        });

        afterAll(() => {
            rmSync(NOVEL_DIR, { recursive: true, force: true });
        });

        it("add character works for novel type", () => {
            run(`${CLI} add character "Test Hero"`, NOVEL_DIR);
            expect(existsSync(join(NOVEL_DIR, "characters", "test-hero.md"))).toBe(true);
        });
    });

    // Verify prologue/epilogue blocked for essay
    describe("essay (prologue/epilogue blocked)", () => {
        const ESSAY_DIR = join(ROOT, "sandbox", "test-essay-sections");

        beforeAll(() => {
            rmSync(ESSAY_DIR, { recursive: true, force: true });
            mkdirSync(join(ROOT, "sandbox"), { recursive: true });
            run(`${CLI} init test-essay-sections --yes --type essay`, join(ROOT, "sandbox"));
        });

        afterAll(() => {
            rmSync(ESSAY_DIR, { recursive: true, force: true });
        });

        it("add prologue fails for essay type", () => {
            expect(() => {
                run(`${CLI} add prologue`, ESSAY_DIR);
            }).toThrow();
        });
    });

    // Verify part blocked for paper
    describe("paper (part blocked)", () => {
        const PAPER_DIR = join(ROOT, "sandbox", "test-paper-parts");

        beforeAll(() => {
            rmSync(PAPER_DIR, { recursive: true, force: true });
            mkdirSync(join(ROOT, "sandbox"), { recursive: true });
            run(`${CLI} init test-paper-parts --yes --type paper`, join(ROOT, "sandbox"));
        });

        afterAll(() => {
            rmSync(PAPER_DIR, { recursive: true, force: true });
        });

        it("add part fails for paper type", () => {
            expect(() => {
                run(`${CLI} add part "Test"`, PAPER_DIR);
            }).toThrow();
        });
    });

    describe("local custom type", () => {
        const WORKSPACE_DIR = join(ROOT, "sandbox", "custom-type-workspace");
        const CUSTOM_DIR = join(WORKSPACE_DIR, "microbook");

        beforeAll(() => {
            rmSync(WORKSPACE_DIR, { recursive: true, force: true });
            mkdirSync(join(WORKSPACE_DIR, "types", "microbook"), { recursive: true });
            writeFileSync(join(WORKSPACE_DIR, "types", "microbook", "type.yaml"), `name: Microbook
description: Small custom local type
default_preset: screen
sections:
    - title_page
    - content
features:
    supports_parts: false
dirs:
    - manuscript
    - notes
    - assets
    - build
files:
    - style.yaml
    - synopsis.md
add_commands:
    - chapter
    - note
reports:
    - status
schemas:
    manuscript:
        required: [title]
        optional: [chapter, draft]
sample_files:
    style.yaml:
        body: "pov: third-person\\ntense: past\\ntone: \\\"\\\"\\nvoice: \\\"\\\"\\nrules: []\\n"
    synopsis.md:
        body: "# Synopsis\\n\\nWrite your synopsis here...\\n"
    manuscript/01-opening.md:
        frontmatter:
            chapter: 1
            title: "Opening"
            draft: 1
        body: "# Opening\\n\\nStart here...\\n"
    notes/ideas.md:
        body: "# Ideas\\n\\nNotes...\\n"
`, "utf-8");
            writeFileSync(join(WORKSPACE_DIR, "types", "microbook", "index.mjs"), `export default {
  async onInit(ctx) {
    const { writeFile } = await import("node:fs/promises");
    const { join } = await import("node:path");
    await writeFile(join(ctx.projectDir, "notes", "plugin-created.md"), "# Plugin\\n\\nLocal type hook.\\n");
  }
};
`, "utf-8");
            run(`${CLI} init microbook --yes --type microbook`, WORKSPACE_DIR);
        });

        afterAll(() => {
            rmSync(WORKSPACE_DIR, { recursive: true, force: true });
        });

        it("copies the local type into the project", () => {
            expect(existsSync(join(CUSTOM_DIR, "types", "microbook", "type.yaml"))).toBe(true);
            expect(existsSync(join(CUSTOM_DIR, "types", "microbook", "index.mjs"))).toBe(true);
            expect(existsSync(join(CUSTOM_DIR, "notes", "plugin-created.md"))).toBe(true);
            const config = readFileSync(join(CUSTOM_DIR, "config.yaml"), "utf-8");
            expect(config).toContain("type: microbook");
        });

        it("check and build work for the local type", () => {
            const checkOut = run(`${CLI} check`, CUSTOM_DIR);
            expect(checkOut).toContain("All good");
            run(`${CLI} build html`, CUSTOM_DIR);
            const htmlFiles = readdirSync(join(CUSTOM_DIR, "build")).filter((f) => f.endsWith(".html"));
            expect(htmlFiles.length).toBeGreaterThan(0);
        });
    });

    describe("external package plugins", () => {
        const EXTERNAL_WORKSPACE_DIR = join(ROOT, "sandbox", "external-plugin-workspace");
        const EXTERNAL_TYPE_DIR = join(EXTERNAL_WORKSPACE_DIR, "package-type-book");
        const PLUGINS_NODE_MODULES = join(EXTERNAL_WORKSPACE_DIR, "node_modules");

        beforeAll(() => {
            rmSync(EXTERNAL_WORKSPACE_DIR, { recursive: true, force: true });

            writeFiles(join(PLUGINS_NODE_MODULES, "writekit-type-atlas"), {
                "package.json": JSON.stringify({
                    name: "writekit-type-atlas",
                    version: "1.0.0",
                    type: "module",
                    exports: "./src/plugin.js",
                    writekit: {
                        type: {
                            definition: "./defs/type.yaml",
                            entry: "./src/plugin.js",
                        },
                    },
                }, null, 2),
                "src/plugin.js": `export default {
  configSchema: {
    atlas_mode: {
      type: "string",
      values: ["strict", "loose"]
    }
  },
  async onInit(ctx) {
    const { writeFile } = await import("node:fs/promises");
    const { join } = await import("node:path");
    await writeFile(join(ctx.projectDir, "notes", "atlas-plugin.md"), "# Atlas\\n\\nExternal type hook.\\n");
  },
  async onBuild(ctx) {
    const { mkdir, writeFile } = await import("node:fs/promises");
    const { join } = await import("node:path");
    await mkdir(join(ctx.projectDir, "build"), { recursive: true });
    await writeFile(join(ctx.projectDir, "build", "atlas-hook.txt"), "formats=" + ctx.formats.join(","));
  }
};
`,
                "defs/type.yaml": `name: Atlas
description: External package type
default_preset: screen
sections:
    - title_page
    - content
features:
    supports_parts: false
dirs:
    - manuscript
    - notes
    - assets
    - build
files:
    - style.yaml
    - synopsis.md
add_commands:
    - chapter
    - note
reports:
    - status
schemas:
    manuscript:
        required: [title]
        optional: [chapter, draft]
sample_files:
    style.yaml:
        body: "pov: third-person\\ntense: past\\ntone: \\\"\\\"\\nvoice: \\\"\\\"\\nrules: []\\n"
    synopsis.md:
        body: "# Synopsis\\n\\nWrite your synopsis here...\\n"
    manuscript/01-opening.md:
        frontmatter:
            chapter: 1
            title: "Opening"
        body: "# Opening\\n\\nExternal type package.\\n"
`,
            });

            writeFiles(join(PLUGINS_NODE_MODULES, "writekit-format-typescript"), {
                "package.json": JSON.stringify({
                    name: "writekit-format-typescript",
                    version: "1.0.0",
                    type: "module",
                    exports: "./src/plugin.js",
                }, null, 2),
                "src/plugin.js": `export default {
  extension: "ts.txt",
  configSchema: {
    header: {
      type: "string"
    }
  },
  async build(ctx) {
    const header = typeof ctx.options.header === "string" ? ctx.options.header : "TITLE";
    return header + "=" + ctx.config.title + "\\nCHAPTERS=" + ctx.chapters.length;
  }
};
`,
            });

            run(`${CLI} init package-type-book --yes --type atlas`, EXTERNAL_WORKSPACE_DIR);
        });

        afterAll(() => {
            rmSync(EXTERNAL_WORKSPACE_DIR, { recursive: true, force: true });
        });

        it("init resolves an external package type", () => {
            expect(existsSync(join(EXTERNAL_TYPE_DIR, "config.yaml"))).toBe(true);
            expect(existsSync(join(EXTERNAL_TYPE_DIR, "notes", "atlas-plugin.md"))).toBe(true);
            const config = readFileSync(join(EXTERNAL_TYPE_DIR, "config.yaml"), "utf-8");
            expect(config).toContain("type: atlas");
        });

        it("check and build work for an external package type", () => {
            const configPath = join(EXTERNAL_TYPE_DIR, "config.yaml");
            const config = readFileSync(configPath, "utf-8");
            writeFileSync(configPath, `${config}\ntype_options:\n    atlas_mode: strict\n`, "utf-8");

            const checkOut = run(`${CLI} check`, EXTERNAL_TYPE_DIR);
            expect(checkOut).toContain("All good");
            run(`${CLI} build html`, EXTERNAL_TYPE_DIR);
            const htmlFiles = readdirSync(join(EXTERNAL_TYPE_DIR, "build")).filter((f) => f.endsWith(".html"));
            expect(htmlFiles.length).toBeGreaterThan(0);
            expect(existsSync(join(EXTERNAL_TYPE_DIR, "build", "atlas-hook.txt"))).toBe(true);
        });

        it("build resolves an external package format plugin", () => {
            const configPath = join(EXTERNAL_TYPE_DIR, "config.yaml");
            const config = readFileSync(configPath, "utf-8")
                .replace("- html", "- typescript")
                .concat("\nformat_options:\n    typescript:\n        header: BOOK\n");
            writeFileSync(configPath, config, "utf-8");

            const checkOut = run(`${CLI} check`, EXTERNAL_TYPE_DIR);
            expect(checkOut).toContain("All good");

            run(`${CLI} build`, EXTERNAL_TYPE_DIR);
            const builtFiles = readdirSync(join(EXTERNAL_TYPE_DIR, "build")).filter((f) => f.endsWith(".ts.txt"));
            expect(builtFiles.length).toBeGreaterThan(0);
            const built = readFileSync(join(EXTERNAL_TYPE_DIR, "build", builtFiles[0]), "utf-8");
            expect(built).toContain("BOOK=");
        });
    });
});
