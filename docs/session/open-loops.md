# Open Loops

## 1) Maintainer Mode Extraction Timing

- Issue: Determine when to extract reusable maintainer-mode templates for downstream repos.
- Owner: ASK maintainers.
- Decision needed: Extract immediately vs wait for 1-2 release cycles of internal dogfooding.
- Current state: Branch-aware governance is implemented and tested in `agent-session-kit`; reusable extraction has not started.
- Default if no response: Keep extraction deferred until at least one more release cycle validates workflow stability.
