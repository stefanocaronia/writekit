import { Command } from "commander";
import { readdir, readFile, writeFile, mkdir } from "node:fs/promises";
import { join, extname } from "node:path";
import { stringify, parse as parseYaml } from "yaml";
import { slugify, padNumber } from "../support/slug.js";
import { fileExists, dirExists, assertProject, frontmatter } from "../support/fs-utils.js";
import { loadType, hasType } from "../project/project-type.js";
import { SECTION_FILE_MAP } from "../project/parse.js";
import { c, icon } from "../support/ui.js";

async function ensureDir(dir: string): Promise<void> {
    await mkdir(dir, { recursive: true });
}

async function assertAddCommand(projectDir: string, command: string): Promise<void> {
    try {
        const raw = await readFile(join(projectDir, "config.yaml"), "utf-8");
        const cfg = parseYaml(raw) as Record<string, unknown>;
        const typeName = (cfg.type as string) || "novel";
        if (await hasType(typeName, projectDir)) {
            const typeDef = await loadType(typeName, projectDir);
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
        const sectionFiles = new Set(Object.keys(SECTION_FILE_MAP));
        return files.filter((f) => extname(f) === ".md" && !sectionFiles.has(f)).length;
    } catch {
        return 0;
    }
}

// --- wkadd chapter ---

async function getTypeSchema(projectDir: string): Promise<{ manuscript: Set<string>; outline: Set<string>; hasOutlineChapters: boolean }> {
    try {
        const raw = await readFile(join(projectDir, "config.yaml"), "utf-8");
        const cfg = parseYaml(raw) as Record<string, unknown>;
        const typeName = (cfg.type as string) || "novel";
        if (await hasType(typeName, projectDir)) {
            const typeDef = await loadType(typeName, projectDir);
            const msSchema = typeDef.schemas?.manuscript;
            const olSchema = typeDef.schemas?.["outline/chapters"];
            const msFields = new Set([
                ...(msSchema?.required ?? []),
                ...(msSchema?.optional ?? []),
            ]);
            const olFields = new Set([
                ...(olSchema?.required ?? []),
                ...(olSchema?.optional ?? []),
            ]);
            return {
                manuscript: msFields,
                outline: olFields,
                hasOutlineChapters: typeDef.dirs.includes("outline/chapters"),
            };
        }
    } catch { /* fallback */ }
    return {
        manuscript: new Set(["chapter", "title", "pov", "draft", "author"]),
        outline: new Set(["chapter", "title", "pov", "characters", "location"]),
        hasOutlineChapters: true,
    };
}

const addChapter = new Command("chapter")
    .description("Add a new chapter to manuscript and outline")
    .argument("<title>", "Chapter title")
    .option("-p, --part <number>", "Add chapter inside a part directory")
    .action(async (title: string, opts: { part?: string }) => {
        const projectDir = process.cwd();
        await assertProject(projectDir);

        const schema = await getTypeSchema(projectDir);

        const manuscriptDir = join(projectDir, "manuscript");
        await ensureDir(manuscriptDir);

        let targetDir = manuscriptDir;
        let partLabel = "";
        if (opts.part) {
            const partNum = parseInt(opts.part, 10);
            if (isNaN(partNum) || partNum < 1) {
                console.error(`\n${icon.error} ${c.red("Invalid part number.")}\n`);
                process.exit(1);
            }
            const partDirName = `part-${padNumber(partNum)}`;
            targetDir = join(manuscriptDir, partDirName);
            if (!(await dirExists(targetDir))) {
                console.error(`\n${icon.error} ${c.red(`Part directory manuscript/${partDirName}/ does not exist.`)}`);
                console.error(`  ${c.dim('Create it first with: wk add part "Title"')}\n`);
                process.exit(1);
            }
            partLabel = `${partDirName}/`;
        }

        const existing = await countMdFiles(targetDir);
        const num = existing + 1;
        const pad = padNumber(num);
        const slug = slugify(title);

        const manuscriptFile = join(targetDir, `${pad}-${slug}.md`);

        if (await fileExists(manuscriptFile)) {
            console.error(`\nFile already exists: manuscript/${partLabel}${pad}-${slug}.md\n`);
            process.exit(1);
        }

        // Build frontmatter with only fields the type supports
        const msFm: Record<string, unknown> = { title };
        if (schema.manuscript.has("chapter")) msFm.chapter = num;
        if (schema.manuscript.has("pov")) msFm.pov = "";
        if (schema.manuscript.has("draft")) msFm.draft = 1;
        if (schema.manuscript.has("author")) msFm.author = "";

        await writeFile(
            manuscriptFile,
            frontmatter(msFm, `# ${title}\n\n`),
        );

        // Outline chapter (only if type supports it)
        if (schema.hasOutlineChapters) {
            const outlineDir = join(projectDir, "outline", "chapters");
            await ensureDir(outlineDir);
            const outlineFile = join(outlineDir, `${pad}.md`);

            const olFm: Record<string, unknown> = { title };
            if (schema.outline.has("chapter")) olFm.chapter = num;
            if (schema.outline.has("pov")) olFm.pov = "";
            if (schema.outline.has("characters")) olFm.characters = [];
            if (schema.outline.has("location")) olFm.location = "";

            await writeFile(
                outlineFile,
                frontmatter(olFm, `# Chapter ${num} — Outline\n\n`),
            );
        }

        console.log(`\n${icon.chapter} ${c.green(`Added chapter ${num}:`)} ${c.bold(title)}\n`);
        console.log(`  ${c.dim(`manuscript/${partLabel}${pad}-${slug}.md`)}`);
        if (schema.hasOutlineChapters) {
            console.log(`  ${c.dim(`outline/chapters/${pad}.md`)}`);
        }
        console.log();
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

// --- wk add part ---

async function countPartDirs(manuscriptDir: string): Promise<number> {
    try {
        const entries = await readdir(manuscriptDir);
        return entries.filter((e) => e.startsWith("part-")).length;
    } catch {
        return 0;
    }
}

const addPart = new Command("part")
    .description("Add a new part directory to the manuscript")
    .argument("<title>", "Part title")
    .action(async (title: string) => {
        const projectDir = process.cwd();
        await assertProject(projectDir);
        await assertAddCommand(projectDir, "part");

        const manuscriptDir = join(projectDir, "manuscript");
        await ensureDir(manuscriptDir);

        const existing = await countPartDirs(manuscriptDir);
        const num = existing + 1;
        const pad = padNumber(num);
        const partDirName = `part-${pad}`;
        const partDir = join(manuscriptDir, partDirName);

        await mkdir(partDir, { recursive: true });
        await writeFile(join(partDir, "part.yaml"), stringify({ title }));

        console.log(`\n${icon.folder} ${c.green(`Added part ${num}:`)} ${c.bold(title)}\n`);
        console.log(`  ${c.dim(`manuscript/${partDirName}/`)}`);
        console.log(`  ${c.dim(`manuscript/${partDirName}/part.yaml`)}\n`);
    });

// --- wk add front/back matter sections ---

interface SectionDef {
    command: string;
    filename: string;
    displayTitle: string;
}

const SECTION_DEFS: SectionDef[] = [
    { command: "dedication", filename: "dedication.md", displayTitle: "Dedication" },
    { command: "epigraph", filename: "epigraph.md", displayTitle: "Epigraph" },
    { command: "preface", filename: "preface.md", displayTitle: "Preface" },
    { command: "foreword", filename: "foreword.md", displayTitle: "Foreword" },
    { command: "prologue", filename: "prologue.md", displayTitle: "Prologue" },
    { command: "epilogue", filename: "epilogue.md", displayTitle: "Epilogue" },
    { command: "afterword", filename: "afterword.md", displayTitle: "Afterword" },
    { command: "appendix", filename: "appendix.md", displayTitle: "Appendix" },
    { command: "author-note", filename: "author-note.md", displayTitle: "Author's Note" },
];

function makeSectionCommand(def: SectionDef): Command {
    return new Command(def.command)
        .description(`Add ${def.displayTitle.toLowerCase()} to the manuscript`)
        .action(async () => {
            const projectDir = process.cwd();
            await assertProject(projectDir);
            await assertAddCommand(projectDir, def.command);

            const manuscriptDir = join(projectDir, "manuscript");
            await ensureDir(manuscriptDir);

            const filePath = join(manuscriptDir, def.filename);
            if (await fileExists(filePath)) {
                console.error(`\n${icon.error} ${c.red(`File already exists: manuscript/${def.filename}`)}\n`);
                process.exit(1);
            }

            await writeFile(
                filePath,
                `---\n---\n\nWrite here...\n`,
            );

            console.log(`\n${icon.note} ${c.green(`Added ${def.displayTitle.toLowerCase()}`)}\n`);
            console.log(`  ${c.dim(`manuscript/${def.filename}`)}\n`);
        });
}

const sectionCommands = SECTION_DEFS.map(makeSectionCommand);

// --- wkadd (parent command) ---

export const addCommand = new Command("add")
    .description("Add chapters, parts, characters, locations, notes, events, sections, or sources");

addCommand.addCommand(addChapter);
addCommand.addCommand(addPart);
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
for (const cmd of sectionCommands) addCommand.addCommand(cmd);
