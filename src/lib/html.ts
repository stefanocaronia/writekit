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
): Promise<string> {
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

    // Cover image
    // Cover image (separate page)
    let coverImageSection = "";
    if (coverImagePath) {
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

    // Title page
    const seriesLine = config.series
        ? `<div class="subtitle">${escapeHtml(config.series)}${config.volume ? ` — Vol. ${config.volume}` : ""}</div>`
        : "";
    const cover = `
        <header class="cover">
            <h1>${escapeHtml(config.title)}</h1>
            ${config.subtitle ? `<div class="subtitle">${escapeHtml(config.subtitle)}</div>` : ""}
            ${seriesLine}
            ${config.author ? `<div class="author">${escapeHtml(formatAuthors(config.author))}</div>` : ""}
        </header>`;

    // Colophon
    const colophonLines = buildColophonLines(config).map((line) => {
        // Make license a link if URL is provided
        if (config.license_url && line === config.license) {
            return `<a href="${escapeHtml(config.license_url)}" target="_blank" rel="noopener">${escapeHtml(line)}</a>`;
        }
        return escapeHtml(line);
    });

    const colophon = colophonLines.length > 0
        ? `\n    <footer class="colophon">\n      ${colophonLines.map((l) => `<p>${l}</p>`).join("\n      ")}\n    </footer>`
        : "";

    // Table of contents (hidden for single chapter)
    const showToc = chapters.length > 1;
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
    const backcoverSection = backcover
        ? `\n    <section class="backcover">\n      ${await marked(backcover)}\n    </section>`
        : "";

    // About the author(s)
    let aboutSection = "";
    if (contributors && contributors.length > 0) {
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
    ${cover}${showToc ? `\n    <div id="toc">${toc}</div>` : ""}
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
