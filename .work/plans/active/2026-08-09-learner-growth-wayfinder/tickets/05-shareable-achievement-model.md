## Question

What exactly is shared when a learner shares an achievement? Decide:

- **Immutable snapshot** (one-time render of evidence, stable forever) vs **live page** (updates as progress continues) vs both.
- URL identity: one URL per achievement vs per collection/card.
- Revocation and expiry: can the learner unpublish a snapshot? What happens to the URL?
- What happens to public pages when the underlying roadmap/material is deleted or progress regresses.
- Whether a share includes multiple achievements (e.g., a "journey" card) or exactly one.
- Who can see it: unauthenticated visitors, logged-in learners only, or both.

## Context

Requirement: sharing must show *how or what the learner did* — not a generic "I learned X" claim. That forces an evidence contract ("Mastery and evidence contract for achievements") and a privacy contract ("Privacy and identity for public sharing"), both of which block this ticket.

Recommended default (charted 2026-08-09; re-decide if it doesn't hold): opt-in immutable snapshots, one achievement per link, revocable, visible to anyone with the link.

---
Part of the Learner Growth map #__MAP__ · type: grilling (decision)

Blocked by: __BLOCKED_BY__
