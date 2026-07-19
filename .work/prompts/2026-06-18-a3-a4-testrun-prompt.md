# Codex prompt — capture A3/A4 test results + evidence for review

Copy everything in the fenced block below into a Codex session on `project/phase-1`.
It runs the Pillar-A suite, reproduces the A3/A4 200-seed numbers, and commits machine-readable
evidence to `research/doc/verification-runs/2026-06-18-a3-a4-pillar-a/` for the reviewer.

---

````text
Task: produce committed, machine-readable evidence that the Pillar-A A3 + A4 tests pass and that the
A3/A4 headline numbers reproduce. Do NOT modify any source, test, or config file — this is a
read-only verification run; you only ADD artifacts under research/doc/verification-runs/ and commit.

Environment:
  export PATH="$HOME/.local/bin:$PATH"
  All commands run from the repo root. The research-comparison package uses uv.

Step 1 — make the output dir:
  mkdir -p research/doc/verification-runs/2026-06-18-a3-a4-pillar-a

Step 2 — reproduce the 200-seed results (so evidence is fresh, not stale gitignored artifacts):
  uv run --package research-comparison python -m research_comparison.runners.calibration --seeds 200
  uv run --package research-comparison python -m research_comparison.runners.detection   --seeds 200
  uv run --package research-comparison python -m research_comparison.runners.projection  --seeds 200
  uv run --package research-comparison python -m research_comparison.runners.scheduling  --seeds 200
  uv run --package research-comparison python -m research_comparison.runners.sweep

Step 3 — run the full suite with per-test machine-readable output (JUnit XML is built into pytest;
no plugin needed). Capture the console too. Record the exit code.
  OUT=research/doc/verification-runs/2026-06-18-a3-a4-pillar-a
  uv run --package research-comparison pytest research/comparison/tests -v -rA \
      --junitxml=$OUT/junit-research-comparison.xml | tee $OUT/pytest-console.txt
  echo "pytest_exit_code=${PIPESTATUS[0]}" | tee $OUT/pytest-exit-code.txt
  uv run --package research-comparison ruff check research/comparison 2>&1 | tee $OUT/ruff.txt || true

Step 4 — dump structured evidence the reviewer will cross-check. Run this exact script:
  uv run --package research-comparison python - <<'PY'
  import json, math, pathlib
  OUT = pathlib.Path("research/doc/verification-runs/2026-06-18-a3-a4-pillar-a")
  R = pathlib.Path("research/results")
  def load(t): return json.loads((R/t/f"{t}_results.json").read_text())
  def rosters(d):
      kinds={}
      for r in d.get("rows",[]):
          if "candidate" in r: kinds.setdefault(r["candidate"], r.get("candidate_kind"))
      return kinds
  def mc_blocks(mc):
      if isinstance(mc,dict) and "comparisons" in mc: return [("(single)",mc["comparisons"])]
      return [(k,v["comparisons"]) for k,v in mc.items() if isinstance(v,dict) and "comparisons" in v]
  def survivors(d):
      out={}
      for metric,comps in mc_blocks(d.get("mc_correction",{})):
          s={}; w={}
          for c in comps:
              if c.get("survives_holm_win"): s[c["candidate"]]=s.get(c["candidate"],0)+1
              elif c.get("holm_significant"): w[c["candidate"]]=w.get(c["candidate"],0)+1
          out[metric]={"holm_surviving_wins":s,"holm_sig_but_not_win":w}
      return out
  def prov(d):
      p=d.get("_provenance",{})
      sp=p.get("archetype_split",{})
      return {"n_learners":p.get("n_learners"),"hash":p.get("params_version_hash"),
              "scored_split":d.get("scored_split"),
              "split_train":sorted(sp.get("train",[])),"split_held_out":sorted(sp.get("held_out",[])),
              "split_disjoint": set(sp.get("train",[])).isdisjoint(sp.get("held_out",[]))}
  def has_ci(d):
      for k in d:
          if str(k).startswith("paired"):
              blk=d[k]; found=[False]
              def walk(o):
                  if isinstance(o,dict):
                      if any("delta_ci" in str(kk) for kk in o): found[0]=True
                      for v in o.values(): walk(v)
              walk(blk)
              if found[0]: return True
      return False

  ev={}
  for t in ("calibration","detection","projection","scheduling"):
      d=load(t)
      ev[t]={"provenance":prov(d),"delta_ci_present":has_ci(d),
             "candidate_kinds":rosters(d),"mc_survivors":survivors(d)}

  # projection A3.7 conformal coverage (held-out) + gp_ard
  dp=load("projection")
  ev["projection"]["conformal_calibration"]=dp.get("conformal_calibration")
  cov={}
  for b,v in dp.get("winner_by_band",{}).items():
      c=v.get("candidates",{})
      cov[b]={"conformal":c.get("conformal",{}).get("coverage"),
              "conformal_sharpness":c.get("conformal",{}).get("mean_sharpness_days"),
              "gp_ard":c.get("gp_ard",{}).get("coverage")}
  ev["projection"]["coverage_by_band"]=cov

  # detection A4: cusum tuning + pareto monotonicity + winners
  dd=load("detection")
  ev["detection"]["cusum_tuning"]=dd.get("cusum_tuning")
  pf=dd.get("pareto_frontier",{}); mono={}
  for shift,pts in (pf.items() if isinstance(pf,dict) else []):
      order=sorted(pts,key=lambda p:p["false_alarm_rate"])
      lat=[p["mean_latency"] for p in order]
      mono[shift]={"n":len(pts),"latency_monotone_nonincreasing":all(lat[i]>=lat[i+1]-1e-9 for i in range(len(lat)-1))}
  ev["detection"]["pareto_monotone"]=mono
  ev["detection"]["winner_by_shift_type"]={k:(v.get("winner") if isinstance(v,dict) else v) for k,v in dd.get("winner_by_shift_type",{}).items()}

  # scheduling A4: prereq-order per mix + skipped (cpsat)
  ds=load("scheduling")
  po={}
  for mix,v in ds.get("winner_by_material_mix",{}).items():
      c=v.get("candidates",{}) if isinstance(v,dict) else {}
      po[mix]={k:(vv.get("min_prereq_order_correctness") or vv.get("prereq_order_correctness")) for k,vv in c.items()}
  ev["scheduling"]["prereq_order_by_mix"]=po
  ev["scheduling"]["skipped_candidates"]=ds.get("skipped_candidates")

  # sweep A4: grid size + adversarial + flip + worst-case
  dw=load("sweep")
  g=dw.get("grid",{})
  ev["sweep"]={"points_per_axis":{k:len(v) for k,v in g.items()},
               "adversarial_cases":sorted({a.get("adversarial_case") for a in dw.get("adversarial_regimes",[])}),
               "n_flip_cells":len(dw.get("flip_cells",[])),
               "per_archetype_worst_case_keys":list(dw.get("per_archetype_worst_case",{}).keys())}

  (OUT/"evidence.json").write_text(json.dumps(ev,indent=2,default=str))
  print("wrote", OUT/"evidence.json")
  PY

Step 5 — write a short SUMMARY.md with: the pytest summary line (e.g. "78 passed"), the pytest exit
code, ruff result, and a one-line confirmation that Step 2 re-ran cleanly. Keep it factual.

Step 6 — commit ONLY the new artifacts (no source/test/config changes):
  git add research/doc/verification-runs/2026-06-18-a3-a4-pillar-a
  git commit -m "test(pillar-a): capture A3/A4 test results + reproduced evidence for review"
  git rev-parse --short HEAD

Report back: the pytest summary line, the exit code, and the new commit SHA. If any test fails or any
runner errors, STOP and paste the failure — do not edit source/tests to make it pass.
````

---

## What I'll review from this

- `junit-research-comparison.xml` — per-test pass/fail (independent of any summary count), so I can confirm the A3/A4 tests by name (`test_a4_cusum_tuning_uses_train_archetype_only`, `test_across_learner_conformal_noisy_fixture_covers_medium_and_max`, the `test_a3_*_carries_ci_correction_and_heldout_split` set, etc.) actually executed and passed.
- `evidence.json` — the reproduced headline values I previously ground-checked: A3.7 conformal coverage by band + gp_ard; held-out split disjointness + `scored_split`; `delta_ci` presence; `cusum_tuning.method`/train archetypes; Pareto monotonicity (computed); winners; prereq-order per mix; cpsat graceful skip; sweep grid sizes + adversarial cases + flip-cell count; and the Holm-surviving-win counts per track.
- `pytest-exit-code.txt` / `SUMMARY.md` — definitive pass/fail.

If `evidence.json` matches what's in the VERIFICATION A3/A4 findings and JUnit shows all green, that closes the one gap in my A3/A4 review (independent test execution).
