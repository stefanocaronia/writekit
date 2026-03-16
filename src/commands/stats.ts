import { Command } from "commander";
import { readFile, readdir } from "node:fs/promises";
import { join, extname } from "node:path";
import { assertProject } from "../lib/fs-utils.js";
import { loadConfig, loadChapters, loadContributors, parseFrontmatter } from "../lib/parse.js";
import { c, icon } from "../lib/ui.js";

function countWords(text: string): number {
    return text.split(/\s+/).filter((w) => w.length > 0).length;
}

function readingTime(words: number): string {
    const minutes = Math.ceil(words / 250);
    if (minutes < 60) return `${minutes} min`;
    const hours = Math.floor(minutes / 60);
    const rest = minutes % 60;
    return rest > 0 ? `${hours}h ${rest}m` : `${hours}h`;
}

function bar(value: number, max: number, width = 20): string {
    const filled = max > 0 ? Math.round((value / max) * width) : 0;
    return c.green("█".repeat(filled)) + c.dim("░".repeat(width - filled));
}

function wordFrequency(text: string, topN = 15): { word: string; count: number }[] {
    const stopWords = new Set([
        // English
        "the", "a", "an", "and", "or", "but", "in", "on", "at", "to", "for",
        "of", "with", "by", "from", "is", "was", "are", "were", "be", "been",
        "it", "its", "this", "that", "he", "she", "his", "her", "they", "them",
        "i", "you", "we", "my", "your", "not", "no", "so", "as", "if", "had",
        "has", "have", "do", "did", "will", "would", "could", "should",
        // Italian
        "il", "lo", "la", "le", "li", "gli", "un", "uno", "una", "di", "del",
        "della", "dei", "delle", "da", "dal", "dalla", "in", "nel", "nella",
        "che", "non", "si", "per", "con", "su", "era", "sono", "come", "più",
        "anche", "ma", "poi", "se", "io", "tu", "lui", "lei", "noi", "loro",
        "mi", "ti", "ci", "vi", "al", "alla", "ai", "alle", "è",
        // French
        "le", "la", "les", "un", "une", "des", "de", "du", "et", "en", "est",
        "que", "qui", "dans", "pour", "pas", "sur", "avec", "ce", "je", "il",
        // Spanish
        "el", "la", "los", "las", "un", "una", "de", "del", "en", "que", "es",
        "por", "con", "se", "no", "al", "lo", "su", "para",
        // German
        "der", "die", "das", "ein", "eine", "und", "in", "ist", "von", "zu",
        "den", "mit", "auf", "für", "nicht", "sich", "es", "als",
    ]);

    const words = text.toLowerCase().replace(/[^\p{L}\s]/gu, "").split(/\s+/).filter((w) => w.length > 2);
    const freq = new Map<string, number>();

    for (const word of words) {
        if (stopWords.has(word)) continue;
        freq.set(word, (freq.get(word) ?? 0) + 1);
    }

    return [...freq.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, topN)
        .map(([word, count]) => ({ word, count }));
}

async function countFilesInDir(dir: string): Promise<number> {
    try {
        const files = await readdir(dir);
        return files.filter((f) => extname(f) === ".md").length;
    } catch {
        return 0;
    }
}

export const statsCommand = new Command("stats")
    .description("Show detailed project statistics")
    .action(async () => {
        const projectDir = process.cwd();
        await assertProject(projectDir);

        const config = await loadConfig(projectDir);
        const chapters = await loadChapters(projectDir);
        const contributors = await loadContributors(projectDir);

        // Gather all text
        const allText = chapters.map((ch) => ch.body).join("\n\n");
        const totalWords = countWords(allText);
        const maxChapterWords = Math.max(...chapters.map((ch) => countWords(ch.body)), 0);

        // Count files in various dirs
        const characterCount = await countFilesInDir(join(projectDir, "characters"));
        const worldCount = await countFilesInDir(join(projectDir, "world"));
        const noteCount = await countFilesInDir(join(projectDir, "notes"));

        // Draft stats
        const drafts = chapters.map((ch) => ch.draft ?? 1);
        const avgDraft = drafts.length > 0 ? (drafts.reduce((a, b) => a + b, 0) / drafts.length).toFixed(1) : "—";

        console.log(`\n${icon.book} ${c.bold(config.title)}\n`);

        // Overview
        console.log(`  ${c.bold("Overview")}`);
        console.log(`  ${c.dim("─".repeat(40))}`);
        console.log(`  ${icon.chapter} Chapters        ${c.bold(String(chapters.length))}`);
        console.log(`  ${icon.quill} Total words     ${c.bold(totalWords.toLocaleString())}`);
        console.log(`  ${icon.build} Reading time    ${c.bold(readingTime(totalWords))}`);
        console.log(`  ${icon.note} Avg draft       ${c.bold(String(avgDraft))}`);
        if (contributors.length > 0) {
            console.log(`  ${icon.character} Contributors    ${c.bold(String(contributors.length))}`);
        }
        if (characterCount > 0) {
            console.log(`  ${icon.character} Characters      ${c.bold(String(characterCount))}`);
        }
        if (worldCount > 0) {
            console.log(`  ${icon.location} Locations       ${c.bold(String(worldCount))}`);
        }
        if (noteCount > 0) {
            console.log(`  ${icon.note} Notes           ${c.bold(String(noteCount))}`);
        }

        // Chapter breakdown
        if (chapters.length > 0) {
            console.log(`\n  ${c.bold("Chapters")}`);
            console.log(`  ${c.dim("─".repeat(40))}`);

            for (const ch of chapters) {
                const words = countWords(ch.body);
                const padTitle = ch.title.length > 22
                    ? ch.title.slice(0, 21) + "…"
                    : ch.title.padEnd(22);
                console.log(
                    `  ${c.dim(String(ch.number).padStart(2))} ${padTitle} ${bar(words, maxChapterWords)} ${c.bold(String(words).padStart(6))}`,
                );
            }

            // Balance indicator
            const wordCounts = chapters.map((ch) => countWords(ch.body));
            const avg = totalWords / chapters.length;
            const variance = wordCounts.reduce((sum, w) => sum + Math.pow(w - avg, 2), 0) / chapters.length;
            const stdDev = Math.sqrt(variance);
            const cv = avg > 0 ? ((stdDev / avg) * 100).toFixed(0) : "0";

            console.log(`\n  ${c.dim("Avg:")} ${c.bold(Math.round(avg).toLocaleString())} words/chapter`);
            if (Number(cv) < 30) {
                console.log(`  ${c.green("✓")} ${c.dim("Well balanced")} ${c.dim(`(${cv}% variation)`)}`);
            } else if (Number(cv) < 60) {
                console.log(`  ${c.yellow("~")} ${c.dim("Somewhat uneven")} ${c.dim(`(${cv}% variation)`)}`);
            } else {
                console.log(`  ${c.red("!")} ${c.dim("Very uneven")} ${c.dim(`(${cv}% variation)`)}`);
            }
        }

        // Word frequency
        if (totalWords > 100) {
            const freq = wordFrequency(allText);
            if (freq.length > 0) {
                const maxFreq = freq[0].count;
                console.log(`\n  ${c.bold("Most used words")}`);
                console.log(`  ${c.dim("─".repeat(40))}`);
                for (const { word, count } of freq) {
                    const padWord = word.padEnd(16);
                    console.log(
                        `  ${padWord} ${bar(count, maxFreq, 15)} ${c.dim(String(count))}`,
                    );
                }
            }
        }

        console.log();
    });
