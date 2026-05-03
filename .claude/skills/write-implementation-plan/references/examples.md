# Examples

Worked examples (good and bad) for the trickier parts of an implementation plan. When you're unsure of the right level of detail or formatting, look here.

---

## Decisions log entries

### Good — clear, self-contained, captures the *why*

```markdown
### D-04: Use Redis for token blocklist instead of database table

**Status:** ✅ Agreed

**Context:** Discussed during planning — needed to choose between (a) Postgres
table with TTL cleanup job, (b) Redis with native EXPIRE, (c) in-memory LRU.

**Decision:** Redis with EXPIRE.

**Rationale:** Native TTL avoids the cleanup job, blocklist lookups are
hot-path so sub-ms matters, Redis is already in the stack for sessions.

**Alternatives considered:**

- Postgres table → rejected: extra cron job, slower lookup
- In-memory LRU → rejected: doesn't survive restarts, breaks multi-instance

**User pushback / disagreement:** User initially preferred Postgres for
"one less moving piece" — convinced by the cleanup-job argument.

**Reversibility:** Easy — blocklist interface is one module
(`auth/blocklist.py`), swappable.
```

**Why this is good:** A future reader (or implementing agent) hitting a snag with Redis can immediately see *why* it was chosen, what was rejected, and that the user had reservations they were talked out of. They won't waste a cycle re-litigating it. The reversibility note tells them how expensive it would be to swap back if the snag turns out to be fundamental.

### Good — disagreement that was deferred

```markdown
### D-07: Token expiry default — 15min vs 1hr

**Status:** ⚠️ Disagreed/Deferred

**Context:** Security wanted 15min, product wanted 1hr for UX continuity.

**Decision (current direction):** 1 hour for v1, with refresh-token flow
designed to allow tightening later without breaking clients.

**Rationale:** 1hr matches industry default for similar consumer products;
the tightening path exists if needed.

**Alternatives considered:**

- 15min → deferred: too aggressive for v1 launch UX
- Configurable per-tenant → out of scope for v1

**User pushback / disagreement:** User said:

> "I hear security but we'll lose users if they get bounced every 15 minutes
> on day one. Let's ship 1hr and tighten if metrics say so."

**Reversibility:** Trivial — one constant in `auth/config.py`. But changing
post-launch will log out active users.

**Cross-ref:** Tracked as OQ-02 (security signoff still pending).
```

**Why this is good:** Disagreement is named explicitly, not glossed over. The user's reasoning is preserved verbatim because the exact phrasing (UX tradeoff, "lose users") matters. The cross-ref to OQ-02 closes the loop — anyone reading the decision sees there's an unresolved follow-up.

### Good — implicit assumption flagged

```markdown
### D-09: Hash blocklisted tokens before logging

**Status:** 🤔 Assumed (unconfirmed)

**Context:** Logs from the blocklist check will go to the standard log
pipeline. Tokens in plaintext logs are a security risk.

**Decision:** Log only the SHA-256 hash of the token, not the token itself.

**Rationale:** Standard practice. Hash is enough to correlate logs with a
specific blocked token if needed for debugging.

**Alternatives considered:**

- Log full token → rejected: leaks credentials to log aggregator
- Log nothing → rejected: makes blocklist debugging impossible

**User pushback / disagreement:** None — but the user did not explicitly
discuss this. Claude proposed it during plan drafting because the planning
discussion implied logging would happen but didn't address the safety of
logging tokens. Worth confirming.

**Reversibility:** Easy.
```

**Why this is good:** The 🤔 status flag is honest — the user didn't actually decide this, Claude inferred it. Surfacing this lets the user upgrade it to ✅ or push back, and ensures the implementing agent doesn't treat it as a firm decision they can't revisit.

### Bad — vague and useless

```markdown
### D-04: Token storage

**Status:** Agreed
**Decision:** We'll use Redis.
```

**Why this is bad:** No rationale, no alternatives, no context. The implementing agent will second-guess it the moment they hit a snag, because they have nothing to push back against. A future reader doing maintenance will have no idea whether this was a load-bearing choice or an arbitrary one.

---

## Phase entries

### Good — fresh-agent ready

```markdown
## Phase 2: Add token blocklist check to request middleware

**Status:** ☐ Not started
**Depends on:** Phase 1 (Redis client wiring)
**Estimated scope:** 2 files, ~40 lines

#### Codebase state assumed at start

- File `auth/blocklist.py` exists with `is_blocked(token: str) -> bool`
  (created in Phase 1)
- Test `tests/auth/test_blocklist.py::test_is_blocked_returns_false_for_unknown`
  is passing
- Redis client available via `from infra.redis import client as redis_client`

#### Verification (run BEFORE starting)

\`\`\`bash
pytest tests/auth/test_blocklist.py -v
python -c "from auth.blocklist import is_blocked; print(is_blocked('xyz'))"
# expected: False
\`\`\`

If either fails, STOP — Phase 1 likely isn't fully done.

#### Steps

1. **Modify `auth/middleware.py`, function `authenticate_request`
   (currently lines 34–58):** Insert blocklist check after token extraction,
   before claim validation. Implements D-04.

   Replace the function body with:

   \`\`\`python
   def authenticate_request(request):
       token = extract_token(request)
       if not token:
           return None
       if is_blocked(token):                   # NEW — D-04
           logger.info(
               "blocked token rejected",
               extra={"token_hash": hash_token(token)},  # D-09
           )
           return None
       try:
           claims = validate_token(token)
       except TokenExpiredError:
           return None
       return claims
   \`\`\`

2. **Add imports at top of `auth/middleware.py`:**

   \`\`\`python
   from auth.blocklist import is_blocked
   from auth.util import hash_token
   \`\`\`

#### Tests

- Add `tests/auth/test_middleware.py::test_blocklisted_token_rejected` —
  verifies that a token in the blocklist returns None and logs the rejection.
- Update `tests/auth/test_middleware.py::test_valid_token_authenticates` —
  no behavior change, but mock `is_blocked` to return False explicitly to
  avoid coupling to Redis state.
- Run: `pytest tests/auth/ -v`

#### Verification (DONE)

\`\`\`bash
pytest tests/auth/ -v                    # all green
grep -n "is_blocked" auth/middleware.py  # should show import + call site
\`\`\`

#### Rollback

`git revert <commit-sha>`. No data migrations. Phase 3 doesn't depend on
this code path being live (it touches separate files), so reverting won't
break Phase 3 if 3 is already done.

#### Notes (filled in during implementation)

<empty>
```

**Why this is good:** A fresh agent can execute this with no prior context. Every "what file?" is answered. Every "what code?" is answered. The verification commands tell them whether the prereqs hold *and* whether they finished the work correctly. The references to D-04 and D-09 give them the *why* without bloating the step.

### Bad — vague, requires re-discovery

```markdown
## Phase 2: Add blocklist check

Update the auth middleware to check the blocklist before validating tokens.
Add a test. Make sure it works.
```

**Why this is bad:** A fresh agent now has to: find the middleware file, find the right function, figure out where in the function to insert the check, decide what to import, decide what to test, decide how to verify. The plan's job was to eliminate all of that work upfront. This phase has done none of it.

---

## Verification commands

### Good — runnable, deterministic, with expected output

```bash
pytest tests/auth/test_jwt.py -v          # all green
grep -n "validate_token" auth/jwt.py      # returns line 23
curl -s http://localhost:8000/health | jq .status   # returns "ok"
```

**Why these work:** Each command produces a clear yes/no signal. No subjective interpretation needed.

### Bad — vibes-based

> Verify the auth works.
> Make sure the tests pass.
> Check that nothing's broken.

**Why these don't work:** Not actionable. The implementing agent will run *something*, decide it looks fine, and move on — which defeats the purpose of having a verification step at all. "Make sure the tests pass" — *which* tests? With *what* command?

---

## Open questions

### Good

```markdown
### OQ-02: Security signoff on 1hr token expiry

**Why deferred:** Product wants 1hr (D-07) for launch UX; security prefers
15min. Going with 1hr now, but security hasn't formally signed off.

**Triggers needing resolution:** Before public launch. Or sooner if a
security incident makes the longer expiry untenable.

**Owner / resolution path:** Security team review meeting, scheduled
for <date>. Outcome may force a tightening before GA.

**Cross-ref:** Affects D-07 (currently ⚠️ Disagreed/Deferred — would
upgrade to ✅ once signed off).
```

**Why this is good:** Specifies *why* it's deferred, *when* it has to be resolved, *who* resolves it, and *what* it affects. None of these are guessable from context.

### Bad

```markdown
### OQ-02: Token expiry might change
We'll figure it out later.
```

**Why this is bad:** No clarity on what "later" means, no clarity on who decides, no clarity on what the question even is. This is the kind of entry that ends up being silently dropped because nobody owns it.

---

## TL;DR

### Good

> This plan adds a token blocklist to the auth middleware so revoked tokens are rejected even before their natural expiry. Implementation uses Redis (already in the stack) with native TTL — see D-04. Plan is split into 3 phases: (1) wire up the blocklist module + Redis client, (2) integrate the check into request middleware, (3) add an admin endpoint for blocklisting tokens manually. Out of scope: bulk blocklisting and per-tenant configuration (see Out of scope section).

**Why this is good:** A fresh agent reading just this paragraph knows: what the change is, the key technical choice, how it's structured, and what's *not* included. They can decide in 30 seconds whether they're on the right plan.

### Bad

> This plan implements the auth changes we discussed.

**Why this is bad:** Any fresh agent reading this learns nothing they didn't know from the filename.

---

## Out of scope

### Good

```markdown
- **Bulk blocklisting (CSV upload of token list)** — not in scope because
  there's no concrete use case yet; admin endpoint (Phase 3) handles the
  one-at-a-time case which covers the only known need (compromised user
  reset). Followup plan if a bulk need emerges.

- **Per-tenant blocklist isolation** — not in scope because v1 is
  single-tenant. Will need a re-keying scheme in Redis when multi-tenancy
  lands; tracked in the multi-tenancy roadmap, not this plan.
```

**Why this is good:** Each item has a real reason it was excluded *and* a pointer to where (if anywhere) it might be picked up. Prevents implementing agents from "helpfully" adding it during the build.

### Bad

```markdown
- Bulk operations
- Multi-tenancy
```

**Why this is bad:** No reason, no pointer. The next person to read the plan will spend cycles wondering whether these omissions were deliberate or accidental.
