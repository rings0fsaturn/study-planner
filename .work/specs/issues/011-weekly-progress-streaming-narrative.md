---
title: Weekly progress with streaming LLM narrative
type: AFK
blocked_by: [9]
covers_user_stories: [33, 34, 35]
---

## Parent

PRD: `PRD-study-tracker-web.md`

## What to build

`/study/week` shows the user how the past week went. A verdict line ("ahead", "on track", "slipping") and a streaming LLM-generated narrative anchor the page; charts (sessions logged, hours by day, materials touched) sit alongside.

A new `LLMProxy` Edge Function fronts the OpenAI API with Server-Sent Events so the narrative streams in token-by-token rather than appearing as a wall of text. A `WeeklyNarrativeService` consumes the SSE stream, caches completed narratives keyed by week, and cancels in-flight requests when the user navigates away. Stale or cached narratives serve the offline case gracefully.

Desktop layout is magazine-style: verdict + narrative left, charts right. Mobile stacks verdict → narrative → charts.

## Acceptance criteria

- [ ] An `LLMProxy` Supabase Edge Function fronts OpenAI with SSE streaming and never exposes the API key to the client
- [ ] `/study/week` shows a verdict line: "ahead", "on track", or "slipping" based on ProgressEngine state
- [ ] `/study/week` shows a streaming narrative that fills in token-by-token via SSE
- [ ] `/study/week` shows charts: sessions logged this week, hours by day, materials touched
- [ ] WeeklyNarrativeService caches completed narratives keyed by ISO week
- [ ] Navigating away from `/study/week` cancels the in-flight LLM request
- [ ] Returning to `/study/week` for a week with a cached narrative shows it without re-fetching
- [ ] Offline / LLM failure: cached narrative serves if available; otherwise a graceful "narrative unavailable, here are the numbers" fallback
- [ ] Desktop layout is magazine-style (verdict + narrative left, charts right); mobile is stacked
- [ ] Tests cover: SSE stream consumption, cache hit/miss, navigation-cancellation, offline degradation
- [ ] Edge Function has tests for: SSE relay, error mapping, key isolation
- [ ] An end-to-end test covers: visit `/study/week` → see streaming narrative → navigate away mid-stream → return → see cached result

## Blocked by

- Blocked by #9
