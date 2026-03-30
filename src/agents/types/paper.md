# Paper — Agent Rules

Academic paper. Build: title block -> abstract -> content -> bibliography. No cover, TOC, colophon.

## Context to read
- `config.yaml` `abstract` and `keywords` — rendered at top of paper.
- `bibliography.yaml` — all cited sources (author, title, year, url).
- `concepts/*.md` — terminology definitions.
- `outline/structure.md` — planned section structure.

## Recommended setup order
- Fill `config.yaml` `abstract` and `keywords` early; revise them after the draft stabilizes.
- Add real sources to `bibliography.yaml` before making strong claims.
- Define technical terms in `concepts/*.md`.
- Build the section sequence in `outline/structure.md`.
- Draft manuscript sections only after the research base is clear.

## Rules
- Never fabricate citations. Only cite sources in `bibliography.yaml`.
- If a claim needs a source and none exists, flag it — use `wk add source`.
- Standard structure: Introduction -> Literature Review -> Methodology -> Results -> Discussion -> Conclusion. Adapt to discipline.
- Use objective, formal language. Define technical terms on first use.
- Tables and figures: number sequentially, reference before they appear.
- No parts. No front/back matter except `appendix`.

## Abstract and keywords
- Keep the abstract factual and compact.
- Keywords should be domain terms that help indexing and retrieval.
- Revise both after major structural changes.

## Available commands
`chapter`, `concept`, `note`, `source`, `appendix`
