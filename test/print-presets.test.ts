import { describe, expect, it, beforeAll, afterAll } from "vitest";
import { execSync } from "node:child_process";
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { resolvePrintPreset } from "../src/formats/print-presets";
import { checkProject } from "../src/commands/check";

const ROOT = process.cwd();
const CLI = `node ${join(ROOT, "dist", "cli.js")}`;
const SANDBOX = join(ROOT, "sandbox");
const LAYOUT_DIR = join(SANDBOX, "test-layout-check");

function run(cmd: string, cwd?: string): string {
    return execSync(cmd, {
        cwd: cwd ?? ROOT,
        encoding: "utf-8",
        timeout: 30_000,
    });
}

describe("print preset resolution", () => {
    it("uses type default preset when config does not specify one", async () => {
        const preset = await resolvePrintPreset({}, "a5");

        expect(preset.name).toBe("A5");
        expect(preset.pageNumbers).toBe(true);
        expect(preset.runningHeader).toBe(true);
    });

    it("applies layout overrides on top of the chosen preset", async () => {
        const preset = await resolvePrintPreset({
            print_preset: "trade",
            layout: {
                running_header: false,
                page_numbers: true,
                recto_start: false,
                margin: {
                    inner: 24,
                    outer: 18,
                },
            },
        });

        expect(preset.name).toBe("US Trade");
        expect(preset.runningHeader).toBe(false);
        expect(preset.pageNumbers).toBe(true);
        expect(preset.rectoStart).toBe(false);
        expect(preset.margin.inner).toBe(24);
        expect(preset.margin.outer).toBe(18);
        expect(preset.margin.top).toBe(18);
        expect(preset.margin.bottom).toBe(18);
    });

    it("loads a local custom preset plugin", async () => {
        const localDir = join(SANDBOX, "test-preset-local");
        rmSync(localDir, { recursive: true, force: true });
        mkdirSync(join(localDir, "presets"), { recursive: true });
        writeFileSync(join(localDir, "presets", "compact.mjs"), `export default {
  preset: {
    name: "Compact",
    description: "Compact local preset",
    width: 130,
    height: 200,
    margin: { top: 12, bottom: 12, inner: 18, outer: 12 },
    bleed: 0,
    mirrorMargins: true,
    pageNumbers: true,
    runningHeader: false,
    rectoStart: true
  }
};
`, "utf-8");

        const preset = await resolvePrintPreset({ print_preset: "compact" }, undefined, localDir);
        expect(preset.name).toBe("Compact");
        expect(preset.width).toBe(130);
        expect(preset.margin.inner).toBe(18);

        rmSync(localDir, { recursive: true, force: true });
    });

    it("loads an external preset package", async () => {
        const workspaceDir = join(SANDBOX, "test-preset-package");
        const packageDir = join(workspaceDir, "node_modules", "writekit-preset-roomy");
        rmSync(workspaceDir, { recursive: true, force: true });
        mkdirSync(packageDir, { recursive: true });
        writeFileSync(join(packageDir, "package.json"), JSON.stringify({
            name: "writekit-preset-roomy",
            version: "1.0.0",
            type: "module",
            exports: "./plugin.js",
        }, null, 2), "utf-8");
        writeFileSync(join(packageDir, "plugin.js"), `export default {
  preset: {
    name: "Roomy",
    description: "External package preset",
    width: 160,
    height: 240,
    margin: { top: 20, bottom: 20, inner: 26, outer: 18 },
    bleed: 3,
    mirrorMargins: true,
    pageNumbers: true,
    runningHeader: true,
    rectoStart: true
  }
};
`, "utf-8");

        const preset = await resolvePrintPreset({ print_preset: "roomy" }, undefined, workspaceDir);
        expect(preset.name).toBe("Roomy");
        expect(preset.height).toBe(240);
        expect(preset.bleed).toBe(3);

        rmSync(workspaceDir, { recursive: true, force: true });
    });
});

describe("layout override validation", () => {
    beforeAll(() => {
        rmSync(LAYOUT_DIR, { recursive: true, force: true });
        mkdirSync(SANDBOX, { recursive: true });
        run(`${CLI} init test-layout-check --yes --type novel`, SANDBOX);
    });

    afterAll(() => {
        rmSync(LAYOUT_DIR, { recursive: true, force: true });
    });

    it("reports invalid layout override types", async () => {
        const configPath = join(LAYOUT_DIR, "config.yaml");
        const config = readFileSync(configPath, "utf-8");
        writeFileSync(configPath, `${config}
layout:
  running_header: "no"
  margin:
    inner: 0
`, "utf-8");

        const result = await checkProject(LAYOUT_DIR);

        expect(result.errors.some((msg) => msg.includes("layout.running_header should be boolean"))).toBe(true);
        expect(result.errors.some((msg) => msg.includes("layout.margin.inner should be greater than 0"))).toBe(true);
    });
});
