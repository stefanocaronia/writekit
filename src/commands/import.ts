import { Command } from "commander";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { join, basename } from "node:path";
import { assertProject } from "../support/fs-utils.js";
import { slugify, padNumber } from "../support/slug.js";
import { frontmatter } from "../support/fs-utils.js";

interface ImportOptions {
    startAt?: string;
    part?: string;
}

interface ParsedChapter {
    title: string;
    body: string;
}

function splitMarkdownIntoChapters(content: string): ParsedChapter[] {
    const lines = content.split(/\r?\n/);
    const chapters: ParsedChapter[] = [];
    let currentTitle = "";
    let currentLines: string[] = [];

    for (const line of lines) {
        const headingMatch = line.match(/^#\s+(.+)$/);
        if (headingMatch) {
            // Save previous chapter if any
            if (currentTitle || currentLines.some((l) => l.trim())) {
                chapters.push({
                    title: currentTitle || "Untitled",
                    body: currentLines.join("\n").trim(),
                });
            }
            currentTitle = headingMatch[1].trim();
            currentLines = [];
        } else {
            currentLines.push(line);
        }
    }

    // Save last chapter
    if (currentTitle || currentLines.some((l) => l.trim())) {
        chapters.push({
            title: currentTitle || "Untitled",
            body: currentLines.join("\n").trim(),
        });
    }

    return chapters;
}

export const importCommand = new Command("import")
    .description("Import a Markdown file and split it into manuscript chapters")
    .argument("<file>", "Markdown file to import")
    .option("--start-at <number>", "Starting chapter number (default: next available)")
    .option("--part <number>", "Import into a part directory")
    .action(async (file: string, opts: ImportOptions) => {
        const projectDir = process.cwd();
        await assertProject(projectDir);

        const { c, icon } = await import("../support/ui.js");
        const { readdir } = await import("node:fs/promises");
        const { extname } = await import("node:path");

        // Read source file
        let content: string;
        try {
            content = await readFile(file, "utf-8");
        } catch {
            console.error(`\n${icon.error} ${c.red(`Cannot read file: ${file}`)}\n`);
            process.exit(1);
        }

        // Determine target directory
        const msDir = opts.part
            ? join(projectDir, "manuscript", `part-${padNumber(parseInt(opts.part, 10))}`)
            : join(projectDir, "manuscript");
        await mkdir(msDir, { recursive: true });

        // Determine starting chapter number
        let startNum = opts.startAt ? parseInt(opts.startAt, 10) : 0;
        if (!startNum) {
            try {
                const existing = await readdir(msDir);
                const mdFiles = existing.filter((f) => extname(f) === ".md");
                const nums = mdFiles.map((f) => parseInt(f, 10)).filter((n) => !isNaN(n));
                startNum = nums.length > 0 ? Math.max(...nums) + 1 : 1;
            } catch {
                startNum = 1;
            }
        }

        // Split and write
        const chapters = splitMarkdownIntoChapters(content);
        if (chapters.length === 0) {
            console.error(`\n${icon.error} ${c.red("No chapters found (split by # headings)")}\n`);
            process.exit(1);
        }

        console.log(`\n${icon.book} ${c.bold("Importing")} ${c.cyan(basename(file))} ${c.dim(`(${chapters.length} chapters)`)}\n`);

        const created: string[] = [];
        for (let i = 0; i < chapters.length; i++) {
            const ch = chapters[i];
            const num = startNum + i;
            const slug = slugify(ch.title);
            const filename = `${padNumber(num)}-${slug}.md`;
            const filePath = join(msDir, filename);

            const fm: Record<string, unknown> = {
                chapter: num,
                title: ch.title,
                draft: 1,
            };

            await writeFile(filePath, frontmatter(fm, `# ${ch.title}\n\n${ch.body}\n`));
            created.push(filename);
            console.log(`  ${c.green("+")} ${filename} ${c.dim(`— "${ch.title}"`)}`);
        }

        console.log(`\n${icon.done} ${c.green(`${created.length} chapters imported.`)}\n`);
    });
