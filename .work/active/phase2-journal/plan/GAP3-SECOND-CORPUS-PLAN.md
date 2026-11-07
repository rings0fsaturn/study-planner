# Gap 3 plan - second-corpus generalization (2026-10-22)

_Goal: show hybrid + rerank levers generalize beyond the ACCA book by repeating the 3-arm harness on the 632-page fixture, so the paper's retrieval claim is not single-corpus._

## Ground facts

- Fixture `e2e/pdf/sample-textbook-632page.pdf` exists but no live scenario references it (rule 16). Its subject and chunk yield are unconfirmed.
- Blocker: `probe_questions.json` snippets are ACCA-specific and will not match a different book. A new verified gold set is required, not optional.
- Queued upstream as `retrieval-followups-2nd-corpus` (STATUS).

## Steps

1. Identify the 632-page fixture (subject, pages); ingest it as a new stable material via the live ingestion path (service + worker + sidecar).
2. Author a ~30-question gold set with verified answer snippets for corpus 2 (same schema as `probe_questions.json`: label, question, answerSnippet). Dry-run the snippet check (every snippet must hit at least one chunk) before any model spend.
3. Run the gap-1 driver recipe (dense / hybrid / hybrid+rerank, top-50, same RRF params) against corpus 2.
4. Write `research/doc/2026-XX-second-corpus.md` (both corpora side by side: deltas per arm, not just absolutes) + JSON; close gap 3 in the brief.

## Acceptance

- Corpus 2 chunk count + 0-NULL check recorded; gold set 100% snippet-hit before the run.
- Reported per arm: r@k/MRR on corpus 2 + delta-vs-corpus-1 comparison. A shrink or reversal is an honest-limits result.

## Cost

- One full-book ingest + GPU embed (minutes) + 30 rerank calls; no paid APIs except whatever the ingestion path itself uses. Heaviest of the retrieval gaps; do not parallelize with other live sessions.
