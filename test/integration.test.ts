/**
 * Integration tests — create fully populated projects for each type,
 * run all commands, build all formats, and verify output.
 *
 * Projects are left in sandbox/ for manual inspection.
 * Run: npx vitest run test/integration.test.ts
 */

import { describe, it, expect, beforeAll } from "vitest";
import { execSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync, mkdirSync, readdirSync, copyFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = process.cwd();
const CLI = `node ${join(ROOT, "dist", "cli.js")}`;
const SANDBOX = join(ROOT, "sandbox");
const COVER_MOCKUP = join(ROOT, "assets", "cover-mockup.png");

function installCover(projectDir: string): void {
    const assetsDir = join(projectDir, "assets");
    mkdirSync(assetsDir, { recursive: true });
    if (existsSync(COVER_MOCKUP)) {
        copyFileSync(COVER_MOCKUP, join(assetsDir, "cover.png"));
    }
}

function run(cmd: string, cwd?: string): string {
    return execSync(cmd, {
        cwd: cwd ?? ROOT,
        encoding: "utf-8",
        timeout: 60_000,
    });
}

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
        if (!existsSync(DIR)) {
            run(`${CLI} init int-novel --yes --type novel`, SANDBOX);
        }
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

Marco reached the heavy wooden door and knocked three times.

- First knock: silence
- Second knock: a shuffle of feet
- Third knock: the door creaked open

"You're late," whispered Elena. "Come in before someone sees you."

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

Tall, dark hair streaked with grey. Sharp eyes behind round glasses.

## Personality

Intelligent, cautious, loyal. Hides her fear behind sarcasm.

## Backstory

Professor of archaeology at the University of Rome. She was the one who found the first clue about the fountain.

## Arc

From reluctant ally to active participant in uncovering the truth.
`);

        const content = readFileSync(join(DIR, "characters", "elena-rossi.md"), "utf-8");
        expect(content).toContain("la professoressa");
        expect(content).toContain("aliases");
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

    it("stats works", () => {
        const out = run(`${CLI} stats`, DIR);
        expect(out).toContain("The Fountain of Secrets");
        expect(out).toContain("Total words");
        expect(out).toContain("Chapters");
    });

    it("build html works", () => {
        run(`${CLI} build html`, DIR);
        const files = readdirSync(join(DIR, "build")).filter((f) => f.endsWith(".html"));
        expect(files.length).toBeGreaterThan(0);
        const html = readFileSync(join(DIR, "build", files[0]), "utf-8");
        expect(html).toContain("The Fountain");
        expect(html).toContain("footnote");
        expect(html).toContain("cover-image");
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
        expect(md).toContain("Colophon");
    });

    it("reports generated", () => {
        expect(existsSync(join(DIR, "build", "reports", "status.md"))).toBe(true);
        expect(existsSync(join(DIR, "build", "reports", "cast.md"))).toBe(true);
        expect(existsSync(join(DIR, "build", "reports", "locations.md"))).toBe(true);
        expect(existsSync(join(DIR, "build", "reports", "timeline.md"))).toBe(true);
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
        if (!existsSync(DIR)) {
            run(`${CLI} init int-essay --yes --type essay`, SANDBOX);
        }
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

    it("character command blocked for essay", () => {
        expect(() => run(`${CLI} add character "Test"`, DIR)).toThrow();
    });

    it("create contributor for author", () => {
        run(`${CLI} add author "Anna Verdi"`, DIR);
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
        if (!existsSync(DIR)) {
            run(`${CLI} init int-paper --yes --type paper`, SANDBOX);
        }
        installCover(DIR);
    });

    it("populate with realistic content", () => {
        writeContent(DIR, "config.yaml", `type: paper
title: "Effects of Urban Green Spaces on Mental Health"
subtitle: "A Systematic Review"
author:
    - "Dr. Sofia Bianchi"
    - "Prof. Luca Conti"
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

        writeContent(DIR, "abstract.md", `# Abstract

This systematic review examines the relationship between urban green spaces and mental health outcomes. We analyzed 47 peer-reviewed studies published between 2015 and 2025, finding consistent evidence that access to green spaces is associated with reduced anxiety, depression, and stress.
`);

        writeContent(DIR, "manuscript/01-introduction.md", `---
title: Introduction
draft: 1
---

# Introduction

The relationship between nature and human wellbeing has been a subject of inquiry since at least the 19th century[^1]. However, it is only in the last two decades that rigorous empirical research has begun to quantify these effects.

[^1]: See Olmsted's 1865 report on the therapeutic value of Yosemite Valley.
`);

        writeContent(DIR, "manuscript/02-methodology.md", `---
title: Methodology
draft: 1
---

# Methodology

We conducted a systematic review following PRISMA guidelines. Databases searched included PubMed, PsycINFO, and Web of Science.

## Inclusion Criteria

- Published 2015–2025
- Peer-reviewed
- Quantitative mental health outcomes
- Urban setting
`);

        expect(true).toBe(true);
    });

    it("add paper-specific commands", () => {
        run(`${CLI} add source "Olmsted Report" --author "Frederick Law Olmsted" --year "1865"`, DIR);
        run(`${CLI} add source "WHO Urban Health" --author "World Health Organization" --year "2021"`, DIR);
        run(`${CLI} add concept "Green space"`, DIR);
        run(`${CLI} add concept "Mental health"`, DIR);

        expect(existsSync(join(DIR, "concepts", "green-space.md"))).toBe(true);
    });

    it("create contributors for authors", () => {
        run(`${CLI} add author "Dr. Sofia Bianchi"`, DIR);
        run(`${CLI} add author "Prof. Luca Conti"`, DIR);
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

describe("integration: article", () => {
    const DIR = join(SANDBOX, "int-article");

    beforeAll(() => {
        mkdirSync(SANDBOX, { recursive: true });
        if (!existsSync(DIR)) {
            run(`${CLI} init int-article --yes --type article`, SANDBOX);
        }
        installCover(DIR);
    });

    it("populate with realistic content", () => {
        writeContent(DIR, "config.yaml", `type: article
title: "Why Every Developer Should Write a Book"
author: "Stefano Caronia"
language: en
genre: technology
isbn: ""
publisher: ""
edition: 1
date: ""
build_formats:
    - html
    - md
theme: minimal
cover: ""
print_preset: a4
license: All rights reserved
license_url: ""
copyright: "© 2026 Stefano Caronia"
`);

        writeContent(DIR, "manuscript/01-draft.md", `---
title: Why Every Developer Should Write a Book
draft: 1
---

# Why Every Developer Should Write a Book

You don't need to be a bestselling author. You don't need a publisher. You don't even need a finished manuscript to start.

**Writing a book is the best way to organize your knowledge.** When you write, you discover what you actually know and what you only think you know.

## The Process Is the Product

Most developers think the goal is the finished book. It's not. The goal is the *thinking* that writing forces you to do.

## Tools Matter Less Than You Think

You can write a book in:

- Markdown files in a git repo
- Google Docs
- A fancy writing app
- A napkin

The tool doesn't matter. **Consistency matters.**

> "The first draft of anything is garbage." — Hemingway (probably)
`);

        expect(true).toBe(true);
    });

    it("character and location commands blocked", () => {
        expect(() => run(`${CLI} add character "Test"`, DIR)).toThrow();
        expect(() => run(`${CLI} add location "Test"`, DIR)).toThrow();
    });

    it("create contributor for author", () => {
        run(`${CLI} add author "Stefano Caronia"`, DIR);
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
// COLLECTION
// ─────────────────────────────────────────────────────────────────────────────

describe("integration: collection", () => {
    const DIR = join(SANDBOX, "int-collection");

    beforeAll(() => {
        mkdirSync(SANDBOX, { recursive: true });
        if (!existsSync(DIR)) {
            run(`${CLI} init int-collection --yes --type collection`, SANDBOX);
        }
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

        writeContent(DIR, "manuscript/01-the-balcony.md", `---
chapter: 1
title: The Balcony
author: Maria Russo
draft: 2
---

# The Balcony

Maria watched the city wake up from her balcony. Coffee in one hand, cigarette in the other — the last of her old habits.

Below, the market was already stirring. Voices calling, crates thudding, the smell of fresh bread rising through the morning air.
`);

        writeContent(DIR, "manuscript/02-the-night-bus.md", `---
chapter: 2
title: The Night Bus
author: Ahmed Farooq
draft: 1
---

# The Night Bus

The 47 runs all night. Ahmed knows every stop, every driver, every regular. He's been riding it for three years now — ever since he lost the apartment.

Tonight there's a woman crying in the back row. He pretends not to notice. Everyone on the night bus pretends not to notice.
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
