# Session Tasks

Last updated: 2026-03-12

## Now

- [ ] Request code review for phase-3 lifecycle-policy integration.

## Next

- [ ] Decide integration path to `main` release for phase-3 lifecycle-policy changes.
- [ ] Define adapter-to-core full cutover parity gate and timeline.
- [ ] Start phase-4 adapter cutover planning for legacy check reduction.

## Done

- [x] 2026-03-11 - bootstrap standalone ask-core runtime package (`1143b39`)
- [x] 2026-03-11 - add session/context runtime contract coverage (`10413c5`)
- [x] 2026-03-11 - add preflight/can-commit runtime contracts (`11069df`)
- [x] 2026-03-11 - migrate pre-commit and pre-push through ask-core adapters (`dbf186b`)
- [x] 2026-03-11 - wire ask-core scripts and runtime migration docs (`182c158`)
- [x] 2026-03-12 - add lifecycle transition contract tests (`5512f6d`)
- [x] 2026-03-12 - add lifecycle journal storage primitives (`bd1417e`)
- [x] 2026-03-12 - implement lifecycle transition engine and CLI contracts (`31af39b`)
- [x] 2026-03-12 - add lifecycle recovery and legacy snapshot migration (`6d9a54f`)
- [x] 2026-03-12 - sync bootstrap templates and lifecycle docs (`02343c5`)
- [x] 2026-03-12 - add lifecycle-state matrix contracts for preflight/can-commit (`3c605ff`)
- [x] 2026-03-12 - add lifecycle allowed-state policy defaults and parser support (`a3251da`)
- [x] 2026-03-12 - enforce lifecycle allowed states in preflight (`40dc299`)
- [x] 2026-03-12 - enforce lifecycle allowed states in can-commit (`b7b014e`)
- [x] 2026-03-12 - publish lifecycle-policy integration docs (`d9bee48`)

## Usage Rules

- Update at session start.
- Update before first code edit.
- Move items to Done immediately after meaningful completion.
- Keep exactly one item in `Now`.
- Optional helpers:
  - `node scripts/session/nextTask.mjs`
  - `node scripts/session/completeTask.mjs`
