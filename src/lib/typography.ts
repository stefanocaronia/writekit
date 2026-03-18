import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { parse as parseYaml } from "yaml";
import { loadType, isValidType } from "./project-type.js";

export type HeadingFormat = "label_number_title" | "label_number" | "number_title" | "number" | "title";

export interface Typography {
    paragraphIndent: string;
    paragraphSpacing: string;
    textAlign: string;
    firstParagraphIndent: boolean;
    headingStyle: string;
    blockquoteStyle: string;
    sceneBreak: string;
    chapterOpening: string;
    lineHeight: string;
    hyphenation: boolean;
    orphansWidows: number;
    partHeading: HeadingFormat;
    chapterHeading: HeadingFormat;
}

const FALLBACK: Typography = {
    paragraphIndent: "1.5rem",
    paragraphSpacing: "0",
    textAlign: "justify",
    firstParagraphIndent: false,
    headingStyle: "serif",
    blockquoteStyle: "italic",
    sceneBreak: "* * *",
    chapterOpening: "large",
    lineHeight: "1.6",
    hyphenation: true,
    orphansWidows: 2,
    partHeading: "label_number_title",
    chapterHeading: "title",
};

function yamlToTypography(raw: Record<string, unknown>): Partial<Typography> {
    const t: Partial<Typography> = {};
    if (raw.paragraph_indent !== undefined) t.paragraphIndent = String(raw.paragraph_indent);
    if (raw.paragraph_spacing !== undefined) t.paragraphSpacing = String(raw.paragraph_spacing);
    if (raw.text_align !== undefined) t.textAlign = String(raw.text_align);
    if (raw.first_paragraph_indent !== undefined) t.firstParagraphIndent = !!raw.first_paragraph_indent;
    if (raw.heading_style !== undefined) t.headingStyle = String(raw.heading_style);
    if (raw.blockquote_style !== undefined) t.blockquoteStyle = String(raw.blockquote_style);
    if (raw.scene_break !== undefined) t.sceneBreak = String(raw.scene_break);
    if (raw.chapter_opening !== undefined) t.chapterOpening = String(raw.chapter_opening);
    if (raw.line_height !== undefined) t.lineHeight = String(raw.line_height);
    if (raw.hyphenation !== undefined) t.hyphenation = !!raw.hyphenation;
    if (raw.orphans_widows !== undefined) t.orphansWidows = Number(raw.orphans_widows);
    if (raw.part_heading !== undefined) t.partHeading = String(raw.part_heading) as HeadingFormat;
    if (raw.chapter_heading !== undefined) t.chapterHeading = String(raw.chapter_heading) as HeadingFormat;
    return t;
}

/**
 * Load typography settings.
 * Priority: style.yaml (user) > type.yaml (type default) > FALLBACK
 */
export async function loadTypography(projectDir: string): Promise<Typography> {
    // Start with fallback
    let result = { ...FALLBACK };

    // Load type defaults
    try {
        const configRaw = await readFile(join(projectDir, "config.yaml"), "utf-8");
        const config = parseYaml(configRaw) as Record<string, unknown>;
        const typeName = (config.type as string) || "novel";
        if (isValidType(typeName)) {
            const typeDef = await loadType(typeName);
            const typeRaw = typeDef as unknown as Record<string, unknown>;
            if (typeRaw.typography && typeof typeRaw.typography === "object") {
                result = { ...result, ...yamlToTypography(typeRaw.typography as Record<string, unknown>) };
            }
        }
    } catch { /* use fallback */ }

    // Load user overrides from style.yaml
    try {
        const styleRaw = await readFile(join(projectDir, "style.yaml"), "utf-8");
        const style = parseYaml(styleRaw) as Record<string, unknown>;
        if (style.typography && typeof style.typography === "object") {
            result = { ...result, ...yamlToTypography(style.typography as Record<string, unknown>) };
        }
    } catch { /* no style.yaml or no typography section */ }

    return result;
}

/**
 * Generate CSS class names for typography settings.
 */
export function typographyClasses(typo: Typography): string {
    const classes: string[] = [];

    classes.push(typo.paragraphIndent !== "0" ? "typo-indent" : "typo-no-indent");
    classes.push(typo.paragraphSpacing !== "0" ? "typo-spacing" : "typo-no-spacing");
    classes.push(typo.textAlign === "justify" ? "typo-justify" : "typo-left");
    classes.push(typo.firstParagraphIndent ? "typo-first-indent" : "typo-no-first-indent");
    classes.push(`typo-opening-${typo.chapterOpening}`);
    classes.push(typo.hyphenation ? "typo-hyphens" : "typo-no-hyphens");
    classes.push(`typo-heading-${typo.headingStyle}`);
    classes.push(`typo-blockquote-${typo.blockquoteStyle}`);
    classes.push(typo.sceneBreak === "* * *" ? "typo-scene-stars" : "typo-scene-dash");

    return classes.join(" ");
}

/**
 * Generate CSS custom properties for typography.
 */
export function typographyCssVars(typo: Typography): string {
    return [
        `--paragraph-indent: ${typo.paragraphIndent}`,
        `--paragraph-spacing: ${typo.paragraphSpacing}`,
        `--line-height: ${typo.lineHeight}`,
        `--orphans: ${typo.orphansWidows}`,
        `--widows: ${typo.orphansWidows}`,
    ].join("; ");
}

// --- Numeral helpers ---

const ROMAN_MAP: [number, string][] = [
    [1000, "M"], [900, "CM"], [500, "D"], [400, "CD"],
    [100, "C"], [90, "XC"], [50, "L"], [40, "XL"],
    [10, "X"], [9, "IX"], [5, "V"], [4, "IV"], [1, "I"],
];

export function toRoman(n: number): string {
    let result = "";
    for (const [value, numeral] of ROMAN_MAP) {
        while (n >= value) { result += numeral; n -= value; }
    }
    return result;
}

const CJK_DIGITS = ["〇", "一", "二", "三", "四", "五", "六", "七", "八", "九"];
const CJK_TENS = ["", "十", "百", "千"];

export function toCjk(n: number): string {
    if (n <= 0 || n > 9999) return String(n);
    if (n <= 10) return n === 10 ? "十" : CJK_DIGITS[n];
    const digits = String(n).split("").map(Number);
    let result = "";
    for (let i = 0; i < digits.length; i++) {
        const place = digits.length - 1 - i;
        if (digits[i] === 0) continue;
        if (digits[i] === 1 && place === 1 && i === 0) {
            result += CJK_TENS[place]; // 十 not 一十
        } else {
            result += CJK_DIGITS[digits[i]] + CJK_TENS[place];
        }
    }
    return result;
}

const CJK_LANGS = ["zh", "ja"];
const CJK_STYLE_LANGS = ["zh", "ja", "ko"]; // no space between label, number, suffix
const ARABIC_NUM_LANGS = ["ko", "ar", "hi"];

function partNumber(n: number, lang: string): string {
    const base = lang.split("-")[0];
    if (CJK_LANGS.includes(base)) return toCjk(n);
    if (ARABIC_NUM_LANGS.includes(base)) return String(n);
    return toRoman(n);
}

function chapterNumber(n: number, lang: string): string {
    const base = lang.split("-")[0];
    if (CJK_LANGS.includes(base)) return toCjk(n);
    return String(n);
}

export interface Labels {
    part: string;
    chapter_label: string;
    partSuffix: string;
    chapterSuffix: string;
}

/**
 * Format a part heading according to the heading format.
 */
export function formatPartHeading(
    format: HeadingFormat, n: number, title: string,
    labels: Labels, lang: string,
): string {
    const num = partNumber(n, lang);
    const label = labels.part;
    const suffix = labels.partSuffix;
    const base = lang.split("-")[0];
    const noSpace = CJK_STYLE_LANGS.includes(base);
    // CJK-style: 第一部 / 제1부 (no space between label, number, suffix)
    // Western: Part I (space between label and number)
    const labelNum = noSpace ? `${label}${num}${suffix}` : `${label} ${num}`;
    switch (format) {
        case "label_number_title": return title ? `${labelNum}\n${title}` : labelNum;
        case "label_number": return labelNum;
        case "number_title": return title ? `${noSpace ? `${num}${suffix}` : num}\n${title}` : (noSpace ? `${num}${suffix}` : num);
        case "number": return noSpace ? `${num}${suffix}` : num;
        case "title": return title || labelNum;
    }
}

/**
 * Format a chapter heading according to the heading format.
 */
export function formatChapterHeading(
    format: HeadingFormat, n: number, title: string,
    labels: Labels, lang: string,
): string {
    const num = chapterNumber(n, lang);
    const label = labels.chapter_label;
    const suffix = labels.chapterSuffix;
    const base = lang.split("-")[0];
    const noSpace = CJK_STYLE_LANGS.includes(base);
    const labelNum = noSpace ? `${label}${num}${suffix}` : `${label} ${num}`;
    switch (format) {
        case "label_number_title": return title ? `${labelNum}\n${title}` : labelNum;
        case "label_number": return labelNum;
        case "number_title": return title ? `${noSpace ? `${num}${suffix}` : num}\n${title}` : (noSpace ? `${num}${suffix}` : num);
        case "number": return noSpace ? `${num}${suffix}` : num;
        case "title": return title;
    }
}
