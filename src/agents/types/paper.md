# writekit — Paper: Editorial Conventions

This project is an **academic paper**. Follow these editorial, structural, and citation conventions.

## Paper structure

Academic papers follow a standard structure. The exact sections depend on the discipline, but the common pattern is:

1. **Title page** — title, author(s), affiliation(s), date, abstract
2. **Abstract** — 150–300 words summarizing the paper's purpose, method, results, and conclusion
3. **Introduction** — states the research question, context, and significance
4. **Literature review / Background** — surveys existing work on the topic
5. **Methodology** (empirical papers) — describes how the research was conducted
6. **Results / Findings** — presents the data or analysis
7. **Discussion** — interprets results, compares with existing work, acknowledges limitations
8. **Conclusion** — summarizes contributions, suggests future work
9. **References / Bibliography** — all cited sources

Not all papers need all sections. Theoretical papers may omit Methodology and Results. Humanities papers may combine Literature Review with Discussion.

## Formatting standards

- **Font**: Times New Roman, 12pt (APA/MLA) or as specified by the target venue
- **Spacing**: Double-spaced throughout (APA). Single-space footnotes and block quotes.
- **Margins**: 1 inch (2.54 cm) on all sides
- **Page numbers**: Top right or bottom center, starting from the title page
- **Headings**: Use a consistent hierarchy (Level 1: centered bold, Level 2: left-aligned bold, Level 3: indented bold italic — APA style)

## Citation conventions

### In-text citations
- **APA**: (Author, Year) — e.g., (Smith, 2023)
- **MLA**: (Author Page) — e.g., (Smith 42)
- **Chicago**: Footnotes or (Author Year) depending on variant
- **IEEE**: Numbered references [1], [2], [3]

Read `style.yaml` and `config.yaml` for any indication of the preferred citation style.

### Bibliography
- `bibliography.yaml` contains all sources with: author, title, year, url
- Every in-text citation must have a corresponding entry in the bibliography
- Every bibliography entry should be cited at least once in the text
- References are ordered alphabetically by author's last name (APA/MLA/Chicago) or by order of appearance (IEEE)

### Citation integrity
- **Never fabricate citations.** Only cite sources that exist in `bibliography.yaml` or `reference/`.
- If a claim needs a source and none is available, flag it rather than inventing one.
- Use `wk add source` to add new sources properly.

## Sections in manuscript/

- Each major section is a file in `manuscript/`: `01-introduction.md`, `02-literature-review.md`, etc.
- The abstract can be in `synopsis.md` or as the first section
- Use heading levels consistently: `#` for the section title, `##` for subsections

## Tables and figures

- Tables and figures should be referenced in the text before they appear
- Number them sequentially (Table 1, Table 2; Figure 1, Figure 2)
- Each should have a descriptive caption
- Place supporting images in `assets/`

## Academic writing conventions

- Use objective, formal language (third person unless the discipline accepts first person)
- Define technical terms on first use
- Avoid hedging without cause, but don't overclaim
- Acknowledge limitations of your work
- Distinguish between your analysis and others' work — always attribute
