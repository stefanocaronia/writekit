import { readFile, readdir } from "node:fs/promises";
import { join, extname } from "node:path";
import { parse as parseYaml } from "yaml";

export interface BookConfig {
    type?: string;
    title: string;
    subtitle?: string;
    series?: string;
    volume?: number;
    author: string | string[];
    translator?: string;
    editor?: string;
    illustrator?: string;
    language: string;
    genre?: string;
    isbn?: string;
    publisher?: string;
    edition?: number;
    date?: string;
    license?: string;
    license_url?: string;
    copyright?: string;
    build_formats?: string[];
    theme?: string;
}

export interface Chapter {
    number: number;
    title: string;
    pov?: string;
    draft?: number;
    author?: string;
    body: string;
    filename: string;
}

export function parseFrontmatter(content: string): {
    data: Record<string, unknown>;
    body: string;
} {
    const match = content.match(/^---\n([\s\S]*?)\n---\n\n?([\s\S]*)$/);
    if (!match) {
        return { data: {}, body: content };
    }
    try {
        const data = parseYaml(match[1]) as Record<string, unknown>;
        return { data: data ?? {}, body: match[2] };
    } catch {
        return { data: {}, body: content };
    }
}

export interface Contributor {
    name: string;
    roles: string[];
    bio: string;
}

export async function loadContributors(projectDir: string): Promise<Contributor[]> {
    const dir = join(projectDir, "contributors");
    try {
        const files = await readdir(dir);
        const mdFiles = files.filter((f) => extname(f) === ".md").sort();
        const contributors: Contributor[] = [];

        for (const file of mdFiles) {
            const content = await readFile(join(dir, file), "utf-8");
            const { data, body } = parseFrontmatter(content);
            contributors.push({
                name: (data.name as string) ?? "",
                roles: Array.isArray(data.roles) ? data.roles : [],
                bio: body.replace(/^#.*\n+/, "").trim(),
            });
        }

        return contributors;
    } catch {
        return [];
    }
}

export async function loadBackcover(projectDir: string): Promise<string> {
    try {
        const content = await readFile(join(projectDir, "backcover.md"), "utf-8");
        return content.replace(/^#.*\n+/, "").trim();
    } catch {
        return "";
    }
}

export async function loadConfig(projectDir: string): Promise<BookConfig> {
    const raw = await readFile(join(projectDir, "config.yaml"), "utf-8");
    return parseYaml(raw) as BookConfig;
}

export async function loadChapters(projectDir: string): Promise<Chapter[]> {
    const manuscriptDir = join(projectDir, "manuscript");
    const files = await readdir(manuscriptDir);

    const mdFiles = files
        .filter((f) => extname(f) === ".md")
        .sort();

    const chapters: Chapter[] = [];

    for (const file of mdFiles) {
        const content = await readFile(join(manuscriptDir, file), "utf-8");
        const { data, body } = parseFrontmatter(content);

        chapters.push({
            number: (data.chapter as number) ?? chapters.length + 1,
            title: (data.title as string) ?? file.replace(/\.md$/, ""),
            pov: data.pov as string | undefined,
            draft: data.draft as number | undefined,
            author: data.author as string | undefined,
            body,
            filename: file,
        });
    }

    return chapters;
}
