# writekit — Agent Rules

You are working inside a **writekit** project. Read `README.md` for full command reference and syntax.

## Before writing anything

1. Read `config.yaml` — type, title, author, language. Adapt to the type.
2. Read `style.yaml` — POV, tense, tone, voice, rules. Never break these.
3. Read `synopsis.md` — the story/argument summary. Stay aligned.
4. Read the type-specific instructions for your project type.

## Recommended workflow after `wk init`

Populate the project in this order unless the author asks otherwise:

1. `config.yaml` — title, author, language, metadata, build formats, theme, print preset if needed.
2. `style.yaml` — POV, tense, tone, voice, writing rules, typography overrides if explicitly requested.
3. `synopsis.md` — one-page summary of the whole work.
4. Outline files — structure before prose:
   - novel: `outline/plot.md`, `outline/chapters/*.md`
   - collection: `outline/contents.md`
   - essay/paper: `outline/structure.md`
5. Reference/context files:
   - novel: `characters/*.md`, `world/*.md`, `timeline.yaml`
   - essay: `thesis.md`, `arguments/*.md`, `concepts/*.md`
   - paper: `config.yaml` `abstract` and `keywords`, `bibliography.yaml`, `concepts/*.md`
6. Front/back matter if the project needs it.
7. Only then write or revise `manuscript/`.

## Commands

Use `wk` commands. Never create, rename, or move files manually.

```
wk add chapter "Title"           # new chapter
wk add chapter "Title" --part 1  # chapter inside part 1
wk add part "Title"              # new part (manuscript/part-NN/)
wk add prologue                  # front matter section
wk add epilogue                  # back matter section
wk remove chapter 3              # remove + renumber
wk remove part 2                 # moves chapters to root
wk rename character "Old" "New"  # updates everywhere
wk check                         # validate project
wk build                         # generate output
wk stats                         # word count, balance
```

See `README.md` for the full list.

## Do not

- Edit files in `build/` or `build/reports/`
- Edit `contributors/*.md` `roles` field — auto-derived from config.yaml
- Create files manually in `manuscript/` — use `wk add`
- Modify `config.yaml` or `style.yaml` unless explicitly asked
- Invent characters, locations, or plot points without author approval

## Manuscript structure

- Chapters: `manuscript/01-slug.md` (numbered, frontmatter with `title`)
- Parts: `manuscript/part-01/part.yaml` + chapters inside
- Front matter: `dedication.md`, `preface.md`, `foreword.md`, `prologue.md`
- Back matter: `epilogue.md`, `afterword.md`, `appendix.md`, `author-note.md`
- Section titles come from i18n. Custom title via frontmatter `title:`.
- `show_title: false` hides heading in page. `toc: false` excludes from TOC.

### Parts and section workflow

- Create a part with `wk add part "Title"`.
- Add a chapter inside a part with `wk add chapter "Title" --part N`.
- Use parts only for works that need macro-structure; do not create them by habit.
- Front/back matter stays in `manuscript/` root, never inside a part directory.
- If parts exist, numbered root chapters should normally be moved into parts.

## Markdown

- Footnotes: `text[^1]` + `[^1]: Note text.`
- Images: `![alt](assets/img.jpg)` or `![alt](assets/img.jpg){width=50%}`
- Scene breaks: `---` or `***` (never just a blank line)

Use images only when they materially help the work. Keep paths relative to project root, usually `assets/...`.

## Back cover

If the project has `backcover.md`, write it as reader-facing copy, not as a synopsis dump:

- Start with a strong hook.
- Make the promise of the book clear.
- Keep spoilers out.
- Prefer a short blurb or commercial pitch over analytical summary.

## Output structure by type

- Novel / collection / essay: cover -> title page -> TOC -> content -> back cover -> about -> colophon
- Paper: title block -> abstract -> content -> bibliography

Paper projects do not use cover, title page, TOC, back cover, about, or colophon.

## Using `wk stats`

Run `wk stats` when planning or revising:

- Check chapter balance and outliers.
- Check total word count and reading time.
- Use it to spot chapters that are too short, too long, or structurally uneven.
- Treat stats as signals, not as hard rules.

## Workflow

1. Read config + style + synopsis + outline
2. Write or edit content
3. `wk check` — fix any errors
4. `wk build` — verify output
