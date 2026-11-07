"""Tests for ste-check.py.

Run explicitly (root testpaths deliberately untouched):
    .venv/bin/python -m pytest .work/active/phase2-prose-review/test_ste_check.py

Golden notes (pinned 2026-10-23 after the AI-pattern fix pass):
- Ch01, Ch02, and Ch03 all read STE PASS and Humanizer PASS with zero
  fail-tier hits. The pre-fix Ch01 pin (13 over-length, 27 STE fails, one
  humanizer fail) is historical and lives in the audit report, not here.
- Remaining findings on all three chapters are guide info rows or
  humanizer judge rows. A new fail-tier finding means a real regression.
- Ch01 and Ch03 carry one `gated` judge row each because the same sentence
  names the lock; the tool keeps those as judge rows by design.
"""

import json
import subprocess
import sys
from collections import Counter
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

from ste_check import (
    Context,
    build_units,
    check_cross_refs,
    check_paragraphs,
    check_sentences,
    check_word_level,
    classify_lines,
    clean_for_words,
    lint_file,
    split_sentences,
    summarize,
)

REPO_ROOT = Path(__file__).resolve().parents[3]
CH01 = REPO_ROOT / (
    "college/mydeliverables/Phase-2-report/phase2-report/chapters/01-introduction.tex"
)
CH02 = REPO_ROOT / (
    "college/mydeliverables/Phase-2-report/phase2-report/chapters/02-literature-survey.tex"
)
CH03 = REPO_ROOT / (
    "college/mydeliverables/Phase-2-report/phase2-report/chapters/03-requirements.tex"
)


def make_ctx(text: str, **kwargs) -> tuple[Context, list]:
    clines = classify_lines(text.splitlines(keepends=True))
    ctx = Context(
        path=Path("test.tex"),
        strict=kwargs.get("strict", False),
        extra_phrasals=kwargs.get("extra_phrasals", []),
        extra_abbr=kwargs.get("extra_abbr", []),
    )
    return ctx, clines


def rules_of(ctx: Context) -> Counter:
    return Counter((f.rule, f.tier) for f in ctx.findings)


# --------------------------------------------------------------------------
# Sentence splitting
# --------------------------------------------------------------------------


def test_et_al_does_not_split_sentence() -> None:
    sents = split_sentences("Chen et al. present a model. It works well.", [])
    assert sents == ["Chen et al. present a model.", "It works well."]


def test_decimals_and_section_numbers_do_not_split() -> None:
    sents = split_sentences(
        "An AUC of 0.888 against 0.889 for the baseline. See Section 2.1 for detail.",
        [],
    )
    assert len(sents) == 2


def test_abbreviations_do_not_split() -> None:
    sents = split_sentences("Checks e.g. passivity vs. speed. Done.", [])
    assert len(sents) == 2


# --------------------------------------------------------------------------
# Cleaning / classification regressions (Ch01 retro)
# --------------------------------------------------------------------------


def test_latex_commands_not_counted_as_words() -> None:
    assert clean_for_words(r"\item The system shall log sessions.") == (
        "The system shall log sessions."
    )
    assert (
        clean_for_words(r"The rubric makes the \textbf{judgment} repeatable.")
        == "The rubric makes the judgment repeatable."
    )


def test_math_replaced_not_counted() -> None:
    cleaned = clean_for_words(r"prior knowledge $P(L_0)$, learning rate $T$")
    assert cleaned == "prior knowledge X , learning rate X"


def test_tilde_becomes_space() -> None:
    assert "Section 2.1" in clean_for_words(r"Section~2.1 covers tracing.")


def test_equation_env_is_skipped() -> None:
    text = "\\begin{equation}\nP(L_n) = 1 \\\\\n\\end{equation}\n"
    clines = classify_lines(text.splitlines(keepends=True))
    assert all(c.kind == "SKIP" for c in clines)


def test_caption_and_labels_are_skipped() -> None:
    text = "\\caption{The loop this chapter motivates.}\n\\label{fig:closed-loop}\n"
    ctx, clines = make_ctx(text)
    check_word_level(ctx, clines)
    assert ctx.findings == []


def test_semicolon_in_tikz_is_not_flagged() -> None:
    text = "\\draw[->] (mat) -- (gen);\n"
    ctx, clines = make_ctx(text)
    check_word_level(ctx, clines)
    assert ctx.findings == []


def test_escaped_semicolon_is_not_flagged() -> None:
    ctx, clines = make_ctx("Spacing\\;here is fine.\n")
    check_word_level(ctx, clines)
    assert not [f for f in ctx.findings if f.rule == "STE-8.1"]


def test_semicolon_in_table_row_is_flagged() -> None:
    text = (
        "\\begin{tabular}{p{3cm} p{4cm}}\n"
        "A & Per-skill mastery; interpretable \\\\\n"
        "\\end{tabular}\n"
    )
    ctx, clines = make_ctx(text)
    assert clines[1].kind == "ROW"
    check_word_level(ctx, clines)
    assert ("STE-8.1", "fail") in rules_of(ctx)


# --------------------------------------------------------------------------
# Word checks
# --------------------------------------------------------------------------


def test_british_spellings_with_case() -> None:
    ctx, clines = make_ctx("Behavioural metrics and behaviour matter, modelling judgement.\n")
    check_word_level(ctx, clines)
    rows = [(f.excerpt, f.fix) for f in ctx.findings if f.rule == "STE-1.14"]
    assert len(rows) == 4
    assert any("`Behavioral`" in fix for _, fix in rows)


def test_american_spellings_not_flagged() -> None:
    ctx, clines = make_ctx("Behavioral modeling with good judgment.\n")
    check_word_level(ctx, clines)
    assert not [f for f in ctx.findings if f.rule == "STE-1.14"]


def test_contractions_flagged_possessives_safe() -> None:
    ctx, clines = make_ctx("The learner's estimate can't be wrong but it's fine.\n")
    check_word_level(ctx, clines)
    flagged = [f for f in ctx.findings if f.rule == "STE-4.2"]
    assert len(flagged) == 2  # can't, it's; learner's is possessive


def test_phrasal_ban_and_add_phrasal() -> None:
    ctx, clines = make_ctx("Guidance that hands over the answer fails.\n")
    check_word_level(ctx, clines)
    assert ("STE-9.3", "fail") in rules_of(ctx)

    ctx2, clines2 = make_ctx(
        "A bespoke lint runs here.\n",
        extra_phrasals=["bespoke lint"],
    )
    check_word_level(ctx2, clines2)
    assert ("STE-9.3", "fail") in rules_of(ctx2)


def test_en_dash_latex_double_hyphen() -> None:
    ctx, clines = make_ctx("A Transformer--Bayesian hybrid works.\n")
    check_word_level(ctx, clines)
    assert ("H-§8", "fail") in rules_of(ctx)


def test_single_hyphen_compound_is_clean() -> None:
    ctx, clines = make_ctx("A Transformer-Bayesian hybrid works.\n")
    check_word_level(ctx, clines)
    assert not [f for f in ctx.findings if f.rule == "H-§8"]


def test_textbf_body_fails_header_and_labels_info() -> None:
    body, _ = make_ctx("The \\textbf{win} matters here.\n")
    check_word_level(body, classify_lines(["The \\textbf{win} matters.\n"]))
    assert ("H-§19", "fail") in rules_of(body)

    header, _ = make_ctx("\\textbf{A} & \\textbf{B} \\\\\n")
    check_word_level(header, classify_lines(["\\textbf{A} & \\textbf{B} \\\\\n"]))
    assert ("H-§19", "info") in rules_of(header)

    lead, _ = make_ctx("\\item \\textbf{Offline-first operation.} Works.\n")
    check_word_level(
        lead,
        classify_lines(["\\item \\textbf{Offline-first operation.} Works.\n"]),
    )
    assert ("H-§19", "info") in rules_of(lead)

    phase, _ = make_ctx("Built in \\textbf{Phase~I} earlier work.\n")
    check_word_level(
        phase,
        classify_lines(["Built in \\textbf{Phase~I} earlier work.\n"]),
    )
    assert ("H-§19", "info") in rules_of(phase)


def test_quietly_fails_robust_gated_are_judge() -> None:
    ctx, clines = make_ctx("The plan quietly turns wrong with robust pacing behind a gated step.\n")
    check_word_level(ctx, clines)
    counts = rules_of(ctx)
    assert counts[("H-§12", "fail")] == 1
    assert counts[("H-§12-flavored", "judge")] == 2


# --------------------------------------------------------------------------
# Sentence checks
# --------------------------------------------------------------------------


def test_present_perfect_flagged_simple_tenses_clean() -> None:
    ctx, clines = make_ctx("The learner has worked already.\n")
    units = build_units(clines)
    check_sentences(ctx, units[0])
    assert ("STE-3.2", "fail") in rules_of(ctx)

    clean, clean_lines = make_ctx("The learner worked already.\n")
    check_sentences(clean, build_units(clean_lines)[0])
    assert not [f for f in clean.findings if f.rule == "STE-3.2"]


def test_had_even_not_a_participle() -> None:
    ctx, clines = make_ctx("It had even reached the limit.\n")
    check_sentences(ctx, build_units(clines)[0])
    assert not [f for f in ctx.findings if f.rule == "STE-3.2"]


def test_modal_stack_flagged() -> None:
    ctx, clines = make_ctx("It may have failed there.\n")
    check_sentences(ctx, build_units(clines)[0])
    assert ("STE-3.4", "fail") in rules_of(ctx)


def test_passive_by_is_judge_bare_passive_is_clean() -> None:
    ctx, clines = make_ctx("Grades applied by a language model stand.\n")
    check_sentences(ctx, build_units(clines)[0])
    assert ("STE-3.6-flavored", "judge") in rules_of(ctx)

    clean, clean_lines = make_ctx("The file is required here.\n")
    check_sentences(clean, build_units(clean_lines)[0])
    assert not [f for f in clean.findings if f.rule == "STE-3.6-flavored"]


def test_progressive_is_judge() -> None:
    ctx, clines = make_ctx("The worker is running now.\n")
    check_sentences(ctx, build_units(clines)[0])
    assert ("STE-3.5", "judge") in rules_of(ctx)


def test_nominalization_needs_of_shape() -> None:
    ctx, clines = make_ctx("Perform an analysis of the log daily.\n")
    check_sentences(ctx, build_units(clines)[0])
    assert ("STE-3.7", "judge") in rules_of(ctx)

    clean, clean_lines = make_ctx("The rubric makes the judgment clear.\n")
    check_sentences(clean, build_units(clean_lines)[0])
    assert not [f for f in clean.findings if f.rule == "STE-3.7"]


def test_long_sentence_fails_with_line_mapping() -> None:
    words = " ".join(f"word{i}" for i in range(30))
    ctx, clines = make_ctx(f"First line here. {words}.\nSecond line.\n")
    check_sentences(ctx, build_units(clines)[0])
    fails = [f for f in ctx.findings if f.rule == "STE-6.3"]
    assert len(fails) == 1 and fails[0].line == 1


# --------------------------------------------------------------------------
# Paragraph units
# --------------------------------------------------------------------------


def test_seven_sentence_para_fails() -> None:
    text = " ".join(f"Sentence {i} here." for i in range(7)) + "\n"
    ctx, clines = make_ctx(text)
    check_paragraphs(ctx, build_units(clines))
    assert ("STE-6.6", "fail") in rules_of(ctx)


def test_enum_items_are_separate_units() -> None:
    text = "".join(f"\\item Short point {i}.\n" for i in range(8))
    ctx, clines = make_ctx(text)
    check_paragraphs(ctx, build_units(clines))
    assert not [f for f in ctx.findings if f.rule == "STE-6.6"]


def test_table_rows_excluded_from_para_check() -> None:
    text = (
        "\\begin{tabular}{p{3cm} p{4cm}}\n"
        "\\toprule\n"
        "A & One. Two. Three. Four. Five. Six. Seven. Eight. \\\\\n"
        "\\bottomrule\n"
        "\\end{tabular}\n"
    )
    ctx, clines = make_ctx(text)
    check_paragraphs(ctx, build_units(clines))
    assert not [f for f in ctx.findings if f.rule == "STE-6.6"]


# --------------------------------------------------------------------------
# Cross refs
# --------------------------------------------------------------------------


def test_bare_section_number_flagged_tilde_clean() -> None:
    ctx, clines = make_ctx("See Section 2.1 for detail.\n")
    check_cross_refs(ctx, clines)
    assert ("guide-xref", "fail") in rules_of(ctx)

    clean, clean_lines = make_ctx("See Section~2.1 for detail.\n")
    check_cross_refs(clean, clean_lines)
    assert not [f for f in clean.findings if f.rule == "guide-xref"]


def test_duplicate_labels_flagged() -> None:
    text = "\\label{eq:x}\n\\label{eq:x}\n"
    ctx, clines = make_ctx(text)
    check_cross_refs(ctx, clines)
    assert ("guide-label", "fail") in rules_of(ctx)


# --------------------------------------------------------------------------
# CLI
# --------------------------------------------------------------------------


def test_strict_mode_instruction_cap_and_using(tmp_path: Path) -> None:
    target = tmp_path / "t.tex"
    words = " ".join(f"w{i}" for i in range(22))
    target.write_text(f"\\item {words} using this thing.\n")
    proc = subprocess.run(
        [sys.executable, "ste_check.py", "--strict", str(target)],
        capture_output=True,
        text=True,
        cwd=REPO_ROOT / ".work/active/phase2-prose-review",
    )
    assert proc.returncode == 1
    assert "STE-5.1" in proc.stdout and "STE-strict-using" in proc.stdout


def test_exit_codes_and_json_shape(tmp_path: Path) -> None:
    clean = tmp_path / "clean.tex"
    clean.write_text("Short body text here.\n")
    script_dir = REPO_ROOT / ".work/active/phase2-prose-review"
    ok_proc = subprocess.run(
        [sys.executable, "ste_check.py", "--json", str(clean)],
        capture_output=True,
        text=True,
        cwd=script_dir,
    )
    assert ok_proc.returncode == 0
    payload = json.loads(ok_proc.stdout)
    assert payload["summaries"][0]["ste"] == "PASS"

    missing = subprocess.run(
        [sys.executable, "ste_check.py", "nope.tex"],
        capture_output=True,
        text=True,
        cwd=script_dir,
    )
    assert missing.returncode == 2


# --------------------------------------------------------------------------
# Goldens
# --------------------------------------------------------------------------


def test_ch01_post_fix_is_clean() -> None:
    findings, words = lint_file(CH01, False, [], [])
    summary = summarize(CH01, findings, words, False)
    assert summary["ste"] == "PASS" and summary["ste_fail"] == 0
    assert summary["humanizer"] == "PASS"
    assert summary["humanizer_fail"] == 0
    assert summary["density"] == 0.0
    assert all(f.tier in ("judge", "info") for f in findings)


def test_ch02_post_fix_is_clean() -> None:
    findings, words = lint_file(CH02, False, [], [])
    summary = summarize(CH02, findings, words, False)
    assert summary["ste"] == "PASS" and summary["ste_fail"] == 0
    assert summary["humanizer"] == "PASS"
    assert summary["humanizer_fail"] == 0
    assert summary["density"] == 0.0
    assert all(f.tier in ("judge", "info") for f in findings)


def test_ch03_post_fix_is_clean() -> None:
    findings, words = lint_file(CH03, False, [], [])
    summary = summarize(CH03, findings, words, False)
    assert summary["ste"] == "PASS" and summary["ste_fail"] == 0
    assert summary["humanizer"] == "PASS"
    assert summary["humanizer_fail"] == 0
    assert summary["density"] == 0.0
    assert all(f.tier in ("judge", "info") for f in findings)
