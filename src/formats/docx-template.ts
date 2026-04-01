import { readFile } from "node:fs/promises";
import { join } from "node:path";
import JSZip from "jszip";
import { fileExists } from "../support/fs-utils.js";

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

/**
 * Apply a DOCX template: take the generated .docx buffer and merge it with
 * the template's styles, fonts, numbering, and settings.
 *
 * Strategy: open both the generated docx and the template as zip archives.
 * Copy word/document.xml and word/media/* from the generated docx into
 * the template, keeping the template's word/styles.xml, word/fonts/*,
 * word/numbering.xml, word/settings.xml, and [Content_Types].xml.
 */
export async function applyTemplate(
    generatedBuffer: Buffer,
    templatePath: string,
): Promise<Buffer> {
    const [templateData, generatedZip] = await Promise.all([
        readFile(templatePath),
        JSZip.loadAsync(generatedBuffer),
    ]);
    const templateZip = await JSZip.loadAsync(templateData);

    // Copy document.xml from generated into template
    const docXml = generatedZip.file("word/document.xml");
    if (docXml) {
        templateZip.file("word/document.xml", await docXml.async("nodebuffer"));
    }

    // Copy all media (images) from generated into template
    const mediaFiles = Object.keys(generatedZip.files).filter((f) => f.startsWith("word/media/"));
    for (const path of mediaFiles) {
        const file = generatedZip.file(path);
        if (file) {
            templateZip.file(path, await file.async("nodebuffer"));
        }
    }

    // Copy word/_rels/document.xml.rels from generated (has image/header/footer references)
    const docRels = generatedZip.file("word/_rels/document.xml.rels");
    if (docRels) {
        templateZip.file("word/_rels/document.xml.rels", await docRels.async("nodebuffer"));
    }

    // Copy header/footer XML files from generated
    const headerFooterFiles = Object.keys(generatedZip.files).filter(
        (f) => f.startsWith("word/header") || f.startsWith("word/footer"),
    );
    for (const path of headerFooterFiles) {
        const file = generatedZip.file(path);
        if (file) {
            templateZip.file(path, await file.async("nodebuffer"));
        }
    }

    // Merge [Content_Types].xml — add any content types from generated that template doesn't have
    const genCT = generatedZip.file("[Content_Types].xml");
    const tmplCT = templateZip.file("[Content_Types].xml");
    if (genCT && tmplCT) {
        const genXml = await genCT.async("string");
        const tmplXml = await tmplCT.async("string");

        // Extract Override entries from generated that aren't in template
        const genOverrides = [...genXml.matchAll(/<Override[^>]+\/>/g)].map((m) => m[0]);
        const tmplOverrides = new Set([...tmplXml.matchAll(/<Override[^>]+\/>/g)].map((m) => m[0]));

        const newOverrides = genOverrides.filter((o) => !tmplOverrides.has(o));
        if (newOverrides.length > 0) {
            const merged = tmplXml.replace(
                "</Types>",
                newOverrides.join("\n") + "\n</Types>",
            );
            templateZip.file("[Content_Types].xml", merged);
        }
    }

    return templateZip.generateAsync({ type: "nodebuffer" }) as Promise<Buffer>;
}
