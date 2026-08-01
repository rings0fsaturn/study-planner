from __future__ import annotations


def credible_interval_coverage(
    intervals: list[tuple[float, float] | None],
    true_value: float,
) -> float:
    usable = [interval for interval in intervals if interval is not None]
    if not usable:
        return 0.0
    covered = sum(1 for low, high in usable if low <= true_value <= high)
    return covered / len(usable)
