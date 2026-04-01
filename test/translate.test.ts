import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { execSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = process.cwd();
const CLI = `node ${join(ROOT, "dist", "cli.js")}`;
const SANDBOX = join(ROOT, "sandbox");
const SRC_DIR = join(SANDBOX, "test-translate-src");
const TGT_DIR = join(SRC_DIR, "translations", "en");

function run(cmd: string, cwd?: string): string {
    return execSync(cmd, {
        cwd: cwd ?? ROOT,
        encoding: "utf-8",
        timeout: 30_000,
    });
}

describe("translate", () => {
    beforeAll(() => {
        rmSync(SRC_DIR, { recursive: true, force: true });
        mkdirSync(SANDBOX, { recursive: true });

        // Create a novel project with characters, world, concepts
        run(`${CLI} init test-translate-src --yes --type novel`, SANDBOX);

        // Add characters
        writeFileSync(join(SRC_DIR, "characters", "marco.md"), `---
name: Marco Rossi
role: protagonist
aliases:
  - il dottore
age: "35"
relationships: []
---

# Marco Rossi

A scientist.
`, "utf-8");

        writeFileSync(join(SRC_DIR, "characters", "elena.md"), `---
name: Elena Neri
role: antagonist
aliases: []
age: "40"
relationships:
  - character: Marco Rossi
    type: rival
---

# Elena Neri

A politician.
`, "utf-8");

        // Add world
        writeFileSync(join(SRC_DIR, "world", "rome.md"), `---
name: Roma Sotterranea
type: location
---

# Roma Sotterranea

Underground tunnels.
`, "utf-8");

        // Add manuscript content
        writeFileSync(join(SRC_DIR, "manuscript", "01-chapter-one.md"), `---
chapter: 1
title: "The Discovery"
pov: "Marco Rossi"
draft: 1
---

# The Discovery

Marco Rossi walked into Roma Sotterranea with Elena Neri.
`, "utf-8");

        writeFileSync(join(SRC_DIR, "manuscript", "02-chapter-two.md"), `---
chapter: 2
title: "The Chase"
pov: "Elena Neri"
draft: 1
---

# The Chase

Elena ran through the tunnels.
`, "utf-8");
    });

    afterAll(() => {
        rmSync(SRC_DIR, { recursive: true, force: true });
    });

    // ── translate init ──────────────────────────────────────────────

    describe("init", () => {
        it("creates a translation project", () => {
            const out = run(`${CLI} translate init --to en`, SRC_DIR);
            expect(out).toContain("Initializing translation");
            expect(out).toContain("Translation project ready");
        });

        it("creates translation.yaml with correct metadata", () => {
            const yaml = readFileSync(join(TGT_DIR, "translation.yaml"), "utf-8");
            expect(yaml).toContain("source_language: it");
            expect(yaml).toContain("target_language: en");
            expect(yaml).toContain("source_project:");
        });

        it("creates translation-glossary.yaml with extracted names", () => {
            const glossary = readFileSync(join(TGT_DIR, "translation-glossary.yaml"), "utf-8");
            expect(glossary).toContain("Marco Rossi");
            expect(glossary).toContain("Elena Neri");
            expect(glossary).toContain("Roma Sotterranea");
            expect(glossary).toContain("translation: \"\"");
        });

        it("scaffolds manuscript files with empty bodies and source_hash", () => {
            const ch1 = readFileSync(join(TGT_DIR, "manuscript", "01-chapter-one.md"), "utf-8");
            expect(ch1).toContain("source_path: manuscript/01-chapter-one.md");
            expect(ch1).toContain("source_hash:");
            expect(ch1).toContain('title: The Discovery');
            // Body should be empty (only frontmatter)
            const bodyStart = ch1.lastIndexOf("---") + 3;
            expect(ch1.slice(bodyStart).trim()).toBe("");
        });

        it("creates a valid writekit project in the target", () => {
            const out = run(`${CLI} check`, TGT_DIR);
            // check passes (exit 0) — warnings about missing POV characters are ok
            expect(out).toContain("0 error(s)");
        });

        it("copies config.yaml with updated language", () => {
            const config = readFileSync(join(TGT_DIR, "config.yaml"), "utf-8");
            expect(config).toContain("language: en");
        });

        it("creates AGENTS.md with translation instructions", () => {
            const agents = readFileSync(join(TGT_DIR, "AGENTS.md"), "utf-8");
            expect(agents).toContain("Translation Project");
            expect(agents).toContain("translation-glossary.yaml");
        });

        it("rejects same language as source", () => {
            expect(() => run(`${CLI} translate init --to it`, SRC_DIR)).toThrow();
        });

        it("rejects unsupported language", () => {
            expect(() => run(`${CLI} translate init --to zz`, SRC_DIR)).toThrow();
        });

        it("rejects if target already exists", () => {
            expect(() => run(`${CLI} translate init --to en`, SRC_DIR)).toThrow();
        });
    });

    // ── translate glossary ──────────────────────────────────────────

    describe("glossary", () => {
        it("shows glossary with untranslated entries", () => {
            const out = run(`${CLI} translate glossary`, TGT_DIR);
            expect(out).toContain("Translation Glossary");
            expect(out).toContain("Marco Rossi");
            expect(out).toContain("untranslated");
            expect(out).toContain("0%");
        });
    });

    // ── translate status ────────────────────────────────────────────

    describe("status", () => {
        it("shows untranslated files", () => {
            const out = run(`${CLI} translate status`, TGT_DIR);
            expect(out).toContain("Translation Status");
            expect(out).toContain("untranslated");
            expect(out).toContain("0/2 translated");
        });
    });

    // ── translate verify ────────────────────────────────────────────

    describe("verify", () => {
        it("warns about untranslated glossary entries", () => {
            const out = run(`${CLI} translate verify`, TGT_DIR);
            expect(out).toContain("glossary entries have no translation");
        });
    });

    // ── translate diff ──────────────────────────────────────────────

    describe("diff", () => {
        it("shows all files up to date when no source changes", () => {
            const out = run(`${CLI} translate diff`, TGT_DIR);
            expect(out).toContain("All files up to date");
        });

        it("detects outdated files after source change", () => {
            // Modify source chapter
            writeFileSync(join(SRC_DIR, "manuscript", "01-chapter-one.md"), `---
chapter: 1
title: "The Discovery (Revised)"
pov: "Marco Rossi"
draft: 2
---

# The Discovery (Revised)

Marco Rossi walked carefully into Roma Sotterranea. Elena Neri followed.
`, "utf-8");

            const out = run(`${CLI} translate diff`, TGT_DIR);
            expect(out).toContain("outdated");
            expect(out).toContain("01-chapter-one.md");
        });
    });

    // ── translate sync ──────────────────────────────────────────────

    describe("sync", () => {
        it("adds new source files to target", () => {
            // Add a new chapter to source
            writeFileSync(join(SRC_DIR, "manuscript", "03-chapter-three.md"), `---
chapter: 3
title: "The Resolution"
pov: "Marco Rossi"
draft: 1
---

# The Resolution

The end.
`, "utf-8");

            const out = run(`${CLI} translate sync`, TGT_DIR);
            expect(out).toContain("manuscript/03-chapter-three.md");
            expect(out).toContain("new from source");

            // Verify the file was created in target
            expect(existsSync(join(TGT_DIR, "manuscript", "03-chapter-three.md"))).toBe(true);
            const content = readFileSync(join(TGT_DIR, "manuscript", "03-chapter-three.md"), "utf-8");
            expect(content).toContain("source_path: manuscript/03-chapter-three.md");
            expect(content).toContain("source_hash:");
        });

        it("reports already in sync when nothing changed", () => {
            const out = run(`${CLI} translate sync`, TGT_DIR);
            expect(out).toContain("Already in sync");
        });
    });

    // ── translate with --context ─────────────────────────────────────

    describe("init --context", () => {
        const CTX_DIR = join(SANDBOX, "test-translate-ctx");
        const CTX_TGT = join(CTX_DIR, "translations", "fr");

        beforeAll(() => {
            rmSync(CTX_DIR, { recursive: true, force: true });
            run(`${CLI} init test-translate-ctx --yes --type novel`, SANDBOX);
            writeFileSync(join(CTX_DIR, "characters", "hero.md"), `---
name: Hero
role: protagonist
aliases: []
---

# Hero
`, "utf-8");
            run(`${CLI} translate init --to fr --context`, CTX_DIR);
        });

        afterAll(() => {
            rmSync(CTX_DIR, { recursive: true, force: true });
        });

        it("copies characters directory when --context is used", () => {
            expect(existsSync(join(CTX_TGT, "characters", "hero.md"))).toBe(true);
        });

        it("target check passes with context dirs", () => {
            const out = run(`${CLI} check`, CTX_TGT);
            expect(out).not.toContain("error");
        });
    });

    // ── translate with --output ──────────────────────────────────────

    describe("init --output", () => {
        const EXT_DIR = join(SANDBOX, "test-translate-ext");
        const EXT_SRC = join(SANDBOX, "test-translate-ext-src");

        beforeAll(() => {
            rmSync(EXT_DIR, { recursive: true, force: true });
            rmSync(EXT_SRC, { recursive: true, force: true });
            run(`${CLI} init test-translate-ext-src --yes --type essay`, SANDBOX);
            run(`${CLI} translate init --to de --output ${EXT_DIR}`, EXT_SRC);
        });

        afterAll(() => {
            rmSync(EXT_DIR, { recursive: true, force: true });
            rmSync(EXT_SRC, { recursive: true, force: true });
        });

        it("creates translation in external directory", () => {
            expect(existsSync(join(EXT_DIR, "config.yaml"))).toBe(true);
            expect(existsSync(join(EXT_DIR, "translation.yaml"))).toBe(true);
        });

        it("works with essay type (no characters/world)", () => {
            const glossary = readFileSync(join(EXT_DIR, "translation-glossary.yaml"), "utf-8");
            // Should not have characters or locations sections
            expect(glossary).not.toContain("characters:");
            expect(glossary).not.toContain("locations:");
        });
    });
});
