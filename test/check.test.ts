import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { execSync } from "node:child_process";
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { checkProject } from "../src/commands/check";

const ROOT = process.cwd();
const CLI = `node ${join(ROOT, "dist", "cli.js")}`;
const SANDBOX = join(ROOT, "sandbox");
const CHECK_DIR = join(SANDBOX, "test-crossrefs");

function run(cmd: string, cwd?: string): string {
    return execSync(cmd, {
        cwd: cwd ?? ROOT,
        encoding: "utf-8",
        timeout: 30_000,
    });
}

describe("cross-reference validation", () => {
    beforeAll(() => {
        rmSync(CHECK_DIR, { recursive: true, force: true });
        mkdirSync(SANDBOX, { recursive: true });
    });

    afterAll(() => {
        rmSync(CHECK_DIR, { recursive: true, force: true });
    });

    it("warns about missing novel cross references", async () => {
        run(`${CLI} init test-crossrefs --yes --type novel`, SANDBOX);

        writeFileSync(join(CHECK_DIR, "manuscript", "01-chapter-one.md"), `---
chapter: 1
title: Chapter One
pov: Ghost
draft: 1
---

# Chapter One

Text.
`, "utf-8");

        writeFileSync(join(CHECK_DIR, "outline", "chapters", "01.md"), `---
chapter: 1
title: Chapter One
pov: Ghost
characters:
  - Ghost
location: Lost City
---

# Chapter 1

Outline.
`, "utf-8");

        writeFileSync(join(CHECK_DIR, "characters", "protagonist.md"), `---
name: Real Person
role: protagonist
relationships:
  - character: Ghost
---

# Real Person
`, "utf-8");

        const result = await checkProject(CHECK_DIR);

        expect(result.warnings.some((msg) => msg.includes('manuscript/01-chapter-one.md: pov "Ghost" not found in characters/'))).toBe(true);
        expect(result.warnings.some((msg) => msg.includes('outline/chapters/01.md: character "Ghost" not found in characters/'))).toBe(true);
        expect(result.warnings.some((msg) => msg.includes('outline/chapters/01.md: location "Lost City" not found in world/'))).toBe(true);
        expect(result.warnings.some((msg) => msg.includes('characters/protagonist.md: relationship target "Ghost" not found in characters/'))).toBe(true);
    });

    it("warns about missing concept and argument references", async () => {
        const essayDir = join(SANDBOX, "test-crossrefs-essay");
        rmSync(essayDir, { recursive: true, force: true });
        run(`${CLI} init test-crossrefs-essay --yes --type essay`, SANDBOX);

        writeFileSync(join(essayDir, "concepts", "example.md"), `---
term: Soundscape
related:
  - Missing Concept
---

# Soundscape
`, "utf-8");

        writeFileSync(join(essayDir, "arguments", "example.md"), `---
claim: Silence matters
related:
  - Missing Argument
---

# Silence matters
`, "utf-8");

        const result = await checkProject(essayDir);

        expect(result.warnings.some((msg) => msg.includes('concepts/example.md: related reference "Missing Concept" not found in concepts/ or arguments/'))).toBe(true);
        expect(result.warnings.some((msg) => msg.includes('arguments/example.md: related reference "Missing Argument" not found in concepts/ or arguments/'))).toBe(true);

        rmSync(essayDir, { recursive: true, force: true });
    });
});
