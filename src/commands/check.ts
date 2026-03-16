import { Command } from "commander";
import { readdir, readFile } from "node:fs/promises";
import { join, extname } from "node:path";
import { fileExists, dirExists } from "../lib/fs-utils.js";
import { parse as parseYaml, YAMLParseError } from "yaml";
import { parseFrontmatter } from "../lib/parse.js";
import { listThemes } from "../lib/theme.js";
import {
    validateData,
    configSchema,
    styleSchema,
    timelineSchema,
    manuscriptSchema,
    outlineChapterSchema,
    characterSchema,
    worldSchema,
    type Schema,
    type ValidationIssue,
} from "../lib/schema.js";

interface CheckResult {
    warnings: string[];
    errors: string[];
}

const REQUIRED_FILES = [
    "config.yaml",
    "style.yaml",
    "timeline.yaml",
    "synopsis.md",
];

const REQUIRED_DIRS = [
    "outline",
    "manuscript",
    "characters",
    "world",
    "notes",
    "reference",
    "assets",
    "build",
];

const FRONTMATTER_SCHEMAS: Record<string, Schema> = {
    manuscript: manuscriptSchema,
    "outline/chapters": outlineChapterSchema,
    characters: characterSchema,
    world: worldSchema,
};

async function getMdFiles(dir: string): Promise<string[]> {
    try {
        const entries = await readdir(dir);
        return entries.filter((f) => extname(f) === ".md");
    } catch {
        return [];
    }
}

function tryParseYaml(
    raw: string,
    file: string,
): { data: Record<string, unknown> | null; issues: ValidationIssue[] } {
    try {
        const data = parseYaml(raw) as Record<string, unknown>;
        if (!data || typeof data !== "object") {
            return {
                data: null,
                issues: [{ level: "error", message: `${file}: YAML parsed but is empty or not an object` }],
            };
        }
        return { data, issues: [] };
    } catch (e) {
        if (e instanceof YAMLParseError) {
            // Extract line number from YAML error
            const lineMatch = e.message.match(/at line (\d+)/);
            const line = lineMatch ? ` (line ${lineMatch[1]})` : "";
            return {
                data: null,
                issues: [{ level: "error", message: `${file}${line}: invalid YAML — ${e.message.split("\n")[0]}` }],
            };
        }
        return {
            data: null,
            issues: [{ level: "error", message: `${file}: invalid YAML` }],
        };
    }
}

export async function checkProject(projectDir: string): Promise<CheckResult> {
    const issues: ValidationIssue[] = [];

    // Check required files
    for (const file of REQUIRED_FILES) {
        if (!(await fileExists(join(projectDir, file)))) {
            issues.push({ level: "error", message: `Missing required file: ${file}` });
        }
    }

    // Check required directories
    for (const dir of REQUIRED_DIRS) {
        if (!(await dirExists(join(projectDir, dir)))) {
            issues.push({ level: "error", message: `Missing required directory: ${dir}/` });
        }
    }

    // Validate config.yaml
    if (await fileExists(join(projectDir, "config.yaml"))) {
        const raw = await readFile(join(projectDir, "config.yaml"), "utf-8");
        const { data, issues: parseIssues } = tryParseYaml(raw, "config.yaml");
        issues.push(...parseIssues);
        if (data) {
            issues.push(...validateData(data, configSchema, "config.yaml"));

            // Validate theme exists
            const themeName = (data.theme as string) || "default";
            const themes = await listThemes(projectDir);
            const themeNames = themes.map((t) => t.name.toLowerCase());
            if (!themeNames.includes(themeName.toLowerCase())) {
                issues.push({
                    level: "error",
                    message: `config.yaml: theme "${themeName}" not found — available: ${themes.map((t) => t.name).join(", ")}`,
                });
            }
        }
    }

    // Validate style.yaml
    if (await fileExists(join(projectDir, "style.yaml"))) {
        const raw = await readFile(join(projectDir, "style.yaml"), "utf-8");
        const { data, issues: parseIssues } = tryParseYaml(raw, "style.yaml");
        issues.push(...parseIssues);
        if (data) {
            issues.push(...validateData(data, styleSchema, "style.yaml"));
        }
    }

    // Validate timeline.yaml
    if (await fileExists(join(projectDir, "timeline.yaml"))) {
        const raw = await readFile(join(projectDir, "timeline.yaml"), "utf-8");
        const { data, issues: parseIssues } = tryParseYaml(raw, "timeline.yaml");
        issues.push(...parseIssues);
        if (data) {
            issues.push(...validateData(data, timelineSchema, "timeline.yaml"));
        }
    }

    // Validate frontmatter in md files
    for (const [folder, schema] of Object.entries(FRONTMATTER_SCHEMAS)) {
        const dir = join(projectDir, folder);
        const files = await getMdFiles(dir);

        if (files.length === 0 && folder === "manuscript") {
            issues.push({ level: "warning", message: "manuscript/ is empty — no chapters yet" });
        }

        for (const file of files) {
            const content = await readFile(join(dir, file), "utf-8");
            const filePath = `${folder}/${file}`;

            // Check frontmatter exists
            const fmMatch = content.match(/^---\n([\s\S]*?)\n---/);
            if (!fmMatch) {
                issues.push({ level: "warning", message: `${filePath}: missing frontmatter` });
                continue;
            }

            // Parse frontmatter YAML
            const { data, issues: parseIssues } = tryParseYaml(fmMatch[1], filePath);
            issues.push(
                ...parseIssues.map((i) => ({
                    ...i,
                    message: i.message.replace(filePath, `${filePath} frontmatter`),
                })),
            );

            if (data) {
                issues.push(...validateData(data, schema, filePath));
            }
        }
    }

    // Check manuscript naming convention (NN-slug.md)
    const manuscriptFiles = await getMdFiles(join(projectDir, "manuscript"));
    for (const file of manuscriptFiles) {
        if (!/^\d{2,}-.+\.md$/.test(file)) {
            issues.push({
                level: "warning",
                message: `manuscript/${file}: doesn't follow naming convention NN-slug.md`,
            });
        }
    }

    // Check outline/chapters naming convention (NN.md)
    const outlineChapterFiles = await getMdFiles(join(projectDir, "outline", "chapters"));
    for (const file of outlineChapterFiles) {
        if (!/^\d{2,}\.md$/.test(file)) {
            issues.push({
                level: "warning",
                message: `outline/chapters/${file}: doesn't follow naming convention NN.md`,
            });
        }
    }

    // Check outline/plot.md exists
    if (!(await fileExists(join(projectDir, "outline", "plot.md")))) {
        issues.push({ level: "warning", message: "outline/plot.md is missing" });
    }

    // Split into errors and warnings
    return {
        errors: issues.filter((i) => i.level === "error").map((i) => i.message),
        warnings: issues.filter((i) => i.level === "warning").map((i) => i.message),
    };
}

export async function printCheckResults({ warnings, errors }: CheckResult): Promise<void> {
    const { c, icon } = await import("../lib/ui.js");

    for (const error of errors) {
        console.log(`  ${icon.error} ${c.red(error)}`);
    }
    for (const warning of warnings) {
        console.log(`  ${icon.warn}  ${c.yellow(warning)}`);
    }

    if (errors.length === 0 && warnings.length === 0) {
        console.log(`  ${icon.check} ${c.green("All good! No issues found.")}\n`);
    } else {
        console.log(
            `\n  ${c.bold(`${errors.length} error(s), ${warnings.length} warning(s)`)}\n`,
        );
    }
}

export const checkCommand = new Command("check")
    .description("Validate project structure and frontmatter")
    .action(async () => {
        const { c, icon } = await import("../lib/ui.js");
        const projectDir = process.cwd();

        if (!(await fileExists(join(projectDir, "config.yaml")))) {
            console.error(
                `\n${icon.error} ${c.red("No config.yaml found. Are you inside a writekit project?")}\n`,
            );
            process.exit(1);
        }

        console.log(`\n${icon.quill} ${c.bold("Checking project...")}\n`);

        const result = await checkProject(projectDir);
        await printCheckResults(result);

        if (result.errors.length > 0) {
            process.exit(1);
        }
    });
