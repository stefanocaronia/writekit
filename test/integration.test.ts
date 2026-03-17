/**
 * Integration tests — create fully populated projects for each type,
 * run all commands, build all formats, and verify output.
 *
 * Projects are left in sandbox/ for manual inspection.
 * Run: npx vitest run test/integration.test.ts
 */

import { describe, it, expect, beforeAll } from "vitest";
import { execSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync, mkdirSync, readdirSync, copyFileSync, rmSync } from "node:fs";
import { join } from "node:path";

const ROOT = process.cwd();
const CLI = `node ${join(ROOT, "dist", "cli.js")}`;
const SANDBOX = join(ROOT, "sandbox");
const COVER_MOCKUP = join(ROOT, "assets", "cover-mockup.png");
const IMAGE_MOCKUP = join(ROOT, "assets", "image-mockup.png");

function installCover(projectDir: string): void {
    const assetsDir = join(projectDir, "assets");
    mkdirSync(assetsDir, { recursive: true });
    if (existsSync(COVER_MOCKUP)) {
        copyFileSync(COVER_MOCKUP, join(assetsDir, "cover.png"));
    }
    if (existsSync(IMAGE_MOCKUP)) {
        copyFileSync(IMAGE_MOCKUP, join(assetsDir, "image.png"));
    }
}

function run(cmd: string, cwd?: string): string {
    return execSync(cmd, {
        cwd: cwd ?? ROOT,
        encoding: "utf-8",
        timeout: 60_000,
    });
}

// Reusable text blocks for bulk content
const LOREM = [
    "The city stretched out below them like a map drawn by a drunk cartographer — streets that curved when they should have been straight, alleys that dead-ended into walls covered in graffiti and climbing jasmine. From up here, on the roof of the old observatory, you could see the entire valley: the river winding through its center like a silver thread, the bridges crossing it at irregular intervals, the clusters of terracotta roofs interrupted by the occasional glass tower.",
    "There was a time, not so long ago, when all of this had been fields. Wheat fields, mostly, with the occasional vineyard breaking the monotony of gold with streaks of deep green. The old photographs in the municipal archive showed a landscape that was almost unrecognizable — vast and empty and silent, with only the church steeple and the water tower rising above the horizon line.",
    "Professor Marchetti had spent forty years studying the transformation. She had measured it in census data and building permits, in water consumption records and electricity usage patterns. She had mapped the expansion year by year, decade by decade, watching the city grow like an organism — first slowly, then with alarming speed, consuming the countryside the way a fire consumes dry grass.",
    "But numbers, she knew, told only part of the story. The real transformation was happening at a level that no statistic could capture — in the way people walked through the streets, in the conversations they had in cafés, in the dreams they dreamed at night. The city was not just growing; it was *becoming* something. Something new and strange and not entirely human.",
    "The question that kept her awake at night, the question she had been circling for four decades without ever quite reaching its center, was simple: *What was it becoming?* And the corollary, which was perhaps even more troubling: *Was there anything anyone could do to stop it?*",
    "In the basement of the university library, behind a locked door that required three separate keys and a six-digit code, there was a room that contained the answer. Or at least, it contained the closest thing to an answer that anyone had ever found. The room was small — barely large enough for a desk, a chair, and a single filing cabinet — and it smelled of dust and old paper and something else, something faintly chemical, like the residue of a long-extinguished fire.",
    "The filing cabinet held seven folders. Each folder contained exactly thirteen pages. Each page was covered in handwriting so small and dense that it required a magnifying glass to read. The handwriting belonged to a man named Alessandro Ferretti, who had been the city's chief urban planner from 1952 to 1971, and who had disappeared one Tuesday morning in November of that year without leaving any trace except these ninety-one pages of closely written text.",
    "What the pages described was, depending on your perspective, either the most brilliant piece of urban theory ever written or the ravings of a man who had lost his mind. Marchetti had read them seventeen times. Each time, she came away with a different understanding. Each time, she was more convinced that Ferretti had been right about everything.",
].join("\n\n");

function writeContent(projectDir: string, path: string, content: string): void {
    writeFileSync(join(projectDir, path), content);
}

// ─────────────────────────────────────────────────────────────────────────────
// NOVEL
// ─────────────────────────────────────────────────────────────────────────────

describe("integration: novel", () => {
    const DIR = join(SANDBOX, "int-novel");

    beforeAll(() => {
        mkdirSync(SANDBOX, { recursive: true });
        rmSync(DIR, { recursive: true, force: true });
        run(`${CLI} init int-novel --yes --type novel`, SANDBOX);
        installCover(DIR);
    });

    it("populate with realistic content", () => {
        // Chapter 1 with footnotes and formatting
        writeContent(DIR, "manuscript/01-chapter-one.md", `---
chapter: 1
title: The Fountain
pov: Marco
draft: 2
---

# The Fountain

It was a dark and stormy night[^1]. The wind howled through the narrow streets of the old city, rattling windows and sending loose shutters crashing against **stone walls**.

Marco pulled his coat tighter around his shoulders and pressed forward into the rain. The *Piazza del Duomo* was empty at this hour. Only the fountain still murmured, its ancient stone lips whispering secrets to anyone who would listen.

> "The fountain remembers everything, Marco. Every wish, every prayer, every tear that has fallen into its waters."

He remembered his grandmother's words. She had been right about many things — about the city, about the family, about the secrets buried beneath the cobblestones.

## The Meeting

![The old door](assets/image.png)

Marco reached the heavy wooden door and knocked three times.

- First knock: silence
- Second knock: a shuffle of feet
- Third knock: the door creaked open

"You're late," whispered Elena. "Come in before someone sees you."

The apartment smelled of old books and coffee. Elena had always surrounded herself with words — shelves of them, stacks of them, towers of them that threatened to topple at the slightest breeze. Marco navigated the narrow passage between two particularly precarious columns of paperbacks and settled into the worn armchair by the window.

"Tell me everything," she said, pouring him a glass of wine without asking whether he wanted one. "Start from the beginning. Don't leave anything out."

Marco took a deep breath. Where to begin? With the letter, perhaps. The letter that had arrived three weeks ago, postmarked from a city that no longer existed on any map. The letter written in his grandmother's handwriting, despite the fact that she had been dead for fifteen years.

"It started with a letter," he said. And then he told her everything.

The rain continued to fall outside, drumming against the windows in an irregular rhythm that seemed almost deliberate, as if the city itself were trying to listen to his story. Elena sat perfectly still throughout, her wine untouched, her eyes fixed on some point beyond the wall, as if she could see the events unfolding in the plaster.

When he finished, the silence that followed was not empty but full — full of implications, full of questions, full of the weight of secrets that had been buried for decades and were now clawing their way back to the surface.

"The fountain," Elena said at last. "It always comes back to the fountain."

[^1]: It was actually a Tuesday, but the weather didn't care about the day of the week.
`);

        // Chapter 2
        writeContent(DIR, "manuscript/02-the-storm.md", `---
chapter: 2
title: The Storm
pov: Elena
draft: 1
---

# The Storm

Lightning split the sky. Thunder followed almost instantly, shaking the buildings to their foundations.

Elena watched Marco shake the rain from his coat. He looked older than she remembered — the years had not been kind[^1].

1. She offered him coffee
2. He declined
3. She poured two cups anyway

| Character | Location | Status |
|---|---|---|
| Marco | Elena's apartment | Arrived |
| Elena | Elena's apartment | Waiting |
| Giovanni | Unknown | Missing |

[^1]: Then again, hiding from the authorities tends to age a person.

The streets were empty now, washed clean by the deluge. Water ran in rivers along the gutters, carrying with it the debris of the day — a newspaper, a crushed cigarette packet, a single red rose that someone had dropped or discarded. Elena watched it all from her window, the glass fogging with her breath.

She had known Marco would come back eventually. They always came back, the ones who had left. The city had a way of calling its children home, a gravitational pull that no amount of distance or time could weaken. She had felt it herself, during those years in London, a persistent tug at the base of her skull, a whisper in a language she could not quite hear but could not ignore.

"What do you know about the catacombs?" Marco asked suddenly.

Elena turned from the window. "More than I should," she said. "And less than I need to."

The storm was passing now, moving east towards the mountains. In its wake, the city seemed to exhale, releasing the tension that had built up over days of oppressive heat. Somewhere in the distance, a church bell began to ring — not the hour, but something else. A signal, perhaps. A warning.

Marco recognized the pattern. Three short, one long, three short. The same sequence his grandmother used to tap on the kitchen table when she wanted his attention.

"We need to go," he said. "Now."
`);

        // Synopsis
        writeContent(DIR, "synopsis.md", `# The Fountain of Secrets

A thriller set in a fictional Italian city where an ancient fountain holds the key to a family's dark past. Marco returns after twenty years to uncover the truth about his grandmother's disappearance.
`);

        // Backcover
        writeContent(DIR, "backcover.md", `# Back Cover

*"A masterful blend of mystery and family drama."*

When Marco Bellini returns to his hometown after two decades, he expects to find answers. Instead, he finds more questions — and a fountain that seems to know everything.

**The Fountain of Secrets** is a gripping thriller about memory, betrayal, and the things we bury beneath the surface.
`);

        // Style
        writeContent(DIR, "style.yaml", `pov: third-person
tense: past
tone: dark, atmospheric
voice: literary
rules:
    - Show, don't tell
    - Short paragraphs for tension
    - Italian words in italics
`);

        // Config with author
        writeContent(DIR, "config.yaml", `type: novel
title: "The Fountain of Secrets"
subtitle: "A Novel"
series: ""
volume: 1
author: "Marco Bellini"
translator: ""
editor: ""
illustrator: ""
language: en
genre: thriller
isbn: ""
publisher: ""
edition: 1
date: ""
build_formats:
    - html
    - epub
    - md
theme: default
cover: ""
print_preset: trade
license: CC BY-NC-SA 4.0
license_url: "https://creativecommons.org/licenses/by-nc-sa/4.0/"
copyright: "© 2026 Marco Bellini"
`);

        expect(true).toBe(true);
    });

    it("add commands work", { timeout: 30_000 }, () => {
        run(`${CLI} add chapter "The Secret"`, DIR);
        run(`${CLI} add character "Elena Rossi" --role protagonist`, DIR);
        run(`${CLI} add character "Giovanni Bellini" --role antagonist`, DIR);
        run(`${CLI} add location "Piazza del Duomo"`, DIR);
        run(`${CLI} add location "The Catacombs" --type location`, DIR);
        run(`${CLI} add note "Research on Italian fountains"`, DIR);
        run(`${CLI} add event "Marco arrives" --date "day 1" --chapter 1`, DIR);
        run(`${CLI} add event "The storm" --date "day 1" --chapter 2`, DIR);
        run(`${CLI} add author "Elena Rossi"`, DIR);
        run(`${CLI} add translator "John Smith"`, DIR);

        expect(existsSync(join(DIR, "manuscript", "03-the-secret.md"))).toBe(true);
        expect(existsSync(join(DIR, "characters", "elena-rossi.md"))).toBe(true);
        expect(existsSync(join(DIR, "characters", "giovanni-bellini.md"))).toBe(true);
        expect(existsSync(join(DIR, "world", "piazza-del-duomo.md"))).toBe(true);
        expect(existsSync(join(DIR, "contributors", "elena-rossi.md"))).toBe(true);
        expect(existsSync(join(DIR, "contributors", "john-smith.md"))).toBe(true);
    });

    it("populate character with aliases", () => {
        writeContent(DIR, "characters/elena-rossi.md", `---
name: Elena Rossi
role: protagonist
aliases:
    - la professoressa
    - Lena
age: "42"
relationships:
    - character: Marco Bellini
      type: childhood friend
    - character: Giovanni Bellini
      type: adversary
---

# Elena Rossi

## Appearance

Tall, dark hair streaked with grey. Sharp eyes behind round glasses. She favours wool cardigans in muted colours and always wears a thin silver chain with a key pendant — "the key to the archive," she jokes, though nobody has ever seen her without it.

## Personality

Intelligent, cautious, loyal. Hides her fear behind sarcasm. She has a photographic memory for texts but forgets faces easily, which she compensates for by assigning everyone a nickname based on their most prominent feature.

## Backstory

Professor of archaeology at the University of Rome. She was the one who found the first clue about the fountain — a fragment of a 14th-century map hidden inside the binding of an unrelated codex. She spent three years following the trail before contacting Marco.

## Arc

From reluctant ally to active participant in uncovering the truth. By the end, she must choose between publishing her findings (and the academic glory that would follow) and protecting the secret the fountain guards.

## Notes

Elena speaks four languages fluently and reads two dead ones. Her office is on the third floor of the Palazzo della Sapienza, overlooking a courtyard with a lemon tree that she waters every morning before class.
`);

        const content = readFileSync(join(DIR, "characters", "elena-rossi.md"), "utf-8");
        expect(content).toContain("la professoressa");
        expect(content).toContain("aliases");
    });

    it("populate second character", () => {
        writeContent(DIR, "characters/giovanni-bellini.md", `---
name: Giovanni Bellini
role: antagonist
aliases:
    - il dottore
    - Gio
age: "65"
relationships:
    - character: Marco Bellini
      type: uncle
    - character: Elena Rossi
      type: former colleague
---

# Giovanni Bellini

## Appearance

Silver hair combed back. Tanned skin, deep-set eyes. Always impeccably dressed — linen suits in summer, cashmere in winter. Walks with a slight limp from an old injury he refuses to discuss.

## Personality

Charismatic, manipulative, patient. He plays the long game and never raises his voice, which makes him more frightening than any shouting antagonist. Genuinely believes he is protecting the family.

## Backstory

Marco's uncle and the family patriarch since the grandmother's disappearance. He was the city's most respected notary for thirty years, which gave him access to every property deed and every secret buried in the municipal records. He knows about the fountain — he has always known.

## Arc

From hidden puppet-master to exposed villain. His downfall comes not from violence but from the revelation that his "protection" of the family was really protection of his own guilt.

## Notes

Giovanni collects antique pocket watches. He has forty-seven of them, each one stopped at a different time. He claims each one marks a moment when "something important happened in this city."
`);

        const content = readFileSync(join(DIR, "characters", "giovanni-bellini.md"), "utf-8");
        expect(content).toContain("il dottore");
    });

    it("populate locations", () => {
        writeContent(DIR, "world/piazza-del-duomo.md", `---
name: Piazza del Duomo
type: location
---

# Piazza del Duomo

## Description

The central square of the old city, dominated by the cathedral on the north side and the municipal palace on the south. In the centre stands the Fountain of Secrets — a Renaissance-era marble basin fed by an underground spring that has never run dry, not even during the droughts of 1893 and 1947.

## Details

The piazza is roughly trapezoidal, narrowing towards the west where it opens into the Via dei Mercanti. The cobblestones are original 16th-century basalt, worn smooth by centuries of foot traffic. At night, the fountain is lit by four wrought-iron lanterns that cast long shadows across the stone.

## Notes

Local legend says that if you throw a coin into the fountain at midnight on the feast of San Giovanni, the water will show you the face of someone you have lost. The municipal authorities have tried to discourage the practice, but every June 24th the fountain is full of coins by dawn.
`);

        writeContent(DIR, "world/the-catacombs.md", `---
name: The Catacombs
type: location
---

# The Catacombs

## Description

A network of tunnels running beneath the old city, originally carved as burial chambers in the 3rd century and expanded over the following thousand years. The main entrance is in the basement of the Church of San Luca, but there are at least seven other access points, most of them sealed or forgotten.

## Details

The tunnels extend for approximately 2.3 kilometres. The walls are lined with niches for burial urns, many of them still occupied. Temperature remains constant at 14 degrees Celsius year-round. The air is damp and smells of limestone and old earth. Several chambers contain frescoes dating from the 5th to the 12th centuries.

## Notes

The catacombs were used as a shelter during the war and as a smuggling route in the decades that followed. Giovanni Bellini reportedly explored them as a young man, though he denies this.
`);

        expect(readFileSync(join(DIR, "world", "piazza-del-duomo.md"), "utf-8")).toContain("Renaissance-era");
    });

    it("populate outline files", () => {
        writeContent(DIR, "outline/plot.md", `---
acts:
    - name: Act 1 — The Return
      summary: Marco returns to the city after twenty years. He reconnects with Elena, discovers the letter, and learns about the fountain's true nature. Ends with the discovery of the entrance to the catacombs.
    - name: Act 2 — The Descent
      summary: Marco and Elena explore the catacombs and uncover Ferretti's hidden room. They decode the ninety-one pages and realise Giovanni has been manipulating events. The storm forces a confrontation.
    - name: Act 3 — The Fountain
      summary: The truth about the grandmother's disappearance is revealed. Giovanni's guilt is exposed. Marco must decide whether to destroy the fountain's secret or preserve it. Elena publishes her findings under a pseudonym.
---

# Plot

The story follows Marco Bellini's return to his hometown after twenty years of self-imposed exile. A letter in his dead grandmother's handwriting draws him back, and he discovers that the Fountain of Secrets — the city's most famous landmark — is connected to a network of underground chambers that hold the key to his family's darkest secrets.

With the help of his childhood friend Elena Rossi, now a professor of archaeology, Marco descends into the catacombs beneath the city. There he finds a hidden room containing the writings of Alessandro Ferretti, the city planner who disappeared in 1971. Ferretti's pages describe a pattern in the city's growth that is not natural — something is directing the expansion, and it is centred on the fountain.

The antagonist is Marco's uncle Giovanni, who has known the truth all along and has been using the fountain's influence to build the family's wealth and power. The climax takes place during a storm that floods the catacombs, forcing Marco to choose between saving Giovanni and preserving the evidence.
`);

        writeContent(DIR, "outline/chapters/01.md", `---
chapter: 1
title: The Fountain
pov: Marco
characters:
    - Marco Bellini
    - Elena Rossi
location: Piazza del Duomo
---

# Chapter 1 — Outline

Marco arrives in the city by train at dusk. He walks through the old quarter to the Piazza del Duomo, where he stands before the fountain for the first time in twenty years. Memories flood back — his grandmother bringing him here as a child, the wishes they made, the stories she told.

He meets Elena at her apartment above the bookshop. She shows him the letter she received — identical to his, in the same handwriting. They compare notes and realise that someone — or something — is calling them both back.

The chapter ends with Marco noticing that the water in the fountain is flowing in the wrong direction.
`);

        writeContent(DIR, "outline/chapters/02.md", `---
chapter: 2
title: The Storm
pov: Elena
characters:
    - Elena Rossi
    - Marco Bellini
    - Giovanni Bellini
location: Elena's apartment
---

# Chapter 2 — Outline

A storm hits the city. Elena and Marco shelter in her apartment and begin planning their investigation. Elena reveals what she knows about the catacombs — the maps she's found, the sealed entrances, the rumours about Ferretti.

Marco receives a phone call from Giovanni, who warns him to leave the city. The conversation is tense — Giovanni knows Marco has the letter. The chapter ends with Elena discovering a hidden passage behind the bookshelf in her apartment that leads down into darkness.
`);

        expect(readFileSync(join(DIR, "outline", "plot.md"), "utf-8")).toContain("Act 1");
    });

    it("populate contributor bios", () => {
        // Elena Rossi contributor (the translator added via CLI)
        writeContent(DIR, "contributors/elena-rossi.md", `---
name: Elena Rossi
roles:
    - author
---

# Elena Rossi

Elena Rossi was born in Naples in 1984 and grew up between Italy and the United Kingdom. She studied comparative literature at the University of Edinburgh and holds a PhD in Mediterranean studies from La Sapienza in Rome. Her fiction has appeared in several Italian literary journals, and she has translated works by Natalia Ginzburg and Cesare Pavese into English.
`);

        writeContent(DIR, "contributors/john-smith.md", `---
name: John Smith
roles:
    - translator
---

# John Smith

John Smith is a literary translator working from Italian and French into English. He has translated over forty novels, including works by Elena Ferrante and Jhumpa Lahiri. He lives in London and teaches translation at the University of Westminster.
`);

        // Populate marco-bellini if it exists
        if (existsSync(join(DIR, "contributors", "marco-bellini.md"))) {
            writeContent(DIR, "contributors/marco-bellini.md", `---
name: Marco Bellini
roles:
    - author
---

# Marco Bellini

Marco Bellini is an Italian novelist and journalist based in Rome. He has published three novels and two collections of essays. His work explores themes of memory, place, and the hidden life of cities. He was awarded the Premio Strega Giovani in 2019 for his novel *Le strade sommerse*.
`);
        }

        expect(readFileSync(join(DIR, "contributors", "elena-rossi.md"), "utf-8")).toContain("Naples");
    });

    it("populate notes", () => {
        writeContent(DIR, "notes/research-on-italian-fountains.md", `# Research on Italian Fountains

## Historical Context

Italian public fountains served multiple purposes: practical (water supply), social (meeting point), symbolic (civic pride), and spiritual (baptism, purification). The Renaissance saw an explosion of ornamental fountain-building, driven by both hydraulic innovation and artistic ambition.

## Notable Examples

- **Fontana di Trevi** (Rome, 1762) — the most famous, fed by an ancient aqueduct
- **Fontana Maggiore** (Perugia, 1278) — medieval, with sculpted panels depicting the months
- **Fontana del Nettuno** (Bologna, 1567) — by Giambologna, a symbol of papal authority

## Symbolism

Water in Italian culture carries deep symbolic weight: purification, memory, the passage of time. Many folk traditions associate springs and fountains with oracular powers — the ability to reveal hidden truths or forgotten pasts.

## Sources to Check

- R. Symonds, *Italian Fountains* (1987)
- M. Fagiolo, *L'acqua e la città* (2001)
- Archivio storico comunale — fountain maintenance records 1890–1970
`);

        expect(readFileSync(join(DIR, "notes", "research-on-italian-fountains.md"), "utf-8")).toContain("Fontana di Trevi");
    });

    it("create contributor for original author", () => {
        // Config has author "Marco Bellini" set manually — create the sheet
        if (!existsSync(join(DIR, "contributors", "marco-bellini.md"))) {
            run(`${CLI} add author "Marco Bellini"`, DIR);
        }
    });

    it("sync works", () => {
        const out = run(`${CLI} sync`, DIR);
        expect(out).toContain("Done");
    });

    it("check passes", () => {
        const out = run(`${CLI} check`, DIR);
        // Allow warnings, but no errors
        expect(out).toMatch(/0 error|All good/);
    });

    it("rename character works", () => {
        run(`${CLI} rename character "Giovanni Bellini" "Giovanni Moretti"`, DIR);
        expect(existsSync(join(DIR, "characters", "giovanni-moretti.md"))).toBe(true);
        expect(existsSync(join(DIR, "characters", "giovanni-bellini.md"))).toBe(false);
    });

    it("remove chapter works and renumbers", () => {
        run(`${CLI} remove chapter 3`, DIR);
        expect(existsSync(join(DIR, "manuscript", "03-the-secret.md"))).toBe(false);
    });

    it("stats works", () => {
        const out = run(`${CLI} stats`, DIR);
        expect(out).toContain("The Fountain of Secrets");
        expect(out).toContain("Total words");
        expect(out).toContain("Chapters");
    });

    it("build html works with all content", () => {
        run(`${CLI} build html`, DIR);
        const files = readdirSync(join(DIR, "build")).filter((f) => f.endsWith(".html"));
        expect(files.length).toBeGreaterThan(0);
        const html = readFileSync(join(DIR, "build", files[0]), "utf-8");
        // Cover
        expect(html).toContain("cover-image");
        // Title
        expect(html).toContain("The Fountain of Secrets");
        // Authors
        expect(html).toContain("Marco Bellini");
        // Chapters
        expect(html).toContain("The Fountain");
        expect(html).toContain("The Storm");
        // Formatting
        expect(html).toContain("<strong>");
        expect(html).toContain("<em>");
        expect(html).toContain("<blockquote>");
        expect(html).toContain("<li>");
        expect(html).toContain("<table>");
        // Footnotes
        expect(html).toContain("footnote");
        // Image
        expect(html).toContain("<img");
        // Back cover
        expect(html).toContain("masterful blend");
        // About
        expect(html).toContain("About the Author");
        // Colophon (no heading, but content)
        expect(html).toContain("CC BY-NC-SA 4.0");
        expect(html).toContain("2026");
    });

    it("build epub works", () => {
        run(`${CLI} build epub`, DIR);
        const files = readdirSync(join(DIR, "build")).filter((f) => f.endsWith(".epub"));
        expect(files.length).toBeGreaterThan(0);
    });

    it("build docx works", () => {
        run(`${CLI} build docx`, DIR);
        const files = readdirSync(join(DIR, "build")).filter((f) => f.endsWith(".docx"));
        expect(files.length).toBeGreaterThan(0);
    });

    it("build md works", () => {
        run(`${CLI} build md`, DIR);
        const files = readdirSync(join(DIR, "build")).filter((f) => f.endsWith(".md"));
        expect(files.length).toBeGreaterThan(0);
        const md = readFileSync(join(DIR, "build", files[0]), "utf-8");
        expect(md).toContain("Table of Contents");
        expect(md).toContain("The Fountain");
        expect(md).toContain("The Storm");
        expect(md).toContain("---");
        expect(md).toContain("About the Author");
        expect(md).toContain("2026");
    });

    it("reports generated", () => {
        expect(existsSync(join(DIR, "build", "reports", "status.md"))).toBe(true);
        expect(existsSync(join(DIR, "build", "reports", "cast.md"))).toBe(true);
        expect(existsSync(join(DIR, "build", "reports", "locations.md"))).toBe(true);
        expect(existsSync(join(DIR, "build", "reports", "timeline.md"))).toBe(true);
    });

    it("theme list works", () => {
        const out = run(`${CLI} theme list`, DIR);
        expect(out.toLowerCase()).toContain("default");
        expect(out.toLowerCase()).toContain("minimal");
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// ESSAY
// ─────────────────────────────────────────────────────────────────────────────

describe("integration: essay", () => {
    const DIR = join(SANDBOX, "int-essay");

    beforeAll(() => {
        mkdirSync(SANDBOX, { recursive: true });
        rmSync(DIR, { recursive: true, force: true });
        run(`${CLI} init int-essay --yes --type essay`, SANDBOX);
        installCover(DIR);
    });

    it("populate with realistic content", () => {
        writeContent(DIR, "config.yaml", `type: essay
title: "The Architecture of Silence"
subtitle: "An Essay on Urban Soundscapes"
author: "Anna Verdi"
language: en
genre: non-fiction
isbn: ""
publisher: ""
edition: 1
date: ""
build_formats:
    - html
    - md
theme: default
cover: ""
print_preset: a5
license: All rights reserved
license_url: ""
copyright: "© 2026 Anna Verdi"
`);

        writeContent(DIR, "thesis.md", `# Thesis

Modern cities have lost their capacity for meaningful silence, and this loss has fundamentally altered how we experience urban space and community.
`);

        writeContent(DIR, "manuscript/01-introduction.md", `---
title: Introduction
draft: 2
---

# Introduction

When was the last time you experienced true silence in a city? Not the absence of sound — that is impossible in any living place — but the kind of silence that allows thought, reflection, and genuine encounter with one's surroundings[^1].

This essay argues that the systematic elimination of silence from urban spaces represents not merely an aesthetic loss but a profound shift in how we inhabit and understand our cities.

${LOREM}

[^1]: The philosopher Max Picard called this "the silence that is the ground of all being."
`);

        writeContent(DIR, "manuscript/02-the-history-of-urban-sound.md", `---
title: The History of Urban Sound
draft: 1
---

# The History of Urban Sound

Medieval cities were noisy in their own way — the clatter of hooves on cobblestones, the cries of street vendors, the bells that marked every hour of the day.

But these sounds had **rhythm**. They rose and fell with the day. At night, silence returned.

> "The city that never sleeps is the city that never thinks." — Jane Jacobs

${LOREM}
`);

        writeContent(DIR, "synopsis.md", `# The Architecture of Silence

An exploration of how modern cities have lost meaningful silence and what this means for urban life, community, and the human experience of place.
`);

        writeContent(DIR, "backcover.md", `# Back Cover

In an age of constant noise, what have we lost?

**The Architecture of Silence** traces the disappearance of quiet from our cities and argues that reclaiming silence is essential to reclaiming our humanity.
`);

        expect(true).toBe(true);
    });

    it("add essay-specific commands", () => {
        run(`${CLI} add argument "Silence is essential for community formation"`, DIR);
        run(`${CLI} add concept "Soundscape"`, DIR);
        run(`${CLI} add concept "Acoustic ecology"`, DIR);
        run(`${CLI} add chapter "Modern Noise"`, DIR);
        run(`${CLI} add note "Research: WHO noise guidelines"`, DIR);

        expect(existsSync(join(DIR, "arguments", "silence-is-essential-for-community-formation.md"))).toBe(true);
        expect(existsSync(join(DIR, "concepts", "soundscape.md"))).toBe(true);
        expect(existsSync(join(DIR, "concepts", "acoustic-ecology.md"))).toBe(true);
    });

    it("populate arguments with body text", () => {
        writeContent(DIR, "arguments/silence-is-essential-for-community-formation.md", `---
claim: Silence is essential for community formation
related:
    - Soundscape
    - Acoustic ecology
---

# Silence is essential for community formation

## Support

Communities form through conversation, and conversation requires the possibility of silence. In environments where background noise exceeds 65 decibels — the threshold identified by the WHO as harmful to sustained concentration — meaningful dialogue becomes physically difficult. Studies in urban sociology (Fischer 1982, Putnam 2000) show that residents of quieter neighbourhoods are 40% more likely to know their neighbours by name and 60% more likely to participate in local governance.

The piazza, the park bench, the courtyard — these traditional spaces of community life all share one characteristic: they are, or were, relatively quiet. They allow voices to carry at conversational volume. They permit the pauses and silences that are essential to genuine listening.

## Counterpoint

Critics argue that noise is itself a form of community — that the sounds of a busy market, a street festival, or children playing are signs of a healthy, vibrant neighbourhood. This is true, but it conflates *human-generated* sound (which is rhythmic, varied, and meaningful) with *mechanical* noise (which is constant, undifferentiated, and meaningless). The argument for silence is not an argument against human sound; it is an argument against the drone of traffic, air conditioning, and construction that drowns it out.
`);

        expect(readFileSync(join(DIR, "arguments", "silence-is-essential-for-community-formation.md"), "utf-8")).toContain("WHO");
    });

    it("populate concepts with definitions", () => {
        writeContent(DIR, "concepts/soundscape.md", `---
term: Soundscape
related:
    - Acoustic ecology
---

# Soundscape

The acoustic environment as perceived by humans in context. The term was coined by R. Murray Schafer in the late 1960s as an analogy to "landscape" — just as a landscape is the visual character of an environment, a soundscape is its auditory character. Schafer distinguished between **hi-fi** soundscapes (where individual sounds can be clearly heard, as in a quiet village) and **lo-fi** soundscapes (where sounds overlap and mask each other, as in a noisy city).

The concept is central to this essay because it reframes noise not as a nuisance to be mitigated but as an *environment* to be designed. If we can design visual landscapes, we can — and should — design acoustic ones.
`);

        writeContent(DIR, "concepts/acoustic-ecology.md", `---
term: Acoustic ecology
related:
    - Soundscape
---

# Acoustic ecology

The study of the relationship between living organisms and their sonic environment. Founded by R. Murray Schafer at Simon Fraser University in the 1970s, acoustic ecology examines how sounds affect behaviour, health, and social interaction. It draws on biology, urban planning, psychology, and music.

Key principles include the idea that every environment has a **keynote sound** (a constant background drone that sets the character of the place), **sound signals** (foreground sounds that carry information), and **soundmarks** (sounds unique to a place, analogous to landmarks). The loss of soundmarks — the disappearance of church bells, fountain splashing, or birdsong — is a sign of environmental degradation.
`);

        expect(readFileSync(join(DIR, "concepts", "soundscape.md"), "utf-8")).toContain("Schafer");
    });

    it("populate Modern Noise chapter with image and footnotes", () => {
        writeContent(DIR, "manuscript/03-modern-noise.md", `---
title: Modern Noise
draft: 1
---

# Modern Noise

![Urban noise levels mapped](assets/image.png)

The modern city is, above all, a noisy place. The average ambient sound level in a European city centre is 72 decibels — roughly equivalent to a vacuum cleaner running continuously[^1]. In some cities — Mumbai, Cairo, New York — it exceeds 80 decibels, the threshold at which prolonged exposure causes measurable hearing loss.

This is a relatively recent phenomenon. As late as the 1950s, the dominant sound in most city centres was human conversation. The transformation happened in two stages: first, the explosion of motorised traffic in the 1960s and 1970s, and second, the proliferation of mechanical systems — air conditioning, ventilation, refrigeration — in the 1980s and 1990s.

The result is a soundscape in which human voices must compete with machines. And in this competition, the machines always win. They run 24 hours a day, 365 days a year. They never pause, never lower their volume, never fall silent. They create what acoustic ecologists call a "lo-fi" environment — one in which individual sounds are masked by a constant, undifferentiated drone.

${LOREM}

[^1]: World Health Organization, *Environmental Noise Guidelines for the European Region*, 2018.
`);

        expect(readFileSync(join(DIR, "manuscript", "03-modern-noise.md"), "utf-8")).toContain("72 decibels");
    });

    it("character command blocked for essay", () => {
        expect(() => run(`${CLI} add character "Test"`, DIR)).toThrow();
    });

    it("create contributor for author", () => {
        run(`${CLI} add author "Anna Verdi"`, DIR);
    });

    it("populate contributor bio", () => {
        writeContent(DIR, "contributors/anna-verdi.md", `---
name: Anna Verdi
roles:
    - author
---

# Anna Verdi

Anna Verdi is an Italian urbanist and essayist based in Milan. She holds a PhD in urban planning from the Politecnico di Milano and has published extensively on the relationship between sound, space, and community in European cities. Her previous books include *Città silenziose* (2019) and *Il rumore del progresso* (2022).
`);

        expect(readFileSync(join(DIR, "contributors", "anna-verdi.md"), "utf-8")).toContain("Milan");
    });

    it("check passes", () => {
        const out = run(`${CLI} check`, DIR);
        // Allow warnings, but no errors
        expect(out).toMatch(/0 error|All good/);
    });

    it("build all formats", { timeout: 30_000 }, () => {
        for (const fmt of ["html", "epub", "docx", "md"]) {
            run(`${CLI} build ${fmt}`, DIR);
            const files = readdirSync(join(DIR, "build")).filter((f) => f.endsWith(`.${fmt}`));
            expect(files.length, `expected ${fmt} file`).toBeGreaterThan(0);
        }
    });

    it("stats works", () => {
        const out = run(`${CLI} stats`, DIR);
        expect(out).toContain("The Architecture of Silence");
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// PAPER
// ─────────────────────────────────────────────────────────────────────────────

describe("integration: paper", () => {
    const DIR = join(SANDBOX, "int-paper");

    beforeAll(() => {
        mkdirSync(SANDBOX, { recursive: true });
        rmSync(DIR, { recursive: true, force: true });
        run(`${CLI} init int-paper --yes --type paper`, SANDBOX);
        installCover(DIR);
    });

    it("populate with realistic content", () => {
        writeContent(DIR, "config.yaml", `type: paper
title: "Effects of Urban Green Spaces on Mental Health"
subtitle: "A Systematic Review"
author:
    - "Dr. Sofia Bianchi"
    - "Prof. Luca Conti"

# Academic
abstract: "This systematic review examines the relationship between urban green spaces and mental health outcomes across 47 peer-reviewed studies published between 2015 and 2025. Results indicate consistent evidence that proximity to and usage of urban green spaces is associated with statistically significant reductions in self-reported anxiety (pooled OR 0.73, 95% CI 0.64–0.83), clinical depression (pooled OR 0.81, 95% CI 0.71–0.92), and physiological stress markers including cortisol levels and heart rate variability. Effect sizes were moderated by green space quality, accessibility, and socioeconomic context."
keywords:
    - urban green spaces
    - mental health
    - systematic review
    - anxiety
    - depression
    - nature-based interventions
doi: ""

language: en
genre: academic
isbn: ""
publisher: ""
edition: 1
date: "2026"
build_formats:
    - html
    - docx
theme: minimal
cover: ""
print_preset: a4
license: CC BY 4.0
license_url: "https://creativecommons.org/licenses/by/4.0/"
copyright: "© 2026 Bianchi & Conti"
`);

        writeContent(DIR, "synopsis.md", `# Effects of Urban Green Spaces on Mental Health

A systematic review of 47 empirical studies examining the association between urban green space access and mental health outcomes. The review covers quantitative research from 2015 to 2025 and finds consistent evidence for protective effects against anxiety, depression, and chronic stress.
`);

        writeContent(DIR, "abstract.md", `# Abstract

This systematic review examines the relationship between urban green spaces and mental health outcomes. We analyzed 47 peer-reviewed studies published between 2015 and 2025, finding consistent evidence that access to green spaces is associated with reduced anxiety, depression, and stress. Effect sizes varied by green space type, with forests and large parks showing the strongest associations. Socioeconomic factors moderated the relationship, with stronger effects observed in lower-income neighbourhoods where alternative recreational options are limited.
`);

        writeContent(DIR, "manuscript/01-introduction.md", `---
title: Introduction
draft: 1
---

# Introduction

The relationship between nature and human wellbeing has been a subject of inquiry since at least the 19th century[^1]. However, it is only in the last two decades that rigorous empirical research has begun to quantify these effects with the precision required for evidence-based urban planning.

The rapid urbanization of the 21st century has made this question increasingly urgent. By 2050, an estimated 68% of the world's population will live in cities (United Nations, 2018). The design of urban environments — and specifically the provision of green spaces within them — will directly shape the mental health of billions of people.

![Green space distribution map](assets/image.png)

Previous reviews have examined subsets of this literature (Gascon et al., 2015; Bratman et al., 2019), but none have attempted a comprehensive synthesis of the quantitative evidence across all major mental health outcomes. This review fills that gap.

${LOREM}

[^1]: See Olmsted's 1865 report on the therapeutic value of Yosemite Valley, which argued that contact with natural scenery was essential for the mental health of city dwellers.
`);

        writeContent(DIR, "manuscript/02-methodology.md", `---
title: Methodology
draft: 1
---

# Methodology

We conducted a systematic review following PRISMA guidelines (Page et al., 2021). The protocol was pre-registered with PROSPERO (registration number CRD42025000001).

## Search Strategy

Databases searched included PubMed, PsycINFO, Web of Science, and Scopus. Search terms combined three domains: (1) urban green space terminology ("green space" OR "park" OR "urban forest" OR "garden" OR "greenway"), (2) mental health outcomes ("anxiety" OR "depression" OR "stress" OR "wellbeing" OR "mental health"), and (3) study design ("cohort" OR "cross-sectional" OR "randomized" OR "longitudinal").

## Inclusion Criteria

- Published between January 2015 and December 2025
- Peer-reviewed original research (not reviews or commentaries)
- Quantitative measurement of at least one mental health outcome
- Urban or peri-urban setting (population density > 1,000/km²)
- Sample size ≥ 50 participants

## Quality Assessment

Study quality was assessed using the Newcastle-Ottawa Scale for observational studies and the Cochrane Risk of Bias tool for randomized controlled trials. Two reviewers independently assessed each study, with disagreements resolved by consensus.
`);

        expect(true).toBe(true);
    });

    it("add paper-specific commands", () => {
        run(`${CLI} add source "Olmsted Report" --author "Frederick Law Olmsted" --year "1865"`, DIR);
        run(`${CLI} add source "WHO Urban Health" --author "World Health Organization" --year "2021"`, DIR);
        run(`${CLI} add source "PRISMA 2020" --author "Page et al." --year "2021"`, DIR);
        run(`${CLI} add concept "Green space"`, DIR);
        run(`${CLI} add concept "Mental health"`, DIR);

        expect(existsSync(join(DIR, "concepts", "green-space.md"))).toBe(true);
    });

    it("populate concepts with definitions", () => {
        writeContent(DIR, "concepts/green-space.md", `---
term: Green space
related:
    - Mental health
---

# Green space

Urban green space refers to any vegetated area within or adjacent to a built-up zone, including parks, gardens, street trees, green roofs, and riparian corridors. For the purposes of this review, green space is defined as publicly accessible land with at least 50% vegetation cover and a minimum area of 0.5 hectares.

The quality of green space matters as much as its quantity. Well-maintained parks with diverse vegetation, water features, and low noise levels show stronger mental health associations than neglected or poorly designed green areas. Accessibility — measured as distance from residence, presence of walking paths, and absence of physical barriers — is equally important.
`);

        writeContent(DIR, "concepts/mental-health.md", `---
term: Mental health
related:
    - Green space
---

# Mental health

In this review, mental health is operationalized through three primary outcome measures: (1) self-reported anxiety, measured by validated instruments such as the GAD-7 or STAI; (2) clinical depression, measured by the PHQ-9, BDI-II, or clinical diagnosis; and (3) physiological stress, measured by salivary cortisol, heart rate variability, or skin conductance.

We distinguish between *clinical* mental health (the presence or absence of diagnosable disorders) and *positive* mental health (subjective wellbeing, life satisfaction, sense of purpose). Both are relevant to the green space literature, but the evidence base is stronger for clinical outcomes.
`);

        expect(readFileSync(join(DIR, "concepts", "green-space.md"), "utf-8")).toContain("vegetation");
    });

    it("create contributors for authors", () => {
        run(`${CLI} add author "Dr. Sofia Bianchi"`, DIR);
        run(`${CLI} add author "Prof. Luca Conti"`, DIR);
    });

    it("populate contributor bios", () => {
        writeContent(DIR, "contributors/dr-sofia-bianchi.md", `---
name: Dr. Sofia Bianchi
roles:
    - author
---

# Dr. Sofia Bianchi

Sofia Bianchi is a researcher in environmental psychology at the University of Padua, specializing in the health effects of urban nature. She holds a PhD from ETH Zurich and has published over thirty peer-reviewed articles on green space, mental health, and urban design. She leads the GreenMind Lab, a multidisciplinary research group studying the psychological impacts of urban greening interventions.
`);

        writeContent(DIR, "contributors/prof-luca-conti.md", `---
name: Prof. Luca Conti
roles:
    - author
---

# Prof. Luca Conti

Luca Conti is Professor of Public Health at the University of Bologna. His research focuses on the social determinants of health in urban populations, with particular attention to how the built environment shapes physical and mental wellbeing. He has served as an advisor to the WHO European Office on urban health policy.
`);

        expect(readFileSync(join(DIR, "contributors", "dr-sofia-bianchi.md"), "utf-8")).toContain("Padua");
    });

    it("check passes", () => {
        const out = run(`${CLI} check`, DIR);
        // Allow warnings, but no errors
        expect(out).toMatch(/0 error|All good/);
    });

    it("build all formats", { timeout: 30_000 }, () => {
        for (const fmt of ["html", "epub", "docx", "md"]) {
            run(`${CLI} build ${fmt}`, DIR);
            const files = readdirSync(join(DIR, "build")).filter((f) => f.endsWith(`.${fmt}`));
            expect(files.length, `expected ${fmt} file`).toBeGreaterThan(0);
        }
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// ARTICLE
// ─────────────────────────────────────────────────────────────────────────────

// ─────────────────────────────────────────────────────────────────────────────
// COLLECTION
// ─────────────────────────────────────────────────────────────────────────────

describe("integration: collection", () => {
    const DIR = join(SANDBOX, "int-collection");

    beforeAll(() => {
        mkdirSync(SANDBOX, { recursive: true });
        rmSync(DIR, { recursive: true, force: true });
        run(`${CLI} init int-collection --yes --type collection`, SANDBOX);
        installCover(DIR);
    });

    it("populate with realistic multi-author content", () => {
        writeContent(DIR, "config.yaml", `type: collection
title: "Voices of the City"
subtitle: "An Anthology of Urban Stories"
author:
    - "Maria Russo"
    - "Ahmed Farooq"
    - "Yuki Tanaka"
language: en
genre: fiction
isbn: ""
publisher: "City Press"
edition: 1
date: "2026"
build_formats:
    - html
    - epub
theme: default
cover: ""
print_preset: trade
license: All rights reserved
license_url: ""
copyright: "© 2026 City Press"
`);

        writeContent(DIR, "synopsis.md", `# Voices of the City

An anthology of three short stories set in the same unnamed city, each told from a different perspective. Maria watches the city from her balcony, Ahmed rides the night bus through its sleeping streets, and Yuki leaves paper cranes in its coffee shops. Together, the stories form a mosaic of urban life — its loneliness, its rituals, and its unexpected moments of connection.
`);

        writeContent(DIR, "backcover.md", `# Back Cover

*Three writers. One city. A thousand stories.*

**Voices of the City** brings together three of the most exciting voices in contemporary short fiction. Maria Russo, Ahmed Farooq, and Yuki Tanaka each contribute a story set in the same unnamed city — a place that feels simultaneously like everywhere and nowhere.

These are stories about the people who inhabit the margins of urban life: the early risers, the night owls, the ones who leave traces of beauty in unexpected places.
`);

        writeContent(DIR, "manuscript/01-the-balcony.md", `---
chapter: 1
title: The Balcony
author: Maria Russo
draft: 2
---

# The Balcony

Maria watched the city wake up from her balcony[^1]. Coffee in one hand, cigarette in the other — the last of her old habits.

Below, the market was already stirring. Voices calling, crates thudding, the smell of fresh bread rising through the morning air like a promise.

![View from the balcony](assets/image.png)

She had lived in this apartment for eleven years. Before that, she had lived in seven other apartments in four other cities, each one smaller and more temporary than the last. But this one — with its cracked ceiling and its temperamental plumbing and its view of the market square — this one felt permanent. This one felt like home.

The coffee was strong and bitter, the way her mother used to make it. Maria had inherited many things from her mother: her dark eyes, her stubborn streak, her inability to forgive a slight. The coffee recipe was perhaps the most useful of these inheritances.

She leaned against the railing and watched a man below setting up his fruit stall. He arranged the oranges in a perfect pyramid, each one touching exactly four others. It was a small act of beauty that nobody would notice — except Maria, who noticed everything from this height.

"You see differently from a balcony," she had once told a friend. "You see the patterns. The way the delivery trucks arrive in a specific order every morning. The way the pigeons always land on the same three windowsills. The way the old woman on the corner crosses herself before crossing the street, every single time, without fail."

The friend had not understood. But the friend lived on the ground floor.

The market was in full swing now. The fish vendor was arguing with a customer, gesturing with a whole sea bass for emphasis. Two children were chasing a cat between the stalls. A teenager sat on the fountain's edge, headphones on, completely absent from the scene around her.

Maria finished her coffee and stubbed out the cigarette. Time to go inside. Time to start the day. But she lingered another moment, watching the light change as the sun cleared the rooftops across the square.

Every morning, this same light. Every morning, this same city. And every morning, something slightly different — a new face, a new sound, a new shadow falling at an unexpected angle. It was, she thought, enough.

[^1]: The balcony faces south-east, which means she gets the morning sun until about 10 a.m. She has timed this precisely.
`);

        writeContent(DIR, "manuscript/02-the-night-bus.md", `---
chapter: 2
title: The Night Bus
author: Ahmed Farooq
draft: 1
---

# The Night Bus

The 47 runs all night. Ahmed knows every stop, every driver, every regular. He's been riding it for three years now — ever since he lost the apartment.

Tonight there's a woman crying in the back row. He pretends not to notice. Everyone on the night bus pretends not to notice. It's one of the unwritten rules, along with "don't make eye contact after midnight" and "the back seat belongs to whoever gets there first."

The driver tonight is Carla. She's the best of the night drivers — smooth on the turns, gentle on the brakes, and she keeps the heating on even in spring. Ahmed likes Carla. She never asks questions.

The bus passes through the old quarter, where the streets narrow and the buildings lean towards each other like conspirators. Through the window, Ahmed watches the city in its sleep — the shuttered shops, the streetlights reflected in rain-washed cobblestones, the occasional figure hurrying home or hurrying away from home.

At the hospital stop, a nurse gets on. She's still wearing her scrubs, blue with a pattern of small flowers that seems too cheerful for someone who looks this tired. She sits across from Ahmed and closes her eyes immediately. Within thirty seconds, she's asleep. Ahmed watches the slight rise and fall of her breathing and feels an unexpected tenderness.

The bus continues its route — through the new development with its glass towers and empty plazas, past the railway station where a group of teenagers are sitting on the steps sharing a phone screen, along the river where the weeping willows trail their branches in the current like fingers testing the temperature of a bath.

Ahmed has mapped the entire city from the window of the 47. He knows which buildings have lights on at 3 a.m. and which are always dark. He knows where the foxes cross the road and where the owls perch on the telephone wires. He knows the rhythm of the traffic lights — green, amber, red, the patient pulse of a city that never quite stops beating.

The woman in the back row has stopped crying. She gets off at the next stop without looking at anyone. Ahmed watches her walk away into the darkness between two streetlights, then she's gone.

Two more hours until dawn. Ahmed settles deeper into his seat and watches the city scroll past, frame by frame, like a film that never ends and never quite begins.
`);

        writeContent(DIR, "manuscript/03-paper-cranes.md", `---
chapter: 3
title: Paper Cranes
author: Yuki Tanaka
draft: 1
---

# Paper Cranes

Yuki folds a crane from the receipt of her morning coffee. She leaves it on the counter when she goes. The barista collects them — there are hundreds now, pinned to the wall behind the register.

Nobody knows who makes them. Yuki likes it that way.

She learned to fold cranes from her grandmother in Kyoto, who could make one in under thirty seconds with her eyes closed. "A thousand cranes for a wish," her grandmother used to say. "But the wish only works if you don't tell anyone what it is."

Yuki has never counted how many she's made. She doesn't want to know. Counting would turn the practice into a project, with a goal and a deadline and a measurable outcome. She doesn't want measurable outcomes. She wants the quiet pleasure of folding paper in a coffee shop while the espresso machine hisses and the morning light angles through the window.

The cranes are made from whatever paper is available: receipts, napkins, pages torn from free newspapers, the cardboard sleeves of takeaway cups. Each one is different — different size, different colour, different texture. But the folds are always the same. Twenty-three folds, in the same order, every time. Mountain fold, valley fold, mountain fold. It is a meditation, a prayer, a way of being in the world without demanding anything from it.

Today she uses the receipt from a bookshop across the street. She bought a novel she'll never read — she buys novels the way other people buy lottery tickets, as small investments in possibility. The receipt is long and thin, which makes for a slender crane with disproportionately large wings. She likes it. She sets it on the counter next to her empty cup and leaves.

Outside, the city is doing what cities do: being loud, being busy, being indifferent to the small acts of beauty happening in its margins. Yuki walks home through the park, where the cherry trees are just beginning to bloom, and thinks about nothing at all.
`);

        expect(true).toBe(true);
    });

    it("add contributors", () => {
        run(`${CLI} add author "Maria Russo"`, DIR);
        run(`${CLI} add author "Ahmed Farooq"`, DIR);
        run(`${CLI} add author "Yuki Tanaka"`, DIR);

        expect(existsSync(join(DIR, "contributors", "maria-russo.md"))).toBe(true);
        expect(existsSync(join(DIR, "contributors", "ahmed-farooq.md"))).toBe(true);
        expect(existsSync(join(DIR, "contributors", "yuki-tanaka.md"))).toBe(true);
    });

    it("populate contributor bios", () => {
        writeContent(DIR, "contributors/maria-russo.md", `---
name: Maria Russo
roles:
    - author
---

# Maria Russo

Maria Russo is an Italian-American writer based in Brooklyn. Her stories have appeared in *The New Yorker* and *Granta*.
`);

        writeContent(DIR, "contributors/ahmed-farooq.md", `---
name: Ahmed Farooq
roles:
    - author
---

# Ahmed Farooq

Ahmed Farooq writes about displacement and belonging. He was born in Lahore and lives in London.
`);

        writeContent(DIR, "contributors/yuki-tanaka.md", `---
name: Yuki Tanaka
roles:
    - author
---

# Yuki Tanaka

Yuki Tanaka is a poet and short story writer from Kyoto, now living in New York.
`);

        expect(true).toBe(true);
    });

    it("character command blocked for collection", () => {
        expect(() => run(`${CLI} add character "Test"`, DIR)).toThrow();
    });

    it("check passes", () => {
        const out = run(`${CLI} check`, DIR);
        // Allow warnings, but no errors
        expect(out).toMatch(/0 error|All good/);
    });

    it("build all formats", { timeout: 30_000 }, () => {
        for (const fmt of ["html", "epub", "docx", "md"]) {
            run(`${CLI} build ${fmt}`, DIR);
            const files = readdirSync(join(DIR, "build")).filter((f) => f.endsWith(`.${fmt}`));
            expect(files.length, `expected ${fmt} file`).toBeGreaterThan(0);
        }
    });

    it("html contains all authors", () => {
        const files = readdirSync(join(DIR, "build")).filter((f) => f.endsWith(".html"));
        const html = readFileSync(join(DIR, "build", files[0]), "utf-8");
        expect(html).toContain("Maria Russo");
        expect(html).toContain("Ahmed Farooq");
        expect(html).toContain("Yuki Tanaka");
    });

    it("stats works", () => {
        const out = run(`${CLI} stats`, DIR);
        expect(out).toContain("Voices of the City");
        expect(out).toContain("3"); // 3 chapters
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// TYPE-SPECIFIC CONTENT CHECKS
// ─────────────────────────────────────────────────────────────────────────────

describe("content verification", () => {
    it("novel: characters have aliases", () => {
        const content = readFileSync(join(SANDBOX, "int-novel", "characters", "elena-rossi.md"), "utf-8");
        expect(content).toContain("aliases");
        expect(content).toContain("la professoressa");
    });

    it("novel: second character has content (renamed)", () => {
        const content = readFileSync(join(SANDBOX, "int-novel", "characters", "giovanni-moretti.md"), "utf-8");
        expect(content).toContain("antagonist");
    });

    it("novel: world has locations with descriptions", () => {
        expect(existsSync(join(SANDBOX, "int-novel", "world", "piazza-del-duomo.md"))).toBe(true);
        const loc = readFileSync(join(SANDBOX, "int-novel", "world", "piazza-del-duomo.md"), "utf-8");
        expect(loc).toContain("Renaissance-era");
    });

    it("novel: outline plot has acts", () => {
        const plot = readFileSync(join(SANDBOX, "int-novel", "outline", "plot.md"), "utf-8");
        expect(plot).toContain("Act 1");
        expect(plot).toContain("Act 2");
        expect(plot).toContain("Act 3");
    });

    it("novel: outline chapters have content", () => {
        const ch1 = readFileSync(join(SANDBOX, "int-novel", "outline", "chapters", "01.md"), "utf-8");
        expect(ch1).toContain("Marco arrives");
        const ch2 = readFileSync(join(SANDBOX, "int-novel", "outline", "chapters", "02.md"), "utf-8");
        expect(ch2).toContain("storm");
    });

    it("novel: timeline has events", () => {
        const timeline = readFileSync(join(SANDBOX, "int-novel", "timeline.yaml"), "utf-8");
        expect(timeline).toContain("Marco arrives");
    });

    it("novel: contributor bios populated", () => {
        const elena = readFileSync(join(SANDBOX, "int-novel", "contributors", "elena-rossi.md"), "utf-8");
        expect(elena).toContain("Naples");
        const john = readFileSync(join(SANDBOX, "int-novel", "contributors", "john-smith.md"), "utf-8");
        expect(john).toContain("literary translator");
    });

    it("novel: notes have content", () => {
        const note = readFileSync(join(SANDBOX, "int-novel", "notes", "research-on-italian-fountains.md"), "utf-8");
        expect(note).toContain("Fontana di Trevi");
    });

    it("novel: reports populated", () => {
        const status = readFileSync(join(SANDBOX, "int-novel", "build", "reports", "status.md"), "utf-8");
        expect(status).toContain("The Fountain");
        expect(status).toContain("Total words");
    });

    it("essay: thesis.md present", () => {
        expect(existsSync(join(SANDBOX, "int-essay", "thesis.md"))).toBe(true);
        const thesis = readFileSync(join(SANDBOX, "int-essay", "thesis.md"), "utf-8");
        expect(thesis).toContain("silence");
    });

    it("essay: arguments have body text", () => {
        const arg = readFileSync(join(SANDBOX, "int-essay", "arguments", "silence-is-essential-for-community-formation.md"), "utf-8");
        expect(arg).toContain("WHO");
        expect(arg).toContain("Support");
        expect(arg).toContain("Counterpoint");
    });

    it("essay: concepts have definitions", () => {
        const concept = readFileSync(join(SANDBOX, "int-essay", "concepts", "soundscape.md"), "utf-8");
        expect(concept).toContain("Schafer");
    });

    it("essay: contributor bio populated", () => {
        const bio = readFileSync(join(SANDBOX, "int-essay", "contributors", "anna-verdi.md"), "utf-8");
        expect(bio).toContain("Milan");
    });

    it("paper: abstract.md present", () => {
        expect(existsSync(join(SANDBOX, "int-paper", "abstract.md"))).toBe(true);
    });

    it("paper: config has abstract and keywords", () => {
        const config = readFileSync(join(SANDBOX, "int-paper", "config.yaml"), "utf-8");
        expect(config).toContain("abstract:");
        expect(config).toContain("keywords:");
        expect(config).toContain("urban green spaces");
    });

    it("paper: bibliography has sources", () => {
        const bib = readFileSync(join(SANDBOX, "int-paper", "bibliography.yaml"), "utf-8");
        expect(bib).toContain("Olmsted");
        expect(bib).toContain("PRISMA");
    });

    it("paper: concepts have definitions", () => {
        const concept = readFileSync(join(SANDBOX, "int-paper", "concepts", "green-space.md"), "utf-8");
        expect(concept).toContain("vegetation");
    });

    it("paper: contributor bios populated", () => {
        const bio = readFileSync(join(SANDBOX, "int-paper", "contributors", "dr-sofia-bianchi.md"), "utf-8");
        expect(bio).toContain("Padua");
    });

    it("paper: multiple authors", () => {
        const config = readFileSync(join(SANDBOX, "int-paper", "config.yaml"), "utf-8");
        expect(config).toContain("Sofia Bianchi");
        expect(config).toContain("Luca Conti");
    });

    it("collection: synopsis present", () => {
        const synopsis = readFileSync(join(SANDBOX, "int-collection", "synopsis.md"), "utf-8");
        expect(synopsis).toContain("mosaic");
    });

    it("collection: html contains all authors", () => {
        const files = readdirSync(join(SANDBOX, "int-collection", "build")).filter((f) => f.endsWith(".html"));
        const html = readFileSync(join(SANDBOX, "int-collection", "build", files[0]), "utf-8");
        expect(html).toContain("Maria Russo");
        expect(html).toContain("Ahmed Farooq");
        expect(html).toContain("Yuki Tanaka");
    });

    it("collection: per-piece authors in frontmatter", () => {
        const ch1 = readFileSync(join(SANDBOX, "int-collection", "manuscript", "01-the-balcony.md"), "utf-8");
        expect(ch1).toContain("author: Maria Russo");
    });

});

// ─────────────────────────────────────────────────────────────────────────────
// EDGE CASES
// ─────────────────────────────────────────────────────────────────────────────

describe("edge cases", () => {
    const DIR = join(SANDBOX, "int-edge");

    beforeAll(() => {
        rmSync(DIR, { recursive: true, force: true });
        run(`${CLI} init int-edge --yes --type novel`, SANDBOX);
    });

    it("chapter with special characters", () => {
        run(`${CLI} add chapter "L'été à Paris"`, DIR);
        const files = readdirSync(join(DIR, "manuscript"));
        expect(files.some((f) => f.includes("l-ete-a-paris"))).toBe(true);
    });

    it("character with accented name", () => {
        run(`${CLI} add character "José García"`, DIR);
        expect(existsSync(join(DIR, "characters", "jose-garcia.md"))).toBe(true);
    });

    it("remove nonexistent chapter shows error", () => {
        expect(() => run(`${CLI} remove chapter 99`, DIR)).toThrow();
    });

    it("rename nonexistent character shows error", () => {
        expect(() => run(`${CLI} rename character "Nobody" "Somebody"`, DIR)).toThrow();
    });

    it("build with empty project works", () => {
        const emptyDir = join(SANDBOX, "int-empty");
        rmSync(emptyDir, { recursive: true, force: true });
        run(`${CLI} init int-empty --yes --type essay`, SANDBOX);
        // Remove the sample chapter
        rmSync(join(emptyDir, "manuscript", "01-introduction.md"), { force: true });
        // Build should warn but not crash
        const out = run(`${CLI} build html`, emptyDir);
        expect(out).toContain("No chapters");
    });
});
