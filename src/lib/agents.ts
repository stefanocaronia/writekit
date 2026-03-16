import { readFile, writeFile } from "node:fs/promises";
import { fileExists } from "./fs-utils.js";

const START_TAG = "<!-- writekit:start — DO NOT REMOVE THIS SECTION -->";
const END_TAG = "<!-- writekit:end -->";

const WRITEKIT_SECTION = `${START_TAG}
Read \`node_modules/writekit/agents/instructions.md\` before working on this project.
${END_TAG}`;

const DEFAULT_AGENTS_MD = `${WRITEKIT_SECTION}

## Your instructions

Add project-specific instructions for your AI assistant here.
`;

export async function ensureAgentsMd(projectDir: string): Promise<void> {
    const agentsPath = `${projectDir}/AGENTS.md`;

    if (!(await fileExists(agentsPath))) {
        await writeFile(agentsPath, DEFAULT_AGENTS_MD);
        return;
    }

    const content = await readFile(agentsPath, "utf-8");

    // Check if writekit section exists
    if (content.includes(START_TAG) && content.includes(END_TAG)) {
        // Replace existing section
        const before = content.slice(0, content.indexOf(START_TAG));
        const after = content.slice(content.indexOf(END_TAG) + END_TAG.length);
        await writeFile(agentsPath, before + WRITEKIT_SECTION + after);
    } else {
        // Prepend section
        await writeFile(agentsPath, WRITEKIT_SECTION + "\n\n" + content);
    }
}
