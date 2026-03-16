# novel-maker

CLI framework for writing books. Scaffolds a structured workspace, validates your project, and builds to PDF, ePub, HTML, and DOCX.

Designed for humans and LLMs working together — with git as the backbone.

## Install

```bash
npm install -g novel-maker
```

## Commands

### `novel init <name>`

Create a new novel project.

```bash
novel init my-book
```

Generates:

```
my-book/
├── config.yaml          # Book metadata
├── style.yaml           # Writing rules (POV, tense, tone)
├── timeline.yaml        # Chronological events
├── synopsis.md          # Book pitch / summary
├── outline/             # Story structure
│   ├── plot.md          # Overall arc and acts
│   └── chapters/        # Per-chapter outlines
├── manuscript/          # The actual book text
├── characters/          # Character sheets
├── world/               # Worldbuilding (locations, systems, cultures)
├── notes/               # Free-form ideas and research
├── reference/           # External material (images, PDFs, sources)
├── assets/              # Book assets (cover, illustrations)
├── build/               # Generated output
└── README.md            # Project documentation
```

### `novel check`

Validate project structure and frontmatter. Run from inside a novel project.

```bash
cd my-book
novel check
```

Checks:
- Required files and directories exist
- YAML files are valid and have required fields
- Markdown files have correct frontmatter
- File naming conventions are followed

Exits with code 1 if there are errors. Warnings don't block.

### `novel build <format>`

Build the book into the specified format.

```bash
novel build html    # HTML output
novel build epub    # ePub ebook
novel build pdf     # PDF document
novel build docx    # Word document
```

Output goes to `build/`.

### `novel watch [format]`

Watch for changes and automatically rebuild. Runs `check` on every change.

```bash
novel watch         # Default: html
novel watch epub    # Watch with ePub build
```

Only `html` and `epub` are supported in watch mode — PDF and DOCX are heavier and should be built explicitly with `novel build`.

## Project Structure

### YAML config files

| File | Purpose |
|---|---|
| `config.yaml` | Title, author, language, genre |
| `style.yaml` | POV, tense, tone, voice, writing rules |
| `timeline.yaml` | Ordered list of story events |

### Markdown with frontmatter

Files in `manuscript/`, `characters/`, `world/`, and `outline/` use YAML frontmatter:

```markdown
---
chapter: 1
title: Capitolo Primo
pov: ""
draft: 1
---

# Capitolo Primo

Your text here...
```

#### Frontmatter fields

**manuscript/** — `chapter`, `title`, `pov`, `draft`

**outline/chapters/** — `chapter`, `title`, `pov`, `characters`, `location`

**outline/plot.md** — `acts` (list with `name` and `summary`)

**characters/** — `name`, `role`, `age`, `relationships`

**world/** — `name`, `type`

### Free-form folders

| Folder | Purpose |
|---|---|
| `notes/` | Ideas, research, background — no schema |
| `reference/` | External material — images, PDFs, other texts |
| `assets/` | Cover art, illustrations for the book |

### Naming conventions

- Manuscript: `NN-slug.md` (e.g. `01-capitolo-primo.md`)
- Outline chapters: `NN.md` (e.g. `01.md`)
- Characters: `character-name.md` (e.g. `marco-rossi.md`)
- World entries: `entry-name.md` (e.g. `ancient-castle.md`)

## Workflow

```
novel init my-book       # 1. Scaffold
cd my-book               # 2. Enter project
                         # 3. Fill config.yaml, style.yaml, synopsis.md
                         # 4. Plan in outline/
                         # 5. Create characters/ and world/
                         # 6. Write in manuscript/
novel check              # 7. Validate
novel watch              # 8. Live feedback while writing
novel build pdf          # 9. Generate final output
```

## License

MIT
