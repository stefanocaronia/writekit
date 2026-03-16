import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { execSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { join } from "node:path";

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

describe("writekit smoke tests", () => {
    beforeAll(() => {
        rmSync(TEST_DIR, { recursive: true, force: true });
        mkdirSync(SANDBOX, { recursive: true });
    });

    afterAll(() => {
        rmSync(TEST_DIR, { recursive: true, force: true });
    });

    it("shows help", () => {
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
        expect(existsSync(join(TEST_DIR, "build", "reports", "locations.md"))).toBe(true);
        expect(existsSync(join(TEST_DIR, "build", "reports", "timeline.md"))).toBe(true);
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

    it("theme list works", () => {
        const out = run(`${CLI} theme list`, TEST_DIR);
        expect(out.toLowerCase()).toContain("default");
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

const TYPES_TO_TEST = ["essay", "paper", "article", "collection"] as const;

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
    article: {
        dirs: ["manuscript", "notes", "reference", "assets", "build"],
        missingDirs: ["outline", "characters", "world"],
        files: ["config.yaml", "style.yaml", "synopsis.md", ".gitignore", "README.md", "AGENTS.md"],
        missingFiles: ["timeline.yaml", "bibliography.yaml"],
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
});
