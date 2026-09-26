# Slice-4 rubric calibration report (#77 Phase A)

- Shipped: cutoff `0.6` · margin `0.1`
- Train pick: cutoff `0.7` · margin `0.05` · train agreement 0.9285714285714286 over 23 met pairs
- Test agreement at the shipped cell: 0.9487179487179487 (2 met pairs)
- Basis: prior retained: train pick contradicted on test
- Caution: train picks cutoff 0.7 (margin 0.05) but test prefers the prior cutoff 0.6 at the same margin (0.9743589743589743 vs 0.9487179487179487; agree_met 1.0 vs 0.5)

## Split summaries at the pick

| Split | n | n scored | malformed | agreement | agree met | agree notmet | band |
|---|---|---|---|---|---|---|---|
| test | 39 | 39 | 0.0 | 0.9743589743589743 | 1.0 | 0.972972972972973 | 5 |
| train | 56 | 56 | 0.0 | 0.9107142857142857 | 0.9565217391304348 | 0.8787878787878788 | 7 |

## Grid (per split)

### test

| cutoff | margin | agreement | agree met | agree notmet | band |
|---|---|---|---|---|---|
| 0.5 | 0.05 | 0.8717948717948718 | 1.0 | 0.8648648648648649 | 4 |
| 0.5 | 0.1 | 0.8717948717948718 | 1.0 | 0.8648648648648649 | 5 |
| 0.5 | 0.15 | 0.8717948717948718 | 1.0 | 0.8648648648648649 | 7 |
| 0.6 | 0.05 | 0.9743589743589743 | 1.0 | 0.972972972972973 | 1 |
| 0.6 | 0.1 | 0.9743589743589743 | 1.0 | 0.972972972972973 | 5 |
| 0.6 | 0.15 | 0.9743589743589743 | 1.0 | 0.972972972972973 | 6 |
| 0.7 | 0.05 | 0.9487179487179487 | 0.5 | 0.972972972972973 | 1 |
| 0.7 | 0.1 | 0.9487179487179487 | 0.5 | 0.972972972972973 | 2 |
| 0.7 | 0.15 | 0.9487179487179487 | 0.5 | 0.972972972972973 | 2 |

### train

| cutoff | margin | agreement | agree met | agree notmet | band |
|---|---|---|---|---|---|
| 0.5 | 0.05 | 0.875 | 1.0 | 0.7878787878787878 | 3 |
| 0.5 | 0.1 | 0.875 | 1.0 | 0.7878787878787878 | 6 |
| 0.5 | 0.15 | 0.875 | 1.0 | 0.7878787878787878 | 8 |
| 0.6 | 0.05 | 0.9107142857142857 | 0.9565217391304348 | 0.8787878787878788 | 4 |
| 0.6 | 0.1 | 0.9107142857142857 | 0.9565217391304348 | 0.8787878787878788 | 7 |
| 0.6 | 0.15 | 0.9107142857142857 | 0.9565217391304348 | 0.8787878787878788 | 8 |
| 0.7 | 0.05 | 0.9285714285714286 | 0.9130434782608695 | 0.9393939393939394 | 1 |
| 0.7 | 0.1 | 0.9285714285714286 | 0.9130434782608695 | 0.9393939393939394 | 3 |
| 0.7 | 0.15 | 0.9285714285714286 | 0.9130434782608695 | 0.9393939393939394 | 6 |

## Flagged criteria at the pick

Total flagged: 15

- `review_band` jev=0.535 server_met=False (train) - Provides a concrete example or applies the matrix to a stakeholder scenario.
- `review_band` jev=0.61 server_met=True (train) - Explains that in load balancing, each message is delivered to only one consumer within a group, sharing the work.
- `review_band` jev=0.59 server_met=True (train) - Explains that in fan-out, each message is delivered to all consumers, allowing independent processing.
- `disagreement` jev=0.97 server_met=False (train) - Clearly contrasts the two patterns, showing understanding of the difference.
- `disagreement` jev=0.895 server_met=False (train) - Provides a coherent, well-structured answer within the expected length.
- `review_band` jev=0.665 server_met=False (train) - Explains the purpose of the case study in terms of applying strategic management accounting techniques and professional skills.
- `review_band` jev=0.595 server_met=False (train) - Explains the focus on strategic management accounting techniques and the case study's role in planning, control, and evaluation.
- `review_band` jev=0.625 server_met=False (train) - Explains the focus on strategic management accounting techniques and the case study's role in planning, control, and evaluation.
- `review_band` jev=0.525 server_met=False (train) - Identifies the shift from PM's core techniques to APM's emphasis on linking topics and evaluation, including the professional skills component.
- `review_band` jev=0.525 server_met=False (test) - Mentions the focus on comparing approaches and applying strategic management accounting techniques
- `review_band` jev=0.53 server_met=False (test) - Clarifies the relationship with PM and SBL knowledge
- `review_band` jev=0.525 server_met=False (test) - Mentions the focus on comparing approaches and applying strategic management accounting techniques
- `review_band` jev=0.52 server_met=False (test) - Clarifies the relationship with PM and SBL knowledge
- `disagreement` jev=0.705 server_met=False (test) - Provides a coherent, well-structured answer that demonstrates integrated understanding, as expected at APM level.
- `review_band` jev=0.615 server_met=True (test) - Demonstrates understanding that non-financial factors are equally important and should be integrated with financial measures.
