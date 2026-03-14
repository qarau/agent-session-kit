# ASK Release Ledger

Use this file as the source of truth for version-to-document mapping.

Checklist: `release-checklist.md`

## Released

- `v3.0.0` - ASK 3.0: Session OS Runtime
  - Notes: `v3.0.0.md`
  - Announcement: `v3.0.0-announcement.md`
- `v2.0.0` - ASK 2.0: Developer-Agent Runtime
  - Notes: `v2.0.0.md`
  - Announcement: `v2.0.0-announcement.md`
- `v0.1.6` - Efficiency Workflow Upgrade (Resume + Archive + Fast-Check)
  - Notes: `v0.1.6.md`
  - Announcement: `v0.1.6-announcement.md`

## Unreleased Drafts

- `v0.1.7` (draft) - soft task reminder workflow
  - Notes: `v0.1.7-draft.md`

## Rules

- Only released versions use `vX.Y.Z.md`.
- Draft scopes must use `vX.Y.Z-draft.md` until tagged/released.
- `latest.md` must point only to a released version.
- Run `release-checklist.md` before publishing release docs or tags.
- Run `npm --prefix agent-session-kit run test:release-docs` before release publish/tag.
