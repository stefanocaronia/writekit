---
project: writekit
version: 0.2.0
last_updated: 2026-03-16
status: v0.2 complete, npm publish pending
last_published_npm: 0.1.0
types_planned: [novel, collection, essay, paper, article]
---

# writekit — Roadmap

## Context

writekit è un CLI Node.js/TypeScript per creare testi strutturati (romanzi, saggi, paper, articoli, raccolte, poesia). Stato attuale: v0.1 funzionante con scaffolding, validazione, build 4 formati (HTML, ePub, PDF, DOCX), watcher, comandi add, sistema temi, report auto-generati.

---

## v0.1.0 — Rilascio iniziale

- [x] **Rename repo GitHub** — novel-maker → writekit
- [x] **Test suite minima** — 15 smoke test (vitest), tutti i comandi coperti
- [x] **npm publish prep** — `npm pack` verificato, temi inclusi, 43 file
- [x] **CI** — GitHub Actions `.github/workflows/ci.yml`: build + test su push/PR. Publish manuale via `npm publish`
- [x] **Markdown completo in tutti i formati** — blockquote, tabelle, liste ol/ul, codice, grassetto/corsivo, link, hr in HTML, ePub, PDF, DOCX
- [x] **Code review SOLID** — UUID fixato (crypto.randomUUID), duplicazioni eliminate, regex YAML rimosso, cast type rimosso
- [x] **README.md del package** — scritto per scrittori non tecnici, include guida markdown e configurazione
- [x] **Doc: workflow di esempio** — nel README: deploy HTML su GitHub Pages, allegare ePub a GitHub Release
- [x] **LICENSE** — MIT (Stefano Caronia)

---

## v0.2.0 — Project Types

Supporto per diversi tipi di testo. Il tipo si sceglie alla creazione (`wk init my-essay --type essay`).

### Tipi

| Tipo | Cartelle extra oltre il core | Note |
|---|---|---|
| **novel** (default) | characters/, world/, outline/, timeline.yaml | Struttura completa |
| **collection** | outline/ | Racconti, poesie, saggi brevi. Più autori possibili |
| **essay** | outline/ | Saggio singolo |
| **paper** | outline/, bibliography.yaml | Accademico |
| **article** | — (solo core) | Il più snello |

> **poetry** rimossa come tipo: una raccolta di poesie usa `collection`.

### Core condiviso (tutti i tipi)

- config.yaml, style.yaml, synopsis.md, backcover.md
- manuscript/, notes/, reference/, assets/, contributors/, build/

### Impatto sul codice

- [x] **Campo `type` in config.yaml** — determina scaffolding, validazione, comandi disponibili
- [x] **Init per tipo** — `wk init` chiede il tipo (o `--type` flag)
- [x] **Check per tipo** — il validator legge schemas dal type.yaml, valida solo dirs/files del tipo
- [x] **Add per tipo** — `wk add character` bloccato su essay/paper/article
- [x] **Reports per tipo** — ogni tipo definisce quali report generare (novel: tutti, essay: solo status)
- [x] **Tipi modulari** — ogni tipo in `src/types/{type}/type.yaml` con dirs, files, schemas, reports, add_commands, sample_files
- [x] **Frontmatter schemas per tipo** — required/optional fields definiti nel type.yaml, non hardcoded
- [x] **Autori multipli** — config.yaml `author` accetta stringa o array. `wk add author` / `wk remove author`. Per-chapter author nel frontmatter. Cross-validation nel check. formatAuthors() in tutti i formati di build. Metadati Word nel DOCX.
- [x] **bibliography.yaml** — `wk add source` per paper. Schema: author, title, year, url.
- [x] **Agent instructions** — `AGENTS.md` generato all'init, rigenerato al build/watch. Istruzioni embedded in `node_modules/writekit/agents/` con file per tipo.
- [x] **i18n label** — 17 lingue (it, en, fr, de, es, pt, ru, ar, hi, zh, ko, ja, nl, pl, tr, sv, el). Label editoriali in html, epub, docx, metadata.
- [x] **Secondo tema builtin** — "minimal" (sans-serif, modern, system-ui)
- [x] **Test per tutti i tipi** — 46 smoke test, copertura essay/paper/article/collection

- [x] **contributors/** — cartella nel core di tutti i tipi. Schede con bio, roles auto-derivati dal config. Check bidirezionale config ↔ contributors.
- [x] **backcover.md** — quarta di copertina nel core di tutti i tipi.
- [x] **`wk sync`** — sincronizza campi derivati (roles, AGENTS.md, report). Chiamato automaticamente da build e check.
- [x] **`wk add translator/editor/illustrator`** — crea scheda contributors + aggiorna config.
- [x] **Validazione lingua** — check avvisa se lingua non supportata per i18n.

### Ancora da fare per v0.2

- [x] **Build genera pagina "About the Author(s)"** — dal contenuto di contributors/, resa in tutti i formati (HTML, ePub, PDF, DOCX). Nomi in grassetto, bio sotto.
- [x] **Build genera quarta di copertina** — da backcover.md, resa in HTML e ePub.

---

## v0.3.0 — Raffinamento

- [x] **Strutture dati per tipo** — essay: thesis.md, arguments/, concepts/. Paper: abstract.md, concepts/. `wk add concept`, `wk add argument`. Schema e sample files per tipo.
- [x] **Immagini nel manuscript** — `![alt](path)` in HTML (base64), ePub (zip), PDF (via HTML), DOCX (ImageRun). Path relativi al progetto.
- [ ] **DOCX template custom** — da rifare con approccio diverso. `externalStyles` della libreria docx non funziona. Serve aprire il .docx come zip e sostituire document.xml mantenendo styles/fonts/settings del template.
- [x] **DOCX Table of Contents** — campo TOC generato dai Heading 1 (capitoli), Word lo aggiorna all'apertura. Posizionato dopo la title page.
- [x] **DOCX temi** — font/colori dal tema attivo via docx settings in theme.yaml
- [x] **Doc temi nel README** — workflow completo documentato: builtin vs custom, struttura cartella tema, DOCX style priority chain
- [x] **Footnotes** — sintassi Pandoc/MultiMarkdown via marked-footnote. HTML/ePub/PDF con CSS, DOCX con FootnoteReferenceRun nativo Word.
- [x] **PDF configurabile + print presets** — 9 preset (a4, a5, pocket, digest, trade, royal, kdp, ingramspark, lulu). Ogni preset ha dimensioni, margini e bleed specifici. Config: `print_preset: trade`. Validazione nel check.
- [ ] **DOCX template utente** — dipende da DOCX template custom
- [x] **Incremental build nel watch** — skip build se il file cambiato non è content (notes, characters, ecc.). Build solo su manuscript, config, style, assets, contributors.
- [x] **`wk stats`** — statistiche dettagliate (parole, reading time, frequenza, bilancio capitoli)
- [x] **`wk remove`** — remove chapter (con rinumerazione), character, location, note, author. Type-aware: derivato da add_commands escludendo yaml-only (event, source). Sync rinumera capitoli automaticamente.
- [x] **`wk rename character/location/concept`** — rinomina file, aggiorna frontmatter, cerca/sostituisce in manuscript e outline. Type-aware.
- [x] **`wk build md`** — quinto formato di output: libro completo in un singolo Markdown (copertina, indice, capitoli, quarta, about, colophon).
- [x] **Copertina** — immagine da `assets/cover.{jpg,png}` resa in tutti i formati: HTML (hero image), ePub (cover page), PDF (prima pagina), DOCX (prima pagina con immagine). Configurabile in config.yaml: `cover: assets/cover.jpg`

---

## v0.4.0 — Analisi e intelligenza

- [ ] **Convenzioni editoriali per tipo** — vedi sezione dedicata sotto
- [ ] **Cross-reference validation** — personaggi/locations nel frontmatter esistono davvero?
- [ ] **Grafo relazioni** — report relazioni personaggi
- [ ] **Timeline validation** — ordine cronologico vs ordine capitoli
- [ ] **Draft tracking** — stato draft per capitolo
- [ ] **Changelog automatico** — diff tra build

---

## v0.5.0 — Estensioni

- [ ] **Plugin system** — hook pre/post build
- [ ] **Export Markdown singolo** — tutto il progetto (sorgenti + metadata) in un .md strutturato, utile per dare contesto completo a un LLM
- [ ] **Import da Markdown** — splitta un .md in capitoli
- [ ] **Font embedding** — woff2/ttf in HTML e ePub
- [ ] **Backup command** — `wk backup` crea zip del progetto

---

## Architettura

### File critici
- Comandi: `src/commands/*.ts`
- Build: `src/lib/html.ts`, `src/lib/epub.ts`, `src/lib/pdf.ts`, `src/lib/docx.ts`
- Validazione: `src/commands/check.ts`, `src/lib/schema.ts`
- Report: `src/lib/reports.ts`
- Temi: `src/lib/theme.ts`, `src/themes/*/`
- Tipi: `src/lib/project-type.ts`, `src/types/*/type.yaml`
- Parsing: `src/lib/parse.ts`, `src/lib/metadata.ts`

### Utility condivise
- `src/lib/fs-utils.ts` — fileExists, dirExists, assertProject, frontmatter, bookFilename
- `src/lib/metadata.ts` — buildColophonLines
- `src/lib/slug.ts` — slugify, padNumber
- `src/lib/ui.ts` — colori e icone
- `src/lib/schema.ts` — validateData (config, style, timeline)
- `src/lib/project-type.ts` — loadType, isValidType, allTypeNames

---

## Editorial Conventions — Design Document

### Problem

Ogni tipo di testo ha convenzioni tipografiche diverse (indentazione, spaziatura, allineamento, ecc.) che oggi sono hardcoded nel CSS dei temi e nel builder DOCX. Non c'è modo di:
1. Differenziare le convenzioni per tipo (novel vs paper vs article)
2. Permettere all'utente di sovrascriverle

### Convenzioni per tipo

| Proprietà | novel | collection | essay | paper | article |
|---|---|---|---|---|---|
| `paragraph_indent` | `1.5rem` | `1.5rem` | `1.5rem` | `0` | `0` |
| `paragraph_spacing` | `0` | `0` | `0` | `0.5rem` | `0.3rem` |
| `text_align` | `justify` | `justify` | `justify` | `justify` | `left` |
| `first_paragraph_indent` | `false` | `false` | `false` | `false` | `false` |
| `heading_style` | `serif` | `serif` | `serif` | `bold` | `bold` |
| `blockquote_style` | `italic` | `italic` | `italic` | `indent` | `indent` |
| `scene_break` | `* * *` | `* * *` | `---` | `---` | `---` |
| `chapter_opening` | `large` | `large` | `medium` | `small` | `small` |
| `line_height` | `1.6` | `1.6` | `1.6` | `2.0` | `1.5` |
| `hyphenation` | `true` | `true` | `true` | `true` | `false` |
| `orphans_widows` | `2` | `2` | `2` | `3` | `2` |

> `first_paragraph_indent: false` = il primo paragrafo dopo un heading non ha indent (standard tipografico universale).
> `chapter_opening`: `large` = ~40% pagina vuota prima del titolo, `medium` = ~25%, `small` = solo margine normale.
> `scene_break`: come viene renderizzato `---` o `***` nel markdown quando usato come separatore di scena.
> `orphans_widows`: minimo righe che devono stare in fondo (orphans) e in cima (widows) a una pagina.

### Catena di priorità

```
type.yaml (default per tipo)
    ↓ override
style.yaml (utente, campo `typography:`)
    ↓ applicato da
tema CSS (classi per ogni variante)
builder DOCX (stili programmatici)
```

### Implementazione

#### 1. Type definitions (`src/types/*/type.yaml`)

Ogni tipo aggiunge una sezione `typography:`:

```yaml
# In novel/type.yaml
typography:
    paragraph_indent: 1.5rem
    paragraph_spacing: 0
    text_align: justify
    first_paragraph_indent: false
    heading_style: serif
    blockquote_style: italic
```

#### 2. Style override (`style.yaml` nel progetto utente)

L'utente può sovrascrivere singole proprietà:

```yaml
# In style.yaml
pov: third-person
tense: past
typography:
    paragraph_spacing: 0.3rem    # override solo questo
```

#### 3. Loader (`src/lib/typography.ts`)

Nuovo modulo che:
- Carica typography dal type.yaml
- Merge con override da style.yaml
- Espone un oggetto `Typography` con tutte le proprietà risolte

```typescript
interface Typography {
    paragraphIndent: string;      // "1.5rem" | "0"
    paragraphSpacing: string;     // "0" | "0.5rem"
    textAlign: string;            // "justify" | "left"
    firstParagraphIndent: boolean; // false = no indent after heading
    headingStyle: string;         // "serif" | "bold"
    blockquoteStyle: string;      // "italic" | "indent"
    sceneBreak: string;           // "* * *" | "---"
    chapterOpening: string;       // "large" | "medium" | "small"
    lineHeight: string;           // "1.6" | "2.0"
    hyphenation: boolean;         // true | false
    orphansWidows: number;        // 2 | 3
}

function loadTypography(projectDir: string): Promise<Typography>;
```

#### 4. CSS (`src/themes/*/html.css` e `epub.css`)

I temi hanno classi per ogni variante. Il builder HTML inietta la classe giusta su `<body>`:

```html
<body class="typo-indent typo-justify typo-no-first-indent">
```

CSS:
```css
/* Paragraph */
.typo-indent .chapter p + p { text-indent: 1.5rem; }
.typo-no-indent .chapter p + p { text-indent: 0; }
.typo-spacing .chapter p { margin-bottom: 0.5rem; }
.typo-no-spacing .chapter p { margin-bottom: 0; }
.typo-justify .chapter p { text-align: justify; hyphens: auto; }
.typo-left .chapter p { text-align: left; hyphens: none; }
/* Chapter opening */
.typo-opening-large .chapter { padding-top: 40vh; }
.typo-opening-medium .chapter { padding-top: 25vh; }
.typo-opening-small .chapter { padding-top: 2rem; }
/* Scene breaks */
.typo-scene-stars .chapter hr::after { content: "* * *"; }
.typo-scene-dash .chapter hr { border-top: 1px solid #ccc; }
/* Line height */
body { line-height: var(--line-height, 1.6); }
/* Orphans/widows */
.chapter p { orphans: var(--orphans, 2); widows: var(--widows, 2); }
```

#### 5. DOCX builder (`src/lib/docx.ts`)

Legge `Typography` e applica:
- `paragraphIndent` → `indent.firstLine`
- `paragraphSpacing` → `spacing.after`
- `textAlign` → `alignment`

#### 6. PDF

Ereditato dall'HTML (CSS classi).

#### 7. ePub

Stesse classi CSS dell'HTML, iniettate nel body dei capitoli.

### File da modificare

1. `src/types/*/type.yaml` — aggiungere `typography:` a tutti i 5 tipi
2. `src/lib/typography.ts` — nuovo modulo loader/merger
3. `src/lib/html.ts` — iniettare classi su body
4. `src/lib/epub.ts` — iniettare classi su body capitoli
5. `src/lib/docx.ts` — leggere typography e applicare
6. `src/lib/md.ts` — non impattato (è testo puro)
7. `src/themes/*/html.css` — aggiungere classi typo-*
8. `src/themes/*/epub.css` — aggiungere classi typo-*
9. `src/lib/parse.ts` — caricare typography da style.yaml
10. `src/commands/check.ts` — validare campi typography

### Ordine di implementazione

1. Definire l'interfaccia `Typography` e i default per tipo
2. Creare il loader che merge type + style
3. Aggiornare HTML builder per iniettare classi
4. Aggiornare CSS temi con tutte le classi varianti
5. Aggiornare DOCX builder
6. Aggiornare ePub builder
7. Aggiornare check per validare
8. Test

---

### Pre-release checklist

For every new feature, command, or structural change, verify ALL of the following:

- [ ] **Type definitions** — `src/types/*/type.yaml` updated (dirs, files, schemas, add_commands, reports, sample_files)
- [ ] **Init** — `src/commands/init.ts` generates new files/dirs, README tree includes them
- [ ] **Add** — `src/commands/add.ts` new subcommand if needed, registered in parent
- [ ] **Remove** — `src/commands/remove.ts` updated if reversible
- [ ] **Check** — `src/commands/check.ts` validates new files/fields/cross-references
- [ ] **Sync** — `src/commands/sync.ts` handles any new derived fields
- [ ] **Build** — `src/lib/html.ts`, `epub.ts`, `pdf.ts`, `docx.ts` render new content if applicable
- [ ] **Watch** — `src/commands/watch.ts` picks up new file patterns if needed
- [ ] **Schema** — `src/lib/schema.ts` updated for new config/style/timeline fields
- [ ] **i18n** — `src/lib/i18n.ts` new labels added if there are new rendered strings
- [ ] **Reports** — `src/lib/reports.ts` includes new data in relevant reports
- [ ] **Agent instructions** — `src/agents/instructions.md` and `src/agents/types/*.md` updated
- [ ] **CLI registration** — `src/cli.ts` imports and registers new commands
- [ ] **README.md** — package README updated (commands table, project structure, features)
- [ ] **Tests** — `test/smoke.test.ts` covers the new feature
- [ ] **Build passes** — `npm run build` no errors
- [ ] **Tests pass** — `npm test` all green
- [ ] **PLAN.md** — feature marked as done, new ideas captured
- [ ] **Pre-release checklist** — update this Pre-release checklist
