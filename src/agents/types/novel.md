# Novel — Agent Rules

Read `characters/`, `world/`, `outline/`, `timeline.yaml` before writing.

## Context to read
- `characters/*.md` — name, role, aliases, relationships, voice. Maintain consistency.
- `world/*.md` — locations, cultures, systems. Do not contradict.
- `outline/plot.md` — overall arc. `outline/chapters/*.md` — per-chapter plan.
- `timeline.yaml` — chronological events. Do not contradict.

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

## Available commands
`chapter`, `part`, `character`, `location`, `note`, `event`, `dedication`, `preface`, `foreword`, `prologue`, `epilogue`, `afterword`, `appendix`, `author-note`
