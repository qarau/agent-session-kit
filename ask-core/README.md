# ASK Forge Core

Governed Autonomous Software Development runtime core for ASK Forge.

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

Pre-commit/pre-push contract:
- `ask pre-commit-check` returns deterministic parity checks for work context, docs freshness, preflight, and can-commit.
- `ask pre-push-check` also enforces slice commit governance (`ASK-Slice` footer or explicit `ASK-Exempt` release/meta footer).

Governance and operations:
- `ask next`
- `ask governance status|explain`
- `ask task create|assign|start|complete|reopen|depends|status`
- `ask plan ingest|validate|batch show`
- `ask slice preview|close`
- `ask architect exempt add|list`
- `ask flow list|promote|status|validate --last|discover --last`
- `ask design list|status|discover --last|validate --last|promote`
- `ask metrics show [--history <n>]`

Operator playbooks are documented in `../docs/operations/`.
