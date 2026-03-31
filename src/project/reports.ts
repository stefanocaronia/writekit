import { readdir, readFile, mkdir, writeFile } from "node:fs/promises";
import { join, extname } from "node:path";
import { parse as parseYaml } from "yaml";
import { parseFrontmatter, loadConfig, loadChapters } from "./parse.js";
import { loadType, hasType } from "./project-type.js";

interface OutlineChapter {
    chapter: number;
    title: string;
    pov?: string;
    characters: string[];
    location?: string;
}

interface TimelineEvent {
    date: string;
    description: string;
    chapter: string;
}

interface CharacterEntry {
    name: string;
    role: string;
}

interface WorldEntry {
    name: string;
    type: string;
}

async function loadOutlineChapters(projectDir: string): Promise<OutlineChapter[]> {
    const dir = join(projectDir, "outline", "chapters");
    try {
        const files = (await readdir(dir)).filter((f) => extname(f) === ".md").sort();
        const chapters: OutlineChapter[] = [];
        for (const file of files) {
            const content = await readFile(join(dir, file), "utf-8");
            const { data } = parseFrontmatter(content);
            chapters.push({
                chapter: (data.chapter as number) ?? 0,
                title: (data.title as string) ?? "",
                pov: data.pov as string | undefined,
                characters: Array.isArray(data.characters) ? data.characters as string[] : [],
                location: data.location as string | undefined,
            });
        }
        return chapters;
    } catch {
        return [];
    }
}

async function loadTimeline(projectDir: string): Promise<TimelineEvent[]> {
    try {
        const raw = await readFile(join(projectDir, "timeline.yaml"), "utf-8");
        const data = parseYaml(raw) as { events?: TimelineEvent[] };
        return Array.isArray(data?.events) ? data.events : [];
    } catch {
        return [];
    }
}

async function loadCharacters(projectDir: string): Promise<CharacterEntry[]> {
    const dir = join(projectDir, "characters");
    try {
        const files = (await readdir(dir)).filter((f) => extname(f) === ".md").sort();
        const characters: CharacterEntry[] = [];
        for (const file of files) {
            const content = await readFile(join(dir, file), "utf-8");
            const { data } = parseFrontmatter(content);
            if (data.name) {
                characters.push({
                    name: data.name as string,
                    role: (data.role as string) ?? "",
                });
            }
        }
        return characters;
    } catch {
        return [];
    }
}

async function loadWorld(projectDir: string): Promise<WorldEntry[]> {
    const dir = join(projectDir, "world");
    try {
        const files = (await readdir(dir)).filter((f) => extname(f) === ".md").sort();
        const entries: WorldEntry[] = [];
        for (const file of files) {
            const content = await readFile(join(dir, file), "utf-8");
            const { data } = parseFrontmatter(content);
            if (data.name) {
                entries.push({
                    name: data.name as string,
                    type: (data.type as string) ?? "",
                });
            }
        }
        return entries;
    } catch {
        return [];
    }
}

function wordCount(text: string): number {
    return text.split(/\s+/).filter((w) => w.length > 0).length;
}

function trackedChapters<T extends { number: number; sectionKind?: string; draft?: number }>(chapters: T[]): T[] {
    return chapters.filter((chapter) => chapter.number > 0 && !chapter.sectionKind);
}

// --- Status Report ---

async function generateStatus(projectDir: string): Promise<string> {
    const config = await loadConfig(projectDir);
    const chapters = await loadChapters(projectDir);
    const characters = await loadCharacters(projectDir);
    const world = await loadWorld(projectDir);
    const timeline = await loadTimeline(projectDir);

    const chapterRows = chapters.map((ch) => {
        const wc = wordCount(ch.body);
        return `| ${ch.number} | ${ch.title} | ${ch.pov || "—"} | ${ch.draft ?? "—"} | ${wc.toLocaleString()} |`;
    });

    const totalWords = chapters.reduce((sum, ch) => sum + wordCount(ch.body), 0);
    const draftTracked = trackedChapters(chapters);
    const missingDraft = draftTracked.filter((chapter) => chapter.draft === undefined).length;
    const draftCounts = new Map<number, number>();

    for (const chapter of draftTracked) {
        if (chapter.draft === undefined || !Number.isInteger(chapter.draft) || chapter.draft < 1) continue;
        draftCounts.set(chapter.draft, (draftCounts.get(chapter.draft) ?? 0) + 1);
    }

    const latestDraft = draftCounts.size > 0 ? Math.max(...draftCounts.keys()) : null;
    const draftRows = [...draftCounts.entries()]
        .sort((a, b) => a[0] - b[0])
        .map(([draft, count]) => `| Draft ${draft} | ${count} |`)
        .join("\n");

    return `# Status — ${config.title}

> Auto-generated report. Do not edit.

## Overview

| | Count |
|---|---|
| Chapters | ${chapters.length} |
| Characters | ${characters.length} |
| Locations/World | ${world.length} |
| Timeline events | ${timeline.length} |
| Tracked chapters | ${draftTracked.length} |
| Missing draft metadata | ${missingDraft} |
| Latest draft | ${latestDraft ?? "—"} |
| **Total words** | **${totalWords.toLocaleString()}** |

## Chapters

| # | Title | POV | Draft | Words |
|---|---|---|---|---|
${chapterRows.join("\n")}

## Draft tracking

| Draft | Chapters |
|---|---|
${draftRows || "| _No draft metadata yet_ | 0 |"}

**Total: ${totalWords.toLocaleString()} words**
`;
}

// --- Cast Report ---

async function generateCast(projectDir: string): Promise<string> {
    const config = await loadConfig(projectDir);
    const manuscripts = await loadChapters(projectDir);
    const outlines = await loadOutlineChapters(projectDir);
    const characters = await loadCharacters(projectDir);

    // Build a map: character name -> chapters they appear in
    const appearances = new Map<string, Set<string>>();

    for (const ch of characters) {
        appearances.set(ch.name.toLowerCase(), new Set());
    }

    // From outline chapter characters field
    for (const ol of outlines) {
        for (const name of ol.characters) {
            const key = name.toLowerCase();
            if (!appearances.has(key)) appearances.set(key, new Set());
            appearances.get(key)!.add(`Ch. ${ol.chapter} (${ol.title})`);
        }
    }

    // From manuscript POV field
    for (const ms of manuscripts) {
        if (ms.pov) {
            const key = ms.pov.toLowerCase();
            if (!appearances.has(key)) appearances.set(key, new Set());
            appearances.get(key)!.add(`Ch. ${ms.number} (${ms.title}) — POV`);
        }
    }

    // Build report
    const sections: string[] = [];

    for (const ch of characters) {
        const key = ch.name.toLowerCase();
        const chs = appearances.get(key);
        const list = chs && chs.size > 0
            ? [...chs].map((c) => `- ${c}`).join("\n")
            : "- _No appearances yet_";
        sections.push(`### ${ch.name} (${ch.role})\n\n${list}`);
    }

    // Characters mentioned in outlines but without a character sheet
    for (const [key, chs] of appearances) {
        if (!characters.some((c) => c.name.toLowerCase() === key)) {
            const list = [...chs].map((c) => `- ${c}`).join("\n");
            sections.push(`### ${key} — ⚠ no character sheet\n\n${list}`);
        }
    }

    return `# Cast — ${config.title}

> Auto-generated report. Do not edit.

${sections.join("\n\n")}
`;
}

// --- Locations Report ---

async function generateLocations(projectDir: string): Promise<string> {
    const config = await loadConfig(projectDir);
    const outlines = await loadOutlineChapters(projectDir);
    const world = await loadWorld(projectDir);

    // Build map: location -> chapters
    const usage = new Map<string, string[]>();

    for (const ol of outlines) {
        if (ol.location) {
            const key = ol.location.toLowerCase();
            if (!usage.has(key)) usage.set(key, []);
            usage.get(key)!.push(`Ch. ${ol.chapter} (${ol.title})`);
        }
    }

    const sections: string[] = [];

    for (const entry of world) {
        const key = entry.name.toLowerCase();
        const chs = usage.get(key);
        const list = chs && chs.length > 0
            ? chs.map((c) => `- ${c}`).join("\n")
            : "- _Not used in any chapter yet_";
        sections.push(`### ${entry.name} (${entry.type})\n\n${list}`);
    }

    // Locations in outlines without a world entry
    for (const [key, chs] of usage) {
        if (!world.some((w) => w.name.toLowerCase() === key)) {
            const list = chs.map((c) => `- ${c}`).join("\n");
            sections.push(`### ${key} — ⚠ no world entry\n\n${list}`);
        }
    }

    return `# Locations — ${config.title}

> Auto-generated report. Do not edit.

${sections.join("\n\n")}
`;
}

// --- Timeline Report ---

async function generateTimeline(projectDir: string): Promise<string> {
    const config = await loadConfig(projectDir);
    const events = await loadTimeline(projectDir);

    if (events.length === 0) {
        return `# Timeline — ${config.title}\n\n> Auto-generated report. Do not edit.\n\n_No events yet._\n`;
    }

    const rows = events.map((e) => {
        const date = e.date || "—";
        const chapter = e.chapter ? `Ch. ${e.chapter}` : "—";
        return `| ${date} | ${e.description} | ${chapter} |`;
    });

    return `# Timeline — ${config.title}

> Auto-generated report. Do not edit.

| Date | Event | Chapter |
|---|---|---|
${rows.join("\n")}
`;
}

// --- Generate all reports ---

const REPORT_GENERATORS: Record<string, (dir: string) => Promise<string>> = {
    status: generateStatus,
    cast: generateCast,
    locations: generateLocations,
    timeline: generateTimeline,
};

export async function generateReports(projectDir: string): Promise<string[]> {
    const reportsDir = join(projectDir, "build", "reports");
    await mkdir(reportsDir, { recursive: true });

    // Determine which reports this type needs
    const config = await loadConfig(projectDir);
    const typeName = config.type || "novel";
    const typeDef = await hasType(typeName, projectDir) ? await loadType(typeName, projectDir) : await loadType("novel");
    const activeReports = typeDef.reports;

    const generated: string[] = [];

    for (const reportName of activeReports) {
        const generator = REPORT_GENERATORS[reportName];
        if (generator) {
            const content = await generator(projectDir);
            await writeFile(join(reportsDir, `${reportName}.md`), content);
            generated.push(reportName);
        }
    }

    return generated;
}
