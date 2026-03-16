import { stat } from "node:fs/promises";
import { join } from "node:path";
import { stringify } from "yaml";
import { c, icon } from "./ui.js";

export async function fileExists(path: string): Promise<boolean> {
    try {
        const s = await stat(path);
        return s.isFile();
    } catch {
        return false;
    }
}

export async function dirExists(path: string): Promise<boolean> {
    try {
        const s = await stat(path);
        return s.isDirectory();
    } catch {
        return false;
    }
}

export function assertProject(projectDir: string): Promise<void> {
    return fileExists(join(projectDir, "config.yaml")).then((exists) => {
        if (!exists) {
            console.error(
                `\n${icon.error} ${c.red("No config.yaml found. Are you inside a writekit project?")}\n`,
            );
            process.exit(1);
        }
    });
}

export function frontmatter(data: Record<string, unknown>, body: string): string {
    return `---\n${stringify(data).trimEnd()}\n---\n\n${body}`;
}

export function bookFilename(title: string, author: string, ext: string): string {
    const parts = [title];
    if (author) parts.push(author);
    const name = parts.join(" - ").replace(/[<>:"/\\|?*]/g, "");
    return `${name}.${ext}`;
}
