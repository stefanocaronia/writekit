# Collection — Agent Rules

Each piece may have its own `author` in frontmatter — shown in TOC and heading.

## Context to read
- `outline/contents.md` — intended order of pieces.
- `contributors/*.md` — bios for multi-author collections.

## Recommended setup order
- Define the sequence in `outline/contents.md`.
- Decide whether pieces are single-author or multi-author.
- If pieces have different authors, ensure each author exists in `config.yaml` and `contributors/`.
- Write the strongest opening and closing pieces first; they frame the collection.

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

## Back cover guidance
- Describe the collection's theme, range, or unifying thread.
- For anthologies, mention the editorial angle rather than summarizing each piece.

## Available commands
`chapter`, `part`, `note`, `dedication`, `preface`, `foreword`, `afterword`, `appendix`, `author-note`
