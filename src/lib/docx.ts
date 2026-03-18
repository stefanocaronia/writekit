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
    TableLayoutType,
    LevelFormat,
    convertInchesToTwip,
} from "docx";
import { mkdir, writeFile, readFile } from "node:fs/promises";
import { join } from "node:path";
import { SECTION_LABEL_KEY } from "./parse.js";
import type { BookConfig, Chapter, Contributor } from "./parse.js";
import { buildColophonLines, formatAuthors } from "./metadata.js";
import { collectImagePaths } from "./images.js";
import { getLabels } from "./i18n.js";
import type { DocxStyle } from "./theme.js";
import type { Section, TypeFeatures } from "./project-type.js";
import { loadTypography, formatPartHeading, formatChapterHeading } from "./typography.js";
import type { Labels as TypoLabels } from "./typography.js";
// Template support removed — externalStyles doesn't work reliably. See PLAN.md.

// Module-level style, set by buildDocx before rendering
let FONT = "Georgia";
let ACCENT = "8B4513";
let TEXT_COLOR = "2C2C2C";
let MUTED = "666666";
let TYPO_INDENT = convertInchesToTwip(0.3);
let TYPO_SPACING = 0;
let TYPO_ALIGN: (typeof AlignmentType)[keyof typeof AlignmentType] = AlignmentType.JUSTIFIED;

/** Convert a CSS-like spacing value (e.g. "0.5rem", "6pt", "0") to twips. */
function spacingToTwips(value: string): number {
    const v = value.trim();
    if (v === "0") return 0;
    const num = parseFloat(v);
    if (Number.isNaN(num)) return 0;
    if (v.endsWith("rem")) return Math.round(num * 240);  // 1rem ≈ 12pt ≈ 240 twips
    if (v.endsWith("pt")) return Math.round(num * 20);    // 1pt = 20 twips
    if (v.endsWith("px")) return Math.round(num * 15);    // 1px ≈ 0.75pt ≈ 15 twips
    return Math.round(num * 240); // default: treat as rem
}

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
                        color: ACCENT,
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
    let lastWasParagraph = false;

    while (i < lines.length) {
        const line = lines[i];

        // Skip empty lines (but don't reset lastWasParagraph — blank line between paragraphs is normal)
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
                    children: [new TextRun({ text: headingMatch[2], font: FONT, color: ACCENT })],
                    spacing: { before: 400, after: level === 1 ? 300 : 200 },
                    keepNext: true,
                }),
            );
            lastWasParagraph = false;
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

        // Regular paragraph — typography-driven
        paragraphs.push(
            new Paragraph({
                children: parseInline(line, footnotes),
                alignment: TYPO_ALIGN,
                indent: lastWasParagraph && TYPO_INDENT > 0 ? { firstLine: TYPO_INDENT } : undefined,
                spacing: { after: TYPO_SPACING },
            }),
        );
        lastWasParagraph = true;
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
                                    width: { size: Math.floor(TABLE_WIDTH / colCount), type: WidthType.DXA },
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
                        width: { size: TABLE_WIDTH, type: WidthType.DXA },
                        layout: TableLayoutType.FIXED,
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
const PAGE_MARGIN = 1440; // 1 inch in twips
const TABLE_WIDTH = PAGE_A5.width - PAGE_MARGIN * 2; // available content width

export async function buildDocx(
    projectDir: string,
    config: BookConfig,
    chapters: Chapter[],
    filename = "book.docx",
    contributors: Contributor[] = [],
    backcover = "",
    coverImagePath?: string | null,
    docxStyle?: DocxStyle,
    sections?: Section[],
    features?: TypeFeatures,
): Promise<string> {
    const has = (s: Section) => !sections || sections.includes(s);
    // Load typography and set module-level vars
    const typo = await loadTypography(projectDir);
    TYPO_INDENT = typo.paragraphIndent === "0" ? 0 : convertInchesToTwip(0.3);
    TYPO_SPACING = spacingToTwips(typo.paragraphSpacing);
    TYPO_ALIGN = typo.textAlign === "left" ? AlignmentType.LEFT : AlignmentType.JUSTIFIED;

    // Apply theme style
    if (docxStyle) {
        FONT = docxStyle.font;
        ACCENT = docxStyle.accent_color;
        TEXT_COLOR = docxStyle.text_color;
        MUTED = docxStyle.muted_color;
    }
    const buildDir = join(projectDir, "build");
    await mkdir(buildDir, { recursive: true });

    const docSections: {
        properties: { page: { size: typeof PAGE_A5; margin?: { top: number; bottom: number; left: number; right: number } } };
        children: (Paragraph | Table)[];
    }[] = [];

    // Cover image page — full bleed, no margins
    if (has("cover") && coverImagePath) {
        try {
            const imgData = await readFile(coverImagePath);
            // A5 in EMU: 1 inch = 914400 EMU, A5 = 5.83 x 8.27 inches
            // Page size in twips: PAGE_A5 = { width: 8391, height: 11906 }
            // Convert twips to points for image: 1 twip = 1/20 pt, image uses pt-like units
            // Width in px-like units for docx: A5 ≈ 420 x 595 points
            const coverWidth = Math.round(PAGE_A5.width / 20 * 1.33); // twips to approx pixels
            const coverHeight = Math.round(PAGE_A5.height / 20 * 1.33);
            docSections.push({
                properties: {
                    page: {
                        size: PAGE_A5,
                        margin: { top: 0, bottom: 0, left: 0, right: 0 },
                    },
                },
                children: [
                    new Paragraph({
                        alignment: AlignmentType.CENTER,
                        spacing: { before: 0, after: 0 },
                        children: [
                            new ImageRun({
                                data: imgData,
                                transformation: { width: coverWidth, height: coverHeight },
                                type: "jpg",
                            }),
                        ],
                    }),
                ],
            });
        } catch { /* skip cover if error */ }
    }

    // Title page
    if (has("title_page")) {
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
                        new TextRun({ text: config.subtitle, font: FONT, size: 28, italics: true, color: MUTED }),
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
                        new TextRun({ text: formatAuthors(config.author), font: FONT, size: 24, color: MUTED }),
                    ],
                    spacing: { before: 600 },
                }),
            );
        }

        docSections.push({
            properties: { page: { size: PAGE_A5 } },
            children: titleChildren,
        });
    } else if (has("title_block") && (config.title || config.author)) {
        // Paper-style: inline title block (no separate page)
        const blockChildren: Paragraph[] = [];
        if (config.title) {
            blockChildren.push(
                new Paragraph({
                    alignment: AlignmentType.CENTER,
                    children: [new TextRun({ text: config.title, font: FONT, size: 36, bold: true })],
                    spacing: { before: 200, after: 100 },
                }),
            );
        }
        if (config.author) {
            blockChildren.push(
                new Paragraph({
                    alignment: AlignmentType.CENTER,
                    children: [new TextRun({ text: formatAuthors(config.author), font: FONT, size: 22, color: MUTED })],
                    spacing: { after: 300 },
                }),
            );
        }
        docSections.push({
            properties: { page: { size: PAGE_A5 } },
            children: blockChildren,
        });
    } else if (!has("title_page") && !has("title_block") && (config.title || config.author)) {
        // Article-style: simple header with title and author
        const headerChildren: Paragraph[] = [];
        if (config.title) {
            headerChildren.push(
                new Paragraph({
                    children: [new TextRun({ text: config.title, font: FONT, size: 32, bold: true })],
                    spacing: { before: 200, after: 80 },
                }),
            );
        }
        if (config.author) {
            headerChildren.push(
                new Paragraph({
                    children: [new TextRun({ text: formatAuthors(config.author), font: FONT, size: 22, color: MUTED })],
                    spacing: { after: 200 },
                }),
            );
        }
        docSections.push({
            properties: { page: { size: PAGE_A5 } },
            children: headerChildren,
        });
    }

    // Table of Contents
    const labels = getLabels(config.language);
    if (has("toc")) {
        docSections.push({
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
    }

    // Extract footnotes from all chapters
    const allMarkdown = chapters.map((c) => c.body).join("\n\n");
    const footnotes = extractFootnotes(allMarkdown);

    // Build Document footnotes config
    const docFootnotes: Record<string, { children: Paragraph[] }> = {};
    for (const [id, num] of footnotes.idToNum) {
        const text = footnotes.defs.get(id) ?? "";
        docFootnotes[String(num)] = {
            children: [new Paragraph({
                children: [new TextRun({ text, font: FONT, size: 18 })],
            })],
        };
    }

    // Collect images from all chapters
    const allBodies = chapters.map((c) => c.body).join("\n");
    const imgPaths = collectImagePaths(allBodies, projectDir);
    const maxImgWidth = TABLE_WIDTH / 20; // twips to points, approx px
    const imageDataMap = new Map<string, { data: Buffer; width: number; height: number }>();
    for (const img of imgPaths) {
        try {
            const data = await readFile(img.absPath);
            // Read image dimensions from header
            let w = 400, h = 300;
            if (data[0] === 0x89 && data[1] === 0x50) {
                // PNG: width at offset 16, height at offset 20 (big-endian 32-bit)
                w = data.readUInt32BE(16);
                h = data.readUInt32BE(20);
            } else if (data[0] === 0xFF && data[1] === 0xD8) {
                // JPEG: scan for SOF0/SOF2 marker
                let offset = 2;
                while (offset < data.length - 8) {
                    if (data[offset] === 0xFF && (data[offset + 1] === 0xC0 || data[offset + 1] === 0xC2)) {
                        h = data.readUInt16BE(offset + 5);
                        w = data.readUInt16BE(offset + 7);
                        break;
                    }
                    offset += 2 + data.readUInt16BE(offset + 2);
                }
            }
            // Scale to fit max width while preserving aspect ratio
            if (w > maxImgWidth) {
                const scale = maxImgWidth / w;
                w = Math.round(w * scale);
                h = Math.round(h * scale);
            }
            imageDataMap.set(img.src, { data, width: w, height: h });
        } catch { /* skip */ }
    }

    // Chapters (with part dividers and formatted headings)
    const hasParts = features?.supports_parts !== false && chapters.some((c) => !!c.part);
    const typoLabels: TypoLabels = {
        part: labels.part,
        chapter_label: labels.chapter_label,
        partSuffix: labels.partSuffix,
        chapterSuffix: labels.chapterSuffix,
    };
    const lang = config.language || "en";
    let currentPart: string | undefined;
    let partIndex = 0;
    let chapterIndex = 0;

    for (let ci = 0; ci < chapters.length; ci++) {
        const chapter = chapters[ci];

        // Front/back matter section: simple title + body, no numbering/part/author
        if (chapter.sectionKind) {
            const resolvedTitle = chapter.title || (labels as any)[SECTION_LABEL_KEY[chapter.sectionKind]] || "";
            const sectionChildren: (Paragraph | Table)[] = [];
            if (chapter.showTitle !== false && resolvedTitle) {
                sectionChildren.push(new Paragraph({
                    heading: HeadingLevel.HEADING_1,
                    children: [new TextRun({ text: resolvedTitle, font: FONT, size: 36, color: ACCENT })],
                    spacing: { before: 600, after: 400 },
                }));
            }
            sectionChildren.push(...parseMarkdownToDocxBlocks(chapter.body, footnotes, imageDataMap));
            docSections.push({
                properties: { page: { size: PAGE_A5 } },
                children: sectionChildren,
            });
            continue;
        }

        // Part divider page
        if (hasParts && chapter.part && chapter.part !== currentPart) {
            currentPart = chapter.part;
            partIndex++;
            const partText = formatPartHeading(typo.partHeading, partIndex, currentPart, typoLabels, lang);
            const partLines = partText.split("\n");
            const partChildren: Paragraph[] = [
                // Generous top spacing to center vertically
                new Paragraph({ spacing: { before: 6000 } }),
            ];
            if (partLines.length > 1) {
                // First line: number/label in smaller font
                partChildren.push(
                    new Paragraph({
                        alignment: AlignmentType.CENTER,
                        children: [new TextRun({ text: partLines[0], font: FONT, size: 48, color: MUTED })],
                        spacing: { after: 200 },
                    }),
                );
                // Second line: title in large font
                partChildren.push(
                    new Paragraph({
                        alignment: AlignmentType.CENTER,
                        children: [new TextRun({ text: partLines[1], font: FONT, size: 72, color: ACCENT })],
                        spacing: { after: 400 },
                    }),
                );
            } else {
                partChildren.push(
                    new Paragraph({
                        alignment: AlignmentType.CENTER,
                        children: [new TextRun({ text: partLines[0], font: FONT, size: 72, color: ACCENT })],
                        spacing: { after: 400 },
                    }),
                );
            }
            docSections.push({
                properties: { page: { size: PAGE_A5 } },
                children: partChildren,
            });
        }

        // Chapter heading
        chapterIndex++;
        const children: (Paragraph | Table)[] = [];
        if (typo.chapterHeading === "title") {
            // Default: just the title
            children.push(
                new Paragraph({
                    heading: HeadingLevel.HEADING_1,
                    children: [
                        new TextRun({ text: chapter.title, font: FONT, size: 36, color: ACCENT }),
                    ],
                    spacing: { before: 600, after: 400 },
                }),
            );
        } else {
            const headingText = formatChapterHeading(typo.chapterHeading, chapterIndex, chapter.title, typoLabels, lang);
            const headingLines = headingText.split("\n");
            if (headingLines.length > 1) {
                // First line: chapter number/label in smaller text
                children.push(
                    new Paragraph({
                        alignment: AlignmentType.CENTER,
                        children: [new TextRun({ text: headingLines[0], font: FONT, size: 24, color: MUTED })],
                        spacing: { before: 600, after: 100 },
                    }),
                );
                // Second line: main title as H1
                children.push(
                    new Paragraph({
                        heading: HeadingLevel.HEADING_1,
                        children: [
                            new TextRun({ text: headingLines[1], font: FONT, size: 36, color: ACCENT }),
                        ],
                        spacing: { after: 400 },
                    }),
                );
            } else {
                children.push(
                    new Paragraph({
                        heading: HeadingLevel.HEADING_1,
                        children: [
                            new TextRun({ text: headingLines[0], font: FONT, size: 36, color: ACCENT }),
                        ],
                        spacing: { before: 600, after: 400 },
                    }),
                );
            }
        }
        if (features?.show_chapter_author === true && chapter.author) {
            children.push(new Paragraph({
                children: [new TextRun({ text: chapter.author, font: FONT, size: 22, color: MUTED, italics: true })],
                spacing: { after: 200 },
            }));
        }
        children.push(...parseMarkdownToDocxBlocks(chapter.body, footnotes, imageDataMap));

        docSections.push({
            properties: { page: { size: PAGE_A5 } },
            children,
        });
    }

    // Back cover
    if (has("backcover") && backcover) {
        docSections.push({
            properties: { page: { size: PAGE_A5 } },
            children: parseMarkdownToDocxBlocks(backcover),
        });
    }

    // About the author(s)
    const NON_AUTHOR_ROLES = ["translator", "editor", "illustrator"];
    const contribsWithBio = contributors.filter((c) => c.bio && !c.roles.every((r) => NON_AUTHOR_ROLES.includes(r)));
    if (has("about") && contribsWithBio.length > 0) {
        const aboutChildren: Paragraph[] = [
            new Paragraph({
                children: [
                    new TextRun({ text: labels.aboutTheAuthor, font: FONT, bold: true }),
                ],
                spacing: { before: 400, after: 200 },
            }),
        ];
        for (const contrib of contribsWithBio) {
            aboutChildren.push(
                new Paragraph({
                    children: [
                        new TextRun({ text: contrib.name + " ", font: FONT, size: 22, bold: true }),
                        new TextRun({ text: contrib.bio, font: FONT, size: 22 }),
                    ],
                    spacing: { before: 300, after: 200 },
                }),
            );
        }
        docSections.push({
            properties: { page: { size: PAGE_A5 } },
            children: aboutChildren,
        });
    }

    // Colophon
    const colophonLines = buildColophonLines(config);
    if (has("colophon") && colophonLines.length > 0) {
        const colophonChildren: Paragraph[] = [
            new Paragraph({ spacing: { before: 600 } }),
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

        docSections.push({
            properties: { page: { size: PAGE_A5 } },
            children: colophonChildren,
        });
    }

    const authorStr = formatAuthors(config.author);

    const doc = new Document({
        title: config.title,
        subject: config.subtitle || undefined,
        creator: authorStr || undefined,
        description: config.genre ? `Genre: ${config.genre}` : undefined,
        keywords: config.genre || undefined,
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
        sections: docSections,
    });

    const buffer = await Packer.toBuffer(doc);
    const outPath = join(buildDir, filename);
    await writeFile(outPath, buffer);

    return outPath;
}
