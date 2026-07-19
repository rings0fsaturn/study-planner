# UI Decisions — <feature / screen name>

<!--
  The running record of a grill-me-with-mocks session. Append one entry per
  decision, in the order they were made (dependency order). Written for a
  reader who wasn't in the room — an implementing agent, or you in three
  weeks. "Chose B" is useless later; capture the tradeoff that made B win.
-->

## Handoff summary

- **Screen:** <what this screen is and what it's for>
- **Baseline mode:** <A = refine known layout / B = discover layout / mixed>
- **Final working mock:** [`final.html`](./final.html)
- **Baseline mock:** [`baseline.html`](./baseline.html)
- **Status:** <in progress / complete — N decisions made, M branches left open>
- **Next step:** <implementation plan pointer, e.g. .work/plans/<feature>/ >

Open branches not yet decided (if any):

- <branch> — <why it was deferred>

---

## Decisions

### Decision 01 — <title>

- **Date:** <YYYY-MM-DD>
- **Question:** <the exact decision that had to be made>
- **Applies to baseline state:** <e.g. baseline after decision 00, or "initial baseline">
- **Mock:** [`decisions/decision-01-<slug>.html`](./decisions/decision-01-<slug>.html)
- **Variations considered:**
  - **A —** <one-line description>
  - **B —** <one-line description>
  - **C —** <one-line description>
- **Chosen:** **B**
- **Why:** <the tradeoff that made B win, in the user's terms + yours. Note
  explicitly why the rejected options were rejected — that reasoning is what
  stops the decision being reopened pointlessly later.>
- **Folded into baseline:** yes

### Decision 02 — <title>

- **Date:** <YYYY-MM-DD>
- **Question:** <...>
- **Applies to baseline state:** after decision 01
- **Mock:** [`decisions/decision-02-<slug>.html`](./decisions/decision-02-<slug>.html)
- **Variations considered:**
  - **A —** <...>
  - **B —** <...>
- **Chosen:** **A**
- **Why:** <...>
- **Folded into baseline:** yes

<!--
  If a later decision overturns an earlier one, DON'T edit the old entry.
  Add a new entry and note the supersession, e.g.:

  ### Decision 07 — revisit auth-code input (supersedes Decision 01)
  ... Chose the single wide field after all, because the code turned out to be
  variable-length for AU merchants, which breaks the 6-box treatment.
-->
