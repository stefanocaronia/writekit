import { createHash } from "node:crypto";
import { readFile, readdir, mkdir, writeFile, cp, copyFile } from "node:fs/promises";
import { join, relative, dirname, extname } from "node:path";
import { stringify } from "yaml";
import { parseFrontmatter, type BookConfig } from "./parse.js";
import { type ProjectType } from "./project-type.js";
import { frontmatter as fmFormat, fileExists, dirExists } from "../support/fs-utils.js";

// ---------------------------------------------------------------------------
// Data structures
// ---------------------------------------------------------------------------

export interface TranslationConfig {
    source_project: string;
    source_language: string;
    target_language: string;
    created_at: string;
}

export interface GlossaryEntry {
    source: string;
    translation: string;
    notes: string;
    aliases?: string[];
    role?: string;
    context?: string;
}

export interface TranslationGlossary {
    characters: GlossaryEntry[];
    locations: GlossaryEntry[];
    concepts: GlossaryEntry[];
    people: GlossaryEntry[];
    titles: GlossaryEntry[];
}

// ---------------------------------------------------------------------------
// Translation config
// ---------------------------------------------------------------------------

export function buildTranslationConfig(
    sourceDir: string,
    targetDir: string,
    sourceLang: string,
    targetLang: string,
): TranslationConfig {
    const rel = relative(targetDir, sourceDir).replace(/\\/g, "/");
    return {
        source_project: rel.endsWith("/") ? rel : rel + "/",
        source_language: sourceLang,
        target_language: targetLang,
        created_at: new Date().toISOString(),
    };
}

// ---------------------------------------------------------------------------
// Glossary extraction
// ---------------------------------------------------------------------------

async function extractFrontmatterField(
    dir: string,
    field: string,
    aliasField?: string,
): Promise<GlossaryEntry[]> {
    if (!(await dirExists(dir))) return [];
    const files = await readdir(dir);
    const entries: GlossaryEntry[] = [];

    for (const file of files.filter((f) => extname(f) === ".md").sort()) {
        const content = await readFile(join(dir, file), "utf-8");
        const { data } = parseFrontmatter(content);
        const value = data[field] as string | undefined;
        if (!value) continue;
        const entry: GlossaryEntry = { source: value, translation: "", notes: "" };
        if (aliasField && Array.isArray(data[aliasField]) && data[aliasField].length > 0) {
            entry.aliases = data[aliasField] as string[];
        }
        entries.push(entry);
    }
    return entries;
}

export async function extractGlossary(
    sourceDir: string,
    config: BookConfig,
    typeDef: ProjectType,
): Promise<TranslationGlossary> {
    const glossary: TranslationGlossary = {
        characters: [],
        locations: [],
        concepts: [],
        people: [],
        titles: [],
    };

    // Characters (name + aliases)
    if (typeDef.dirs.includes("characters")) {
        glossary.characters = await extractFrontmatterField(
            join(sourceDir, "characters"), "name", "aliases",
        );
    }

    // Locations (world directory, name field)
    if (typeDef.dirs.includes("world")) {
        glossary.locations = await extractFrontmatterField(
            join(sourceDir, "world"), "name",
        );
    }

    // Concepts (term field)
    if (typeDef.dirs.includes("concepts")) {
        glossary.concepts = await extractFrontmatterField(
            join(sourceDir, "concepts"), "term",
        );
    }

    // People — from contributors + config
    const peopleMap = new Map<string, GlossaryEntry>();

    // Contributors
    if (await dirExists(join(sourceDir, "contributors"))) {
        const contribEntries = await extractFrontmatterField(
            join(sourceDir, "contributors"), "name",
        );
        for (const entry of contribEntries) {
            peopleMap.set(entry.source, entry);
        }
    }

    // Config: author(s), translator, editor, illustrator
    const authors = Array.isArray(config.author) ? config.author : config.author ? [config.author] : [];
    for (const name of authors) {
        if (name && !peopleMap.has(name)) {
            peopleMap.set(name, { source: name, role: "author", translation: "", notes: "" });
        }
    }
    for (const [field, role] of [["translator", "translator"], ["editor", "editor"], ["illustrator", "illustrator"]] as const) {
        const val = config[field] as string | undefined;
        if (val && !peopleMap.has(val)) {
            peopleMap.set(val, { source: val, role, translation: "", notes: "" });
        }
    }
    glossary.people = [...peopleMap.values()];

    // Titles
    if (config.title) {
        glossary.titles.push({ source: config.title, context: "title", translation: "", notes: "" });
    }
    if (config.subtitle) {
        glossary.titles.push({ source: config.subtitle, context: "subtitle", translation: "", notes: "" });
    }
    if (config.series) {
        glossary.titles.push({ source: config.series, context: "series", translation: "", notes: "" });
    }

    return glossary;
}

export function serializeGlossary(glossary: TranslationGlossary): string {
    const header = "# Translation glossary — proper names and terms extracted from source project.\n"
        + "# Fill in the \"translation\" field for each entry before translating.\n\n";

    // Filter out empty sections
    const data: Record<string, GlossaryEntry[]> = {};
    for (const [key, entries] of Object.entries(glossary)) {
        if (entries.length > 0) data[key] = entries;
    }

    if (Object.keys(data).length === 0) {
        return header + "# No proper names or terms found in the source project.\n";
    }

    return header + stringify(data);
}

// ---------------------------------------------------------------------------
// Manuscript scaffolding
// ---------------------------------------------------------------------------

function hashContent(content: string): string {
    return createHash("sha1").update(content).digest("hex");
}

export async function scaffoldManuscript(
    sourceDir: string,
    targetDir: string,
): Promise<string[]> {
    const sourceMs = join(sourceDir, "manuscript");
    if (!(await dirExists(sourceMs))) return [];

    const created: string[] = [];
    await walkManuscript(sourceMs, sourceDir, targetDir, created);
    return created;
}

async function walkManuscript(
    dir: string,
    sourceDir: string,
    targetDir: string,
    created: string[],
): Promise<void> {
    const entries = await readdir(dir, { withFileTypes: true });

    for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
        const sourcePath = join(dir, entry.name);
        const relPath = relative(sourceDir, sourcePath).replace(/\\/g, "/");
        const targetPath = join(targetDir, relPath);

        if (entry.isDirectory()) {
            // Part directory — recurse
            await mkdir(targetPath, { recursive: true });

            // Copy part.yaml if it exists
            const partYaml = join(sourcePath, "part.yaml");
            if (await fileExists(partYaml)) {
                await copyFile(partYaml, join(targetPath, "part.yaml"));
                created.push(relPath + "/part.yaml");
            }

            await walkManuscript(sourcePath, sourceDir, targetDir, created);
        } else if (extname(entry.name) === ".md") {
            const content = await readFile(sourcePath, "utf-8");
            const { data } = parseFrontmatter(content);

            // Add translation metadata
            data.source_path = relPath;
            data.source_hash = hashContent(content);

            // Write with empty body
            await mkdir(dirname(targetPath), { recursive: true });
            await writeFile(targetPath, fmFormat(data, "\n"));
            created.push(relPath);
        }
    }
}

// ---------------------------------------------------------------------------
// Context directories
// ---------------------------------------------------------------------------

const CONTEXT_DIRS = ["outline", "outline/chapters", "characters", "world", "arguments", "concepts"];

export function getContextDirs(typeDef: ProjectType): string[] {
    return CONTEXT_DIRS.filter((d) => typeDef.dirs.includes(d));
}

// ---------------------------------------------------------------------------
// AGENTS.md for translation projects
// ---------------------------------------------------------------------------

export function buildTranslationAgentsMd(tc: TranslationConfig): string {
    return `<!-- writekit:start — DO NOT REMOVE THIS SECTION -->
Read \`node_modules/writekit/agents/instructions.md\` before working on this project.
<!-- writekit:end -->

## Translation Project

This is a **translation project** created by \`wk translate init\`.

- Source project: \`${tc.source_project}\`
- Source language: ${tc.source_language}
- Target language: ${tc.target_language}

### Translation workflow

1. Read \`translation-glossary.yaml\` — fill in translations for all proper names and terms before starting.
2. For each file in \`manuscript/\`:
   - The \`source_path\` in frontmatter points to the original file in the source project.
   - Read the source file for context, then write the translation in the target file body.
   - Do NOT modify \`source_path\` or \`source_hash\` fields.
3. Translate chapter titles in the frontmatter.
4. Run \`wk check\` to validate the translated project.
5. Run \`wk build\` to generate output in the target language.

### Rules

- Do NOT modify \`translation.yaml\` or \`source_hash\` values.
- Do NOT add or remove manuscript files — structure mirrors the source.
- Do NOT translate proper names without consulting \`translation-glossary.yaml\`.
- Preserve all markdown formatting, footnotes, and image references.
`;
}

// ---------------------------------------------------------------------------
// Translation README
// ---------------------------------------------------------------------------

export function buildTranslationReadme(
    config: BookConfig,
    targetLang: string,
): string {
    const authors = Array.isArray(config.author) ? config.author.join(", ") : config.author;
    return `# ${config.title} — ${targetLang.toUpperCase()} Translation

Translation of *${config.title}* by ${authors}.

This is a [writekit](https://github.com/stefanocaronia/writekit) translation project created with \`wk translate init\`.

## Quick start

\`\`\`bash
wk check        # Validate project
wk build html   # Build translated output
\`\`\`

## Files

| File | Purpose |
|---|---|
| \`translation.yaml\` | Source/target project link |
| \`translation-glossary.yaml\` | Proper names and terms mapping |
| \`manuscript/\` | Translated chapters (fill in the empty bodies) |
| \`config.yaml\` | Project metadata (language set to ${targetLang}) |
`;
}
