import { readFile, readdir, access, stat } from "node:fs/promises";
import { join, extname, basename } from "node:path";
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
    cover?: string;
    print_preset?: string;
    abstract?: string;
    keywords?: string[];
}

export type SectionKind = "dedication" | "preface" | "foreword" | "prologue" | "epilogue" | "afterword" | "appendix" | "author_note";

export const FRONT_SECTIONS: SectionKind[] = ["dedication", "preface", "foreword", "prologue"];
export const BACK_SECTIONS: SectionKind[] = ["epilogue", "afterword", "appendix", "author_note"];

export const SECTION_FILE_MAP: Record<string, SectionKind> = {
    "dedication.md": "dedication",
    "preface.md": "preface",
    "foreword.md": "foreword",
    "prologue.md": "prologue",
    "epilogue.md": "epilogue",
    "afterword.md": "afterword",
    "appendix.md": "appendix",
    "author-note.md": "author_note",
};

export interface PartInfo {
    number: number;
    title: string;
}

export interface Chapter {
    number: number;
    title: string;
    pov?: string;
    draft?: number;
    author?: string;
    part?: string;
    partNumber?: number;
    sectionKind?: SectionKind;
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
            const name = (data.name as string) ?? "";
            let bio = body.replace(/^#.*\n+/, "").trim();
            // Remove name from start of bio to avoid duplication
            if (name && bio.toLowerCase().startsWith(name.toLowerCase())) {
                bio = bio.slice(name.length).trimStart();
            }
            contributors.push({
                name,
                roles: Array.isArray(data.roles) ? data.roles : [],
                bio,
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

export async function resolveCover(projectDir: string, config: BookConfig): Promise<string | null> {
    // Explicit path in config
    if (config.cover) {
        const explicit = join(projectDir, config.cover);
        try { await access(explicit); return explicit; } catch { return null; }
    }
    // Auto-detect in assets/
    for (const name of ["cover.jpg", "cover.jpeg", "cover.png", "cover.webp"]) {
        const p = join(projectDir, "assets", name);
        try { await access(p); return p; } catch { /* continue */ }
    }
    return null;
}

export async function loadConfig(projectDir: string): Promise<BookConfig> {
    const raw = await readFile(join(projectDir, "config.yaml"), "utf-8");
    return parseYaml(raw) as BookConfig;
}

function parseMdFile(content: string, file: string, chapterNum: number): Chapter {
    const { data, body } = parseFrontmatter(content);
    const cleanBody = body.replace(/^#\s+.+\n+/, "");
    return {
        number: (data.chapter as number) ?? chapterNum,
        title: (data.title as string) ?? file.replace(/\.md$/, ""),
        pov: data.pov as string | undefined,
        draft: data.draft as number | undefined,
        author: data.author as string | undefined,
        body: cleanBody,
        filename: file,
    };
}

async function loadPartYaml(partDir: string): Promise<string> {
    try {
        const raw = await readFile(join(partDir, "part.yaml"), "utf-8");
        const data = parseYaml(raw) as Record<string, unknown>;
        return (data.title as string) ?? "";
    } catch {
        return basename(partDir);
    }
}

export async function loadChapters(projectDir: string): Promise<Chapter[]> {
    const manuscriptDir = join(projectDir, "manuscript");
    let entries: string[];
    try {
        entries = await readdir(manuscriptDir);
    } catch {
        return [];
    }

    // Classify entries
    const frontFiles: string[] = [];
    const backFiles: string[] = [];
    const chapterFiles: string[] = [];
    const partDirs: string[] = [];

    for (const entry of entries.sort()) {
        const sectionKind = SECTION_FILE_MAP[entry];
        if (sectionKind && FRONT_SECTIONS.includes(sectionKind)) {
            frontFiles.push(entry);
        } else if (sectionKind && BACK_SECTIONS.includes(sectionKind)) {
            backFiles.push(entry);
        } else if (extname(entry) === ".md") {
            chapterFiles.push(entry);
        } else if (entry.startsWith("part-")) {
            try {
                const s = await stat(join(manuscriptDir, entry));
                if (s.isDirectory()) partDirs.push(entry);
            } catch { /* skip */ }
        }
    }

    // Sort front/back by canonical order
    frontFiles.sort((a, b) => FRONT_SECTIONS.indexOf(SECTION_FILE_MAP[a]) - FRONT_SECTIONS.indexOf(SECTION_FILE_MAP[b]));
    backFiles.sort((a, b) => BACK_SECTIONS.indexOf(SECTION_FILE_MAP[a]) - BACK_SECTIONS.indexOf(SECTION_FILE_MAP[b]));

    const result: Chapter[] = [];
    let chapterCounter = 0;

    // Front matter
    for (const file of frontFiles) {
        const content = await readFile(join(manuscriptDir, file), "utf-8");
        const ch = parseMdFile(content, file, 0);
        ch.sectionKind = SECTION_FILE_MAP[file];
        ch.number = 0;
        result.push(ch);
    }

    if (partDirs.length > 0) {
        // Part-based structure
        partDirs.sort();
        for (let pi = 0; pi < partDirs.length; pi++) {
            const partDir = join(manuscriptDir, partDirs[pi]);
            const partTitle = await loadPartYaml(partDir);
            const partNum = pi + 1;

            const partEntries = await readdir(partDir);
            const partMdFiles = partEntries.filter((f) => extname(f) === ".md").sort();

            for (const file of partMdFiles) {
                chapterCounter++;
                const content = await readFile(join(partDir, file), "utf-8");
                const ch = parseMdFile(content, `${partDirs[pi]}/${file}`, chapterCounter);
                ch.part = partTitle;
                ch.partNumber = partNum;
                result.push(ch);
            }
        }

        // Chapters in root when parts exist → still load them (check will warn)
        for (const file of chapterFiles) {
            chapterCounter++;
            const content = await readFile(join(manuscriptDir, file), "utf-8");
            const ch = parseMdFile(content, file, chapterCounter);
            result.push(ch);
        }
    } else {
        // Flat structure — just numbered chapters
        for (const file of chapterFiles) {
            chapterCounter++;
            const content = await readFile(join(manuscriptDir, file), "utf-8");
            result.push(parseMdFile(content, file, chapterCounter));
        }
    }

    // Back matter
    for (const file of backFiles) {
        const content = await readFile(join(manuscriptDir, file), "utf-8");
        const ch = parseMdFile(content, file, 0);
        ch.sectionKind = SECTION_FILE_MAP[file];
        ch.number = 0;
        result.push(ch);
    }

    return result;
}

export async function loadParts(projectDir: string): Promise<PartInfo[]> {
    const manuscriptDir = join(projectDir, "manuscript");
    try {
        const entries = await readdir(manuscriptDir);
        const partDirs = entries.filter((e) => e.startsWith("part-")).sort();
        const parts: PartInfo[] = [];
        for (let i = 0; i < partDirs.length; i++) {
            const s = await stat(join(manuscriptDir, partDirs[i]));
            if (!s.isDirectory()) continue;
            const title = await loadPartYaml(join(manuscriptDir, partDirs[i]));
            parts.push({ number: i + 1, title });
        }
        return parts;
    } catch {
        return [];
    }
}
