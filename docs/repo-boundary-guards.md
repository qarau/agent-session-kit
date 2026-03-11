# Repo Boundary Guards

Use this extension when your repository architecture has boundaries that must not drift over time.

Examples:

- extracted toolkit must remain external (not re-embedded)
- generated output must not be committed
- legacy directories must stay removed
- package boundaries must not be collapsed

## Why this matters

Branch/worktree guardrails protect process integrity. Repo boundary guards protect architecture integrity.

Together they reduce regressions caused by long AI-assisted sessions, context drift, and cross-repo transitions.

## Guard Pattern

1. Define forbidden paths.
2. Add a test that fails when those paths exist.
3. Run that test in your standard CI gate (`test:runtime` or `test:architecture`).
4. Document policy in `docs/session/open-loops.md`.
5. Keep protected branches fail-closed (`main`/`release/*`) and feature branches advisory.

## Vitest Template

```ts
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

function existsNormalized(targetPath: string): boolean {
  return fs.existsSync(targetPath);
}

describe('repo boundaries', () => {
  it('forbids embedded toolkit path', () => {
    const repoRoot = process.cwd();
    const forbidden = path.resolve(repoRoot, 'agent-session-kit');
    expect(existsNormalized(forbidden)).toBe(false);
  });
});
```

## Enterprise Guidance

- Start with one high-risk boundary assertion and expand only when needed.
- Keep boundary tests deterministic (no network, no time dependence).
- Treat failures as governance regressions, not flaky tests.
- Keep path decisions explicit in session docs so resumes stay aligned.
- Keep local runtime scratch paths (for example `docs/ASK_Runtime/*`) out of tracked history.
