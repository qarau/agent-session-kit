# Session Tasks

Last updated: 2026-03-14

## Now

- [ ] Commit and push all-branches branch-enforcement update (`branchEnforcementMode`).

## Next

- [ ] Add downstream migration note for repos missing `branchEnforcementMode` in `active-work-context.json`.
- [ ] Define maintainer policy for unmatched `pending-transition.json` markers.
- [ ] Define governance policy for lifecycle-state override keys.

## Done

- [x] 2026-03-14 - add configurable branch enforcement mode and all-branch maintainer policy wiring
- [x] 2026-03-12 - add codex context budget command contracts (`50e1b4a`)
- [x] 2026-03-12 - add codex context budget manager + CLI commands (`65867e0`)
- [x] 2026-03-12 - include codex context summary in session doctor (`45b76ea`)
- [x] 2026-03-12 - add guarded command runner stall-recovery contracts (`9e2fb05`)
- [x] 2026-03-12 - add guarded runner + runtime operation state tracking (`9ea1a5b`)
- [x] 2026-03-12 - wire adapters through guarded runtime execution (`4aac026`)
- [x] 2026-03-12 - add `ask session doctor` runtime diagnostics (`d8fd57b`)
- [x] 2026-03-12 - add pre-push-check hard-cutover contracts (`8dc109f`)
- [x] 2026-03-12 - add ask-core pre-push-check and release-doc engine (`d77d652`)
- [x] 2026-03-12 - cut pre-push adapter over to ask-core pre-push-check (`d8c4748`)
- [x] 2026-03-12 - cut installer payload to ask-core-only runtime (`1c6bd84`)
- [x] 2026-03-12 - centralize branch enforcement mode in ask-core runtime (`38fec70`)
- [x] 2026-03-12 - publish ask-core-only runtime docs/guidance (`186c61a`)
- [x] 2026-03-12 - add pre-commit-check and adapter cutover contracts (`3212d49`)
- [x] 2026-03-12 - add ask-core pre-commit-check command (`feaa7d4`)
- [x] 2026-03-12 - cut pre-commit adapter over to ask-core pre-commit-check (`68e7495`)
- [x] 2026-03-12 - publish phase-4 pre-commit cutover docs/bootstrap guidance (`5956341`)

## Usage Rules

- Update at session start.
- Update before first code edit.
- Move items to Done immediately after meaningful completion.
- Keep exactly one item in `Now`.
- Optional helpers:
  - `node scripts/session/nextTask.mjs`
  - `node scripts/session/completeTask.mjs`
