import type { BookConfig } from "./parse.js";

export function buildColophonLines(config: BookConfig): string[] {
    const lines: string[] = [];
    if (config.copyright) lines.push(config.copyright);
    if (config.license) lines.push(config.license);
    if (config.publisher) lines.push(`Publisher: ${config.publisher}`);
    if (config.edition) lines.push(`Edition: ${config.edition}`);
    if (config.date) lines.push(`Date: ${config.date}`);
    if (config.isbn) lines.push(`ISBN: ${config.isbn}`);
    if (config.translator) lines.push(`Translated by ${config.translator}`);
    if (config.editor) lines.push(`Edited by ${config.editor}`);
    if (config.illustrator) lines.push(`Illustrations by ${config.illustrator}`);
    return lines;
}
