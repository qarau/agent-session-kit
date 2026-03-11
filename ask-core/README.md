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
