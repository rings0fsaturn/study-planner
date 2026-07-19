from __future__ import annotations

import argparse
import csv
import hashlib
import json
import sys
import zipfile
from dataclasses import dataclass
from datetime import datetime, timedelta
from pathlib import Path
from typing import Iterable, Iterator, TextIO

sys.path.append(str(Path(__file__).resolve().parents[1]))

from progress_log import ProgressLogger  # noqa: E402

BASE = datetime(2016, 1, 1, 0, 0, 0)
DROP_RESULTS = {"WT", "JG"}
RESULT_MAP = {"AC": "Accepted"}
POJ_ALLOWED_RESULTS = {
    "Accepted",
    "Wrong Answer",
    "Compile Error",
    "Time Limit Exceeded",
    "Memory Limit Exceeded",
    "Runtime Error",
    "Output Limit Exceeded",
    "Presentation Error",
    "System Error",
    "Validator Error",
}
TOTAL_ACCODING_LEARNERS = 27_444


def default_accoding_zip() -> Path:
    research_root = Path(__file__).resolve().parents[2]
    candidates = [
        research_root / "datasets" / "ACcoding.zip",
        research_root / "datasets" / "acoding" / "ACcoding.zip",
    ]
    for candidate in candidates:
        if candidate.exists():
            return candidate
    return candidates[0]


@dataclass(frozen=True)
class AdapterStats:
    rows_in: int
    rows_kept: int
    rows_dropped_nonterminal: int
    rows_skipped_parse_error: int
    unique_learners_seen: int
    unique_learners_kept: int


def submit_time(submission_id: int) -> str:
    return (BASE + timedelta(seconds=submission_id)).strftime("%Y-%m-%d %H:%M:%S")


def keep_learner(creator_id: int, max_learners: int, seed: int) -> bool:
    if max_learners <= 0:
        return True
    threshold = max(1, int(max_learners / TOTAL_ACCODING_LEARNERS * 100_000))
    digest = hashlib.sha256(f"{seed}:{creator_id}".encode("utf-8")).hexdigest()
    return int(digest[:12], 16) % 100_000 < threshold


def iter_insert_value_blocks(lines: Iterable[str]) -> Iterator[str]:
    prefix = "INSERT INTO `submissions` VALUES"
    for line in lines:
        if prefix not in line:
            continue
        _, values = line.split(prefix, 1)
        yield values.strip().rstrip(";")


def iter_rows(values_block: str) -> Iterator[str]:
    depth = 0
    in_string = False
    escaped = False
    row: list[str] = []
    for ch in values_block:
        if escaped:
            if depth:
                row.append(ch)
            escaped = False
            continue
        if ch == "\\":
            if depth:
                row.append(ch)
            escaped = True
            continue
        if ch == "'":
            if depth:
                row.append(ch)
            in_string = not in_string
            continue
        if in_string:
            if depth:
                row.append(ch)
            continue
        if ch == "(":
            if depth == 0:
                row = []
            else:
                row.append(ch)
            depth += 1
            continue
        if ch == ")":
            depth -= 1
            if depth == 0:
                yield "".join(row)
                row = []
            else:
                row.append(ch)
            continue
        if depth:
            row.append(ch)


def split_sql_fields(raw: str) -> list[str]:
    fields: list[str] = []
    current: list[str] = []
    in_string = False
    escaped = False
    for ch in raw:
        if escaped:
            current.append(ch)
            escaped = False
            continue
        if ch == "\\":
            current.append(ch)
            escaped = True
            continue
        if ch == "'":
            current.append(ch)
            in_string = not in_string
            continue
        if ch == "," and not in_string:
            fields.append("".join(current).strip())
            current = []
            continue
        current.append(ch)
    fields.append("".join(current).strip())
    return fields


def unquote_sql(value: str) -> str:
    value = value.strip()
    if value.upper() == "NULL":
        return ""
    if len(value) >= 2 and value[0] == "'" and value[-1] == "'":
        return value[1:-1].replace("\\'", "'").replace("\\\\", "\\")
    return value


def poj_row_from_fields(fields: list[str]) -> list[object] | None:
    if len(fields) < 11:
        return None
    submission_id = int(fields[0])
    result = unquote_sql(fields[2])
    creator_id = int(fields[-3])
    problem_id = int(fields[-2])
    if result in DROP_RESULTS:
        return None
    poj_result = RESULT_MAP.get(result, "Wrong Answer")
    if poj_result not in POJ_ALLOWED_RESULTS:
        raise ValueError(f"mapped result {poj_result!r} is not accepted by pyKT POJ")
    return [creator_id, problem_id, poj_result, submit_time(submission_id)]


def convert_sql_to_poj(
    *,
    sql: TextIO,
    out: Path,
    max_learners: int,
    max_rows: int,
    seed: int,
    logger: ProgressLogger | None = None,
    estimated_rows: int = 4_046_652,
) -> AdapterStats:
    logger = logger or ProgressLogger(label="kt-accoding", enabled=False)
    out.parent.mkdir(parents=True, exist_ok=True)
    total = kept = dropped = skipped = 0
    learners_seen: set[int] = set()
    learners_kept: set[int] = set()
    denominator = max_rows if max_rows > 0 else estimated_rows
    denominator = max(1, denominator)
    next_percent = 5

    with out.open("w", newline="", encoding="utf-8") as fh:
        writer = csv.writer(fh)
        writer.writerow(["User", "Problem", "Result", "Submit Time"])
        logger.log(5, "accoding.convert.rows", f"out={out} max_learners={max_learners} max_rows={max_rows}")
        for block in iter_insert_value_blocks(sql):
            for raw_row in iter_rows(block):
                if max_rows > 0 and total >= max_rows:
                    logger.log(95, "accoding.convert.row_cap", f"rows_in={total} rows_kept={kept}")
                    return AdapterStats(total, kept, dropped, skipped, len(learners_seen), len(learners_kept))
                total += 1
                current_percent = min(95, 5 + (total / denominator) * 90)
                if current_percent >= next_percent:
                    logger.log(
                        current_percent,
                        "accoding.convert.rows",
                        f"rows_in={total} rows_kept={kept} dropped={dropped} skipped={skipped}",
                    )
                    next_percent += 5
                try:
                    fields = split_sql_fields(raw_row)
                    creator_id = int(fields[-3])
                    learners_seen.add(creator_id)
                    if not keep_learner(creator_id, max_learners, seed):
                        continue
                    row = poj_row_from_fields(fields)
                except (IndexError, ValueError):
                    skipped += 1
                    continue
                if row is None:
                    dropped += 1
                    continue
                learners_kept.add(int(row[0]))
                writer.writerow(row)
                kept += 1

    logger.log(95, "accoding.convert.rows_done", f"rows_in={total} rows_kept={kept}")
    return AdapterStats(total, kept, dropped, skipped, len(learners_seen), len(learners_kept))


def write_provenance(path: Path, stats: AdapterStats, args: argparse.Namespace) -> None:
    payload = {
        "source": "ACcoding submissions.sql",
        "source_zip": str(args.zip),
        "zip_member": args.member,
        "submit_time_surrogate": "auto_increment_id",
        "base_epoch": BASE.isoformat(),
        "max_learners": args.max_learners,
        "max_rows": args.max_rows,
        "seed": args.seed,
        "rows_in": stats.rows_in,
        "rows_kept": stats.rows_kept,
        "rows_dropped_nonterminal": stats.rows_dropped_nonterminal,
        "rows_skipped_parse_error": stats.rows_skipped_parse_error,
        "unique_learners_seen": stats.unique_learners_seen,
        "unique_learners_kept": stats.unique_learners_kept,
        "result_mapping": {"AC": "Accepted", "other_terminal": "Wrong Answer"},
    }
    path.write_text(json.dumps(payload, indent=2, sort_keys=True) + "\n", encoding="utf-8")


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--zip", type=Path, default=default_accoding_zip())
    parser.add_argument("--member", default="submissions.sql")
    parser.add_argument("--out", type=Path, default=Path("data/poj/poj_log.csv"))
    parser.add_argument("--max-learners", type=int, default=3000)
    parser.add_argument("--max-rows", type=int, default=0, help="0 means no row cap")
    parser.add_argument("--seed", type=int, default=20260614)
    parser.add_argument("--estimated-rows", type=int, default=4_046_652)
    parser.add_argument("--quiet", action="store_true", help="suppress progress output on stderr")
    args = parser.parse_args(argv)
    logger = ProgressLogger(label="kt-accoding", enabled=not args.quiet)

    logger.log(0, "accoding.start", f"zip={args.zip} member={args.member}")
    with zipfile.ZipFile(args.zip) as archive:
        logger.log(3, "accoding.open_zip", f"member={args.member}")
        with archive.open(args.member) as raw_sql:
            text_sql = (line.decode("utf-8", errors="replace") for line in raw_sql)
            stats = convert_sql_to_poj(
                sql=text_sql,
                out=args.out,
                max_learners=args.max_learners,
                max_rows=args.max_rows,
                seed=args.seed,
                logger=logger,
                estimated_rows=args.estimated_rows,
            )
    logger.log(97, "accoding.write_provenance", str(args.out.with_suffix(".provenance.json")))
    write_provenance(args.out.with_suffix(".provenance.json"), stats, args)
    print(
        f"wrote {args.out}: kept {stats.rows_kept}/{stats.rows_in} rows "
        f"across {stats.unique_learners_kept} learners "
        f"(dropped {stats.rows_dropped_nonterminal} non-terminal, skipped {stats.rows_skipped_parse_error})"
    )
    logger.log(100, "accoding.complete", f"rows_in={stats.rows_in} rows_kept={stats.rows_kept}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
