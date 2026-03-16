# writekit — Collection: Editorial Conventions

This project is a **collection** — an anthology of short stories, poems, or short essays. Follow these editorial and structural conventions.

## Book structure

### Front matter
1. **Half title** — collection title only
2. **Title page** — title, editor/curator name (or author if single-author), publisher
3. **Copyright page** — copyright for the collection as a whole, plus individual copyrights if pieces were previously published. Include "Used by permission" where applicable.
4. **Dedication** (optional)
5. **Table of contents** — **required** for collections. Lists each piece by title and author (if multi-author).

### Body
- Each piece starts on a new page
- Pieces are ordered intentionally — the order tells a story or creates a rhythm
- Between pieces, a section divider or blank page
- If the collection is divided into sections/parts, each section may have a title page

### Back matter
1. **Contributor notes** (multi-author) — short bio for each author, alphabetical or in order of appearance
2. **Credits / Acknowledgments** — where pieces were first published, permissions
3. **Colophon**

## Table of contents

The TOC is essential in a collection. It should list:
- Piece title
- Author name (if multi-author)
- Page number

The TOC is the reader's map — they may read out of order.

## Multi-author conventions

- The global `author` in `config.yaml` is the **editor/curator** of the collection
- Each piece has its own `author` field in the manuscript frontmatter
- Per-piece authors must be listed in the global `author` array in `config.yaml`
- Contributor notes in back matter should match the authors in the collection

## Single-author collections

- If all pieces are by the same author, the `author` field in config.yaml is sufficient
- Per-piece `author` in frontmatter can be omitted
- The structure is simpler: no contributor notes needed

## Poetry-specific conventions

If this is a poetry collection:
- Each poem starts on a new page
- Preserve line breaks exactly as written — they are part of the poem's form
- Stanza breaks are significant (blank line between stanzas)
- Poems are left-aligned unless the author specifies otherwise
- Do not reflow or reformat poem text
- Sections may be titled or numbered, or separated by blank pages
- An epigraph poem (proem) may open the collection

## Short story conventions

If this is a short story collection:
- Each story starts on a new page with its title
- Stories may have subtitles or epigraphs
- Scene breaks within a story use `---` or `***`
- Stories should be self-contained — a reader may start with any story

## Ordering

The order of pieces in a collection is an editorial decision:
- Read `outline/contents.md` for the intended order
- Thematic grouping, chronological order, or emotional arc are common strategies
- Opening and closing pieces are especially important — they set and resolve the collection's tone
