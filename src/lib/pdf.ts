import puppeteer from "puppeteer-core";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { existsSync } from "node:fs";
import type { BookConfig, Chapter, Contributor } from "./parse.js";
import type { Theme } from "./theme.js";
import type { Section, TypeFeatures } from "./project-type.js";
import { renderBook } from "./html.js";
import { getPreset, DEFAULT_PRESET, type PrintPreset } from "./print-presets.js";
import { loadTypography } from "./typography.js";

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

function resolvePreset(config: BookConfig, typeDefaultPreset?: string): PrintPreset {
    const presetName = config.print_preset ?? typeDefaultPreset ?? DEFAULT_PRESET;
    return getPreset(presetName) ?? getPreset(DEFAULT_PRESET)!;
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

    const preset = resolvePreset(config, typeDefaultPreset);
    const buildDir = join(projectDir, "build");
    await mkdir(buildDir, { recursive: true });

    // Generate HTML first
    const typography = await loadTypography(projectDir);
    const html = await renderBook(config, chapters, theme, contributors, backcover, coverImagePath, projectDir, typography, sections, features);
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

        // CSS @page margin boxes for headers/footers (Chrome 131+)
        // :first suppresses on cover, :left/:right for recto/verso layout
        let pageRules = "";
        if (showPageNumbers || showRunningHeader) {
            pageRules = `
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
        }

        await page.addStyleTag({
            content: `
            ${pageRules}

            /* Content sections */
            .cover, #toc, .chapter, .backcover, .about-authors, .colophon, .part-page {
                max-width: none;
                padding: ${showPageNumbers || showRunningHeader ? "0" : `${mt}mm ${mr}mm ${mb}mm ${ml}mm`};
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

            /* Chapters and parts start on recto (right page) if preset requires it */
            ${preset.rectoStart ? `.chapter, .part-page { break-before: recto; }` : `.part-page { break-before: page; page-break-before: always; }`}`,
        });

        const outPath = join(buildDir, filename);
        await page.pdf({
            path: outPath,
            width: `${preset.width}mm`,
            height: `${preset.height}mm`,
            margin: (showPageNumbers || showRunningHeader)
                ? { top: `${mt}mm`, bottom: `${mb}mm`, left: `${ml}mm`, right: `${mr}mm` }
                : { top: "0", bottom: "0", left: "0", right: "0" },
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
