import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { parse as parseYaml } from "yaml";
import { loadType, isValidType } from "./project-type.js";

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
