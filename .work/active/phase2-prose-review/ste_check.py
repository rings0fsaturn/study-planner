#!/usr/bin/env python3
"""ste-check.py - deterministic STE-flavored + humanizer lint for .tex chapters.

Replaces the hand-rolled lint heredocs used in the Ch01/Ch02 review passes
(which once produced two disagreeing counters and a full manual recount).
One counter, one judge: this script counts, a human judges.

Usage:
    python3 ste-check.py chapters/02-literature-survey.tex
    python3 ste-check.py --strict chapters/03-requirements.tex
    python3 ste-check.py --json chapters/*.tex
    python3 ste-check.py --add-phrasal "stand in for" chapters/03-requirements.tex

Exit codes: 0 PASS (no fail-tier hits), 1 FAIL, 2 usage/file error.
Final verdict lines always read ``STE: PASS|FAIL (counts)`` and
``Humanizer: PASS|FAIL (counts)`` to match the review-prompt return shape.

Stays manual by design (see --help): lit-beat completeness, contrast
new-information, triad reality, number ground truth, cross-chapter term
stability. This script counts what is countable.
"""

from __future__ import annotations

import argparse
import json
import re
import sys
from dataclasses import dataclass
from pathlib import Path

# --------------------------------------------------------------------------
# Finding model
# --------------------------------------------------------------------------


@dataclass(frozen=True)
class Finding:
    """One lint row in the review-prompt shape."""

    file: str
    line: int
    group: str  # STE | humanizer | guide
    tier: str  # fail | judge | info
    rule: str
    excerpt: str
    fix: str

    def row(self) -> str:
        return f"{self.file}:{self.line} - {self.rule} - {self.excerpt} - {self.fix}"


# --------------------------------------------------------------------------
# Word lists
# --------------------------------------------------------------------------

BRITISH_TO_AMERICAN: dict[str, str] = {
    "behaviour": "behavior",
    "behavioural": "behavioral",
    "behaviourally": "behaviorally",
    "behaviours": "behaviors",
    "modelling": "modeling",
    "modelled": "modeled",
    "judgement": "judgment",
    "judgements": "judgments",
    "realise": "realize",
    "realised": "realized",
    "realises": "realizes",
    "realising": "realizing",
    "organise": "organize",
    "organised": "organized",
    "organises": "organizes",
    "organising": "organizing",
    "generalise": "generalize",
    "generalised": "generalized",
    "normalise": "normalize",
    "normalised": "normalized",
    "optimise": "optimize",
    "optimised": "optimized",
    "favour": "favor",
    "favoured": "favored",
    "favourite": "favorite",
    "labour": "labor",
    "neighbour": "neighbor",
    "colour": "color",
    "honour": "honor",
    "centre": "center",
    "metre": "meter",
    "litre": "liter",
    "travelling": "traveling",
    "travelled": "traveled",
    "cancelling": "canceling",
    "cancelled": "canceled",
    "signalling": "signaling",
    "labelled": "labeled",
    "finalise": "finalize",
    "finalised": "finalized",
    "summarise": "summarize",
    "summarised": "summarized",
    "characterise": "characterize",
    "characterised": "characterized",
    "programme": "program",
    "cheque": "check",
    "grey": "gray",
    "enrol": "enroll",
    "enroled": "enrolled",
    "fulfil": "fulfill",
    "fulfilled": "fulfilled",
}

# Phrasal ban list from the Ch01 retro; fixes are the agreed replacements.
PHRASAL_FIXES: dict[str, str] = {
    "sets out": "describes",
    "wired into": "linked to",
    "feeds back into": "sends to",
    "hands over": "gives",
    "draws on": "uses",
    "stand in for": "replaces",
    "carries into": "passes to",
}

# Abbreviations whose periods never end a sentence in this corpus.
PROTECTED_ABBR = [
    "et al",
    "e.g",
    "i.e",
    "vs",
    "Fig",
    "Table",
    "Sec",
    "Eq",
    "Chap",
    "No",
    "St",
    "Mr",
    "Mrs",
    "Dr",
    "Prof",
]

# Words ending in ed/en that are not past participles (perfect-tense guard).
NOT_PARTICIPLE = {
    "even",
    "often",
    "when",
    "then",
    "than",
    "open",
    "garden",
    "golden",
    "wooden",
}

CONTRACTION_RES = [
    re.compile(r"\b\w+n't\b", re.IGNORECASE),
    re.compile(r"\b\w+'(?:re|ve|ll|d|m)\b", re.IGNORECASE),
    re.compile(r"\b(?:it|that|what|there|here|this|where)'s\b", re.IGNORECASE),
]

# Environments whose contents are code, never body prose.
CODE_ENVS = {
    "tikzpicture",
    "equation",
    "equation*",
    "align",
    "align*",
    "math",
    "displaymath",
    "picture",
    "verbatim",
    "lstlisting",
}

PLACEHOLDER = "\x00"

# --------------------------------------------------------------------------
# Line classification
# --------------------------------------------------------------------------


@dataclass
class CLine:
    no: int
    text: str
    kind: str  # BODY | ITEM | ROW | META | SKIP


def classify_lines(raw_lines: list[str]) -> list[CLine]:
    """Tag every line as body prose, list item, table row, meta, or skip.

    Code environments (TikZ, equations) are SKIP. Captions, labels,
    headings-only lines and pure format lines are SKIP per the contract
    (they stay verbatim). Table rows are ROW: word checks apply, sentence
    aggregation does not. ``\\item`` lines are ITEM: each starts a unit.
    """
    out: list[CLine] = []
    env_stack: list[str] = []
    in_table = False

    for no, raw in enumerate(raw_lines, start=1):
        text = raw.rstrip("\n")
        stripped = text.strip()

        for env in re.findall(r"\\begin\{([^}]*)\}", text):
            env_stack.append(env)
            if env in ("table", "tabular"):
                in_table = True
        for env in re.findall(r"\\end\{([^}]*)\}", text):
            if env_stack and env_stack[-1] == env:
                env_stack.pop()
            elif env in env_stack:
                env_stack.remove(env)
            if env in ("table", "tabular") and not any(
                e in ("table", "tabular") for e in env_stack
            ):
                in_table = False

        in_code = any(e in CODE_ENVS for e in env_stack)
        if in_code:
            out.append(CLine(no, text, "SKIP"))
            continue
        if not stripped:
            out.append(CLine(no, text, "SKIP"))
            continue
        if re.match(
            r"\\(chapter|section|subsection|caption|label|centering"
            r"|footnotesize|toprule|midrule|bottomrule|includegraphics"
            r"|pagecolor|nopagecolor|tableofcontents|listof|newpage"
            r"|thispagestyle|vspace|vfill|null|rule|textbf\{\\Large)",
            stripped,
        ):
            out.append(CLine(no, text, "SKIP"))
            continue
        if re.match(r"\\begin\{|\\end\{", stripped):
            out.append(CLine(no, text, "SKIP"))
            continue
        if re.match(r"\\(node|draw)\b", stripped):
            out.append(CLine(no, text, "SKIP"))
            continue
        if in_table and ("&" in text or text.rstrip().endswith("\\\\")):
            out.append(CLine(no, text, "ROW"))
            continue
        if in_table:
            out.append(CLine(no, text, "SKIP"))
            continue
        if re.match(r"\\item\b", stripped):
            out.append(CLine(no, text, "ITEM"))
            continue
        if re.match(r"\\[a-zA-Z]+\*?\s*$", stripped):
            out.append(CLine(no, text, "SKIP"))
            continue
        out.append(CLine(no, text, "BODY"))

    return out


def is_tikz_line(text: str) -> bool:
    return bool(re.search(r"\\(node|draw)\b|tikzpicture|box/\.style", text))


# --------------------------------------------------------------------------
# Cleaning and sentence splitting
# --------------------------------------------------------------------------


def clean_for_words(text: str) -> str:
    """Strip LaTeX for word counting (Ch01 retro: naive split counts commands)."""
    text = text.replace("~", " ")
    text = re.sub(r"\$[^$]*\$", " X ", text)
    text = re.sub(r"\\cite\{[^}]*\}", "", text)
    text = re.sub(r"\\label\{[^}]*\}", "", text)
    text = re.sub(r"\\[a-zA-Z]+\*?", " ", text)
    text = re.sub(r"[{}]", " ", text)
    return re.sub(r"\s+", " ", text).strip()


def protect_periods(text: str, extra_abbr: list[str]) -> str:
    for abbr in PROTECTED_ABBR + extra_abbr:
        text = re.sub(
            r"\b" + re.escape(abbr) + r"\.",
            abbr.replace(".", "") + PLACEHOLDER,
            text,
        )
    text = re.sub(r"(?<=\d)\.(?=\d)", PLACEHOLDER, text)
    return text


def split_sentences(text: str, extra_abbr: list[str]) -> list[str]:
    guarded = protect_periods(text, extra_abbr)
    parts = re.split(r"(?<=[.!?])\s+", guarded)
    out = []
    for part in parts:
        sentence = part.replace(PLACEHOLDER, ".").strip()
        if sentence:
            out.append(sentence)
    return out


# --------------------------------------------------------------------------
# Paragraph units
# --------------------------------------------------------------------------


@dataclass
class Unit:
    lines: list[CLine]
    is_item: bool
    is_first_body: bool = False


def build_units(clines: list[CLine]) -> list[Unit]:
    """Group BODY lines into blank-line blocks; each ITEM starts a unit."""
    units: list[Unit] = []
    current: list[CLine] = []

    def flush() -> None:
        if current:
            units.append(
                Unit(
                    lines=list(current),
                    is_item=current[0].kind == "ITEM",
                )
            )
            current.clear()

    for cline in clines:
        if cline.kind == "SKIP" and not cline.text.strip():
            flush()
        elif cline.kind == "ITEM":
            flush()
            current.append(cline)
        elif cline.kind in ("BODY", "ITEM"):
            current.append(cline)
        elif cline.kind == "ROW":
            flush()
        else:  # META or code SKIP with text: boundary, not prose
            flush()
    flush()

    seen_body = False
    for unit in units:
        if not seen_body:
            unit.is_first_body = True
            seen_body = True
    return units


def find_sentence_line(unit: Unit, extra_abbr: list[str], index: int) -> int:
    """Map the index-th sentence of a unit back to its starting line."""
    joined = clean_for_words(" ".join(c.text for c in unit.lines))
    sentences = split_sentences(joined, extra_abbr)
    if index >= len(sentences):
        return unit.lines[-1].no
    needle = sentences[index][:30]
    for cline in unit.lines:
        if needle and needle in clean_for_words(cline.text):
            return cline.no
    return unit.lines[0].no


# --------------------------------------------------------------------------
# Checks
# --------------------------------------------------------------------------


@dataclass
class Context:
    path: Path
    strict: bool
    extra_phrasals: list[str]
    extra_abbr: list[str]
    findings: list[Finding] = None  # type: ignore[assignment]

    def __post_init__(self) -> None:
        self.findings = []

    def add(
        self,
        line: int,
        group: str,
        tier: str,
        rule: str,
        excerpt: str,
        fix: str,
    ) -> None:
        excerpt = re.sub(r"\s+", " ", excerpt).strip()[:140]
        self.findings.append(
            Finding(
                file=str(self.path),
                line=line,
                group=group,
                tier=tier,
                rule=rule,
                excerpt=excerpt,
                fix=fix,
            )
        )


def check_word_level(ctx: Context, clines: list[CLine]) -> None:
    phrasals = dict(PHRASAL_FIXES)
    for extra in ctx.extra_phrasals:
        phrasals.setdefault(extra, "rephrase without the phrasal verb")

    for cline in clines:
        if cline.kind not in ("BODY", "ITEM", "ROW"):
            continue
        text = cline.text

        for british, american in BRITISH_TO_AMERICAN.items():
            match = re.search(r"\b" + re.escape(british) + r"\b", text, re.IGNORECASE)
            if match:
                fix_word = american.capitalize() if match.group(0)[:1].isupper() else american
                ctx.add(
                    cline.no,
                    "STE",
                    "fail",
                    "STE-1.14",
                    text,
                    f"use American spelling `{fix_word}`",
                )

        de_escaped = text.replace("\\;", " ")
        if ";" in de_escaped and not is_tikz_line(text):
            ctx.add(
                cline.no,
                "STE",
                "fail",
                "STE-8.1",
                text,
                "replace `;` with a period or comma",
            )

        for pattern in CONTRACTION_RES:
            for match in pattern.finditer(text):
                ctx.add(
                    cline.no,
                    "STE",
                    "fail",
                    "STE-4.2",
                    text,
                    f"expand `{match.group(0)}`",
                )

        lowered = text.lower()
        for phrasal, fix in phrasals.items():
            if re.search(r"\b" + re.escape(phrasal) + r"\b", lowered):
                ctx.add(
                    cline.no,
                    "STE",
                    "fail",
                    "STE-9.3",
                    text,
                    f"replace `{phrasal}` with `{fix}`",
                )

        if re.search(r"\bquietly\b", text, re.IGNORECASE):
            ctx.add(cline.no, "humanizer", "fail", "H-§12", text, "cut `quietly`")
        for word in ("robust", "gated"):
            if re.search(r"\b" + word + r"\b", text, re.IGNORECASE):
                ctx.add(
                    cline.no,
                    "humanizer",
                    "judge",
                    "H-§12-flavored",
                    text,
                    f"keep `{word}` only with a named metric or lock beside it",
                )

        if "—" in text or "–" in text:
            ctx.add(
                cline.no,
                "humanizer",
                "fail",
                "H-§8",
                text,
                "replace the dash with a period, comma, or colon",
            )
        elif "--" in text and not is_tikz_line(text):
            ctx.add(
                cline.no,
                "humanizer",
                "fail",
                "H-§8",
                text,
                "LaTeX `--` renders an en dash; use a single hyphen",
            )

        if "\\textbf{" in text:
            bolds = re.findall(r"\\textbf\{([^}]*)\}", text)
            is_label = bool(bolds) and all(
                re.match(
                    r"^(Phase|FR-|NFR-|Chapter|Section|Table|Figure)"
                    r"~?[\w\d.\-]*$",
                    b.replace(" ", "").replace("~", ""),
                )
                for b in bolds
            )
            is_item_lead = cline.kind == "ITEM" and bool(
                re.match(r"\s*\\item\s*\\textbf\{[^}]*\.\}", text)
            )
            if "&" in text or is_label or is_item_lead:
                ctx.add(
                    cline.no,
                    "humanizer",
                    "info",
                    "H-§19",
                    text,
                    "table-header, identifier, or requirement-label bold "
                    "is conventional; leave alone",
                )
            else:
                ctx.add(
                    cline.no,
                    "humanizer",
                    "fail",
                    "H-§19",
                    text,
                    "remove the bold decoration",
                )


def check_sentences(ctx: Context, unit: Unit) -> None:
    joined = clean_for_words(" ".join(c.text for c in unit.lines))
    sentences = split_sentences(joined, ctx.extra_abbr)
    cap = 20 if (ctx.strict and unit.is_item) else 25

    for index, sentence in enumerate(sentences):
        words = sentence.split()
        lineno = find_sentence_line(unit, ctx.extra_abbr, index)
        if len(words) > cap:
            ctx.add(
                lineno,
                "STE",
                "fail",
                "STE-5.1" if cap == 20 else "STE-6.3",
                sentence,
                f"split past {cap} words; never drop a fact",
            )

        for match in re.finditer(
            r"\b(has|have|had)\b\s+([A-Za-z]+(?:ed|en))\b",
            sentence,
            re.IGNORECASE,
        ):
            participle = match.group(2).lower()
            if participle not in NOT_PARTICIPLE:
                ctx.add(
                    lineno,
                    "STE",
                    "fail",
                    "STE-3.2",
                    sentence,
                    "use a simple tense",
                )
                break

        if re.search(
            r"\b(may|might|can|could|shall|should|will|would|must)"
            r"\s+have\s+[A-Za-z]+(?:ed|en)\b",
            sentence,
            re.IGNORECASE,
        ):
            ctx.add(
                lineno,
                "STE",
                "fail",
                "STE-3.4",
                sentence,
                "unstack the auxiliaries",
            )

        by_match = re.search(r"\b[A-Za-z]+(?:ed|en)\s+by\s+(the|a|an|[A-Za-z]+)\b", sentence)
        if by_match and not re.search(r"\b(by\s+means\s+of|stand\s+by)\b", sentence, re.IGNORECASE):
            ctx.add(
                lineno,
                "STE",
                "judge",
                "STE-3.6-flavored",
                sentence,
                "known actor after `by`; prefer active if clearer",
            )

        if re.search(r"\b(is|are|was|were)\s+[A-Za-z]+ing\b", sentence, re.IGNORECASE):
            ctx.add(
                lineno,
                "STE",
                "judge",
                "STE-3.5",
                sentence,
                "prefer a simple tense where it works",
            )

        if re.search(
            r"\b(perform|conduct|carries?\s+out|make|makes|give|do|does)"
            r"\s+(a|an|the)?\s*[A-Za-z]+"
            r"(tion|ment|sis|ance|ence|ity)\s+of\b",
            sentence,
            re.IGNORECASE,
        ):
            ctx.add(
                lineno,
                "STE",
                "judge",
                "STE-3.7",
                sentence,
                "use the verb form of the nominalization",
            )

        if ctx.strict and re.search(r"\busing\b", sentence, re.IGNORECASE):
            ctx.add(
                lineno,
                "STE",
                "fail",
                "STE-strict-using",
                sentence,
                "strict mode: use `use` or `with`",
            )


def check_paragraphs(ctx: Context, units: list[Unit]) -> None:
    for unit in units:
        joined = clean_for_words(" ".join(c.text for c in unit.lines))
        sentences = split_sentences(joined, ctx.extra_abbr)
        start = unit.lines[0].no
        if len(sentences) > 6:
            ctx.add(
                start,
                "STE",
                "fail",
                "STE-6.6",
                " ".join(sentences[:2]) + " …",
                "split before the project-contrast pivot; never drop a fact",
            )
        elif unit.is_first_body and 4 <= len(sentences) <= 6:
            ctx.add(
                start,
                "guide",
                "info",
                "guide-2-4",
                "roadmap paragraph runs long",
                "guide prefers 2-4 sentences; STE fails only past 6",
            )


def check_cross_refs(ctx: Context, clines: list[CLine]) -> None:
    seen_labels: dict[str, int] = {}
    for cline in clines:
        text = cline.text
        for label in re.findall(r"\\label\{([^}]*)\}", text):
            if label in seen_labels:
                ctx.add(
                    cline.no,
                    "guide",
                    "fail",
                    "guide-label",
                    text,
                    f"label `{label}` already defined at line {seen_labels[label]}",
                )
            else:
                seen_labels[label] = cline.no
        if cline.kind not in ("BODY", "ITEM"):
            continue
        for match in re.finditer(
            r"\b(Section|Figure|Table|Chapter|Equation)\s+(?![~\\])\S",
            text,
        ):
            ctx.add(
                cline.no,
                "guide",
                "fail",
                "guide-xref",
                text,
                f"use `{match.group(1)}~` with a number or `\\ref`",
            )


# --------------------------------------------------------------------------
# Driver
# --------------------------------------------------------------------------


def lint_file(
    path: Path,
    strict: bool,
    extra_phrasals: list[str],
    extra_abbr: list[str],
) -> tuple[list[Finding], int]:
    raw = path.read_text(encoding="utf-8").splitlines(keepends=True)
    clines = classify_lines(raw)
    ctx = Context(
        path=path,
        strict=strict,
        extra_phrasals=extra_phrasals,
        extra_abbr=extra_abbr,
    )

    check_word_level(ctx, clines)
    units = build_units(clines)
    for unit in units:
        check_sentences(ctx, unit)
    check_paragraphs(ctx, units)
    check_cross_refs(ctx, clines)

    words = sum(
        len(clean_for_words(c.text).split()) for c in clines if c.kind in ("BODY", "ITEM", "ROW")
    )
    return ctx.findings, words


def summarize(path: Path, findings: list[Finding], words: int, strict: bool) -> dict:
    ste_fail = sum(1 for f in findings if f.group == "STE" and f.tier == "fail")
    hum_fail = sum(1 for f in findings if f.group == "humanizer" and f.tier == "fail")
    fail_hits = sum(1 for f in findings if f.tier == "fail")
    density = round(fail_hits / max(words, 1) * 100, 2)
    target = 1.5 if strict else 2.5
    return {
        "file": str(path),
        "words": words,
        "ste": "PASS" if ste_fail == 0 else "FAIL",
        "ste_fail": ste_fail,
        "humanizer": "PASS" if hum_fail == 0 else "FAIL",
        "humanizer_fail": hum_fail,
        "density": density,
        "density_target": target,
        "density_pass": density <= target,
        "findings": len(findings),
    }


def render_text(summaries: list[dict], findings: list[Finding], by_file: bool = False) -> str:
    lines: list[str] = []
    ordered = sorted(findings, key=lambda f: (f.file, f.line, f.group, f.rule))
    current_group = ""
    for finding in ordered:
        if finding.group != current_group:
            current_group = finding.group
            lines.append(f"\n## {current_group}")
        lines.append(finding.row())
    for summary in summaries:
        lines.append("")
        lines.append(
            f"STE: {summary['ste']} "
            f"(fail-tier hits: {summary['ste_fail']}, "
            f"density {summary['density']}/100w vs {summary['density_target']})"
        )
        lines.append(
            f"Humanizer: {summary['humanizer']} (fail-tier hits: {summary['humanizer_fail']})"
        )
    return "\n".join(lines).strip() + "\n"


MANUAL_ONLY = """Checks that stay manual (this script never attempts them):
- 4-beat lit completeness (attribution, mechanism, metric, gap)
- whether a Not-X-but-Y contrast carries new information (H-§1 nuance)
- whether a 3-item list is a real triad (H-§6 nuance)
- number ground truth (grep the gate, harness, or STATUS archive row)
- cross-chapter project-term stability
- dropped articles and 4-word noun clusters (need parsing, not patterns)
"""


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        description="STE-flavored + humanizer lint for .tex chapters. "
        "Lint first, judge second: fail-tier rows are mechanical, "
        "judge-tier rows need a human.",
        epilog=MANUAL_ONLY,
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    parser.add_argument("files", nargs="+", help=".tex chapter files")
    parser.add_argument(
        "--strict",
        action="store_true",
        help="20-word instruction cap plus strict word set (`using` -> `use`/`with`)",
    )
    parser.add_argument("--json", action="store_true", help="emit machine-readable rows")
    parser.add_argument(
        "--add-phrasal",
        action="append",
        default=[],
        help="extra banned phrasal verb (repeatable)",
    )
    parser.add_argument(
        "--abbr",
        action="append",
        default=[],
        help="extra abbreviation whose period never ends a sentence",
    )
    args = parser.parse_args(argv)

    all_findings: list[Finding] = []
    summaries: list[dict] = []
    worst = 0
    for name in args.files:
        path = Path(name)
        if not path.is_file():
            print(f"ste-check: no such file: {name}", file=sys.stderr)
            return 2
        findings, words = lint_file(path, args.strict, args.add_phrasal, args.abbr)
        all_findings.extend(findings)
        summary = summarize(path, findings, words, args.strict)
        summaries.append(summary)
        if any(f.tier == "fail" for f in findings):
            worst = 1

    if args.json:
        payload = {
            "summaries": summaries,
            "findings": [
                {
                    "file": f.file,
                    "line": f.line,
                    "group": f.group,
                    "tier": f.tier,
                    "rule": f.rule,
                    "excerpt": f.excerpt,
                    "fix": f.fix,
                }
                for f in sorted(all_findings, key=lambda f: (f.file, f.line))
            ],
        }
        print(json.dumps(payload, indent=2))
    else:
        print(render_text(summaries, all_findings), end="")
    return worst


if __name__ == "__main__":
    sys.exit(main())
