import {
    Document,
    Packer,
    Paragraph,
    TextRun,
    HeadingLevel,
    AlignmentType,
    BorderStyle,
    ExternalHyperlink,
    Table,
    TableRow,
    TableCell,
    WidthType,
    LevelFormat,
    convertInchesToTwip,
} from "docx";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { BookConfig, Chapter, Contributor } from "./parse.js";
import { buildColophonLines, formatAuthors } from "./metadata.js";
import { getLabels } from "./i18n.js";

const FONT = "Georgia";

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

function parseInline(
    text: string,
): (TextRun | ExternalHyperlink)[] {
    const result: (TextRun | ExternalHyperlink)[] = [];
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

function parseMarkdownToDocx(markdown: string): Paragraph[] {
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
                    children: parseInline(headingMatch[2]),
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
                    children: [new TextRun({ text: "* * *", color: "666666", font: FONT })],
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
                    children: parseInline(quoteLines.join(" ")),
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
                        children: parseInline(text),
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
                        children: parseInline(text),
                        numbering: { reference: "numbered-list", level: 0 },
                        spacing: { after: 80 },
                    }),
                );
                i++;
            }
            continue;
        }

        // Regular paragraph
        paragraphs.push(
            new Paragraph({
                children: parseInline(line),
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
): (Paragraph | Table)[] {
    const blocks: (Paragraph | Table)[] = [];
    const lines = markdown.split("\n");
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
                                            children: parseInline(cells[ci] || ""),
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

        blocks.push(...parseMarkdownToDocx(nonTableLines.join("\n")));
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
): Promise<string> {
    const buildDir = join(projectDir, "build");
    await mkdir(buildDir, { recursive: true });

    const sections: {
        properties: { page: { size: typeof PAGE_A5 } };
        children: (Paragraph | Table)[];
    }[] = [];

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
                        color: "666666",
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
                        color: "666666",
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
                        color: "8B4513",
                    }),
                ],
                spacing: { before: 600, after: 400 },
            }),
            ...parseMarkdownToDocxBlocks(chapter.body),
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
    const labels = getLabels(config.language);
    const contribsWithBio = contributors.filter((c) => c.bio);
    if (contribsWithBio.length > 0) {
        const aboutChildren: Paragraph[] = [
            new Paragraph({
                heading: HeadingLevel.HEADING_2,
                children: [
                    new TextRun({ text: labels.aboutTheAuthor, font: FONT, color: "8B4513" }),
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
                    new TextRun({ text: labels.colophon, font: FONT, color: "8B4513" }),
                ],
                spacing: { before: 600, after: 400 },
            }),
        ];

        for (const line of colophonLines) {
            colophonChildren.push(
                new Paragraph({
                    children: [
                        new TextRun({ text: line, font: FONT, size: 20, color: "666666" }),
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
        sections,
    });

    const buffer = await Packer.toBuffer(doc);
    const outPath = join(buildDir, filename);
    await writeFile(outPath, buffer);

    return outPath;
}
