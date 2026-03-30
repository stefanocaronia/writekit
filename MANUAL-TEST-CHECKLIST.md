# Manual Test Checklist

Tests that require **human eyes**. Everything else is automated in `npm test`.

Run `npm test` first to generate projects in `sandbox/int-*`, then inspect the build output.

## Scope

This checklist is intentionally for things automation cannot fully certify:

- Visual rendering and typography
- Reader-specific behavior (browser, Word, Thorium, Calibre, LibreOffice)
- Layout quality judgments (spacing, balance, readability)

What can be preflighted automatically or semi-automatically:

- Existence of generated files in `build/`
- Presence of expected sections/elements in HTML, DOCX XML, or ePub package
- PDF/DOCX page size metadata versus `print_preset`
- Structural clues like section breaks, headers, and page-number fields
- Structural clues like section breaks, headers, page-number fields, and DOCX `mirrorMargins`

Available structural preflight:

- `npm run preflight:layout`
  - Rebuilds temporary DOCX/PDF outputs for key presets
  - Verifies page size metadata for PDF and DOCX
  - Verifies DOCX margins, `mirrorMargins`, presence/absence of headers, page-number fields, and odd-page section breaks
  - Writes a machine-readable report to `tmp/layout-preflight/report.json`
  - Does **not** replace visual review
- `npm run review:layout`
  - Rebuilds a review gallery under `tmp/layout-review/`
  - Flattens outputs into easy-to-browse folders like `pdf/`, `html/`, `docx/`
  - Names files as `project--preset.ext`
  - Also keeps per-case copies under `tmp/layout-review/by-case/`

If a box says something "looks good", it is still a human check even if the underlying file can be inspected programmatically.

## Visual inspection

### HTML — open `sandbox/int-*/build/*.html` in browser
- [x] Cover image looks good (proper size, centered)
- [x] Typography looks like a book (serif, justified, proper spacing)
- [x] Chapter navigation works (click prev/next/TOC)
- [x] Footnote superscripts are clickable and scroll to notes
- [x] Tables have proper column spacing
- [x] Theme "minimal" looks different from "default" (sans-serif, blue, left-aligned)

#### Novel with parts (`sandbox/int-novel-parts/build/*.html`)
- [x] TOC: "Dedica", "Prologo", parts uppercase ("PARTE I — ..."), chapters, "Epilogo"
- [x] Dedication: no heading, just body text (`show_title: false`)
- [x] Prologue/Epilogue: heading in Italian (i18n)
- [x] Part divider page: "Parte I" + title
- [x] Section classes: `section-dedication`, `section-prologue`, `section-epilogue`

### ePub — open `sandbox/int-*/build/*.epub` in Thorium/Calibre
- [x] Title page: large title, centered, author below
- [x] Table of contents navigable via reader
- [x] Chapters render correctly, no XHTML errors
- [x] Footnotes work (tap/click on superscript)
- [x] Images display in chapter

### DOCX — open `sandbox/int-*/build/*.docx` in Word
- [x] Cover image fills first page
- [x] Table of Contents present and updates
- [x] Chapter headings look correct
- [x] Tables fit within margins
- [x] Footnotes as native Word footnotes
- [x] With minimal theme: different font/colors than default

Use **Print Preview** for recto/verso verification. Normal Word layout view can be misleading for inserted blank pages from odd-page section breaks.

#### DOCX pagination (novel, default preset)
- [x] Running header recto: chapter title left, page number right
- [x] Running header verso: page number left, book title right
- [x] No header/footer on cover, title page, TOC
- [x] No Word repair errors on open (field-update prompt may still appear)
- [x] Page size matches `print_preset` (preflight green for `screen` / `a4` / `a5` / `trade` / `kdp`; confirmed in Word on A5)
- [x] Recto start inserts blank pages where needed for print presets (confirmed in Word Print Preview: title page, part pages, and chapter starts land on recto)
- [x] Part opener page feels vertically centered in Word (`Parte I / The Beginning` manually confirmed)
- [x] Inside/outside margins feel correct in a real paginated reader for print presets (confirmed in Word; not applicable to `screen`)

### PDF — run `wk build pdf` in a test project

#### PDF pagination (`sandbox/int-novel/build/*.pdf`)
- [x] Cover fills first page, full bleed, no header/footer
- [x] Page numbers on chapter pages (left corner on verso, right corner on recto)
- [x] Running header: book title on chapter pages
- [x] No header/footer on cover, title page, TOC, colophon, about, part pages
- [x] Mirror margins: gutter side larger (alternates left/right)
- [x] Chapters start on recto (right page), blank page inserted if needed
- [ ] Page size matches `print_preset` (can be preflighted from PDF metadata, then visually confirmed)
- [ ] Try presets: `screen` (no print features), `a5`, `trade`, `kdp`

### Markdown — open `sandbox/int-*/build/*.md`
- [x] Readable structure, minimal separators (only before colophon)
- [x] Images copied to `build/assets/` with rewritten paths
- [x] Author in italic (not bold) under title

## Interactive commands (require terminal)
- [x] `wk init my-test` — prompts for type, title, author, language
- [x] `wk watch` — save a file, rebuilds all config formats, no loop, picks up config changes live
- [x] `wk watch` — save in notes/, verify "Build skipped" message
- [x] `wk stats` — title/author/type header, aligned overview, colored bars, word frequency

## i18n (require visual check of rendered labels)
- [x] `language: it` → "Indice" in HTML TOC (verified in novel-parts)
- [x] `language: it` → "Dedica", "Prologo", "Epilogo" section titles (i18n)
- [ ] `language: fr` → "Table des matières" in HTML TOC

## Preset combinations (require visual check)
- [x] `screen` preset (default): no page numbers, no headers, no mirror, no recto start
- [ ] `a4` preset: page numbers only
- [x] `a5` / book presets: full print layout (page numbers, headers, mirror, recto)
- [ ] `kdp` preset: bleed margins, full print layout

## Suggested workflow

1. Run `npm test` to rebuild `sandbox/`.
2. Run `npm run preflight:layout` for structural preset checks.
3. Run `npm run review:layout` if you want all reviewable outputs collected under `tmp/layout-review/`.
4. Use structural checks first: file exists, format built, page size metadata, presence of headers/TOC/sections.
5. Do the visual pass last in the real target reader.
