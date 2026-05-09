# ASK Forge Adapter Runtime Activation Plan

## Summary

Activate the v6 TypeScript contract foundation by adding a runtime-backed Node adapter boundary, project detection, and active adapter resolution. Keep implementation in JavaScript for compatibility while shaping runtime output to the existing TypeScript contracts.

## Slice 1: Node Adapter Wrapper

Create a Node language adapter module that exposes adapter metadata, capability descriptors, detection helpers, and command descriptors for the current Node/npm workflow. No existing CLI behavior changes in this slice.

Acceptance criteria:

- Node adapter exposes `adapterId: node`, `languageId: node`, capabilities, file globs, and command descriptors.
- TypeScript projects are detected from `tsconfig.json` or TypeScript package signals.
- JavaScript projects are detected from `package.json` without TypeScript signals.
- Unknown directories return stable unknown detection results.
- Existing CLI behavior remains unchanged.

## Slice 2: Project Detection CLI

Add `ask project detect` for stable, non-mutating project detection.

Acceptance criteria:

- Current ASK Forge repo is detected as Node/TypeScript.
- Output includes `ok`, `projectType`, `languageId`, `adapterId`, `profileId`, `packageManager`, `confidence`, `evidence`, and `warnings`.
- Package manager detection supports `pnpm`, `npm`, `yarn`, `bun`, and `unknown`.
- Lockfile precedence is `pnpm-lock.yaml`, `package-lock.json`, `yarn.lock`, then `bun.lockb`.
- Multiple lockfiles produce a warning while still choosing by precedence.
- Malformed `package.json` fails deterministically with code `project-detect-invalid-package-json`.
- Detection does not mutate project files.

## Slice 3: Active Adapter Resolution

Add `ask adapter resolve [--adapter node]` for explainable adapter selection.

Acceptance criteria:

- Explicit `--adapter node` resolves without relying on detection.
- Optional `.ask/project-profile.json` can resolve the active adapter.
- Detection fallback resolves the current repo to the Node adapter.
- Unsupported explicit adapters fail with code `adapter-not-supported` and `supportedAdapters: ["node"]`.
- Unknown projects fail with code `adapter-resolution-unknown-project`.
- Output includes `ok`, `adapterId`, `languageId`, `profileId`, `source`, `reason`, `capabilities`, `detection`, and `evidence`.
- Existing Node checks and hook enforcement continue to pass.

## Governance

Use ASK implementation governance:

- Prepare and commit ASK-ready plan artifacts.
- Ingest the plan as governed slices with prefix `ask-adapter`.
- Start and close each slice through ASK.
- Use test-first implementation.
- Run targeted tests, `npm run typecheck`, `npm run build`, and `npm test` where runtime/CLI behavior changes.

## Assumptions

- Runtime implementation remains JavaScript in this plan.
- Node/JavaScript is the only active adapter target.
- Non-Node adapter implementations are out of scope.
- No global strict TypeScript changes are included.
