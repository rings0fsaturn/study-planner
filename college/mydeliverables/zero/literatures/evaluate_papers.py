#!/usr/bin/env python3
"""
Fetch paper metadata and evaluate fitness for Phase I research.

Supports:
    - DOIs (e.g., 10.1234/example)
    - Direct PDF URLs (e.g., http://example.com/paper.pdf)
    - Article page URLs (e.g., https://journal.com/article/123)

Usage:
    python3 evaluate_papers.py                    # reads dois.txt
    python3 evaluate_papers.py --file other.txt   # reads custom file
    python3 evaluate_papers.py --doi 10.1234/...  # single entry

Outputs:
    - Console summary per paper (title, authors, year, relevance score, cluster match)
    - evaluated_papers.json with full metadata + evaluation
"""

import json
import re
import ssl
import sys
import time
import urllib.request
import urllib.error
from datetime import datetime, timezone
from html.parser import HTMLParser
from pathlib import Path

_SSL_CTX = ssl._create_unverified_context()
_PROGRESS_STARTED_AT = time.monotonic()

SCRIPT_DIR = Path(__file__).parent

CLUSTERS = {
    "bayesian_calibration": {
        "label": "Bayesian Calibration / Knowledge Tracing",
        "keywords": [
            "bayesian", "knowledge tracing", "bkt", "learner model",
            "student model", "calibration", "posterior", "prior",
            "pace estimation", "hierarchical", "item response theory",
            "learner parameter", "mastery", "skill acquisition",
        ],
        "weight": 1.0,
    },
    "change_point_detection": {
        "label": "CUSUM / Change-Point Detection",
        "keywords": [
            "cusum", "change point", "changepoint", "regime shift",
            "behavioral change", "statistical process control",
            "drift detection", "concept drift", "anomaly detection",
            "early warning", "shift detection", "monitoring",
        ],
        "weight": 1.0,
    },
    "gaussian_process": {
        "label": "Gaussian Process / Progress Prediction",
        "keywords": [
            "gaussian process", "gp regression", "kriging",
            "learning curve", "progress prediction", "forecasting",
            "confidence interval", "uncertainty quantification",
            "kernel method", "rbf kernel", "time series prediction",
        ],
        "weight": 0.9,
    },
    "adaptive_scheduling": {
        "label": "Adaptive Scheduling / Study Planning",
        "keywords": [
            "adaptive learning path", "study schedule", "study plan",
            "learning path", "timetabl", "constraint", "scheduling",
            "resource allocation", "material sequencing", "curriculum",
            "personalized path", "course sequence", "recommender",
        ],
        "weight": 0.9,
    },
    "self_regulated_learning": {
        "label": "Self-Regulated / Self-Directed Learning",
        "keywords": [
            "self-regulated", "self-directed", "self-paced",
            "metacognition", "learning analytics", "dashboard",
            "learning behavior", "study behavior", "engagement",
            "procrastination", "time management", "feedback loop",
        ],
        "weight": 0.7,
    },
    "spaced_practice": {
        "label": "Spaced Practice / Interleaving",
        "keywords": [
            "spaced repetition", "spaced practice", "interleav",
            "desirable difficult", "retrieval practice", "spacing effect",
            "distributed practice", "forgetting curve", "retention",
            "habit formation", "study habit",
        ],
        "weight": 0.7,
    },
    "student_performance": {
        "label": "Student Performance Prediction",
        "keywords": [
            "student performance", "academic performance", "grade predict",
            "dropout", "at-risk", "early alert", "learning outcome",
            "predict", "classification", "regression", "neural network",
            "deep learning", "machine learning", "random forest",
        ],
        "weight": 0.5,
    },
    # ---- Pillar B: Assessment-Based Verification ----
    "knowledge_tracing": {
        "label": "Knowledge Tracing / Mastery (Pillar B)",
        "keywords": [
            "knowledge tracing", "deep knowledge tracing", "dkt", "bkt",
            "concept mastery", "skill mastery", "mastery estimation",
            "item response theory", "deep-irt", "student knowledge state",
            "learner mastery",
        ],
        "weight": 1.0,
    },
    "question_generation": {
        "label": "Automatic Question Generation (Pillar B)",
        "keywords": [
            "question generation", "item generation", "distractor",
            "multiple choice question", "mcq generation", "quiz generation",
            "automatic item generation", "assessment generation",
            "large language model", "llm",
        ],
        "weight": 1.0,
    },
    "answer_evaluation": {
        "label": "Automated Answer Evaluation / Grading (Pillar B)",
        "keywords": [
            "automated grading", "automatic grading", "short answer grading",
            "essay scoring", "answer evaluation", "automated assessment",
            "code assessment", "automated feedback", "answer scoring",
        ],
        "weight": 0.8,
    },
    "assessment_integrity": {
        "label": "Assessment Integrity / Gaming & Verification (Pillar B)",
        "keywords": [
            "gaming the system", "academic integrity", "cheating detection",
            "self-report", "verification", "honesty", "engagement detection",
            "learning verification", "test security", "answer copying",
        ],
        "weight": 1.0,
    },
    "concept_extraction": {
        "label": "Concept / KC Extraction from Content (Pillar B)",
        "keywords": [
            "knowledge component", "concept extraction", "skill tagging",
            "topic modeling", "knowledge concept", "concept tagging",
            "curriculum mapping", "q-matrix",
        ],
        "weight": 0.8,
    },
}


def log_progress(percent, state, detail="", *, enabled=True):
    if not enabled:
        return
    pct = max(0, min(100, int(round(percent))))
    timestamp = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    elapsed = int(time.monotonic() - _PROGRESS_STARTED_AT)
    suffix = f" detail={detail}" if detail else ""
    print(
        f"[evaluate-papers-progress] {timestamp} {pct:03d}% state={state} elapsed={elapsed}s{suffix}",
        file=sys.stderr,
        flush=True,
    )


def _http_get(url: str, accept: str = "application/json", timeout: int = 15) -> bytes | None:
    headers = {
        "User-Agent": "MTechProjectLitReview/1.0 (mailto:iam.rohitsaji@gmail.com)",
        "Accept": accept,
    }
    req = urllib.request.Request(url, headers=headers)
    try:
        with urllib.request.urlopen(req, timeout=timeout, context=_SSL_CTX) as resp:
            return resp.read()
    except Exception:
        return None


def is_url(entry: str) -> bool:
    return entry.startswith("http://") or entry.startswith("https://")


def is_doi(entry: str) -> bool:
    return bool(re.match(r"^10\.\d{4,}/.+", entry))


def normalize_entry(entry: str) -> str:
    entry = entry.strip()
    if entry.startswith("https://doi.org/"):
        return entry.replace("https://doi.org/", "")
    if entry.startswith("http://doi.org/"):
        return entry.replace("http://doi.org/", "")
    return entry


# --- CrossRef + OpenAlex fetchers (for DOIs) ---

def fetch_crossref(doi: str) -> dict | None:
    url = f"https://api.crossref.org/works/{urllib.request.quote(doi, safe='')}"
    raw = _http_get(url)
    if not raw:
        return None
    try:
        return json.loads(raw).get("message", {})
    except Exception:
        return None


def fetch_openalex(doi: str) -> dict | None:
    url = f"https://api.openalex.org/works/doi:{doi}"
    raw = _http_get(url)
    if not raw:
        return None
    try:
        return json.loads(raw)
    except Exception:
        return None


def extract_metadata_from_doi(crossref: dict, openalex: dict | None, original: str) -> dict:
    title_parts = crossref.get("title", [])
    title = title_parts[0] if title_parts else "Unknown"

    authors = []
    for a in crossref.get("author", []):
        name = f"{a.get('given', '')} {a.get('family', '')}".strip()
        if name:
            authors.append(name)

    year = None
    for date_field in ["published-print", "published-online", "created"]:
        dp = crossref.get(date_field, {}).get("date-parts", [[]])
        if dp and dp[0] and dp[0][0]:
            year = dp[0][0]
            break

    journal = crossref.get("container-title", [""])[0] if crossref.get("container-title") else ""
    doi = crossref.get("DOI", original)

    abstract = ""
    if openalex and openalex.get("abstract_inverted_index"):
        idx = openalex["abstract_inverted_index"]
        max_pos = max(max(positions) for positions in idx.values())
        words = [""] * (max_pos + 1)
        for word, positions in idx.items():
            for pos in positions:
                words[pos] = word
        abstract = " ".join(w for w in words if w)
    elif crossref.get("abstract"):
        abstract = re.sub(r"<[^>]+>", "", crossref["abstract"])

    subjects = crossref.get("subject", [])

    return {
        "source": "doi",
        "doi": doi,
        "title": title,
        "authors": authors,
        "year": year,
        "journal": journal,
        "abstract": abstract,
        "subjects": subjects,
        "url": f"https://doi.org/{doi}",
    }


# --- URL-based fetchers (for PDFs and article pages) ---

class TitleExtractor(HTMLParser):
    def __init__(self):
        super().__init__()
        self._in_title = False
        self.title = ""
        self.meta = {}

    def handle_starttag(self, tag, attrs):
        if tag == "title":
            self._in_title = True
        if tag == "meta":
            attr_dict = dict(attrs)
            name = attr_dict.get("name", attr_dict.get("property", "")).lower()
            content = attr_dict.get("content", "")
            if name and content:
                self.meta[name] = content

    def handle_data(self, data):
        if self._in_title:
            self.title += data

    def handle_endtag(self, tag):
        if tag == "title":
            self._in_title = False


def fetch_metadata_from_url(url: str) -> dict:
    meta = {
        "source": "url",
        "doi": "",
        "title": "",
        "authors": [],
        "year": None,
        "journal": "",
        "abstract": "",
        "subjects": [],
        "url": url,
    }

    if url.lower().endswith(".pdf"):
        raw = _http_get(url, accept="application/pdf", timeout=20)
        if raw:
            text = ""
            try:
                text = raw[:8000].decode("utf-8", errors="ignore")
            except Exception:
                text = raw[:8000].decode("latin-1", errors="ignore")
            title_from_path = url.rstrip("/").split("/")[-1]
            title_from_path = re.sub(r"\.pdf$", "", title_from_path, flags=re.IGNORECASE)
            title_from_path = urllib.request.unquote(title_from_path).replace("_", " ").replace("-", " ")
            meta["title"] = title_from_path

            for line in text.split("\n"):
                line_lower = line.strip().lower()
                if not meta["abstract"] and ("abstract" in line_lower and len(line_lower) > 50):
                    meta["abstract"] = line.strip()[:500]

            year_match = re.search(r"(20[12]\d)", url + " " + text[:2000])
            if year_match:
                meta["year"] = int(year_match.group(1))
        else:
            meta["title"] = url.rstrip("/").split("/")[-1]
        return meta

    raw = _http_get(url, accept="text/html", timeout=15)
    if not raw:
        meta["title"] = url
        return meta

    try:
        html = raw.decode("utf-8", errors="ignore")
    except Exception:
        html = raw.decode("latin-1", errors="ignore")

    parser = TitleExtractor()
    try:
        parser.feed(html[:50000])
    except Exception:
        pass

    meta["title"] = (
        parser.meta.get("citation_title")
        or parser.meta.get("dc.title")
        or parser.meta.get("og:title")
        or parser.title.strip()
        or url
    )

    meta["abstract"] = (
        parser.meta.get("citation_abstract")
        or parser.meta.get("dc.description")
        or parser.meta.get("og:description")
        or parser.meta.get("description")
        or ""
    )

    author_str = (
        parser.meta.get("citation_author")
        or parser.meta.get("dc.creator")
        or parser.meta.get("author")
        or ""
    )
    if author_str:
        meta["authors"] = [a.strip() for a in author_str.split(";") if a.strip()]
        if len(meta["authors"]) == 1:
            meta["authors"] = [a.strip() for a in author_str.split(",") if a.strip()]

    date_str = (
        parser.meta.get("citation_publication_date")
        or parser.meta.get("citation_date")
        or parser.meta.get("dc.date")
        or ""
    )
    if date_str:
        year_match = re.search(r"(20[12]\d)", date_str)
        if year_match:
            meta["year"] = int(year_match.group(1))

    if not meta["year"]:
        year_match = re.search(r"(20[12]\d)", url + " " + parser.title)
        if year_match:
            meta["year"] = int(year_match.group(1))

    meta["journal"] = (
        parser.meta.get("citation_journal_title")
        or parser.meta.get("dc.source")
        or ""
    )

    doi_from_meta = parser.meta.get("citation_doi") or parser.meta.get("dc.identifier") or ""
    if doi_from_meta and re.match(r"^10\.\d{4,}/", doi_from_meta):
        meta["doi"] = doi_from_meta

    return meta


# --- Scoring ---

def score_relevance(meta: dict) -> dict:
    searchable = " ".join([
        meta.get("title", "").lower(),
        meta.get("abstract", "").lower(),
        " ".join(meta.get("subjects", [])).lower(),
    ])

    cluster_scores = {}
    matched_clusters = []

    for cluster_id, cluster in CLUSTERS.items():
        hits = []
        for kw in cluster["keywords"]:
            if kw.lower() in searchable:
                hits.append(kw)
        if hits:
            score = len(hits) * cluster["weight"]
            cluster_scores[cluster_id] = {
                "label": cluster["label"],
                "score": round(score, 2),
                "matched_keywords": hits,
            }
            matched_clusters.append(cluster["label"])

    total_score = sum(c["score"] for c in cluster_scores.values())

    if total_score >= 3.0:
        fitness = "STRONG FIT"
    elif total_score >= 1.5:
        fitness = "GOOD FIT"
    elif total_score >= 0.5:
        fitness = "PARTIAL FIT"
    else:
        fitness = "WEAK FIT"

    year = meta.get("year")
    if year and year >= 2024:
        recency = "RECENT (2024+)"
    elif year and year >= 2022:
        recency = "ACCEPTABLE (2022+)"
    elif year and year >= 2020:
        recency = "OLDER (2020+)"
    else:
        recency = "OLD" if year else "UNKNOWN YEAR"

    return {
        "total_score": round(total_score, 2),
        "fitness": fitness,
        "recency": recency,
        "matched_clusters": cluster_scores,
        "cluster_labels": matched_clusters,
    }


def print_paper(meta: dict, eval_result: dict, index: int):
    src_tag = f"[{meta.get('source', '?').upper()}]"
    print(f"\n{'='*80}")
    print(f"  Paper #{index}  {src_tag}")
    print(f"{'='*80}")
    print(f"  Title:   {meta['title'][:120]}")
    if meta["authors"]:
        print(f"  Authors: {', '.join(meta['authors'][:4])}" + (" et al." if len(meta['authors']) > 4 else ""))
    print(f"  Year:    {meta.get('year', '?')}  |  Journal: {meta.get('journal', '—')}")
    print(f"  URL:     {meta['url'][:100]}")
    if meta.get("doi"):
        print(f"  DOI:     https://doi.org/{meta['doi']}")
    print(f"  ---")
    print(f"  FITNESS: {eval_result['fitness']}  (score: {eval_result['total_score']})  |  {eval_result['recency']}")

    if eval_result["cluster_labels"]:
        print(f"  Clusters: {', '.join(eval_result['cluster_labels'])}")

    for cid, cdata in eval_result["matched_clusters"].items():
        kws = ", ".join(cdata["matched_keywords"][:5])
        print(f"    - {cdata['label']}: {kws}")

    if meta.get("abstract"):
        abstract_short = meta["abstract"][:300]
        if len(meta["abstract"]) > 300:
            abstract_short += "..."
        print(f"  Abstract: {abstract_short}")
    else:
        print(f"  Abstract: (not available — check paper directly)")

    print()


def fetch_arxiv(arxiv_id: str) -> dict | None:
    """Fetch metadata from arXiv Atom API."""
    url = f"http://export.arxiv.org/api/query?id_list={arxiv_id}&max_results=1"
    raw = _http_get(url, accept="application/xml", timeout=15)
    if not raw:
        return None
    text = raw.decode("utf-8", errors="ignore")

    def extract_tag(tag: str, src: str) -> str:
        m = re.search(rf"<{tag}[^>]*>(.*?)</{tag}>", src, re.DOTALL)
        return m.group(1).strip() if m else ""

    title = extract_tag("title", text)
    # skip the feed-level title (first one is "ArXiv Query...")
    titles = re.findall(r"<title[^>]*>(.*?)</title>", text, re.DOTALL)
    title = titles[-1].strip() if len(titles) > 1 else title
    title = re.sub(r"\s+", " ", title)

    abstract = extract_tag("summary", text)
    abstract = re.sub(r"\s+", " ", abstract).strip()

    authors = re.findall(r"<name>(.*?)</name>", text)

    published = extract_tag("published", text)
    year = None
    if published:
        ym = re.search(r"(20\d{2})", published)
        if ym:
            year = int(ym.group(1))

    categories = re.findall(r'term="([^"]+)"', text)

    return {
        "source": "arxiv",
        "doi": f"10.48550/arXiv.{arxiv_id}",
        "title": title,
        "authors": authors[:10],
        "year": year,
        "journal": "arXiv preprint",
        "abstract": abstract,
        "subjects": categories,
        "url": f"https://arxiv.org/abs/{arxiv_id}",
    }


def fetch_zenodo(zenodo_id: str) -> dict | None:
    """Fetch metadata from Zenodo REST API."""
    url = f"https://zenodo.org/api/records/{zenodo_id}"
    raw = _http_get(url, accept="application/json", timeout=15)
    if not raw:
        return None
    try:
        data = json.loads(raw)
    except Exception:
        return None

    meta = data.get("metadata", {})
    title = meta.get("title", "Unknown")
    authors = [c.get("name", "") for c in meta.get("creators", [])]
    year = None
    pub_date = meta.get("publication_date", "")
    if pub_date:
        ym = re.search(r"(20\d{2})", pub_date)
        if ym:
            year = int(ym.group(1))
    abstract = re.sub(r"<[^>]+>", "", meta.get("description", ""))
    subjects = [kw for kw in meta.get("keywords", [])]

    return {
        "source": "zenodo",
        "doi": data.get("doi", ""),
        "title": title,
        "authors": authors,
        "year": year,
        "journal": "Zenodo",
        "abstract": abstract,
        "subjects": subjects,
        "url": f"https://zenodo.org/records/{zenodo_id}",
    }


def fetch_and_evaluate(entry: str, index: int) -> dict:
    entry = normalize_entry(entry)

    if is_url(entry):
        print(f"  [{index}] Fetching URL: {entry[:80]}...")
        meta = fetch_metadata_from_url(entry)

        if meta.get("doi") and not meta.get("abstract"):
            print(f"    Found DOI {meta['doi']} — enriching from CrossRef...")
            crossref = fetch_crossref(meta["doi"])
            if crossref:
                openalex = fetch_openalex(meta["doi"])
                doi_meta = extract_metadata_from_doi(crossref, openalex, meta["doi"])
                doi_meta["source"] = "url+doi"
                doi_meta["url"] = entry
                meta = doi_meta

        eval_result = score_relevance(meta)
        print_paper(meta, eval_result, index)
        return {**meta, "evaluation": eval_result, "original_entry": entry}

    elif is_doi(entry):
        # arXiv DOIs
        arxiv_match = re.match(r"10\.48550/arXiv\.(.+)", entry)
        if arxiv_match:
            arxiv_id = arxiv_match.group(1)
            print(f"  [{index}] Fetching arXiv: {arxiv_id}...")
            meta = fetch_arxiv(arxiv_id)
            if meta:
                eval_result = score_relevance(meta)
                print_paper(meta, eval_result, index)
                return {**meta, "evaluation": eval_result, "original_entry": entry}
            else:
                print(f"    SKIP — could not fetch from arXiv API")
                return {"original_entry": entry, "error": "arxiv_failed"}

        # Zenodo DOIs
        zenodo_match = re.match(r"10\.5281/zenodo\.(\d+)", entry)
        if zenodo_match:
            zenodo_id = zenodo_match.group(1)
            print(f"  [{index}] Fetching Zenodo: {zenodo_id}...")
            meta = fetch_zenodo(zenodo_id)
            if meta:
                eval_result = score_relevance(meta)
                print_paper(meta, eval_result, index)
                return {**meta, "evaluation": eval_result, "original_entry": entry}
            else:
                print(f"    SKIP — could not fetch from Zenodo API")
                return {"original_entry": entry, "error": "zenodo_failed"}

        # Standard DOIs via CrossRef
        print(f"  [{index}] Fetching DOI: {entry}...")
        crossref = fetch_crossref(entry)
        if not crossref:
            # Fallback: try OpenAlex directly
            print(f"    CrossRef failed, trying OpenAlex...")
            openalex = fetch_openalex(entry)
            if openalex and openalex.get("title"):
                meta = {
                    "source": "openalex",
                    "doi": entry,
                    "title": openalex.get("title", "Unknown"),
                    "authors": [a.get("author", {}).get("display_name", "")
                                for a in openalex.get("authorships", [])[:10]],
                    "year": openalex.get("publication_year"),
                    "journal": (openalex.get("primary_location", {}) or {}).get("source", {}).get("display_name", "") if openalex.get("primary_location") else "",
                    "abstract": "",
                    "subjects": [c.get("display_name", "") for c in openalex.get("concepts", [])[:5]],
                    "url": f"https://doi.org/{entry}",
                }
                if openalex.get("abstract_inverted_index"):
                    idx = openalex["abstract_inverted_index"]
                    max_pos = max(max(p) for p in idx.values())
                    words = [""] * (max_pos + 1)
                    for word, positions in idx.items():
                        for pos in positions:
                            words[pos] = word
                    meta["abstract"] = " ".join(w for w in words if w)

                eval_result = score_relevance(meta)
                print_paper(meta, eval_result, index)
                return {**meta, "evaluation": eval_result, "original_entry": entry}

            print(f"    SKIP — could not fetch metadata from any source")
            return {"original_entry": entry, "error": "all_sources_failed"}

        time.sleep(0.3)
        openalex = fetch_openalex(entry)
        meta = extract_metadata_from_doi(crossref, openalex, entry)
        eval_result = score_relevance(meta)
        print_paper(meta, eval_result, index)
        return {**meta, "evaluation": eval_result, "original_entry": entry}

    else:
        print(f"  [{index}] SKIP — unrecognized format: {entry[:60]}")
        return {"original_entry": entry, "error": "unrecognized_format"}


def main():
    doi_file = SCRIPT_DIR / "dois.txt"
    single_entry = None
    out_file = SCRIPT_DIR / "evaluated_papers.json"
    progress_enabled = True

    args = sys.argv[1:]
    i = 0
    while i < len(args):
        if args[i] == "--file" and i + 1 < len(args):
            doi_file = Path(args[i + 1])
            i += 2
        elif args[i] == "--doi" and i + 1 < len(args):
            single_entry = args[i + 1]
            i += 2
        elif args[i] == "--out" and i + 1 < len(args):
            out_file = Path(args[i + 1])
            i += 2
        elif args[i] == "--quiet":
            progress_enabled = False
            i += 1
        else:
            i += 1

    log_progress(0, "evaluate_papers.start", f"out={out_file}", enabled=progress_enabled)
    if single_entry:
        entries = [single_entry.strip()]
    else:
        if not doi_file.exists():
            log_progress(100, "evaluate_papers.error", f"missing_file={doi_file}", enabled=progress_enabled)
            print(f"File not found: {doi_file}")
            sys.exit(1)
        text = doi_file.read_text()
        entries = [
            line.strip()
            for line in text.splitlines()
            if line.strip() and not line.strip().startswith("#")
        ]

    if not entries:
        log_progress(100, "evaluate_papers.error", "no_entries", enabled=progress_enabled)
        print("No entries found.")
        sys.exit(1)

    doi_count = sum(1 for e in entries if is_doi(normalize_entry(e)))
    url_count = sum(1 for e in entries if is_url(normalize_entry(e)))

    print(f"\nPhase I Research Aim:")
    print(f"  Adaptive Study Planning with Bayesian Calibration and")
    print(f"  Closed-Loop Schedule Optimization for Self-Directed Learners")
    print(f"\nEvaluating {len(entries)} entries ({doi_count} DOIs, {url_count} URLs)...\n")
    log_progress(5, "evaluate_papers.entries_loaded", f"entries={len(entries)} dois={doi_count} urls={url_count}", enabled=progress_enabled)

    results = []
    for i, entry in enumerate(entries, 1):
        start_percent = 5 + ((i - 1) / len(entries)) * 85
        log_progress(start_percent, "evaluate_papers.entry.start", f"index={i}/{len(entries)}", enabled=progress_enabled)
        result = fetch_and_evaluate(entry, i)
        results.append(result)
        end_percent = 5 + (i / len(entries)) * 85
        status = "failed" if "error" in result else "evaluated"
        log_progress(end_percent, "evaluate_papers.entry.complete", f"index={i}/{len(entries)} status={status}", enabled=progress_enabled)
        time.sleep(0.4)

    valid = [r for r in results if "evaluation" in r]
    failed = [r for r in results if "error" in r]

    if valid:
        print(f"\n{'='*80}")
        print(f"  SUMMARY — {len(valid)} papers evaluated, {len(failed)} failed")
        print(f"{'='*80}")

        by_fitness = {}
        for r in valid:
            f = r["evaluation"]["fitness"]
            by_fitness.setdefault(f, []).append(r)

        for fitness in ["STRONG FIT", "GOOD FIT", "PARTIAL FIT", "WEAK FIT"]:
            papers = by_fitness.get(fitness, [])
            if papers:
                print(f"\n  {fitness} ({len(papers)}):")
                for p in papers:
                    clusters = ", ".join(p["evaluation"]["cluster_labels"]) or "none"
                    year = p.get("year", "?")
                    print(f"    - [{year}] {p['title'][:70]}")
                    print(f"      Clusters: {clusters}")

        print(f"\n  CLUSTER COVERAGE:")
        for cid, cluster in CLUSTERS.items():
            count = sum(
                1 for r in valid
                if cid in r.get("evaluation", {}).get("matched_clusters", {})
            )
            status = "COVERED" if count >= 2 else "NEEDS MORE" if count == 1 else "MISSING"
            print(f"    {cluster['label']}: {count} papers [{status}]")

        total_recent = sum(1 for r in valid if r.get("year", 0) and r["year"] >= 2024)
        print(f"\n  Papers since 2024: {total_recent}/{len(valid)}")
        print(f"  Target: 15+ papers total, majority since 2024")

    if failed:
        print(f"\n  FAILED ({len(failed)}):")
        for f in failed:
            print(f"    - {f.get('original_entry', '?')[:80]} — {f.get('error')}")

    log_progress(95, "evaluate_papers.write_results", f"out={out_file}", enabled=progress_enabled)
    with open(out_file, "w") as f:
        json.dump(results, f, indent=2, default=str)
    print(f"\n  Full results saved to: {out_file}")
    log_progress(100, "evaluate_papers.complete", f"valid={len(valid)} failed={len(failed)}", enabled=progress_enabled)


if __name__ == "__main__":
    main()
