import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { execSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = process.cwd();
const CLI = `node ${join(ROOT, "dist", "cli.js")}`;
const SANDBOX = join(ROOT, "sandbox");

function run(cmd: string, cwd?: string): string {
    return execSync(cmd, {
        cwd: cwd ?? ROOT,
        encoding: "utf-8",
        timeout: 60_000,
    });
}

// ── Font embedding ──────────────────────────────────────────────────

describe("font embedding", () => {
    const PROJ_DIR = join(SANDBOX, "test-fonts");

    beforeAll(() => {
        rmSync(PROJ_DIR, { recursive: true, force: true });
        mkdirSync(SANDBOX, { recursive: true });
        run(`${CLI} init test-fonts --yes --type novel`, SANDBOX);

        // Create a minimal fake .ttf font (just needs to be a file)
        const fontsDir = join(PROJ_DIR, "assets", "fonts");
        mkdirSync(fontsDir, { recursive: true });
        writeFileSync(join(fontsDir, "TestFont.ttf"), "fake-ttf-data-for-testing");
        writeFileSync(join(fontsDir, "TestSans.woff2"), "fake-woff2-data");
    });

    afterAll(() => {
        rmSync(PROJ_DIR, { recursive: true, force: true });
    });

    it("embeds fonts as base64 @font-face in HTML", () => {
        run(`${CLI} build html`, PROJ_DIR);
        const htmlFiles = readFileSync(
            join(PROJ_DIR, "build",
                require("node:fs").readdirSync(join(PROJ_DIR, "build")).find((f: string) => f.endsWith(".html"))!),
            "utf-8",
        );
        expect(htmlFiles).toContain("@font-face");
        expect(htmlFiles).toContain("TestFont");
        expect(htmlFiles).toContain("font/ttf");
        expect(htmlFiles).toContain("TestSans");
        expect(htmlFiles).toContain("font/woff2");
    });
});

// ── Theme fonts ─────────────────────────────────────────────────────

describe("theme fonts", () => {
    const PROJ_DIR = join(SANDBOX, "test-theme-fonts");

    beforeAll(() => {
        rmSync(PROJ_DIR, { recursive: true, force: true });
        mkdirSync(SANDBOX, { recursive: true });
        run(`${CLI} init test-theme-fonts --yes --type novel`, SANDBOX);

        // Create a custom theme with fonts
        run(`${CLI} theme create mytheme`, PROJ_DIR);
        const themeFontsDir = join(PROJ_DIR, "themes", "mytheme", "fonts");
        mkdirSync(themeFontsDir, { recursive: true });
        writeFileSync(join(themeFontsDir, "ThemeSerif.otf"), "fake-otf-data");
        run(`${CLI} theme use mytheme`, PROJ_DIR);
    });

    afterAll(() => {
        rmSync(PROJ_DIR, { recursive: true, force: true });
    });

    it("includes theme fonts in HTML build", () => {
        run(`${CLI} build html`, PROJ_DIR);
        const buildDir = join(PROJ_DIR, "build");
        const htmlFile = require("node:fs").readdirSync(buildDir).find((f: string) => f.endsWith(".html"));
        const html = readFileSync(join(buildDir, htmlFile!), "utf-8");
        expect(html).toContain("@font-face");
        expect(html).toContain("ThemeSerif");
        expect(html).toContain("font/otf");
    });
});

// ── DOCX template ───────────────────────────────────────────────────

describe("DOCX template", () => {
    const PROJ_DIR = join(SANDBOX, "test-docx-template");

    beforeAll(() => {
        rmSync(PROJ_DIR, { recursive: true, force: true });
        mkdirSync(SANDBOX, { recursive: true });
        run(`${CLI} init test-docx-template --yes --type novel`, SANDBOX);

        // First, build a normal DOCX to use as template
        run(`${CLI} build docx`, PROJ_DIR);
        const buildDir = join(PROJ_DIR, "build");
        const docxFile = require("node:fs").readdirSync(buildDir).find((f: string) => f.endsWith(".docx"));

        // Copy the generated DOCX as template
        const assetsDir = join(PROJ_DIR, "assets");
        mkdirSync(assetsDir, { recursive: true });
        require("node:fs").copyFileSync(
            join(buildDir, docxFile!),
            join(assetsDir, "template.docx"),
        );
    });

    afterAll(() => {
        rmSync(PROJ_DIR, { recursive: true, force: true });
    });

    it("resolves template from assets/template.docx", async () => {
        const { resolveTemplatePath } = await import("../src/formats/docx-template");
        const path = await resolveTemplatePath(PROJ_DIR);
        expect(path).toBe(join(PROJ_DIR, "assets", "template.docx"));
    });

    it("builds DOCX successfully with template", () => {
        run(`${CLI} build docx`, PROJ_DIR);
        const buildDir = join(PROJ_DIR, "build");
        const docxFiles = require("node:fs").readdirSync(buildDir).filter((f: string) => f.endsWith(".docx"));
        expect(docxFiles.length).toBeGreaterThan(0);
    });

    it("template DOCX output is larger than minimal (styles merged)", () => {
        const buildDir = join(PROJ_DIR, "build");
        const docxFile = require("node:fs").readdirSync(buildDir).find((f: string) => f.endsWith(".docx"));
        const stats = require("node:fs").statSync(join(buildDir, docxFile!));
        // With template, the file should have reasonable size (styles + content)
        expect(stats.size).toBeGreaterThan(5000);
    });
});

// ── DOCX template resolution priority ───────────────────────────────

describe("DOCX template priority", () => {
    it("returns null when no template exists", async () => {
        const { resolveTemplatePath } = await import("../src/formats/docx-template");
        const path = await resolveTemplatePath(join(SANDBOX, "nonexistent-project"));
        expect(path).toBeNull();
    });

    it("prefers assets/template.docx over theme template", async () => {
        const PROJ_DIR = join(SANDBOX, "test-docx-priority");
        rmSync(PROJ_DIR, { recursive: true, force: true });
        run(`${CLI} init test-docx-priority --yes --type novel`, SANDBOX);

        // Create both templates
        run(`${CLI} theme create priotest`, PROJ_DIR);
        run(`${CLI} theme use priotest`, PROJ_DIR);

        const assetsDir = join(PROJ_DIR, "assets");
        mkdirSync(assetsDir, { recursive: true });
        writeFileSync(join(assetsDir, "template.docx"), "user-template");

        const themeDir = join(PROJ_DIR, "themes", "priotest");
        writeFileSync(join(themeDir, "template.docx"), "theme-template");

        const { resolveTemplatePath } = await import("../src/formats/docx-template");
        const path = await resolveTemplatePath(PROJ_DIR, themeDir);
        expect(path).toBe(join(PROJ_DIR, "assets", "template.docx"));

        rmSync(PROJ_DIR, { recursive: true, force: true });
    });
});
