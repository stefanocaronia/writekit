import { marked } from "marked";
import type { BookConfig, Chapter } from "./parse.js";
import type { Theme } from "./theme.js";
import { buildColophonLines, formatAuthors } from "./metadata.js";

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
): Promise<string> {
    // Render all chapters markdown to HTML
    const renderedChapters: string[] = [];
    for (const chapter of chapters) {
        const html = await marked(chapter.body);
        renderedChapters.push(html);
    }

    // Cover
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
        ? `\n    <footer class="colophon">\n      <h2>Colophon</h2>\n      ${colophonLines.map((l) => `<p>${l}</p>`).join("\n      ")}\n    </footer>`
        : "";

    // Table of contents
    const tocItems = chapters
        .map(
            (ch, i) =>
                `<li><a href="#${chapterId(i)}">${escapeHtml(ch.title)}</a></li>`,
        )
        .join("\n        ");

    const toc = `
        <nav class="toc">
            <h2>Indice</h2>
            <ol>
                ${tocItems}
            </ol>
        </nav>`;

    // Chapters with navigation
    const chapterSections = renderedChapters
        .map((html, i) => {
            const prev =
                i > 0
                    ? `<a href="#${chapterId(i - 1)}">&larr; ${escapeHtml(chapters[i - 1].title)}</a>`
                    : "<span></span>";
            const next =
                i < chapters.length - 1
                    ? `<a href="#${chapterId(i + 1)}">${escapeHtml(chapters[i + 1].title)} &rarr;</a>`
                    : "<span></span>";
            const top = `<a href="#toc">Indice</a>`;

            return `
        <section class="chapter" id="${chapterId(i)}">
            ${html}
            <nav class="chapter-nav">
                ${prev}
                ${top}
                ${next}
            </nav>
        </section>`;
        })
        .join("\n");

    return `<!DOCTYPE html>
<html lang="${config.language || "it"}">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${escapeHtml(config.title)}</title>
    <style>${theme.htmlCss}</style>
</head>
<body>
    ${cover}
    <div id="toc">${toc}</div>
    ${chapterSections}${colophon}
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
