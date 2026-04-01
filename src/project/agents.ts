import { readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { fileExists } from "../support/fs-utils.js";

const START_TAG = "<!-- writekit:start — DO NOT REMOVE THIS SECTION -->";
const END_TAG = "<!-- writekit:end -->";

/**
 * Resolve the absolute path to the writekit package's agents directory.
 * Works whether writekit is installed globally, locally, or via npm link.
 */
function resolveAgentsDir(): string {
    // __dirname is dist/project/ — agents are at dist/agents/
    const __dirname = dirname(fileURLToPath(import.meta.url));
    return join(__dirname, "..", "agents");
}

function buildWritekitSection(agentsDir: string, typeName?: string): string {
    const lines = [START_TAG];
    lines.push(`Read \`${agentsDir}/instructions.md\` before working on this project.`);
    if (typeName) {
        const typeFile = `${agentsDir}/types/${typeName}.md`;
        lines.push(`Read \`${typeFile}\` for type-specific rules.`);
    }
    lines.push("");
    lines.push("Also read `docs/writekit.md` for the full command and configuration reference.");
    lines.push(END_TAG);
    return lines.join("\n");
}

const DEFAULT_USER_SECTION = `

## Your instructions

Add project-specific instructions for your AI assistant here.
`;

export async function ensureAgentsMd(projectDir: string, typeName?: string): Promise<void> {
    const agentsDir = resolveAgentsDir().replace(/\\/g, "/");
    const section = buildWritekitSection(agentsDir, typeName);
    const agentsPath = join(projectDir, "AGENTS.md");

    if (!(await fileExists(agentsPath))) {
        await writeFile(agentsPath, section + DEFAULT_USER_SECTION);
        return;
    }

    const content = await readFile(agentsPath, "utf-8");

    if (content.includes(START_TAG) && content.includes(END_TAG)) {
        // Replace existing section, preserve user content
        const before = content.slice(0, content.indexOf(START_TAG));
        const after = content.slice(content.indexOf(END_TAG) + END_TAG.length);
        await writeFile(agentsPath, before + section + after);
    } else {
        // Prepend section
        await writeFile(agentsPath, section + "\n\n" + content);
    }
}
