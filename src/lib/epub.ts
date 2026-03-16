import { marked } from "marked";
import crypto from "node:crypto";
import yazl from "yazl";
import { createWriteStream } from "node:fs";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import type { BookConfig, Chapter, Contributor } from "./parse.js";
import type { Theme } from "./theme.js";
import { buildColophonLines, formatAuthors } from "./metadata.js";
import { getLabels } from "./i18n.js";

function escapeXml(text: string): string {
        return text
                .replace(/&/g, "&amp;")
                .replace(/</g, "&lt;")
                .replace(/>/g, "&gt;")
                .replace(/"/g, "&quot;");
}

function wrapXhtml(title: string, body: string, lang: string): string {
        return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xml:lang="${lang}" lang="${lang}">
<head>
    <meta charset="UTF-8" />
    <title>${escapeXml(title)}</title>
    <link rel="stylesheet" type="text/css" href="style.css" />
</head>
<body>
${body}
</body>
</html>`;
}

function generateContainerXml(): string {
        return `<?xml version="1.0" encoding="UTF-8"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
    <rootfiles>
        <rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml" />
    </rootfiles>
</container>`;
}

function generateContentOpf(config: BookConfig, chapters: Chapter[], hasBackcover = false, hasAbout = false): string {
        const uuid = `urn:uuid:${simpleUuid()}`;

        const metadataLines = [
                `    <dc:identifier id="BookId">${config.isbn ? escapeXml(config.isbn) : uuid}</dc:identifier>`,
                `    <dc:title>${escapeXml(config.title)}</dc:title>`,
                `    <dc:language>${config.language || "it"}</dc:language>`,
        ];
        if (config.author) {
            const authors = Array.isArray(config.author) ? config.author : [config.author];
            for (const a of authors) {
                if (a) metadataLines.push(`    <dc:creator>${escapeXml(a)}</dc:creator>`);
            }
        }
        if (config.publisher) metadataLines.push(`    <dc:publisher>${escapeXml(config.publisher)}</dc:publisher>`);
        if (config.copyright) metadataLines.push(`    <dc:rights>${escapeXml(config.copyright)}</dc:rights>`);
        if (config.date) metadataLines.push(`    <dc:date>${escapeXml(String(config.date))}</dc:date>`);

        const manifestItems = [
                `    <item id="style" href="style.css" media-type="text/css" />`,
                `    <item id="titlepage" href="titlepage.xhtml" media-type="application/xhtml+xml" />`,
                `    <item id="toc" href="toc.xhtml" media-type="application/xhtml+xml" properties="nav" />`,
        ];
        const spineItems = [
                `    <itemref idref="titlepage" />`,
                `    <itemref idref="toc" />`,
        ];

        for (let i = 0; i < chapters.length; i++) {
                const id = `chapter-${i + 1}`;
                manifestItems.push(`    <item id="${id}" href="${id}.xhtml" media-type="application/xhtml+xml" />`);
                spineItems.push(`    <itemref idref="${id}" />`);
        }

        // Add back cover
        if (hasBackcover) {
                manifestItems.push(`    <item id="backcover" href="backcover.xhtml" media-type="application/xhtml+xml" />`);
                spineItems.push(`    <itemref idref="backcover" />`);
        }

        // Add about the author(s)
        if (hasAbout) {
                manifestItems.push(`    <item id="about" href="about.xhtml" media-type="application/xhtml+xml" />`);
                spineItems.push(`    <itemref idref="about" />`);
        }

        // Add colophon
        manifestItems.push(`    <item id="colophon" href="colophon.xhtml" media-type="application/xhtml+xml" />`);
        spineItems.push(`    <itemref idref="colophon" />`);

        return `<?xml version="1.0" encoding="UTF-8"?>
<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="BookId">
    <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
${metadataLines.join("\n")}
        <meta property="dcterms:modified">${new Date().toISOString().replace(/\.\d+Z$/, "Z")}</meta>
    </metadata>
    <manifest>
${manifestItems.join("\n")}
    </manifest>
    <spine>
${spineItems.join("\n")}
    </spine>
</package>`;
}

function generateTocXhtml(config: BookConfig, chapters: Chapter[]): string {
        const labels = getLabels(config.language);
        const items = chapters
                .map(
                        (ch, i) =>
                                `      <li><a href="chapter-${i + 1}.xhtml">${escapeXml(ch.title)}</a></li>`,
                )
                .join("\n");

        return wrapXhtml(
                labels.tableOfContents,
                `<nav xmlns:epub="http://www.idpf.org/2007/ops" epub:type="toc">
    <h1>${escapeXml(labels.tableOfContents)}</h1>
    <ol>
${items}
    </ol>
</nav>`,
                config.language || "it",
        );
}

function generateTitlePage(config: BookConfig): string {
        const lines = [`<h1>${escapeXml(config.title)}</h1>`];
        if (config.subtitle) lines.push(`<p style="font-style:italic;color:#666">${escapeXml(config.subtitle)}</p>`);
        if (config.series) {
                let s = escapeXml(config.series);
                if (config.volume) s += ` — Vol. ${config.volume}`;
                lines.push(`<p style="color:#666">${s}</p>`);
        }
        if (config.author) lines.push(`<p style="margin-top:2em">${escapeXml(formatAuthors(config.author))}</p>`);

        return wrapXhtml(config.title, `<div style="text-align:center;padding-top:4em">\n${lines.join("\n")}\n</div>`, config.language || "it");
}

function generateColophon(config: BookConfig): string {
        const labels = getLabels(config.language);
        const rawLines = buildColophonLines(config);
        const lines = rawLines.map((line) => {
                if (config.license_url && line === config.license) {
                        return `<p><a href="${escapeXml(config.license_url)}">${escapeXml(line)}</a></p>`;
                }
                return `<p>${escapeXml(line)}</p>`;
        });

        const body = lines.length > 0
                ? `<div class="colophon">\n<h1>${escapeXml(labels.colophon)}</h1>\n${lines.join("\n")}\n</div>`
                : `<div class="colophon"><p>&#160;</p></div>`;

        return wrapXhtml(labels.colophon, body, config.language || "it");
}

function generateAboutAuthors(config: BookConfig, contributors: Contributor[]): string {
        const labels = getLabels(config.language);
        const bios = contributors
                .filter((c) => c.bio)
                .map((c) => `<p><strong>${escapeXml(c.name)}</strong></p>\n<p>${escapeXml(c.bio)}</p>`)
                .join("\n");
        if (!bios) return "";
        return wrapXhtml(labels.aboutTheAuthor, `<div class="about-authors">\n<h1>${escapeXml(labels.aboutTheAuthor)}</h1>\n${bios}\n</div>`, config.language || "it");
}

function generateBackcover(config: BookConfig, backcover: string): string {
        const body = `<div class="backcover">\n${marked(backcover)}\n</div>`;
        return wrapXhtml("Back Cover", body, config.language || "it");
}

function simpleUuid(): string {
        return crypto.randomUUID();
}

export async function buildEpub(
        projectDir: string,
        config: BookConfig,
        chapters: Chapter[],
        theme: Theme,
        filename = "book.epub",
        contributors: Contributor[] = [],
        backcover = "",
): Promise<string> {
        const buildDir = join(projectDir, "build");
        await mkdir(buildDir, { recursive: true });
        const outPath = join(buildDir, filename);

        const zip = new yazl.ZipFile();

        // mimetype must be first, uncompressed
        zip.addBuffer(Buffer.from("application/epub+zip"), "mimetype", { compress: false });

        // META-INF
        zip.addBuffer(Buffer.from(generateContainerXml()), "META-INF/container.xml");

        // OEBPS
        const hasBackcover = !!backcover;
        const hasAbout = contributors.some((c) => c.bio);
        zip.addBuffer(Buffer.from(generateContentOpf(config, chapters, hasBackcover, hasAbout)), "OEBPS/content.opf");
        zip.addBuffer(Buffer.from(theme.epubCss), "OEBPS/style.css");
        zip.addBuffer(Buffer.from(generateTitlePage(config)), "OEBPS/titlepage.xhtml");
        zip.addBuffer(Buffer.from(generateTocXhtml(config, chapters)), "OEBPS/toc.xhtml");

        // Chapters
        for (let i = 0; i < chapters.length; i++) {
                const htmlBody = await marked(chapters[i].body);
                const xhtml = wrapXhtml(chapters[i].title, htmlBody, config.language || "it");
                zip.addBuffer(Buffer.from(xhtml), `OEBPS/chapter-${i + 1}.xhtml`);
        }

        // Back cover
        if (backcover) {
                zip.addBuffer(Buffer.from(generateBackcover(config, backcover)), "OEBPS/backcover.xhtml");
        }

        // About the author(s)
        const aboutXhtml = generateAboutAuthors(config, contributors);
        if (aboutXhtml) {
                zip.addBuffer(Buffer.from(aboutXhtml), "OEBPS/about.xhtml");
        }

        // Colophon
        zip.addBuffer(Buffer.from(generateColophon(config)), "OEBPS/colophon.xhtml");

        // Write to disk
        await new Promise<void>((resolve, reject) => {
                zip.outputStream
                        .pipe(createWriteStream(outPath))
                        .on("close", resolve)
                        .on("error", reject);
                zip.end();
        });

        return outPath;
}
