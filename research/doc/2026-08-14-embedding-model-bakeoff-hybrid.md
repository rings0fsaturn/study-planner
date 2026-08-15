# Embedding model bake-off

- Corpus: `788` chunks of material `80c8b138-b544-4095-8dc0-1c390ac70da2` (572-page ACCA APM study text)
- Questions: `30` (verified answer snippets)
- Retrieval: `hybrid (BM25 + dense RRF)`
- Gemini pacing: `25000` tokens/min sliding window

| model | recall@1 | recall@3 | recall@5 | MRR | mean top sim | corpus (s) | chunks/min | load (s) | peak RSS (MB) |
|---|---|---|---|---|---|---|---|---|---|
| qwen | 0.73 | 0.90 | 0.93 | 0.816 | 0.662 | 0.0 | 0.0 | 7.1 | 0.0 |

## qwen

- Backend: `local`
- Questions answered: `30/30`

| Q | answer chunk | rank |
|---|---|---|
| 1 | 115 | 1 |
| 2 | 115 | 1 |
| 3 | 202 | 1 |
| 4 | 230 | 1 |
| 5 | 526 | 3 |
| 6 | 270 | 2 |
| 7 | 716 | 1 |
| 8 | 153 | 1 |
| 9 | 673 | 1 |
| 10 | 721 | 1 |
| 11 | 732 | 1 |
| 12 | 693 | 1 |
| 13 | 331 | 1 |
| 14 | 304 | 1 |
| 15 | 526 | 13 |
| 16 | 573 | 1 |
| 17 | 135 | 1 |
| 18 | 139 | 3 |
| 19 | 360 | 1 |
| 20 | 307 | 1 |
| 21 | 494 | 1 |
| 22 | 641 | 1 |
| 23 | 100 | 2 |
| 24 | 116 | 1 |
| 25 | 362 | 1 |
| 26 | 460 | 5 |
| 27 | 131 | 27 |
| 28 | 366 | 1 |
| 29 | 23 | 2 |
| 30 | 461 | 1 |
