## Question

What identity and privacy rules govern public sharing? Decide:

- Public profiles: none initially vs minimal profile pages.
- Display-name requirement for sharing; real name vs handle.
- Anonymous sharing (no name at all).
- Which evidence fields are public by default vs optional: roadmap/topic name, completion date, study period, session count, minutes, assessment score, mastery level.
- Per-share consent flow and per-field redaction.
- Search-engine indexing of share pages.
- Revocation and account-deletion behavior for already-published pages.
- Blocking/reporting users who appear on shared content.

## Context

The app currently has no public identity surface at all (no profiles table; Settings is a stub). This ticket defines the boundary between the private local-first account and the public web, and gates both the share model and the share cards.

Recommended default (charted 2026-08-09; re-decide if it doesn't hold): no public profiles initially; individual achievement pages only; explicit per-page consent with evidence fields the learner can hide; indexing decided per link.

---
Part of the Learner Growth map #__MAP__ · type: grilling (decision)

Blocked by: __BLOCKED_BY__
