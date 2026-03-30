import type { BookConfig } from "../project/parse.js";
import { getLabels } from "./i18n.js";

export function formatAuthors(author: string | string[]): string {
    if (Array.isArray(author)) {
        if (author.length === 0) return "";
        if (author.length === 1) return author[0];
        return author.slice(0, -1).join(", ") + " & " + author[author.length - 1];
    }
    return author || "";
}

export function buildColophonLines(config: BookConfig): string[] {
    const labels = getLabels(config.language);
    const lines: string[] = [];
    if (config.copyright) lines.push(config.copyright);
    if (config.license) lines.push(config.license);
    if (config.publisher) lines.push(`${labels.publisher}: ${config.publisher}`);
    if (config.edition) lines.push(`${labels.edition}: ${config.edition}`);
    if (config.date) lines.push(`Date: ${config.date}`);
    if (config.isbn) lines.push(`ISBN: ${config.isbn}`);
    if (config.translator) lines.push(`${labels.translator} ${config.translator}`);
    if (config.editor) lines.push(`${labels.editor} ${config.editor}`);
    if (config.illustrator) lines.push(`${labels.illustrator} ${config.illustrator}`);
    return lines;
}
