import { Command } from "commander";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { stringify } from "yaml";

const DIRS = [
  "outline",
  "manuscript",
  "characters",
  "world",
  "notes",
  "reference",
  "assets",
  "build",
];

export const initCommand = new Command("init")
  .description("Create a new novel project")
  .argument("<name>", "Project name")
  .action(async (name: string) => {
    const projectDir = join(process.cwd(), name);

    console.log(`\nCreating novel project: ${name}\n`);

    // Create directory structure
    for (const dir of DIRS) {
      await mkdir(join(projectDir, dir), { recursive: true });
    }

    // config.yaml
    await writeFile(
      join(projectDir, "config.yaml"),
      stringify({
        title: name,
        author: "",
        language: "it",
      }),
    );

    // synopsis.md
    await writeFile(
      join(projectDir, "synopsis.md"),
      `# ${name}\n\nWrite your synopsis here...\n`,
    );

    // style.yaml
    await writeFile(
      join(projectDir, "style.yaml"),
      stringify({
        pov: "third-person",
        tense: "past",
        tone: "",
        notes: "",
      }),
    );

    // timeline.yaml
    await writeFile(
      join(projectDir, "timeline.yaml"),
      stringify({
        events: [],
      }),
    );

    // Sample first chapter
    await writeFile(
      join(projectDir, "manuscript", "01-capitolo-primo.md"),
      `# Capitolo Primo\n\nScrivi qui il tuo testo...\n`,
    );

    // Print created structure
    console.log(`  ${name}/`);
    console.log(`  ├── config.yaml`);
    console.log(`  ├── synopsis.md`);
    console.log(`  ├── style.yaml`);
    console.log(`  ├── timeline.yaml`);
    for (let i = 0; i < DIRS.length; i++) {
      const prefix = i === DIRS.length - 1 ? "└──" : "├──";
      console.log(`  ${prefix} ${DIRS[i]}/`);
    }
    console.log(`\nDone! Start writing with:\n`);
    console.log(`  cd ${name}`);
    console.log(`  novel build html\n`);
  });
