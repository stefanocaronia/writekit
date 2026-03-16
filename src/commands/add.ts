import { Command } from "commander";
import { readdir, readFile, writeFile, mkdir } from "node:fs/promises";
import { join, extname } from "node:path";
import { stringify, parse as parseYaml } from "yaml";
import { slugify, padNumber } from "../lib/slug.js";
import { fileExists, assertProject, frontmatter } from "../lib/fs-utils.js";
import { loadType, isValidType } from "../lib/project-type.js";
import { c, icon } from "../lib/ui.js";

async function ensureDir(dir: string): Promise<void> {
    await mkdir(dir, { recursive: true });
}

async function assertAddCommand(projectDir: string, command: string): Promise<void> {
    try {
        const raw = await readFile(join(projectDir, "config.yaml"), "utf-8");
        const cfg = parseYaml(raw) as Record<string, unknown>;
        const typeName = (cfg.type as string) || "novel";
        if (isValidType(typeName)) {
            const typeDef = await loadType(typeName);
            if (!typeDef.add_commands.includes(command)) {
                console.error(
                    `\n${icon.error} ${c.red(`"wk add ${command}" is not available for ${typeDef.name} projects.`)}`,
                );
                console.error(`  ${c.dim(`Available: ${typeDef.add_commands.join(", ")}`)}\n`);
                process.exit(1);
            }
        }
    } catch { /* config not readable, let other commands handle it */ }
}

async function countMdFiles(dir: string): Promise<number> {
    try {
        const files = await readdir(dir);
        return files.filter((f) => extname(f) === ".md").length;
    } catch {
        return 0;
    }
}

// --- wkadd chapter ---

const addChapter = new Command("chapter")
    .description("Add a new chapter to manuscript and outline")
    .argument("<title>", "Chapter title")
    .action(async (title: string) => {
        const projectDir = process.cwd();
        await assertProject(projectDir);

        const manuscriptDir = join(projectDir, "manuscript");
        const outlineDir = join(projectDir, "outline", "chapters");
        await ensureDir(manuscriptDir);
        await ensureDir(outlineDir);

        const existing = await countMdFiles(manuscriptDir);
        const num = existing + 1;
        const pad = padNumber(num);
        const slug = slugify(title);

        const manuscriptFile = join(manuscriptDir, `${pad}-${slug}.md`);
        const outlineFile = join(outlineDir, `${pad}.md`);

        if (await fileExists(manuscriptFile)) {
            console.error(`\nFile already exists: manuscript/${pad}-${slug}.md\n`);
            process.exit(1);
        }

        await writeFile(
            manuscriptFile,
            frontmatter(
                {
                    chapter: num,
                    title,
                    pov: "",
                    draft: 1,
                },
                `# ${title}\n\n`,
            ),
        );

        await writeFile(
            outlineFile,
            frontmatter(
                {
                    chapter: num,
                    title,
                    pov: "",
                    characters: [],
                    location: "",
                },
                `# Chapter ${num} — Outline\n\n`,
            ),
        );


        console.log(`\n${icon.chapter} ${c.green(`Added chapter ${num}:`)} ${c.bold(title)}\n`);
        console.log(`  ${c.dim(`manuscript/${pad}-${slug}.md`)}`);
        console.log(`  ${c.dim(`outline/chapters/${pad}.md`)}\n`);
    });

// --- wkadd character ---

const addCharacter = new Command("character")
    .description("Add a new character sheet")
    .argument("<name>", "Character name")
    .option("-r, --role <role>", "Role (protagonist, antagonist, supporting, minor)", "supporting")
    .action(async (name: string, opts: { role: string }) => {
        const projectDir = process.cwd();
        await assertProject(projectDir);
        await assertAddCommand(projectDir, "character");

        const dir = join(projectDir, "characters");
        await ensureDir(dir);

        const slug = slugify(name);
        const file = join(dir, `${slug}.md`);

        if (await fileExists(file)) {
            console.error(`\nFile already exists: characters/${slug}.md\n`);
            process.exit(1);
        }

        await writeFile(
            file,
            frontmatter(
                {
                    name,
                    role: opts.role,
                    aliases: [],
                    age: "",
                    relationships: [],
                },
                `# ${name}\n\n## Appearance\n\n## Personality\n\n## Backstory\n\n## Arc\n\n## Notes\n`,
            ),
        );


        console.log(`\n${icon.character} ${c.green("Added character:")} ${c.bold(name)}\n`);
        console.log(`  ${c.dim(`characters/${slug}.md`)}\n`);
    });

// --- wkadd location ---

const addLocation = new Command("location")
    .description("Add a new worldbuilding entry")
    .option("-t, --type <type>", "Type (location, system, organization, culture)", "location")
    .argument("<name>", "Location/entry name")
    .action(async (name: string, opts: { type: string }) => {
        const projectDir = process.cwd();
        await assertProject(projectDir);
        await assertAddCommand(projectDir, "location");

        const dir = join(projectDir, "world");
        await ensureDir(dir);

        const slug = slugify(name);
        const file = join(dir, `${slug}.md`);

        if (await fileExists(file)) {
            console.error(`\nFile already exists: world/${slug}.md\n`);
            process.exit(1);
        }

        await writeFile(
            file,
            frontmatter(
                {
                    name,
                    type: opts.type,
                },
                `# ${name}\n\n## Description\n\n## Details\n\n## Notes\n`,
            ),
        );


        console.log(`\n${icon.location} ${c.green(`Added ${opts.type}:`)} ${c.bold(name)}\n`);
        console.log(`  ${c.dim(`world/${slug}.md`)}\n`);
    });

// --- wkadd note ---

const addNote = new Command("note")
    .description("Add a new note")
    .argument("<title>", "Note title")
    .action(async (title: string) => {
        const projectDir = process.cwd();
        await assertProject(projectDir);

        const dir = join(projectDir, "notes");
        await ensureDir(dir);

        const slug = slugify(title);
        const file = join(dir, `${slug}.md`);

        if (await fileExists(file)) {
            console.error(`\nFile already exists: notes/${slug}.md\n`);
            process.exit(1);
        }

        await writeFile(file, `# ${title}\n\n`);


        console.log(`\n${icon.note} ${c.green("Added note:")} ${c.bold(title)}\n`);
        console.log(`  ${c.dim(`notes/${slug}.md`)}\n`);
    });

// --- wk add concept ---

const addConcept = new Command("concept")
    .description("Add a concept/term definition")
    .argument("<term>", "Concept term")
    .action(async (term: string) => {
        const projectDir = process.cwd();
        await assertProject(projectDir);
        await assertAddCommand(projectDir, "concept");

        const dir = join(projectDir, "concepts");
        await ensureDir(dir);

        const slug = slugify(term);
        const file = join(dir, `${slug}.md`);

        if (await fileExists(file)) {
            console.error(`\nFile already exists: concepts/${slug}.md\n`);
            process.exit(1);
        }

        await writeFile(
            file,
            frontmatter(
                { term, related: [] },
                `# ${term}\n\nDefinition...\n`,
            ),
        );

        console.log(`\n${icon.note} ${c.green("Added concept:")} ${c.bold(term)}\n`);
        console.log(`  ${c.dim(`concepts/${slug}.md`)}\n`);
    });

// --- wk add argument ---

const addArgument = new Command("argument")
    .description("Add an argument sheet")
    .argument("<claim>", "Argument claim")
    .action(async (claim: string) => {
        const projectDir = process.cwd();
        await assertProject(projectDir);
        await assertAddCommand(projectDir, "argument");

        const dir = join(projectDir, "arguments");
        await ensureDir(dir);

        const slug = slugify(claim);
        const file = join(dir, `${slug}.md`);

        if (await fileExists(file)) {
            console.error(`\nFile already exists: arguments/${slug}.md\n`);
            process.exit(1);
        }

        await writeFile(
            file,
            frontmatter(
                { claim, related: [] },
                `# ${claim}\n\n## Support\n\n## Counterpoint\n`,
            ),
        );

        console.log(`\n${icon.note} ${c.green("Added argument:")} ${c.bold(claim)}\n`);
        console.log(`  ${c.dim(`arguments/${slug}.md`)}\n`);
    });

// --- wkadd event ---

interface TimelineData {
    events: Array<{ date: string; description: string; chapter: string }>;
}

const addEvent = new Command("event")
    .description("Add an event to timeline.yaml")
    .argument("<description>", "Event description")
    .option("-d, --date <date>", "When the event occurs", "")
    .option("-c, --chapter <chapter>", "Related chapter", "")
    .action(async (description: string, opts: { date: string; chapter: string }) => {
        const projectDir = process.cwd();
        await assertProject(projectDir);
        await assertAddCommand(projectDir, "event");

        const timelinePath = join(projectDir, "timeline.yaml");
        let data: TimelineData;

        try {
            const raw = await readFile(timelinePath, "utf-8");
            data = parseYaml(raw) as TimelineData;
            if (!data || !Array.isArray(data.events)) {
                data = { events: [] };
            }
        } catch {
            data = { events: [] };
        }

        data.events.push({
            date: opts.date,
            description,
            chapter: opts.chapter,
        });

        await writeFile(timelinePath, stringify(data));


        console.log(`\n${icon.event} ${c.green("Added event:")} ${c.bold(description)}\n`);
        console.log(`  ${c.dim(`timeline.yaml (${data.events.length} events)`)}\n`);
    });

// --- contributor helpers ---

async function addContributorToConfig(
    projectDir: string,
    name: string,
    field: string,
): Promise<void> {
    const configPath = join(projectDir, "config.yaml");
    const raw = await readFile(configPath, "utf-8");
    const cfg = parseYaml(raw) as Record<string, unknown>;

    const current = cfg[field];
    if (Array.isArray(current)) {
        if (current.includes(name)) {
            console.log(`\n${icon.warn}  ${c.yellow(`"${name}" is already listed as ${field}.`)}\n`);
            return;
        }
        current.push(name);
    } else if (typeof current === "string" && current) {
        if (current === name) {
            console.log(`\n${icon.warn}  ${c.yellow(`"${name}" is already listed as ${field}.`)}\n`);
            return;
        }
        cfg[field] = [current, name];
    } else {
        cfg[field] = name;
    }

    await writeFile(configPath, stringify(cfg));
}

async function ensureContributorSheet(
    projectDir: string,
    name: string,
): Promise<boolean> {
    const dir = join(projectDir, "contributors");
    await ensureDir(dir);
    const slug = slugify(name);
    const file = join(dir, `${slug}.md`);

    if (await fileExists(file)) return false;

    await writeFile(
        file,
        frontmatter(
            { name, roles: [] },
            `# ${name}\n\nBiography...\n`,
        ),
    );
    return true;
}

function makeContributorCommand(
    commandName: string,
    configField: string,
    label: string,
): Command {
    return new Command(commandName)
        .description(`Add ${label} to config.yaml and create contributor sheet`)
        .argument("<name>", `${label} name`)
        .action(async (name: string) => {
            const projectDir = process.cwd();
            await assertProject(projectDir);

            await addContributorToConfig(projectDir, name, configField);
            const created = await ensureContributorSheet(projectDir, name);

            const slug = slugify(name);
            console.log(`\n${icon.character} ${c.green(`Added ${label}:`)} ${c.bold(name)}\n`);
            if (created) {
                console.log(`  ${c.dim(`contributors/${slug}.md`)}`);
            }
            const configPath = join(projectDir, "config.yaml");
            const raw = await readFile(configPath, "utf-8");
            const cfg = parseYaml(raw) as Record<string, unknown>;
            const list = Array.isArray(cfg[configField]) ? cfg[configField] : [cfg[configField]];
            console.log(`  ${c.dim(`${configField}: ${(list as string[]).join(", ")}`)}\n`);
        });
}

// --- wk add author/translator/editor/illustrator ---

const addAuthor = makeContributorCommand("author", "author", "author");
const addTranslator = makeContributorCommand("translator", "translator", "translator");
const addEditor = makeContributorCommand("editor", "editor", "editor");
const addIllustrator = makeContributorCommand("illustrator", "illustrator", "illustrator");

// --- wkadd source ---

const addSource = new Command("source")
    .description("Add a source to bibliography.yaml")
    .argument("<title>", "Source title")
    .option("-a, --author <author>", "Source author", "")
    .option("-y, --year <year>", "Publication year", "")
    .option("-u, --url <url>", "URL", "")
    .action(async (title: string, opts: { author: string; year: string; url: string }) => {
        const projectDir = process.cwd();
        await assertProject(projectDir);
        await assertAddCommand(projectDir, "source");

        const bibPath = join(projectDir, "bibliography.yaml");
        let data: { sources: Array<Record<string, string>> };

        try {
            const raw = await readFile(bibPath, "utf-8");
            data = parseYaml(raw) as typeof data;
            if (!data || !Array.isArray(data.sources)) {
                data = { sources: [] };
            }
        } catch {
            data = { sources: [] };
        }

        data.sources.push({
            author: opts.author,
            title,
            year: opts.year,
            url: opts.url,
        });

        await writeFile(bibPath, stringify(data));
        console.log(`\n${icon.note} ${c.green("Added source:")} ${c.bold(title)}\n`);
        console.log(`  ${c.dim(`bibliography.yaml (${data.sources.length} sources)`)}\n`);
    });

// --- wkadd (parent command) ---

export const addCommand = new Command("add")
    .description("Add chapters, characters, locations, notes, events, authors, or sources");

addCommand.addCommand(addChapter);
addCommand.addCommand(addCharacter);
addCommand.addCommand(addLocation);
addCommand.addCommand(addConcept);
addCommand.addCommand(addArgument);
addCommand.addCommand(addNote);
addCommand.addCommand(addEvent);
addCommand.addCommand(addAuthor);
addCommand.addCommand(addTranslator);
addCommand.addCommand(addEditor);
addCommand.addCommand(addIllustrator);
addCommand.addCommand(addSource);
