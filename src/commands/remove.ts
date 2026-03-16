import { Command } from "commander";
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { stringify, parse as parseYaml } from "yaml";
import { assertProject } from "../lib/fs-utils.js";
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

// --- wk remove (parent) ---

export const removeCommand = new Command("remove")
    .description("Remove authors or other entries");

removeCommand.addCommand(removeAuthor);
