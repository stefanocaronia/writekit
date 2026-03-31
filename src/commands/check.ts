import { Command } from "commander";
import { readdir, readFile, stat } from "node:fs/promises";
import { join, extname } from "node:path";
import { fileExists, dirExists } from "../support/fs-utils.js";
import { SECTION_FILE_MAP, loadChapters, parseFrontmatter, type BookConfig } from "../project/parse.js";
import { parse as parseYaml, YAMLParseError } from "yaml";
import { listThemes } from "../support/theme.js";
import { supportedLanguages } from "../support/i18n.js";
import { loadType, hasType, allTypeNames, type FrontmatterSchema } from "../project/project-type.js";
import { loadTypePlugin, typeOptions as resolveTypeOptions } from "../project/type-plugin.js";
import {
    validateData,
    configSchema,
    styleSchema,
    timelineSchema,
    type ValidationIssue,
} from "../project/schema.js";
import { resolveFormatPlugin } from "../formats/format-registry.js";

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

function normalizedRef(value: string): string {
    return value.trim().toLowerCase();
}

async function collectFrontmatterStrings(
    projectDir: string,
    folder: string,
    field: string,
): Promise<Set<string>> {
    const values = new Set<string>();
    const dir = join(projectDir, folder);
    const files = await getMdFiles(dir);

    for (const file of files) {
        const content = await readFile(join(dir, file), "utf-8");
        const { data } = parseFrontmatter(content);
        const value = data[field];
        if (typeof value === "string" && value.trim()) {
            values.add(normalizedRef(value));
        }
    }

    return values;
}

function stringValues(value: unknown): string[] {
    if (typeof value === "string" && value.trim()) {
        return [value.trim()];
    }
    if (!Array.isArray(value)) {
        return [];
    }

    return value
        .filter((entry): entry is string => typeof entry === "string" && entry.trim().length > 0)
        .map((entry) => entry.trim());
}

function relationshipTargets(value: unknown): string[] {
    if (!Array.isArray(value)) {
        return [];
    }

    const targets: string[] = [];
    for (const entry of value) {
        if (typeof entry === "string" && entry.trim()) {
            targets.push(entry.trim());
            continue;
        }
        if (!isPlainObject(entry)) continue;

        for (const key of ["character", "name", "target"]) {
            const target = entry[key];
            if (typeof target === "string" && target.trim()) {
                targets.push(target.trim());
                break;
            }
        }
    }

    return targets;
}

function pushMissingReferenceWarning(
    issues: ValidationIssue[],
    filePath: string,
    label: string,
    value: string,
    destination: string,
): void {
    issues.push({
        level: "warning",
        message: `${filePath}: ${label} "${value}" not found in ${destination}`,
    });
}

function chapterRef(value: unknown): number | null {
    if (typeof value === "number" && Number.isInteger(value) && value > 0) {
        return value;
    }
    if (typeof value === "string" && /^\d+$/.test(value.trim())) {
        return Number.parseInt(value.trim(), 10);
    }
    return null;
}

async function validateCrossReferences(
    projectDir: string,
    typeName: string,
    issues: ValidationIssue[],
): Promise<void> {
    const characterNames = await collectFrontmatterStrings(projectDir, "characters", "name");
    const worldNames = await collectFrontmatterStrings(projectDir, "world", "name");
    const conceptTerms = await collectFrontmatterStrings(projectDir, "concepts", "term");
    const argumentClaims = await collectFrontmatterStrings(projectDir, "arguments", "claim");

    const referenceCatalog = new Set<string>([...conceptTerms, ...argumentClaims]);

    if (typeName === "novel") {
        const manuscriptDir = join(projectDir, "manuscript");
        const manuscriptFiles = await getMdFiles(manuscriptDir);
        for (const file of manuscriptFiles) {
            if (file in SECTION_FILE_MAP) continue;
            const content = await readFile(join(manuscriptDir, file), "utf-8");
            const { data } = parseFrontmatter(content);
            const filePath = `manuscript/${file}`;

            if (typeof data.pov === "string" && data.pov.trim() && !characterNames.has(normalizedRef(data.pov))) {
                pushMissingReferenceWarning(issues, filePath, "pov", data.pov, "characters/");
            }
        }

        const outlineDir = join(projectDir, "outline", "chapters");
        const outlineFiles = await getMdFiles(outlineDir);
        for (const file of outlineFiles) {
            const content = await readFile(join(outlineDir, file), "utf-8");
            const { data } = parseFrontmatter(content);
            const filePath = `outline/chapters/${file}`;

            if (typeof data.pov === "string" && data.pov.trim() && !characterNames.has(normalizedRef(data.pov))) {
                pushMissingReferenceWarning(issues, filePath, "pov", data.pov, "characters/");
            }

            for (const character of stringValues(data.characters)) {
                if (!characterNames.has(normalizedRef(character))) {
                    pushMissingReferenceWarning(issues, filePath, "character", character, "characters/");
                }
            }

            if (typeof data.location === "string" && data.location.trim() && !worldNames.has(normalizedRef(data.location))) {
                pushMissingReferenceWarning(issues, filePath, "location", data.location, "world/");
            }
        }

        const characterDir = join(projectDir, "characters");
        const characterFiles = await getMdFiles(characterDir);
        for (const file of characterFiles) {
            const content = await readFile(join(characterDir, file), "utf-8");
            const { data } = parseFrontmatter(content);
            const filePath = `characters/${file}`;

            for (const target of relationshipTargets(data.relationships)) {
                if (!characterNames.has(normalizedRef(target))) {
                    pushMissingReferenceWarning(issues, filePath, "relationship target", target, "characters/");
                }
            }
        }
    }

    for (const folder of ["concepts", "arguments"]) {
        const dir = join(projectDir, folder);
        const files = await getMdFiles(dir);
        for (const file of files) {
            const content = await readFile(join(dir, file), "utf-8");
            const { data } = parseFrontmatter(content);
            const filePath = `${folder}/${file}`;

            for (const related of stringValues(data.related)) {
                if (!referenceCatalog.has(normalizedRef(related))) {
                    pushMissingReferenceWarning(issues, filePath, "related reference", related, "concepts/ or arguments/");
                }
            }
        }
    }
}

async function validateDraftTracking(
    projectDir: string,
    issues: ValidationIssue[],
): Promise<void> {
    const chapters = (await loadChapters(projectDir))
        .filter((chapter) => !chapter.sectionKind && chapter.number > 0);

    if (chapters.length === 0) return;

    let draftTrackingEnabled = false;

    for (const chapter of chapters) {
        if (chapter.draft === undefined) continue;
        draftTrackingEnabled = true;

        if (!Number.isInteger(chapter.draft) || chapter.draft < 1) {
            issues.push({
                level: "warning",
                message: `manuscript/${chapter.filename}: draft should be a positive integer`,
            });
        }
    }

    if (!draftTrackingEnabled) return;

    for (const chapter of chapters) {
        if (chapter.draft !== undefined) continue;
        issues.push({
            level: "warning",
            message: `manuscript/${chapter.filename}: missing draft while draft tracking is enabled in other chapters`,
        });
    }
}

async function validateTimelineTracking(
    projectDir: string,
    issues: ValidationIssue[],
): Promise<void> {
    const timelinePath = join(projectDir, "timeline.yaml");
    if (!(await fileExists(timelinePath))) return;

    const raw = await readFile(timelinePath, "utf-8");
    const parsed = parseYaml(raw) as { events?: unknown[] } | null;
    const events = Array.isArray(parsed?.events) ? parsed.events : [];
    if (events.length === 0) return;

    const chapterNumbers = new Set(
        (await loadChapters(projectDir))
            .filter((chapter) => !chapter.sectionKind && chapter.number > 0)
            .map((chapter) => chapter.number),
    );

    let previousChapter: number | null = null;

    for (let index = 0; index < events.length; index++) {
        const event = events[index];
        if (!isPlainObject(event)) continue;

        const rawChapter = event.chapter;
        if (rawChapter === undefined || rawChapter === null || rawChapter === "") continue;

        const filePath = `timeline.yaml: event ${index + 1}`;
        const currentChapter = chapterRef(rawChapter);

        if (currentChapter === null) {
            issues.push({
                level: "warning",
                message: `${filePath} chapter "${String(rawChapter)}" is not a valid chapter number`,
            });
            continue;
        }

        if (!chapterNumbers.has(currentChapter)) {
            issues.push({
                level: "warning",
                message: `${filePath} refers to missing chapter ${currentChapter}`,
            });
            continue;
        }

        if (previousChapter !== null && currentChapter < previousChapter) {
            const label = typeof event.description === "string" && event.description.trim()
                ? `"${event.description.trim()}"`
                : `event ${index + 1}`;
            issues.push({
                level: "warning",
                message: `${filePath} (${label}) points back to chapter ${currentChapter} after chapter ${previousChapter} — timeline chronology diverges from chapter order`,
            });
        }

        previousChapter = currentChapter;
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

function validateLayoutOverrides(data: unknown): ValidationIssue[] {
    const issues: ValidationIssue[] = [];

    if (data === undefined) return issues;

    if (!data || typeof data !== "object" || Array.isArray(data)) {
        return [{ level: "error", message: 'config.yaml: layout should be an object' }];
    }

    const layout = data as Record<string, unknown>;
    const allowedKeys = new Set(["page_numbers", "running_header", "recto_start", "margin"]);
    for (const key of Object.keys(layout)) {
        if (!allowedKeys.has(key)) {
            issues.push({
                level: "warning",
                message: `config.yaml: layout.${key} is unknown`,
            });
        }
    }

    for (const key of ["page_numbers", "running_header", "recto_start"]) {
        const value = layout[key];
        if (value !== undefined && typeof value !== "boolean") {
            issues.push({
                level: "error",
                message: `config.yaml: layout.${key} should be boolean`,
            });
        }
    }

    if (layout.margin !== undefined) {
        if (!layout.margin || typeof layout.margin !== "object" || Array.isArray(layout.margin)) {
            issues.push({
                level: "error",
                message: "config.yaml: layout.margin should be an object",
            });
        } else {
            const margin = layout.margin as Record<string, unknown>;
            const allowedMarginKeys = new Set(["inner", "outer"]);
            for (const key of Object.keys(margin)) {
                if (!allowedMarginKeys.has(key)) {
                    issues.push({
                        level: "warning",
                        message: `config.yaml: layout.margin.${key} is unknown`,
                    });
                }
            }

            for (const key of ["inner", "outer"]) {
                const value = margin[key];
                if (value !== undefined) {
                    if (typeof value !== "number" || !Number.isFinite(value)) {
                        issues.push({
                            level: "error",
                            message: `config.yaml: layout.margin.${key} should be a number`,
                        });
                    } else if (value <= 0) {
                        issues.push({
                            level: "error",
                            message: `config.yaml: layout.margin.${key} should be greater than 0`,
                        });
                    }
                }
            }
        }
    }

    return issues;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
    return value !== null && typeof value === "object" && !Array.isArray(value);
}

function validateTypeOptions(data: unknown): ValidationIssue[] {
    if (data === undefined) return [];
    if (!isPlainObject(data)) {
        return [{ level: "error", message: "config.yaml: type_options should be an object" }];
    }
    return [];
}

function validateFormatOptions(data: unknown): ValidationIssue[] {
    if (data === undefined) return [];
    if (!isPlainObject(data)) {
        return [{ level: "error", message: "config.yaml: format_options should be an object" }];
    }

    const issues: ValidationIssue[] = [];
    for (const [formatName, options] of Object.entries(data)) {
        if (!isPlainObject(options)) {
            issues.push({
                level: "error",
                message: `config.yaml: format_options.${formatName} should be an object`,
            });
        }
    }
    return issues;
}

export async function checkProject(projectDir: string): Promise<CheckResult> {
    const issues: ValidationIssue[] = [];

    // Read config to determine project type
    let projectTypeName = "novel";
    if (await fileExists(join(projectDir, "config.yaml"))) {
        try {
            const raw = await readFile(join(projectDir, "config.yaml"), "utf-8");
            const cfg = parseYaml(raw) as Record<string, unknown>;
            if (cfg.type && typeof cfg.type === "string") {
                if (await hasType(cfg.type, projectDir)) {
                    projectTypeName = cfg.type;
                } else {
                    const validTypes = await allTypeNames(projectDir);
                    issues.push({
                        level: "error",
                        message: `config.yaml: unknown type "${cfg.type}" — valid types: ${validTypes.join(", ")}`,
                    });
                }
            }
        } catch { /* will be caught by config validation below */ }
    }

    const typeDef = await loadType(projectTypeName, projectDir);
    const typePlugin = await loadTypePlugin(projectTypeName, projectDir);

    // Check required files (config.yaml always + type-specific files)
    // Some files are optional (created by build or user choice)
    const optionalFiles = new Set(["backcover.md", "bibliography.yaml", "thesis.md", "abstract.md"]);
    const requiredFiles = ["config.yaml", ...typeDef.files.filter((f) => !optionalFiles.has(f))];
    for (const file of requiredFiles) {
        if (!(await fileExists(join(projectDir, file)))) {
            issues.push({ level: "error", message: `Missing required file: ${file}` });
        }
    }
    // Warn (not error) for optional files
    for (const file of typeDef.files.filter((f) => optionalFiles.has(f))) {
        if (!(await fileExists(join(projectDir, file)))) {
            issues.push({ level: "warning", message: `Optional file missing: ${file}` });
        }
    }

    // Check required directories (build/ and assets/ are created automatically)
    const optionalDirs = new Set(["build", "assets"]);
    for (const dir of typeDef.dirs) {
        if (optionalDirs.has(dir)) continue;
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

            // Validate print preset
            const presetName = data.print_preset as string;
            if (presetName) {
                const { getPreset, presetNames } = await import("../formats/print-presets.js");
                if (!(await getPreset(presetName, projectDir))) {
                    issues.push({
                        level: "error",
                        message: `config.yaml: print_preset "${presetName}" not found — available: ${(await presetNames(projectDir)).join(", ")}`,
                    });
                }
            }

            issues.push(...validateLayoutOverrides(data.layout));
            issues.push(...validateTypeOptions(data.type_options));
            issues.push(...validateFormatOptions(data.format_options));

            if (typePlugin?.configSchema && isPlainObject(data.type_options)) {
                issues.push(...validateData(data.type_options, typePlugin.configSchema, "config.yaml:type_options"));
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

            // Validate build formats
            if (Array.isArray(data.build_formats)) {
                const { allFormatNames, hasFormat } = await import("../formats/format-registry.js");
                const validFormats = await allFormatNames(projectDir);
                for (const entry of data.build_formats) {
                    if (typeof entry !== "string") continue;
                    if (!(await hasFormat(entry, projectDir))) {
                        issues.push({
                            level: "error",
                            message: `config.yaml: build format "${entry}" not found — available: ${validFormats.join(", ")}`,
                        });
                    }
                }
            }

            if (isPlainObject(data.format_options)) {
                for (const [formatName, formatOptions] of Object.entries(data.format_options)) {
                    const plugin = await resolveFormatPlugin(formatName, projectDir);
                    if (!plugin) {
                        issues.push({
                            level: "error",
                            message: `config.yaml: format_options.${formatName} refers to an unknown format`,
                        });
                        continue;
                    }

                    if (plugin.configSchema && isPlainObject(formatOptions)) {
                        issues.push(...validateData(formatOptions, plugin.configSchema, `config.yaml:format_options.${formatName}`));
                    }
                }
            }

            if (typePlugin?.onCheck) {
                const config = data as unknown as BookConfig;
                const pluginIssues = await typePlugin.onCheck({
                    projectDir,
                    typeName: projectTypeName,
                    typeDef,
                    config,
                    typeOptions: resolveTypeOptions(config),
                });
                if (pluginIssues) {
                    issues.push(...pluginIssues);
                }
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
    const sectionFileNames = Object.keys(SECTION_FILE_MAP);
    for (const [folder, schema] of Object.entries(typeDef.schemas)) {
        const dir = join(projectDir, folder);
        const files = await getMdFiles(dir);

        if (files.length === 0 && folder === "manuscript") {
            issues.push({ level: "warning", message: "manuscript/ is empty — no chapters yet" });
        }

        for (const file of files) {
            if (folder === "manuscript" && sectionFileNames.includes(file)) {
                continue;
            }

            const content = await readFile(join(dir, file), "utf-8");
            const filePath = `${folder}/${file}`;

            const { data: frontmatterData, body } = parseFrontmatter(content);
            if (body === content) {
                issues.push({ level: "warning", message: `${filePath}: missing frontmatter` });
                continue;
            }

            if (frontmatterData) {
                issues.push(...validateFrontmatter(frontmatterData, schema, filePath));
            }
        }
    }

    // Check manuscript naming convention (NN-slug.md) and parts
    const manuscriptDir = join(projectDir, "manuscript");
    const manuscriptFiles = await getMdFiles(manuscriptDir);
    let hasParts = false;
    try {
        const entries = await readdir(manuscriptDir);
        for (const e of entries) {
            if (e.startsWith("part-")) {
                const s = await stat(join(manuscriptDir, e));
                if (s.isDirectory()) { hasParts = true; break; }
            }
        }
    } catch { /* empty */ }

    for (const file of manuscriptFiles) {
        // Skip known section files (prologue.md, epilogue.md, etc.)
        if (sectionFileNames.includes(file)) continue;
        if (!/^\d{2,}-.+\.md$/.test(file)) {
            issues.push({
                level: "warning",
                message: `manuscript/${file}: doesn't follow naming convention NN-slug.md`,
            });
        }
        // Warn about loose chapters when parts exist
        if (hasParts && /^\d{2,}-.+\.md$/.test(file)) {
            issues.push({
                level: "warning",
                message: `manuscript/${file}: chapter in root but parts exist — assign to a part`,
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
                    if (sectionFileNames.includes(file)) continue;
                    const content = await readFile(join(manuscriptDir, file), "utf-8");
                    const { data } = parseFrontmatter(content);
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

    await validateCrossReferences(projectDir, projectTypeName, issues);
    await validateDraftTracking(projectDir, issues);
    await validateTimelineTracking(projectDir, issues);

    // Split into errors and warnings
    return {
        errors: issues.filter((i) => i.level === "error").map((i) => i.message),
        warnings: issues.filter((i) => i.level === "warning").map((i) => i.message),
    };
}

export async function printCheckResults({ warnings, errors }: CheckResult): Promise<void> {
    const { c, icon } = await import("../support/ui.js");

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
        const { c, icon } = await import("../support/ui.js");
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
