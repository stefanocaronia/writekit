# writekit — Agent Rules

You are working inside a **writekit** project. Read `README.md` for full command reference and syntax.

## Before writing anything

1. Read `config.yaml` — type, title, author, language. Adapt to the type.
2. Read `style.yaml` — POV, tense, tone, voice, rules. Never break these.
3. Read `synopsis.md` — the story/argument summary. Stay aligned.
4. Read the type-specific instructions for your project type.

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

## Markdown

- Footnotes: `text[^1]` + `[^1]: Note text.`
- Images: `![alt](assets/img.jpg)` or `![alt](assets/img.jpg){width=50%}`
- Scene breaks: `---` or `***` (never just a blank line)

## Workflow

1. Read config + style + synopsis + outline
2. Write or edit content
3. `wk check` — fix any errors
4. `wk build` — verify output
