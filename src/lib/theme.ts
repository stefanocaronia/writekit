import { readFile, readdir, cp, writeFile } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { parse as parseYaml } from "yaml";
import { dirExists } from "./fs-utils.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const BUILTIN_THEMES_DIR = join(__dirname, "..", "themes");

export interface Theme {
    name: string;
    htmlCss: string;
    epubCss: string;
}

export interface ThemeInfo {
    name: string;
    description: string;
    author: string;
    location: "builtin" | "local";
}

function localThemesDir(projectDir: string): string {
    return join(projectDir, "themes");
}

async function loadThemeFrom(themeDir: string, name: string): Promise<Theme> {
    const [htmlCss, epubCss] = await Promise.all([
        readFile(join(themeDir, "html.css"), "utf-8"),
        readFile(join(themeDir, "epub.css"), "utf-8"),
    ]);
    return { name, htmlCss, epubCss };
}

async function readThemeInfo(
    themeDir: string,
    name: string,
    location: "builtin" | "local",
): Promise<ThemeInfo> {
    try {
        const raw = await readFile(join(themeDir, "theme.yaml"), "utf-8");
        const data = parseYaml(raw) as Record<string, string>;
        return {
            name: data.name || name,
            description: data.description || "",
            author: data.author || "",
            location,
        };
    } catch {
        return { name, description: "", author: "", location };
    }
}

export async function loadTheme(
    themeName = "default",
    projectDir?: string,
): Promise<Theme> {
    // Try local themes first (project's themes/ folder)
    if (projectDir) {
        const localDir = join(localThemesDir(projectDir), themeName);
        if (await dirExists(localDir)) {
            try {
                return await loadThemeFrom(localDir, themeName);
            } catch {
                // fall through to builtin
            }
        }
    }

    // Try builtin themes
    const builtinDir = join(BUILTIN_THEMES_DIR, themeName);
    try {
        return await loadThemeFrom(builtinDir, themeName);
    } catch {
        if (themeName !== "default") {
            console.error(`Theme "${themeName}" not found, falling back to default`);
            return loadTheme("default", projectDir);
        }
        throw new Error(`Default theme not found at ${builtinDir}`);
    }
}

export async function listThemes(projectDir: string): Promise<ThemeInfo[]> {
    const themes: ThemeInfo[] = [];

    // Builtin themes
    try {
        const entries = await readdir(BUILTIN_THEMES_DIR);
        for (const entry of entries) {
            const dir = join(BUILTIN_THEMES_DIR, entry);
            if (await dirExists(dir)) {
                themes.push(await readThemeInfo(dir, entry, "builtin"));
            }
        }
    } catch {
        // no builtin themes dir
    }

    // Local themes
    const localDir = localThemesDir(projectDir);
    try {
        const entries = await readdir(localDir);
        for (const entry of entries) {
            const dir = join(localDir, entry);
            if (await dirExists(dir)) {
                themes.push(await readThemeInfo(dir, entry, "local"));
            }
        }
    } catch {
        // no local themes dir
    }

    return themes;
}

export async function createTheme(
    projectDir: string,
    name: string,
): Promise<string> {
    const targetDir = join(localThemesDir(projectDir), name);

    if (await dirExists(targetDir)) {
        throw new Error(`Theme "${name}" already exists at themes/${name}/`);
    }

    // Copy default theme as starting point
    const sourceDir = join(BUILTIN_THEMES_DIR, "default");
    await cp(sourceDir, targetDir, { recursive: true });

    // Update theme.yaml with new name
    const themeYamlPath = join(targetDir, "theme.yaml");
    const raw = await readFile(themeYamlPath, "utf-8");
    await writeFile(
        themeYamlPath,
        raw.replace(/^name:.*$/m, `name: ${name}`),
    );

    return targetDir;
}
