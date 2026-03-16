import { Command } from "commander";
import { readFile, writeFile, readdir, rename as renameFile } from "node:fs/promises";
import { join, extname } from "node:path";
import { parse as parseYaml, stringify } from "yaml";
import { assertProject, fileExists } from "../lib/fs-utils.js";
import { slugify } from "../lib/slug.js";
import { loadType, isValidType } from "../lib/project-type.js";
import { c, icon } from "../lib/ui.js";

async function replaceInMdFiles(dir: string, oldName: string, newName: string): Promise<number> {
    let count = 0;
    try {
        const files = await readdir(dir);
        for (const file of files) {
            if (extname(file) !== ".md") continue;
            const filePath = join(dir, file);
            const content = await readFile(filePath, "utf-8");
            if (content.includes(oldName)) {
                await writeFile(filePath, content.replaceAll(oldName, newName));
                count++;
            }
        }
    } catch { /* dir may not exist */ }
    return count;
}

async function replaceInMdFilesRecursive(baseDir: string, oldName: string, newName: string): Promise<number> {
    let total = 0;
    total += await replaceInMdFiles(baseDir, oldName, newName);
    // Check one level of subdirs (e.g. outline/chapters)
    try {
        const entries = await readdir(baseDir, { withFileTypes: true });
        for (const entry of entries) {
            if (entry.isDirectory()) {
                total += await replaceInMdFiles(join(baseDir, entry.name), oldName, newName);
            }
        }
    } catch { /* */ }
    return total;
}

async function assertRenameCommand(projectDir: string, dir: string): Promise<void> {
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
    } catch { /* */ }
}

async function renameEntity(
    projectDir: string,
    dir: string,
    label: string,
    nameField: string,
    oldName: string,
    newName: string,
): Promise<void> {
    await assertProject(projectDir);
    await assertRenameCommand(projectDir, dir);

    const targetDir = join(projectDir, dir);
    const oldSlug = slugify(oldName);
    const newSlug = slugify(newName);
    const oldFile = join(targetDir, `${oldSlug}.md`);
    const newFile = join(targetDir, `${newSlug}.md`);

    if (!(await fileExists(oldFile))) {
        console.error(`\n${icon.error} ${c.red(`"${oldName}" not found in ${dir}/`)}\n`);
        process.exit(1);
    }

    if (await fileExists(newFile)) {
        console.error(`\n${icon.error} ${c.red(`"${newName}" already exists in ${dir}/`)}\n`);
        process.exit(1);
    }

    // Update frontmatter
    const content = await readFile(oldFile, "utf-8");
    const fmMatch = content.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
    if (fmMatch) {
        const fm = parseYaml(fmMatch[1]) as Record<string, unknown>;
        fm[nameField] = newName;
        // Update aliases if they contain old name
        if (Array.isArray(fm.aliases)) {
            fm.aliases = fm.aliases.map((a: string) =>
                a.toLowerCase() === oldName.toLowerCase() ? newName : a,
            );
        }
        const updated = `---\n${stringify(fm).trim()}\n---\n${fmMatch[2]}`;
        await writeFile(oldFile, updated);
    }

    // Rename file
    await renameFile(oldFile, newFile);

    // Replace in manuscript and outline
    let replaced = 0;
    replaced += await replaceInMdFilesRecursive(join(projectDir, "manuscript"), oldName, newName);
    replaced += await replaceInMdFilesRecursive(join(projectDir, "outline"), oldName, newName);

    console.log(`\n${icon.done} ${c.green(`Renamed ${label}:`)} ${c.bold(oldName)} → ${c.bold(newName)}`);
    console.log(`  ${c.dim(`${dir}/${oldSlug}.md → ${dir}/${newSlug}.md`)}`);
    if (replaced > 0) {
        console.log(`  ${c.dim(`Updated ${replaced} file(s) in manuscript/outline`)}`);
    }
    console.log();
}

const renameCharacter = new Command("character")
    .description("Rename a character — updates file, frontmatter, and all references")
    .argument("<old-name>", "Current character name")
    .argument("<new-name>", "New character name")
    .action(async (oldName: string, newName: string) => {
        await renameEntity(process.cwd(), "characters", "character", "name", oldName, newName);
    });

const renameLocation = new Command("location")
    .description("Rename a location — updates file, frontmatter, and all references")
    .argument("<old-name>", "Current location name")
    .argument("<new-name>", "New location name")
    .action(async (oldName: string, newName: string) => {
        await renameEntity(process.cwd(), "world", "location", "name", oldName, newName);
    });

const renameConcept = new Command("concept")
    .description("Rename a concept — updates file, frontmatter, and all references")
    .argument("<old-term>", "Current term")
    .argument("<new-term>", "New term")
    .action(async (oldTerm: string, newTerm: string) => {
        await renameEntity(process.cwd(), "concepts", "concept", "term", oldTerm, newTerm);
    });

export const renameCommand = new Command("rename")
    .description("Rename characters, locations, or concepts");

renameCommand.addCommand(renameCharacter);
renameCommand.addCommand(renameLocation);
renameCommand.addCommand(renameConcept);
