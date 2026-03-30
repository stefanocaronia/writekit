import puppeteer from "puppeteer-core";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { existsSync } from "node:fs";
import type { BookConfig, Chapter, Contributor } from "../project/parse.js";
import type { Theme } from "../support/theme.js";
import type { Section, TypeFeatures } from "../project/project-type.js";
import { renderBook } from "./html.js";
import { resolvePrintPreset } from "./print-presets.js";
import { loadTypography } from "../support/typography.js";

const CHROME_PATHS_WIN = [
    process.env.PROGRAMFILES + "\\Google\\Chrome\\Application\\chrome.exe",
    process.env["PROGRAMFILES(X86)"] + "\\Google\\Chrome\\Application\\chrome.exe",
    process.env.LOCALAPPDATA + "\\Google\\Chrome\\Application\\chrome.exe",
    process.env.PROGRAMFILES + "\\Microsoft\\Edge\\Application\\msedge.exe",
    process.env["PROGRAMFILES(X86)"] + "\\Microsoft\\Edge\\Application\\msedge.exe",
];

const CHROME_PATHS_MAC = [
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
];

const CHROME_PATHS_LINUX = [
    "/usr/bin/google-chrome",
    "/usr/bin/google-chrome-stable",
    "/usr/bin/chromium",
    "/usr/bin/chromium-browser",
    "/usr/bin/microsoft-edge",
];

function findBrowser(): string | null {
    const platform = process.platform;
    let paths: string[] = [];

    if (platform === "win32") paths = CHROME_PATHS_WIN;
    else if (platform === "darwin") paths = CHROME_PATHS_MAC;
    else paths = CHROME_PATHS_LINUX;

    for (const p of paths) {
        if (p && existsSync(p)) return p;
    }
    return null;
}

export async function buildPdf(
    projectDir: string,
    config: BookConfig,
    chapters: Chapter[],
    theme: Theme,
    filename = "book.pdf",
    contributors: Contributor[] = [],
    backcover = "",
    coverImagePath?: string | null,
    sections?: Section[],
    features?: TypeFeatures,
    typeDefaultPreset?: string,
): Promise<string> {
    const browserPath = findBrowser();
    if (!browserPath) {
        throw new Error(
            "No Chrome or Edge found. Install Chrome/Edge or set CHROME_PATH environment variable.",
        );
    }

    const preset = await resolvePrintPreset(config, typeDefaultPreset, projectDir);
    const buildDir = join(projectDir, "build");
    await mkdir(buildDir, { recursive: true });

    // Generate HTML first
    const typography = await loadTypography(projectDir);
    let html = await renderBook(config, chapters, theme, contributors, backcover, coverImagePath, projectDir, typography, sections, features);

    if (preset.rectoStart) {
        // Inject blank-verso after cover-page only (Puppeteer ignores break-before:right)
        const blanko = `<div class="blank-verso">&nbsp;</div>\n`;
        html = html.replace(/(<\/section>\s*)(<header class="cover">)/g, `$1${blanko}$2`);
        // Inject CSS
        html = html.replace("</head>", `<style>
.blank-verso { display: block; page: silent; break-after: page; page-break-after: always; height: 1px; visibility: hidden; }
</style>\n</head>`);
    } else {
        // Remove blank-verso pages entirely for screen preset
        html = html.replace(/<div class="blank-verso"[^>]*>[^<]*<\/div>/g, "");
    }

    const htmlPath = join(buildDir, "_temp.html");
    await writeFile(htmlPath, html, "utf-8");

    const browser = await puppeteer.launch({
        executablePath: process.env.CHROME_PATH || browserPath,
        headless: true,
        args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });

    try {
        const page = await browser.newPage();
        await page.goto(`file://${htmlPath.replace(/\\/g, "/")}`, {
            waitUntil: "networkidle0",
        });

        const mt = preset.margin.top;
        const mb = preset.margin.bottom;
        const ml = preset.margin.inner;
        const mr = preset.margin.outer;
        const showPageNumbers = preset.pageNumbers;
        const showRunningHeader = preset.runningHeader;
        const bookTitle = config.title || "";

        // CSS @page rules must exist for all presets, otherwise long chapters in
        // screen PDFs lose top/bottom margins on continued pages.
        const pageRules = `
            @page {
                margin: ${mt}mm ${mr}mm ${mb}mm ${ml}mm;
                ${showRunningHeader ? `@top-center { content: "${bookTitle.replace(/"/g, '\\"')}"; font: italic 8pt Georgia, serif; color: #555; }` : ""}
                ${showPageNumbers ? `@bottom-center { content: counter(page); font: 8pt Georgia, serif; color: #555; }` : ""}
            }
            @page :first {
                ${showRunningHeader ? `@top-center { content: none; }` : ""}
                ${showPageNumbers ? `@bottom-center { content: none; }` : ""}
            }
            @page silent {
                @top-center { content: none; } @top-left { content: none; } @top-right { content: none; }
                @bottom-center { content: none; } @bottom-left { content: none; } @bottom-right { content: none; }
            }
            @page fullbleed {
                margin: 0;
                @top-center { content: none; } @top-left { content: none; } @top-right { content: none; }
                @bottom-center { content: none; } @bottom-left { content: none; } @bottom-right { content: none; }
            }
            ${showPageNumbers ? `
            @page :left {
                ${preset.mirrorMargins ? `margin-left: ${mr}mm; margin-right: ${ml}mm;` : ""}
                @bottom-center { content: none; }
                @bottom-left { content: counter(page); font: 8pt Georgia, serif; color: #555; }
                ${showRunningHeader ? `@top-center { content: none; }
                @top-right { content: "${bookTitle.replace(/"/g, '\\"')}"; font: italic 8pt Georgia, serif; color: #555; }
                @top-left { content: none; }` : ""}
            }
            @page :right {
                ${preset.mirrorMargins ? `margin-left: ${ml}mm; margin-right: ${mr}mm;` : ""}
                @bottom-center { content: none; }
                @bottom-right { content: counter(page); font: 8pt Georgia, serif; color: #555; }
                ${showRunningHeader ? `@top-center { content: none; }
                @top-left { content: "${bookTitle.replace(/"/g, '\\"')}"; font: italic 8pt Georgia, serif; color: #555; }
                @top-right { content: none; }` : ""}
            }` : ""}`;

        await page.addStyleTag({
            content: `
            ${pageRules}

            /* Content sections */
            .cover, #toc, .chapter, .backcover, .about-authors, .colophon, .part-page {
                max-width: none;
                padding: 0;
            }

            /* Title page should be centered within the printable area, not the full sheet. */
            .cover {
                min-height: auto;
                height: calc(${preset.height}mm - ${mt + mb}mm);
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                border: none;
            }

            /* Cover: full bleed, no margins, no headers */
            .cover-page { page: fullbleed; }

            /* Suppress headers/footers on non-content pages */
            .cover, #toc, .backcover, .about-authors, .colophon, .part-page,
            .section-dedication { page: silent; }

            /* Cover page: full bleed */
            .cover-page {
                padding: 0 !important;
                margin: 0 !important;
                max-width: none !important;
            }
            .cover-page .cover-image {
                width: 100vw !important;
                height: 100vh !important;
                max-width: none !important;
                max-height: none !important;
                object-fit: fill;
                display: block;
            }

            /* Screen/non-print presets should not keep book-style half-page chapter openings */
            ${!preset.rectoStart ? `
            .chapter > h1:first-child,
            .chapter > .chapter-number:first-child + h1 {
                margin-top: 2rem !important;
            }
            .part-page {
                padding: 2rem 0 1.5rem !important;
            }` : ""}

            /* Keep TOC on the next page after title; chapters/parts start on right pages. */
            #toc {
                break-before: page;
                page-break-before: always;
            }
            ${preset.rectoStart
                ? `.chapter, .part-page {
                break-before: right;
                page-break-before: right;
            }`
                : `.part-page {
                break-before: page;
                page-break-before: always;
            }`}`,
        });

        const outPath = join(buildDir, filename);
        await page.pdf({
            path: outPath,
            width: `${preset.width}mm`,
            height: `${preset.height}mm`,
            margin: { top: "0", bottom: "0", left: "0", right: "0" },
            printBackground: true,
            displayHeaderFooter: false,
        });

        return outPath;
    } finally {
        await browser.close();
        const { unlink } = await import("node:fs/promises");
        await unlink(htmlPath).catch(() => {});
    }
}
