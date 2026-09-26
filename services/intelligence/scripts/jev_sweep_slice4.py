"""Slice-4 cutoff/margin sweep (#77 Phase A): record once, grid offline.

Live spend only on the rows: one batched ``decide()`` per learner answer through
the same builder the grading worker uses (``criterion_score_questions``), so the
recorded scores are the ones the flag queue would map. The 3x3 ``RUBRIC_GRID``
and every per-split summary then rerun offline over the recorded pairs through
``app.jev.measure.summarize_measurement``, so a grid rerun costs zero spend -
pass ``--replay`` with a previous output to redo the grid without any call.

The corpus (``rubric_slice4_rows.json``) already merges the base #74 rows with
the authored met-class top-up. Rows are read by-question train/test with no
overlap, and the pick is made on train only, reported on test.

Also emits the D-05 calibration report (JSON + MD): per-cell agreement, band
counts, and the flagged criteria with answer excerpts and per-criterion
verdicts. That report is what ``eval_harness.py`` reads for the D-04 gates.

Rule 80: ``--limit 2`` dry run first. Budget-guarded like the slice-1/slice-2
runners.

Usage (from the repository root):
    uv run --package intelligence python services/intelligence/scripts/jev_sweep_slice4.py \\
      --rows .work/active/jev-integration/plan/evidence/rubric_slice4_rows.json --limit 2
    uv run --package intelligence python services/intelligence/scripts/jev_sweep_slice4.py \\
      --rows ... --replay <recorded>.json --report-out <report>.json
"""

from __future__ import annotations

import argparse
import json
import os
import sys
import time
import uuid
from pathlib import Path
from typing import Any

sys.path.insert(0, str(Path(__file__).parent))
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from retrieval_probe import load_env_file  # noqa: E402

from app.grading.worker import _summarize_rubric_shadow  # noqa: E402
from app.jev.client import JevClient, JevError, estimate_cost_usd  # noqa: E402
from app.jev.measure import map_scores, summarize_measurement  # noqa: E402
from app.jev.questions import RUBRIC_THRESHOLDS, criterion_score_questions  # noqa: E402

ENV_PATH = Path(__file__).resolve().parents[1] / ".env"
REPO_ROOT = Path(__file__).resolve().parents[3]

# D-03: cutoffs x margins, picked on train, reported on test.
CUTOFFS = (0.5, 0.6, 0.7)
MARGINS = (0.05, 0.10, 0.15)
RUBRIC_GRID = tuple(
    {"cutoff": cutoff, "margin": margin} for cutoff in CUTOFFS for margin in MARGINS
)


def load_rows(path: str) -> list[dict[str, Any]]:
    """The corpus rows from one file.

    The base #74 rows and the authored top-up are already merged into the corpus
    artifact this reads, so there is no second path to combine.
    """
    with open(path, encoding="utf-8") as fh:
        payload = json.load(fh)
    return list(payload.get("rows") or [])


def record_rows(
    client: Any, rows: list[dict[str, Any]], *, request_prefix: str = "jev-sweep-slice4"
) -> dict[str, Any]:
    """One batched decide() per answer; fail-open per row, never per run."""
    calls: list[dict[str, Any]] = []
    errors: list[str] = []
    latencies_ms: list[float] = []
    spent_input_tokens = 0
    for row in rows:
        started = time.perf_counter()
        try:
            result = client.decide(
                {"learner_answer": row["answer"]},
                criterion_score_questions(row["criteria"]),
                request_id=f"{request_prefix}-{uuid.uuid4().hex[:8]}",
            )
        except JevError as exc:
            errors.append(exc.code)
            pairs = [
                {
                    "index": index,
                    "scored": False,
                    "jev_score": None,
                    "grade_met": bool(item.get("met")),
                    "agree": None,
                }
                for index, item in enumerate(row["breakdown"])
            ]
        else:
            spent_input_tokens += result.input_tokens or 0
            pairs = _summarize_rubric_shadow(result.answers, row["breakdown"])
        finally:
            latencies_ms.append((time.perf_counter() - started) * 1000.0)
        calls.append(
            {
                "answer_id": str(row.get("answer_id") or ""),
                "question_id": str(row.get("question_id") or ""),
                "criterion_source": row.get("criterion_source"),
                "split": row.get("split"),
                "answer_excerpt": str(row.get("answer") or "").strip()[:500],
                "criteria": list(row.get("criteria") or []),
                "pairs": pairs,
            }
        )
    return {
        "calls": calls,
        "errors": errors,
        "latencies_ms": latencies_ms,
        "spent_input_tokens": spent_input_tokens,
        "n_rows": len(rows),
        "n_calls": len(calls),
    }


def _pairs_for(calls: list[dict[str, Any]], split: str) -> list[dict[str, Any]]:
    return [
        pair for call in calls if call.get("split") == split for pair in call.get("pairs") or []
    ]


def split_names(calls: list[dict[str, Any]]) -> list[str]:
    return sorted({str(call.get("split")) for call in calls})


def summarize_grid(calls: list[dict[str, Any]], latencies_ms: list[float] | None = None) -> dict:
    """Per-split summary per cell; the grid is free because it only reads pairs."""
    out: dict[str, Any] = {}
    for split in split_names(calls):
        pairs = _pairs_for(calls, split)
        out[split] = [
            {
                **cell,
                **summarize_measurement(
                    pairs,
                    cutoff=cell["cutoff"],
                    margin=cell["margin"],
                    latencies_ms=latencies_ms or (),
                ),
            }
            for cell in RUBRIC_GRID
        ]
    return out


def pick_thresholds(grid: dict[str, Any], *, min_met: int = 15) -> dict[str, Any]:
    """Pick on train, report on test (D-03).

    Among the train cells whose met class is thick enough to separate them,
    prefer the highest agreement, then the narrowest band (a wide band flags
    more questions for the same agreement). ``min_met`` counts train met pairs,
    which is the class #74 was thin on: below it the cells are not separable and
    the fallback says so rather than pretending to a pick.

    The test split is *sampled* at the picked cell and never used to choose, but
    a tested cell that contradicts the train pick is called out in ``caution`` -
    the #77 risk register names exactly that as the case where the #74 prior
    wins.
    """
    train = grid.get("train") or []
    if not train:
        return {"cutoff": None, "margin": None, "basis": "no train split"}
    thick = [cell for cell in train if (cell.get("n_met") or 0) >= min_met]
    basis = "train agreement, narrowest band"
    if not thick:
        thick = train
        basis = "train agreement (thin met class; distinct cells not separable)"
    # Tie-break: narrowest band, then the #74 prior cutoff. Preferring the prior
    # on a tie is the conservative default - a grader cutoff is not moved
    # without a train gain, and leaving it untouched keeps the #74 evidence
    # comparable.
    prior = dict(RUBRIC_THRESHOLDS)
    best = max(
        thick,
        key=lambda cell: (
            cell.get("agreement") or 0.0,
            -cell["margin"],
            cell["cutoff"] == prior["cutoff"],
        ),
    )
    test = _cell_for(grid, "test", best["cutoff"], best["margin"])
    prior = dict(RUBRIC_THRESHOLDS)
    caution = None
    # Caution is about the cutoff, not the band width: a different margin is a
    # band-width preference, while a different cutoff is a claim that the test
    # split must support (the named #77 risk).
    if test and best["cutoff"] != prior["cutoff"]:
        prior_cell = _cell_for(grid, "test", prior["cutoff"], best["margin"])
        # Only caution when the prior cutoff actually wins on the test split; a
        # tie or a worse prior is not a reason to keep it.
        if (
            prior_cell.get("agreement") is not None
            and test.get("agreement") is not None
            and prior_cell["agreement"] > test["agreement"]
        ):
            caution = (
                f"train picks cutoff {best['cutoff']} (margin {best['margin']}) but test prefers "
                f"the prior cutoff {prior['cutoff']} at the same margin "
                f"({prior_cell['agreement']} vs {test['agreement']}; agree_met "
                f"{prior_cell.get('agree_met')} vs {test.get('agree_met')})"
            )
    # The shipped values. The train pick is kept unless the test split actively
    # contradicts a non-prior cutoff, in which case the prior holds: #77's risk
    # register says a different pick must show better *test* agreement, and a
    # move that loses there is not a re-confirmation of anything.
    effective = dict(prior) if caution else {"cutoff": best["cutoff"], "margin": best["margin"]}
    return {
        "cutoff": best["cutoff"],
        "margin": best["margin"],
        "basis": basis,
        "train_agreement": best.get("agreement"),
        "train_met_pairs": best.get("n_met"),
        "test_agreement": test.get("agreement"),
        "test_agree_met": test.get("agree_met"),
        "test_met_pairs": test.get("n_met"),
        "caution": caution,
        "effective": effective,
        "effective_basis": (
            "prior retained: train pick contradicted on test" if caution else basis
        ),
        "prior": prior,
    }


def calibration_report(
    calls: list[dict[str, Any]], grid: dict[str, Any], picked: dict[str, Any]
) -> dict:
    """D-05 report: the pick, its cells, and the flagged criteria for review."""
    effective = picked.get("effective") or {}
    cutoff, margin = effective.get("cutoff"), effective.get("margin")
    if cutoff is None:
        cutoff, margin = picked.get("cutoff"), picked.get("margin")
    flagged: list[dict[str, Any]] = []
    if cutoff is not None and margin is not None:
        for call in calls:
            verdicts = map_scores(call.get("pairs") or [], cutoff=cutoff, margin=margin)
            flagged_set = set(verdicts["flagged"])
            for verdict in verdicts["criteria"]:
                index = verdict["index"]
                if index not in flagged_set:
                    continue
                criteria = call.get("criteria") or []
                flagged.append(
                    {
                        "answer_id": call.get("answer_id"),
                        "question_id": call.get("question_id"),
                        "split": call.get("split"),
                        "criterion": criteria[index] if index < len(criteria) else "",
                        "reason": verdict["reason"],
                        "jev_score": verdict["jev_score"],
                        "server_met": verdict["server_met"],
                        "answer_excerpt": call.get("answer_excerpt"),
                    }
                )
    return {
        "picked": {
            "cutoff": cutoff,
            "margin": margin,
            "basis": picked.get("effective_basis") or picked.get("basis"),
            "train_pick": {"cutoff": picked.get("cutoff"), "margin": picked.get("margin")},
            "train_agreement": picked.get("train_agreement"),
            "test_agreement": picked.get("test_agreement"),
            "train_met_pairs": picked.get("train_met_pairs"),
            "test_met_pairs": picked.get("test_met_pairs"),
            "caution": picked.get("caution"),
        },
        "splits": {split: _cell_for(grid, split, cutoff, margin) for split in split_names(calls)},
        "grid": grid,
        "n_flagged": len(flagged),
        "flagged": flagged,
    }


def _cell_for(grid: dict[str, Any], split: str, cutoff: Any, margin: Any) -> dict[str, Any]:
    for cell in grid.get(split) or []:
        if cell["cutoff"] == cutoff and cell["margin"] == margin:
            return cell
    return {}


def render_report_md(report: dict[str, Any]) -> str:
    """The human-readable half of D-05."""
    picked = report.get("picked") or {}
    train_pick = picked.get("train_pick") or {}
    lines = [
        "# Slice-4 rubric calibration report (#77 Phase A)",
        "",
        f"- Shipped: cutoff `{picked.get('cutoff')}` · margin `{picked.get('margin')}`",
        f"- Train pick: cutoff `{train_pick.get('cutoff')}` · "
        f"margin `{train_pick.get('margin')}` · "
        f"train agreement {picked.get('train_agreement')} over "
        f"{picked.get('train_met_pairs')} met pairs",
        f"- Test agreement at the shipped cell: {picked.get('test_agreement')} "
        f"({picked.get('test_met_pairs')} met pairs)",
        f"- Basis: {picked.get('basis')}",
    ]
    if picked.get("caution"):
        lines.append(f"- Caution: {picked['caution']}")
    lines += [
        "",
        "## Split summaries at the pick",
        "",
        "| Split | n | n scored | malformed | agreement | agree met | agree notmet | band |",
        "|---|---|---|---|---|---|---|---|",
    ]
    for split in sorted((report.get("splits") or {}).keys()):
        cell = report["splits"][split]
        lines.append(
            f"| {split} | {cell.get('n')} | {cell.get('n_scored')} | "
            f"{cell.get('malformed_rate')} | {cell.get('agreement')} | "
            f"{cell.get('agree_met')} | {cell.get('agree_notmet')} | {cell.get('n_review')} |"
        )
    lines += ["", "## Grid (per split)", ""]
    for split in sorted((report.get("grid") or {}).keys()):
        lines += [
            f"### {split}",
            "",
            "| cutoff | margin | agreement | agree met | agree notmet | band |",
            "|---|---|---|---|---|---|",
        ]
        for cell in report["grid"][split]:
            lines.append(
                f"| {cell['cutoff']} | {cell['margin']} | {cell.get('agreement')} | "
                f"{cell.get('agree_met')} | {cell.get('agree_notmet')} | {cell.get('n_review')} |"
            )
        lines.append("")
    lines += [
        "## Flagged criteria at the pick",
        "",
        f"Total flagged: {report.get('n_flagged')}",
        "",
    ]
    for item in report.get("flagged") or []:
        lines.append(
            f"- `{item.get('reason')}` jev={item.get('jev_score')} "
            f"server_met={item.get('server_met')} "
            f"({item.get('split')}) - {item.get('criterion')}"
        )
    return "\n".join(lines) + "\n"


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--rows", required=True, help="corpus rows (base + top-up)")
    parser.add_argument("--replay", default="", help="recorded output to re-grid without a call")
    parser.add_argument("--out", default="-")
    parser.add_argument("--report-out", default="")
    parser.add_argument("--report-md", default="")
    parser.add_argument("--limit", type=int, default=0)
    parser.add_argument("--max-spend", type=float, default=0.05)
    args = parser.parse_args()

    if args.replay:
        recorded = json.loads(Path(args.replay).read_text(encoding="utf-8"))
    else:
        load_env_file(ENV_PATH)
        if not os.getenv("OPENROUTER_JEV_API_KEY", "").strip():
            print(json.dumps({"outcome": "skipped", "reason": "OPENROUTER_JEV_API_KEY is not set"}))
            return 2
        rows = load_rows(args.rows)
        if args.limit > 0:
            rows = rows[: args.limit]
        client = JevClient.from_env("JEV", default_timeout_ms=15000)
        try:
            recorded = record_rows(client, rows)
        except JevError as exc:
            print(json.dumps({"outcome": exc.code, "retryable": exc.retryable}))
            return 1
        price_per_mtok = float(os.getenv("JEV_PRICE_PER_MTOK", "0.042"))
        recorded["spent_usd_estimated"] = round(
            estimate_cost_usd(recorded["spent_input_tokens"], price_per_mtok), 6
        )
        if recorded["spent_usd_estimated"] > args.max_spend:
            recorded["outcome"] = "aborted"
            print(json.dumps(recorded, indent=2))
            return 1

    calls = recorded["calls"]
    latencies = recorded.get("latencies_ms") or []
    grid = summarize_grid(calls, latencies)
    picked = pick_thresholds(grid)
    report = calibration_report(calls, grid, picked)
    output = {
        "n_rows": recorded.get("n_rows"),
        "n_calls": recorded.get("n_calls"),
        "errors": recorded.get("errors"),
        "spent_input_tokens": recorded.get("spent_input_tokens"),
        "spent_usd_estimated": recorded.get("spent_usd_estimated"),
        "split_counts": {
            split: {
                "rows": sum(1 for call in calls if call.get("split") == split),
                "pairs": len(_pairs_for(calls, split)),
                "met_pairs": sum(1 for pair in _pairs_for(calls, split) if pair.get("grade_met")),
            }
            for split in split_names(calls)
        },
        "grid_config": {"cutoffs": list(CUTOFFS), "margins": list(MARGINS)},
        "grid": grid,
        "picked": picked,
        "calls": calls,
    }
    rendered = json.dumps(output, indent=2)
    if args.out == "-":
        print(rendered)
    else:
        Path(args.out).write_text(rendered + "\n", encoding="utf-8")
        print(f"wrote {args.out}", file=sys.stderr)
    if args.report_out:
        Path(args.report_out).write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
        print(f"wrote {args.report_out}", file=sys.stderr)
    if args.report_md:
        Path(args.report_md).write_text(render_report_md(report), encoding="utf-8")
        print(f"wrote {args.report_md}", file=sys.stderr)
    print(
        f"picked cutoff={picked.get('cutoff')} margin={picked.get('margin')} "
        f"basis={picked.get('basis')} train={picked.get('train_agreement')} "
        f"test={picked.get('test_agreement')}",
        file=sys.stderr,
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
