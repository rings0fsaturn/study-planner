from __future__ import annotations

from pathlib import Path
from typing import Any


def _tex(value: str) -> str:
    return value.replace("_", r"\_")


def _ci_text(result: dict[str, Any] | None) -> str:
    if not result:
        return "--"
    return (
        f"{float(result['delta']):+.4f} "
        f"[{float(result['delta_ci_low']):+.4f}, {float(result['delta_ci_high']):+.4f}]"
    )


def _survival_text(
    correction: dict[str, Any] | None,
    *,
    token: str,
    candidate: str,
) -> str:
    if not correction:
        return "--"
    matches = [
        comparison
        for comparison in correction.get("comparisons", [])
        if comparison.get("candidate") == candidate
        and token in str(comparison.get("cell", ""))
    ]
    if not matches:
        return "--"
    holm = sum(1 for comparison in matches if comparison.get("survives_holm_win"))
    bh = sum(1 for comparison in matches if comparison.get("survives_bh_win"))
    return f"{holm}/{bh}/{len(matches)}"


def render_calibration_winners_table(
    winners: dict[str, dict[str, Any]],
    paired: dict[str, dict[str, dict[str, Any]]] | None = None,
    correction: dict[str, Any] | None = None,
) -> str:
    lines = [
        r"\begin{tabular}{llrll}",
        r"\toprule",
        r"Length band & Winner & Mean recovery MAE & $\Delta$ CI & Holm/BH/N \\",
        r"\midrule",
    ]
    for band, row in winners.items():
        winner = str(row["winner"])
        delta = _ci_text((paired or {}).get(band, {}).get(winner))
        survives = _survival_text(correction, token=f"band={band}|", candidate=winner)
        lines.append(
            f"{_tex(band)} & {_tex(winner)} & {row['mean_error']:.4f} & "
            f"{delta} & {survives} \\\\"
        )
    lines.extend([r"\bottomrule", r"\end{tabular}", ""])
    return "\n".join(lines)


def write_calibration_winners_table(
    winners: dict[str, dict[str, Any]],
    out_path: Path,
    paired: dict[str, dict[str, dict[str, Any]]] | None = None,
    correction: dict[str, Any] | None = None,
) -> Path:
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(
        render_calibration_winners_table(winners, paired=paired, correction=correction),
        encoding="utf-8",
    )
    return out_path


def render_detection_winners_table(
    winners: dict[str, dict[str, Any]],
    paired: dict[str, dict[str, dict[str, Any]]] | None = None,
    correction: dict[str, Any] | None = None,
) -> str:
    lines = [
        r"\begin{tabular}{llrll}",
        r"\toprule",
        r"Shift type & Winner & Mean latency & $\Delta$ CI & Holm/BH/N \\",
        r"\midrule",
    ]
    for shift_type, row in winners.items():
        winner = str(row["winner"])
        delta = _ci_text((paired or {}).get(f"shift_type={shift_type}", {}).get(winner))
        survives = _survival_text(
            correction,
            token=f"shift_type={shift_type}",
            candidate=winner,
        )
        lines.append(
            f"{_tex(shift_type)} & {_tex(winner)} & "
            f"{row['mean_latency']:.2f} & {delta} & {survives} \\\\"
        )
    lines.extend([r"\bottomrule", r"\end{tabular}", ""])
    return "\n".join(lines)


def write_detection_winners_table(
    winners: dict[str, dict[str, Any]],
    out_path: Path,
    paired: dict[str, dict[str, dict[str, Any]]] | None = None,
    correction: dict[str, Any] | None = None,
) -> Path:
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(
        render_detection_winners_table(winners, paired=paired, correction=correction),
        encoding="utf-8",
    )
    return out_path


def render_projection_winners_table(
    winners: dict[str, dict[str, Any]],
    paired: dict[str, dict[str, dict[str, Any]]] | None = None,
    correction: dict[str, Any] | None = None,
) -> str:
    lines = [
        r"\begin{tabular}{llrrll}",
        r"\toprule",
        (
            r"Length band & Winner & Coverage & Mean error (days) "
            r"& $\Delta$ CI & Holm/BH/N \\"
        ),
        r"\midrule",
    ]
    for band, row in winners.items():
        winner = str(row["winner"])
        delta = _ci_text((paired or {}).get(f"band={band}", {}).get(winner))
        survives = _survival_text(correction, token=f"band={band}|", candidate=winner)
        lines.append(
            f"{_tex(band)} & {_tex(winner)} & "
            f"{row['coverage']:.2f} & {row['mean_abs_error_days']:.2f} & "
            f"{delta} & {survives} \\\\"
        )
    lines.extend([r"\bottomrule", r"\end{tabular}", ""])
    return "\n".join(lines)


def write_projection_winners_table(
    winners: dict[str, dict[str, Any]],
    out_path: Path,
    paired: dict[str, dict[str, dict[str, Any]]] | None = None,
    correction: dict[str, Any] | None = None,
) -> Path:
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(
        render_projection_winners_table(winners, paired=paired, correction=correction),
        encoding="utf-8",
    )
    return out_path


def render_scheduling_metrics_table(
    winners: dict[str, dict[str, Any]],
    paired: dict[str, dict[str, dict[str, Any]]] | None = None,
    correction: dict[str, Any] | None = None,
) -> str:
    lines = [
        r"\begin{tabular}{llrrll}",
        r"\toprule",
        (
            r"Material mix & Winner & Deadline drift & Capacity violations "
            r"& $\Delta$ CI & Holm/BH/N \\"
        ),
        r"\midrule",
    ]
    for material_mix, row in winners.items():
        winner = str(row["winner"])
        delta = _ci_text((paired or {}).get(f"material_mix={material_mix}", {}).get(winner))
        survives = _survival_text(
            correction,
            token=f"material_mix={material_mix}",
            candidate=winner,
        )
        lines.append(
            f"{_tex(material_mix)} & {_tex(winner)} & "
            f"{row['mean_abs_deadline_drift_days']:.2f} & "
            f"{row['capacity_violation_rate']:.2f} & {delta} & {survives} \\\\"
        )
    lines.extend([r"\bottomrule", r"\end{tabular}", ""])
    return "\n".join(lines)


def write_scheduling_metrics_table(
    winners: dict[str, dict[str, Any]],
    out_path: Path,
    paired: dict[str, dict[str, dict[str, Any]]] | None = None,
    correction: dict[str, Any] | None = None,
) -> Path:
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(
        render_scheduling_metrics_table(winners, paired=paired, correction=correction),
        encoding="utf-8",
    )
    return out_path


def render_kt_metric_table(
    metric_by_dataset: dict[str, dict[str, float]],
    metric_label: str,
) -> str:
    datasets = sorted(metric_by_dataset)
    models = sorted({model for rows in metric_by_dataset.values() for model in rows})
    header = "Model & " + " & ".join(_tex(dataset) for dataset in datasets) + r" \\"
    lines = [
        r"\begin{tabular}{l" + "r" * len(datasets) + "}",
        r"\toprule",
        header,
        r"\midrule",
    ]
    for model in models:
        values = []
        for dataset in datasets:
            value = metric_by_dataset.get(dataset, {}).get(model)
            values.append("--" if value is None else f"{value:.4f}")
        lines.append(f"{_tex(model)} & " + " & ".join(values) + r" \\")
    lines.extend([r"\bottomrule", r"\end{tabular}", f"% {metric_label}", ""])
    return "\n".join(lines)


def write_kt_auc_table(
    metric_by_dataset: dict[str, dict[str, float]],
    out_path: Path,
) -> Path:
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(
        render_kt_metric_table(metric_by_dataset, "Full-sequence AUC"),
        encoding="utf-8",
    )
    return out_path


def write_kt_ece_table(
    metric_by_dataset: dict[str, dict[str, float]],
    out_path: Path,
) -> Path:
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(
        render_kt_metric_table(metric_by_dataset, "Expected calibration error"),
        encoding="utf-8",
    )
    return out_path
