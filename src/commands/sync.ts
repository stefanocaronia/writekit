import { Command } from "commander";
import { readdir, readFile, writeFile } from "node:fs/promises";
import { join, extname } from "node:path";
import { parse as parseYaml, stringify } from "yaml";
import { assertProject } from "../lib/fs-utils.js";
import { ensureAgentsMd } from "../lib/agents.js";
import { generateReports } from "../lib/reports.js";
import { c, icon } from "../lib/ui.js";

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

export async function syncProject(projectDir: string): Promise<{ roles: number; agents: boolean; reports: string[] }> {
    const roles = await syncContributorRoles(projectDir);
    await ensureAgentsMd(projectDir);
    const reports = await generateReports(projectDir);

    return { roles, agents: true, reports };
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
        console.log(`  ${c.dim("✓ AGENTS.md refreshed")}`);
        console.log(`  ${c.dim(`✓ Reports: ${result.reports.join(", ")}`)}`);
        console.log(`\n${icon.done} ${c.green("Done!")}\n`);
    });
