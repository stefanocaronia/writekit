# Collection — Agent Rules

Each piece may have its own `author` in frontmatter — shown in TOC and heading.

## Context to read
- `outline/contents.md` — intended order of pieces.
- `contributors/*.md` — bios for multi-author collections.

## Rules
- Global `author` in config.yaml is the editor/curator.
- Per-piece authors must also be in the global `author` array.
- Each piece is self-contained — a reader may start anywhere.
- For poetry: preserve line breaks exactly (they are part of the form).
- For short stories: each is independent, scene breaks with `---`.
- Order matters — opening and closing pieces set and resolve the tone.

## Available sections
- Front matter: dedication, preface, foreword
- Back matter: afterword, appendix, author-note
- Parts: `wk add part`, `wk add chapter --part N`

## Available commands
`chapter`, `part`, `note`, `dedication`, `preface`, `foreword`, `afterword`, `appendix`, `author-note`
