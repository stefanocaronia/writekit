import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { execSync } from "node:child_process";
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { checkNormalization, normalizeText, loadNormalizationConfig, type NormalizationConfig } from "../src/support/text-normalize";

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

// ── Unit tests ──────────────────────────────────────────────────────

describe("loadNormalizationConfig", () => {
    it("extracts known fields from style data", () => {
        const config = loadNormalizationConfig({
            pov: "third-person",
            dialogue_style: "em_dash",
            smart_quotes: true,
            normalize_ellipsis: true,
            normalize_dashes: false,
        });
        expect(config.dialogue_style).toBe("em_dash");
        expect(config.smart_quotes).toBe(true);
        expect(config.normalize_ellipsis).toBe(true);
        expect(config.normalize_dashes).toBe(false);
    });

    it("returns undefined for missing fields", () => {
        const config = loadNormalizationConfig({ pov: "first-person" });
        expect(config.dialogue_style).toBeUndefined();
        expect(config.smart_quotes).toBeUndefined();
    });
});

describe("checkNormalization", () => {
    it("warns about double quotes when dialogue_style is em_dash", () => {
        const warnings = checkNormalization(
            '"Hello," said Marco.\n\nMore text.',
            { dialogue_style: "em_dash" },
            "manuscript/01.md",
        );
        expect(warnings).toHaveLength(1);
        expect(warnings[0]).toContain("dialogue does not match");
    });

    it("warns about em-dash when dialogue_style is double_quotes", () => {
        const warnings = checkNormalization(
            "— Ciao, disse Marco.\n",
            { dialogue_style: "double_quotes" },
            "manuscript/01.md",
        );
        expect(warnings).toHaveLength(1);
        expect(warnings[0]).toContain("dialogue does not match");
    });

    it("warns about straight quotes when smart_quotes is enabled", () => {
        const warnings = checkNormalization(
            'He said "hello" to her.',
            { smart_quotes: true },
            "manuscript/01.md",
        );
        expect(warnings).toHaveLength(1);
        expect(warnings[0]).toContain("straight quotes");
    });

    it("warns about ... when normalize_ellipsis is enabled", () => {
        const warnings = checkNormalization(
            "He paused... then continued.",
            { normalize_ellipsis: true },
            "manuscript/01.md",
        );
        expect(warnings).toHaveLength(1);
        expect(warnings[0]).toContain('..."');
    });

    it("warns about -- when normalize_dashes is enabled", () => {
        const warnings = checkNormalization(
            "He thought -- perhaps -- it was wrong.",
            { normalize_dashes: true },
            "manuscript/01.md",
        );
        expect(warnings).toHaveLength(1);
        expect(warnings[0]).toContain('"--"');
    });

    it("does not warn inside code blocks", () => {
        const warnings = checkNormalization(
            '```\nHe said "hello"...\n```\n\nNormal text.',
            { smart_quotes: true, normalize_ellipsis: true },
            "manuscript/01.md",
        );
        expect(warnings).toHaveLength(0);
    });

    it("returns no warnings when text matches config", () => {
        const warnings = checkNormalization(
            "\u201CHello,\u201D said Marco.\n\nHe paused\u2026 then continued.",
            { dialogue_style: "angle_quotes", normalize_ellipsis: true },
            "manuscript/01.md",
        );
        expect(warnings).toHaveLength(0);
    });

    it("reports at most one warning per issue per file", () => {
        const warnings = checkNormalization(
            '"First line."\n"Second line."\n"Third line."',
            { dialogue_style: "em_dash" },
            "manuscript/01.md",
        );
        expect(warnings).toHaveLength(1);
    });
});

describe("normalizeText", () => {
    it("converts ... to \u2026", () => {
        expect(normalizeText("Wait... what?", { normalize_ellipsis: true }))
            .toBe("Wait\u2026 what?");
    });

    it("converts -- to \u2014", () => {
        expect(normalizeText("He thought -- yes.", { normalize_dashes: true }))
            .toBe("He thought \u2014 yes.");
    });

    it("does not convert --- (scene break)", () => {
        expect(normalizeText("---", { normalize_dashes: true }))
            .toBe("---");
    });

    it("converts straight quotes to smart quotes", () => {
        const result = normalizeText('He said "hello" and left.', { smart_quotes: true });
        expect(result).toContain("\u201C");
        expect(result).toContain("\u201D");
        expect(result).not.toContain('"');
    });

    it("does not modify code blocks", () => {
        const input = '```\nconst x = "test";\n```';
        expect(normalizeText(input, { smart_quotes: true })).toBe(input);
    });

    it("converts double quotes dialogue to em_dash", () => {
        const result = normalizeText('"Hello," said Marco.', { dialogue_style: "em_dash" });
        expect(result).toMatch(/^— /);
    });

    it("converts em_dash dialogue to double_quotes", () => {
        const result = normalizeText("— Hello, said Marco.", { dialogue_style: "double_quotes" });
        expect(result).toContain('"');
    });

    it("converts double quotes to guillemets", () => {
        const result = normalizeText('"Hello," said Marco.', { dialogue_style: "guillemets" });
        expect(result).toContain("\u00AB");
        expect(result).toContain("\u00BB");
    });

    it("applies multiple normalizations at once", () => {
        const result = normalizeText(
            'He said "wait..." -- no -- "go!"',
            { smart_quotes: true, normalize_ellipsis: true, normalize_dashes: true },
        );
        expect(result).not.toContain('"');
        expect(result).not.toContain("...");
        expect(result).not.toMatch(/(?<![-])--(?!-)/);
    });
});

// ── Integration tests (CLI) ─────────────────────────────────────────

describe("wk check with normalization rules", () => {
    const PROJ_DIR = join(SANDBOX, "test-normalize-check");

    beforeAll(() => {
        rmSync(PROJ_DIR, { recursive: true, force: true });
        mkdirSync(SANDBOX, { recursive: true });
        run(`${CLI} init test-normalize-check --yes --type novel`, SANDBOX);

        // Set normalization rules
        writeFileSync(join(PROJ_DIR, "style.yaml"), `narrator: third-person
tense: past
dialogue_style: em_dash
smart_quotes: true
normalize_ellipsis: true
normalize_dashes: true
`, "utf-8");

        // Write manuscript with violations
        writeFileSync(join(PROJ_DIR, "manuscript", "01-chapter-one.md"), `---
chapter: 1
title: Chapter One
draft: 1
---

# Chapter One

"Hello," said Marco... he thought -- perhaps -- it was wrong.
`, "utf-8");
    });

    afterAll(() => {
        rmSync(PROJ_DIR, { recursive: true, force: true });
    });

    it("warns about all normalization issues", async () => {
        const { checkProject } = await import("../src/commands/check");
        const result = await checkProject(PROJ_DIR);
        const normWarnings = result.warnings.filter(
            (w) => w.includes("dialogue") || w.includes("quotes") || w.includes('..."') || w.includes('"--"'),
        );
        expect(normWarnings.length).toBeGreaterThanOrEqual(3);
    });
});

describe("wk sync with normalization rules", () => {
    const PROJ_DIR = join(SANDBOX, "test-normalize-sync");

    beforeAll(() => {
        rmSync(PROJ_DIR, { recursive: true, force: true });
        mkdirSync(SANDBOX, { recursive: true });
        run(`${CLI} init test-normalize-sync --yes --type novel`, SANDBOX);

        writeFileSync(join(PROJ_DIR, "style.yaml"), `narrator: third-person
tense: past
smart_quotes: true
normalize_ellipsis: true
normalize_dashes: true
`, "utf-8");

        writeFileSync(join(PROJ_DIR, "manuscript", "01-chapter-one.md"), `---
chapter: 1
title: Chapter One
draft: 1
---

# Chapter One

He said "hello"... and left -- quickly.
`, "utf-8");
    });

    afterAll(() => {
        rmSync(PROJ_DIR, { recursive: true, force: true });
    });

    it("normalizes text on sync", () => {
        run(`${CLI} sync`, PROJ_DIR);

        const content = readFileSync(join(PROJ_DIR, "manuscript", "01-chapter-one.md"), "utf-8");
        // Straight quotes → smart quotes
        expect(content).not.toMatch(/(?<![\\`])"/);
        // ... → …
        expect(content).toContain("\u2026");
        expect(content).not.toContain("...");
        // -- → —
        expect(content).toContain("\u2014");
        expect(content).not.toMatch(/(?<![-])--(?!-)/);
    });

    it("does not re-modify already normalized files", () => {
        const before = readFileSync(join(PROJ_DIR, "manuscript", "01-chapter-one.md"), "utf-8");
        run(`${CLI} sync`, PROJ_DIR);
        const after = readFileSync(join(PROJ_DIR, "manuscript", "01-chapter-one.md"), "utf-8");
        expect(after).toBe(before);
    });
});
