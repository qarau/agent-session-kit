# ask-core

Standalone runtime core for ASK.

Current lifecycle command set:
- `ask session start`
- `ask session pause --reason "..."`
- `ask session resume --reason "..."`
- `ask session block --reason "..."`
- `ask session close --reason "..."`
- `ask session status`

Session state persistence:
- snapshot: `.ask/sessions/active-session.json`
- append-only history: `.ask/sessions/history.ndjson`
- in-flight transition marker: `.ask/sessions/pending-transition.json`

Lifecycle policy gates:
- `ask preflight` and `ask can-commit` read policy keys:
  - `allowed_preflight_states`
  - `allowed_can_commit_states`
- Default allowed states: `active`, `paused`.
- Default rejected states: `blocked`, `closed`, `created`.

Pre-commit contract:
- `ask pre-commit-check` returns deterministic parity checks for work context, docs freshness, preflight, and can-commit.
