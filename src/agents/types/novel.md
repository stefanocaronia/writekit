# Novel — Agent Rules

Read `characters/`, `world/`, `outline/`, `timeline.yaml` before writing.

## Context to read
- `characters/*.md` — name, role, aliases, relationships, voice. Maintain consistency.
- `world/*.md` — locations, cultures, systems. Do not contradict.
- `outline/plot.md` — overall arc. `outline/chapters/*.md` — per-chapter plan.
- `timeline.yaml` — chronological events. Do not contradict.

## Recommended setup order
- Define the arc in `outline/plot.md`.
- Sketch chapter intent in `outline/chapters/*.md`.
- Fill key `characters/*.md` and essential `world/*.md` before drafting long scenes.
- Use `timeline.yaml` for chronology-heavy plots.
- Write `backcover.md` only after the book's core premise is stable.

## Rules
- Track character states across chapters (alive/dead, knowledge, location).
- Scene breaks: `---` or `***` (configured as `scene_break` in typography).
- Dialogue style depends on language (EN: "quotes", IT: guillemets or em-dash).
- Each character should have a distinct voice per their character sheet.
- Do not introduce named characters without checking `characters/`.

## Available sections
- Front matter: dedication, preface, foreword, prologue
- Back matter: epilogue, afterword, appendix, author-note
- Parts: `wk add part`, `wk add chapter --part N`

## Back cover guidance
- Sell the premise, tension, and voice.
- Do not explain the full plot.
- A short hook + one focused paragraph is usually enough.

## Available commands
`chapter`, `part`, `character`, `location`, `note`, `event`, `dedication`, `preface`, `foreword`, `prologue`, `epilogue`, `afterword`, `appendix`, `author-note`
