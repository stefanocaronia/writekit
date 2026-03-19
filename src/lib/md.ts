import { copyFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { SECTION_LABEL_KEY } from "./parse.js";
import type { BookConfig, Chapter, Contributor } from "./parse.js";
import type { Section, TypeFeatures } from "./project-type.js";
import { buildColophonLines, formatAuthors } from "./metadata.js";
import { getLabels } from "./i18n.js";
import { loadTypography, formatPartHeading, formatChapterHeading } from "./typography.js";
import type { Labels as TypoLabels } from "./typography.js";
import { collectImagePaths } from "./images.js";

export async function renderBookMd(
    projectDir: string,
    config: BookConfig,
    chapters: Chapter[],
    contributors: Contributor[] = [],
    backcover = "",
    sections?: Section[],
    features?: TypeFeatures,
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
    const hasParts = features?.supports_parts !== false && chapters.some((c) => !!c.part);

    const lines: string[] = [];

    // Title / author header
    if (has("title_page")) {
        lines.push(`# ${config.title}`);
        if (config.subtitle) lines.push(`\n*${config.subtitle}*`);
        if (config.series) {
            lines.push(`\n${config.series}${config.volume ? ` — Vol. ${config.volume}` : ""}`);
        }
        if (config.author) lines.push(`\n*${formatAuthors(config.author)}*`);
        lines.push("");
    } else if (has("title_block")) {
        lines.push(`# ${config.title}`);
        if (config.author) lines.push(`\n*${formatAuthors(config.author)}*`);
        lines.push("");
    } else {
        lines.push(`# ${config.title}`);
        if (config.author) lines.push(`\n*${formatAuthors(config.author)}*`);
        lines.push("");
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
                if (chapters[i].toc !== false) {
                    const sLabel = chapters[i].title || (labels as any)[SECTION_LABEL_KEY[chapters[i].sectionKind!]] || "";
                    if (sLabel) lines.push(sLabel);
                }
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
            const authorSuffix = features?.show_chapter_author === true && chapters[i].author ? ` — ${chapters[i].author}` : "";
            lines.push(`- ${tocLabel}${authorSuffix}`);
        }
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
            const resolvedTitle = chapter.title || (labels as any)[SECTION_LABEL_KEY[chapter.sectionKind]] || "";
            if (chapter.showTitle !== false && resolvedTitle) {
                lines.push(`# ${resolvedTitle}`);
                lines.push("");
            }
            lines.push(chapter.body.trim());
            lines.push("");
            continue;
        }

        // Part divider
        if (hasParts && chapter.part && chapter.part !== currentPart) {
            currentPart = chapter.part;
            partIndex++;
            const partText = formatPartHeading(typo.partHeading, partIndex, currentPart, typoLabels, lang);
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
        if (features?.show_chapter_author === true && chapter.author) {
            lines.push(`*${chapter.author}*`);
        }
        lines.push("");
        lines.push(chapter.body.trim());
        lines.push("");
    }

    // Back cover
    if (has("backcover") && backcover) {
        lines.push(backcover.trim());
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

    // Copy images to build/assets/ and rewrite paths
    let result = lines.join("\n");
    const allBodies = chapters.map((c) => c.body).join("\n");
    const images = collectImagePaths(allBodies, projectDir);
    if (images.length > 0) {
        const buildAssetsDir = join(projectDir, "build", "assets");
        await mkdir(buildAssetsDir, { recursive: true });
        for (const img of images) {
            const dest = join(buildAssetsDir, img.filename);
            try {
                await copyFile(img.absPath, dest);
            } catch { /* skip missing images */ }
            result = result.replaceAll(img.src, `assets/${img.filename}`);
        }
    }

    return result;
}
