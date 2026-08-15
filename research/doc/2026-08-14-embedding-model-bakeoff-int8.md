# Embedding model bake-off

- Corpus: `788` chunks of material `80c8b138-b544-4095-8dc0-1c390ac70da2` (572-page ACCA APM study text)
- Questions: `30` (verified answer snippets)
- Retrieval: `hybrid (BM25 + dense RRF)`
- Gemini pacing: `25000` tokens/min sliding window

| model | recall@1 | recall@3 | recall@5 | MRR | mean top sim | corpus (s) | chunks/min | load (s) | peak RSS (MB) |
|---|---|---|---|---|---|---|---|---|---|
| qwen | 0.10 | 0.10 | 0.10 | 0.131 | 0.967 | 290.7 | 162.7 | 3.5 | 0.0 |

## qwen

- Backend: `local`
- Questions answered: `30/30`

| Q | answer chunk | rank |
|---|---|---|
| 1 | 115 | 1 |
| 2 | 115 | 28 |
| 3 | 202 | 1 |
| 4 | 230 | 28 |
| 5 | 526 | 42 |
| 6 | 270 | 30 |
| 7 | 716 | 32 |
| 8 | 153 | 29 |
| 9 | 673 | 28 |
| 10 | 721 | 31 |
| 11 | 732 | 33 |
| 12 | 693 | 29 |
| 13 | 331 | 29 |
| 14 | 304 | 35 |
| 15 | 526 | 70 |
| 16 | 573 | 29 |
| 17 | 135 | 30 |
| 18 | 139 | 1 |
| 19 | 360 | 37 |
| 20 | 307 | 29 |
| 21 | 494 | 53 |
| 22 | 641 | 33 |
| 23 | 100 | 28 |
| 24 | 116 | 29 |
| 25 | 362 | 28 |
| 26 | 460 | 61 |
| 27 | 131 | miss |
| 28 | 366 | 31 |
| 29 | 23 | 47 |
| 30 | 461 | 20 |
