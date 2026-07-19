---
name: ieee-conference-authoring
description: Follow IEEE conference conventions for title matter, authors, abstracts, sections, and appendices.
---

# IEEE Conference Authoring

Keep the title and abstract free of math, citations, footnotes, and unsupported special symbols.
Use `IEEEauthorblockN`, `IEEEauthorblockA`, and `\and` inside `\author{}` for the normal conference author layout.
Use `\IEEEauthorrefmark` when multiple affiliations require the long form.
Preserve left-to-right author order because indexing services use that order.

Use an `IEEEkeywords` block with plain searchable terms.
Use the venue's required acknowledgment spelling and heading.
Do not add a hand-written References section when the bibliography environment generates it.

Use `\appendix[Title]` for one appendix.
Use `\appendices` followed by sections for multiple appendices.
Do not copy report-class chapter or author formatting into the IEEE paper.

Review the rendered two-column title area, author block, section hierarchy, and appendix numbering after structural edits.
