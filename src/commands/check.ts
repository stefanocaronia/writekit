import { Command } from "commander";
import { readdir, readFile } from "node:fs/promises";
import { join, extname } from "node:path";
import { fileExists, dirExists } from "../lib/fs-utils.js";
import { parse as parseYaml, YAMLParseError } from "yaml";
import { listThemes } from "../lib/theme.js";
import { supportedLanguages } from "../lib/i18n.js";
import { loadType, isValidType, allTypeNames, type FrontmatterSchema } from "../lib/project-type.js";
import {
    validateData,
    configSchema,
    styleSchema,
    timelineSchema,
    type ValidationIssue,
} from "../lib/schema.js";

interface CheckResult {
    warnings: string[];
    errors: string[];
}

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

function validateFrontmatter(
    data: Record<string, unknown>,
    schema: FrontmatterSchema,
    filePath: string,
): ValidationIssue[] {
    const issues: ValidationIssue[] = [];

    for (const field of schema.required) {
        if (!(field in data)) {
            issues.push({
                level: "warning",
                message: `${filePath}: missing required field "${field}"`,
            });
        }
    }

    // Warn about unknown fields
    const knownFields = new Set([...schema.required, ...schema.optional]);
    for (const key of Object.keys(data)) {
        if (!knownFields.has(key)) {
            issues.push({
                level: "warning",
                message: `${filePath}: unknown field "${key}"`,
            });
        }
    }

    return issues;
}

export async function checkProject(projectDir: string): Promise<CheckResult> {
    // Sync derived fields first to resolve stale data
    try {
        const { syncProject } = await import("./sync.js");
        await syncProject(projectDir);
    } catch { /* sync failure shouldn't block check */ }

    const issues: ValidationIssue[] = [];

    // Read config to determine project type
    let projectTypeName = "novel";
    if (await fileExists(join(projectDir, "config.yaml"))) {
        try {
            const raw = await readFile(join(projectDir, "config.yaml"), "utf-8");
            const cfg = parseYaml(raw) as Record<string, unknown>;
            if (cfg.type && typeof cfg.type === "string") {
                if (isValidType(cfg.type)) {
                    projectTypeName = cfg.type;
                } else {
                    issues.push({
                        level: "error",
                        message: `config.yaml: unknown type "${cfg.type}" — valid types: ${allTypeNames().join(", ")}`,
                    });
                }
            }
        } catch { /* will be caught by config validation below */ }
    }

    const typeDef = await loadType(projectTypeName);

    // Check required files (config.yaml always + type-specific files)
    const requiredFiles = ["config.yaml", ...typeDef.files];
    for (const file of requiredFiles) {
        if (!(await fileExists(join(projectDir, file)))) {
            issues.push({ level: "error", message: `Missing required file: ${file}` });
        }
    }

    // Check required directories
    for (const dir of typeDef.dirs) {
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

            // Validate language is supported
            const lang = data.language as string;
            if (lang && !supportedLanguages.includes(lang)) {
                issues.push({
                    level: "warning",
                    message: `config.yaml: language "${lang}" is not supported for editorial labels — supported: ${supportedLanguages.join(", ")}. English will be used as fallback.`,
                });
            }

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

    // Validate style.yaml (if type requires it)
    if (typeDef.files.includes("style.yaml") && await fileExists(join(projectDir, "style.yaml"))) {
        const raw = await readFile(join(projectDir, "style.yaml"), "utf-8");
        const { data, issues: parseIssues } = tryParseYaml(raw, "style.yaml");
        issues.push(...parseIssues);
        if (data) {
            issues.push(...validateData(data, styleSchema, "style.yaml"));
        }
    }

    // Validate timeline.yaml (if type requires it)
    if (typeDef.files.includes("timeline.yaml") && await fileExists(join(projectDir, "timeline.yaml"))) {
        const raw = await readFile(join(projectDir, "timeline.yaml"), "utf-8");
        const { data, issues: parseIssues } = tryParseYaml(raw, "timeline.yaml");
        issues.push(...parseIssues);
        if (data) {
            issues.push(...validateData(data, timelineSchema, "timeline.yaml"));
        }
    }

    // Validate frontmatter using type-defined schemas
    for (const [folder, schema] of Object.entries(typeDef.schemas)) {
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
                issues.push(...validateFrontmatter(data, schema, filePath));
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

    // Check outline/chapters naming convention (NN.md) — only if type has it
    if (typeDef.dirs.includes("outline/chapters")) {
        const outlineChapterFiles = await getMdFiles(join(projectDir, "outline", "chapters"));
        for (const file of outlineChapterFiles) {
            if (!/^\d{2,}\.md$/.test(file)) {
                issues.push({
                    level: "warning",
                    message: `outline/chapters/${file}: doesn't follow naming convention NN.md`,
                });
            }
        }
    }

    // Cross-validate per-chapter authors against global authors
    if (await fileExists(join(projectDir, "config.yaml"))) {
        try {
            const raw = await readFile(join(projectDir, "config.yaml"), "utf-8");
            const cfg = parseYaml(raw) as Record<string, unknown>;
            const globalAuthor = cfg.author;
            const globalAuthors = new Set(
                (Array.isArray(globalAuthor) ? globalAuthor : globalAuthor ? [globalAuthor] : [])
                    .map((a: string) => a.toLowerCase()),
            );

            if (globalAuthors.size > 0) {
                const manuscriptDir = join(projectDir, "manuscript");
                const msFiles = await getMdFiles(manuscriptDir);
                for (const file of msFiles) {
                    const content = await readFile(join(manuscriptDir, file), "utf-8");
                    const fmMatch = content.match(/^---\n([\s\S]*?)\n---/);
                    if (fmMatch) {
                        const { data } = tryParseYaml(fmMatch[1], `manuscript/${file}`);
                        if (data?.author && typeof data.author === "string" && data.author) {
                            if (!globalAuthors.has(data.author.toLowerCase())) {
                                issues.push({
                                    level: "warning",
                                    message: `manuscript/${file}: author "${data.author}" is not in config.yaml authors`,
                                });
                            }
                        }
                    }
                }
            }
        } catch { /* config already validated above */ }
    }

    // Cross-validate contributors ↔ config
    const contribDir = join(projectDir, "contributors");
    if (await dirExists(contribDir)) {
        try {
            const raw = await readFile(join(projectDir, "config.yaml"), "utf-8");
            const cfg = parseYaml(raw) as Record<string, unknown>;

            // Gather all names from config contributor fields
            const configNames = new Set<string>();
            for (const field of ["author", "translator", "editor", "illustrator"]) {
                const value = cfg[field];
                const names: string[] = Array.isArray(value)
                    ? value
                    : typeof value === "string" && value
                        ? [value]
                        : [];
                for (const n of names) configNames.add(n.toLowerCase());
            }

            // Gather all names from contributor sheets
            const contribFiles = await getMdFiles(contribDir);
            const sheetNames = new Set<string>();
            for (const file of contribFiles) {
                const content = await readFile(join(contribDir, file), "utf-8");
                const fmMatch = content.match(/^---\n([\s\S]*?)\n---/);
                if (fmMatch) {
                    const { data } = tryParseYaml(fmMatch[1], `contributors/${file}`);
                    if (data?.name && typeof data.name === "string") {
                        sheetNames.add(data.name.toLowerCase());
                    }
                }
            }

            // Config name without sheet
            for (const name of configNames) {
                if (!sheetNames.has(name)) {
                    issues.push({
                        level: "warning",
                        message: `"${name}" is in config.yaml but has no sheet in contributors/`,
                    });
                }
            }

            // Sheet without config name
            for (const file of contribFiles) {
                const content = await readFile(join(contribDir, file), "utf-8");
                const fmMatch = content.match(/^---\n([\s\S]*?)\n---/);
                if (fmMatch) {
                    const { data } = tryParseYaml(fmMatch[1], `contributors/${file}`);
                    if (data?.name && typeof data.name === "string") {
                        if (!configNames.has(data.name.toLowerCase())) {
                            issues.push({
                                level: "warning",
                                message: `contributors/${file}: "${data.name}" has no role in config.yaml`,
                            });
                        }
                    }
                }
            }
        } catch { /* config already validated above */ }
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
