# writekit — Novel: Editorial Conventions

This project is a **novel** (or novella, long-form fiction). Follow these editorial and structural conventions.

## Book structure

A published novel follows this standard order:

### Front matter
1. **Half title** — just the title, no author, no subtitle
2. **Title page** — title, subtitle, author(s), publisher
3. **Copyright page** (verso of title page) — copyright notice, ISBN, edition, legal disclaimers, credits
4. **Dedication** (optional)
5. **Epigraph** (optional) — a quote that sets the tone
6. **Table of contents** (optional for fiction, common for non-fiction)
7. **Foreword / Preface / Introduction** (optional)

Front matter pages use lowercase Roman numerals (i, ii, iii).

### Body
- Chapters, numbered or titled or both
- Each chapter traditionally starts on a new page (recto/right page in print)
- Parts or sections may group chapters (Part I, Part II)
- Scene breaks within chapters are marked with a blank line or ornamental break (*** or ⁂)

### Back matter
1. **Epilogue** (optional)
2. **Afterword / Author's note** (optional)
3. **Acknowledgments**
4. **Glossary** (if the novel uses invented terms)
5. **Colophon** — production details (fonts, tools used)

Back matter uses Arabic page numbers continuing from the body.

## Chapter conventions

- Chapter titles should be consistent in style (all numbered, all titled, or both)
- The first paragraph of a chapter traditionally has no indent
- Subsequent paragraphs are indented (first-line indent, no extra spacing between paragraphs)
- Scene breaks are **not** just empty lines — use `---` or `***` to make them explicit and visible in all formats

## Manuscript conventions

- One file per chapter in `manuscript/`, numbered `01-slug.md`, `02-slug.md`
- Chapter order is determined by filename sort order
- Keep chapter files focused — avoid putting multiple chapters in one file

## Characters and world

- Read all files in `characters/` before writing scenes. Maintain consistency in appearance, voice, personality, and arc.
- Read `world/` entries before describing locations. Do not contradict established geography or rules.
- Do not introduce named characters without checking if they already exist in `characters/`.

## Timeline and continuity

- Read `timeline.yaml` for the chronological order of events
- When writing chapter N, be aware of what happened in chapters 1 through N-1
- If a character is in a specific location at a specific time, they cannot be elsewhere simultaneously without explanation
- Track character states: alive/dead, injured/healed, knowledge gained, relationships changed

## Dialogue

- Dialogue formatting depends on language and `style.yaml`:
  - English: "Double quotes" for speech, 'single quotes' for quotes within speech
  - Italian/French: «Guillemets» or em-dash (—) for speech
  - Keep dialogue tags simple (said, asked) unless the style demands otherwise
- Each character should have a distinct voice consistent with their character sheet
