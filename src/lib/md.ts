import type { BookConfig, Chapter, Contributor } from "./parse.js";
import { buildColophonLines, formatAuthors } from "./metadata.js";
import { getLabels } from "./i18n.js";

export function renderBookMd(
    config: BookConfig,
    chapters: Chapter[],
    contributors: Contributor[] = [],
    backcover = "",
): string {
    const labels = getLabels(config.language);
    const lines: string[] = [];

    // Cover
    lines.push(`# ${config.title}`);
    if (config.subtitle) lines.push(`\n*${config.subtitle}*`);
    if (config.series) {
        lines.push(`\n${config.series}${config.volume ? ` — Vol. ${config.volume}` : ""}`);
    }
    if (config.author) lines.push(`\n**${formatAuthors(config.author)}**`);
    lines.push("");
    lines.push("---");
    lines.push("");

    // Table of contents
    lines.push(`## ${labels.tableOfContents}`);
    lines.push("");
    for (let i = 0; i < chapters.length; i++) {
        lines.push(`${i + 1}. ${chapters[i].title}`);
    }
    lines.push("");
    lines.push("---");
    lines.push("");

    // Chapters
    for (const chapter of chapters) {
        lines.push(chapter.body.trim());
        lines.push("");
        lines.push("---");
        lines.push("");
    }

    // Back cover
    if (backcover) {
        lines.push(backcover.trim());
        lines.push("");
        lines.push("---");
        lines.push("");
    }

    // About the author(s)
    const contribsWithBio = contributors.filter((c) => c.bio);
    if (contribsWithBio.length > 0) {
        lines.push(`## ${labels.aboutTheAuthor}`);
        lines.push("");
        for (const c of contribsWithBio) {
            lines.push(`**${c.name}** ${c.bio}`);
            lines.push("");
        }
        lines.push("---");
        lines.push("");
    }

    // Colophon
    const colophonLines = buildColophonLines(config);
    if (colophonLines.length > 0) {
        lines.push("---");
        lines.push("");
        for (const line of colophonLines) {
            lines.push(line);
        }
        lines.push("");
    }

    return lines.join("\n");
}
