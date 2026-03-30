# Write Kit

A writing toolkit that turns Markdown into books. Write a novel, essay, or paper in plain text files, and **writekit** generates ePub, HTML, PDF, DOCX, and Markdown output.

It's similar to what programmers use for building apps, but for structured text: chapters, parts, characters, outlines, front/back matter — assembled into a finished book.

For plugin authors, see [PLUGINS.md](./PLUGINS.md).

## Getting started

### 1. Install

You need [Node.js](https://nodejs.org/) (version 18 or later). Then open a terminal and run:

```bash
npm install -g writekit
```

Now you can use the `writekit` command. In this guide we will use the shorter alias `wk`.

### 2. Create a project

```bash
wk init my-novel
```

You'll be asked for a title, author name, and language. A new folder is created with everything you need to start writing.

### 3. Write

Open the `manuscript/` folder and start writing in Markdown — a simple text format where `**bold**` makes **bold**, `*italic*` makes *italic*, and `# Heading` makes a heading. If you've ever written a message on Slack, Discord, or Reddit, you already know the basics.

## Project types

When you create a project, writekit asks what type of text you're writing:

| Type | Best for | Build sections |
|---|---|---|
| **novel** | Novels, novellas, long-form fiction | cover, title page, TOC, content, back cover, about, colophon |
| **collection** | Anthologies — short stories, poems, essays | cover, title page, TOC, content, back cover, about, colophon |
| **essay** | Single long-form non-fiction | cover, title page, TOC, content, back cover, about, colophon |
| **paper** | Academic papers with bibliography | title block, abstract, content, bibliography |

Each type sets up only the folders and files you need. You choose the type once at creation:

```bash
wk init my-essay --type essay
```

You can also install external type packages. A package named `writekit-type-screenplay` makes the type available as `screenplay`:

```bash
npm install writekit-type-screenplay
wk init my-script --type screenplay
```

External type packages are discovered from `node_modules` in the current folder or any parent folder. By default they should include a `type.yaml` file at package root. If needed, the package can point somewhere else with `package.json -> writekit.type.definition`.

If the type also needs custom logic, it can export a runtime plugin with hooks such as `onInit`, `onCheck`, `onBuild`, and `onSync`. See [PLUGINS.md](./PLUGINS.md).

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
├── backcover.md        Back cover text — the reader-facing pitch
│
├── outline/            Plan your story before writing
│   ├── plot.md         The overall arc (acts, major beats)
│   └── chapters/       One file per chapter outline
│
├── manuscript/         Your actual text
│   ├── dedication.md       (optional) Dedication page
│   ├── preface.md          (optional) Preface
│   ├── foreword.md         (optional) Foreword
│   ├── prologue.md         (optional) Prologue (novel only)
│   ├── 01-chapter-one.md   Numbered chapter files
│   ├── 02-chapter-two.md
│   ├── epilogue.md         (optional) Epilogue (novel only)
│   ├── afterword.md        (optional) Afterword
│   └── appendix.md         (optional) Appendix
│
├── characters/         Character sheets (name, role, backstory)
├── world/              Locations, cultures, systems
├── contributors/       Author, translator, editor bios
├── notes/              Free-form ideas, research, anything
├── reference/          External material (images, PDFs, sources)
├── assets/             Cover image (cover.jpg or cover.png), illustrations
│
└── build/              Generated output (PDF, ePub, HTML, DOCX, MD)
    └── reports/        Auto-generated summaries of your project
```

**You only need to care about the folders.** The rest is handled by writekit.

### Parts

For longer books, you can organize chapters into parts:

```
manuscript/
├── prologue.md
├── part-01/
│   ├── part.yaml           # title: "The Beginning"
│   ├── 01-the-arrival.md
│   └── 02-the-journey.md
├── part-02/
│   ├── part.yaml           # title: "The End"
│   └── 01-the-return.md
└── epilogue.md
```

Parts are created with `wk add part "Title"` and chapters are assigned with `wk add chapter "Title" --part 1`. Front/back matter files (prologue, epilogue, etc.) stay in the manuscript root, outside any part.

When parts exist, `wk check` will warn about numbered chapter files left in the root — they should be assigned to a part.

### Front and back matter

These special sections are recognized by filename and rendered in the correct position:

| Section | Position | Available for |
|---|---|---|
| `dedication.md` | front | novel, collection, essay |
| `preface.md` | front | novel, collection, essay |
| `foreword.md` | front | novel, collection, essay |
| `prologue.md` | front | novel |
| `epilogue.md` | back | novel |
| `afterword.md` | back | novel, collection, essay |
| `appendix.md` | back | novel, collection, essay, paper |
| `author-note.md` | back | novel, collection, essay |

Add them with `wk add prologue`, `wk add epilogue`, etc. Remove with `wk remove prologue`.

## Commands

### Creating and adding content

| Command | What it does |
|---|---|
| `wk init <name>` | Create a new project (prompts for type, title, author, language) |
| `wk init <name> --type essay` | Create a project of a specific type |
| `wk add chapter <title>` | Add a new chapter |
| `wk add chapter <title> --part 1` | Add a chapter inside part 1 |
| `wk add part <title>` | Add a new part (creates `manuscript/part-NN/`) |
| `wk add character <name>` | Add a character sheet (novel only) |
| `wk add location <name>` | Add a place to your world (novel only) |
| `wk add concept <term>` | Add a concept/term definition (essay, paper) |
| `wk add argument <claim>` | Add an argument sheet (essay only) |
| `wk add note <title>` | Add a note |
| `wk add event <description>` | Add a timeline event (novel only) |
| `wk add author <name>` | Add an author (creates contributor sheet) |
| `wk add translator <name>` | Add a translator (creates contributor sheet) |
| `wk add editor <name>` | Add an editor (creates contributor sheet) |
| `wk add illustrator <name>` | Add an illustrator (creates contributor sheet) |
| `wk add source <title>` | Add a bibliography source (paper only) |
| `wk add prologue` | Add a prologue (novel only) |
| `wk add epilogue` | Add an epilogue (novel only) |
| `wk add dedication` | Add a dedication page |
| `wk add preface` | Add a preface |
| `wk add foreword` | Add a foreword |
| `wk add afterword` | Add an afterword |
| `wk add appendix` | Add an appendix |
| `wk add author-note` | Add an author's note |
| `wk remove chapter <number>` | Remove a chapter and renumber remaining |
| `wk remove part <number>` | Remove a part (moves chapters to root) |
| `wk remove author <name>` | Remove an author from the project |
| `wk remove character <name>` | Remove a character sheet |
| `wk remove location <name>` | Remove a worldbuilding entry |
| `wk remove note <name>` | Remove a note |
| `wk remove prologue` | Remove the prologue (and other sections similarly) |
| `wk rename character <old> <new>` | Rename a character — updates file, frontmatter, and all references |
| `wk rename location <old> <new>` | Rename a location — updates file, frontmatter, and all references |
| `wk rename concept <old> <new>` | Rename a concept — updates file, frontmatter, and all references |

### Building your book

| Command | What it does |
|---|---|
| `wk build html` | Build as a web page (best for preview) |
| `wk build epub` | Build as an ePub ebook |
| `wk build pdf` | Build as a PDF document |
| `wk build docx` | Build as a Word document |
| `wk build md` | Build as a single Markdown file (the complete book) |
| `wk build all` | Build all formats at once |
| `wk build` | Build using your preferred formats from config.yaml |
| `wk build clean` | Delete all generated files |

#### Local custom formats

If the built-in formats are not enough, you can add a local format plugin in `formats/` inside your project:

```js
// formats/plaintext.mjs
export default {
  name: "plaintext",
  extension: "txt",
  async build(ctx) {
    return "# " + ctx.config.title + "\n" + ctx.chapters.map((ch) => ch.title).join("\n");
  },
};
```

Then build it with:

```bash
wk build plaintext
```

Local formats can also be listed in `build_formats` in `config.yaml`.

#### External format packages

You can also install a format plugin as an npm package. A package named `writekit-format-latex` makes the format available as `latex`:

```bash
npm install writekit-format-latex
wk build latex
```

The package should export a default plugin object with a `build(ctx)` function. By default, writekit loads the package entrypoint; if needed, the package can override it with `package.json -> writekit.format.entry`.

Format plugins can also expose `configSchema`, and then read their validated options from `format_options.<format>` in `config.yaml`.

### Validating and watching

| Command | What it does |
|---|---|
| `wk check` | Validate your project — checks for missing files, broken YAML, and formatting issues |
| `wk watch` | Watch for changes and rebuild all formats from `build_formats` in config. Reloads config on every change. |
| `wk sync` | Synchronize derived fields — contributor roles, AGENTS.md, reports |
| `wk stats` | Show detailed statistics — word count, reading time, chapter balance, word frequency |

### Themes

Themes control how your book looks in HTML, ePub, and DOCX formats.

| Command | What it does |
|---|---|
| `wk theme list` | See available themes |
| `wk theme use <name>` | Switch to a different theme |
| `wk theme create <name>` | Create your own theme (copies the default as a starting point) |

Writekit ships with two themes:

- **default** — serif, traditional book typography (Georgia, warm brown accents)
- **minimal** — clean sans-serif, modern (Calibri, blue accents)

#### How themes work

The built-in themes live inside the writekit package and cannot be modified. When you run `wk theme create my-theme`, writekit copies the default theme into your project's `themes/my-theme/` folder. You can then edit those files freely.

A theme folder contains:

```
themes/my-theme/
├── theme.yaml      # Name, description, DOCX font/color settings
├── html.css        # Styles for HTML and PDF output
└── epub.css        # Styles for ePub output (simpler CSS)
```

To switch themes: `wk theme use my-theme` (updates config.yaml).

When you update writekit via npm, the built-in themes are refreshed but your custom themes in `themes/` are never touched.

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
| `![alt](assets/img.jpg)` | An image |
| `![alt](assets/img.jpg){width=50%}` | An image with explicit width |
| `Text with a note[^1]` | A footnote reference |
| `[^1]: The footnote text.` | The footnote definition |

All of these work in every output format (HTML, ePub, PDF, Word). Images use local paths relative to the project root (e.g. `assets/photo.jpg`).

### Footnotes

Use the standard Markdown footnote syntax:

```markdown
This claim needs a source[^1]. Another point here[^2].

[^1]: Smith, *On Writing*, 2023.
[^2]: This is a longer note that explains
    the point in more detail.
```

Footnotes are rendered at the bottom of each chapter in HTML/ePub/PDF, and as native Word footnotes in DOCX.

### Images

Place images in `assets/` and reference them in your text:

```markdown
![A sunset over the city](assets/sunset.jpg)
```

To control the width (so images don't overflow the text area):

```markdown
![A sunset](assets/sunset.jpg){width=50%}
```

The image will never exceed the text width regardless of its original size. In all formats, the aspect ratio is preserved.

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

#### Frontmatter fields by file type

**Manuscript chapters** (all types):

| Field | Required | Description |
|---|---|---|
| `title` | yes | Chapter title |
| `chapter` | novel, paper | Chapter number (auto-assigned by `wk add`) |
| `pov` | novel only | Point-of-view character |
| `author` | collection | Per-chapter author (for anthologies with multiple writers) |
| `draft` | no | Draft number (tracked in reports) |

**Front/back matter sections** (prologue.md, epilogue.md, etc.):

| Field | Required | Description |
|---|---|---|
| `title` | no | Custom title (defaults to i18n label, e.g. "Prologo" in Italian) |
| `show_title` | no | Set to `false` to hide the heading (useful for dedication) |
| `toc` | no | Set to `false` to exclude from table of contents |

**Part definition** (part.yaml inside `manuscript/part-NN/`):

| Field | Required | Description |
|---|---|---|
| `title` | yes | Part title (e.g. "The Beginning") |

**Characters** (novel only):

| Field | Required | Description |
|---|---|---|
| `name` | yes | Character name |
| `role` | yes | protagonist, antagonist, supporting, minor |
| `aliases` | no | Alternative names, nicknames |
| `age` | no | Age or age range |
| `relationships` | no | List of relationships |

**World / Locations** (novel only):

| Field | Required | Description |
|---|---|---|
| `name` | yes | Location name |
| `type` | yes | location, culture, system, etc. |

**Contributors** (all types):

| Field | Required | Description |
|---|---|---|
| `name` | yes | Full name |
| `roles` | auto | Auto-derived from config.yaml (author, translator, editor, illustrator) |

The body of a contributor file is their biography, rendered in the "About the Author" section.

**Arguments** (essay only):

| Field | Required | Description |
|---|---|---|
| `claim` | yes | The argument's central claim |
| `related` | no | Related concept names |

**Concepts** (essay, paper):

| Field | Required | Description |
|---|---|---|
| `term` | yes | The term or concept name |
| `related` | no | Related concept/argument names |

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

If you place a `cover.jpg` or `cover.png` in the `assets/` folder, it will automatically appear in all output formats. You can also set `cover: path/to/image` in config.yaml.

### Print presets

The optional `print_preset` field in config.yaml controls page size, margins, and print layout features:

```yaml
print_preset: trade    # 6×9in, US trade paperback
```

| Preset | Size | Page numbers | Running header | Mirror margins | Recto start |
|---|---|---|---|---|---|
| `screen` | A4 | no | no | no | no |
| `a4` | 210×297mm | yes | no | no | no |
| `a5` | 148×210mm | yes | yes | yes | yes |
| `pocket` | 4.25×7in | yes | yes | yes | yes |
| `digest` | 5.5×8.5in | yes | yes | yes | yes |
| `trade` | 6×9in | yes | yes | yes | yes |
| `royal` | 6.14×9.21in | yes | yes | yes | yes |
| `kdp` | 6×9in + bleed | yes | yes | yes | yes |
| `ingramspark` | 6×9in + bleed | yes | yes | yes | yes |
| `lulu` | 6×9in + bleed | yes | yes | yes | yes |

- **Page numbers** — centered in footer (PDF) or in header corners (DOCX)
- **Running header** — DOCX: book title on verso (left), chapter title on recto (right). PDF: book title centered.
- **Mirror margins** — inner margin (gutter) is larger for binding, alternates sides on odd/even pages
- **Recto start** — chapters and parts start on right-hand pages (blank page inserted if needed)

If `print_preset` is omitted, writekit uses the default for the project type:

- `novel`, `collection`, `essay` → `a5`
- `paper` → `a4`

Use `print_preset: screen` when you want a preview-oriented layout with no print features.

For the rare cases where you want a preset as a base but need a small adjustment, you can add `layout` overrides:

```yaml
print_preset: trade

layout:
  running_header: false
  page_numbers: true
  recto_start: true
  margin:
    inner: 24
    outer: 18
```

Supported layout overrides are intentionally limited:

- `page_numbers`
- `running_header`
- `recto_start`
- `margin.inner`
- `margin.outer`

#### Custom print presets

You can extend presets locally or via npm packages:

- local: `presets/<name>.mjs|js|cjs`
- package: `writekit-preset-<name>`

Example local preset:

```js
// presets/roomy.mjs
export default {
  preset: {
    name: "Roomy",
    description: "Large trim with generous inner margin",
    width: 160,
    height: 240,
    margin: { top: 20, bottom: 20, inner: 26, outer: 18 },
    bleed: 3,
    mirrorMargins: true,
    pageNumbers: true,
    runningHeader: true,
    rectoStart: true
  }
};
```

Then in `config.yaml`:

```yaml
print_preset: roomy
```

For the full plugin API, including type hooks and format options, see [PLUGINS.md](./PLUGINS.md).

### Supported languages

The `language` field controls editorial labels ("Table of Contents", "Colophon", etc.) and section titles (prologue, epilogue, etc.).

| Code | Language | Code | Language | Code | Language |
|---|---|---|---|---|---|
| `en` | English | `ru` | Russian | `nl` | Dutch |
| `it` | Italian | `ar` | Arabic | `pl` | Polish |
| `fr` | French | `hi` | Hindi | `tr` | Turkish |
| `de` | German | `zh` | Chinese | `sv` | Swedish |
| `es` | Spanish | `ko` | Korean | `el` | Greek |
| `pt` | Portuguese | `ja` | Japanese | | |

Chinese and Japanese use native numerals for parts and chapters (第一部, 第一章). Korean uses 제1부, 제1장.

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

### Typography

Each project type comes with typographic defaults (paragraph indent, spacing, alignment, etc.). You can override any of them in `style.yaml`:

```yaml
typography:
    paragraph_indent: "0"         # no indent (default for paper)
    paragraph_spacing: 0.5rem     # space between paragraphs
    text_align: left              # left or justify
    line_height: "2.0"            # double spacing
    hyphenation: false            # disable auto-hyphenation
    scene_break: "* * *"          # how --- renders in chapters
    chapter_opening: large        # large, medium, or small top space
    orphans_widows: 3             # min lines at page top/bottom
    chapter_heading: label_number_title   # how chapter titles appear
    part_heading: label_number_title      # how part titles appear
```

Only include the properties you want to change — the rest use the defaults for your project type.

#### Chapter and part heading formats

Control how chapter and part titles are displayed:

| Format | Chapter example | Part example |
|---|---|---|
| `title` (default) | The Arrival | The Beginning |
| `label_number_title` | Chapter 1 / The Arrival | Part I / The Beginning |
| `label_number` | Chapter 1 | Part I |
| `number_title` | 1 / The Arrival | I / The Beginning |
| `number` | 1 | I |

Parts use Roman numerals (I, II, III). For Chinese/Japanese, native numerals are used (第一部, 第一章). For Korean: 제1부, 제1장.

#### Collection per-chapter author

In collection projects, each chapter can have an `author` field in its frontmatter. This author is displayed below the chapter title and in the table of contents — useful for anthologies with multiple contributors.

## Reports

Every time you build, writekit generates reports in `build/reports/`:

- **status.md** — Word count per chapter, total progress, draft numbers
- **cast.md** — Which characters appear in which chapters
- **locations.md** — Which locations appear in which chapters
- **timeline.md** — Your timeline formatted and readable

These are auto-generated and overwritten on every build. Don't edit them.

## License

MIT
