import type { BookConfig, Chapter, Contributor } from "./parse.js";
import type { Section } from "./project-type.js";
import { buildColophonLines, formatAuthors } from "./metadata.js";
import { getLabels } from "./i18n.js";

export function renderBookMd(
    config: BookConfig,
    chapters: Chapter[],
    contributors: Contributor[] = [],
    backcover = "",
    sections?: Section[],
): string {
    const has = (s: Section) => !sections || sections.includes(s);
    const labels = getLabels(config.language);
    const lines: string[] = [];

    // Title / author header
    if (has("title_page")) {
        lines.push(`# ${config.title}`);
        if (config.subtitle) lines.push(`\n*${config.subtitle}*`);
        if (config.series) {
            lines.push(`\n${config.series}${config.volume ? ` — Vol. ${config.volume}` : ""}`);
        }
        if (config.author) lines.push(`\n**${formatAuthors(config.author)}**`);
        lines.push("");
        lines.push("---");
        lines.push("");
    }

    // Table of contents
    if (has("toc") && chapters.length > 1) {
        lines.push(`## ${labels.tableOfContents}`);
        lines.push("");
        for (let i = 0; i < chapters.length; i++) {
            lines.push(`${i + 1}. ${chapters[i].title}`);
        }
        lines.push("");
        lines.push("---");
        lines.push("");
    }

    // Chapters
    for (const chapter of chapters) {
        lines.push(`# ${chapter.title}`);
        lines.push("");
        lines.push(chapter.body.trim());
        lines.push("");
        lines.push("---");
        lines.push("");
    }

    // Back cover
    if (has("backcover") && backcover) {
        lines.push(backcover.trim());
        lines.push("");
        lines.push("---");
        lines.push("");
    }

    // About the author(s)
    const contribsWithBio = contributors.filter((c) => c.bio);
    if (has("about") && contribsWithBio.length > 0) {
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
    if (has("colophon") && colophonLines.length > 0) {
        lines.push("---");
        lines.push("");
        for (const line of colophonLines) {
            lines.push(line);
        }
        lines.push("");
    }

    return lines.join("\n");
}
