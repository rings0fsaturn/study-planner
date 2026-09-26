"""Slice-4 met-class top-up (#77 Phase A): author answers, submit on the real path.

The corpus in ``rubric_rows.json`` is met=5 / notmet=70, so the cutoff/margin
pick cannot be trusted off it. Live attempts cannot supply the gap - a
service-role probe on 2026-09-26 finds 20 rubric-bearing attempts (the corpus
itself) and none after ``2026-09-16T03:29`` - so the ticket's authoring fallback
fires.

This runner authors met-bearing answers against *existing* written questions and
submits each through the production path (``submit_assessment_attempt`` via the
intelligence service), so the server grades it with the real ``llm_rubric`` arm.
The recorded ``breakdown`` is therefore a real server grade, not a hand label.

Two properties keep the authored rows honest:

- The answer is written against the question's ``answer_block.rubric`` only; the
  SELECT deliberately omits ``referenceAnswer``, so a row is a plausible learner
  attempt rather than a regurgitated key.
- Every authored row lands in the ``train`` split. Authored answers are easier
  than real ones, so the met-heavy rows belong on the split the pick tunes on;
  the test split stays purely real. Every report states the imbalance.

Rule 80: ``--limit 2`` dry run first. Rule 42: this never touches a grade, it
collects the server's own.

Usage (from the repository root):
    uv run --package intelligence python services/intelligence/scripts/jev_slice4_topup.py \\
      --questions /tmp/jev_topup_questions.json --answers /tmp/jev_topup_answers.json --limit 2
"""

from __future__ import annotations

import argparse
import json
import os
import sys
import time
import urllib.error
import urllib.request
import uuid
from pathlib import Path
from typing import Any

sys.path.insert(0, str(Path(__file__).parent))
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from retrieval_probe import load_env_file  # noqa: E402

ENV_PATH = Path(__file__).resolve().parents[1] / ".env"
QUESTIONS_TABLE = "questions"
ATTEMPTS_TABLE = "question_attempts"
# Mirrors the router's written gate (app/routers/assessments.py): an over-long
# authored answer is rejected before it reaches the queue.
WRITTEN_TEXT_MAX_LENGTH = 20000


def _request(method: str, url: str, *, headers: dict[str, str], payload: Any = None) -> Any:
    data = json.dumps(payload).encode() if payload is not None else None
    request = urllib.request.Request(url, data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(request, timeout=60) as response:
            body = response.read().decode()
    except urllib.error.HTTPError as exc:
        raise SystemExit(f"{method} {url} -> {exc.code}: {exc.read().decode()[:400]}") from exc
    return json.loads(body) if body.strip() else None


def _service_get(base: str, key: str, path: str) -> Any:
    return _request(
        "GET",
        f"{base}/rest/v1/{path}",
        headers={"apikey": key, "Authorization": f"Bearer {key}", "Accept": "application/json"},
    )


def load_env_file_once() -> dict[str, str]:
    """Service-role credentials from the gitignored env (never echoed)."""
    load_env_file(ENV_PATH)
    return {
        "url": os.environ["SUPABASE_URL"].rstrip("/"),
        "service_key": os.environ["SUPABASE_SERVICE_ROLE_KEY"],
        "apikey": os.getenv("SUPABASE_PUBLISHABLE_KEY") or os.environ["SUPABASE_SERVICE_ROLE_KEY"],
    }


def load_questions(base: str, key: str, ids: list[str]) -> dict[str, dict[str, Any]]:
    """Rubric-bearing written questions by id; the reference answer is not selected."""
    if not ids:
        return {}
    rows = _service_get(
        base,
        key,
        f"{QUESTIONS_TABLE}?select=id,assessment_id,format,answer_block"
        f"&id=in.({','.join(ids)})",
    )
    out: dict[str, dict[str, Any]] = {}
    for row in rows:
        criteria = [
            item.get("criterion") for item in ((row.get("answer_block") or {}).get("rubric") or [])
        ]
        if row.get("format") != "written" or not criteria:
            continue
        if any(not isinstance(criterion, str) for criterion in criteria):
            continue
        out[row["id"]] = {
            "id": row["id"],
            "assessment_id": row.get("assessment_id"),
            "criteria": criteria,
        }
    return out


def read_credentials(path: Path) -> tuple[str, str]:
    """Shared dev account from the gitignored creds file.

    Values are unwrapped from their ``key=value`` lines: sending the raw wrapped
    string answers ``invalid_credentials`` for a valid account (rule 16).
    """
    email = password = ""
    for line in path.read_text(encoding="utf-8").splitlines():
        if line.startswith("email="):
            email = line.partition("=")[2].strip()
        elif line.startswith("password="):
            password = line.partition("=")[2].strip()
    if not email or not password:
        raise SystemExit("credentials file must carry email= and password= lines")
    return email, password


def sign_in(env: dict[str, str], email: str, password: str) -> str:
    """Supabase password grant; returns the access token."""
    request = urllib.request.Request(
        f"{env['url']}/auth/v1/token?grant_type=password",
        data=json.dumps({"email": email, "password": password}).encode(),
        headers={"apikey": env["apikey"], "Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(request, timeout=60) as response:
            body = json.loads(response.read().decode())
    except urllib.error.HTTPError as exc:
        # Never echo the body: a failed grant can name the account.
        raise SystemExit(f"sign-in failed: HTTP {exc.code}") from exc
    token = str(body.get("access_token") or "")
    if not token:
        raise SystemExit("sign-in returned no access token")
    return token


def submit_attempt(
    service_url: str, token: str, question: dict[str, Any], text: str
) -> dict[str, Any]:
    """One production-path submission through the intelligence service."""
    attempt_id = str(uuid.uuid4())
    payload = {
        "questionId": question["id"],
        "clientAttemptId": f"jev-slice4-topup-{attempt_id}",
        "correlationId": f"jev-slice4-topup-{uuid.uuid4().hex[:8]}",
        "answer": {"text": text},
        "submittedAt": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
    }
    request = urllib.request.Request(
        f"{service_url}/v1/assessments/{question['assessment_id']}"
        f"/questions/{question['id']}/attempts",
        data=json.dumps(payload).encode(),
        headers={
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json",
            "Idempotency-Key": f"jev-slice4-topup-{attempt_id}",
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(request, timeout=60) as response:
            return json.loads(response.read().decode())
    except urllib.error.HTTPError as exc:
        raise SystemExit(
            f"submit {question['id'][:8]} -> HTTP {exc.code}: {exc.read().decode()[:300]}"
        ) from exc


def wait_for_grade(base: str, key: str, attempt_id: str, *, timeout_s: float = 150.0) -> dict:
    """Poll the attempt row until the grading worker writes its grade."""
    deadline = time.time() + timeout_s
    while time.time() < deadline:
        rows = _service_get(
            base, key, f"{ATTEMPTS_TABLE}?select=id,status,grade&id=eq.{attempt_id}"
        )
        if rows and rows[0].get("status") == "graded" and isinstance(rows[0].get("grade"), dict):
            return rows[0]["grade"]
        time.sleep(2.0)
    raise SystemExit(f"attempt {attempt_id[:8]} did not grade within {timeout_s:.0f}s")


def build_row(question: dict[str, Any], text: str, grade: dict) -> dict[str, Any]:
    """One corpus row in the ``rubric_rows.json`` shape, always ``train``."""
    return {
        "answer_id": str(grade.get("attemptId") or ""),
        "question_id": question["id"],
        "criterion_source": "authored_met_topup",
        "answer": text,
        "criteria": question["criteria"],
        "breakdown": [
            {
                "criterion": item.get("criterion"),
                "score": item.get("score"),
                "met": bool(item.get("met")),
            }
            for item in (grade.get("rubricBreakdown") or [])
        ],
        "split": "train",
    }


def main() -> int:
    repo_root = Path(__file__).resolve().parents[3]
    parser = argparse.ArgumentParser()
    parser.add_argument("--questions", required=True, help="JSON list of question ids to top up")
    parser.add_argument("--answers", required=True, help="JSON map question_id -> answer text")
    parser.add_argument("--out", default="-", help="output path (default stdout)")
    parser.add_argument("--limit", type=int, default=0, help="dry-run cap (rule 80)")
    parser.add_argument("--service-url", default="http://127.0.0.1:8000")
    parser.add_argument("--cred", default=str(repo_root / ".work/specs/test-login-cred.txt"))
    args = parser.parse_args()

    env = load_env_file_once()
    question_ids = json.loads(Path(args.questions).read_text(encoding="utf-8"))
    answers = json.loads(Path(args.answers).read_text(encoding="utf-8"))
    if args.limit > 0:
        question_ids = question_ids[: args.limit]

    questions = load_questions(env["url"], env["service_key"], question_ids)
    missing = [qid for qid in question_ids if qid not in questions]
    if missing:
        raise SystemExit(f"not usable written questions: {missing}")

    email, password = read_credentials(Path(args.cred))
    token = sign_in(env, email, password)

    rows: list[dict[str, Any]] = []
    summary: list[dict[str, Any]] = []
    for question_id in question_ids:
        question = questions[question_id]
        text = str(answers.get(question_id) or "").strip()
        if not text:
            raise SystemExit(f"no authored answer for question {question_id[:8]}")
        if len(text) > WRITTEN_TEXT_MAX_LENGTH:
            raise SystemExit(f"authored answer for {question_id[:8]} exceeds the router gate")

        result = submit_attempt(args.service_url, token, question, text)
        if result.get("status") != "queued":
            raise SystemExit(f"submit {question_id[:8]} unexpected status: {result}")
        grade = wait_for_grade(env["url"], env["service_key"], result["attemptId"])
        row = build_row(question, text, grade)
        rows.append(row)
        met = sum(1 for item in row["breakdown"] if item["met"])
        summary.append(
            {"question_id": question_id[:8], "criteria": len(row["breakdown"]), "met": met}
        )
        print(
            f"  {question_id[:8]} criteria={len(row['breakdown'])} met={met} "
            f"attempt={row['answer_id'][:8]}",
            file=sys.stderr,
        )

    payload = {
        "split": "authored met-class top-up (#77 Phase A); all train by construction",
        "provenance": "answers authored against existing rubric criteria, graded by the server",
        "n_rows": len(rows),
        "n_met_pairs": sum(item["met"] for row in rows for item in row["breakdown"]),
        "summary": summary,
        "rows": rows,
    }
    rendered = json.dumps(payload, indent=2)
    if args.out == "-":
        print(rendered)
    else:
        Path(args.out).write_text(rendered + "\n", encoding="utf-8")
        print(f"wrote {args.out}", file=sys.stderr)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
