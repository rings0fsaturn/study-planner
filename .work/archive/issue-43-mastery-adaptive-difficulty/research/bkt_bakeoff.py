"""#43 P1 bake-off: choose the fixed BKT default parameters.

Evidence base (all in-repo, no network):
1. The pyBKT credibility tracker (research/doc/2026-06-14-kt-credibility-tracker.md)
   documents that EM-fitted pyBKT calibrates poorly on the public folds
   (nips2020: degenerate zero-mass; accoding: ECE ~0.272), so the production
   stateless projection uses fixed defaults, and this bake-off picks them.
2. Synthetic ground truth: learners are simulated under a BKT process in two
   true-parameter regimes (quick-mastery and slow-noisy). Each candidate
   default set is scored by how well its forward-filtered P(correct)
   calibrates (ECE, 10 bins) and discriminates (AUC) against the simulated
   outcomes, plus cold-start behaviour (n=0 belief = p_init).
3. Real-data sanity: the winner also runs over the dev account's graded
   attempts (pulled via the live API) to confirm non-degenerate movement on
   product-shaped observations.

Run: uv run --package py-progress python .work/active/issue-43-mastery-adaptive-difficulty/research/bkt_bakeoff.py
"""

from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path("packages/py-progress/src").resolve()))

from py_progress.mastery import (  # noqa: E402
    BktParams,
    MasteryObservation,
    bkt_forward,
    project_mastery,
)

RNG = np.random.default_rng(20260920)

REGIMES = {
    "quick_mastery": BktParams(p_init=0.3, p_learn=0.3, p_slip=0.05, p_guess=0.05),
    "slow_noisy": BktParams(p_init=0.15, p_learn=0.1, p_slip=0.15, p_guess=0.2),
}

N_LEARNERS = 2000
MAX_STEPS = 12
GRID = [
    BktParams(p_init=p_init, p_learn=p_learn, p_slip=p_slip, p_guess=p_guess)
    for p_init in (0.15, 0.25, 0.35)
    for p_learn in (0.05, 0.1, 0.2)
    for p_slip in (0.05, 0.1, 0.2)
    for p_guess in (0.05, 0.1, 0.2)
]


def simulate_sequences(params: BktParams) -> list[list[bool]]:
    """Generate outcome sequences for n learners under the true regime params."""

    sequences: list[list[bool]] = []
    for _ in range(N_LEARNERS):
        mastered = RNG.random() < params.p_init
        steps = int(RNG.integers(1, MAX_STEPS + 1))
        seq: list[bool] = []
        for _ in range(steps):
            p_correct = (1.0 - params.p_slip) if mastered else params.p_guess
            seq.append(bool(RNG.random() < p_correct))
            if not mastered and RNG.random() < params.p_learn:
                mastered = True
        sequences.append(seq)
    return sequences


def expected_calibration_error(preds: list[float], actual: list[bool], bins: int = 10) -> float:
    preds = np.asarray(preds, dtype=float)
    actual = np.asarray(actual, dtype=float)
    edges = np.linspace(0.0, 1.0, bins + 1)
    idx = np.clip(np.digitize(preds, edges) - 1, 0, bins - 1)
    total = 0.0
    for b in range(bins):
        mask = idx == b
        if not mask.any():
            continue
        total += (mask.sum() / len(preds)) * abs(float(actual[mask].mean()) - float(preds[mask].mean()))
    return float(total)


def auc(preds: list[float], actual: list[bool]) -> float:
    preds = np.asarray(preds, dtype=float)
    actual = np.asarray(actual, dtype=float)
    pos = preds[actual == 1]
    neg = preds[actual == 0]
    if len(pos) == 0 or len(neg) == 0:
        return 0.5
    order = np.argsort(np.concatenate([pos, neg]))
    ranks = np.empty(len(order), dtype=float)
    ranks[order] = np.arange(1, len(order) + 1)
    return float((ranks[: len(pos)].sum() - len(pos) * (len(pos) + 1) / 2) / (len(pos) * len(neg)))


def score_candidate(
    params: BktParams,
    sequences: dict[str, list[list[bool]]],
) -> dict[str, float]:
    """Run the candidate forward filter over the regime-generated sequences."""

    scores: dict[str, float] = {}
    for regime, seqs in sequences.items():
        preds: list[float] = []
        actual: list[bool] = []
        for seq in seqs:
            obs = [MasteryObservation(skillTag="s", correct=outcome) for outcome in seq]
            _, p_correct = bkt_forward(obs, params)
            preds.extend(p_correct)
            actual.extend(seq)
        scores[f"{regime}_ece"] = expected_calibration_error(preds, actual)
        scores[f"{regime}_auc"] = auc(preds, actual)
    scores["mean_ece"] = 0.5 * (scores["quick_mastery_ece"] + scores["slow_noisy_ece"])
    scores["mean_auc"] = 0.5 * (scores["quick_mastery_auc"] + scores["slow_noisy_auc"])
    return scores


def fetch_real_attempts() -> list[list[MasteryObservation]]:
    """Pull the dev account's graded attempts via the live API (RLS-scoped)."""

    env = Path("apps/app/.env.local").read_text(encoding="utf-8")
    url = next(l.split("=", 1)[1].strip() for l in env.splitlines() if l.startswith("SUPABASE_URL="))
    key = next(l.split("=", 1)[1].strip() for l in env.splitlines() if l.startswith("SUPABASE_PUBLISHABLE_KEY="))
    cred = Path(".work/specs/test-login-cred.txt").read_text(encoding="utf-8")
    email = next(l.split(":", 1)[1].strip("`\" \r\n") for l in cred.splitlines() if l.startswith("email"))
    password = next(l.split(":", 1)[1].strip("`\" \r\n") for l in cred.splitlines() if l.startswith("password"))

    def run(cmd: list[str]) -> str:
        return subprocess.run(cmd, capture_output=True, text=True, check=True).stdout.strip()

    token = json.loads(
        run([
            "curl", "-s", "-X", "POST", f"{url}/auth/v1/token?grant_type=password",
            "-H", f"apikey: {key}", "-H", "Content-Type: application/json",
            "-d", json.dumps({"email": email, "password": password}),
        ])
    )["access_token"]
    rows = json.loads(
        run([
            "curl", "-s", f"{url}/rest/v1/question_attempts?select=grade&status=eq.graded",
            "-H", f"apikey: {key}", "-H", f"Authorization: Bearer {token}",
        ])
    )
    by_skill: dict[tuple[str, str], list[MasteryObservation]] = {}
    for row in rows:
        grade = row.get("grade") or {}
        material = grade.get("materialId", "live")
        for skill in grade.get("perSkill", []):
            key = (material, skill.get("skillTag", "?"))
            by_skill.setdefault(key, []).append(
                MasteryObservation(skillTag=key[1], correct=bool(skill.get("correct", False)))
            )
    return list(by_skill.values())


def main() -> None:
    sequences = {regime: simulate_sequences(params) for regime, params in REGIMES.items()}
    for regime, seqs in sequences.items():
        flat = [outcome for seq in seqs for outcome in seq]
        print(f"sim {regime}: {len(seqs)} learners, {len(flat)} steps, pos-rate {np.mean(flat):.3f}")

    ranked: list[tuple[float, BktParams, dict[str, float]]] = []
    for params in GRID:
        scores = score_candidate(params, sequences)
        ranked.append((scores["mean_ece"], params, scores))
    ranked.sort(key=lambda item: item[0])

    print("\nTop 8 by mean ECE (lower better; mean AUC >= 0.60 required):")
    for ece, params, scores in ranked[:8]:
        flag = "" if scores["mean_auc"] >= 0.60 else "  <-- AUC too low"
        print(
            f"  p_init={params.p_init:.2f} learn={params.p_learn:.2f} "
            f"slip={params.p_slip:.2f} guess={params.p_guess:.2f} "
            f"mean_ece={ece:.4f} mean_auc={scores['mean_auc']:.4f}"
            f" (q_ece={scores['quick_mastery_ece']:.4f} s_ece={scores['slow_noisy_ece']:.4f}){flag}"
        )

    viable = [item for item in ranked if item[2]["mean_auc"] >= 0.60]
    if not viable:
        print("\nNO viable candidate (all mean AUC < 0.60); relax the grid.")
        return
    winner_params, winner_scores = viable[0][1], viable[0][2]
    print(f"\nWINNER: p_init={winner_params.p_init} p_learn={winner_params.p_learn} "
          f"p_slip={winner_params.p_slip} p_guess={winner_params.p_guess}")
    print(f"  mean_ece={winner_scores['mean_ece']:.4f} mean_auc={winner_scores['mean_auc']:.4f}")

    real = fetch_real_attempts()
    print(f"\nreal-data sanity: {len(real)} (material, skill) sequences")
    for seq in sorted(real, key=len, reverse=True):
        proj = project_mastery("live", seq, winner_params)
        print(
            f"  {proj.skillTag}: n={proj.n} mastery={proj.mastery:.3f} "
            f"uncertainty={proj.uncertainty:.3f} corrects={sum(o.correct for o in seq)}"
        )


if __name__ == "__main__":
    main()