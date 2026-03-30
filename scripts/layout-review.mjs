import { execFileSync } from "node:child_process";
import {
    copyFileSync,
    cpSync,
    existsSync,
    mkdirSync,
    readFileSync,
    readdirSync,
    rmSync,
    writeFileSync,
} from "node:fs";
import { basename, extname, join } from "node:path";
import { parse, stringify } from "yaml";

const ROOT = process.cwd();
const DIST_CLI = join(ROOT, "dist", "cli.js");
const TMP_ROOT = join(ROOT, "tmp", "layout-review");
const WORK_ROOT = join(TMP_ROOT, "work");

const REVIEW_CASES = [
    { project: "int-novel", presets: ["screen", "a5", "trade", "kdp"], formats: ["html", "pdf", "docx"] },
    { project: "int-novel-parts", presets: ["screen", "a5"], formats: ["html", "pdf", "docx"] },
    { project: "int-paper", presets: ["a4"], formats: ["html", "pdf", "docx"] },
    { project: "int-essay", presets: ["screen"], formats: ["html", "pdf", "docx"] },
    { project: "int-collection", presets: ["screen"], formats: ["html", "pdf", "docx"] },
];

if (!existsSync(DIST_CLI)) {
    console.error("dist/cli.js not found. Run `npm run build` first.");
    process.exit(1);
}

function cloneProject(project, preset) {
    const srcDir = join(ROOT, "sandbox", project);
    const targetDir = join(WORK_ROOT, `${project}-${preset}`);
    if (!existsSync(srcDir)) {
        return null;
    }

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

function findGeneratedFile(buildDir, format) {
    const files = readdirSync(buildDir).filter((file) => file.endsWith(`.${format}`));
    if (files.length === 0) {
        throw new Error(`No .${format} file found in ${buildDir}`);
    }
    return join(buildDir, files[0]);
}

function ensureDir(dir) {
    mkdirSync(dir, { recursive: true });
}

function copyArtifact(sourcePath, project, preset, format) {
    const ext = extname(sourcePath);
    const targetDir = join(TMP_ROOT, format);
    const byCaseDir = join(TMP_ROOT, "by-case", `${project}--${preset}`);
    const flatTarget = join(targetDir, `${project}--${preset}${ext}`);
    const caseTarget = join(byCaseDir, basename(sourcePath));

    ensureDir(targetDir);
    ensureDir(byCaseDir);
    copyFileSync(sourcePath, flatTarget);
    copyFileSync(sourcePath, caseTarget);

    return {
        format,
        sourcePath,
        flatTarget,
        caseTarget,
    };
}

function writeReadme(entries) {
    const lines = [
        "# Layout Review Outputs",
        "",
        "Flat folders by format:",
        "- `pdf/`",
        "- `html/`",
        "- `docx/`",
        "",
        "Per-case folders:",
        "- `by-case/<project>--<preset>/`",
        "",
        "Generated files:",
    ];

    for (const entry of entries) {
        if (entry.error) {
            lines.push(`- ${entry.project} / ${entry.preset} / ${entry.format}: ERROR - ${entry.error}`);
        } else {
            lines.push(`- ${entry.project} / ${entry.preset} / ${entry.format}: ${entry.flatTarget.replace(`${ROOT}\\`, "")}`);
        }
    }

    lines.push("");
    writeFileSync(join(TMP_ROOT, "README.md"), lines.join("\n"), "utf-8");
}

async function main() {
    rmSync(TMP_ROOT, { recursive: true, force: true });
    ensureDir(TMP_ROOT);
    ensureDir(WORK_ROOT);

    const results = [];

    for (const reviewCase of REVIEW_CASES) {
        for (const preset of reviewCase.presets) {
            const workDir = cloneProject(reviewCase.project, preset);
            if (!workDir) {
                for (const format of reviewCase.formats) {
                    results.push({
                        project: reviewCase.project,
                        preset,
                        format,
                        error: `Sandbox project not found: ${join(ROOT, "sandbox", reviewCase.project)}`,
                    });
                }
                continue;
            }
            for (const format of reviewCase.formats) {
                try {
                    runCli(["build", format], workDir);
                    const artifact = findGeneratedFile(join(workDir, "build"), format);
                    const copied = copyArtifact(artifact, reviewCase.project, preset, format);
                    results.push({
                        project: reviewCase.project,
                        preset,
                        format,
                        ...copied,
                    });
                } catch (error) {
                    results.push({
                        project: reviewCase.project,
                        preset,
                        format,
                        error: error instanceof Error ? error.message : String(error),
                    });
                }
            }
        }
    }

    writeFileSync(join(TMP_ROOT, "index.json"), JSON.stringify(results, null, 2), "utf-8");
    writeReadme(results);

    console.log("Layout review gallery ready");
    console.log(`Root: ${TMP_ROOT}`);
    console.log(`Index: ${join(TMP_ROOT, "index.json")}`);
    console.log(`Readme: ${join(TMP_ROOT, "README.md")}`);
}

await main();
