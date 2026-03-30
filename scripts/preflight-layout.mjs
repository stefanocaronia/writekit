import { execFileSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import JSZip from "jszip";
import { parse, stringify } from "yaml";

const ROOT = process.cwd();
const DIST_CLI = join(ROOT, "dist", "cli.js");
const TMP_ROOT = join(ROOT, "tmp", "layout-preflight");

if (!existsSync(DIST_CLI)) {
    console.error("dist/cli.js not found. Run `npm run build` first.");
    process.exit(1);
}

const { getPreset } = await import(pathToFileURL(join(ROOT, "dist", "lib", "print-presets.js")).href);
const { loadChapters } = await import(pathToFileURL(join(ROOT, "dist", "lib", "parse.js")).href);

const CASES = [
    { project: "int-novel", preset: "screen", formats: ["docx", "pdf"] },
    { project: "int-novel", preset: "a5", formats: ["docx", "pdf"] },
    { project: "int-novel", preset: "trade", formats: ["docx", "pdf"] },
    { project: "int-novel", preset: "kdp", formats: ["docx", "pdf"] },
    { project: "int-paper", preset: "a4", formats: ["docx", "pdf"] },
    { project: "int-novel-parts", preset: "a5", formats: ["docx"] },
];

function mmToTwips(value) {
    return Math.round((value / 25.4) * 1440);
}

function twipsToMm(value) {
    return (Number(value) / 1440) * 25.4;
}

function pointsToMm(value) {
    return (Number(value) / 72) * 25.4;
}

function approxEqual(a, b, tolerance = 1.0) {
    return Math.abs(a - b) <= tolerance;
}

function round1(value) {
    return Math.round(value * 10) / 10;
}

function findGeneratedFile(buildDir, ext) {
    const files = readdirSync(buildDir).filter((file) => file.endsWith(`.${ext}`));
    if (files.length === 0) {
        throw new Error(`No .${ext} file found in ${buildDir}`);
    }
    return join(buildDir, files[0]);
}

function cloneProject(project, preset) {
    const srcDir = join(ROOT, "sandbox", project);
    const targetDir = join(TMP_ROOT, `${project}-${preset}`);
    rmSync(targetDir, { recursive: true, force: true });
    cpSync(srcDir, targetDir, { recursive: true });

    const configPath = join(targetDir, "config.yaml");
    const config = parse(readFileSync(configPath, "utf-8"));
    config.print_preset = preset;
    writeFileSync(configPath, stringify(config), "utf-8");
    return targetDir;
}

function runCli(args, cwd) {
    return execFileSync("node", [DIST_CLI, ...args], {
        cwd,
        encoding: "utf-8",
        stdio: "pipe",
        timeout: 120_000,
    });
}

async function inspectDocx(docxPath, expected) {
    const zip = await JSZip.loadAsync(readFileSync(docxPath));
    const documentXml = await zip.file("word/document.xml").async("string");
    const settingsXml = zip.file("word/settings.xml")
        ? await zip.file("word/settings.xml").async("string")
        : "";
    const headerNames = zip.file(/word\/header\d+\.xml/).map((file) => file.name);
    const headerXmls = await Promise.all(headerNames.map((name) => zip.file(name).async("string")));

    const pageSizes = [...documentXml.matchAll(/<w:pgSz\b[^>]*w:w="(\d+)"[^>]*w:h="(\d+)"/g)]
        .map((match) => ({
            widthTwips: Number(match[1]),
            heightTwips: Number(match[2]),
            widthMm: round1(twipsToMm(match[1])),
            heightMm: round1(twipsToMm(match[2])),
        }));

    const nonZeroMargins = [...documentXml.matchAll(/<w:pgMar\b[^>]*w:top="(\d+)"[^>]*w:right="(\d+)"[^>]*w:bottom="(\d+)"[^>]*w:left="(\d+)"[^>]*?(?:w:header="(\d+)")?[^>]*?(?:w:footer="(\d+)")?[^>]*?(?:w:gutter="(\d+)")?[^>]*\/>/g)]
        .map((match) => ({
            top: Number(match[1]),
            right: Number(match[2]),
            bottom: Number(match[3]),
            left: Number(match[4]),
            header: Number(match[5] ?? 0),
            footer: Number(match[6] ?? 0),
            gutter: Number(match[7] ?? 0),
        }))
        .filter((margin) => margin.top || margin.right || margin.bottom || margin.left);

    const headerReferenceCount = [...documentXml.matchAll(/<w:headerReference\b/g)].length;
    const oddPageSectionCount = [...documentXml.matchAll(/<w:type\b[^>]*w:val="oddPage"/g)].length;
    const evenAndOddHeaders = settingsXml.includes("evenAndOddHeaders");
    const mirrorMargins = settingsXml.includes("mirrorMargins");
    const pageFieldInHeader = headerXmls.some((xml) => xml.includes("PAGE"));
    const titleSeenInHeader = headerXmls.some((xml) => xml.includes(expected.title));
    const titleIndex = expected.title ? documentXml.indexOf(expected.title) : -1;
    const titleContext = titleIndex >= 0 ? documentXml.slice(Math.max(0, titleIndex - 2200), titleIndex + 200) : "";
    const titlePageRecto = expected.expectTitlePageRecto
        ? titleIndex >= 0
            && titleContext.includes('<w:color w:val="FFFFFF"')
            && titleContext.includes('<w:t xml:space="preserve"> </w:t>')
            && titleContext.includes('<w:pgMar w:top="0" w:right="0" w:bottom="0" w:left="0"')
            && titleContext.includes(`<w:pgMar w:top="${mmToTwips(expected.margin.top)}" w:right="${mmToTwips(expected.margin.outer)}" w:bottom="${mmToTwips(expected.margin.bottom)}" w:left="${mmToTwips(expected.margin.inner)}"`)
        : true;

    const sizeMatches = pageSizes.length > 0 && pageSizes.every((size) =>
        approxEqual(size.widthMm, expected.width) && approxEqual(size.heightMm, expected.height),
    );

    const marginMatch = nonZeroMargins.some((margin) =>
        approxEqual(round1(twipsToMm(margin.top)), expected.margin.top) &&
        approxEqual(round1(twipsToMm(margin.bottom)), expected.margin.bottom) &&
        approxEqual(round1(twipsToMm(margin.left)), expected.margin.inner) &&
        approxEqual(round1(twipsToMm(margin.right)), expected.margin.outer),
    );

    const expectations = {
        sizeMatches,
        marginMatch,
        headerPresenceMatches: expected.runningHeader || expected.pageNumbers ? headerReferenceCount > 0 : headerReferenceCount === 0,
        evenOddMatches: expected.runningHeader ? evenAndOddHeaders : true,
        mirrorMarginsMatches: expected.mirrorMargins ? mirrorMargins : !mirrorMargins,
        pageFieldMatches: expected.pageNumbers ? pageFieldInHeader : !pageFieldInHeader,
        oddPageMatches: expected.rectoStart ? oddPageSectionCount === expected.expectedOddPageSections : oddPageSectionCount === 0,
        titlePageRectoMatches: titlePageRecto,
        titleVisibilityMatches: expected.runningHeader ? titleSeenInHeader : !titleSeenInHeader,
    };

    return {
        path: docxPath,
        pageSizes,
        nonZeroMargins: nonZeroMargins.map((margin) => ({
            topMm: round1(twipsToMm(margin.top)),
            rightMm: round1(twipsToMm(margin.right)),
            bottomMm: round1(twipsToMm(margin.bottom)),
            leftMm: round1(twipsToMm(margin.left)),
            headerMm: round1(twipsToMm(margin.header)),
            footerMm: round1(twipsToMm(margin.footer)),
            gutterMm: round1(twipsToMm(margin.gutter)),
        })),
        headerReferenceCount,
        oddPageSectionCount,
        evenAndOddHeaders,
        mirrorMargins,
        pageFieldInHeader,
        titleSeenInHeader,
        titlePageRecto,
        expectations,
        ok: Object.values(expectations).every(Boolean),
        limitations: expected.mirrorMargins
            ? ["DOCX mirror margins are now certified structurally via settings.xml, but perceived gutter balance still needs visual review in a real reader."]
            : [],
    };
}

function inspectPdf(pdfPath, expected) {
    const raw = readFileSync(pdfPath).toString("latin1");
    const mediaBoxes = [...raw.matchAll(/\/MediaBox\s*\[\s*0\s+0\s+([0-9.]+)\s+([0-9.]+)\s*\]/g)]
        .map((match) => ({
            widthPt: Number(match[1]),
            heightPt: Number(match[2]),
            widthMm: round1(pointsToMm(match[1])),
            heightMm: round1(pointsToMm(match[2])),
        }));

    const uniqueBoxes = [];
    for (const box of mediaBoxes) {
        if (!uniqueBoxes.some((candidate) => candidate.widthPt === box.widthPt && candidate.heightPt === box.heightPt)) {
            uniqueBoxes.push(box);
        }
    }

    const sizeMatches = uniqueBoxes.length > 0 && uniqueBoxes.every((box) =>
        approxEqual(box.widthMm, expected.width) && approxEqual(box.heightMm, expected.height),
    );

    return {
        path: pdfPath,
        mediaBoxes: uniqueBoxes,
        ok: sizeMatches,
        expectations: { sizeMatches },
        limitations: [
            "PDF preflight currently certifies page size only.",
            "Headers, page numbers, blank pages, and visual mirror margins still need rendered/manual review.",
        ],
    };
}

async function runCase(testCase) {
    const preset = getPreset(testCase.preset);
    if (!preset) {
        throw new Error(`Unknown preset: ${testCase.preset}`);
    }

    const workingDir = cloneProject(testCase.project, testCase.preset);
    const chapters = await loadChapters(workingDir);
    const contentChapterCount = chapters.filter((chapter) => !chapter.sectionKind).length;
    const partStartCount = chapters
        .filter((chapter) => !chapter.sectionKind)
        .reduce((count, chapter, index, list) => count + ((index === 0 || chapter.part !== list[index - 1].part) && chapter.part ? 1 : 0), 0);
    const config = parse(readFileSync(join(workingDir, "config.yaml"), "utf-8"));
    const hasCover = existsSync(join(workingDir, "assets", "cover.png"))
        || existsSync(join(workingDir, "assets", "cover.jpg"))
        || existsSync(join(workingDir, "assets", "cover.jpeg"))
        || existsSync(join(workingDir, "assets", "cover.webp"));
    const expectTitlePageRecto = testCase.project !== "int-paper" && preset.rectoStart && hasCover;

    const result = {
        project: testCase.project,
        preset: testCase.preset,
        title: config.title,
        expected: {
            width: preset.width,
            height: preset.height,
            margin: preset.margin,
            pageNumbers: preset.pageNumbers,
            runningHeader: preset.runningHeader,
            mirrorMargins: preset.mirrorMargins,
            rectoStart: preset.rectoStart,
            expectedOddPageSections: preset.rectoStart ? contentChapterCount + partStartCount : 0,
            expectTitlePageRecto,
            title: String(config.title ?? ""),
        },
        builds: {},
    };

    for (const format of testCase.formats) {
        try {
            runCli(["build", format], workingDir);
            const buildDir = join(workingDir, "build");
            if (format === "docx") {
                const docxPath = findGeneratedFile(buildDir, "docx");
                result.builds.docx = await inspectDocx(docxPath, result.expected);
            } else if (format === "pdf") {
                const pdfPath = findGeneratedFile(buildDir, "pdf");
                result.builds.pdf = inspectPdf(pdfPath, result.expected);
            }
        } catch (error) {
            result.builds[format] = {
                ok: false,
                error: error instanceof Error ? error.message : String(error),
            };
        }
    }

    result.ok = Object.values(result.builds).every((entry) => entry.ok === true);
    return result;
}

function printCaseResult(result) {
    console.log(`\n[${result.ok ? "PASS" : "FAIL"}] ${result.project} / ${result.preset}`);
    if (result.builds.docx) {
        const docx = result.builds.docx;
        if (docx.error) {
            console.log(`  DOCX: ${docx.error}`);
        } else {
            console.log(`  DOCX size: ${docx.expectations.sizeMatches ? "ok" : "mismatch"}`);
            console.log(`  DOCX margins: ${docx.expectations.marginMatch ? "ok" : "mismatch"}`);
            console.log(`  DOCX headers: ${docx.expectations.headerPresenceMatches ? "ok" : "mismatch"}`);
            console.log(`  DOCX mirror margins: ${docx.expectations.mirrorMarginsMatches ? "ok" : "mismatch"}`);
            console.log(`  DOCX page field: ${docx.expectations.pageFieldMatches ? "ok" : "mismatch"}`);
            console.log(`  DOCX odd-page sections: ${docx.expectations.oddPageMatches ? "ok" : "mismatch"}`);
            console.log(`  DOCX title page recto: ${docx.expectations.titlePageRectoMatches ? "ok" : "mismatch"}`);
            console.log(`  DOCX header title visibility: ${docx.expectations.titleVisibilityMatches ? "ok" : "mismatch"}`);
        }
    }
    if (result.builds.pdf) {
        const pdf = result.builds.pdf;
        if (pdf.error) {
            console.log(`  PDF: ${pdf.error}`);
        } else {
            console.log(`  PDF size: ${pdf.expectations.sizeMatches ? "ok" : "mismatch"}`);
        }
    }
}

async function main() {
    rmSync(TMP_ROOT, { recursive: true, force: true });
    mkdirSync(TMP_ROOT, { recursive: true });

    const results = [];
    for (const testCase of CASES) {
        results.push(await runCase(testCase));
    }

    const reportPath = join(TMP_ROOT, "report.json");
    writeFileSync(reportPath, JSON.stringify(results, null, 2), "utf-8");

    console.log("Layout preflight report");
    console.log(`Root: ${TMP_ROOT}`);
    for (const result of results) {
        printCaseResult(result);
    }

    const failed = results.filter((result) => !result.ok);
    console.log(`\nSummary: ${results.length - failed.length}/${results.length} case(s) passed`);
    console.log(`Detailed JSON: ${reportPath}`);

    if (failed.length > 0) {
        process.exitCode = 1;
    }
}

await main();
