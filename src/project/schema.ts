export type FieldType = "string" | "number" | "array" | "boolean" | "object";

export interface FieldDef {
    type: FieldType;
    required?: boolean;
    values?: string[]; // allowed values (optional)
}

export type Schema = Record<string, FieldDef>;

// --- YAML file schemas ---

export const configSchema: Schema = {
    type: { type: "string" },
    title: { type: "string", required: true },
    subtitle: { type: "string" },
    series: { type: "string" },
    volume: { type: "number" },
    author: { type: "string", required: true }, // also accepts array — validated separately
    translator: { type: "string" },
    editor: { type: "string" },
    illustrator: { type: "string" },
    language: { type: "string", required: true },
    genre: { type: "string" },
    doi: { type: "string" },
    isbn: { type: "string" },
    publisher: { type: "string" },
    edition: { type: "number" },
    date: { type: "string" },
    build_formats: { type: "array" },
    theme: { type: "string" },
    cover: { type: "string" },
    print_preset: { type: "string" },
    layout: { type: "object" },
    type_options: { type: "object" },
    format_options: { type: "object" },
    abstract: { type: "string" },
    keywords: { type: "array" },
    license: { type: "string" },
    license_url: { type: "string" },
    copyright: { type: "string" },
};

export const styleSchema: Schema = {
    pov: {
        type: "string",
        required: true,
        values: ["first-person", "third-person", "omniscient"],
    },
    tense: {
        type: "string",
        required: true,
        values: ["past", "present"],
    },
    tone: { type: "string" },
    voice: { type: "string" },
    rules: { type: "array" },
    dialogue_style: { type: "string", values: ["em_dash", "double_quotes", "guillemets", "angle_quotes"] },
    smart_quotes: { type: "boolean" },
    normalize_ellipsis: { type: "boolean" },
    normalize_dashes: { type: "boolean" },
};

export const timelineSchema: Schema = {
    events: { type: "array", required: true },
};

// --- Frontmatter schemas ---

export const manuscriptSchema: Schema = {
    chapter: { type: "number", required: true },
    title: { type: "string", required: true },
    pov: { type: "string" },
    draft: { type: "number" },
};

export const outlineChapterSchema: Schema = {
    chapter: { type: "number", required: true },
    title: { type: "string", required: true },
    pov: { type: "string" },
    characters: { type: "array" },
    location: { type: "string" },
};

export const characterSchema: Schema = {
    name: { type: "string", required: true },
    role: {
        type: "string",
        required: true,
        values: ["protagonist", "antagonist", "supporting", "minor"],
    },
    age: { type: "string" },
    relationships: { type: "array" },
};

export const worldSchema: Schema = {
    name: { type: "string", required: true },
    type: {
        type: "string",
        required: true,
        values: ["location", "system", "organization", "culture"],
    },
};

// --- Validation ---

export interface ValidationIssue {
    level: "error" | "warning";
    message: string;
}

function checkType(value: unknown, expectedType: FieldType): boolean {
    switch (expectedType) {
        case "string":
            return typeof value === "string";
        case "number":
            return typeof value === "number";
        case "boolean":
            return typeof value === "boolean";
        case "array":
            return Array.isArray(value);
        case "object":
            return value !== null && typeof value === "object" && !Array.isArray(value);
    }
}

export function validateData(
    data: Record<string, unknown>,
    schema: Schema,
    file: string,
): ValidationIssue[] {
    const issues: ValidationIssue[] = [];

    for (const [field, def] of Object.entries(schema)) {
        const value = data[field];

        // Check required
        if (def.required && (value === undefined || value === null)) {
            issues.push({
                level: "error",
                message: `${file}: missing required field "${field}"`,
            });
            continue;
        }

        // Skip if not present and not required
        if (value === undefined || value === null || value === "") continue;

        // Check type (author field accepts string or array)
        if (!checkType(value, def.type) && !(field === "author" && Array.isArray(value))) {
            issues.push({
                level: "error",
                message: `${file}: field "${field}" should be ${def.type}, got ${typeof value}`,
            });
            continue;
        }

        // Check allowed values
        if (def.values && typeof value === "string" && !def.values.includes(value)) {
            issues.push({
                level: "warning",
                message: `${file}: field "${field}" is "${value}" — expected: ${def.values.join(", ")}`,
            });
        }
    }

    return issues;
}
