# writekit

A writing toolkit that turns Markdown into books. Write your novel, essay, or article in plain text files, and **writekit** generates PDF, ePub, HTML, and Word documents for you.

Designed for writers — no programming required. Works beautifully with git for version control and with AI assistants for collaborative writing.

## Getting started

### 1. Install

You need [Node.js](https://nodejs.org/) (version 18 or later). Then open a terminal and run:

```bash
npm install -g writekit
```

This gives you the `wk` command.

### 2. Create a project

```bash
wk init my-novel
```

You'll be asked for a title, author name, and language. A new folder is created with everything you need to start writing.

### 3. Write

Open the `manuscript/` folder and start writing in Markdown — a simple text format where `**bold**` makes **bold**, `*italic*` makes *italic*, and `# Heading` makes a heading. If you've ever written a message on Slack, Discord, or Reddit, you already know the basics.

### 4. Build your book

```bash
cd my-novel
wk build html
```

Open the generated file in `build/` with your browser. That's your book.

## What's inside a project

When you create a project, writekit generates this structure:

```
my-novel/
├── config.yaml         Title, author, language, and other metadata
├── style.yaml          Writing rules — point of view, tense, tone
├── timeline.yaml       Key events in chronological order
├── synopsis.md         A short summary of your book
│
├── outline/            Plan your story before writing
│   ├── plot.md         The overall arc (acts, major beats)
│   └── chapters/       One file per chapter outline
│
├── manuscript/         Your actual text — one file per chapter
├── characters/         Character sheets (name, role, backstory)
├── world/              Locations, cultures, systems
├── notes/              Free-form ideas, research, anything
├── reference/          External material (images, PDFs, sources)
├── assets/             Cover art, illustrations
│
└── build/              Generated output (PDF, ePub, HTML, Word)
    └── reports/        Auto-generated summaries of your project
```

**You only need to care about the folders.** The rest is handled by writekit.

## Commands

### Creating and adding content

| Command | What it does |
|---|---|
| `wk init <name>` | Create a new project |
| `wk add chapter <title>` | Add a new chapter |
| `wk add character <name>` | Add a character sheet |
| `wk add location <name>` | Add a place to your world |
| `wk add note <title>` | Add a note |
| `wk add event <description>` | Add a timeline event |

### Building your book

| Command | What it does |
|---|---|
| `wk build html` | Build as a web page (best for preview) |
| `wk build epub` | Build as an ePub ebook |
| `wk build pdf` | Build as a PDF document |
| `wk build docx` | Build as a Word document |
| `wk build all` | Build all formats at once |
| `wk build` | Build using your preferred formats from config.yaml |
| `wk build clean` | Delete all generated files |

### Validating and watching

| Command | What it does |
|---|---|
| `wk check` | Validate your project — checks for missing files, broken YAML, and formatting issues |
| `wk watch` | Watch your files and automatically rebuild when you save. Also runs validation on every change |

### Themes

Themes control how your book looks in HTML and ePub formats.

| Command | What it does |
|---|---|
| `wk theme list` | See available themes |
| `wk theme use <name>` | Switch to a different theme |
| `wk theme create <name>` | Create your own theme (copies the default as a starting point) |

The default theme is built into writekit and cannot be modified. When you create a custom theme, you get a copy in your project's `themes/` folder that you can edit freely. Updates to writekit will refresh the default theme without touching your custom themes.

## Writing in Markdown

Writekit uses Markdown — a simple way to format text that's readable even without rendering.

| What you write | What you get |
|---|---|
| `# Chapter Title` | A big heading |
| `## Section` | A smaller heading |
| `**bold text**` | **bold text** |
| `*italic text*` | *italic text* |
| `> a quote` | A blockquote |
| `- item` | A bullet list |
| `1. item` | A numbered list |
| `[text](url)` | A clickable link |
| `` `code` `` | Inline code |
| `---` | A horizontal line |

All of these work in every output format (HTML, ePub, PDF, Word).

### Frontmatter

Some files have a special header at the top between `---` marks. This is called **frontmatter** and contains metadata about that file:

```markdown
---
chapter: 1
title: The Beginning
pov: "Marco"
draft: 1
---

# The Beginning

It was a dark and stormy night...
```

Writekit uses this metadata for validation, reports, and building your book. You don't need to memorize the fields — `wk add` creates files with the right frontmatter already in place.

## Configuration

### config.yaml

The main settings file. The most important fields:

```yaml
title: "My Novel"
author: "Your Name"
language: en
build_formats:       # What 'wk build' generates by default
  - html
  - epub
theme: default       # Which theme to use
```

Other fields (subtitle, genre, ISBN, publisher, etc.) are optional and used in the book's colophon page.

### style.yaml

Writing rules that help keep your text consistent:

```yaml
pov: third-person    # first-person, third-person, or omniscient
tense: past          # past or present
tone: ""             # e.g., "dark", "humorous", "formal"
voice: ""            # e.g., "conversational", "literary"
rules: []            # Any specific rules, e.g., "no adverbs"
```

These are especially useful when working with an AI assistant — they help maintain a consistent voice throughout the book.

## Reports

Every time you build, writekit generates reports in `build/reports/`:

- **status.md** — Word count per chapter, total progress, draft numbers
- **cast.md** — Which characters appear in which chapters
- **locations.md** — Which locations appear in which chapters
- **timeline.md** — Your timeline formatted and readable

These are auto-generated and overwritten on every build. Don't edit them.

## Publishing with GitHub

If your project is on GitHub, you can automate publishing.

### Publish your book as a website (GitHub Pages)

Add this file to your project as `.github/workflows/pages.yml`:

```yaml
name: Deploy to Pages
on:
  push:
    branches: [main]
permissions:
  pages: write
  id-token: write
jobs:
  deploy:
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
      - run: npm install -g writekit
      - run: wk build html
      - uses: actions/upload-pages-artifact@v3
        with:
          path: build/
      - id: deployment
        uses: actions/deploy-pages@v4
```

Every time you push to main, your book is published as a web page.

### Attach ePub to a release

Add this as `.github/workflows/release.yml`:

```yaml
name: Build Release
on:
  push:
    tags: ["v*"]
jobs:
  release:
    runs-on: ubuntu-latest
    permissions:
      contents: write
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
      - run: npm install -g writekit
      - run: wk build epub
      - uses: softprops/action-gh-release@v2
        with:
          files: build/*.epub
```

Tag a version (`git tag v1.0 && git push --tags`) and GitHub will build the ePub and attach it to the release.

## License

MIT
