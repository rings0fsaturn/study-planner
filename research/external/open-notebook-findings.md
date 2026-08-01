# Open Notebook — Phase 2 Reuse Findings

> Research captured 2026-07-31 for study-planner-web Phase 2 (Assessments + LLM-guided Practice).
> Source repo: `research/external/open-notebook` (MIT). Investigated read-only.

## Executive summary

- **Open Notebook is a self-hosted NotebookLM clone**: FastAPI (Python 3.11+) + Next.js 15/React 19 + **SurrealDB** (graph + native vector search), with a separate **surreal-commands** background worker for all heavy async work. License is **MIT** (`LICENSE`, "Copyright (c) 2024 Luis Novo") — permissive, reuse/port/relicense is fine with attribution.
- **The single biggest asset for us is the "transformations" engine** (`open_notebook/graphs/transformation.py` + `prompts/transformation/execute.jinja`): a user-defined free-text prompt run over a source's `full_text` to produce a structured "insight." This is almost exactly the mechanism we'd want for **generating quizzes / written / coding assessments** from study material — but it emits free-text, not typed JSON, so we'd add structured output.
- **RAG/context-building is real and reusable in pattern**: sources are chunked (token-based LangChain splitters), embedded (mean-pooled), stored in SurrealDB, and retrieved via `vector_search()` + a multi-stage "ask" graph (`graphs/ask.py`). This is the grounding mechanism for making generated questions actually tied to material content.
- **Chat exists in two forms (notebook chat, single-source chat) but is NOT agentic and NOT streaming in the chat endpoint.** `/chat/execute` returns a full response; only `/search/ask` streams via SSE. There is effectively **no tool-calling** (the only tool is an unused `get_current_timestamp`; `bind_tools` is commented out). So it is a weak base for a "live guide that monitors a session and helps when stuck" — you get the prompt/context patterns, not a ready-made monitoring agent.
- **Stack mismatch is significant**: it is built on **SurrealDB** (not Postgres/Supabase), **langgraph + esperanto + content-core + surreal-commands + ai-prompter**, is **single-user / password-auth** (no per-user data model, no JWT), and uses **Next.js**, not our Vite/React SPA. Running it as-is means adopting SurrealDB + a worker + its auth model.
- **Recommended path: Option 2 (port specific modules) + Option 3 (borrow prompts/patterns).** Port the transformation-execution pattern, the chunk→embed→vector-search RAG pipeline, and the context-builder into our FastAPI Intelligence Service backed by Supabase/pgvector. Do **not** adopt SurrealDB or run open-notebook as a service (Option 1) — its single-user auth and SurrealDB dependency clash with our Supabase-per-user, JWT stack.
- **Neither Assessments' typed output nor the Practice live-guide exist off-the-shelf.** Both need to be built; open-notebook shortens the "ground LLM output in stored material" half of the work, not the "typed quiz/coding grader" or "live monitoring guide" half.

## A. Material / content storage

**Model.** Three-layer container model (`docs/2-CORE-CONCEPTS/notebooks-sources-notes.md`): **Notebook** (project container) → **Source** (immutable raw material) → **Note** (mutable output). Plus **SourceInsight** (transformation output) and **SourceEmbedding** (vector chunk).

**DB: SurrealDB** (multi-model graph DB with native vectors), config in `docker-compose.yml` (`surrealdb/surrealdb:v2`, `rocksdb`), rationale in `docs/7-DEVELOPMENT/decisions/ADR-001-surrealdb.md`. Schema/shape (`docs/7-DEVELOPMENT/architecture.md` lines 161-173, code in `open_notebook/domain/notebook.py`):
- `source` (`notebook.py:402`): `title`, `full_text`, `topics: List[str]`, `asset` (url/file_path), `command` (link to processing job). **Key point for us: a source stores the full extracted text** — unlike our current "material = title string only."
- `source_embedding` (`notebook.py:323`): `content` (chunk text) + embedding vector.
- `source_insight` (`notebook.py:342`): `insight_type`, `content` — the reusable "AI output tied to a source" record.
- `note` (`notebook.py:683`), `chat_session` (`notebook.py:750`, messages persisted via LangGraph SqliteSaver, not in the row), `transformation` (`domain/transformation.py`).
- Relationships are graph edges: `reference` (notebook→source), `artifact` (notebook→note), `refers_to` (session→notebook).

**Ingestion & processing.** Upload/URL/text all funnel through the **content-core** library. Pipeline is a LangGraph graph (`open_notebook/graphs/source.py`): `content_process` (calls `extract_content(url=/file_path=/content=)`, supports PDF/HTML/audio/video/YouTube, engines docling/crawl4ai/firecrawl/jina) → `save_source` (stores `full_text`, optional `vectorize()`) → conditional `transform_content`. Runs as a fire-and-forget background job `process_source` (`commands/source_commands.py`).

**Chunking/embeddings** (`docs/7-DEVELOPMENT/content-processing.md`): token-based LangChain splitters (`HTMLHeaderTextSplitter`/`MarkdownHeaderTextSplitter`/`RecursiveCharacterTextSplitter`), default 400-token chunks / 15% overlap (`utils/chunking.py`); embeddings via `utils/embedding.py` (`generate_embedding` mean-pools long text, `generate_embeddings` batches of 50); embedding is **only** triggered by the surreal-commands worker — nothing embeds if the worker isn't running. Embedding model resolved via `model_manager`/esperanto (multi-provider).

## B. Reusable capabilities for Assessments

**Transformations** (`docs/3-USER-GUIDE/transformations.md`, `docs/2-CORE-CONCEPTS/chat-vs-transformations.md`). A `Transformation` (`domain/transformation.py`) is essentially `{name, title, description, prompt, apply_default, model_id}` — the `prompt` is **user-authored free text**. Execution (`graphs/transformation.py`): the user prompt is injected as `{{ instructions }}` into the fixed `prompts/transformation/execute.jinja` system prompt, the source `full_text` is the human message, the LLM runs (via `provision_langchain_model(..., "transformation", max_tokens=8192)`), output is cleaned and saved as a `SourceInsight`. Built-in examples include **"Questions" (generates questions the source raises)** and Q&A — directly on-point for quiz generation.

**Fit for our Assessments:** strong pattern match. A "Generate 10 MCQs / short-answer / coding exercises about {topic}" is just a transformation prompt run over stored material text. **Caveats:** (1) output is **free text, not typed JSON** — for gradeable quizzes we'd add a `PydanticOutputParser` (the `ask` graph shows the pattern: `graphs/ask.py:53`, and `prompts.md` describes the `{{ format_instructions }}` slot). (2) **Security note worth copying**: they deliberately never compile the user prompt as a Jinja template — it's passed as a render variable (`transformation.py:35-37`, GHSA-f35w-wx37-26q7). (3) Coding exercises have no execution/grading sandbox here — that's net-new for us.

**RAG for grounding questions.** Yes, reusable: `vector_search()` (`notebook.py:809`) embeds the query and calls a SurrealDB `fn::vector_search` function; `text_search()` (`notebook.py:767`) is BM25. The `ask` graph (`graphs/ask.py`) is a nice multi-stage template: LLM plans up to 5 searches (JSON `Strategy`) → fan-out `provide_answer` per search (vector_search top-10) → `write_final_answer` synthesizes with `[source:id]` citations (`prompts/ask/{entry,query_process,final_answer}.jinja`). We'd reimplement the SurrealDB `fn::vector_search` on pgvector, but the orchestration/prompt pattern ports cleanly.

## C. Reusable capabilities for the Practice live-guide

**Chat mechanics.** Two graphs: notebook chat (`graphs/chat.py`) and single-source chat (`graphs/source_chat.py`). Both are single-node graphs: build a system prompt (`prompts/chat/system.jinja`, `prompts/source_chat/system.jinja`) + injected context, call the model, strip `<think>`, persist to a LangGraph **SqliteSaver** checkpoint keyed by session/thread. Context assembly is `utils/context_builder.py` (`build_notebook_context` for the notebook chat; `build_source_context` for single-source, budgeted to ~50k tokens, source text truncated to 5k chars in `source_chat.py:211`).

**Streaming/tools — the gap.** `/chat/execute` (`api/routers/chat.py:304`) is **request/response, not streaming** (only `/search/ask` streams SSE). There is **no meaningful tool-calling / agent loop**: `graphs/tools.py` has a single unused `get_current_timestamp`, and `bind_tools` is commented out in `graphs/ask.py`. So open-notebook gives you a solid **grounded-chat + context-assembly + citation** foundation, but **not** a "monitors the session and intervenes when stuck" agent — that monitoring loop, streaming, and any code-execution/writing-diff tools are net-new. The `source_chat` "specialized assistant focused on one document" prompt is the closest reusable template for a per-practice-item guide.

**MCP.** There's an **MCP server** (`docs/5-CONFIGURATION/mcp-integration.md`), but it's a separate repo (`Epochal-dev/open-notebook-mcp`) that just exposes the REST API (notebooks/sources/notes/chat/search) to MCP clients like Claude Desktop — it is not an in-app agent framework and isn't directly useful for our live guide.

## D. Architecture & integration path

**Architecture** (`docs/7-DEVELOPMENT/architecture.md`): three tiers — Next.js (3000/8502) → **FastAPI** (5055) → SurrealDB (8000), plus a required **surreal-commands worker** for embeddings/source-processing/podcasts. API is routes→services→models (`api/routers/*`, `*_service.py`, `models.py`); AI via **esperanto** (17 providers) through `provision_langchain_model()`; workflows via **LangGraph**; prompts via **ai-prompter** Jinja templates.

**Main endpoints** (`docs/7-DEVELOPMENT/api-reference.md` + routers): `/notebooks`, `/sources` (+`/sources/{id}/insights`, `/retry`, `/status`, `/download`), `/notes`, `/chat/sessions` + `/chat/execute` + `/chat/context`, `/sources/{id}/chat/...` (source_chat), `/transformations` + `/transformations/execute`, `/search` + `/search/ask` (SSE) + `/search/ask/simple`, `/insights/{id}` (+`/save-as-note`), `/models`, `/credentials`, `/commands/{id}`, `/health`.

**External dependencies to run it:** SurrealDB v2; the surreal-commands worker; at least one LLM + embedding provider (via esperanto; Ollama for fully local); `content-core` (+ optional heavy runtimes docling/crawl4ai); `OPEN_NOTEBOOK_ENCRYPTION_KEY` for credential storage. Python deps of note (`pyproject.toml`): `langgraph`, `langchain-*`, `esperanto`, `content-core`, `surrealdb`, `surreal-commands`, `ai-prompter`, `podcast-creator`.

**Integration options for our stack (Astro + Vite/React SPA + FastAPI Intelligence Service + Supabase + Dexie):**

1. **Run open-notebook as a separate service we call.** Pros: fastest to a working demo; get transformations/RAG/ingestion "for free." Cons: it's **single-user, password-auth** (`PDR-001-single-user-first`, no per-user isolation, no Supabase JWT) — a hard mismatch with our multi-tenant Supabase model; adds **SurrealDB + a worker** to ops; data lives in SurrealDB, disconnected from our Supabase DB and Dexie event store; you'd fight its auth and data model constantly. **Not recommended.**

2. **Port specific modules into our FastAPI Intelligence Service.** Pros: keeps everything in our stack/DB; we own auth (Supabase JWT already present), per-user rows, pgvector instead of SurrealDB. The transformation-execution pattern (`graphs/transformation.py` + `execute.jinja`), the chunk→embed pipeline (`utils/chunking.py`, `utils/embedding.py`), the ask/RAG orchestration (`graphs/ask.py`), and the context-builder are all self-contained enough to port. We already use Claude, so esperanto's multi-provider layer is optional (can call Claude directly). Cons: real effort — must replace SurrealDB queries (`vector_search` `fn::vector_search`, `repo_query`) with pgvector/Supabase; must stand up a background job mechanism (we have none equivalent to surreal-commands — could use FastAPI background tasks / a queue); need to store material `full_text` (today it's just a title). **Recommended, combined with 3.**

3. **Borrow patterns/prompts only.** Pros: lowest risk/effort; the Jinja prompts (transformation, ask multi-stage, source_chat, citation-repetition pattern per `docs/7-DEVELOPMENT/prompts.md`) and the RAG design are the genuinely valuable, portable IP. Cons: we reimplement all plumbing. **Recommended as the baseline; escalate to 2 for the RAG/transformation engine specifically.**

**Licensing:** **MIT** (`LICENSE`). No copyleft; we may copy, modify, port, and relicense within our product, provided we retain the MIT notice for substantial copied portions. No blocker.

## Open questions for our Phase 2 design

1. **Where does material content come from?** Today a material is only a title. Assessments/RAG need stored `full_text` or a syllabus. Do we add ingestion (open-notebook's content-core style: upload/URL/paste) or generate purely from the title + LLM knowledge (no grounding)?
2. **Vector store & jobs:** Adopt **pgvector on Supabase** (fits our stack) vs. a dedicated vector DB — and what runs embeddings/generation async, given we have no surreal-commands equivalent (FastAPI background tasks, Celery/RQ, or Supabase Edge/queues)?
3. **Typed assessment output & grading:** We need structured quiz JSON (question/choices/answer/rubric) and, for coding exercises, an **execution/grading sandbox** — neither exists in open-notebook. Build with Pydantic-parsed Claude output + a sandbox runner?
4. **Live-guide architecture:** open-notebook's chat is non-streaming and non-agentic. What does "monitors the session and helps when stuck" mean concretely — streaming SSE, periodic snapshots of the user's work sent to Claude, tool-calling to inspect code/tests? This is the largest net-new build.
5. **Local-first fit:** How do generated assessments/practice sessions reconcile with our Dexie/IndexedDB event store and Supabase sync — are AI outputs events, server rows, or both?
