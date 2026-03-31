import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { BookConfig, Chapter } from "./parse.js";

interface ChapterSnapshot {
    filename: string;
    title: string;
    draft?: number;
    words: number;
    hash: string;
}

interface BuildSnapshot {
    generated_at: string;
    title: string;
    type: string;
    chapters: ChapterSnapshot[];
}

function snapshotPath(projectDir: string): string {
    return join(projectDir, ".writekit", "build-snapshot.json");
}

function changelogPath(projectDir: string): string {
    return join(projectDir, "build", "reports", "changelog.md");
}

function wordCount(text: string): number {
    return text.split(/\s+/).filter((w) => w.length > 0).length;
}

function chapterSnapshots(chapters: Chapter[]): ChapterSnapshot[] {
    return chapters
        .filter((chapter) => chapter.number > 0 && !chapter.sectionKind)
        .map((chapter) => ({
            filename: chapter.filename,
            title: chapter.title,
            draft: chapter.draft,
            words: wordCount(chapter.body),
            hash: createHash("sha1")
                .update(JSON.stringify({
                    title: chapter.title,
                    draft: chapter.draft ?? null,
                    body: chapter.body,
                }))
                .digest("hex"),
        }));
}

async function loadPreviousSnapshot(projectDir: string): Promise<BuildSnapshot | null> {
    try {
        const raw = await readFile(snapshotPath(projectDir), "utf-8");
        return JSON.parse(raw) as BuildSnapshot;
    } catch {
        return null;
    }
}

function snapshotForBuild(config: BookConfig, chapters: Chapter[]): BuildSnapshot {
    return {
        generated_at: new Date().toISOString(),
        title: config.title,
        type: config.type || "novel",
        chapters: chapterSnapshots(chapters),
    };
}

function chapterDelta(previous: ChapterSnapshot, current: ChapterSnapshot): string[] {
    const details: string[] = [];
    if (previous.title !== current.title) {
        details.push(`title: "${previous.title}" -> "${current.title}"`);
    }
    if (previous.draft !== current.draft) {
        details.push(`draft: ${previous.draft ?? "—"} -> ${current.draft ?? "—"}`);
    }
    if (previous.words !== current.words) {
        const delta = current.words - previous.words;
        const sign = delta > 0 ? "+" : "";
        details.push(`words: ${previous.words} -> ${current.words} (${sign}${delta})`);
    }
    return details;
}

function renderChangelog(config: BookConfig, previous: BuildSnapshot | null, current: BuildSnapshot): string {
    if (!previous) {
        return `# Changelog — ${config.title}

> Auto-generated at build time. Do not edit.

No previous build snapshot found. This is the first tracked build.
`;
    }

    const previousMap = new Map(previous.chapters.map((chapter) => [chapter.filename, chapter]));
    const currentMap = new Map(current.chapters.map((chapter) => [chapter.filename, chapter]));

    const added = current.chapters.filter((chapter) => !previousMap.has(chapter.filename));
    const removed = previous.chapters.filter((chapter) => !currentMap.has(chapter.filename));
    const changed = current.chapters
        .map((chapter) => {
            const before = previousMap.get(chapter.filename);
            if (!before || before.hash === chapter.hash) return null;
            return {
                chapter,
                details: chapterDelta(before, chapter),
            };
        })
        .filter((entry): entry is { chapter: ChapterSnapshot; details: string[] } => entry !== null);

    if (added.length === 0 && removed.length === 0 && changed.length === 0) {
        return `# Changelog — ${config.title}

> Auto-generated at build time. Do not edit.

No content changes since the previous build snapshot.
`;
    }

    const sections: string[] = [];

    if (added.length > 0) {
        sections.push(`## Added chapters

${added.map((chapter) => `- \`${chapter.filename}\` — ${chapter.title}`).join("\n")}
`);
    }

    if (removed.length > 0) {
        sections.push(`## Removed chapters

${removed.map((chapter) => `- \`${chapter.filename}\` — ${chapter.title}`).join("\n")}
`);
    }

    if (changed.length > 0) {
        sections.push(`## Updated chapters

${changed.map(({ chapter, details }) => `- \`${chapter.filename}\` — ${details.join("; ")}`).join("\n")}
`);
    }

    return `# Changelog — ${config.title}

> Auto-generated at build time. Do not edit.

Compared with snapshot: ${previous.generated_at}

${sections.join("\n")}
`;
}

export async function generateBuildChangelog(
    projectDir: string,
    config: BookConfig,
    chapters: Chapter[],
): Promise<void> {
    const previous = await loadPreviousSnapshot(projectDir);
    const current = snapshotForBuild(config, chapters);

    await mkdir(join(projectDir, ".writekit"), { recursive: true });
    await mkdir(join(projectDir, "build", "reports"), { recursive: true });
    await writeFile(changelogPath(projectDir), renderChangelog(config, previous, current));
    await writeFile(snapshotPath(projectDir), JSON.stringify(current, null, 2));
}
