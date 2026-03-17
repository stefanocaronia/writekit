# Manual Test Checklist

Tests that require **human eyes**. Everything else is automated in `npm test`.

Run `npm test` first to generate projects in `sandbox/int-*`, then inspect the build output.

## Visual inspection

### HTML — open `sandbox/int-*/build/*.html` in browser
- [ ] Cover image looks good (proper size, centered)
- [ ] Typography looks like a book (serif, justified, proper spacing)
- [ ] Chapter navigation works (click prev/next/TOC)
- [ ] Footnote superscripts are clickable and scroll to notes
- [ ] Tables have proper column spacing
- [ ] Theme "minimal" looks different from "default" (sans-serif, blue, left-aligned)

### ePub — open `sandbox/int-*/build/*.epub` in Thorium/Calibre
- [ ] Title page: large title, centered, author below
- [ ] Table of contents navigable via reader
- [ ] Chapters render correctly, no XHTML errors
- [ ] Footnotes work (tap/click on superscript)
- [ ] Images display in chapter

### DOCX — open `sandbox/int-*/build/*.docx` in Word
- [ ] Cover image fills first page
- [ ] Table of Contents present and updates
- [ ] Chapter headings look correct
- [ ] Tables fit within margins
- [ ] Footnotes as native Word footnotes
- [ ] With minimal theme: different font/colors than default

### PDF — run `wk build pdf` in a test project
- [ ] Page breaks between cover, TOC, chapters, backcover, about, colophon
- [ ] Cover fills first page without margins
- [ ] White background (no beige tint)
- [ ] Page size matches `print_preset`
- [ ] Try presets: `a5`, `trade`, `kdp`

### Markdown — open `sandbox/int-*/build/*.md`
- [ ] Readable structure with clear separators

## Interactive commands (require terminal)
- [ ] `wk init my-test` — prompts for type, title, author, language
- [ ] `wk watch` — save a file, verify live rebuild output
- [ ] `wk watch` — save in notes/, verify "Build skipped" message
- [ ] `wk stats` — colored bars and word frequency display

## i18n (require visual check of rendered labels)
- [ ] `language: it` → "Indice" in HTML TOC
- [ ] `language: fr` → "Table des matières" in HTML TOC
