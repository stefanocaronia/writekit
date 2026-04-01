import { Command } from "commander";
import { readFile, writeFile, readdir, unlink, rename, rm } from "node:fs/promises";
import { join, extname } from "node:path";
import { stringify, parse as parseYaml } from "yaml";
import { assertProject, fileExists, dirExists } from "../support/fs-utils.js";
import { SECTION_FILE_MAP } from "../project/parse.js";
import { slugify, padNumber } from "../support/slug.js";
import { loadType, hasType, getRemoveCommands } from "../project/project-type.js";
import { c, icon } from "../support/ui.js";

async function assertRemoveCommand(projectDir: string, command: string): Promise<void> {
    try {
        const raw = await readFile(join(projectDir, "config.yaml"), "utf-8");
        const cfg = parseYaml(raw) as Record<string, unknown>;
        const typeName = (cfg.type as string) || "novel";
        if (await hasType(typeName, projectDir)) {
            const typeDef = await loadType(typeName, projectDir);
            const allowed = getRemoveCommands(typeDef);
            if (!allowed.includes(command)) {
                console.error(
                    `\n${icon.error} ${c.red(`"wk remove ${command}" is not available for ${typeDef.name} projects.`)}`,
                );
                console.error(`  ${c.dim(`Available: ${allowed.join(", ")}`)}\n`);
                process.exit(1);
            }
        }
    } catch { /* config not readable, let other commands handle it */ }
}

// --- wk remove author ---

const removeAuthor = new Command("author")
    .description("Remove an author from config.yaml")
    .argument("<name>", "Author name")
    .action(async (name: string) => {
        const projectDir = process.cwd();
        await assertProject(projectDir);

        const configPath = join(projectDir, "config.yaml");
        const raw = await readFile(configPath, "utf-8");
        const cfg = parseYaml(raw) as Record<string, unknown>;

        const current = cfg.author;

        if (Array.isArray(current)) {
            const idx = current.findIndex(
                (a: string) => a.toLowerCase() === name.toLowerCase(),
            );
            if (idx === -1) {
                console.log(`\n${icon.warn}  ${c.yellow(`"${name}" is not in the author list.`)}\n`);
                return;
            }
            current.splice(idx, 1);
            // If only one left, collapse to string
            if (current.length === 1) {
                cfg.author = current[0];
            } else if (current.length === 0) {
                cfg.author = "";
            }
        } else if (typeof current === "string") {
            if (current.toLowerCase() !== name.toLowerCase()) {
                console.log(`\n${icon.warn}  ${c.yellow(`"${name}" is not the current author.`)}\n`);
                return;
            }
            cfg.author = "";
        }

        await writeFile(configPath, stringify(cfg));
        const remaining = Array.isArray(cfg.author)
            ? (cfg.author as string[]).join(", ")
            : (cfg.author as string) || "(none)";
        console.log(`\n${icon.done} ${c.green("Removed author:")} ${c.bold(name)}\n`);
        console.log(`  ${c.dim(`Authors: ${remaining}`)}\n`);
    });

// --- wk remove chapter ---

async function renumberChapters(dir: string): Promise<number> {
    const files = (await readdir(dir)).filter((f) => extname(f) === ".md" && !(f in SECTION_FILE_MAP)).sort();
    let renamed = 0;
    for (let i = 0; i < files.length; i++) {
        const expected = `${padNumber(i + 1)}-`;
        if (!files[i].startsWith(expected)) {
            const slug = files[i].replace(/^\d+-/, "");
            const newName = `${padNumber(i + 1)}-${slug}`;
            await rename(join(dir, files[i]), join(dir, newName));
            renamed++;
        }
    }
    return renamed;
}

async function renumberOutlineChapters(dir: string): Promise<void> {
    try {
        const files = (await readdir(dir)).filter((f) => extname(f) === ".md").sort();
        for (let i = 0; i < files.length; i++) {
            const expected = `${padNumber(i + 1)}.md`;
            if (files[i] !== expected) {
                await rename(join(dir, files[i]), join(dir, expected));
            }
        }
    } catch { /* outline/chapters may not exist */ }
}

const removeChapter = new Command("chapter")
    .description("Remove a chapter by number and renumber remaining")
    .argument("<number>", "Chapter number to remove")
    .action(async (num: string) => {
        const projectDir = process.cwd();
        await assertProject(projectDir);
        await assertRemoveCommand(projectDir, "chapter");

        const chapterNum = parseInt(num, 10);
        if (isNaN(chapterNum) || chapterNum < 1) {
            console.error(`\n${icon.error} ${c.red("Invalid chapter number.")}\n`);
            process.exit(1);
        }

        const manuscriptDir = join(projectDir, "manuscript");
        const outlineDir = join(projectDir, "outline", "chapters");
        const pad = padNumber(chapterNum);

        // Find manuscript file
        const msFiles = (await readdir(manuscriptDir)).filter((f) => f.startsWith(`${pad}-`));
        if (msFiles.length === 0) {
            console.error(`\n${icon.error} ${c.red(`Chapter ${chapterNum} not found in manuscript/`)}\n`);
            process.exit(1);
        }

        // Remove manuscript file
        for (const f of msFiles) {
            await unlink(join(manuscriptDir, f));
            console.log(`  ${c.red("deleted")} manuscript/${f}`);
        }

        // Remove outline file
        const outlineFile = join(outlineDir, `${pad}.md`);
        if (await fileExists(outlineFile)) {
            await unlink(outlineFile);
            console.log(`  ${c.red("deleted")} outline/chapters/${pad}.md`);
        }

        // Renumber
        const renamed = await renumberChapters(manuscriptDir);
        await renumberOutlineChapters(outlineDir);

        console.log(`\n${icon.done} ${c.green(`Removed chapter ${chapterNum}`)}`);
        if (renamed > 0) {
            console.log(`  ${c.dim(`Renumbered ${renamed} remaining chapter(s)`)}`);
        }
        console.log();
    });

// --- wk remove part ---

const removePart = new Command("part")
    .description("Remove a part: move its chapters to manuscript root and delete the part directory")
    .argument("<number>", "Part number to remove")
    .action(async (num: string) => {
        const projectDir = process.cwd();
        await assertProject(projectDir);
        await assertRemoveCommand(projectDir, "part");

        const partNum = parseInt(num, 10);
        if (isNaN(partNum) || partNum < 1) {
            console.error(`\n${icon.error} ${c.red("Invalid part number.")}\n`);
            process.exit(1);
        }

        const manuscriptDir = join(projectDir, "manuscript");
        const partDirName = `part-${padNumber(partNum)}`;
        const partDir = join(manuscriptDir, partDirName);

        if (!(await dirExists(partDir))) {
            console.error(`\n${icon.error} ${c.red(`Part directory manuscript/${partDirName}/ does not exist.`)}\n`);
            process.exit(1);
        }

        // Count existing root .md chapter files for renumbering
        const rootFiles = (await readdir(manuscriptDir)).filter(
            (f) => extname(f) === ".md" && /^\d+-/.test(f),
        );
        let nextNum = rootFiles.length + 1;

        // Move .md files from part dir to manuscript root
        const partEntries = await readdir(partDir);
        const partMdFiles = partEntries.filter((f) => extname(f) === ".md").sort();
        const moved: string[] = [];

        for (const file of partMdFiles) {
            const slug = file.replace(/^\d+-/, "");
            const newName = `${padNumber(nextNum)}-${slug}`;
            await rename(join(partDir, file), join(manuscriptDir, newName));
            moved.push(newName);
            nextNum++;
        }

        // Delete part.yaml and the directory
        if (await fileExists(join(partDir, "part.yaml"))) {
            await unlink(join(partDir, "part.yaml"));
        }
        await rm(partDir, { recursive: true });

        console.log(`\n${icon.done} ${c.green(`Removed part ${partNum}`)}`);
        if (moved.length > 0) {
            console.log(`  ${c.dim(`Moved ${moved.length} chapter(s) to manuscript/`)}`);
            for (const f of moved) {
                console.log(`  ${c.dim(`  → ${f}`)}`);
            }
        }
        console.log();
    });

// --- wk remove character/location/note ---

function makeFileRemoveCommand(
    commandName: string,
    dir: string,
    label: string,
): Command {
    return new Command(commandName)
        .description(`Remove a ${label}`)
        .argument("<name>", `${label} name or filename`)
        .action(async (name: string) => {
            const projectDir = process.cwd();
            await assertProject(projectDir);
            await assertRemoveCommand(projectDir, commandName);

            const targetDir = join(projectDir, dir);
            const slug = slugify(name);

            // Try exact match first, then slug match
            let target: string | null = null;
            const candidates = [`${slug}.md`, `${name}.md`, name];
            for (const candidate of candidates) {
                if (await fileExists(join(targetDir, candidate))) {
                    target = candidate;
                    break;
                }
            }

            if (!target) {
                console.error(`\n${icon.error} ${c.red(`"${name}" not found in ${dir}/`)}\n`);
                process.exit(1);
            }

            await unlink(join(targetDir, target));
            console.log(`\n${icon.done} ${c.green(`Removed ${label}:`)} ${c.bold(name)}`);
            console.log(`  ${c.red("deleted")} ${dir}/${target}\n`);
        });
}

const removeCharacter = makeFileRemoveCommand("character", "characters", "character");
const removeLocation = makeFileRemoveCommand("location", "world", "location");
const removeNote = makeFileRemoveCommand("note", "notes", "note");

// --- wk remove front/back matter sections ---

interface SectionRemoveDef {
    command: string;
    filename: string;
    displayTitle: string;
}

const SECTION_REMOVE_DEFS: SectionRemoveDef[] = [
    { command: "dedication", filename: "dedication.md", displayTitle: "Dedication" },
    { command: "epigraph", filename: "epigraph.md", displayTitle: "Epigraph" },
    { command: "preface", filename: "preface.md", displayTitle: "Preface" },
    { command: "foreword", filename: "foreword.md", displayTitle: "Foreword" },
    { command: "prologue", filename: "prologue.md", displayTitle: "Prologue" },
    { command: "epilogue", filename: "epilogue.md", displayTitle: "Epilogue" },
    { command: "afterword", filename: "afterword.md", displayTitle: "Afterword" },
    { command: "appendix", filename: "appendix.md", displayTitle: "Appendix" },
    { command: "author-note", filename: "author-note.md", displayTitle: "Author's Note" },
];

function makeSectionRemoveCommand(def: SectionRemoveDef): Command {
    return new Command(def.command)
        .description(`Remove ${def.displayTitle.toLowerCase()} from the manuscript`)
        .action(async () => {
            const projectDir = process.cwd();
            await assertProject(projectDir);
            await assertRemoveCommand(projectDir, def.command);

            const filePath = join(projectDir, "manuscript", def.filename);
            if (!(await fileExists(filePath))) {
                console.error(`\n${icon.error} ${c.red(`File not found: manuscript/${def.filename}`)}\n`);
                process.exit(1);
            }

            await unlink(filePath);
            console.log(`\n${icon.done} ${c.green(`Removed ${def.displayTitle.toLowerCase()}`)}`);
            console.log(`  ${c.red("deleted")} manuscript/${def.filename}\n`);
        });
}

const sectionRemoveCommands = SECTION_REMOVE_DEFS.map(makeSectionRemoveCommand);

// --- wk remove (parent) ---

export const removeCommand = new Command("remove")
    .description("Remove chapters, parts, characters, locations, notes, sections, or authors");

removeCommand.addCommand(removeAuthor);
removeCommand.addCommand(removeChapter);
removeCommand.addCommand(removePart);
removeCommand.addCommand(removeCharacter);
removeCommand.addCommand(removeLocation);
removeCommand.addCommand(removeNote);
for (const cmd of sectionRemoveCommands) removeCommand.addCommand(cmd);
