import { readFile } from "node:fs/promises";
import { join, extname, isAbsolute } from "node:path";
import { existsSync } from "node:fs";

const MIME_MAP: Record<string, string> = {
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
    ".gif": "image/gif",
    ".webp": "image/webp",
    ".svg": "image/svg+xml",
};

function isRemoteUrl(src: string): boolean {
    return src.startsWith("http://") || src.startsWith("https://") || src.startsWith("data:");
}

function resolveImagePath(src: string, projectDir: string): string | null {
    if (isRemoteUrl(src)) return null;
    const abs = isAbsolute(src) ? src : join(projectDir, src);
    return existsSync(abs) ? abs : null;
}

/**
 * Replace local image paths in markdown with base64 data URIs.
 * Used for HTML and PDF builds (single-file output).
 */
export async function embedImagesAsBase64(markdown: string, projectDir: string): Promise<string> {
    const imageRegex = /!\[([^\]]*)\]\(([^)]+)\)/g;
    let result = markdown;
    const matches = [...markdown.matchAll(imageRegex)];

    for (const match of matches) {
        const [full, alt, src] = match;
        const absPath = resolveImagePath(src, projectDir);
        if (!absPath) continue;

        const ext = extname(absPath).toLowerCase();
        const mime = MIME_MAP[ext];
        if (!mime) continue;

        try {
            const data = await readFile(absPath);
            const base64 = data.toString("base64");
            const dataUri = `data:${mime};base64,${base64}`;
            result = result.replace(full, `![${alt}](${dataUri})`);
        } catch { /* skip unreadable images */ }
    }

    return result;
}

/**
 * Collect all local image paths referenced in markdown.
 * Used for ePub (add images to zip) and DOCX.
 */
export function collectImagePaths(markdown: string, projectDir: string): { src: string; absPath: string; filename: string }[] {
    const imageRegex = /!\[([^\]]*)\]\(([^)]+)\)/g;
    const images: { src: string; absPath: string; filename: string }[] = [];
    const seen = new Set<string>();

    for (const match of markdown.matchAll(imageRegex)) {
        const src = match[2];
        if (seen.has(src)) continue;
        seen.add(src);

        const absPath = resolveImagePath(src, projectDir);
        if (!absPath) continue;

        const ext = extname(absPath).toLowerCase();
        if (!MIME_MAP[ext]) continue;

        // Use a clean filename for the epub/docx
        const filename = `img-${seen.size}${ext}`;
        images.push({ src, absPath, filename });
    }

    return images;
}

/**
 * Replace local image paths with new paths (e.g. for ePub internal references).
 */
export function rewriteImagePaths(markdown: string, mapping: Map<string, string>): string {
    let result = markdown;
    for (const [oldSrc, newSrc] of mapping) {
        result = result.replaceAll(`](${oldSrc})`, `](${newSrc})`);
    }
    return result;
}
