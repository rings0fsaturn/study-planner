# Roadmap material attachment (+ library link) — Implementation Plan

**Date written:** 2026-09-12 · **Ticket:** [#63](https://github.com/rings0fsaturn/study-planner/issues/63) (filed and claimed 2026-09-12) · **Parent:** spec #32 · wayfinder map #4
**Branch:** `phase2/issue-63-roadmap-material-attach` · **Worktree:** `/mnt/d/study/git/study-planner-web-issue-63` (cut off `2091d8e`, the post-#62 tip)
**Plan status:** 🟡 P0–P2 done and live-verified at 1280 (P1's 375 attach and OQ-07's mobile check deferred). OQ-01…OQ-05 were answered by the user on 2026-09-12 and are folded into D-03, D-06, D-09, D-10 and the phase list below.
**Trigger:** user report (2026-09-12) — "within roadmap page, I don't see an option to add materials that are present within the materials [library]; also I don't see the materials of a roadmap listed under materials tab", followed by the concrete ask: a "+" in the roadmap's Materials panel that opens a material picker, and an Attach + in New session that lists this roadmap's materials.

> Runbook convention inherited from the #38/#39/#40/#41/#62 plans: implement one phase per session, statuses updated in the same commit as the work, STOP on any reality-mismatch.
>
> **Vitest invocation (corrected 2026-09-12, P1):** the app `test` script is already `vitest run`, so `pnpm --filter app test -- --run <path>` appends a literal `--` and vitest reads the path as a *name* filter, matching nothing. Use `pnpm --filter app test <path>` (or `pnpm --filter app exec vitest run <path>`); add `--pool=forks` for the TZ-sensitive `dev/seedTestData.test.ts` pair.

## TL;DR

Two material worlds exist and nothing joins them. The roadmap draws its materials from **event-log pointers** (`MaterialAdded` + `roadmap.payload.materialIds`, plus per-material `estimatedDuration`); the Phase 2 **library** lives in Supabase (`materials`, migration 004) and is reachable only from `/materials`. So the roadmap cannot offer a library material, and the library cannot say which roadmaps a material feeds.

The decided model already covers this (map #4, issue #7: "add materials in a store, **attach to roadmaps**"; issue #19: linked usage groups for Roadmaps/Assessments/Practice; #33 Q22: contentless materials stay attachable for roadmap planning). What was never built is the roadmap half: #36 delivered the library, its picker and the Practice-this seam, and left the roadmap linkage out.

This plan builds that half: one new event kind (`MaterialAttached` — the thin pointer #7 specified), one shared reader that replaces three duplicated id→payload implementations, the "+" on the roadmap's Materials panel, a per-material **minutes budget and role** set at attach time, a **remove** path back out of the set, and the reverse index on material detail.

## Acceptance criteria → where they are met

| AC | Meaning | Met by |
|---|---|---|
| AC1 | The roadmap's Materials panel has a "+" that opens a picker of library materials not already on this roadmap; attaching affects this roadmap only | P1 (D-01, D-02, D-05) |
| AC2 | Every attached material carries its own minutes budget **and role**, both set at attach time, and the directory shows consumed/total | P1 (defaults) + P2 (editable) |
| AC3 | Attached materials appear in the add-session and booking-edit pickers and in session setup | P1 (ledger) + P4 (empty-state CTA) |
| AC4 | Attached materials survive Replan and count in roadmap progress; no duplicate readers remain | P1 (D-04) |
| AC5 | Material detail lists the roadmaps a library material is attached to, and the delete warning names them | P5 |
| AC6 | A material can be removed from a roadmap's set, with the affected upcoming sessions disclosed, and existing bookings keep their material label | P3 (D-09) |
| AC7 | No server, schema or Dexie change; old roadmaps replay byte-identically | P1 (D-01) |

## Context — live-tree facts (read 2026-09-12; trust these over older notes)

### The two worlds, precisely

- Roadmap materials come from `mapMaterialsForRoadmap(events, entry)` (`apps/app/src/progress/mapEvents.ts:241`): ids = `roadmap.payload.materialIds ?? slot candidateMaterialIds` (minus `__rest__`), each resolved against **`MaterialAdded`** events. `MaterialAddedPayload` carries `{materialId,title,estimatedDuration,url?,kind,role,playlistId?,youtubeVideoId?,videos?}` (`apps/app/src/sync/types.ts:57`); `role` is `MaterialRole = 'anchor' | 'foundation' | 'practice'` (`packages/roadmap-engine/src/roadmap-engine.ts:30`, labels in `constants.ts:49` `ROLE_TO_LABEL`).
- The same id-set → payload join is **implemented three times**: `progress/mapEvents.ts:245`, `roadmap/roadmapProgress.ts:50` (`materialIds ?? []`, no slot fallback), `roadmap/replan/mapToRegenerateRequest.ts:80` (slot fallback, drives Replan). Any new source of roadmap materials has to be added in all three, or two of them silently drop it. No other reader touches `payload.materialIds` (grepped: `pages/Replan.tsx:287` and `commitReplan.ts:82` only consume the list handed to them).
- Hours per material: `MaterialAddedPayload.estimatedDuration` (global) capped by `roadmap.payload.materialDurationOverrides[materialId]` via `effectiveEstimatedDuration` (`progress/mapEvents.ts:155`; mirrored at `roadmapProgress.ts:88`).
- `Event {id?, kind, payload, createdAt}` with an autoincrement id (`events/EventStore.ts:13`) — `getAll()` returns insertion order, so "last event wins" must be read from **array order**, not `createdAt` comparison.
- Calendar bubble labels come from a per-roadmap map that falls back to the literal `'Session · pick at start'` when a booking's `materialId` is missing (`roadmap/calendarModel.ts:148-166`). The header count `{materialsById.size} materials` (`RoadmapCalendar.tsx:428`) is the active-set size. **Detach must not empty either of these** for a material that still has bookings.
- `.dir-head` is already `display:flex` (`.ttl { flex:1 }`, `roadmap.css:704-731`) but the whole header is **one `<button>`** (collapse toggle) — a nested "+" is invalid HTML.
- The sheet pattern to copy for any confirm surface: `booking/MaterialProgressSheet.tsx` (bk-overlay/bk-sheet, eyebrow + title + actions).
- Consumers that already read the ledger and therefore need **no change**: the two booking sheets (`booking/AddSessionSheet.tsx:126`, `booking/BookingEditorSheet.tsx`), session setup and up-next planning (`session/sessionPlanning.ts:244`).
- The library: `MaterialClient.listMaterials()` (archived excluded by default, `materialClient.ts:217`), `MaterialRecord.kind: 'manual'|'url'|'youtube'|'file'`, `estimatedMinutes: number|null` (`materials/types.ts`). `MaterialPicker` already exists with `purpose: 'generation' | 'planning'` (`materials/MaterialPicker.tsx:11`) — the **planning** branch ("Attach to roadmap", contentless/non-ready selectable, empty state linking to `/materials/new`) is implemented and has **no call site**; `MaterialLibrary.tsx` only ever opens `purpose="generation"`.
- `MaterialDetail.tsx:191` hardcodes `const usage: string[] = []`, so the usage block at `:434` always prints "Not attached to any roadmap yet" and the delete warning (`:472`) can never name a roadmap.

### What makes the lazy path safe

- `logEvent(kind: string, payload)` (`sync/SyncEngine.ts:96`) takes a free-form kind; `public.events.kind` is plain `TEXT` (`supabase/migrations/003_events_table.sql:10`) with no CHECK. A new kind is a row: no migration, no Dexie version bump, no server deploy.
- The durable-events schema under `services/intelligence/contracts/phase2/` covers Phase 2 assessment events only — roadmap/material-log kinds are not in it (grep: no `MaterialAdded`/`MaterialProgressMarked`), so nothing contract-side needs amending.
- `MaterialAttached`/`MaterialDetached` can be shaped as `MaterialAddedPayload & { roadmapCreatedAt }` / `{ roadmapCreatedAt, materialId }`, so readers keep returning `MaterialAddedPayload` and every existing consumer compiles untouched.

### UX shape (add / pick / remove are one story)

- The roadmap's **Materials directory** (`RoadmapCalendar.tsx:554-604`, the "Materials · N · X% done" panel) is the roadmap's material set. The "+" there **adds to the set**, setting that material's minutes budget and role for this roadmap.
- New session / booking edit **attach a session to one material from the set** (session length ≠ material budget; the budget is consumed through the ledger's `consumed/remaining`).
- Row-level **Remove** takes a material out of the set; it never cascades into history.
- All three read the same source, so an attached material is immediately selectable and a removed one immediately disappears, with no third concept introduced.

## Decisions log

### D-01: Attachment rides a new `MaterialAttached` event (thin pointer), no server change
**Status:** 🤔 Assumed (unconfirmed) — the *existence* of a roadmap attach pointer is decided (#7, map #4); this payload shape is the proposal.

**Decision:** `MaterialAttachedPayload extends MaterialAddedPayload { roadmapCreatedAt: string }`, logged once per attached material. `materialId` is the library row's uuid (the decided DB-minted id), so the same pointer can later feed assessments/practice.

**Rationale:** matches #7 verbatim ("only a thin roadmap-attach pointer `{materialId,title,role,estimatedDuration}` rides the log (roadmap-engine untouched)"). No migration, no Dexie change, backward compatible, and readers that consume `MaterialAddedPayload` need no signature change.

**Alternatives considered:**
- Re-log `MaterialAdded` + a roadmap association → rejected: `MaterialAdded` has no roadmap scope, so the association still needs a second event; two events where one does.
- Emit `RoadmapReplanned` with a widened `materialIds` → rejected: it replaces the roadmap payload and its committed booking set, and would rewrite the user's bookings to add one material.
- A Supabase `roadmap_materials` table → rejected: breaks the decided "thin pointer on the log" and the local-first read path.

**Reversibility:** easy — the event is additive; dropping the feature ignores the kind.

### D-02: The "+" opens the existing `MaterialPicker` (`purpose="planning"`), not a new sheet
**Status:** 🤔 Assumed (unconfirmed)

**Decision:** reuse `materials/MaterialPicker.tsx`; add `excludeIds?: string[]` (hide what is already on this roadmap) and change `onContinue` to hand back the selection records plus per-material minutes and roles. #33's locked picker surface (side panel desktop / bottom sheet mobile, persistent footer) then applies for free.

**Rationale:** the planning variant is already written, already allows contentless/non-ready materials (Q22), already has the empty-state "Add a material" link, and is the only picker with roadmap copy. Building a fourth picker would be the fourth material list.

**Alternatives considered:** a new `RoadmapMaterialSheet` → rejected (duplicate list + duplicate empty states); a native `<select multiple>` → rejected (loses status sublines and mobile surface).

**Reversibility:** easy.

### D-03: The per-material budget is `estimatedDuration` on the attach event (default 60)
**Status:** ✅ Agreed (user, 2026-09-12: "default is ok")

**Decision:** the attach flow sets minutes per material (default 60, or the library row's `estimatedMinutes` when it has one; min 15, step 15) and writes it as the event's `estimatedDuration`. The existing `materialDurationOverrides` cap mechanism is left alone and still applies.

**Rationale:** the ledger already divides `estimatedDuration` into consumed/remaining and the directory already renders "0m of 1h 23m"; no new field, no new maths, replan's remaining-minutes logic keeps working.

**Reversibility:** easy (the value is in the event payload; a later override map can supersede it).

### D-04: One exported reader replaces the three duplicated id→payload joins
**Status:** 🤔 Assumed (unconfirmed)

**Decision:** export `roadmapMaterialPayloads(events, payload, roadmapCreatedAt): MaterialAddedPayload[]` from `progress/mapEvents.ts`; `mapMaterialsForRoadmap`, `roadmapProgress.materialLedgerForEntry` and `mapToRegenerateRequest.materialPayloads` all call it. It resolves the roadmap's declared ids (`payload.materialIds ?? slot candidates`) unioned with the ids whose latest attach/detach event (D-09) for this roadmap is an attach, honoring event order, and resolves each id against the last `MaterialAdded`/`MaterialAttached` row.

**Rationale:** the reported symptom ("no way to add a material") and the sibling defects (replan dropping attached materials; progress not counting them) have the same root: three copies of one join. Fixing it once is a smaller diff than three guards.

**Reversibility:** easy.

### D-05: The "+" sits in the Materials directory header; the header is restructured to avoid a nested button
**Status:** 🤔 Assumed (unconfirmed)

**Decision:** `dir-head` becomes a flex row: the existing collapse control becomes `.dir-head-toggle` (keeping its `aria-expanded`), and the "+" is a sibling `.dir-add` button with `aria-label="Add material to this roadmap"`, disabled in the read-only history view (matching the disabled `Mark progress` buttons). The empty state ("No materials are attached to this roadmap") gains the same affordance, so no dead end.

**Rationale:** the directory *is* the roadmap's material set, so add-to-set belongs there; a `<button>` inside the current `<button className="dir-head">` would be invalid HTML and unreachable by keyboard.

**Reversibility:** easy.

### D-06: The attach modal sets a per-material role, chosen by the user
**Status:** ✅ Agreed (user, 2026-09-12: "add a role chip let user select") — **supersedes** the earlier fixed-`role: 'foundation'` simplification.

**Decision:** every selected row in the planning picker carries a native `<select>` of the three roles, labelled from the engine's `ROLE_TO_LABEL` (`anchor | foundation | practice`), defaulting to `foundation`; the chosen role is written to the attach event's `role`, so Replan's engine input (`toEngineMaterial`) and the session-setup label (`PreSessionSetup.tsx:170`) both honor it.

**Rationale:** role drives slot ordering and interleaving in the engine (`roadmap-engine.ts:205,510`), so a user-chosen role is real signal, not decoration — and `role` was already on the event shape (D-01), so this is UI only. Native `<select>` = no new control component.

**Alternatives considered:** one batch role for the whole selection (one control, less per-row weight) → noted as the fallback if two controls per row crowds the mobile sheet; a custom segmented chip per row → rejected (more code than a native select for the same result).

**Reversibility:** easy.

### D-07: Library kind → roadmap kind, widening `MaterialKind` with `'file'`
**Status:** 🤔 Assumed (unconfirmed)

**Decision:** `toMaterialKind` maps `manual→'manual'`, `url→'article'`, `youtube→'youtube'`, `file→'file'`; `MaterialKind` (`session/types.ts:33`) gains `'file'`. `PreSessionSetup.iconFor/kindLabel` and `MaterialStrip.getIconLabel` get a `'file'` case (both currently fall through to a default `'NB'`), compiler-guided.

**Rationale:** a 572-page PDF is neither an article nor "manual notes"; the roadmap chip vocabulary already has a book slot (`booking/types.ts:36` returns `bk`/`BK` for anything non-YouTube/article). Widening a union is one line and the compiler finds every exhaustive switch.

**Fallback (decide during P1, do not agonise):** if the widening fans out beyond the three files above, map `file→'article'` instead and record why.

**Reversibility:** easy.

### D-08: Attached materials are pointers; archiving the library material does not detach it
**Status:** 🤔 Assumed (unconfirmed)

**Decision:** the roadmap keeps showing and planning an attached material after the library row is archived or replaced (matching #19: no silent detachment; archiving a referenced material warns). The picker itself never offers archived rows (`listMaterials()` default).

**Reversibility:** easy.

### D-09: Removal rides a `MaterialDetached` event; it never cascades into history
**Status:** ✅ Agreed (user, 2026-09-12: "need to implement")

**Decision:** `logEvent('MaterialDetached', { roadmapCreatedAt, materialId })`. The shared reader masks that id for that roadmap **only when the latest attach/detach event for the pair is the detach** (array order = insertion order, `EventStore.ts:13/27`), so re-attaching restores it. Declared `materialIds` (onboarding materials) are maskable too. Removal:
- does **not** clear or edit existing bookings or logged sessions — those keep their `materialId` and their calendar label, which comes from a new global title index (below), not from the active set;
- takes the material out of the directory, the session/booking pickers, Replan's material list and the progress totals;
- is confirmed through a sheet that names how many upcoming sessions still reference the material (`deriveBookingsForRoadmap` filtered by id and `date >= today`);
- is reversible in effect: because the ledger matches sessions by `materialId` globally, re-attaching the same material brings its already-logged minutes back.

**Rationale:** this is the smallest model that satisfies #19's "no silent detachment or mutation" without rewriting the roadmap payload or the user's bookings. A cascade would need booking rewrites and a "what happens to logged time" story, both of which the user can ask for later.

**Consequences to state in the UI:** the roadmap's "% done" and projected finish shift when a material leaves the denominator; the confirm copy says so.

**Reversibility:** easy (the detach row is additive; ignoring the kind restores the old behaviour).

### D-10: An empty library routes the learner to the Materials create flow
**Status:** ✅ Agreed (user, 2026-09-12: "let them add new material from materials tab if empty")

**Decision:** no inline create inside the attach modal. The picker's existing empty state ("No materials to choose from yet." + `Add a material` → `/materials/new`, `MaterialPicker.tsx:131-136`) is the path, and the roadmap's "+" reaches it in one click. Kept because the create flow is a full page with upload/ingestion states that must not be re-hosted in a sheet.

**Reversibility:** easy.

## Architecture overview

```
/materials (library, Supabase)          roadmap page (local event log)
  MaterialRecord ──┐                       Materials directory ── "+" / row "Remove"
                   │                            │
                   └── MaterialPicker ──────────┘  (purpose="planning", excludeIds,
                        (minutes + role per row)     minutes + role per row)
                              │ confirm
                              ▼
              MaterialAttached {roadmapCreatedAt, materialId, title, kind,
                                role, estimatedDuration, url?}
              MaterialDetached {roadmapCreatedAt, materialId}
                              │
                              ▼
   roadmapMaterialPayloads(events, payload, roadmapCreatedAt)   ← the one reader
   (declared ∪ attached − detached, last event wins)
                              │
        ┌─────────────────────┼──────────────────────┬────────────────────┐
        ▼                     ▼                      ▼                    ▼
  mapMaterialsForRoadmap  roadmapProgress      mapToRegenerateRequest  (P5) usage on
  → calendar, booking     → header % /         → Replan keeps the      MaterialDetail
    sheets, session plan    ledger                attached material
```

## Files touched (index)

| Path | New/Modify | Phase | Purpose |
|---|---|---|---|
| `apps/app/src/sync/types.ts` | modify | P1, P3 | `MaterialAttachedPayload`, `MaterialDetachedPayload` |
| `apps/app/src/materials/types.ts` | modify | P1 | `toMaterialKind` + unit test file |
| `apps/app/src/materials/types.test.ts` | new | P1 | kind mapping check |
| `apps/app/src/session/types.ts` | modify | P1 | `MaterialKind` gains `'file'` |
| `apps/app/src/session/PreSessionSetup.tsx`, `session/components/MaterialStrip.tsx` | modify | P1 | `'file'` chip/label |
| `apps/app/src/progress/mapEvents.ts` | modify | P1, P3 | exported `roadmapMaterialPayloads` (mask honored); `mapMaterialsForRoadmap` delegates; global `materialTitleIndex` |
| `apps/app/src/roadmap/roadmapProgress.ts` | modify | P1 | use the shared reader (drop the local duplicate) |
| `apps/app/src/roadmap/replan/mapToRegenerateRequest.ts` | modify | P1 | use the shared reader (drop the local duplicate) |
| `apps/app/src/materials/MaterialPicker.tsx` | modify | P1, P2 | `excludeIds`, selection records, minutes + role per selected row |
| `apps/app/src/roadmap/RoadmapCalendar.tsx` | modify | P1, P2, P3, P4 | "+", attach handler, row Remove, picker mount, title index |
| `apps/app/src/pages/materials/MaterialLibrary.tsx`, `pages/materials/MaterialDetail.tsx`, `pages/materials/PracticeThis.tsx` | modify | P1 | picker call sites move to selection records |
| `apps/app/src/roadmap/roadmap.css` | modify | P1, P3 | `.dir-head` row + `.dir-add`; row action spacing |
| `apps/app/src/roadmap/MaterialRemoveSheet.tsx` | new | P3 | confirm removal + affected-session count |
| `apps/app/src/roadmap/booking/MaterialPickerSheet.tsx`, `AddSessionSheet.tsx`, `BookingEditorSheet.tsx` | modify | P4 | empty-state "Add a material to this roadmap" |
| `apps/app/src/materials/useMaterialUsage.ts` | new | P5 | event-log reverse index (roadmap refs for a material) |
| `apps/app/src/pages/materials/MaterialDetail.tsx` | modify | P5 | wire `usage` (and the delete warning) |
| `e2e/roadmap-material-attach-live.spec.ts` | new | P4 | live flow on the real stack |
| `.work/active/roadmap-material-attach/**` | new | all | plan, verification, state, scratchpad |

---

## Phase 0 (prerequisite, not a phase): file and claim the ticket

**Status:** ✅ Done 2026-09-12 — #63 filed, claimed, branch cut.

1. ✅ `gh issue create` → [#63](https://github.com/rings0fsaturn/study-planner/issues/63), title "Roadmap material attachment (library material to roadmap set)", body = AC1–AC7 + links to map #4 / #7 / #19 / #33 / #36; labels `wayfinder:phase2` + `ready-for-agent`.
2. ✅ Claimed (`--add-assignee @me`); branch `phase2/issue-63-roadmap-material-attach` cut off `2091d8e` (the post-#62 tip), in a fresh worktree.
3. ✅ Issue number recorded in this header, in `state.md` and in the STATUS row.

---

## Phase 1: A library material can be attached to a roadmap and behaves like any other roadmap material

**Status:** ✅ Done 2026-09-12 (unit + live at 1280; the fresh 375 attach is deferred to after P3)
**Depends on:** none (Phase 0 is bookkeeping)
**Estimated scope:** ~10 files, ~200 lines

### Codebase state assumed at start
- `mapMaterialsForRoadmap` exists at `progress/mapEvents.ts:241` and is the single source for the calendar, booking sheets and session plan.
- `MaterialPicker` with `purpose="planning"` exists and is unused (`materials/MaterialPicker.tsx:11-20`).
- `MaterialPicker.test.tsx` has a `FakeMaterialClient` + `material()` factory already.

### Verification (run BEFORE starting)
```bash
cd /mnt/d/study/git/study-planner-web
grep -n "mapMaterialsForRoadmap\|MaterialPickerPurpose" apps/app/src/progress/mapEvents.ts apps/app/src/materials/MaterialPicker.tsx
pnpm --filter app test -- --run src/roadmap/RoadmapCalendar.test.tsx   # green
```

### Steps

1. **`apps/app/src/sync/types.ts`** — after `MaterialAddedPayload` (~line 67):
```ts
/**
 * Thin roadmap-attach pointer: an existing library material added to one
 * roadmap with its own time budget and role. Mirrors MaterialAddedPayload so
 * every reader that consumes MaterialAddedPayload keeps working; the roadmap
 * scope is this event's own roadmapCreatedAt.
 */
export interface MaterialAttachedPayload extends MaterialAddedPayload {
  roadmapCreatedAt: string
}
```

2. **`apps/app/src/progress/mapEvents.ts`** — replace the body of `mapMaterialsForRoadmap` with a call to a new exported reader (D-04):
```ts
/**
 * The materials of one roadmap: declared ids (materialIds, else slot candidates)
 * unioned with the ids whose latest attach/detach event for this roadmap is an
 * attach, each resolved to its latest payload. Single source for the calendar,
 * session planning, progress and replan.
 */
export function roadmapMaterialPayloads(
  events: Event[],
  payload: MaterialPayload,          // RoadmapCreatedPayload | RoadmapReplannedPayload
  roadmapCreatedAt: string,
): MaterialAddedPayload[] {
  const byId = new Map<string, MaterialAddedPayload>()
  const state = new Map<string, 'attached' | 'detached'>()
  for (const event of events) {          // array order = insertion order
    if (event.kind === 'MaterialAdded') {
      const entry = event.payload as unknown as MaterialAddedPayload
      byId.set(entry.materialId, entry)
      continue
    }
    if (event.kind !== 'MaterialAttached' && event.kind !== 'MaterialDetached') continue
    const entry = event.payload as unknown as MaterialAttachedPayload
    if (entry.roadmapCreatedAt !== roadmapCreatedAt) continue
    if (event.kind === 'MaterialAttached') {
      byId.set(entry.materialId, entry)
      state.set(entry.materialId, 'attached')
    } else {
      state.set(entry.materialId, 'detached')
    }
  }

  const declared = payload.materialIds ??
    [...new Set((payload.slots ?? [])
      .flatMap((slot) => slot.candidateMaterialIds)
      .filter((id) => id !== '__rest__'))]
  const declaredSet = new Set(declared)
  const attached = [...state.entries()]
    .filter(([, value]) => value === 'attached')
    .map(([materialId]) => materialId)
    .filter((materialId) => !declaredSet.has(materialId))

  return [...declared, ...attached]
    .filter((materialId) => state.get(materialId) !== 'detached')
    .flatMap((materialId) => {
      const material = byId.get(materialId)
      return material
        ? [{ ...material, estimatedDuration: effectiveEstimatedDuration(material, payload) }]
        : []
    })
}

export function mapMaterialsForRoadmap(events: Event[], entry: RoadmapLifecycleEntry): MaterialAddedPayload[] {
  return roadmapMaterialPayloads(events, entry.payload, entry.roadmapCreatedAt)
}

/**
 * Global materialId → title/url index for calendar bubble labels. A material's
 * title belongs to the material, not the roadmap, so this stays global: a
 * booking keeps its label after the material leaves the roadmap's set.
 */
export function materialTitleIndex(events: Event[]): Map<string, { title: string; url?: string }> {
  const byId = new Map<string, { title: string; url?: string }>()
  for (const event of events) {
    if (event.kind !== 'MaterialAdded' && event.kind !== 'MaterialAttached') continue
    const entry = event.payload as unknown as MaterialAddedPayload
    byId.set(entry.materialId, { title: entry.title, ...(entry.url ? { url: entry.url } : {}) })
  }
  return byId
}
```
`effectiveEstimatedDuration` changes its second parameter from `RoadmapLifecycleEntry` to the payload (its only use is `payload.materialDurationOverrides`).

3. **`apps/app/src/roadmap/roadmapProgress.ts`** — delete the local id→payload join (~lines 46-83) and build from the shared reader:
```ts
const materials = roadmapMaterialPayloads(events, entry.payload, entry.roadmapCreatedAt)
  .map((material) => ({ id: material.materialId, title: material.title, estimatedMinutes: material.estimatedDuration }))
```
(bonus fix: this reader gains the slot fallback it never had).

4. **`apps/app/src/roadmap/replan/mapToRegenerateRequest.ts`** — `materialPayloads(events, roadmap)` becomes a one-liner over the shared reader, threading the roadmap identity the file already computes:
```ts
function materialPayloads(events: Event[], roadmap: MaterialPayload, roadmapCreatedAt: string): MaterialAddedPayload[] {
  return roadmapMaterialPayloads(events, roadmap, roadmapCreatedAt)
}
```

5. **`apps/app/src/session/types.ts:33`** — `export type MaterialKind = 'youtube' | 'article' | 'manual' | 'file'` (D-07); fix every compiler complaint (expected: `PreSessionSetup.tsx:39/45`, `MaterialStrip.tsx:10`) with a `'file'` case → `'PDF'`/`'PDF file'`.

6. **`apps/app/src/materials/types.ts`** — add and export `toMaterialKind(kind: MaterialSourceKind): MaterialKind` (url→article, youtube→youtube, file→file, else manual) — D-07.

7. **`apps/app/src/materials/MaterialPicker.tsx`** — `excludeIds?: string[]` and a selection-shaped callback:
```ts
export interface MaterialPickerSelection {
  materialId: string
  title: string
  kind: MaterialSourceKind
}
export interface MaterialPickerProps {
  // ...existing
  excludeIds?: string[]
  onContinue: (
    selection: MaterialPickerSelection[],
    plan?: Record<string, { minutes: number; role: MaterialRole }>,
  ) => void
}
```
Filter `materials` by `excludeIds` before rendering; when the filtered list is empty and `excludeIds.length > 0`, render "Every library material is already on this roadmap." plus the existing `/materials/new` link. `MaterialLibrary.tsx`'s call site becomes `onContinue={(selection) => { setPicker(null); setPickerResult(selection.map((s) => s.materialId)) }}` (`plan` unused there — P2 fills it).

8. **`apps/app/src/roadmap/RoadmapCalendar.tsx`** — state `addMaterialOpen`, the "+" (D-05), the title-index swap and the handler:
```tsx
const materialsById = useMemo(() => materialTitleIndex(loadedEvents), [loadedEvents])   // bubble labels (global)
// header count uses the active set: {materialPayloads.length} materials

const handleAttachMaterials = async (
  selection: MaterialPickerSelection[],
  plan?: Record<string, { minutes: number; role: MaterialRole }>,
) => {
  if (!selectedRoadmap || readOnly) return
  for (const picked of selection) {
    await logEvent('MaterialAttached', {
      roadmapCreatedAt: selectedRoadmap.roadmapCreatedAt,
      materialId: picked.materialId,
      title: picked.title,
      kind: toMaterialKind(picked.kind),
      role: plan?.[picked.materialId]?.role ?? 'foundation',        // D-06 default
      estimatedDuration: Math.max(15, plan?.[picked.materialId]?.minutes ?? 60),
    })
  }
  setAddMaterialOpen(false)
}
```
Mount `<MaterialPicker open={addMaterialOpen} purpose="planning" excludeIds={materialPayloads.map((m) => m.materialId)} onClose={...} onContinue={(selection, plan) => void handleAttachMaterials(selection, plan)} />` beside the existing sheets.

9. **`apps/app/src/roadmap/roadmap.css`** — move the current `.dir-head` rules onto `.dir-head-toggle`, keep `.dir-head` a flex row, style `.dir-add` as a small icon button aligned with the count pill.

### Tests

- `apps/app/src/progress/mapEvents.test.ts` — `MaterialAttached` appears for its own roadmap only (two roadmaps, same library material, different budgets); declared order preserved and attached ids append; a re-attach changes the budget (last event wins); `materialIds: undefined` resolves through slot candidates + attachments; `materialTitleIndex` labels a booking whose material is no longer in the set.
- `apps/app/src/materials/types.test.ts` (new) — the four-kind mapping.
- `apps/app/src/materials/MaterialPicker.test.tsx` — `excludeIds` hides rows; the all-excluded empty state renders; `onContinue` hands back selection records; the existing `generation` case still passes.
- `apps/app/src/roadmap/RoadmapCalendar.test.tsx` — clicking "+" opens the picker; continuing logs one `MaterialAttached` per selection with `estimatedDuration` ≥ 15, `role: 'foundation'` by default, and `kind` mapped; the new material shows in the directory and in the add-session picker; the header material count uses the active set.
- `apps/app/src/roadmap/roadmapProgress.test.ts`, `roadmap/replan/mapToRegenerateRequest.test.ts` — a fixture with one attached material counts in progress and survives the regenerate request.
- Run: `pnpm --filter app test`, `pnpm --filter app typecheck`, `pnpm --filter app lint`.

### Verification (DONE)
```bash
pnpm --filter app typecheck && pnpm --filter app lint
pnpm --filter app test src/progress src/roadmap src/materials
# live: attach a library material on the dev stack, then confirm it in the directory,
# in the New session picker, and in session setup
```
Live: `./full-app status full` → `./full-app start full` (plus the ingestion worker if the material is still ingesting); after any frontend edit on `/mnt/d` run `./full-app restart app` and hard-reload (rule 53), then check the browser console is clean.

### Rollback
Revert the commit. Events already written are additive and ignored by the pre-P1 reader (it filters on `MaterialAdded` only); no data migration to undo.

### Notes (filled in during implementation)

**2026-09-12 — implemented and unit-verified (worktree `/mnt/d/study/git/study-planner-web-issue-63`).**

Landed as planned, with three reality-corrections:

1. **Two more `MaterialPicker` call sites than the index listed.** The selection-record callback change broke `pages/materials/MaterialLibrary.tsx`, `pages/materials/MaterialDetail.tsx:537` and `pages/materials/PracticeThis.tsx:212`; `tsc` found all three, each is now `selection.map((picked) => picked.materialId)`. Index updated.
2. **`sync/types.ts` also gained `MaterialDetachedPayload` in P1** — D-04's reader masks detaches from the first commit, so the type is needed in P1; P3 only adds the producer. Not a P3 slip.
3. **Skipped the duplicated empty-state control (D-05).** The "+" is in the directory header, which renders in both the collapsed and the expanded-empty state, so "No materials are attached to this roadmap" is already one click from the picker; a second button in the body would be the same action twice. Say so if the empty state should carry its own.

**AC4 grep:** `grep -rn "kind === 'MaterialAdded'\|kind !== 'MaterialAdded'" apps/app/src` now returns the join only in `progress/mapEvents.ts` (plus `onboarding/steps/Step4Confirm.tsx:31`, which looks up a single `firstSlot.candidateMaterialIds[0]` for the onboarding preview — not the roadmap material set, so not a fourth copy of the join; left alone).

**Verified:** `pnpm --filter app typecheck` clean · `pnpm --filter app lint` clean · `pnpm --filter app test` = **800/802**, the two failures being the documented WSL TZ pair in `dev/seedTestData.test.ts` (2/2 green under `--pool=forks`). Test deltas: `mapEvents.test.ts` +5 (16 total), `roadmapProgress.test.ts` +1 (3), `mapToRegenerateRequest.test.ts` +1 (8), `materials/types.test.ts` new (1), `MaterialPicker.test.tsx` +2 (10), `RoadmapCalendar.test.tsx` +3 (12).

**Live pass:** ✅ 1280 green 2026-09-12 (header `1 MATERIALS` -> `2 MATERIALS`, directory row, New session -> Attach, session setup `Foundations`, zero page errors). The 375 leg opened the picker and honoured `excludeIds` but found every library material already attached, so a fresh 375 attach is deferred until P3 can remove attaches. Transcript and two reusable findings (`e2e/playwright.config.ts`'s marketing webServer never becomes reachable in a worktree, and `app-mobile` is pinned to `roadmap.spec.ts`): `.work/active/roadmap-material-attach/research/2026-09-12-p1-live-verification.md`.

---

## Phase 2: Minutes and role are chosen at attach time

**Status:** ✅ Done 2026-09-12 (unit + live at 1280; OQ-07's mobile crowding unmeasured)
**Depends on:** Phase 1
**Estimated scope:** ~2 files, ~80 lines

### Codebase state assumed at start
- `MaterialAttached` events carry `estimatedDuration: 60` and `role: 'foundation'` from defaults.
- `MaterialPickerSelection` and the `plan` callback parameter exist but are unused.

### Verification (run BEFORE starting)
```bash
grep -n "plan?" apps/app/src/materials/MaterialPicker.tsx   # parameter exists, unused
```

### Steps

1. **`apps/app/src/materials/MaterialPicker.tsx`** — add `withPlan?: boolean`. When true, each **selected** row renders two native controls (D-03, D-06):
   - minutes: `<input type="number" min={15} step={15} inputMode="numeric" aria-label={`Minutes for ${title}`}>`, seeded from `plan[id]?.minutes ?? 60`;
   - role: `<select aria-label={`Role for ${title}`}>` with options from `ROLE_TO_LABEL` (`MaterialRole`), seeded `foundation`.
   `onContinue(selection, planById)` sends only selected ids. Also accept `defaultMinutes?: Record<string, number>` so the roadmap can seed the library row's own `estimatedMinutes`.
2. **`apps/app/src/roadmap/RoadmapCalendar.tsx`** — pass `withPlan` plus `defaultMinutes` built from the picked library rows (`estimatedMinutes ?? 60`).

### Tests
- `MaterialPicker.test.tsx` — a selected row exposes both controls; edits flow through `onContinue`'s second argument; deselected rows are omitted; `defaultMinutes` seeds the input; the `generation` call site is unaffected.
- `RoadmapCalendar.test.tsx` — the logged `estimatedDuration`/`role` equal the edited values.
- `pnpm --filter app test -- --run src/materials src/roadmap`

### Verification (DONE)
Live: attach a PDF as `foundation` at 90 minutes → the directory row reads "0m of 1h 30m"; a second material attached as `practice` shows the practice label in session setup.

### Rollback
Revert; P1's defaults still work.

### Notes (filled in during implementation)

**2026-09-12 — implemented, unit-verified and live-verified at 1280.**

- `MaterialPicker` gained `withPlan`. A **selected** row shows a minutes `<input type="number" min={15} step={15} inputMode="numeric">` and a role `<select>` built from the engine's `ROLE_TO_LABEL`, both seeded per row (`estimatedMinutes ?? 60`, `foundation`), and `onContinue` hands back a plan keyed by the selected ids only.
- The two controls live in a `.checkbox-entry` wrapper **next to** the row `<label>`, not inside it: a control nested in the label would also fire the label's click and toggle the selection.
- `RoadmapCalendar` passes `withPlan`; its handler already read `plan?.[id]` from P1, so nothing else moved.

**Deviation:** dropped the planned `defaultMinutes?: Record<string, number>` prop. The caller cannot build it - the calendar has no library rows and never sees `estimatedMinutes` - while the picker already holds each `MaterialRecord`. Seeding from the record is one expression instead of a prop plus a lookup the caller cannot fill. Add the prop back only if a caller ever needs to override the library estimate.

**One decision left for the hands-on pass (OQ-07):** the two controls are a two-up flex row, each about half the sheet width. At 1280 they sit comfortably; at 375 that is roughly 160 px each and this pass did not measure it, because every library material was already attached to the active roadmap and the picker therefore had no rows to render. Per D-06 the fallback is one batch role for the whole selection; say which reads better on the phone.

**Verified:** `pnpm --filter app typecheck` clean · `pnpm --filter app lint` clean · `MaterialPicker.test.tsx` 14/14 (+4) and `RoadmapCalendar.test.tsx` 13/13 (+1), all red-first. Live: a fresh plain-text library material attached at 90 minutes as `practice` moved the header `3 MATERIALS` -> `4 MATERIALS`, the directory row read **`0m of 1h 30m`**, and session setup's chooser showed **`Practice`**; zero page errors.

---

## Phase 3: A material can be removed from the roadmap's set

**Status:** ☐ Not started
**Depends on:** Phase 1
**Estimated scope:** ~5 files, ~140 lines

### Codebase state assumed at start
- The shared reader resolves attach/detach state (P1 wrote the mask; no producer yet).
- `.dir-row` renders title/bar/meta + one `Mark progress` button.

### Steps
1. **`apps/app/src/sync/types.ts`** — `export interface MaterialDetachedPayload { roadmapCreatedAt: string; materialId: string }`.
2. **`apps/app/src/roadmap/MaterialRemoveSheet.tsx`** (new, mirrors `booking/MaterialProgressSheet.tsx`): eyebrow "Remove material", title, body line naming the consequence ("`n` upcoming sessions still use it — they keep their label and logged time"), actions `Remove from roadmap` (accent/danger) + `Cancel`.
3. **`apps/app/src/roadmap/RoadmapCalendar.tsx`** — a ghost `Remove` button in `.dir-row` (disabled in read-only), state `removeMaterial`, and:
```tsx
const handleRemoveMaterial = async (material: MaterialLedgerEntry) => {
  if (!selectedRoadmap || readOnly) return
  await logEvent('MaterialDetached', {
    roadmapCreatedAt: selectedRoadmap.roadmapCreatedAt,
    materialId: material.materialId,
  })
  setRemoveMaterial(null)
}
```
The sheet's count comes from `bookings.filter((b) => b.materialId === material.materialId && b.date >= today).length`.
4. **`apps/app/src/roadmap/roadmap.css`** — let `.dir-row` wrap its two actions on narrow widths.
5. Confirm the reader mask is exercised end-to-end: detach → directory/pickers/progress lose it; re-attach → it returns with its logged minutes intact.

### Tests
- `mapEvents.test.ts` — detach masks a declared id and an attached id; attach-after-detach restores; detach for another roadmap does not mask; `materialTitleIndex` still labels a booking for a detached material.
- `RoadmapCalendar.test.tsx` — Remove logs `MaterialDetached`, the row disappears, the header count and `% done` drop, and a booking on that material keeps its title on the calendar.
- `roadmapProgress.test.ts` — the detached material leaves the denominator.
- Run: `pnpm --filter app test -- --run src/progress src/roadmap`

### Verification (DONE)
Live: remove a material with an upcoming booking → the booked bubble still shows its title, the directory drops the row, `Materials · N` decrements; attach it again → the row and its consumed minutes return.

### Rollback
Revert; existing `MaterialDetached` rows become inert (the reader falls back to declared ∪ attached).

### Notes (filled in during implementation)
*(empty)*

---

## Phase 4: The session surfaces never dead-end, and the flow is live-verified

**Status:** ☐ Not started
**Depends on:** Phase 1 (Phases 2–3 optional for the E2E's core path)
**Estimated scope:** ~4 files, ~80 lines + 1 e2e spec

### Steps
1. **`apps/app/src/roadmap/booking/MaterialPickerSheet.tsx`** — accept `onRequestAddMaterial?: () => void`; when `materials.length === 0`, render a first-class action row "Add a material to this roadmap" above "No material · pick at start" (D-10).
2. **`AddSessionSheet.tsx` / `BookingEditorSheet.tsx`** — pass the prop through.
3. **`RoadmapCalendar.tsx`** — supply it: close the booking sheet, open the "+" picker.
4. **`e2e/roadmap-material-attach-live.spec.ts`** (new) — one live scenario: sign in → open the roadmap → "+" → attach a ready library material with minutes + role → it appears in the directory → New session → Attach + lists it → book a session on it → the directory's consumed minutes move → Remove → the row disappears and the booked bubble keeps its label. Rules 10/15/16 apply (`--workers=1`, ready-state assertions, shared-account cleanup).

### Verification (DONE)
```bash
pnpm --filter app test && pnpm --filter app typecheck && pnpm --filter app lint
pnpm playwright test e2e/roadmap-material-attach-live.spec.ts --workers=1
```
Plus a hands-on desktop (1280) + mobile (375) pass of the three surfaces, with the console checked.

### Rollback
Revert; P1–P3 stand alone.

### Notes (filled in during implementation)
*(empty)*

---

## Phase 5: Material detail shows the roadmaps a material feeds

**Status:** ☐ Not started
**Depends on:** Phase 1
**Estimated scope:** ~3 files, ~70 lines

### Steps
1. **`apps/app/src/materials/useMaterialUsage.ts`** (new) — read the event store (`useEventStore` + `useLiveQuery`, the `RoadmapCalendar` pattern) and return, for one materialId, the roadmaps whose latest attach/detach state is attached: `{ roadmapCreatedAt, label, minutes }`, label from the roadmap payload's `purpose` or its date range.
2. **`apps/app/src/pages/materials/MaterialDetail.tsx`** — replace `const usage: string[] = []` (`:191`) with the hook's labels, and let the delete/archive warning (`:472`) name them.
3. Confirm `EventStoreProvider` wraps the `/materials` routes; if it does not, stop and record it as a blocker rather than hoisting providers in this phase.

### Tests
- `useMaterialUsage` unit test with a fake event list (two roadmaps, one detached, one unrelated material).
- `MaterialDetail.test.tsx` — the "Not attached to any roadmap yet" copy is replaced when a usage exists.

### Verification (DONE)
Live: attach a material to a roadmap, open `/materials/:id`, see the roadmap named; remove it from the roadmap and the usage drops.

### Rollback
Revert; the library page returns to the hardcoded-empty usage block.

### Notes (filled in during implementation)
*(empty)*

## Open questions

Resolved by the user on 2026-09-12 (kept for traceability):

- **OQ-01** Default minutes with no library estimate → **60** (D-03).
- **OQ-02** Role → **user-chosen per material in the attach modal** (D-06, supersedes the earlier fixed-role simplification).
- **OQ-03** Empty library → **route to the Materials create flow**, no inline create (D-10).
- **OQ-04** Material-detail usage → **in scope** (P5).
- **OQ-05** Detach → **in scope** (P3, D-09).

Still open:

- **OQ-06** Should the confirm on detach also offer "clear the upcoming sessions that use it"? Assumed no: none of the user's answers asked for a cascade, and clearing bookings is a bigger write. Ask before P3 ships if the warning copy reads weakly.
- **OQ-07** Per-row role select vs one batch role for the whole selection (D-06); switch to batch only if the two controls crowd the mobile sheet in the P2 hands-on pass.

## Out of scope

- Cascading removal of bookings/sessions when a material leaves the set (OQ-06).
- Showing roadmap materials inside `/materials` as library rows (legacy onboarding materials are local uuids, not library rows; P5 shows references, not merged entities).
- Assessment/Practice pickers reading the roadmap set (they stay library-driven).
- Auto-booking sessions for a newly attached material (the user books sessions explicitly; Replan will schedule it when they replan).
- Any Supabase migration, contract-pack change or roadmap-engine change.

## References

- Wayfinder map #4 and its decisions: `.work/active/phase2-wayfinder/research/map-4.md:32` (#7 attach pointer), `:38` (#33 Q22 planning boundary), issue #19 resolution ("linked usage groups for Roadmaps, Assessments, and Practice").
- `.work/specs/phase2-tickets/04-material-library-attachment.md` (library slice, roadmap attach omitted), `.work/plans/archive/2026-08-13-material-library-implementation/PLAN.md` (Non-goals).
- Code: `progress/mapEvents.ts:241/155`, `roadmap/roadmapProgress.ts:50`, `roadmap/replan/mapToRegenerateRequest.ts:80`, `roadmap/calendarModel.ts:148-166`, `roadmap/RoadmapCalendar.tsx:190-214/554-604`, `materials/MaterialPicker.tsx:11/131`, `pages/materials/MaterialDetail.tsx:191`, `sync/types.ts:57`, `events/EventStore.ts:13`, `booking/MaterialProgressSheet.tsx`.
- Engine: `packages/roadmap-engine/src/roadmap-engine.ts:30` (`MaterialRole`), `constants.ts:49` (`ROLE_TO_LABEL`).
- Rules: 30 (event-store boundaries), 33 (sync boundaries), 41 (roadmap engine), 53 (WSL dev runtime), 10/15/16 (Playwright, live E2E).
