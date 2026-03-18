import { readFile, readdir } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { parse as parseYaml } from "yaml";

const __dirname = dirname(fileURLToPath(import.meta.url));
const TYPES_DIR = join(__dirname, "..", "types");

export interface SampleFile {
    frontmatter?: Record<string, unknown>;
    body: string;
}

export interface FrontmatterSchema {
    required: string[];
    optional: string[];
}

export type Section = "cover" | "title_page" | "title_block" | "abstract" | "toc" | "content" | "backcover" | "about" | "colophon" | "bibliography";

export interface TypeFeatures {
    show_chapter_author: boolean;  // show per-chapter author in TOC and headings (collection)
    supports_parts: boolean;       // allow manuscript/part-NN/ directories
}

const DEFAULT_FEATURES: TypeFeatures = {
    show_chapter_author: false,
    supports_parts: true,
};

export interface ProjectType {
    name: string;
    description: string;
    sections: Section[];
    features: TypeFeatures;
    dirs: string[];
    files: string[];
    add_commands: string[];
    reports: string[];
    schemas: Record<string, FrontmatterSchema>;
    sample_files: Record<string, SampleFile>;
}

export function hasSection(typeDef: ProjectType, section: Section): boolean {
    return typeDef.sections.includes(section);
}

const ALL_TYPES = ["novel", "collection", "essay", "paper"] as const;
export type TypeName = (typeof ALL_TYPES)[number];

export function isValidType(name: string): name is TypeName {
    return ALL_TYPES.includes(name as TypeName);
}

export function allTypeNames(): readonly string[] {
    return ALL_TYPES;
}

export async function loadType(name: string): Promise<ProjectType> {
    if (!isValidType(name)) {
        throw new Error(`Unknown project type: "${name}". Valid types: ${ALL_TYPES.join(", ")}`);
    }

    const raw = await readFile(join(TYPES_DIR, name, "type.yaml"), "utf-8");
    const parsed = parseYaml(raw) as ProjectType;
    // Merge features with defaults so type.yaml only needs to declare non-default values
    parsed.features = { ...DEFAULT_FEATURES, ...(parsed.features ?? {}) };
    return parsed;
}

// Commands that operate on YAML entries, not individual files — not removable
const YAML_ONLY_COMMANDS = new Set(["event", "source"]);

export function getRemoveCommands(typeDef: ProjectType): string[] {
    return typeDef.add_commands.filter((cmd) => !YAML_ONLY_COMMANDS.has(cmd));
}

export async function listTypes(): Promise<{ name: string; description: string }[]> {
    const result: { name: string; description: string }[] = [];

    for (const typeName of ALL_TYPES) {
        const type = await loadType(typeName);
        result.push({ name: typeName, description: type.description });
    }

    return result;
}
