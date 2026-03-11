# Open Loops

## 1) Ask-Core Full Cutover Criteria

- Issue: Define the objective threshold for removing legacy ASK script checks from adapter wrappers and relying on ask-core only.
- Owner: ASK maintainers.
- Decision needed: What minimum parity matrix (commands, hooks, branch modes, release checks) is required before cutover.
- Current state: Adapters execute both legacy checks and ask-core contracts to prove migration without behavior loss.
- Default if no response: Keep dual-execution adapters and defer hard cutover until parity criteria are documented and validated.

## 2) Main Release Integration Path

- Issue: Choose merge strategy for phase-1 ask-core changes into protected release flow.
- Owner: ASK maintainers.
- Decision needed: Merge directly to `main` after review vs stage via release candidate branch.
- Current state: Feature work is complete in `ask-runtime` with verification evidence recorded.
- Default if no response: Request review, then merge to `main` with standard protected-branch checks.
