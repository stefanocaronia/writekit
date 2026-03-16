import { Command } from "commander";
import { readFile, writeFile, readdir, unlink, rename } from "node:fs/promises";
import { join, extname } from "node:path";
import { stringify, parse as parseYaml } from "yaml";
import { assertProject, fileExists } from "../lib/fs-utils.js";
import { slugify, padNumber } from "../lib/slug.js";
import { loadType, isValidType } from "../lib/project-type.js";
import { c, icon } from "../lib/ui.js";

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
    const files = (await readdir(dir)).filter((f) => extname(f) === ".md").sort();
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

            // Check type allows this
            try {
                const raw = await readFile(join(projectDir, "config.yaml"), "utf-8");
                const cfg = parseYaml(raw) as Record<string, unknown>;
                const typeName = (cfg.type as string) || "novel";
                if (isValidType(typeName)) {
                    const typeDef = await loadType(typeName);
                    if (!typeDef.dirs.includes(dir)) {
                        console.error(`\n${icon.error} ${c.red(`"${dir}/" is not available for ${typeDef.name} projects.`)}\n`);
                        process.exit(1);
                    }
                }
            } catch { /* let it proceed */ }

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

// --- wk remove (parent) ---

export const removeCommand = new Command("remove")
    .description("Remove chapters, characters, locations, notes, or authors");

removeCommand.addCommand(removeAuthor);
removeCommand.addCommand(removeChapter);
removeCommand.addCommand(removeCharacter);
removeCommand.addCommand(removeLocation);
removeCommand.addCommand(removeNote);
