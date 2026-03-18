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

function resolvePreset(config: BookConfig): PrintPreset {
    const presetName = config.print_preset ?? DEFAULT_PRESET;
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
): Promise<string> {
    const browserPath = findBrowser();
    if (!browserPath) {
        throw new Error(
            "No Chrome or Edge found. Install Chrome/Edge or set CHROME_PATH environment variable.",
        );
    }

    const preset = resolvePreset(config);
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

        // Header/footer configuration from typography settings
        const showPageNumbers = typography.pageNumbers;
        const showRunningHeader = typography.runningHeader;
        const useHeaderFooter = showPageNumbers || showRunningHeader;

        // Use theme's DOCX font (body font) for header/footer, fallback to Georgia
        const headerFont = theme.docx?.font || "Georgia";

        // PDF margins: when displayHeaderFooter is true, Puppeteer needs margin
        // space for the header and footer areas. Content uses CSS padding for
        // left/right margins so the cover can remain full-bleed.
        const pdfMarginTop = showRunningHeader ? "15mm" : "0";
        const pdfMarginBottom = showPageNumbers ? "12mm" : "0";

        // Compensate CSS top/bottom padding when PDF margins provide that space
        const mt = showRunningHeader ? Math.max(0, preset.margin.top - 15) : preset.margin.top;
        const mb = showPageNumbers ? Math.max(0, preset.margin.bottom - 12) : preset.margin.bottom;
        const ml = preset.margin.inner;
        const mr = preset.margin.outer;

        // Inject styles: margins via CSS padding (not PDF margins) so cover can be full-bleed
        await page.addStyleTag({
            content: `
            /* Content margins via padding instead of PDF margins */
            .cover { padding: ${mt}mm ${mr}mm ${mb}mm ${ml}mm; }
            #toc { padding: ${mt}mm ${mr}mm ${mb}mm ${ml}mm; }
            .chapter { padding: ${mt}mm ${mr}mm ${mb}mm ${ml}mm; }
            .backcover { padding: ${mt}mm ${mr}mm ${mb}mm ${ml}mm; }
            .about-authors { padding: ${mt}mm ${mr}mm ${mb}mm ${ml}mm; }
            .colophon { padding: ${mt}mm ${mr}mm ${mb}mm ${ml}mm; }

            /* Cover page: full bleed, no padding */
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

            /* Chapters start on recto (right-hand page); inserts blank if needed */
            .chapter, .part-page { break-before: right; page-break-before: right; }

            /* Mirror margins: Puppeteer has limited @page :left/:right support.
               Uniform left/right CSS padding is used for now. True recto/verso
               margin mirroring requires post-processing or a dedicated PDF engine. */`,
        });

        // Build header template (running header with book title)
        const headerTemplate = showRunningHeader
            ? `<div style="font-size:8px;text-align:center;width:100%;color:#555;font-family:'${headerFont}',Georgia,serif;font-style:italic;padding:0 15mm;">` +
              `<span class="title"></span></div>`
            : `<div></div>`;

        // Build footer template (centered page number)
        const footerTemplate = showPageNumbers
            ? `<div style="font-size:9px;text-align:center;width:100%;color:#555;font-family:'${headerFont}',Georgia,serif;">` +
              `<span class="pageNumber"></span></div>`
            : `<div></div>`;

        const outPath = join(buildDir, filename);
        await page.pdf({
            path: outPath,
            width: `${preset.width}mm`,
            height: `${preset.height}mm`,
            margin: {
                top: pdfMarginTop,
                bottom: pdfMarginBottom,
                left: "0",
                right: "0",
            },
            printBackground: true,
            displayHeaderFooter: useHeaderFooter,
            ...(useHeaderFooter && { headerTemplate, footerTemplate }),
        });

        return outPath;
    } finally {
        await browser.close();
        const { unlink } = await import("node:fs/promises");
        await unlink(htmlPath).catch(() => {});
    }
}
