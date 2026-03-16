# Manual Test Checklist

Tests that require human inspection. Run integration tests first (`npx vitest run test/integration.test.ts`) to generate projects in `sandbox/int-*`.

## Visual inspection per format

### HTML (`sandbox/int-*/build/*.html`)
- [ ] Open each in browser
- [ ] Cover image displays (if present in assets/)
- [ ] Title page: title, subtitle, author(s) correct
- [ ] Table of contents links work (click and scroll)
- [ ] Chapter headings render correctly
- [ ] **Bold**, *italic*, `code`, blockquotes, lists, tables render
- [ ] Footnotes: superscript links in text, footnote section at bottom
- [ ] Back cover text present
- [ ] About the Author(s) section: names bold, bios below
- [ ] Colophon: copyright, license, publisher info
- [ ] Chapter navigation (prev/next) works
- [ ] Theme "default": serif font, brown accents, justified text
- [ ] Theme "minimal": sans-serif, blue accents, left-aligned

### ePub (`sandbox/int-*/build/*.epub`)
- [ ] Open in Thorium Reader or Calibre
- [ ] Cover page displays (if cover image present)
- [ ] Title page renders
- [ ] Table of contents navigable
- [ ] Chapters render correctly with formatting
- [ ] Footnotes work (tap/click)
- [ ] Back cover and About the Author(s) present
- [ ] Colophon present
- [ ] Images display (if any in manuscript)

### DOCX (`sandbox/int-*/build/*.docx`)
- [ ] Open in Word or LibreOffice
- [ ] Cover image page (if present)
- [ ] Title page: title, subtitle, author centered
- [ ] Table of Contents present (Word prompts to update)
- [ ] Chapter headings use Heading 1 style
- [ ] Text formatting: bold, italic, code, blockquotes, lists, tables
- [ ] Footnotes appear as native Word footnotes (hover/click)
- [ ] Back cover text present
- [ ] About the Author(s) section present
- [ ] Colophon present
- [ ] With default theme: Georgia font, brown accents
- [ ] With minimal theme: Calibri font, blue accents
- [ ] **Template override**: place a `template.docx` in `assets/`, rebuild, verify styles change

### PDF (requires Chrome/Edge)
- [ ] Run `wk build pdf` in a test project
- [ ] Open PDF — verify page size matches `print_preset`
- [ ] All content from HTML appears in PDF
- [ ] Margins look correct
- [ ] Try different presets: `a4`, `a5`, `trade`, `kdp`

### Markdown (`sandbox/int-*/build/*.md`)
- [ ] Open in any editor
- [ ] Title and author at top
- [ ] Table of contents with chapter list
- [ ] All chapters present with `---` separators
- [ ] Back cover text present
- [ ] About the Author(s) present
- [ ] Colophon at bottom

## Type-specific checks

### Novel (`sandbox/int-novel/`)
- [ ] Characters folder has populated sheets with aliases
- [ ] World folder has locations
- [ ] Timeline.yaml has events
- [ ] Outline/chapters has per-chapter outlines
- [ ] Reports: status.md, cast.md, locations.md, timeline.md all populated

### Essay (`sandbox/int-essay/`)
- [ ] thesis.md present
- [ ] arguments/ folder has argument sheets
- [ ] concepts/ folder has concept sheets
- [ ] Reports: only status.md (no cast, locations, timeline)

### Paper (`sandbox/int-paper/`)
- [ ] abstract.md present
- [ ] bibliography.yaml has sources
- [ ] concepts/ folder has concept sheets
- [ ] Multiple authors in config and contributors/

### Article (`sandbox/int-article/`)
- [ ] Simplest structure — no outline, characters, world
- [ ] Only manuscript/ and notes/

### Collection (`sandbox/int-collection/`)
- [ ] Multiple authors in config
- [ ] Per-piece author in manuscript frontmatter
- [ ] Contributors with individual bios
- [ ] HTML shows all author names
- [ ] About the Author(s) lists all contributors

## Commands to test manually

- [ ] `wk init my-test` — interactive prompts work (type, title, author, language)
- [ ] `wk watch` — save a file, verify rebuild triggers with colored output
- [ ] `wk watch` — save a file in notes/, verify "Build skipped" message
- [ ] `wk theme create my-theme` — creates themes/my-theme/ with all files
- [ ] `wk theme use my-theme` — updates config.yaml
- [ ] `wk theme list` — shows both builtin and custom themes
- [ ] `wk sync` — run after manual edits, verify roles and numbering updated
- [ ] `wk stats` — verify colored output with bars and word frequency

## i18n check
- [ ] Create a project with `language: it` — verify "Indice", "Colofone" in HTML
- [ ] Create a project with `language: fr` — verify "Table des matières" in HTML
- [ ] Create a project with `language: ja` — verify Japanese labels in HTML

## Edge cases
- [ ] Chapter with special characters in title: `wk add chapter "L'été à Paris"`
- [ ] Character with accented name: `wk add character "José García"`
- [ ] Build with 0 chapters — should show warning, not crash
- [ ] Build with empty manuscript file — should handle gracefully
- [ ] `wk remove chapter 99` — should show error, not crash
- [ ] `wk rename character "NonExistent" "New"` — should show error
- [ ] Unsupported language in config — check should warn
- [ ] Invalid theme name in config — check should error
- [ ] Invalid print_preset in config — check should error
