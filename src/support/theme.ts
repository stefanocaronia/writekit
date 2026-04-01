import { readFile, readdir, cp, writeFile } from "node:fs/promises";
import { join, dirname, extname, basename } from "node:path";
import { fileURLToPath } from "node:url";
import { parse as parseYaml } from "yaml";
import { dirExists } from "./fs-utils.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const BUILTIN_THEMES_DIR = join(__dirname, "..", "themes");

export interface DocxStyle {
    font: string;
    heading_font: string;
    accent_color: string;
    text_color: string;
    muted_color: string;
}

const DEFAULT_DOCX_STYLE: DocxStyle = {
    font: "Georgia",
    heading_font: "Georgia",
    accent_color: "8B4513",
    text_color: "2C2C2C",
    muted_color: "666666",
};

export interface FontFile {
    family: string;
    filename: string;
    data: Buffer;
    mime: string;
}

export interface Theme {
    name: string;
    htmlCss: string;
    epubCss: string;
    docx: DocxStyle;
    dir: string;
    fonts: FontFile[];
}

const FONT_EXTENSIONS: Record<string, string> = {
    ".woff2": "font/woff2",
    ".woff": "font/woff",
    ".ttf": "font/ttf",
    ".otf": "font/otf",
};

async function loadFontsFromDir(dir: string): Promise<FontFile[]> {
    if (!(await dirExists(dir))) return [];
    const files = await readdir(dir);
    const fonts: FontFile[] = [];
    for (const file of files.sort()) {
        const ext = extname(file).toLowerCase();
        const mime = FONT_EXTENSIONS[ext];
        if (!mime) continue;
        const data = await readFile(join(dir, file));
        const family = basename(file, ext);
        fonts.push({ family, filename: file, data, mime });
    }
    return fonts;
}

export function fontFaceCss(fonts: FontFile[], pathPrefix = ""): string {
    return fonts.map((f) => {
        const src = pathPrefix
            ? `url(${pathPrefix}${f.filename})`
            : `url(data:${f.mime};base64,${f.data.toString("base64")})`;
        return `@font-face { font-family: "${f.family}"; src: ${src}; }`;
    }).join("\n");
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
    const [htmlCss, epubCss, yamlRaw, fonts] = await Promise.all([
        readFile(join(themeDir, "html.css"), "utf-8"),
        readFile(join(themeDir, "epub.css"), "utf-8"),
        readFile(join(themeDir, "theme.yaml"), "utf-8").catch(() => ""),
        loadFontsFromDir(join(themeDir, "fonts")),
    ]);

    let docx = { ...DEFAULT_DOCX_STYLE };
    if (yamlRaw) {
        const data = parseYaml(yamlRaw) as Record<string, unknown>;
        if (data.docx && typeof data.docx === "object") {
            docx = { ...DEFAULT_DOCX_STYLE, ...(data.docx as Partial<DocxStyle>) };
        }
    }

    return { name, htmlCss, epubCss, docx, dir: themeDir, fonts };
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
    let theme: Theme;

    // Try local themes first (project's themes/ folder)
    if (projectDir) {
        const localDir = join(localThemesDir(projectDir), themeName);
        if (await dirExists(localDir)) {
            try {
                theme = await loadThemeFrom(localDir, themeName);
                // Also collect project-level fonts
                const projectFonts = await loadFontsFromDir(join(projectDir, "assets", "fonts"));
                theme.fonts = [...theme.fonts, ...projectFonts];
                return theme;
            } catch {
                // fall through to builtin
            }
        }
    }

    // Try builtin themes
    const builtinDir = join(BUILTIN_THEMES_DIR, themeName);
    try {
        theme = await loadThemeFrom(builtinDir, themeName);
    } catch {
        if (themeName !== "default") {
            console.error(`Theme "${themeName}" not found, falling back to default`);
            return loadTheme("default", projectDir);
        }
        throw new Error(`Default theme not found at ${builtinDir}`);
    }

    // Also collect project-level fonts
    if (projectDir) {
        const projectFonts = await loadFontsFromDir(join(projectDir, "assets", "fonts"));
        theme.fonts = [...theme.fonts, ...projectFonts];
    }

    return theme;
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
