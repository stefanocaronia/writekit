import { readFile } from "node:fs/promises";
import { join } from "node:path";
import JSZip from "jszip";
import { fileExists } from "./fs-utils.js";

/**
 * Resolve the DOCX template path.
 * Priority: assets/template.docx > theme template > null
 */
export async function resolveTemplatePath(
    projectDir: string,
    themeDir?: string,
): Promise<string | null> {
    // User template in assets/
    const userTemplate = join(projectDir, "assets", "template.docx");
    if (await fileExists(userTemplate)) return userTemplate;

    // Theme template
    if (themeDir) {
        const themeTemplate = join(themeDir, "template.docx");
        if (await fileExists(themeTemplate)) return themeTemplate;
    }

    return null;
}

/**
 * Extract word/styles.xml from a .docx file.
 * Returns the XML string or null if not found.
 */
export async function extractStylesXml(templatePath: string): Promise<string | null> {
    try {
        const data = await readFile(templatePath);
        const zip = await JSZip.loadAsync(data);
        const stylesFile = zip.file("word/styles.xml");
        if (!stylesFile) return null;
        return await stylesFile.async("string");
    } catch {
        return null;
    }
}
