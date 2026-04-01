/**
 * Text normalization — mechanical, deterministic rules for consistent typography.
 *
 * dialogue_style: how dialogue is marked (em-dash, quotes, guillemets)
 * smart_quotes: convert straight quotes to curly
 * normalize_ellipsis: convert ... to …
 * normalize_dashes: convert -- to —
 */

export interface NormalizationConfig {
    dialogue_style?: "em_dash" | "double_quotes" | "guillemets" | "angle_quotes";
    smart_quotes?: boolean;
    normalize_ellipsis?: boolean;
    normalize_dashes?: boolean;
}

export function loadNormalizationConfig(style: Record<string, unknown>): NormalizationConfig {
    return {
        dialogue_style: style.dialogue_style as NormalizationConfig["dialogue_style"],
        smart_quotes: style.smart_quotes as boolean | undefined,
        normalize_ellipsis: style.normalize_ellipsis as boolean | undefined,
        normalize_dashes: style.normalize_dashes as boolean | undefined,
    };
}

// ---------------------------------------------------------------------------
// Detection patterns
// ---------------------------------------------------------------------------

// Matches lines of text, skipping fenced code blocks
function* contentLines(text: string): Generator<{ line: string; index: number }> {
    const lines = text.split("\n");
    let inCodeBlock = false;
    for (let i = 0; i < lines.length; i++) {
        if (lines[i].trimStart().startsWith("```")) {
            inCodeBlock = !inCodeBlock;
            continue;
        }
        if (!inCodeBlock) {
            yield { line: lines[i], index: i + 1 };
        }
    }
}

const DIALOGUE_PATTERNS = {
    em_dash: /^—\s|^—[A-ZÀ-ÖØ-Ýa-zà-öø-ÿ]/,
    double_quotes: /"[^"]*"/,
    guillemets: /«[^»]*»/,
    angle_quotes: /\u201C[^\u201D]*\u201D/, // "..."
};

// What other styles look like (to detect mismatches)
const FOREIGN_DIALOGUE: Record<string, RegExp[]> = {
    em_dash: [DIALOGUE_PATTERNS.double_quotes, DIALOGUE_PATTERNS.guillemets, DIALOGUE_PATTERNS.angle_quotes],
    double_quotes: [DIALOGUE_PATTERNS.em_dash, DIALOGUE_PATTERNS.guillemets],
    guillemets: [DIALOGUE_PATTERNS.em_dash, DIALOGUE_PATTERNS.double_quotes],
    angle_quotes: [DIALOGUE_PATTERNS.em_dash, DIALOGUE_PATTERNS.guillemets],
};

// ---------------------------------------------------------------------------
// Check — return warnings
// ---------------------------------------------------------------------------

export function checkNormalization(
    body: string,
    config: NormalizationConfig,
    filePath: string,
): string[] {
    const warnings: string[] = [];

    for (const { line } of contentLines(body)) {
        // Dialogue style
        if (config.dialogue_style) {
            const foreignPatterns = FOREIGN_DIALOGUE[config.dialogue_style] ?? [];
            for (const pattern of foreignPatterns) {
                if (pattern.test(line)) {
                    warnings.push(`${filePath}: dialogue does not match style "${config.dialogue_style}"`);
                    // One warning per file per issue is enough
                    config = { ...config, dialogue_style: undefined };
                    break;
                }
            }
        }

        // Straight quotes
        if (config.smart_quotes && /(?<![\\`])"/.test(line)) {
            warnings.push(`${filePath}: straight quotes found (smart_quotes is enabled)`);
            config = { ...config, smart_quotes: undefined };
        }

        // Ellipsis
        if (config.normalize_ellipsis && /\.{3}/.test(line) && !/…/.test(line)) {
            warnings.push(`${filePath}: "..." found (normalize_ellipsis is enabled, use "…")`);
            config = { ...config, normalize_ellipsis: undefined };
        }

        // Dashes
        if (config.normalize_dashes && /(?<![-])--(?!-)/.test(line)) {
            warnings.push(`${filePath}: "--" found (normalize_dashes is enabled, use "—")`);
            config = { ...config, normalize_dashes: undefined };
        }
    }

    return warnings;
}

// ---------------------------------------------------------------------------
// Normalize — apply fixes to text
// ---------------------------------------------------------------------------

export function normalizeText(text: string, config: NormalizationConfig): string {
    const lines = text.split("\n");
    let inCodeBlock = false;
    const result: string[] = [];

    for (const line of lines) {
        if (line.trimStart().startsWith("```")) {
            inCodeBlock = !inCodeBlock;
            result.push(line);
            continue;
        }

        if (inCodeBlock) {
            result.push(line);
            continue;
        }

        let out = line;

        // Normalize ellipsis: ... → …
        if (config.normalize_ellipsis) {
            out = out.replace(/\.{3}/g, "…");
        }

        // Normalize dashes: -- → — (but not ---, which is a scene break)
        if (config.normalize_dashes) {
            out = out.replace(/(?<![-])--(?!-)/g, "—");
        }

        // Smart quotes: "text" → \u201Ctext\u201D  and 'text' → \u2018text\u2019
        if (config.smart_quotes) {
            // Double quotes: opening after whitespace/start, closing before whitespace/end/punctuation
            out = out.replace(/(^|[\s(\[{])"/g, "$1\u201C");
            out = out.replace(/"/g, "\u201D");
            // Single quotes / apostrophes
            out = out.replace(/(^|[\s(\[{])'/g, "$1\u2018");
            out = out.replace(/'/g, "\u2019");
        }

        // Dialogue style conversion
        if (config.dialogue_style) {
            out = convertDialogue(out, config.dialogue_style);
        }

        result.push(out);
    }

    return result.join("\n");
}

function convertDialogue(line: string, target: NormalizationConfig["dialogue_style"]): string {
    // Extract dialogue content from any recognized format
    let match: RegExpMatchArray | null;
    let speech: string | null = null;
    let prefix = "";
    let suffix = "";

    // Try em-dash: — Speech text, said Marco.
    if ((match = line.match(/^(—\s*)(.+)$/))) {
        speech = match[2];
        prefix = "";
    }
    // Try double quotes: "Speech text," said Marco.
    else if ((match = line.match(/^(.*?)"([^"]+)"(.*)$/))) {
        prefix = match[1];
        speech = match[2];
        suffix = match[3];
    }
    // Try guillemets: «Speech text» said Marco.
    else if ((match = line.match(/^(.*?)«([^»]+)»(.*)$/))) {
        prefix = match[1];
        speech = match[2];
        suffix = match[3];
    }
    // Try angle/smart quotes: \u201CSpeech text\u201D said Marco.
    else if ((match = line.match(/^(.*?)\u201C([^\u201D]+)\u201D(.*)$/))) {
        prefix = match[1];
        speech = match[2];
        suffix = match[3];
    }

    if (speech === null) return line;

    switch (target) {
        case "em_dash":
            return `— ${speech.trimStart()}`;
        case "double_quotes":
            return `${prefix}"${speech}"${suffix}`;
        case "guillemets":
            return `${prefix}«${speech}»${suffix}`;
        case "angle_quotes":
            return `${prefix}\u201C${speech}\u201D${suffix}`;
        default:
            return line;
    }
}
