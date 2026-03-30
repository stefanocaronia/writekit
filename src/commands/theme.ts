import { Command } from "commander";
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { parse as parseYaml, stringify } from "yaml";
import { listThemes, createTheme } from "../support/theme.js";
import { assertProject } from "../support/fs-utils.js";
import { c, icon } from "../support/ui.js";

async function getActiveTheme(projectDir: string): Promise<string> {
    const raw = await readFile(join(projectDir, "config.yaml"), "utf-8");
    const config = parseYaml(raw) as Record<string, unknown>;
    return (config.theme as string) || "default";
}

async function setActiveTheme(
    projectDir: string,
    themeName: string,
): Promise<void> {
    const configPath = join(projectDir, "config.yaml");
    const raw = await readFile(configPath, "utf-8");
    const config = parseYaml(raw) as Record<string, unknown>;
    config.theme = themeName;
    await writeFile(configPath, stringify(config), "utf-8");
}

// --- wktheme list ---

const themeList = new Command("list")
    .description("List available themes")
    .action(async () => {
        const projectDir = process.cwd();
        await assertProject(projectDir);

        const active = await getActiveTheme(projectDir);
        const themes = await listThemes(projectDir);

        console.log(`\n${icon.book} ${c.bold("Available themes:")}\n`);

        for (const t of themes) {
            const isActive = t.name.toLowerCase() === active.toLowerCase();
            const marker = isActive ? c.green(" ● active") : "";
            const loc = t.location === "local" ? c.cyan(" (local)") : c.dim(" (builtin)");
            console.log(`  ${c.bold(t.name)}${loc}${marker}`);
            if (t.description) {
                console.log(`  ${c.dim(t.description)}`);
            }
            console.log();
        }

        if (themes.length === 0) {
            console.log(`  ${c.dim("No themes found.")}\n`);
        }
    });

// --- wktheme use ---

const themeUse = new Command("use")
    .description("Set the active theme")
    .argument("<name>", "Theme name")
    .action(async (name: string) => {
        const projectDir = process.cwd();
        await assertProject(projectDir);

        // Verify theme exists
        const themes = await listThemes(projectDir);
        const found = themes.find(
            (t) => t.name.toLowerCase() === name.toLowerCase(),
        );

        if (!found) {
            console.error(
                `\n${icon.error} ${c.red(`Theme "${name}" not found.`)} Run ${c.cyan("wk theme list")} to see available themes.\n`,
            );
            process.exit(1);
        }

        await setActiveTheme(projectDir, name);
        console.log(`\n${icon.done} ${c.green("Theme set to")} ${c.bold(name)}\n`);
    });

// --- wktheme create ---

const themeCreate = new Command("create")
    .description("Create a new custom theme based on default")
    .argument("<name>", "Theme name")
    .action(async (name: string) => {
        const projectDir = process.cwd();
        await assertProject(projectDir);

        try {
            await createTheme(projectDir, name);
            console.log(
                `\n${icon.done} ${c.green("Created theme")} ${c.bold(name)}\n`,
            );
            console.log(`  ${c.dim(`themes/${name}/`)}`);
            console.log(`  ${c.dim(`├── theme.yaml`)}`);
            console.log(`  ${c.dim(`├── html.css`)}`);
            console.log(`  ${c.dim(`└── epub.css`)}\n`);
            console.log(
                `  Edit the CSS files, then run ${c.cyan(`wk theme use ${name}`)}\n`,
            );
        } catch (e) {
            console.error(
                `\n${icon.error} ${c.red((e as Error).message)}\n`,
            );
            process.exit(1);
        }
    });

// --- wktheme (parent) ---

export const themeCommand = new Command("theme")
    .description("Manage themes");

themeCommand.addCommand(themeList);
themeCommand.addCommand(themeUse);
themeCommand.addCommand(themeCreate);
