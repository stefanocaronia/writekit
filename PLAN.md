---
project: writekit
version: 0.2.0
last_updated: 2026-03-18
status: v0.4 in progress, npm publish pending
last_published_npm: 0.1.0
types_planned: [novel, collection, essay, paper]
---

# writekit — Roadmap

## Context

writekit è un CLI Node.js/TypeScript per creare testi strutturati (romanzi, saggi, paper, raccolte, poesia). Stato attuale: v0.1 funzionante con scaffolding, validazione, build 4 formati (HTML, ePub, PDF, DOCX), watcher, comandi add, sistema temi, report auto-generati.

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

> **poetry** rimossa come tipo: una raccolta di poesie usa `collection`.

### Core condiviso (tutti i tipi)

- config.yaml, style.yaml, synopsis.md, backcover.md
- manuscript/, notes/, reference/, assets/, contributors/, build/

### Impatto sul codice

- [x] **Campo `type` in config.yaml** — determina scaffolding, validazione, comandi disponibili
- [x] **Init per tipo** — `wk init` chiede il tipo (o `--type` flag)
- [x] **Check per tipo** — il validator legge schemas dal type.yaml, valida solo dirs/files del tipo
- [x] **Add per tipo** — `wk add character` bloccato su essay/paper
- [x] **Reports per tipo** — ogni tipo definisce quali report generare (novel: tutti, essay: solo status)
- [x] **Tipi modulari** — ogni tipo in `src/types/{type}/type.yaml` con dirs, files, schemas, reports, add_commands, sample_files
- [x] **Frontmatter schemas per tipo** — required/optional fields definiti nel type.yaml, non hardcoded
- [x] **Autori multipli** — config.yaml `author` accetta stringa o array. `wk add author` / `wk remove author`. Per-chapter author nel frontmatter. Cross-validation nel check. formatAuthors() in tutti i formati di build. Metadati Word nel DOCX.
- [x] **bibliography.yaml** — `wk add source` per paper. Schema: author, title, year, url.
- [x] **Agent instructions** — `AGENTS.md` generato all'init, rigenerato al build/watch. Istruzioni embedded in `node_modules/writekit/agents/` con file per tipo.
- [x] **i18n label** — 17 lingue (it, en, fr, de, es, pt, ru, ar, hi, zh, ko, ja, nl, pl, tr, sv, el). Label editoriali in html, epub, docx, metadata.
- [x] **Secondo tema builtin** — "minimal" (sans-serif, modern, system-ui)
- [x] **Test per tutti i tipi** — smoke test, copertura essay/paper/collection

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

## v0.4.0 — Struttura e tipografia

- [x] **Convenzioni editoriali per tipo** — vedi sezione dedicata sotto
- [x] **Sections per tipo** — paper layout accademico (title block + abstract + content + bibliography). sections[] nel type.yaml controlla cosa buildare.
- [x] **Article rimosso** — nessun valore aggiunto rispetto a un editor di testo. 4 tipi: novel, collection, essay, paper.
- [x] **Autore per capitolo (collection)** — nelle collection, `chapter.author` dal frontmatter mostrato nel TOC e sotto il titolo capitolo in tutti i formati.
- [x] **About esclude non-autori** — la sezione About filtra traduttore, editor, illustratore (solo autori con bio).
- [x] **Parti (directory-based)** — `manuscript/part-NN/` con `part.yaml` (title). `wk add part "Title"`, `wk add chapter --part N`, `wk remove part N` (sposta capitoli in root). Parser scansiona directory, check avvisa per capitoli sciolti.
- [x] **Front/back matter** — sezioni speciali riconosciute per nome file in `manuscript/`:
    - Front: `dedication.md`, `preface.md`, `foreword.md`, `prologue.md`
    - Back: `epilogue.md`, `afterword.md`, `appendix.md`, `author-note.md`
    - `wk add/remove` per ognuna, disponibilità per tipo (prologo/epilogo solo novel)
    - Sync/remove skip renumbering per file sezione
- [x] **Heading configurabili** — `part_heading` e `chapter_heading` in typography con 5 formati: `label_number_title`, `label_number`, `number_title`, `number`, `title`. Parti con numeri romani, CJK per zh/ja (一二三), arabi per ko/ar/hi.
- [x] **i18n esteso** — `part`, `chapter_label`, `partSuffix`, `chapterSuffix`, 8 label sezioni (prologue, epilogue, preface, foreword, afterword, appendix, authorNote, dedication) in 17 lingue.
- [x] **CSS parti e sezioni** — `.part-page`, `.chapter-number`, `.chapter-author`, `.toc-part`, `.toc-author` in tutti e 4 i temi CSS.
- [ ] **Agent instructions complete** — completare le istruzioni embedded per un agent autonomo:
    - Workflow completo step-by-step (config → style → synopsis → outline → characters → write)
    - Come popolare i file iniziali dopo `wk init`
    - Sintassi footnotes e immagini nel markdown
    - Sections disponibili per tipo (paper non ha cover/colophon)
    - Come scrivere backcover.md (pitch commerciale, blurb)
    - Abstract e keywords nel config.yaml per paper
    - Come usare `wk stats` per valutare il bilanciamento
    - Parti e front/back matter: struttura directory, comandi, frontmatter
- [ ] **DOCX template custom** — da rifare con approccio diverso. `externalStyles` della libreria docx non funziona. Serve aprire il .docx come zip e sostituire document.xml mantenendo styles/fonts/settings del template.

---

## v0.4.1 — Impaginazione professionale (PDF/DOCX)

- [ ] **Header/footer** — numeri di pagina e intestazioni:
    - Footer: numero pagina centrato, inizia dal primo capitolo (non da copertina/frontespizio)
    - Header: standard editoriale recto/verso:
        - Verso (sinistra): titolo libro (o nome autore)
        - Recto (destra): titolo capitolo (o titolo parte)
    - Nessun header/footer su copertina, frontespizio, pagine di parte
    - Configurabile in typography: `page_numbers: true`, `running_header: true`
- [ ] **Impaginazione editoriale** — ordine pagine standard per stampa:
    - Copertina (recto) → pagina vuota (verso) → frontespizio (recto) → colophon (verso)
    - Dedica (recto) → pagina vuota se serve
    - Indice (recto)
    - Ogni parte inizia su recto (pagina destra)
    - Ogni capitolo inizia su recto
    - Pagine vuote inserite automaticamente dove serve per mantenere recto/verso
    - Front matter (prefazione, prologo) inizia su recto
    - Back matter: epilogo su recto, appendice/postfazione possono essere verso
    - Compatibile con print-on-demand (KDP, IngramSpark, Lulu)
- [ ] **Margini interni recto/verso** — margine di rilegatura (gutter) più largo sul lato interno:
    - Recto: margine sinistro più largo
    - Verso: margine destro più largo
    - Configurabile per preset di stampa

---

## v0.5.0 — Analisi e intelligenza

- [ ] **Cross-reference validation** — personaggi/locations nel frontmatter esistono davvero?
- [ ] **Grafo relazioni** — report relazioni personaggi
- [ ] **Timeline validation** — ordine cronologico vs ordine capitoli
- [ ] **Draft tracking** — stato draft per capitolo
- [ ] **Changelog automatico** — diff tra build

---

## v0.6.0 — Estensioni

- [ ] **Traduzione agent-assisted** — tool CLI che l'AI chiama per prepararsi il terreno, poi traduce:
    - `wk translate init --to en` — clona struttura progetto in cartella target, aggiorna config.language, genera `translation-glossary.yaml` con tutti i nomi estratti da characters/world/config/concepts (originale → tradotto vuoto)
    - `wk translate glossary` — mostra glossario corrente, evidenzia voci non ancora tradotte
    - `wk translate status` — quali capitoli sono tradotti e quali no (confronto sorgente → target)
    - `wk translate verify` — verifica coerenza: nomi del glossario usati consistentemente nei capitoli tradotti, frontmatter intatto, nessun nome originale rimasto nel testo
    - Workflow agent: legge AGENTS.md → chiama `translate init` → popola glossario → traduce capitolo per capitolo con glossario per coerenza → chiama `translate verify` → `wk build`
    - L'agent è l'orchestratore (ha le sue API key), writekit è l'infrastruttura
- [ ] **API Node pubblica** — esportare le funzioni core da `writekit` come API programmatica:
    - `loadConfig`, `loadChapters`, `loadContributors`, `loadParts`, `loadTypography`
    - `buildHtml`, `buildEpub`, `buildDocx`, `buildPdf`, `renderBookMd`
    - `check`, `sync`, `stats`
    - Entry point: `writekit/api` o export diretti dal package
    - Documentazione API per agent e integrazioni custom
    - Predisposizione per MCP server wrapper
- [ ] **Type modulari e plugin system** — ogni type diventa un modulo indipendente, preparazione per type custom:
    - **Fase 1 (refactoring interno)** — separare la logica type-specific dal core:
        - Ogni type in `src/types/{type}/` ha già `type.yaml`. Aggiungere `index.ts` opzionale per logica custom
        - Interfaccia `TypePlugin`: `{ onInit?, onBuild?, onCheck?, renderSection?, buildSections? }`
        - Spostare logica hardcoded (paper abstract, collection per-chapter author, novel timeline) nei rispettivi type module
        - Il core diventa generico: legge type.yaml + chiama hook dal TypePlugin
        - Il builder chiama `type.renderSection("abstract", ...)` invece di `if (config.type === "paper")`
    - **Fase 2 (type esterni)** — permettere type da npm package:
        - Naming convention: `writekit-type-{name}` (es. `writekit-type-screenplay`)
        - Type loader cerca in: builtin `src/types/` → `node_modules/writekit-type-*`
        - Il package esporta `type.yaml` + `TypePlugin`
        - `wk init my-script --type screenplay` funziona se il package è installato
    - **Fase 2b (type locali)** — type nel progetto: `types/{name}/` con type.yaml + index.ts
    - **Impatto sullo sviluppo attuale**: da subito, quando si aggiunge logica type-specific, isolarla in modo che sia spostabile in un modulo. Evitare `if (config.type === "X")` nel core — preferire dati nel type.yaml o hook pattern.
    - **Già fatto**: `TypeFeatures` (show_chapter_author, supports_parts) nel type.yaml, builder ricevono features invece di controllare config.type.
- [ ] **Format plugin system** — builder di output estensibili dalla community:
    - Il core registra i builder builtin (html, epub, pdf, docx, md) in un registry
    - Interfaccia `FormatPlugin`: `{ name, extension, build(projectDir, config, chapters, theme, features) }`
    - Plugin via npm: `writekit-format-{name}` (es. `writekit-format-latex`, `writekit-format-asciidoc`)
    - Format loader cerca in: builtin → `node_modules/writekit-format-*`
    - `wk build latex` funziona se il plugin è installato
    - `config.yaml build_formats: [html, epub, latex]` include format custom
    - Il TypePlugin può dichiarare format aggiuntivi specifici per il tipo (es. screenplay → fountain)
- [ ] **Export Markdown singolo** — tutto il progetto (sorgenti + metadata) in un .md strutturato, utile per dare contesto completo a un LLM
- [ ] **Import da Markdown** — splitta un .md in capitoli
- [ ] **Font embedding** — woff2/ttf in HTML e ePub
- [ ] **Backup command** — `wk backup` crea zip del progetto

---

## Visione: framework agentico

Writekit non è un tool AI e non integra LLM. È un **framework nativamente agentico**: la sua struttura dati (frontmatter, YAML, directory convenzionali, CLI deterministici) è pensata perché qualsiasi agent AI possa orchestrare il workflow di scrittura senza adattatori.

- **AGENTS.md** generato nel progetto: istruzioni complete per l'agent, aggiornate ad ogni build
- **CLI come tool**: l'agent chiama `wk add`, `wk check`, `wk build`, `wk translate` come farebbe un umano
- **Struttura leggibile**: config.yaml, characters/*.md, outline/ — tutto in formati che un LLM legge nativamente
- **Zero lock-in**: funziona con Claude Code, Cursor, Copilot, qualsiasi agent framework presente e futuro
- **Predisposizione futura**: se servissero operazioni più complesse (analisi semantica, suggerimenti plot), esporre tool Node come MCP server o CLI estesi, senza cambiare l'architettura

Due livelli di accesso:
- **CLI pubblica** (`wk *`) — per umani e agent semplici, esecuzione come processo
- **API Node** (`import from "writekit"`) — per agent avanzati, MCP server, integrazioni custom. Accesso diretto alle strutture dati in memoria (config, chapters, characters, glossary, typography). Più veloce, più potente, permette operazioni complesse (grafo personaggi, diff semantici tra draft, analisi timeline) impossibili via CLI

L'API Node è già quasi pronta — le funzioni in `src/lib/` sono modulari. Serve esportarle pulite dal package entry point e documentarle. Un MCP server sarebbe un wrapper sottile sopra questa API.

Il valore aggiunto non è "ha l'AI dentro" ma "qualsiasi AI ci lavora immediatamente".

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
1. Differenziare le convenzioni per tipo (novel vs paper vs essay)
2. Permettere all'utente di sovrascriverle

### Convenzioni per tipo

| Proprietà | novel | collection | essay | paper |
|---|---|---|---|---|
| `paragraph_indent` | `1.5rem` | `1.5rem` | `1.5rem` | `0` |
| `paragraph_spacing` | `0` | `0` | `0` | `0.5rem` |
| `text_align` | `justify` | `justify` | `justify` | `justify` |
| `first_paragraph_indent` | `false` | `false` | `false` | `false` |
| `heading_style` | `serif` | `serif` | `serif` | `bold` |
| `blockquote_style` | `italic` | `italic` | `italic` | `indent` |
| `scene_break` | `* * *` | `* * *` | `---` | `---` |
| `chapter_opening` | `large` | `large` | `medium` | `small` |
| `line_height` | `1.6` | `1.6` | `1.6` | `2.0` |
| `hyphenation` | `true` | `true` | `true` | `true` |
| `orphans_widows` | `2` | `2` | `2` | `3` |

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

- [x] **Type definitions** — add_commands per parti e front/back matter, `part_heading`/`chapter_heading` in typography, schema `toc`/`show_title` nei frontmatter sezioni
- [x] **Init** — non genera parti/sezioni per default (corretto, l'utente le aggiunge con `wk add`)
- [x] **Add** — `wk add part`, `wk add chapter --part N`, 8 comandi front/back matter con frontmatter vuoto (titolo risolto da i18n)
- [x] **Remove** — `wk remove part N` (sposta capitoli, elimina dir), 8 comandi remove per sezioni. Skip renumbering per file sezione.
- [x] **Check** — avviso per capitoli sciolti in root quando esistono parti. Section files esclusi dal naming convention check.
- [x] **Sync** — skip renumbering per file sezione
- [x] **Build** — tutti i 5 formati gestiscono: front/back matter, parti, heading configurabili (5 formati × EN/IT/ZH/KO), autore per capitolo (collection), about esclude non-autori, TOC con heading format e parti uppercase, titoli sezione da i18n, `show_title: false`, `toc: false`
- [x] **Watch** — non impattato (usa build)
- [x] **Schema** — `part_heading`/`chapter_heading` in typography loader, `toc`/`show_title` nel parser
- [x] **i18n** — `part`, `chapter_label`, `partSuffix`, `chapterSuffix`, 8 label sezioni, `abstract` — 17 lingue. Korean spacing fixato (CJK-style senza spazio).
- [x] **Reports** — non impattato (parti non nei report per ora)
- [x] **Agent instructions** — concise, modulari per tipo. Regole generali in instructions.md, tipo-specifiche in types/*.md. Pronte per plugin architecture.
- [x] **CLI registration** — comandi registrati in add/remove
- [x] **README.md** — documentati parti, front/back matter, heading format, collection author, footnotes, immagini con width
- [x] **Tests** — 184 test (3 file): 50 heading unit test (tutti i formati × 4 lingue + roman + CJK), 10 novel-parts integration, 9 smoke nuovi comandi, 115 smoke+integration
- [x] **Build passes** — `npm run build` no errors
- [x] **Tests pass** — `npm test` 184 green
- [x] **PLAN.md** — v0.4 completo, v0.4.1 impaginazione professionale pianificata, v0.5 analisi, v0.6 estensioni + traduzione + API Node
- [x] **Pre-release checklist** — TUTTO VERDE. v0.4 completa.
- [x] **CSS themes** — `.part-page`, `.chapter-number`, `.chapter-author`, `.toc-part`, `.toc-author`, `.toc-chapter` in tutti e 4 i temi. TOC `<ul>` senza numerazione browser.
- [x] **Typography** — `HeadingFormat` type, `formatPartHeading`/`formatChapterHeading` con roman/CJK/arabic, `SECTION_LABEL_KEY` mapping. `toRoman`, `toCjk` helpers.
- [x] **Smoke test comandi nuovi** — `wk add part`, `wk remove part`, front/back matter add/remove, type-specific blocking
- [x] **TypeFeatures refactoring** — `show_chapter_author`, `supports_parts` nel type.yaml. Zero `config.type` checks nei builder.
