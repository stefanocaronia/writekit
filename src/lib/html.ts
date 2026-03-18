import { readFile } from "node:fs/promises";
import { extname } from "node:path";
import { marked } from "./markdown.js";
import { embedImagesAsBase64 } from "./images.js";
import type { BookConfig, Chapter, Contributor } from "./parse.js";
import type { Theme } from "./theme.js";
import { buildColophonLines, formatAuthors } from "./metadata.js";
import { getLabels } from "./i18n.js";
import type { Typography, Labels as TypoLabels } from "./typography.js";
import { typographyClasses, typographyCssVars, formatPartHeading, formatChapterHeading } from "./typography.js";
import type { Section } from "./project-type.js";

const JS = `
    // Smooth scroll for TOC links
    document.querySelectorAll('.toc a').forEach(a => {
        a.addEventListener('click', e => {
            e.preventDefault();
            const target = document.querySelector(a.getAttribute('href'));
            if (target) target.scrollIntoView({ behavior: 'smooth' });
        });
    });

    // Chapter nav smooth scroll
    document.querySelectorAll('.chapter-nav a').forEach(a => {
        a.addEventListener('click', e => {
            e.preventDefault();
            const target = document.querySelector(a.getAttribute('href'));
            if (target) target.scrollIntoView({ behavior: 'smooth' });
        });
    });
`;

function chapterId(index: number): string {
    return `chapter-${index + 1}`;
}

export async function renderBook(
    config: BookConfig,
    chapters: Chapter[],
    theme: Theme,
    contributors?: Contributor[],
    backcover?: string,
    coverImagePath?: string | null,
    projectDir?: string,
    typography?: Typography,
    sections?: Section[],
): Promise<string> {
    const has = (s: Section) => !sections || sections.includes(s);
    const labels = getLabels(config.language);

    // Render all chapters markdown to HTML
    const renderedChapters: string[] = [];
    for (const chapter of chapters) {
        const body = projectDir
            ? await embedImagesAsBase64(chapter.body, projectDir)
            : chapter.body;
        const html = await marked(body);
        renderedChapters.push(html);
    }

    // Cover image (separate page)
    let coverImageSection = "";
    if (has("cover") && coverImagePath) {
        try {
            const imgData = await readFile(coverImagePath);
            const ext = extname(coverImagePath).slice(1).replace("jpg", "jpeg");
            const base64 = imgData.toString("base64");
            coverImageSection = `
        <section class="cover-page">
            <img class="cover-image" src="data:image/${ext};base64,${base64}" alt="Cover" />
        </section>`;
        } catch { /* no cover image */ }
    }

    // Title page (full page for books) or title block (inline for papers)
    let titleSection = "";
    if (has("title_page")) {
        const seriesLine = config.series
            ? `<div class="subtitle">${escapeHtml(config.series)}${config.volume ? ` — Vol. ${config.volume}` : ""}</div>`
            : "";
        titleSection = `
        <header class="cover">
            <h1>${escapeHtml(config.title)}</h1>
            ${config.subtitle ? `<div class="subtitle">${escapeHtml(config.subtitle)}</div>` : ""}
            ${seriesLine}
            ${config.author ? `<div class="author">${escapeHtml(formatAuthors(config.author))}</div>` : ""}
        </header>`;
    } else if (has("title_block")) {
        // Academic style: title, authors, affiliations inline at top
        titleSection = `
        <header class="title-block">
            <h1>${escapeHtml(config.title)}</h1>
            ${config.author ? `<div class="author">${escapeHtml(formatAuthors(config.author))}</div>` : ""}
        </header>`;
    } else {
        // Minimal header for article-like types (content-only)
        const translatorLine = config.translator ? `<div class="translator">${escapeHtml(labels.translator)} ${escapeHtml(config.translator)}</div>` : "";
        titleSection = `
        <header class="article-header">
            <h1>${escapeHtml(config.title)}</h1>
            ${config.author ? `<div class="author">${escapeHtml(formatAuthors(config.author))}</div>` : ""}
            ${translatorLine}
        </header>`;
    }

    // Abstract (paper only)
    let abstractSection = "";
    if (has("abstract") && config.abstract) {
        abstractSection = `
        <section class="abstract">
            <h2>${escapeHtml(labels.abstract || "Abstract")}</h2>
            <p>${escapeHtml(config.abstract)}</p>
            ${config.keywords?.length ? `<p class="keywords"><strong>Keywords:</strong> ${config.keywords.map(escapeHtml).join(", ")}</p>` : ""}
        </section>`;
    }

    // Colophon
    let colophon = "";
    if (has("colophon")) {
        const colophonLines = buildColophonLines(config).map((line) => {
            if (config.license_url && line === config.license) {
                return `<a href="${escapeHtml(config.license_url)}" target="_blank" rel="noopener">${escapeHtml(line)}</a>`;
            }
            return escapeHtml(line);
        });
        if (colophonLines.length > 0) {
            colophon = `\n    <footer class="colophon">\n      ${colophonLines.map((l) => `<p>${l}</p>`).join("\n      ")}\n    </footer>`;
        }
    }

    // Parts support: only for non-paper types when at least one chapter has a part
    const hasParts = config.type !== "paper" && chapters.some((ch) => ch.part);
    const lang = config.language || "it";
    const typoLabels: TypoLabels = {
        part: labels.part,
        chapter_label: labels.chapter_label,
        partSuffix: labels.partSuffix,
        chapterSuffix: labels.chapterSuffix,
    };
    const chapterFormat = typography?.chapterHeading ?? "title";
    const partFormat = typography?.partHeading ?? "label_number_title";

    // Table of contents (only if section enabled and multiple chapters)
    const showToc = has("toc") && chapters.length > 1;
    let toc = "";
    if (showToc) {
        let tocItems = "";
        let currentPart: string | undefined;
        let partNum = 0;
        for (let i = 0; i < chapters.length; i++) {
            const ch = chapters[i];
            if (hasParts && !ch.sectionKind && ch.part && ch.part !== currentPart) {
                currentPart = ch.part;
                partNum++;
                const partText = formatPartHeading(partFormat, partNum, currentPart, typoLabels, lang);
                const partDisplay = partText.includes("\n") ? partText.split("\n").join(" — ") : partText;
                tocItems += `\n                <li class="toc-part">${escapeHtml(partDisplay)}</li>`;
            }
            tocItems += `\n                <li><a href="#${chapterId(i)}">${escapeHtml(ch.title)}${config.type === "collection" && ch.author ? ` <span class="toc-author">${escapeHtml(ch.author)}</span>` : ""}</a></li>`;
        }
        toc = `
        <nav class="toc">
            <h2>${escapeHtml(labels.tableOfContents)}</h2>
            <ol>${tocItems}
            </ol>
        </nav>`;
    }

    // Chapters with navigation (hidden for single chapter)
    let currentPartForDividers: string | undefined;
    let partDividerNum = 0;
    const chapterSections = renderedChapters
        .map((html, i) => {
            const nav = showToc
                ? (() => {
                    const prev = i > 0
                        ? `<a href="#${chapterId(i - 1)}">&larr; ${escapeHtml(chapters[i - 1].title)}</a>`
                        : "<span></span>";
                    const next = i < chapters.length - 1
                        ? `<a href="#${chapterId(i + 1)}">${escapeHtml(chapters[i + 1].title)} &rarr;</a>`
                        : "<span></span>";
                    const top = `<a href="#toc">${escapeHtml(labels.tableOfContents)}</a>`;
                    return `\n            <nav class="chapter-nav">\n                ${prev}\n                ${top}\n                ${next}\n            </nav>`;
                })()
                : "";

            // Front/back matter sections: simple rendering, no numbering/part/author
            if (chapters[i].sectionKind) {
                return `\n        <section class="chapter section-${chapters[i].sectionKind}" id="${chapterId(i)}">
            <h1>${escapeHtml(chapters[i].title)}</h1>
            ${html}${nav}
        </section>`;
            }

            // Chapter heading
            let headingHtml: string;
            if (chapterFormat === "title") {
                headingHtml = `<h1>${escapeHtml(chapters[i].title)}</h1>`;
            } else {
                const formatted = formatChapterHeading(chapterFormat, i + 1, chapters[i].title, typoLabels, lang);
                if (formatted.includes("\n")) {
                    const [numberLine, titleLine] = formatted.split("\n");
                    headingHtml = `<div class="chapter-number">${escapeHtml(numberLine)}</div>\n            <h1>${escapeHtml(titleLine)}</h1>`;
                } else {
                    headingHtml = `<h1>${escapeHtml(formatted)}</h1>`;
                }
            }

            // Part divider page
            let partPage = "";
            if (hasParts && chapters[i].part && chapters[i].part !== currentPartForDividers) {
                currentPartForDividers = chapters[i].part;
                partDividerNum++;
                const partFormatted = formatPartHeading(partFormat, partDividerNum, currentPartForDividers!, typoLabels, lang);
                if (partFormatted.includes("\n")) {
                    const [numLine, titleLine] = partFormatted.split("\n");
                    partPage = `\n        <section class="part-page">\n            <div class="part-number">${escapeHtml(numLine)}</div>\n            <h1>${escapeHtml(titleLine)}</h1>\n        </section>`;
                } else {
                    partPage = `\n        <section class="part-page">\n            <h1>${escapeHtml(partFormatted)}</h1>\n        </section>`;
                }
            }

            return `${partPage}
        <section class="chapter" id="${chapterId(i)}">
            ${headingHtml}${config.type === "collection" && chapters[i].author ? `\n            <div class="chapter-author">${escapeHtml(chapters[i].author!)}</div>` : ""}
            ${html}${nav}
        </section>`;
        })
        .join("\n");

    // Back cover
    const backcoverSection = has("backcover") && backcover
        ? `\n    <section class="backcover">\n      ${await marked(backcover)}\n    </section>`
        : "";

    // About the author(s)
    let aboutSection = "";
    if (has("about") && contributors && contributors.length > 0) {
        const NON_AUTHOR_ROLES = ["translator", "editor", "illustrator"];
        const bios = contributors
            .filter((c) => c.bio && !c.roles.every((r) => NON_AUTHOR_ROLES.includes(r)))
            .map((c) => `<p><strong>${escapeHtml(c.name)}</strong> ${escapeHtml(c.bio)}</p>`)
            .join("\n      ");
        if (bios) {
            aboutSection = `\n    <section class="about-authors">\n      <h2>${escapeHtml(labels.aboutTheAuthor)}</h2>\n      ${bios}\n    </section>`;
        }
    }

    return `<!DOCTYPE html>
<html lang="${config.language || "it"}">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${escapeHtml(config.title)}</title>
    <style>${theme.htmlCss}</style>
</head>
<body class="${typography ? typographyClasses(typography) : ""}" style="${typography ? typographyCssVars(typography) : ""}">
    ${coverImageSection}
    ${titleSection}${abstractSection}${showToc ? `\n    <div id="toc">${toc}</div>` : ""}
    ${chapterSections}${backcoverSection}${aboutSection}${colophon}
    <script>${JS}</script>
</body>
</html>`;
}

function escapeHtml(text: string): string {
    return text
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
}
