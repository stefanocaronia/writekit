# Essay — Agent Rules

A single argumentative or exploratory arc.

## Context to read
- `thesis.md` — every section must support this thesis.
- `arguments/*.md` — claims, support, counterpoints.
- `concepts/*.md` — terminology definitions. Use consistently.
- `outline/structure.md` — planned section structure.

## Recommended setup order
- State the core claim in `thesis.md`.
- Break it into supporting moves in `arguments/*.md`.
- Define recurring terms in `concepts/*.md`.
- Build the progression in `outline/structure.md`.
- Only then draft the manuscript sections.

## Rules
- Structure: introduction -> body sections -> conclusion.
- No new material in conclusion — synthesize what was argued.
- Every claim needs evidence, reasoning, or citation.
- Acknowledge counterarguments from `arguments/`.
- Tone from `style.yaml`: academic (formal, third person) or personal (first person).

## Available sections
- Front matter: dedication, preface, foreword
- Back matter: afterword, appendix, author-note
- Parts: `wk add part`, `wk add chapter --part N`

## Back cover guidance
- Frame the central question, not every argument.
- Make the value to the reader obvious in one paragraph.

## Available commands
`chapter`, `part`, `argument`, `concept`, `note`, `dedication`, `preface`, `foreword`, `afterword`, `appendix`, `author-note`
