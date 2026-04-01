import { Command } from "commander";
import { readdir, readFile, writeFile, rename } from "node:fs/promises";
import { join, extname } from "node:path";
import { parse as parseYaml, stringify } from "yaml";
import { assertProject } from "../support/fs-utils.js";
import { SECTION_FILE_MAP, loadConfig } from "../project/parse.js";
import { padNumber } from "../support/slug.js";
import { ensureAgentsMd } from "../project/agents.js";
import { generateDocs } from "../project/docs.js";
import { generateReports } from "../project/reports.js";
import { hasType, loadType } from "../project/project-type.js";
import { loadTypePlugin, typeOptions as resolveTypeOptions } from "../project/type-plugin.js";
import { c, icon } from "../support/ui.js";
import { fileExists, dirExists } from "../support/fs-utils.js";
import { parseFrontmatter } from "../project/parse.js";
import { loadNormalizationConfig, normalizeText } from "../support/text-normalize.js";

const CONTRIBUTOR_ROLES = ["author", "translator", "editor", "illustrator"] as const;

interface ContributorFrontmatter {
    name: string;
    roles: string[];
    [key: string]: unknown;
}

function parseContributorFrontmatter(content: string): { fm: ContributorFrontmatter; body: string } | null {
    const match = content.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
    if (!match) return null;
    const fm = parseYaml(match[1]) as ContributorFrontmatter;
    return { fm, body: match[2] };
}

async function syncContributorRoles(projectDir: string): Promise<number> {
    const configPath = join(projectDir, "config.yaml");
    const raw = await readFile(configPath, "utf-8");
    const cfg = parseYaml(raw) as Record<string, unknown>;

    // Build role map: name -> roles[] from config
    const roleMap = new Map<string, Set<string>>();

    for (const role of CONTRIBUTOR_ROLES) {
        const value = cfg[role];
        const names: string[] = Array.isArray(value)
            ? value
            : typeof value === "string" && value
                ? [value]
                : [];

        for (const name of names) {
            if (!roleMap.has(name)) roleMap.set(name, new Set());
            roleMap.get(name)!.add(role);
        }
    }

    // Update contributor sheets
    const contribDir = join(projectDir, "contributors");
    let updated = 0;

    try {
        const files = await readdir(contribDir);
        for (const file of files) {
            if (extname(file) !== ".md") continue;
            const filePath = join(contribDir, file);
            const content = await readFile(filePath, "utf-8");
            const parsed = parseContributorFrontmatter(content);
            if (!parsed) continue;

            const { fm, body } = parsed;
            const name = fm.name;
            const newRoles = roleMap.has(name)
                ? [...roleMap.get(name)!].sort()
                : [];

            const currentRoles = Array.isArray(fm.roles)
                ? [...fm.roles].sort()
                : [];

            if (JSON.stringify(newRoles) !== JSON.stringify(currentRoles)) {
                fm.roles = newRoles;
                const newContent = `---\n${stringify(fm).trim()}\n---\n${body}`;
                await writeFile(filePath, newContent);
                updated++;
            }
        }
    } catch {
        // contributors/ doesn't exist yet, skip
    }

    return updated;
}

async function syncChapterNumbering(projectDir: string): Promise<number> {
    let renamed = 0;

    // Manuscript (skip front/back matter section files)
    const msDir = join(projectDir, "manuscript");
    try {
        const files = (await readdir(msDir)).filter((f) => extname(f) === ".md" && !(f in SECTION_FILE_MAP)).sort();
        for (let i = 0; i < files.length; i++) {
            const expected = `${padNumber(i + 1)}-`;
            if (!files[i].startsWith(expected)) {
                const slug = files[i].replace(/^\d+-/, "");
                const newName = `${padNumber(i + 1)}-${slug}`;
                await rename(join(msDir, files[i]), join(msDir, newName));
                renamed++;
            }
        }
    } catch { /* manuscript may not exist */ }

    // Outline chapters
    const outDir = join(projectDir, "outline", "chapters");
    try {
        const files = (await readdir(outDir)).filter((f) => extname(f) === ".md").sort();
        for (let i = 0; i < files.length; i++) {
            const expected = `${padNumber(i + 1)}.md`;
            if (files[i] !== expected) {
                await rename(join(outDir, files[i]), join(outDir, expected));
                renamed++;
            }
        }
    } catch { /* outline/chapters may not exist */ }

    return renamed;
}

async function normalizeManuscript(msDir: string, normConfig: import("../support/text-normalize.js").NormalizationConfig): Promise<number> {
    let count = 0;
    const entries = await readdir(msDir, { withFileTypes: true });
    for (const entry of entries) {
        const fullPath = join(msDir, entry.name);
        if (entry.isDirectory()) {
            count += await normalizeManuscript(fullPath, normConfig);
        } else if (extname(entry.name) === ".md") {
            const content = await readFile(fullPath, "utf-8");
            const { data, body } = parseFrontmatter(content);
            const normalizedBody = normalizeText(body, normConfig);
            if (normalizedBody !== body) {
                // Rebuild file with original frontmatter + normalized body
                const { frontmatter: fmFormat } = await import("../support/fs-utils.js");
                if (Object.keys(data).length > 0) {
                    await writeFile(fullPath, fmFormat(data, normalizedBody));
                } else {
                    await writeFile(fullPath, normalizedBody);
                }
                count++;
            }
        }
    }
    return count;
}

export async function syncProject(projectDir: string): Promise<{ roles: number; chapters: number; agents: boolean; reports: string[]; normalized: number }> {
    const roles = await syncContributorRoles(projectDir);
    const chapters = await syncChapterNumbering(projectDir);
    const config = await loadConfig(projectDir);
    const typeName = config.type || "novel";
    const typeDef = await hasType(typeName, projectDir) ? await loadType(typeName, projectDir) : undefined;
    const typePlugin = typeDef ? await loadTypePlugin(typeName, projectDir) : null;

    if (typeDef && typePlugin?.onSync) {
        await typePlugin.onSync({
            projectDir,
            typeName,
            typeDef,
            config,
            typeOptions: resolveTypeOptions(config),
        });
    }

    // Text normalization (dialogue style, smart quotes, ellipsis, dashes)
    let normalized = 0;
    if (typeDef?.files.includes("style.yaml") && await fileExists(join(projectDir, "style.yaml"))) {
        try {
            const styleRaw = await readFile(join(projectDir, "style.yaml"), "utf-8");
            const styleData = parseYaml(styleRaw) as Record<string, unknown>;
            const normConfig = loadNormalizationConfig(styleData);
            if (normConfig.dialogue_style || normConfig.smart_quotes || normConfig.normalize_ellipsis || normConfig.normalize_dashes) {
                const msDir = join(projectDir, "manuscript");
                if (await dirExists(msDir)) {
                    normalized = await normalizeManuscript(msDir, normConfig);
                }
            }
        } catch {
            // style.yaml parse errors are non-fatal for sync
        }
    }

    await ensureAgentsMd(projectDir, typeName);
    if (typeDef) await generateDocs(projectDir, typeDef);
    const reports = await generateReports(projectDir);

    return { roles, chapters, agents: true, reports, normalized };
}

export const syncCommand = new Command("sync")
    .description("Synchronize derived fields — contributor roles, agents, reports")
    .action(async () => {
        const projectDir = process.cwd();
        await assertProject(projectDir);

        console.log(`\n${icon.build} ${c.bold("Syncing project...")}\n`);

        const result = await syncProject(projectDir);

        if (result.roles > 0) {
            console.log(`  ${c.green("✓")} Updated ${result.roles} contributor role(s)`);
        } else {
            console.log(`  ${c.dim("✓ Contributor roles up to date")}`);
        }
        if (result.chapters > 0) {
            console.log(`  ${c.green("✓")} Renumbered ${result.chapters} chapter file(s)`);
        } else {
            console.log(`  ${c.dim("✓ Chapter numbering up to date")}`);
        }
        if (result.normalized > 0) {
            console.log(`  ${c.green("✓")} Normalized text in ${result.normalized} file(s)`);
        }
        console.log(`  ${c.dim("✓ AGENTS.md refreshed")}`);
        console.log(`  ${c.dim(`✓ Reports: ${result.reports.join(", ")}`)}`);
        console.log(`\n${icon.done} ${c.green("Done!")}\n`);
    });
