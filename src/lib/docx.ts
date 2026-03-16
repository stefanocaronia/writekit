import {
    Document,
    Packer,
    Paragraph,
    TextRun,
    HeadingLevel,
    AlignmentType,
    BorderStyle,
    ExternalHyperlink,
    FootnoteReferenceRun,
    ImageRun,
    TableOfContents,
    Table,
    TableRow,
    TableCell,
    WidthType,
    LevelFormat,
    convertInchesToTwip,
} from "docx";
import { mkdir, writeFile, readFile } from "node:fs/promises";
import { join } from "node:path";
import type { BookConfig, Chapter, Contributor } from "./parse.js";
import { buildColophonLines, formatAuthors } from "./metadata.js";
import { collectImagePaths } from "./images.js";
import { getLabels } from "./i18n.js";
import type { DocxStyle } from "./theme.js";
import { resolveTemplatePath, extractStylesXml } from "./docx-template.js";

// Module-level style, set by buildDocx before rendering
let FONT = "Georgia";
let ACCENT = "8B4513";
let TEXT_COLOR = "2C2C2C";
let MUTED = "666666";

// ── Inline parsing ──────────────────────────────────────────────────────────

const INLINE_PATTERNS: {
    regex: RegExp;
    factory: (m: RegExpMatchArray) => TextRun | ExternalHyperlink;
}[] = [
    // inline code `text`
    {
        regex: /`([^`]+)`/,
        factory: (m) =>
            new TextRun({
                text: m[1],
                font: "Consolas",
                size: 20,
                color: "C7254E",
                shading: { fill: "F9F2F4" },
            }),
    },
    // ***bold italic***
    {
        regex: /\*\*\*(.+?)\*\*\*/,
        factory: (m) =>
            new TextRun({ text: m[1], bold: true, italics: true, font: FONT }),
    },
    // **bold**
    {
        regex: /\*\*(.+?)\*\*/,
        factory: (m) =>
            new TextRun({ text: m[1], bold: true, font: FONT }),
    },
    // *italic* or _italic_
    {
        regex: /(\*(.+?)\*|_(.+?)_)/,
        factory: (m) =>
            new TextRun({ text: m[2] || m[3], italics: true, font: FONT }),
    },
    // [text](url)
    {
        regex: /\[([^\]]+)\]\(([^)]+)\)/,
        factory: (m) =>
            new ExternalHyperlink({
                link: m[2],
                children: [
                    new TextRun({
                        text: m[1],
                        font: FONT,
                        color: "2E74B5",
                        underline: {},
                    }),
                ],
            }),
    },
];

// ── Footnote extraction ─────────────────────────────────────────────────────

interface FootnoteMap {
    defs: Map<string, string>;       // id -> footnote text
    idToNum: Map<string, number>;    // id -> sequential number (3+ to avoid Word reserved IDs 1-2)
}

function extractFootnotes(markdown: string): FootnoteMap {
    const defs = new Map<string, string>();
    const idToNum = new Map<string, number>();
    // Word reserves footnote IDs 1 (separator) and 2 (continuation separator)
    let num = 3;

    // Extract definitions: [^id]: text
    const defRegex = /^\[\^([^\]]+)\]:\s*(.+)$/gm;
    let match;
    while ((match = defRegex.exec(markdown)) !== null) {
        const id = match[1];
        defs.set(id, match[2]);
        if (!idToNum.has(id)) {
            idToNum.set(id, num++);
        }
    }

    // Also scan for references to assign numbers for any not yet seen
    const refRegex = /\[\^([^\]]+)\]/g;
    while ((match = refRegex.exec(markdown)) !== null) {
        const id = match[1];
        if (!idToNum.has(id)) {
            idToNum.set(id, num++);
        }
    }

    return { defs, idToNum };
}

function stripFootnoteDefinitions(markdown: string): string {
    return markdown.replace(/^\[\^[^\]]+\]:\s*.+$/gm, "").trim();
}

// ── Inline parsing ──────────────────────────────────────────────────────────

function parseInline(
    text: string,
    footnotes?: FootnoteMap,
): (TextRun | ExternalHyperlink | FootnoteReferenceRun)[] {
    const result: (TextRun | ExternalHyperlink | FootnoteReferenceRun)[] = [];
    let remaining = text;

    while (remaining.length > 0) {
        let earliestIndex = Infinity;
        let earliestMatch: RegExpMatchArray | null = null;
        let earliestPattern: (typeof INLINE_PATTERNS)[0] | null = null;

        for (const pattern of INLINE_PATTERNS) {
            const match = remaining.match(pattern.regex);
            if (match && match.index !== undefined && match.index < earliestIndex) {
                earliestIndex = match.index;
                earliestMatch = match;
                earliestPattern = pattern;
            }
        }

        // Check for footnote reference [^id]
        const fnMatch = remaining.match(/\[\^([^\]]+)\]/);
        const fnIndex = fnMatch?.index ?? Infinity;

        if (fnMatch && fnIndex < earliestIndex && footnotes) {
            if (fnIndex > 0) {
                result.push(new TextRun({ text: remaining.slice(0, fnIndex), font: FONT }));
            }
            const fnId = fnMatch[1];
            const fnNum = footnotes.idToNum.get(fnId);
            if (fnNum !== undefined) {
                result.push(new FootnoteReferenceRun(fnNum));
            }
            remaining = remaining.slice(fnIndex + fnMatch[0].length);
            continue;
        }

        if (!earliestMatch || !earliestPattern) {
            result.push(new TextRun({ text: remaining, font: FONT }));
            break;
        }

        if (earliestIndex > 0) {
            result.push(
                new TextRun({ text: remaining.slice(0, earliestIndex), font: FONT }),
            );
        }

        result.push(earliestPattern.factory(earliestMatch));
        remaining = remaining.slice(earliestIndex + earliestMatch[0].length);
    }

    return result;
}

// ── Block parsing ───────────────────────────────────────────────────────────

function parseMarkdownToDocx(markdown: string, footnotes?: FootnoteMap, imageData?: Map<string, { data: Buffer; width: number; height: number }>): Paragraph[] {
    const paragraphs: Paragraph[] = [];
    const lines = markdown.split("\n");
    let i = 0;

    while (i < lines.length) {
        const line = lines[i];

        // Skip empty lines
        if (line.trim() === "") {
            i++;
            continue;
        }

        // Headings
        const headingMatch = line.match(/^(#{1,3})\s+(.+)/);
        if (headingMatch) {
            const level = headingMatch[1].length as 1 | 2 | 3;
            const headingMap = {
                1: HeadingLevel.HEADING_1,
                2: HeadingLevel.HEADING_2,
                3: HeadingLevel.HEADING_3,
            };
            paragraphs.push(
                new Paragraph({
                    heading: headingMap[level],
                    children: parseInline(headingMatch[2], footnotes),
                    spacing: { before: 400, after: level === 1 ? 300 : 200 },
                }),
            );
            i++;
            continue;
        }

        // Horizontal rule
        if (/^(-{3,}|\*{3,}|_{3,})$/.test(line.trim())) {
            paragraphs.push(
                new Paragraph({
                    alignment: AlignmentType.CENTER,
                    children: [new TextRun({ text: "* * *", color: MUTED, font: FONT })],
                    spacing: { before: 400, after: 400 },
                }),
            );
            i++;
            continue;
        }

        // Code block (fenced)
        if (line.trim().startsWith("```")) {
            i++;
            const codeLines: string[] = [];
            while (i < lines.length && !lines[i].trim().startsWith("```")) {
                codeLines.push(lines[i]);
                i++;
            }
            if (i < lines.length) i++; // skip closing ```

            for (const codeLine of codeLines) {
                paragraphs.push(
                    new Paragraph({
                        children: [
                            new TextRun({
                                text: codeLine || " ",
                                font: "Consolas",
                                size: 18,
                            }),
                        ],
                        shading: { fill: "F5F5F5" },
                        spacing: { after: 40 },
                    }),
                );
            }
            continue;
        }

        // Blockquote (multi-line)
        if (line.startsWith("> ") || line === ">") {
            const quoteLines: string[] = [];
            while (i < lines.length && (lines[i].startsWith("> ") || lines[i] === ">")) {
                quoteLines.push(lines[i].slice(2));
                i++;
            }
            paragraphs.push(
                new Paragraph({
                    children: parseInline(quoteLines.join(" "), footnotes),
                    indent: { left: 720 },
                    border: {
                        left: {
                            style: BorderStyle.SINGLE,
                            size: 6,
                            color: "CCCCCC",
                            space: 10,
                        },
                    },
                    spacing: { before: 200, after: 200 },
                }),
            );
            continue;
        }

        // Unordered list
        if (/^\s*[-*+]\s+/.test(line)) {
            while (i < lines.length && /^\s*[-*+]\s+/.test(lines[i])) {
                const text = lines[i].replace(/^\s*[-*+]\s+/, "");
                paragraphs.push(
                    new Paragraph({
                        children: parseInline(text, footnotes),
                        numbering: { reference: "bullet-list", level: 0 },
                        spacing: { after: 80 },
                    }),
                );
                i++;
            }
            continue;
        }

        // Ordered list
        if (/^\s*\d+\.\s+/.test(line)) {
            while (i < lines.length && /^\s*\d+\.\s+/.test(lines[i])) {
                const text = lines[i].replace(/^\s*\d+\.\s+/, "");
                paragraphs.push(
                    new Paragraph({
                        children: parseInline(text, footnotes),
                        numbering: { reference: "numbered-list", level: 0 },
                        spacing: { after: 80 },
                    }),
                );
                i++;
            }
            continue;
        }

        // Image ![alt](path)
        const imgMatch = line.match(/^!\[([^\]]*)\]\(([^)]+)\)\s*$/);
        if (imgMatch && imageData) {
            const src = imgMatch[2];
            const img = imageData.get(src);
            if (img) {
                paragraphs.push(
                    new Paragraph({
                        alignment: AlignmentType.CENTER,
                        spacing: { before: 200, after: 200 },
                        children: [
                            new ImageRun({
                                data: img.data,
                                transformation: { width: img.width, height: img.height },
                                type: "jpg",
                            }),
                        ],
                    }),
                );
                i++;
                continue;
            }
        }

        // Regular paragraph
        paragraphs.push(
            new Paragraph({
                children: parseInline(line, footnotes),
                alignment: AlignmentType.JUSTIFIED,
                spacing: { after: 200 },
            }),
        );
        i++;
    }

    return paragraphs;
}

// ── Table support ───────────────────────────────────────────────────────────
// Tables and paragraphs need to coexist in section children.
// We parse markdown into a mixed array, then flatten for the section.

function parseMarkdownToDocxBlocks(
    markdown: string,
    footnotes?: FootnoteMap,
    imageData?: Map<string, { data: Buffer; width: number; height: number }>,
): (Paragraph | Table)[] {
    const blocks: (Paragraph | Table)[] = [];
    const cleaned = footnotes ? stripFootnoteDefinitions(markdown) : markdown;
    const lines = cleaned.split("\n");
    let i = 0;

    while (i < lines.length) {
        const line = lines[i];

        if (line.trim() === "") {
            i++;
            continue;
        }

        // Table detection
        if (line.includes("|") && i + 1 < lines.length && /^\|?\s*[-:]+/.test(lines[i + 1])) {
            const tableRows: string[][] = [];
            while (i < lines.length && lines[i].includes("|")) {
                const cells = lines[i]
                    .split("|")
                    .map((c) => c.trim())
                    .filter((c) => c !== "" && !/^[-:]+$/.test(c));
                if (cells.length > 0) tableRows.push(cells);
                i++;
            }

            if (tableRows.length > 0) {
                const colCount = Math.max(...tableRows.map((r) => r.length));
                const rows = tableRows.map(
                    (cells, rowIdx) =>
                        new TableRow({
                            children: Array.from({ length: colCount }, (_, ci) =>
                                new TableCell({
                                    width: { size: Math.floor(9000 / colCount), type: WidthType.DXA },
                                    children: [
                                        new Paragraph({
                                            children: parseInline(cells[ci] || "", footnotes),
                                            spacing: { before: 40, after: 40 },
                                        }),
                                    ],
                                    shading: rowIdx === 0 ? { fill: "F0F0F0" } : undefined,
                                }),
                            ),
                        }),
                );

                blocks.push(
                    new Table({
                        rows,
                        width: { size: 9000, type: WidthType.DXA },
                    }),
                );
            }
            continue;
        }

        // Delegate everything else to paragraph parser (one line at a time for non-table)
        // Collect lines until table or end
        const nonTableLines: string[] = [];
        while (
            i < lines.length &&
            !(
                lines[i].includes("|") &&
                i + 1 < lines.length &&
                /^\|?\s*[-:]+/.test(lines[i + 1])
            )
        ) {
            nonTableLines.push(lines[i]);
            i++;
        }

        blocks.push(...parseMarkdownToDocx(nonTableLines.join("\n"), footnotes, imageData));
    }

    return blocks;
}

// ── Document builder ────────────────────────────────────────────────────────

const PAGE_A5 = { width: 8391, height: 11906 };

export async function buildDocx(
    projectDir: string,
    config: BookConfig,
    chapters: Chapter[],
    filename = "book.docx",
    contributors: Contributor[] = [],
    backcover = "",
    coverImagePath?: string | null,
    docxStyle?: DocxStyle,
    themeDir?: string,
): Promise<string> {
    // Apply theme style
    if (docxStyle) {
        FONT = docxStyle.font;
        ACCENT = docxStyle.accent_color;
        TEXT_COLOR = docxStyle.text_color;
        MUTED = docxStyle.muted_color;
    }
    const buildDir = join(projectDir, "build");
    await mkdir(buildDir, { recursive: true });

    const sections: {
        properties: { page: { size: typeof PAGE_A5 } };
        children: (Paragraph | Table)[];
    }[] = [];

    // Cover image page
    if (coverImagePath) {
        try {
            const { ImageRun } = await import("docx");
            const imgData = await readFile(coverImagePath);
            sections.push({
                properties: { page: { size: PAGE_A5 } },
                children: [
                    new Paragraph({
                        alignment: AlignmentType.CENTER,
                        children: [
                            new ImageRun({
                                data: imgData,
                                transformation: { width: 400, height: 580 },
                                type: "jpg",
                            }),
                        ],
                    }),
                ],
            });
        } catch { /* skip cover if error */ }
    }

    // Title page
    const titleChildren: Paragraph[] = [
        new Paragraph({ spacing: { before: 4000 } }),
        new Paragraph({
            alignment: AlignmentType.CENTER,
            heading: HeadingLevel.TITLE,
            children: [new TextRun({ text: config.title, font: FONT, size: 56 })],
        }),
    ];

    if (config.subtitle) {
        titleChildren.push(
            new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [
                    new TextRun({
                        text: config.subtitle,
                        font: FONT,
                        size: 28,
                        italics: true,
                        color: MUTED,
                    }),
                ],
                spacing: { before: 200 },
            }),
        );
    }

    if (config.author) {
        titleChildren.push(
            new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [
                    new TextRun({
                        text: formatAuthors(config.author),
                        font: FONT,
                        size: 24,
                        color: MUTED,
                    }),
                ],
                spacing: { before: 600 },
            }),
        );
    }

    sections.push({
        properties: { page: { size: PAGE_A5 } },
        children: titleChildren,
    });

    // Table of Contents
    const labels = getLabels(config.language);
    sections.push({
        properties: { page: { size: PAGE_A5 } },
        children: [
            new Paragraph({
                heading: HeadingLevel.HEADING_2,
                children: [
                    new TextRun({ text: labels.tableOfContents, font: FONT, color: ACCENT }),
                ],
                spacing: { before: 400, after: 400 },
            }),
            new TableOfContents("TOC", {
                hyperlink: true,
                headingStyleRange: "1-1",
            }),
        ],
    });

    // Extract footnotes from all chapters
    const allMarkdown = chapters.map((c) => c.body).join("\n\n");
    const footnotes = extractFootnotes(allMarkdown);

    // Build Document footnotes config
    const docFootnotes: Record<number, { children: Paragraph[] }> = {};
    for (const [id, num] of footnotes.idToNum) {
        const text = footnotes.defs.get(id) ?? "";
        docFootnotes[num] = {
            children: [new Paragraph({
                children: [new TextRun({ text, font: FONT, size: 18 })],
            })],
        };
    }

    // Collect images from all chapters
    const allBodies = chapters.map((c) => c.body).join("\n");
    const imgPaths = collectImagePaths(allBodies, projectDir);
    const imageDataMap = new Map<string, { data: Buffer; width: number; height: number }>();
    for (const img of imgPaths) {
        try {
            const data = await readFile(img.absPath);
            // Default reasonable size for DOCX (400x300), could be improved with image-size lib
            imageDataMap.set(img.src, { data, width: 400, height: 300 });
        } catch { /* skip */ }
    }

    // Chapters
    for (const chapter of chapters) {
        const children: (Paragraph | Table)[] = [
            new Paragraph({
                heading: HeadingLevel.HEADING_1,
                children: [
                    new TextRun({
                        text: chapter.title,
                        font: FONT,
                        size: 36,
                        color: ACCENT,
                    }),
                ],
                spacing: { before: 600, after: 400 },
            }),
            ...parseMarkdownToDocxBlocks(chapter.body, footnotes, imageDataMap),
        ];

        sections.push({
            properties: { page: { size: PAGE_A5 } },
            children,
        });
    }

    // Back cover
    if (backcover) {
        sections.push({
            properties: { page: { size: PAGE_A5 } },
            children: parseMarkdownToDocxBlocks(backcover),
        });
    }

    // About the author(s)
    const contribsWithBio = contributors.filter((c) => c.bio);
    if (contribsWithBio.length > 0) {
        const aboutChildren: Paragraph[] = [
            new Paragraph({
                heading: HeadingLevel.HEADING_2,
                children: [
                    new TextRun({ text: labels.aboutTheAuthor, font: FONT, color: ACCENT }),
                ],
                spacing: { before: 600, after: 400 },
            }),
        ];
        for (const contrib of contribsWithBio) {
            aboutChildren.push(
                new Paragraph({
                    children: [
                        new TextRun({ text: contrib.name, font: FONT, size: 24, bold: true }),
                    ],
                    spacing: { before: 300, after: 100 },
                }),
                new Paragraph({
                    children: [
                        new TextRun({ text: contrib.bio, font: FONT, size: 22 }),
                    ],
                    spacing: { after: 200 },
                }),
            );
        }
        sections.push({
            properties: { page: { size: PAGE_A5 } },
            children: aboutChildren,
        });
    }

    // Colophon
    const colophonLines = buildColophonLines(config);
    if (colophonLines.length > 0) {
        const colophonChildren: Paragraph[] = [
            new Paragraph({
                heading: HeadingLevel.HEADING_2,
                children: [
                    new TextRun({ text: labels.colophon, font: FONT, color: ACCENT }),
                ],
                spacing: { before: 600, after: 400 },
            }),
        ];

        for (const line of colophonLines) {
            colophonChildren.push(
                new Paragraph({
                    children: [
                        new TextRun({ text: line, font: FONT, size: 20, color: MUTED }),
                    ],
                    spacing: { after: 80 },
                }),
            );
        }

        sections.push({
            properties: { page: { size: PAGE_A5 } },
            children: colophonChildren,
        });
    }

    const authorStr = formatAuthors(config.author);

    // Load external styles from template.docx if available
    const templatePath = await resolveTemplatePath(projectDir, themeDir);
    const externalStyles = templatePath ? await extractStylesXml(templatePath) : null;

    const doc = new Document({
        title: config.title,
        subject: config.subtitle || undefined,
        creator: authorStr || undefined,
        description: config.genre ? `Genre: ${config.genre}` : undefined,
        keywords: config.genre || undefined,
        externalStyles: externalStyles ?? undefined,
        numbering: {
            config: [
                {
                    reference: "bullet-list",
                    levels: [
                        {
                            level: 0,
                            format: LevelFormat.BULLET,
                            text: "\u2022",
                            alignment: AlignmentType.LEFT,
                            style: { paragraph: { indent: { left: convertInchesToTwip(0.5), hanging: convertInchesToTwip(0.25) } } },
                        },
                    ],
                },
                {
                    reference: "numbered-list",
                    levels: [
                        {
                            level: 0,
                            format: LevelFormat.DECIMAL,
                            text: "%1.",
                            alignment: AlignmentType.LEFT,
                            style: { paragraph: { indent: { left: convertInchesToTwip(0.5), hanging: convertInchesToTwip(0.25) } } },
                        },
                    ],
                },
            ],
        },
        footnotes: Object.keys(docFootnotes).length > 0 ? docFootnotes : undefined,
        sections,
    });

    const buffer = await Packer.toBuffer(doc);
    const outPath = join(buildDir, filename);
    await writeFile(outPath, buffer);

    return outPath;
}
