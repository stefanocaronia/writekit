/**
 * Print presets for PDF generation.
 * Dimensions in millimeters, margins in millimeters.
 */

export interface PrintPreset {
    name: string;
    description: string;
    width: number;      // mm
    height: number;     // mm
    margin: {
        top: number;    // mm
        bottom: number;
        inner: number;  // gutter side
        outer: number;
    };
    bleed: number;      // mm (0 for non-print presets)
}

const presets: Record<string, PrintPreset> = {
    a4: {
        name: "A4",
        description: "A4 — draft / home printing",
        width: 210,
        height: 297,
        margin: { top: 20, bottom: 20, inner: 25, outer: 20 },
        bleed: 0,
    },
    a5: {
        name: "A5",
        description: "A5 — standard EU book",
        width: 148,
        height: 210,
        margin: { top: 15, bottom: 15, inner: 20, outer: 15 },
        bleed: 0,
    },
    pocket: {
        name: "Pocket",
        description: "4.25×7in — pocket book",
        width: 108,
        height: 178,
        margin: { top: 13, bottom: 13, inner: 16, outer: 13 },
        bleed: 0,
    },
    digest: {
        name: "Digest",
        description: "5.5×8.5in — digest / mass market",
        width: 140,
        height: 216,
        margin: { top: 15, bottom: 15, inner: 19, outer: 15 },
        bleed: 0,
    },
    trade: {
        name: "US Trade",
        description: "6×9in — US trade paperback (most common)",
        width: 152,
        height: 229,
        margin: { top: 18, bottom: 18, inner: 22, outer: 18 },
        bleed: 0,
    },
    royal: {
        name: "Royal",
        description: "6.14×9.21in — Royal format",
        width: 156,
        height: 234,
        margin: { top: 18, bottom: 18, inner: 22, outer: 18 },
        bleed: 0,
    },
    kdp: {
        name: "KDP",
        description: "6×9in — Amazon KDP ready (with bleed & margins)",
        width: 152,
        height: 229,
        margin: { top: 19, bottom: 19, inner: 25, outer: 19 },
        bleed: 3.2,     // 0.125in = 3.175mm
    },
    ingramspark: {
        name: "IngramSpark",
        description: "6×9in — IngramSpark ready (with bleed & margins)",
        width: 152,
        height: 229,
        margin: { top: 19, bottom: 19, inner: 25, outer: 19 },
        bleed: 3.2,     // 0.125in
    },
    lulu: {
        name: "Lulu",
        description: "6×9in — Lulu ready (with bleed & margins)",
        width: 152,
        height: 229,
        margin: { top: 19, bottom: 19, inner: 22, outer: 16 },
        bleed: 3.2,
    },
};

export const DEFAULT_PRESET = "a5";

export function getPreset(name: string): PrintPreset | null {
    return presets[name.toLowerCase()] ?? null;
}

export function listPresets(): { key: string; preset: PrintPreset }[] {
    return Object.entries(presets).map(([key, preset]) => ({ key, preset }));
}

export function presetNames(): string[] {
    return Object.keys(presets);
}
