import { readFile, readdir } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { parse as parseYaml } from "yaml";
import { dirExists, fileExists } from "../support/fs-utils.js";

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
    default_preset?: string;
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

const BUILTIN_TYPES = ["novel", "collection", "essay", "paper"] as const;
export type TypeName = (typeof BUILTIN_TYPES)[number];

export function isValidType(name: string): name is TypeName {
    return BUILTIN_TYPES.includes(name as TypeName);
}

export function builtinTypeNames(): readonly string[] {
    return BUILTIN_TYPES;
}

async function loadTypeFromFile(typeFile: string): Promise<ProjectType> {
    const raw = await readFile(typeFile, "utf-8");
    const parsed = parseYaml(raw) as ProjectType;
    parsed.features = { ...DEFAULT_FEATURES, ...(parsed.features ?? {}) };
    return parsed;
}

function localTypesDir(projectDir: string): string {
    return join(projectDir, "types");
}

async function listLocalTypeNames(projectDir: string): Promise<string[]> {
    const dir = localTypesDir(projectDir);
    if (!(await dirExists(dir))) return [];

    const entries = await readdir(dir, { withFileTypes: true });
    const names: string[] = [];
    for (const entry of entries) {
        if (!entry.isDirectory()) continue;
        if (await fileExists(join(dir, entry.name, "type.yaml"))) {
            names.push(entry.name);
        }
    }
    return names.sort();
}

export async function allTypeNames(projectDir?: string): Promise<string[]> {
    const names = new Set<string>(builtinTypeNames());
    if (projectDir) {
        for (const name of await listLocalTypeNames(projectDir)) {
            names.add(name);
        }
    }
    return [...names].sort();
}

export async function hasType(name: string, projectDir?: string): Promise<boolean> {
    if (projectDir && await fileExists(join(localTypesDir(projectDir), name, "type.yaml"))) {
        return true;
    }
    return isValidType(name);
}

export async function resolveTypeFile(
    name: string,
    projectDir?: string,
): Promise<{ path: string; source: "local" | "builtin" } | null> {
    if (projectDir) {
        const localTypeFile = join(localTypesDir(projectDir), name, "type.yaml");
        if (await fileExists(localTypeFile)) {
            return { path: localTypeFile, source: "local" };
        }
    }

    if (isValidType(name)) {
        return { path: join(TYPES_DIR, name, "type.yaml"), source: "builtin" };
    }

    return null;
}

export async function loadType(name: string, projectDir?: string): Promise<ProjectType> {
    const resolved = await resolveTypeFile(name, projectDir);
    if (resolved) {
        return loadTypeFromFile(resolved.path);
    }

    const valid = await allTypeNames(projectDir);
    throw new Error(`Unknown project type: "${name}". Valid types: ${valid.join(", ")}`);
}

// Commands that operate on YAML entries, not individual files — not removable
const YAML_ONLY_COMMANDS = new Set(["event", "source"]);

export function getRemoveCommands(typeDef: ProjectType): string[] {
    return typeDef.add_commands.filter((cmd) => !YAML_ONLY_COMMANDS.has(cmd));
}

export async function listTypes(): Promise<{ name: string; description: string }[]> {
    const result: { name: string; description: string }[] = [];

    for (const typeName of BUILTIN_TYPES) {
        const type = await loadType(typeName);
        result.push({ name: typeName, description: type.description });
    }

    return result;
}
