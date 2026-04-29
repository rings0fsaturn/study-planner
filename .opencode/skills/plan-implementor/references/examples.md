# Examples

Worked scenarios for plan-implementor. Read when unsure how to handle a situation.

---

## Example 1: Clean phase execution (no issues)

**User:** "Implement the next phase of `plans/2026-04-29-jwt-auth.md`"

**Agent:**

1. Reads plan. Phase 1 is `✅ Complete`; Phase 2 is `☐ Not started`, depends only on Phase 1. Phase 2 is the target.

2. Runs Phase 2 prereqs:
   - `pytest tests/auth/test_blocklist.py -v` → all green ✓
   - `python -c "from auth.blocklist import is_blocked; print(is_blocked('xyz'))"` → `False` ✓

3. Updates plan: Phase 2 status `🟡 In progress`. Commits plan file alone:
   ```
   Phase 2: starting (status: in progress)
   ```

4. Reads Phase 2 Tests section — one new test (`test_blocklisted_token_rejected`), one updated test (`test_valid_token_authenticates`). Reads Steps section — modify `auth/middleware.py` `authenticate_request`, add imports.

5. **TDD cycle:**
   - Writes `test_blocklisted_token_rejected` per the plan's description.
   - Runs it → fails (expected — production change not yet applied).
   - Applies Step 1 (modify `authenticate_request` body, lines 34–58) using the exact code from the plan.
   - Applies Step 2 (add imports at top of `auth/middleware.py`).
   - Runs `test_blocklisted_token_rejected` → passes ✓.

6. Updates `test_valid_token_authenticates` per the plan's description (mock `is_blocked` to return False). Runs all auth tests → all green ✓.

7. Runs phase post-verification:
   - `pytest tests/auth/ -v` → green ✓
   - `grep -n "is_blocked" auth/middleware.py` → returns lines 3 and 41 ✓

8. Updates plan: Phase 2 status `✅ Complete — pending`. Notes block: `"Implemented as specified, no surprises."`

9. Commits code + plan together: `Phase 2: Add token blocklist check to request middleware` (body: `See plans/2026-04-29-jwt-auth.md`). Gets sha (`abc1234`). Edits plan to replace `pending` with `abc1234`. `git commit --amend --no-edit`.

10. Tells user:

    > "Phase 2 complete (commit `abc1234`). Phase 3 is ready (depends only on Phase 2). Continue?"

---

## Example 2: Prereq verification failure

**User:** "Implement the next phase"

**Agent:**

1. Detects plan, target phase is Phase 3.

2. Runs prereqs. Phase 3 expects `auth/blocklist.py` with `bulk_block(tokens: list)` function:
   - `python -c "from auth.blocklist import bulk_block"` → `ImportError: cannot import name 'bulk_block'` ✗

3. **STOP.** Tells user:

   > "Phase 3 prereqs failed: `bulk_block` doesn't exist in `auth/blocklist.py`.
   >
   > **Failing check:** `python -c "from auth.blocklist import bulk_block"` → `ImportError: cannot import name 'bulk_block'`
   >
   > Phase 2's status is `✅ Complete` in the plan, but the function it should have created isn't there. Three possibilities:
   >
   > 1. Phase 2's status marker is wrong (drift) — the work wasn't fully done but the marker says it was.
   > 2. The implementation skipped the `bulk_block` addition.
   > 3. The plan was wrong about Phase 2 creating `bulk_block` — maybe a later phase was supposed to.
   >
   > Want me to investigate (run Phase 2's `Verification (DONE)` block to check for drift), or do you want to look first?"

4. Waits for user response. Does **not** proceed with Phase 3.

---

## Example 3: Test failure → escalation → fix → success

During Phase 2 implementation, after applying Step 1:

Agent runs `test_blocklisted_token_rejected`. Fails:

```
AssertionError: expected None, got <Claims object>
```

**Agent's read:** This isn't a typo or missed import. The blocklist check seems to not be triggering. Not trivial — escalate.

1. Commits checkpoint:
   ```
   git add -A
   git commit -m "wip(Phase 2): debug checkpoint — test_blocklisted_token_rejected failing"
   ```

2. Spawns debug subagent using the prompt template at `references/debug-subagent-prompt.md`. Fills in: plan path, Phase 2, Step 1, the test command, the failing output, the recent diff (just `auth/middleware.py` changes), and D-04 (the Redis blocklist decision).

3. Subagent uses `debug-session` skill, reads the test, reads `auth/middleware.py`, reads `auth/blocklist.py`, returns:

   ```markdown
   ### RCA
   The blocklist check is firing but `is_blocked()` is returning False even for tokens
   that should be blocked. Root cause: the test sets up the blocklist by calling
   `block(token)` but `is_blocked()` is checking against a different Redis key prefix
   ("blocklist:") than `block()` writes ("blocked:"). Key prefix mismatch.

   ### Root cause location
   - **File:** `auth/blocklist.py`
   - **Line(s):** 27 (read prefix is "blocklist:"; write prefix on line 18 is "blocked:")

   ### Detailed fix
   **File:** `auth/blocklist.py`
   **Change:** modify line 27, change "blocklist:" to "blocked:"
   **Code:**
   ```python
   key = f"blocked:{token}"  # was: f"blocklist:{token}"
   ```

   ### Confidence
   high — the prefixes don't match; this is a clear bug from Phase 1 implementation.

   ### Caveats
   None.

   ### Did NOT investigate
   Whether the prefix should be "blocked:" or "blocklist:" semantically — went with
   "blocked:" because that's what the write side uses and D-04 doesn't specify which.
   ```

4. Confidence is **high** → agent applies fix directly: changes line 27 of `auth/blocklist.py`.

5. Re-runs `test_blocklisted_token_rejected` → passes ✓.

6. Adds to Phase 2 Notes block:
   > "Phase 1 had a Redis key prefix mismatch in `auth/blocklist.py` (write used 'blocked:', read used 'blocklist:'). Surfaced via debug subagent during Phase 2 testing. Fix applied to read side."

7. Continues with rest of Phase 2.

**Note on cross-phase fixes:** the agent fixed a Phase 1 bug while implementing Phase 2. Phase 1's status remains `✅ Complete` because the fix was narrow and the Notes record what happened. If the user prefers stricter accounting, they can audit and decide whether to retroactively re-mark.

---

## Example 4: Test failure → escalation → fix doesn't work → human

During Phase 4 implementation:

Test fails. Agent escalates. Subagent returns RCA + fix with **confidence: medium**.

Because confidence is medium, agent surfaces to user before applying:

> "Phase 4 test `test_refresh_token_rotation` failed. Debug subagent's analysis (medium confidence):
>
> **RCA:** [...]
> **Proposed fix:** [...]
>
> Apply this fix, or do you want to inspect first?"

User says "go ahead, apply it." Agent applies the fix. Re-runs test — **still fails** with a different error.

Agent does **NOT** spawn another subagent. Instead:

> "Phase 4 test `test_refresh_token_rotation` is still failing after applying the debug subagent's fix.
>
> **Original failure:**
> ```
> <output>
> ```
>
> **Subagent RCA:** `<summary>`
>
> **Subagent fix applied:** `<what changed>`
>
> **New failure after fix:**
> ```
> <new output>
> ```
>
> The subagent's confidence was medium and the new error is different from the original, suggesting either the fix was wrong or there's a second issue. Pausing here to avoid recursive debug cycles. Options:
>
> 1. Revert the subagent's fix and try a different angle.
> 2. You investigate the new failure.
> 3. Mark the phase blocked and come back later.
>
> What would you like?"

Agent updates plan: Phase 4 status to `🛑 Blocked: refresh token rotation test failing after one debug cycle`. Adds to Notes: original failure, subagent RCA, fix applied, new failure. Commits the plan with message `Phase 4: blocked — refresh token rotation test failing after one debug cycle`.

---

## Example 5: Contradiction between plan and code

During Phase 2 implementation:

Plan Step 1 says: *"Modify `auth/middleware.py`, function `authenticate_request` (currently lines 34–58)."*

Agent reads `auth/middleware.py`. The function exists, but it's at lines 41–67, not 34–58. The function body also has an `if not user.is_active: return None` check that the plan doesn't mention — replacing the function body as the plan specifies would silently lose this check.

**Agent STOPS:**

> "Phase 2 Step 1 expects `authenticate_request` at lines 34–58 of `auth/middleware.py`, but I find it at lines 41–67. The function body also has an `if not user.is_active: return None` check that the plan's replacement code doesn't include — applying the plan as written would drop the active-user check.
>
> Possible causes:
>
> 1. The file changed since the plan was written (someone added the active-user check after planning).
> 2. The plan wasn't fully grounded — the planner missed the active-user check.
> 3. The plan deliberately wants to drop the active-user check (unlikely without a decision logged for it).
>
> What should I do? My recommendation: pause, you confirm whether the active-user check should stay (most likely yes), and I update the plan's Step 1 to preserve it before continuing."

Does **not** proceed. Does **not** "merge" the plan's code with the existing check on its own initiative — that's a re-architecture and the agent doesn't make those calls.

---

## Example 6: Trivial fix, no escalation

During Phase 3 implementation:

Test fails: `NameError: name 'logger' is not defined` in `auth/admin_endpoints.py`.

Agent reads the failing file. Sees there's no `logger = logging.getLogger(__name__)` at the top. Plan said to `import logging` in another step but missed the assignment line.

**This is trivial:**
- Error message is self-explanatory.
- Fix is one line.
- Mechanical (boilerplate addition).

Agent fixes inline: adds `logger = logging.getLogger(__name__)` near the top of the file (right after the imports). Re-runs test → passes ✓.

Adds to Phase 3 Notes block:

> "Plan Step 2 specified `import logging` but didn't include the logger assignment — added inline (`logger = logging.getLogger(__name__)`)."

No subagent spawned. Continues with the rest of the phase.

---

## Summary: when to escalate vs when to fix inline

**Fix inline (no subagent):**

- Typos in identifiers (variable names, function names) where the right one is obvious from context
- Missing imports / missing logger setup / missing standard boilerplate
- Off-by-one in literals where the right value is obvious from surrounding context
- Anything where the error message is self-explanatory and the fix is one or two lines

**Escalate to debug subagent:**

- Tests fail with assertions that don't match expectation, root cause unclear
- Tests fail with errors that point to code you didn't change recently
- Behavior diverges from spec but you're not sure why
- Multiple things might be wrong and you'd need to investigate to pick which
- Anything where you'd need to read more than the failing test + the changed file to figure it out

**Hand back to user (after one failed escalation):**

- Subagent's fix didn't resolve the issue
- New error appeared after applying the fix
- Phase deps appear to have drifted
- Plan and code contradict each other in ways the plan didn't anticipate
