import puppeteer from "puppeteer-core";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { existsSync } from "node:fs";
import type { BookConfig, Chapter, Contributor } from "./parse.js";
import type { Theme } from "./theme.js";
import { renderBook } from "./html.js";
import { getPreset, DEFAULT_PRESET, type PrintPreset } from "./print-presets.js";

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
    const html = await renderBook(config, chapters, theme, contributors, backcover, coverImagePath, projectDir);
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

        // Inject cover-page styles to compensate PDF margins
        await page.addStyleTag({
            content: `.cover-page {
                margin: -${preset.margin.top}mm -${preset.margin.outer}mm -${preset.margin.bottom}mm -${preset.margin.inner}mm;
                padding: 0;
                width: ${preset.width}mm;
                height: ${preset.height}mm;
                display: flex;
                align-items: center;
                justify-content: center;
                overflow: hidden;
            }
            .cover-page .cover-image {
                width: ${preset.width}mm;
                height: ${preset.height}mm;
                object-fit: cover;
                max-height: none;
            }`,
        });

        const outPath = join(buildDir, filename);
        await page.pdf({
            path: outPath,
            width: `${preset.width}mm`,
            height: `${preset.height}mm`,
            margin: {
                top: `${preset.margin.top}mm`,
                bottom: `${preset.margin.bottom}mm`,
                left: `${preset.margin.inner}mm`,
                right: `${preset.margin.outer}mm`,
            },
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
