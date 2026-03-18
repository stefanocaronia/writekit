import { describe, it, expect } from "vitest";
import {
    toRoman,
    toCjk,
    formatChapterHeading,
    formatPartHeading,
    type HeadingFormat,
    type Labels,
} from "../src/lib/typography.js";

// ---------------------------------------------------------------------------
// Shared label sets
// ---------------------------------------------------------------------------

const enLabels: Labels = { part: "Part", chapter_label: "Chapter", partSuffix: "", chapterSuffix: "" };
const itLabels: Labels = { part: "Parte", chapter_label: "Capitolo", partSuffix: "", chapterSuffix: "" };
const zhLabels: Labels = { part: "第", chapter_label: "第", partSuffix: "部", chapterSuffix: "章" };
const koLabels: Labels = { part: "제", chapter_label: "제", partSuffix: "부", chapterSuffix: "장" };

// ---------------------------------------------------------------------------
// 1. formatChapterHeading — English
// ---------------------------------------------------------------------------

describe("formatChapterHeading (English)", () => {
    const lang = "en";
    const title = "The Arrival";

    const cases: [HeadingFormat, number, string, string][] = [
        ["title",              1,  title, "The Arrival"],
        ["label_number_title", 1,  title, "Chapter 1\nThe Arrival"],
        ["label_number",       1,  title, "Chapter 1"],
        ["number_title",       1,  title, "1\nThe Arrival"],
        ["number",             1,  title, "1"],

        // multi-digit
        ["label_number_title", 3,  title, "Chapter 3\nThe Arrival"],
        ["label_number_title", 12, title, "Chapter 12\nThe Arrival"],
        ["number_title",       3,  title, "3\nThe Arrival"],
        ["number_title",       12, title, "12\nThe Arrival"],
        ["number",             3,  title, "3"],
        ["number",             12, title, "12"],
    ];

    for (const [format, n, t, expected] of cases) {
        it(`${format} n=${n}`, () => {
            expect(formatChapterHeading(format, n, t, enLabels, lang)).toBe(expected);
        });
    }
});

// ---------------------------------------------------------------------------
// 2. formatPartHeading — English (Roman numerals)
// ---------------------------------------------------------------------------

describe("formatPartHeading (English)", () => {
    const lang = "en";
    const title = "The Beginning";

    const cases: [HeadingFormat, number, string, string][] = [
        ["label_number_title", 1,  title, "Part I\nThe Beginning"],
        ["label_number",       1,  title, "Part I"],
        ["number_title",       1,  title, "I\nThe Beginning"],
        ["number",             1,  title, "I"],
        ["title",              1,  title, "The Beginning"],

        // various Roman numeral values
        ["label_number_title", 3,  title, "Part III\nThe Beginning"],
        ["label_number",       4,  title, "Part IV"],
        ["number_title",       9,  title, "IX\nThe Beginning"],
        ["number",             14, title, "XIV"],
    ];

    for (const [format, n, t, expected] of cases) {
        it(`${format} n=${n}`, () => {
            expect(formatPartHeading(format, n, t, enLabels, lang)).toBe(expected);
        });
    }
});

// ---------------------------------------------------------------------------
// 3. Italian labels
// ---------------------------------------------------------------------------

describe("formatChapterHeading (Italian)", () => {
    it("label_number_title", () => {
        expect(formatChapterHeading("label_number_title", 1, "L'Arrivo", itLabels, "it"))
            .toBe("Capitolo 1\nL'Arrivo");
    });
});

describe("formatPartHeading (Italian)", () => {
    it("label_number_title", () => {
        expect(formatPartHeading("label_number_title", 1, "L'Inizio", itLabels, "it"))
            .toBe("Parte I\nL'Inizio");
    });
});

// ---------------------------------------------------------------------------
// 4. CJK — Chinese (zh)
// ---------------------------------------------------------------------------

describe("formatChapterHeading (Chinese)", () => {
    const lang = "zh";

    it("label_number_title n=1", () => {
        expect(formatChapterHeading("label_number_title", 1, "The Arrival", zhLabels, lang))
            .toBe("第一章\nThe Arrival");
    });

    it("label_number n=3", () => {
        expect(formatChapterHeading("label_number", 3, "Unused", zhLabels, lang))
            .toBe("第三章");
    });
});

describe("formatPartHeading (Chinese)", () => {
    const lang = "zh";

    it("label_number_title n=1", () => {
        expect(formatPartHeading("label_number_title", 1, "The Beginning", zhLabels, lang))
            .toBe("第一部\nThe Beginning");
    });

    it("label_number n=2", () => {
        expect(formatPartHeading("label_number", 2, "Unused", zhLabels, lang))
            .toBe("第二部");
    });

    it("number n=1", () => {
        expect(formatPartHeading("number", 1, "Unused", zhLabels, lang))
            .toBe("一部");
    });
});

// ---------------------------------------------------------------------------
// 5. Korean (ko) — Arabic numerals with suffixes
// ---------------------------------------------------------------------------

describe("formatChapterHeading (Korean)", () => {
    const lang = "ko";

    // Korean uses CJK-style spacing (no space) with Arabic numerals and suffix
    it("label_number_title n=1", () => {
        expect(formatChapterHeading("label_number_title", 1, "The Arrival", koLabels, lang))
            .toBe("제1장\nThe Arrival");
    });
});

describe("formatPartHeading (Korean)", () => {
    const lang = "ko";

    // Korean uses CJK-style spacing (no space) with Arabic numerals and suffix
    it("label_number_title n=2", () => {
        expect(formatPartHeading("label_number_title", 2, "The End", koLabels, lang))
            .toBe("제2부\nThe End");
    });
});

// ---------------------------------------------------------------------------
// 6. toRoman
// ---------------------------------------------------------------------------

describe("toRoman", () => {
    const cases: [number, string][] = [
        [1, "I"],
        [2, "II"],
        [3, "III"],
        [4, "IV"],
        [5, "V"],
        [9, "IX"],
        [10, "X"],
        [14, "XIV"],
        [40, "XL"],
        [50, "L"],
        [99, "XCIX"],
        [100, "C"],
    ];

    for (const [input, expected] of cases) {
        it(`${input} → ${expected}`, () => {
            expect(toRoman(input)).toBe(expected);
        });
    }
});

// ---------------------------------------------------------------------------
// 7. toCjk
// ---------------------------------------------------------------------------

describe("toCjk", () => {
    const cases: [number, string][] = [
        [1, "一"],
        [2, "二"],
        [3, "三"],
        [10, "十"],
        [11, "十一"],
        [20, "二十"],
        [100, "一百"],
    ];

    for (const [input, expected] of cases) {
        it(`${input} → ${expected}`, () => {
            expect(toCjk(input)).toBe(expected);
        });
    }
});

// ---------------------------------------------------------------------------
// 8. formatPartHeading with empty title
// ---------------------------------------------------------------------------

describe("formatPartHeading (empty title)", () => {
    const lang = "en";

    it("label_number_title falls back to labelNum (no newline)", () => {
        expect(formatPartHeading("label_number_title", 1, "", enLabels, lang))
            .toBe("Part I");
    });

    it("title falls back to labelNum when title is empty", () => {
        expect(formatPartHeading("title", 1, "", enLabels, lang))
            .toBe("Part I");
    });
});
