import type { BookConfig, Chapter, Contributor } from "./parse.js";
import type { Section } from "./project-type.js";
import { buildColophonLines, formatAuthors } from "./metadata.js";
import { getLabels } from "./i18n.js";
import { loadTypography, formatPartHeading, formatChapterHeading } from "./typography.js";
import type { Labels as TypoLabels } from "./typography.js";

export async function renderBookMd(
    projectDir: string,
    config: BookConfig,
    chapters: Chapter[],
    contributors: Contributor[] = [],
    backcover = "",
    sections?: Section[],
): Promise<string> {
    const has = (s: Section) => !sections || sections.includes(s);
    const labels = getLabels(config.language);
    const typo = await loadTypography(projectDir);
    const lang = config.language || "en";
    const typoLabels: TypoLabels = {
        part: labels.part,
        chapter_label: labels.chapter_label,
        partSuffix: labels.partSuffix,
        chapterSuffix: labels.chapterSuffix,
    };
    const hasParts = config.type !== "paper" && chapters.some((c) => !!c.part);

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
    } else if (has("title_block")) {
        lines.push(`# ${config.title}`);
        if (config.author) lines.push(`\n*${formatAuthors(config.author)}*`);
        lines.push("");
        lines.push("---");
        lines.push("");
    } else {
        // Article-like types: always output at least title + author
        lines.push(`# ${config.title}`);
        if (config.author) lines.push(`\n*${formatAuthors(config.author)}*`);
        lines.push("");
        lines.push("---");
        lines.push("");
    }

    // Table of contents
    if (has("toc") && chapters.length > 1) {
        lines.push(`## ${labels.tableOfContents}`);
        lines.push("");
        const partHasLabel = typo.partHeading === "label_number_title" || typo.partHeading === "label_number";
        let currentTocPart: string | undefined;
        let tocPartIdx = 0;
        let tocChapterNum = 0;
        for (let i = 0; i < chapters.length; i++) {
            if (chapters[i].sectionKind) {
                lines.push(chapters[i].title);
                continue;
            }
            if (hasParts && chapters[i].part && chapters[i].part !== currentTocPart) {
                currentTocPart = chapters[i].part;
                tocPartIdx++;
                const partText = formatPartHeading(typo.partHeading, tocPartIdx, currentTocPart!, typoLabels, lang);
                let partDisplay = partText.replace(/\n/g, " — ");
                if (partHasLabel) partDisplay = partDisplay.toUpperCase();
                lines.push(`**${partDisplay}**`);
                lines.push("");
            }
            tocChapterNum++;
            const formatted = formatChapterHeading(typo.chapterHeading, tocChapterNum, chapters[i].title, typoLabels, lang);
            const tocLabel = formatted.includes("\n") ? formatted.split("\n").join(" — ") : formatted;
            const authorSuffix = config.type === "collection" && chapters[i].author ? ` — ${chapters[i].author}` : "";
            lines.push(`- ${tocLabel}${authorSuffix}`);
        }
        lines.push("");
        lines.push("---");
        lines.push("");
    }

    // Chapters (with part dividers and formatted headings)
    let currentPart: string | undefined;
    let partIndex = 0;

    let chapterIndex = 0;

    for (let ci = 0; ci < chapters.length; ci++) {
        const chapter = chapters[ci];

        // Front/back matter section: simple title, no numbering/part/author
        if (chapter.sectionKind) {
            lines.push(`# ${chapter.title}`);
            lines.push("");
            lines.push(chapter.body.trim());
            lines.push("");
            lines.push("---");
            lines.push("");
            continue;
        }

        // Part divider
        if (hasParts && chapter.part && chapter.part !== currentPart) {
            currentPart = chapter.part;
            partIndex++;
            const partText = formatPartHeading(typo.partHeading, partIndex, currentPart, typoLabels, lang);
            lines.push("---");
            lines.push("");
            const partLines = partText.split("\n");
            if (partLines.length > 1) {
                lines.push(`# ${partLines[0]} — ${partLines[1]}`);
            } else {
                lines.push(`# ${partLines[0]}`);
            }
            lines.push("");
        }

        // Chapter heading
        chapterIndex++;
        if (typo.chapterHeading === "title") {
            // Default: just the title
            lines.push(`# ${chapter.title}`);
        } else {
            const headingText = formatChapterHeading(typo.chapterHeading, chapterIndex, chapter.title, typoLabels, lang);
            const headingLines = headingText.split("\n");
            if (headingLines.length > 1) {
                // Two-line: render number/label as small text, title as heading
                lines.push(`#### ${headingLines[0]}`);
                lines.push(`# ${headingLines[1]}`);
            } else {
                lines.push(`# ${headingLines[0]}`);
            }
        }
        if (config.type === "collection" && chapter.author) {
            lines.push(`*${chapter.author}*`);
        }
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
    const NON_AUTHOR_ROLES = ["translator", "editor", "illustrator"];
    const contribsWithBio = contributors.filter((c) => c.bio && !c.roles.every((r) => NON_AUTHOR_ROLES.includes(r)));
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
