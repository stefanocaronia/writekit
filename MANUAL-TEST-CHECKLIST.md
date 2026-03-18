# Manual Test Checklist

Tests that require **human eyes**. Everything else is automated in `npm test`.

Run `npm test` first to generate projects in `sandbox/int-*`, then inspect the build output.

## Visual inspection

### HTML — open `sandbox/int-*/build/*.html` in browser
- [x] Cover image looks good (proper size, centered)
- [ ] Typography looks like a book (serif, justified, proper spacing)
- [ ] Chapter navigation works (click prev/next/TOC)
- [ ] Footnote superscripts are clickable and scroll to notes
- [ ] Tables have proper column spacing
- [ ] Theme "minimal" looks different from "default" (sans-serif, blue, left-aligned)

#### Novel with parts (`sandbox/int-novel-parts/build/*.html`)
- [x] TOC: "Dedica", "Prologo", parts uppercase ("PARTE I — ..."), chapters, "Epilogo"
- [x] Dedication: no heading, just body text (`show_title: false`)
- [x] Prologue/Epilogue: heading in Italian (i18n)
- [x] Part divider page: "Parte I" + title
- [x] Section classes: `section-dedication`, `section-prologue`, `section-epilogue`

### ePub — open `sandbox/int-*/build/*.epub` in Thorium/Calibre
- [x] Title page: large title, centered, author below
- [ ] Table of contents navigable via reader
- [ ] Chapters render correctly, no XHTML errors
- [ ] Footnotes work (tap/click on superscript)
- [ ] Images display in chapter

### DOCX — open `sandbox/int-*/build/*.docx` in Word
- [x] Cover image fills first page
- [ ] Table of Contents present and updates
- [ ] Chapter headings look correct
- [ ] Tables fit within margins
- [ ] Footnotes as native Word footnotes
- [ ] With minimal theme: different font/colors than default

#### DOCX pagination (novel, default preset)
- [x] Running header recto: chapter title left, page number right
- [x] Running header verso: page number left, book title right
- [x] No header/footer on cover, title page, TOC
- [x] No Word errors on open (except known footnote warning)

### PDF — run `wk build pdf` in a test project

#### PDF pagination (`sandbox/int-novel/build/*.pdf`)
- [x] Cover fills first page, full bleed, no header/footer
- [x] Page numbers on chapter pages (left corner on verso, right corner on recto)
- [x] Running header: book title on chapter pages
- [x] No header/footer on cover, title page, TOC, colophon, about, part pages
- [x] Mirror margins: gutter side larger (alternates left/right)
- [x] Chapters start on recto (right page), blank page inserted if needed
- [ ] Page size matches `print_preset`
- [ ] Try presets: `screen` (no print features), `a5`, `trade`, `kdp`

### Markdown — open `sandbox/int-*/build/*.md`
- [ ] Readable structure with clear separators

## Interactive commands (require terminal)
- [ ] `wk init my-test` — prompts for type, title, author, language
- [ ] `wk watch` — save a file, verify live rebuild output
- [ ] `wk watch` — save in notes/, verify "Build skipped" message
- [ ] `wk stats` — colored bars and word frequency display

## i18n (require visual check of rendered labels)
- [x] `language: it` → "Indice" in HTML TOC (verified in novel-parts)
- [x] `language: it` → "Dedica", "Prologo", "Epilogo" section titles (i18n)
- [ ] `language: fr` → "Table des matières" in HTML TOC

## Preset combinations (require visual check)
- [x] `screen` preset (default): no page numbers, no headers, no mirror, no recto start
- [ ] `a4` preset: page numbers only
- [x] `a5` / book presets: full print layout (page numbers, headers, mirror, recto)
- [ ] `kdp` preset: bleed margins, full print layout
