# writekit — Agent Instructions

You are working inside a **writekit** project. This is a structured writing framework for books, essays, papers, and articles. Follow these instructions carefully.

## Project structure

Read `config.yaml` first. It contains:
- `type` — the project type (novel, collection, essay, paper, article). Adapt your behavior to this type.
- `title`, `author`, `language` — use these consistently.
- `theme`, `build_formats` — do not modify unless asked.

Read `style.yaml` before writing or reviewing any text. It defines:
- `pov` — point of view (first-person, third-person, omniscient). Never break POV consistency.
- `tense` — narrative tense (past, present). Maintain throughout unless the author specifies a change.
- `tone` — the emotional quality of the writing. Match it.
- `voice` — the narrative voice. Keep it consistent.
- `rules` — specific rules the author has set. Follow them strictly.

## File conventions

- **manuscript/** — the actual text. One Markdown file per chapter/section, numbered `01-slug.md`. Each has YAML frontmatter with at minimum `title` and `draft`.
- **outline/** — the planned structure. Read before writing to understand what each chapter should accomplish.
- **characters/** — character sheets (novel/collection only). Read before writing scenes with those characters. Respect their appearance, personality, voice, and arc.
- **world/** — worldbuilding entries (novel only). Locations, systems, cultures. Be consistent with established facts.
- **timeline.yaml** — chronological events (novel only). Do not contradict the timeline.
- **contributors/** — bios of authors, translators, editors, illustrators. The `roles` field is auto-derived from config.yaml — do not edit it manually. Edit only the bio text.
- **notes/** — free-form material. Read for context but do not modify unless asked.
- **reference/** — external material provided by the author. Read-only.
- **synopsis.md** — the overall summary. Align your writing with it.
- **backcover.md** — the back cover pitch. Helps understand the book's intended audience and angle.
- **assets/cover.{jpg,png}** — cover image, auto-detected and rendered in all build formats. Can also be set explicitly in config.yaml as `cover: path/to/image`.

## Writing rules

1. **Always read `style.yaml` first.** Every writing or editing task must respect POV, tense, tone, and voice.
2. **Read the relevant outline** before writing a chapter. Follow the planned events, characters, and locations.
3. **Read character sheets** before writing dialogue or character actions. Maintain voice consistency per character.
4. **Do not invent new characters, locations, or major plot points** without the author's approval. If the outline doesn't cover something, ask.
5. **Maintain continuity.** Read previous chapters when writing a new one. Do not contradict established facts.
6. **Respect the `draft` field.** A higher draft number means more polished text. Match the refinement level.
7. **Use `wk` commands** — never create files manually. Available commands:
   - `wk add chapter <title>` — add a chapter (manuscript + outline)
   - `wk add character <name>` — add a character sheet (novel only)
   - `wk add location <name>` — add a worldbuilding entry (novel only)
   - `wk add note <title>` — add a note
   - `wk add event <desc>` — add a timeline event (novel only)
   - `wk add author <name>` — add an author (creates contributor sheet)
   - `wk add translator <name>` — add a translator (creates contributor sheet)
   - `wk add editor <name>` — add an editor (creates contributor sheet)
   - `wk add illustrator <name>` — add an illustrator (creates contributor sheet)
   - `wk add source <title>` — add a bibliography source (paper only)
   - `wk remove author <name>` — remove an author
   - `wk remove chapter <number>` — remove a chapter and renumber remaining
   - `wk remove character <name>` — remove a character sheet (novel only)
   - `wk remove location <name>` — remove a worldbuilding entry (novel only)
   - `wk remove note <name>` — remove a note
   - `wk sync` — synchronize derived fields (contributor roles, agents, reports)
   - `wk stats` — show project statistics (word count, reading time, chapter balance)
   - `wk check` — validate the project
   - `wk build [format]` — build output (html, epub, pdf, docx, all)
8. **Do not modify config.yaml, style.yaml, or timeline.yaml** unless explicitly asked. Use `wk add` and `wk remove` commands instead.
9. **For the full command reference**, read the project's `README.md` or `node_modules/writekit/README.md`.

## Per-chapter frontmatter

When a chapter has an `author` field in its frontmatter, that person wrote this piece. In collections, different pieces may have different authors. Respect each author's style if notes are provided.

When a chapter has a `pov` field, it overrides the global POV from style.yaml for that chapter only.

## Validation

Run `wk check` after making changes. It validates:
- Required files and directories exist
- YAML syntax is correct
- Frontmatter has required fields
- Per-chapter authors match global authors
- Naming conventions are followed

Run `wk build` to generate output. Check the reports in `build/reports/` for an overview of the project status.

## Project types

- **novel** — full structure with characters, world, timeline, outline. Think long-form, multi-chapter narrative.
- **collection** — anthology of independent pieces. Each piece may have its own author. No characters or world folders.
- **essay** — single long-form argument. Simple structure, no characters or timeline.
- **paper** — academic work with bibliography. Has `bibliography.yaml` for sources.
- **article** — the simplest structure. Just manuscript and notes.

Adapt your behavior to the type. Do not suggest creating characters for an essay, or a bibliography for a novel.

**Read the type-specific instructions** for additional guidelines:
- Novel: `node_modules/writekit/agents/types/novel.md`
- Collection: `node_modules/writekit/agents/types/collection.md`
- Essay: `node_modules/writekit/agents/types/essay.md`
- Paper: `node_modules/writekit/agents/types/paper.md`
- Article: `node_modules/writekit/agents/types/article.md`

Read only the file matching the `type` field in `config.yaml`.
