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

export interface ProjectType {
    name: string;
    description: string;
    dirs: string[];
    files: string[];
    add_commands: string[];
    reports: string[];
    schemas: Record<string, FrontmatterSchema>;
    sample_files: Record<string, SampleFile>;
}

const ALL_TYPES = ["novel", "collection", "essay", "paper", "article"] as const;
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
    return parseYaml(raw) as ProjectType;
}

export async function listTypes(): Promise<{ name: string; description: string }[]> {
    const result: { name: string; description: string }[] = [];

    for (const typeName of ALL_TYPES) {
        const type = await loadType(typeName);
        result.push({ name: typeName, description: type.description });
    }

    return result;
}
