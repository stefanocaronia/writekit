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

- [ ] **Convenzioni editoriali per tipo** — ogni type.yaml definisce default tipografici (indent, paragraph spacing, alignment, ecc.). L'utente può sovrascriverli in style.yaml. I temi CSS hanno classi per tutte le varianti, il build applica le classi giuste. Catena: type defaults → style.yaml override → tema CSS.
  - novel: indent prima riga, no spazio tra paragrafi
  - essay: indent, no spazio
  - paper: no indent, spazio tra paragrafi
  - article: no indent, no spazio
  - collection: come novel
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
