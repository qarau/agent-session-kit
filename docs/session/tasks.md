# Session Tasks

Last updated: 2026-03-12

## Now

- [ ] Request code review for ask-core hard cutover branch.

## Next

- [ ] Decide integration strategy to merge `ask-hard-cutover` into `main`.
- [ ] Define maintainer policy for unmatched `pending-transition.json` markers.
- [ ] Define governance policy for lifecycle-state override keys.

## Done

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
