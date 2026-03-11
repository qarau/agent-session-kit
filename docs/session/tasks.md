# Session Tasks

Last updated: 2026-03-11

## Now

- [ ] Finalize verification evidence commit for maintainer-mode rollout.

## Next

- [ ] Request code review for branch-aware maintainer governance changes.
- [ ] Decide integration path with `finishing-a-development-branch` workflow.
- [ ] Plan phase-2 extraction of reusable maintainer mode after 1-2 release cycles.

## Done

- [x] 2026-03-11 - add branch enforcement resolver (`b2075e4`)
- [x] 2026-03-11 - add branch-aware session freshness + runtime path guard (`62a1139`)
- [x] 2026-03-11 - add protected-branch release docs enforcement (`2830274`)
- [x] 2026-03-11 - dogfood root hooks and session docs in maintainer repo (`29da182`)
- [x] 2026-03-11 - publish maintainer-mode policy docs (`7626ab1`)

## Usage Rules

- Update at session start.
- Update before first code edit.
- Move items to Done immediately after meaningful completion.
- Keep exactly one item in `Now`.
- Optional helpers:
  - `node scripts/session/nextTask.mjs`
  - `node scripts/session/completeTask.mjs`
