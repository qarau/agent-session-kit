# Session Tasks

Last updated: 2026-03-11

## Now

- [ ] Request code review for ask-core phase-1 migration and adapter proof.

## Next

- [ ] Decide integration path to `main` release for ask-core phase-1.
- [ ] Define adapter-to-core full cutover criteria and timeline.
- [ ] Start the next ask-core feature phase in `ask-runtime`.

## Done

- [x] 2026-03-11 - bootstrap standalone ask-core runtime package (`1143b39`)
- [x] 2026-03-11 - add session/context runtime contract coverage (`10413c5`)
- [x] 2026-03-11 - add preflight/can-commit runtime contracts (`11069df`)
- [x] 2026-03-11 - migrate pre-commit and pre-push through ask-core adapters (`dbf186b`)
- [x] 2026-03-11 - wire ask-core scripts and runtime migration docs (`182c158`)

## Usage Rules

- Update at session start.
- Update before first code edit.
- Move items to Done immediately after meaningful completion.
- Keep exactly one item in `Now`.
- Optional helpers:
  - `node scripts/session/nextTask.mjs`
  - `node scripts/session/completeTask.mjs`
