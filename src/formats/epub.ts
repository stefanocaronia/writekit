import { marked } from "../support/markdown.js";
import crypto from "node:crypto";
import yazl from "yazl";
import { createWriteStream } from "node:fs";
import { mkdir, readFile } from "node:fs/promises";
import { join, extname } from "node:path";
import { SECTION_LABEL_KEY } from "../project/parse.js";
import type { BookConfig, Chapter, Contributor } from "../project/parse.js";
import { fontFaceCss, type Theme } from "../support/theme.js";
import type { Section, TypeFeatures } from "../project/project-type.js";
import { buildColophonLines, formatAuthors } from "../support/metadata.js";
import { getLabels } from "../support/i18n.js";
import { collectImagePaths, rewriteImagePaths } from "../support/images.js";
import { loadTypography, formatPartHeading, formatChapterHeading } from "../support/typography.js";
import { typographyClasses, typographyCssVars } from "../support/typography.js";
import type { Labels as TypoLabels } from "../support/typography.js";

function escapeXml(text: string): string {
        return text
                .replace(/&/g, "&amp;")
                .replace(/</g, "&lt;")
                .replace(/>/g, "&gt;")
                .replace(/"/g, "&quot;");
}

/** Fix HTML to be XHTML compliant */
function fixXhtml(html: string): string {
        return html
                // Bare boolean attributes → add value
                .replace(/\sdata-footnote-ref(?=[\s>\/])/g, ' data-footnote-ref="true"')
                .replace(/\sdata-footnote-backref(?=[\s>\/])/g, ' data-footnote-backref="true"')
                .replace(/\sdata-footnotes(?=[\s>\/])/g, ' data-footnotes="true"')
                // Self-close void elements: <img ...> → <img ... /> (skip already closed)
                .replace(/<(img|br|hr|input|meta|link)(\s[^>]*?)?\s*(?<!\/)>/g, '<$1$2 />');
}

function wrapXhtml(title: string, body: string, lang: string, bodyClass = ""): string {
        const fixedBody = fixXhtml(body);
        return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xml:lang="${lang}" lang="${lang}">
<head>
    <meta charset="UTF-8" />
    <title>${escapeXml(title)}</title>
    <link rel="stylesheet" type="text/css" href="style.css" />
</head>
<body${bodyClass ? ` class="${bodyClass}"` : ""}>
${fixedBody}
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

function generateContentOpf(config: BookConfig, chapters: Chapter[], hasBackcover = false, hasAbout = false, coverExt?: string, imageFiles: { filename: string }[] = [], hasColophon = true, hasTitlePage = true, hasToc = true, fontFiles: { filename: string; mime: string }[] = []): string {
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
        ];
        const spineItems: string[] = [];

        if (hasTitlePage) {
                manifestItems.push(`    <item id="titlepage" href="titlepage.xhtml" media-type="application/xhtml+xml" />`);
                spineItems.push(`    <itemref idref="titlepage" />`);
        }
        if (hasToc) {
                manifestItems.push(`    <item id="toc" href="toc.xhtml" media-type="application/xhtml+xml" properties="nav" />`);
                spineItems.push(`    <itemref idref="toc" />`);
        }

        // Cover image
        if (coverExt) {
                const mimeMap: Record<string, string> = { jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", webp: "image/webp" };
                const mime = mimeMap[coverExt] ?? "image/jpeg";
                manifestItems.push(`    <item id="cover-image" href="cover.${coverExt}" media-type="${mime}" properties="cover-image" />`);
                manifestItems.push(`    <item id="cover" href="cover.xhtml" media-type="application/xhtml+xml" />`);
                spineItems.unshift(`    <itemref idref="cover" />`);
        }

        // Chapters (part headers are inline, no separate part files in ePub)
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

        // Add content images
        const imgMimeMap: Record<string, string> = { ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png", ".gif": "image/gif", ".webp": "image/webp", ".svg": "image/svg+xml" };
        for (let i = 0; i < imageFiles.length; i++) {
                const ext = imageFiles[i].filename.substring(imageFiles[i].filename.lastIndexOf("."));
                const mime = imgMimeMap[ext] ?? "image/jpeg";
                manifestItems.push(`    <item id="img-${i + 1}" href="images/${imageFiles[i].filename}" media-type="${mime}" />`);
        }

        // Add fonts
        for (let i = 0; i < fontFiles.length; i++) {
                manifestItems.push(`    <item id="font-${i + 1}" href="fonts/${fontFiles[i].filename}" media-type="${fontFiles[i].mime}" />`);
        }

        // Add colophon
        if (hasColophon) {
                manifestItems.push(`    <item id="colophon" href="colophon.xhtml" media-type="application/xhtml+xml" />`);
                spineItems.push(`    <itemref idref="colophon" />`);
        }

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

function generateTocXhtml(config: BookConfig, chapters: Chapter[], typoLabels: TypoLabels, partFormat: string, chapterFormat: string, lang: string, showChapterAuthor = false, supportsParts = true): string {
        const labels = getLabels(config.language);
        const hasParts = supportsParts && chapters.some((c) => c.part);
        const partHasLabel = partFormat === "label_number_title" || partFormat === "label_number";
        let items = "";
        let currentPart: string | undefined;
        let partNum = 0;
        let chapterNum = 0;
        for (let i = 0; i < chapters.length; i++) {
                if (hasParts && !chapters[i].sectionKind && chapters[i].part && chapters[i].part !== currentPart) {
                        currentPart = chapters[i].part;
                        partNum++;
                        const partText = formatPartHeading(partFormat as any, partNum, currentPart!, typoLabels, lang);
                        let partDisplay = partText.includes("\n") ? partText.split("\n").join(" — ") : partText;
                        if (partHasLabel) partDisplay = partDisplay.toUpperCase();
                        items += `\n      <li class="toc-part">${escapeXml(partDisplay)}</li>`;
                }
                if (chapters[i].toc === false) {
                        // Explicitly excluded from TOC
                } else if (chapters[i].sectionKind) {
                        const sLabel = chapters[i].title || (labels as any)[SECTION_LABEL_KEY[chapters[i].sectionKind!]] || chapters[i].sectionKind;
                        items += `\n      <li class="toc-chapter"><a href="chapter-${i + 1}.xhtml">${escapeXml(sLabel)}</a></li>`;
                } else {
                        chapterNum++;
                        const formatted = formatChapterHeading(chapterFormat as any, chapterNum, chapters[i].title, typoLabels, lang);
                        const tocLabel = formatted.includes("\n") ? formatted.split("\n").join(" — ") : formatted;
                        const authorSuffix = showChapterAuthor && chapters[i].author ? ` — ${escapeXml(chapters[i].author!)}` : "";
                        items += `\n      <li class="toc-chapter"><a href="chapter-${i + 1}.xhtml">${escapeXml(tocLabel)}${authorSuffix}</a></li>`;
                }
        }

        return wrapXhtml(
                labels.tableOfContents,
                `<nav xmlns:epub="http://www.idpf.org/2007/ops" epub:type="toc">
    <h1>${escapeXml(labels.tableOfContents)}</h1>
    <ul style="list-style:none;padding-left:0;margin-left:0">${items}
    </ul>
</nav>`,
                config.language || "it",
        );
}

function generateTitlePage(config: BookConfig): string {
        const c = "text-align:center;text-indent:0";
        const lines = [
                `<p style="font-size:2.8em;font-weight:bold;color:#2c2c2c;margin:0;padding:0;${c}">${escapeXml(config.title)}</p>`,
        ];
        if (config.subtitle) {
                lines.push(`<p style="font-size:1.3em;font-style:italic;color:#666;margin-top:0.8em;${c}">${escapeXml(config.subtitle)}</p>`);
        }
        if (config.series) {
                let s = escapeXml(config.series);
                if (config.volume) s += ` — Vol. ${config.volume}`;
                lines.push(`<p style="font-size:1em;color:#888;margin-top:0.5em;${c}">${s}</p>`);
        }
        if (config.author) {
                lines.push(`<p style="font-size:1.2em;margin-top:4em;color:#444;letter-spacing:0.05em;${c}">${escapeXml(formatAuthors(config.author))}</p>`);
        }

        return wrapXhtml(config.title, `<div style="margin-top:30%;text-align:center">\n${lines.join("\n")}\n</div>`, config.language || "it");
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
                ? `<div class="colophon">\n${lines.join("\n")}\n</div>`
                : `<div class="colophon"><p>&#160;</p></div>`;

        return wrapXhtml(labels.colophon, body, config.language || "it");
}

const NON_AUTHOR_ROLES = ["translator", "editor", "illustrator"];

function generateAboutAuthors(config: BookConfig, contributors: Contributor[]): string {
        const labels = getLabels(config.language);
        const bios = contributors
                .filter((c) => c.bio && !c.roles.every((r) => NON_AUTHOR_ROLES.includes(r)))
                .map((c) => `<p><strong>${escapeXml(c.name)}</strong> ${escapeXml(c.bio)}</p>`)
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
        coverImagePath?: string | null,
        sections?: Section[],
        features?: TypeFeatures,
): Promise<string> {
        const has = (s: Section) => !sections || sections.includes(s);
        const buildDir = join(projectDir, "build");
        await mkdir(buildDir, { recursive: true });
        const outPath = join(buildDir, filename);

        const typo = await loadTypography(projectDir);
        const typoClass = typographyClasses(typo);
        const typoVars = typographyCssVars(typo);

        const zip = new yazl.ZipFile();

        // mimetype must be first, uncompressed
        zip.addBuffer(Buffer.from("application/epub+zip"), "mimetype", { compress: false });

        // META-INF
        zip.addBuffer(Buffer.from(generateContainerXml()), "META-INF/container.xml");

        // Cover image
        let coverExt: string | undefined;
        if (has("cover") && coverImagePath) {
                try {
                        const imgData = await readFile(coverImagePath);
                        coverExt = extname(coverImagePath).slice(1).toLowerCase().replace("jpg", "jpeg");
                        if (coverExt === "jpeg") coverExt = "jpg"; // normalize for filename
                        zip.addBuffer(imgData, `OEBPS/cover.${coverExt}`);
                        const coverBody = `<div style="text-align:center"><img src="cover.${coverExt}" alt="Cover" style="max-width:100%;max-height:100%" /></div>`;
                        zip.addBuffer(Buffer.from(wrapXhtml("Cover", coverBody, config.language || "it")), "OEBPS/cover.xhtml");
                } catch { /* no cover */ }
        }

        // Collect images from all chapters
        const allBodies = chapters.map((c) => c.body).join("\n");
        const images = collectImagePaths(allBodies, projectDir);
        const pathMapping = new Map<string, string>();
        for (const img of images) {
                const imgData = await readFile(img.absPath);
                zip.addBuffer(imgData, `OEBPS/images/${img.filename}`);
                pathMapping.set(img.src, `images/${img.filename}`);
        }

        // OEBPS
        const hasBackcover = has("backcover") && !!backcover;
        const hasAbout = has("about") && contributors.some((c) => c.bio && !c.roles.every((r) => NON_AUTHOR_ROLES.includes(r)));
        const hasColophon = has("colophon");
        const hasTitlePage = true; // always emit: full, block, or article-header fallback
        const hasToc = has("toc") && chapters.length > 1;

        const lang = config.language || "it";
        const labels = getLabels(config.language);
        const typoLabels: TypoLabels = {
                part: labels.part,
                chapter_label: labels.chapter_label,
                partSuffix: labels.partSuffix,
                chapterSuffix: labels.chapterSuffix,
        };
        const hasParts = features?.supports_parts !== false && chapters.some((c) => c.part);
        const chapterFormat = typo.chapterHeading;
        const partFormat = typo.partHeading;

        // ePub: no separate part pages (reflowable format). Part headers are inline.

        zip.addBuffer(Buffer.from(generateContentOpf(config, chapters, hasBackcover, hasAbout, coverExt, images, hasColophon, hasTitlePage, hasToc, theme.fonts)), "OEBPS/content.opf");
        // Prepend typography CSS variables and font-face to theme CSS
        const fontCss = theme.fonts.length > 0 ? fontFaceCss(theme.fonts, "fonts/") + "\n" : "";
        const epubCss = `${fontCss}:root { ${typoVars} }\n${theme.epubCss}`;
        zip.addBuffer(Buffer.from(epubCss), "OEBPS/style.css");

        // Add font files to ePub archive
        for (const font of theme.fonts) {
            zip.addBuffer(font.data, `OEBPS/fonts/${font.filename}`);
        }

        // Title page
        if (has("title_page")) {
                zip.addBuffer(Buffer.from(generateTitlePage(config)), "OEBPS/titlepage.xhtml");
        } else if (has("title_block")) {
                const c = "text-align:center;text-indent:0";
                const tpLines = [
                        `<p style="font-size:2em;font-weight:bold;color:#2c2c2c;margin:0;padding:0;${c}">${escapeXml(config.title)}</p>`,
                ];
                if (config.author) {
                        tpLines.push(`<p style="font-size:1em;margin-top:1em;color:#444;${c}">${escapeXml(formatAuthors(config.author))}</p>`);
                }
                const tpBody = `<div style="margin-top:10%;text-align:center">\n${tpLines.join("\n")}\n</div>`;
                zip.addBuffer(Buffer.from(wrapXhtml(config.title, tpBody, lang)), "OEBPS/titlepage.xhtml");
        } else {
                const headerLines = [`<h1>${escapeXml(config.title)}</h1>`];
                if (config.author) {
                        headerLines.push(`<p class="author">${escapeXml(formatAuthors(config.author))}</p>`);
                }
                const hBody = `<div class="article-header">\n${headerLines.join("\n")}\n</div>`;
                zip.addBuffer(Buffer.from(wrapXhtml(config.title, hBody, lang)), "OEBPS/titlepage.xhtml");
        }

        // Table of contents
        if (hasToc) {
                zip.addBuffer(Buffer.from(generateTocXhtml(config, chapters, typoLabels, partFormat, chapterFormat, lang, features?.show_chapter_author === true, features?.supports_parts !== false)), "OEBPS/toc.xhtml");
        }

        // Parts and chapters
        let currentPartEpub: string | undefined;
        let partIdx = 0;
        let chapterBodyNum = 0;
        for (let i = 0; i < chapters.length; i++) {
                const chBody = rewriteImagePaths(chapters[i].body, pathMapping);

                // Front/back matter sections: simple rendering, no numbering/part/author
                if (chapters[i].sectionKind) {
                        const resolvedTitle = chapters[i].title || (labels as any)[SECTION_LABEL_KEY[chapters[i].sectionKind!]] || "";
                        const sectionHeading = chapters[i].showTitle !== false && resolvedTitle ? `<h1>${escapeXml(resolvedTitle)}</h1>\n` : "";
                        const sectionHtml = sectionHeading + await marked(chBody);
                        const xhtml = wrapXhtml(resolvedTitle || chapters[i].sectionKind || "", sectionHtml, lang, `${typoClass} section-${chapters[i].sectionKind}`);
                        zip.addBuffer(Buffer.from(xhtml), `OEBPS/chapter-${i + 1}.xhtml`);
                        continue;
                }

                // Part header (inline before first chapter of each part, no separate page)
                let partHeader = "";
                if (hasParts && chapters[i].part && chapters[i].part !== currentPartEpub) {
                        currentPartEpub = chapters[i].part;
                        partIdx++;
                        const partText = formatPartHeading(partFormat, partIdx, currentPartEpub!, typoLabels, lang);
                        const partLines = partText.split("\n");
                        if (partLines.length > 1) {
                                partHeader = `<div class="part-page"><div class="part-number">${escapeXml(partLines[0])}</div><h1>${escapeXml(partLines[1])}</h1></div>\n`;
                        } else {
                                partHeader = `<div class="part-page"><h1>${escapeXml(partLines[0])}</h1></div>\n`;
                        }
                }

                // Chapter heading
                chapterBodyNum++;
                const chAuthor = features?.show_chapter_author === true && chapters[i].author ? `<div class="chapter-author">${escapeXml(chapters[i].author!)}</div>\n` : "";
                let headingHtml: string;
                if (chapterFormat === "title") {
                        headingHtml = `<h1>${escapeXml(chapters[i].title)}</h1>`;
                } else {
                        const formatted = formatChapterHeading(chapterFormat, chapterBodyNum, chapters[i].title, typoLabels, lang);
                        if (formatted.includes("\n")) {
                                const [numLine, titleLine] = formatted.split("\n");
                                headingHtml = `<div class="chapter-number">${escapeXml(numLine)}</div>\n<h1>${escapeXml(titleLine)}</h1>`;
                        } else {
                                headingHtml = `<h1>${escapeXml(formatted)}</h1>`;
                        }
                }
                const htmlBody = `${partHeader}${headingHtml}\n${chAuthor}` + await marked(chBody);
                const xhtml = wrapXhtml(chapters[i].title, htmlBody, lang, typoClass);
                zip.addBuffer(Buffer.from(xhtml), `OEBPS/chapter-${i + 1}.xhtml`);
        }

        // Back cover
        if (hasBackcover) {
                zip.addBuffer(Buffer.from(generateBackcover(config, backcover)), "OEBPS/backcover.xhtml");
        }

        // About the author(s)
        if (hasAbout) {
                const aboutXhtml = generateAboutAuthors(config, contributors);
                if (aboutXhtml) {
                        zip.addBuffer(Buffer.from(aboutXhtml), "OEBPS/about.xhtml");
                }
        }

        // Colophon
        if (hasColophon) {
                zip.addBuffer(Buffer.from(generateColophon(config)), "OEBPS/colophon.xhtml");
        }

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
