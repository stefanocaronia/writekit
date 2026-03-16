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

    it("add author works", () => {
        run(`${CLI} add author "Lucia Bianchi"`, TEST_DIR);
        const config = readFileSync(join(TEST_DIR, "config.yaml"), "utf-8");
        expect(config).toContain("Lucia Bianchi");
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
