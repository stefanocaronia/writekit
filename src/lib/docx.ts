import {
    Document,
    Packer,
    Paragraph,
    TextRun,
    HeadingLevel,
    AlignmentType,
    BorderStyle,
} from "docx";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { BookConfig, Chapter } from "./parse.js";
import { buildColophonLines } from "./metadata.js";

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
        if (line.startsWith("### ")) {
            paragraphs.push(
                new Paragraph({
                    heading: HeadingLevel.HEADING_3,
                    children: parseInline(line.slice(4)),
                    spacing: { before: 400, after: 200 },
                }),
            );
            i++;
            continue;
        }
        if (line.startsWith("## ")) {
            paragraphs.push(
                new Paragraph({
                    heading: HeadingLevel.HEADING_2,
                    children: parseInline(line.slice(3)),
                    spacing: { before: 400, after: 200 },
                }),
            );
            i++;
            continue;
        }
        if (line.startsWith("# ")) {
            paragraphs.push(
                new Paragraph({
                    heading: HeadingLevel.HEADING_1,
                    children: parseInline(line.slice(2)),
                    spacing: { before: 400, after: 300 },
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
                    children: [new TextRun({ text: "* * *", color: "666666" })],
                    spacing: { before: 400, after: 400 },
                }),
            );
            i++;
            continue;
        }

        // Blockquote
        if (line.startsWith("> ")) {
            const quoteText = line.slice(2);
            paragraphs.push(
                new Paragraph({
                    children: parseInline(quoteText),
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
            i++;
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

// Matches: ***bold italic***, **bold**, *italic*, _italic_, or plain text
const INLINE_REGEX = /(\*\*\*(.+?)\*\*\*|\*\*(.+?)\*\*|\*(.+?)\*|_(.+?)_|(.+?)(?=\*|_|$))/g;

function parseInline(text: string): TextRun[] {
    const runs: TextRun[] = [];
    INLINE_REGEX.lastIndex = 0;
    let match;

    while ((match = INLINE_REGEX.exec(text)) !== null) {
        if (match[0] === "") continue;

        if (match[2]) {
            // ***bold italic***
            runs.push(new TextRun({ text: match[2], bold: true, italics: true, font: "Georgia" }));
        } else if (match[3]) {
            // **bold**
            runs.push(new TextRun({ text: match[3], bold: true, font: "Georgia" }));
        } else if (match[4]) {
            // *italic*
            runs.push(new TextRun({ text: match[4], italics: true, font: "Georgia" }));
        } else if (match[5]) {
            // _italic_
            runs.push(new TextRun({ text: match[5], italics: true, font: "Georgia" }));
        } else if (match[6]) {
            // plain text
            runs.push(new TextRun({ text: match[6], font: "Georgia" }));
        }
    }

    if (runs.length === 0) {
        runs.push(new TextRun({ text, font: "Georgia" }));
    }

    return runs;
}

export async function buildDocx(
    projectDir: string,
    config: BookConfig,
    chapters: Chapter[],
    filename = "book.docx",
): Promise<string> {
    const buildDir = join(projectDir, "build");
    await mkdir(buildDir, { recursive: true });

    const sections = [];

    // Title page
    const titleChildren: Paragraph[] = [
        new Paragraph({ spacing: { before: 4000 } }),
        new Paragraph({
            alignment: AlignmentType.CENTER,
            heading: HeadingLevel.TITLE,
            children: [new TextRun({ text: config.title, font: "Georgia", size: 56 })],
        }),
    ];

    if (config.subtitle) {
        titleChildren.push(
            new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [
                    new TextRun({ text: config.subtitle, font: "Georgia", size: 28, italics: true, color: "666666" }),
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
                    new TextRun({ text: config.author, font: "Georgia", size: 24, color: "666666" }),
                ],
                spacing: { before: 600 },
            }),
        );
    }

    sections.push({
        properties: { page: { size: { width: 8391, height: 11906 } } }, // A5
        children: titleChildren,
    });

    // Chapters
    for (const chapter of chapters) {
        const children: Paragraph[] = [
            new Paragraph({
                heading: HeadingLevel.HEADING_1,
                children: [
                    new TextRun({ text: chapter.title, font: "Georgia", size: 36, color: "8B4513" }),
                ],
                spacing: { before: 600, after: 400 },
            }),
            ...parseMarkdownToDocx(chapter.body),
        ];

        sections.push({
            properties: { page: { size: { width: 8391, height: 11906 } } },
            children,
        });
    }

    // Colophon
    const colophonChildren: Paragraph[] = [
        new Paragraph({
            heading: HeadingLevel.HEADING_2,
            children: [new TextRun({ text: "Colophon", font: "Georgia", color: "8B4513" })],
            spacing: { before: 600, after: 400 },
        }),
    ];

    const colophonLines = buildColophonLines(config);

    for (const line of colophonLines) {
        colophonChildren.push(
            new Paragraph({
                children: [new TextRun({ text: line, font: "Georgia", size: 20, color: "666666" })],
                spacing: { after: 80 },
            }),
        );
    }

    if (colophonLines.length > 0) {
        sections.push({
            properties: { page: { size: { width: 8391, height: 11906 } } },
            children: colophonChildren,
        });
    }

    const doc = new Document({ sections });

    const buffer = await Packer.toBuffer(doc);
    const outPath = join(buildDir, filename);
    await writeFile(outPath, buffer);

    return outPath;
}
