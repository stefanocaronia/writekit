import { readFile } from "node:fs/promises";
import { extname } from "node:path";
import { marked } from "./markdown.js";
import { embedImagesAsBase64 } from "./images.js";
import type { BookConfig, Chapter, Contributor } from "./parse.js";
import type { Theme } from "./theme.js";
import { buildColophonLines, formatAuthors } from "./metadata.js";
import { getLabels } from "./i18n.js";
import type { Typography } from "./typography.js";
import { typographyClasses, typographyCssVars } from "./typography.js";
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

    // Table of contents (only if section enabled and multiple chapters)
    const showToc = has("toc") && chapters.length > 1;
    const toc = showToc
        ? `
        <nav class="toc">
            <h2>${escapeHtml(labels.tableOfContents)}</h2>
            <ol>
                ${chapters.map((ch, i) => `<li><a href="#${chapterId(i)}">${escapeHtml(ch.title)}</a></li>`).join("\n                ")}
            </ol>
        </nav>`
        : "";

    // Chapters with navigation (hidden for single chapter)
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

            return `
        <section class="chapter" id="${chapterId(i)}">
            <h1>${escapeHtml(chapters[i].title)}</h1>
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
        const bios = contributors
            .filter((c) => c.bio)
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
