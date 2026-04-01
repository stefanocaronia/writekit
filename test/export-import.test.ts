import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { execSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = process.cwd();
const CLI = `node ${join(ROOT, "dist", "cli.js")}`;
const SANDBOX = join(ROOT, "sandbox");

function run(cmd: string, cwd?: string): string {
    return execSync(cmd, {
        cwd: cwd ?? ROOT,
        encoding: "utf-8",
        timeout: 30_000,
    });
}

// ── Export ───────────────────────────────────────────────────────────

describe("export", () => {
    const PROJ_DIR = join(SANDBOX, "test-export");

    beforeAll(() => {
        rmSync(PROJ_DIR, { recursive: true, force: true });
        mkdirSync(SANDBOX, { recursive: true });
        run(`${CLI} init test-export --yes --type novel`, SANDBOX);

        // Add content for a richer export
        writeFileSync(join(PROJ_DIR, "characters", "hero.md"), `---
name: Test Hero
role: protagonist
aliases: []
---

# Test Hero

A brave character.
`, "utf-8");

        writeFileSync(join(PROJ_DIR, "manuscript", "01-chapter-one.md"), `---
chapter: 1
title: "Opening"
draft: 1
---

# Opening

It begins here.
`, "utf-8");
    });

    afterAll(() => {
        rmSync(PROJ_DIR, { recursive: true, force: true });
    });

    it("produces a structured markdown file", () => {
        const out = run(`${CLI} export`, PROJ_DIR);
        expect(out).toContain("Exporting project");
        expect(out).toContain(".export.md");
    });

    it("export file contains config as yaml block", () => {
        const files = readdirSync(join(PROJ_DIR, "build")).filter((f) => f.endsWith(".export.md"));
        expect(files.length).toBe(1);
        const content = readFileSync(join(PROJ_DIR, "build", files[0]), "utf-8");
        expect(content).toContain("## Config");
        expect(content).toContain("```yaml");
        expect(content).toContain("type: novel");
    });

    it("export file contains characters", () => {
        const files = readdirSync(join(PROJ_DIR, "build")).filter((f) => f.endsWith(".export.md"));
        const content = readFileSync(join(PROJ_DIR, "build", files[0]), "utf-8");
        expect(content).toContain("## Characters");
        expect(content).toContain("Test Hero");
    });

    it("export file contains manuscript", () => {
        const files = readdirSync(join(PROJ_DIR, "build")).filter((f) => f.endsWith(".export.md"));
        const content = readFileSync(join(PROJ_DIR, "build", files[0]), "utf-8");
        expect(content).toContain("## Manuscript");
        expect(content).toContain("It begins here.");
    });

    it("export file contains style as yaml block", () => {
        const files = readdirSync(join(PROJ_DIR, "build")).filter((f) => f.endsWith(".export.md"));
        const content = readFileSync(join(PROJ_DIR, "build", files[0]), "utf-8");
        expect(content).toContain("## Style");
    });

    it("supports custom output path", () => {
        const customPath = join(PROJ_DIR, "build", "custom-export.md");
        run(`${CLI} export -o "${customPath}"`, PROJ_DIR);
        expect(existsSync(customPath)).toBe(true);
        const content = readFileSync(customPath, "utf-8");
        expect(content).toContain("## Config");
    });
});

// ── Export for different types ───────────────────────────────────────

describe("export paper type", () => {
    const PROJ_DIR = join(SANDBOX, "test-export-paper");

    beforeAll(() => {
        rmSync(PROJ_DIR, { recursive: true, force: true });
        mkdirSync(SANDBOX, { recursive: true });
        run(`${CLI} init test-export-paper --yes --type paper`, SANDBOX);
    });

    afterAll(() => {
        rmSync(PROJ_DIR, { recursive: true, force: true });
    });

    it("includes paper-specific sections (abstract, bibliography)", () => {
        run(`${CLI} export`, PROJ_DIR);
        const files = readdirSync(join(PROJ_DIR, "build")).filter((f) => f.endsWith(".export.md"));
        const content = readFileSync(join(PROJ_DIR, "build", files[0]), "utf-8");
        expect(content).toContain("## Abstract");
        expect(content).toContain("## Bibliography");
        // Should not have characters or world
        expect(content).not.toContain("## Characters");
        expect(content).not.toContain("## World");
    });
});

// ── Import ──────────────────────────────────────────────────────────

describe("import", () => {
    const PROJ_DIR = join(SANDBOX, "test-import");
    const MD_FILE = join(SANDBOX, "import-source.md");

    beforeAll(() => {
        rmSync(PROJ_DIR, { recursive: true, force: true });
        mkdirSync(SANDBOX, { recursive: true });
        run(`${CLI} init test-import --yes --type novel`, SANDBOX);

        // Create source markdown with 3 chapters
        writeFileSync(MD_FILE, `# The Beginning

It was a dark and stormy night. The wind howled.

# The Middle

Everything changed when the letter arrived. Nobody expected it.

# The End

And so it was done. The story concluded.
`, "utf-8");
    });

    afterAll(() => {
        rmSync(PROJ_DIR, { recursive: true, force: true });
        rmSync(MD_FILE, { force: true });
    });

    it("splits markdown by headings into chapters", () => {
        const out = run(`${CLI} import "${MD_FILE}"`, PROJ_DIR);
        expect(out).toContain("3 chapters imported");
        expect(out).toContain("The Beginning");
        expect(out).toContain("The Middle");
        expect(out).toContain("The End");
    });

    it("creates numbered chapter files with frontmatter", () => {
        const files = readdirSync(join(PROJ_DIR, "manuscript"))
            .filter((f) => f.endsWith(".md"))
            .sort();
        // Should have original + 3 imported
        const imported = files.filter((f) => f.includes("the-beginning") || f.includes("the-middle") || f.includes("the-end"));
        expect(imported.length).toBe(3);

        const content = readFileSync(join(PROJ_DIR, "manuscript", imported[0]), "utf-8");
        expect(content).toContain("title: The Beginning");
        expect(content).toContain("draft: 1");
        expect(content).toContain("It was a dark and stormy night");
    });

    it("supports --start-at option", () => {
        const md2 = join(SANDBOX, "import-start.md");
        writeFileSync(md2, "# Extra Chapter\n\nMore content.\n", "utf-8");
        const out = run(`${CLI} import "${md2}" --start-at 10`, PROJ_DIR);
        expect(out).toContain("1 chapters imported");

        const files = readdirSync(join(PROJ_DIR, "manuscript"))
            .filter((f) => f.startsWith("10-"));
        expect(files.length).toBe(1);
        rmSync(md2, { force: true });
    });

    it("fails on non-existent file", () => {
        expect(() => run(`${CLI} import nonexistent.md`, PROJ_DIR)).toThrow();
    });

    it("imports text without headings as a single Untitled chapter", () => {
        const noHeadings = join(SANDBOX, "no-headings.md");
        writeFileSync(noHeadings, "Just some text without any headings.\n", "utf-8");
        const out = run(`${CLI} import "${noHeadings}"`, PROJ_DIR);
        expect(out).toContain("1 chapters imported");
        rmSync(noHeadings, { force: true });
    });
});

// ── Import into parts ───────────────────────────────────────────────

describe("import --part", () => {
    const PROJ_DIR = join(SANDBOX, "test-import-parts");
    const MD_FILE = join(SANDBOX, "import-part-source.md");

    beforeAll(() => {
        rmSync(PROJ_DIR, { recursive: true, force: true });
        mkdirSync(SANDBOX, { recursive: true });
        run(`${CLI} init test-import-parts --yes --type novel`, SANDBOX);
        run(`${CLI} add part "Part One"`, PROJ_DIR);

        writeFileSync(MD_FILE, `# In the Part

Content for the part chapter.
`, "utf-8");
    });

    afterAll(() => {
        rmSync(PROJ_DIR, { recursive: true, force: true });
        rmSync(MD_FILE, { force: true });
    });

    it("imports chapters into a part directory", () => {
        const out = run(`${CLI} import "${MD_FILE}" --part 1`, PROJ_DIR);
        expect(out).toContain("1 chapters imported");

        const partDir = join(PROJ_DIR, "manuscript", "part-01");
        const files = readdirSync(partDir).filter((f) => f.endsWith(".md"));
        const imported = files.filter((f) => f.includes("in-the-part"));
        expect(imported.length).toBe(1);
    });
});
