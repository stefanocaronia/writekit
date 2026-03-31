import { Command } from "commander";
import { readFile, readdir, writeFile } from "node:fs/promises";
import { join, extname, relative } from "node:path";
import { assertProject, fileExists, dirExists } from "../support/fs-utils.js";
import { loadConfig } from "../project/parse.js";
import { loadType } from "../project/project-type.js";

async function collectMdFiles(dir: string, baseDir: string): Promise<{ relPath: string; content: string }[]> {
    if (!(await dirExists(dir))) return [];
    const entries = await readdir(dir, { withFileTypes: true });
    const results: { relPath: string; content: string }[] = [];

    for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
        const fullPath = join(dir, entry.name);
        if (entry.isDirectory()) {
            results.push(...await collectMdFiles(fullPath, baseDir));
        } else if (extname(entry.name) === ".md") {
            const content = await readFile(fullPath, "utf-8");
            results.push({ relPath: relative(baseDir, fullPath).replace(/\\/g, "/"), content });
        }
    }
    return results;
}

async function readIfExists(path: string): Promise<string | null> {
    if (!(await fileExists(path))) return null;
    return readFile(path, "utf-8");
}

export const exportCommand = new Command("export")
    .description("Export entire project to a single structured Markdown file")
    .option("-o, --output <path>", "Output file path (default: build/<title>-export.md)")
    .action(async (opts: { output?: string }) => {
        const projectDir = process.cwd();
        await assertProject(projectDir);

        const { c, icon } = await import("../support/ui.js");
        const config = await loadConfig(projectDir);
        const typeName = config.type || "novel";
        const typeDef = await loadType(typeName, projectDir);
        const authors = Array.isArray(config.author) ? config.author.join(", ") : config.author;

        console.log(`\n${icon.book} ${c.bold("Exporting project...")} ${c.dim(`(${typeDef.name})`)}\n`);

        const sections: string[] = [];

        // Header
        sections.push(`# ${config.title}\n`);
        sections.push(`> ${typeDef.name} project by ${authors}`);
        sections.push(`> Exported from writekit on ${new Date().toISOString().split("T")[0]}\n`);

        // Config
        const configYaml = await readIfExists(join(projectDir, "config.yaml"));
        if (configYaml) {
            sections.push("## Config\n");
            sections.push("```yaml\n" + configYaml.trim() + "\n```\n");
        }

        // Style
        const styleYaml = await readIfExists(join(projectDir, "style.yaml"));
        if (styleYaml) {
            sections.push("## Style\n");
            sections.push("```yaml\n" + styleYaml.trim() + "\n```\n");
        }

        // Synopsis
        const synopsis = await readIfExists(join(projectDir, "synopsis.md"));
        if (synopsis) {
            sections.push("## Synopsis\n");
            sections.push(synopsis.trim() + "\n");
        }

        // Timeline (novel)
        const timeline = await readIfExists(join(projectDir, "timeline.yaml"));
        if (timeline) {
            sections.push("## Timeline\n");
            sections.push("```yaml\n" + timeline.trim() + "\n```\n");
        }

        // Thesis (essay)
        const thesis = await readIfExists(join(projectDir, "thesis.md"));
        if (thesis) {
            sections.push("## Thesis\n");
            sections.push(thesis.trim() + "\n");
        }

        // Abstract (paper)
        const abstract = await readIfExists(join(projectDir, "abstract.md"));
        if (abstract) {
            sections.push("## Abstract\n");
            sections.push(abstract.trim() + "\n");
        }

        // Bibliography (paper)
        const bib = await readIfExists(join(projectDir, "bibliography.yaml"));
        if (bib) {
            sections.push("## Bibliography\n");
            sections.push("```yaml\n" + bib.trim() + "\n```\n");
        }

        // Back cover
        const backcover = await readIfExists(join(projectDir, "backcover.md"));
        if (backcover) {
            sections.push("## Back Cover\n");
            sections.push(backcover.trim() + "\n");
        }

        // Characters
        const characterFiles = await collectMdFiles(join(projectDir, "characters"), projectDir);
        if (characterFiles.length > 0) {
            sections.push("## Characters\n");
            for (const f of characterFiles) {
                sections.push(`### ${f.relPath}\n`);
                sections.push(f.content.trim() + "\n");
            }
        }

        // World
        const worldFiles = await collectMdFiles(join(projectDir, "world"), projectDir);
        if (worldFiles.length > 0) {
            sections.push("## World\n");
            for (const f of worldFiles) {
                sections.push(`### ${f.relPath}\n`);
                sections.push(f.content.trim() + "\n");
            }
        }

        // Arguments (essay)
        const argFiles = await collectMdFiles(join(projectDir, "arguments"), projectDir);
        if (argFiles.length > 0) {
            sections.push("## Arguments\n");
            for (const f of argFiles) {
                sections.push(`### ${f.relPath}\n`);
                sections.push(f.content.trim() + "\n");
            }
        }

        // Concepts
        const conceptFiles = await collectMdFiles(join(projectDir, "concepts"), projectDir);
        if (conceptFiles.length > 0) {
            sections.push("## Concepts\n");
            for (const f of conceptFiles) {
                sections.push(`### ${f.relPath}\n`);
                sections.push(f.content.trim() + "\n");
            }
        }

        // Outline
        const outlineFiles = await collectMdFiles(join(projectDir, "outline"), projectDir);
        if (outlineFiles.length > 0) {
            sections.push("## Outline\n");
            for (const f of outlineFiles) {
                sections.push(`### ${f.relPath}\n`);
                sections.push(f.content.trim() + "\n");
            }
        }

        // Manuscript (main content — last, as it's the longest)
        const msFiles = await collectMdFiles(join(projectDir, "manuscript"), projectDir);
        if (msFiles.length > 0) {
            sections.push("## Manuscript\n");
            for (const f of msFiles) {
                sections.push(`### ${f.relPath}\n`);
                sections.push(f.content.trim() + "\n");
            }
        }

        // Contributors
        const contribFiles = await collectMdFiles(join(projectDir, "contributors"), projectDir);
        if (contribFiles.length > 0) {
            sections.push("## Contributors\n");
            for (const f of contribFiles) {
                sections.push(`### ${f.relPath}\n`);
                sections.push(f.content.trim() + "\n");
            }
        }

        // Notes
        const noteFiles = await collectMdFiles(join(projectDir, "notes"), projectDir);
        if (noteFiles.length > 0) {
            sections.push("## Notes\n");
            for (const f of noteFiles) {
                sections.push(`### ${f.relPath}\n`);
                sections.push(f.content.trim() + "\n");
            }
        }

        // Write output
        const output = sections.join("\n");
        const { bookFilename } = await import("../support/fs-utils.js");
        const { mkdir } = await import("node:fs/promises");

        const outputPath = opts.output
            ?? join(projectDir, "build", bookFilename(config.title, config.author, "export.md"));

        await mkdir(join(projectDir, "build"), { recursive: true });
        await writeFile(outputPath, output);

        const relOutput = relative(projectDir, outputPath).replace(/\\/g, "/");
        console.log(`  ${icon.done} ${c.green(relOutput)}`);

        // Stats
        const wordCount = output.split(/\s+/).length;
        const sectionCount = sections.filter((s) => s.startsWith("## ")).length;
        console.log(`  ${c.dim(`${sectionCount} sections, ~${wordCount.toLocaleString()} words`)}\n`);
    });
