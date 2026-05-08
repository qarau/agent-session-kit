# OHDER Finding Resolution Runtime

OFRR is the record-only adjudication layer for OHDER architecture findings.

OHDER analyzers produce claims about architectural risk. OFRR gives those claims stable identity, evidence, resolution history, and replayable governance memory. It does not make every analyzer warning true, and it does not silently suppress governance.

## V1 Boundary

Implemented in v1:

- stable finding IDs
- `.ask/runtime/ohder-findings.json`
- immutable evidence packs under `.ask/runtime/findings/evidence/`
- resolution history under `.ask/runtime/findings/history/`
- false-positive metrics under `.ask/runtime/ohder-finding-metrics.json`
- `ask architect finding list`
- `ask architect finding explain <finding-id>`
- `ask architect finding resolve <finding-id> ...`
- `ask governance explain` visibility for unresolved and resolved findings
- `ask next` fallback to finding inspection when no task is ready

Not implemented in v1:

- automatic suppression
- blocking bypass from false-positive decisions
- dynamic analyzer confidence weighting
- automatic law tuning
- automatic repair generation

Existing law-pack exemptions remain the only v1 path for temporarily bypassing hard-law blocking.

## Operator Flow

```bash
node ask-core/bin/ask.js governance validate
node ask-core/bin/ask.js architect finding list
node ask-core/bin/ask.js architect finding explain <finding-id>
node ask-core/bin/ask.js architect finding resolve <finding-id> \
  --decision false-positive \
  --reason "Security token string appears only in a deterministic fixture" \
  --approved-by "architect"
node ask-core/bin/ask.js governance explain
```

Use `false-positive` only when the analyzer claim is wrong. Use `justified-risk` when the risk is real but intentionally accepted for a time-boxed period. Use `exempt` when a hard-law bypass is approved separately. Use `tune-law` or `tune-analyzer` when the governance system itself needs improvement.

## Resolution Decisions

- `fix-planned`: valid finding; repair work is planned.
- `false-positive`: analyzer fired incorrectly; record noise without bypassing v1 governance.
- `justified-risk`: real risk accepted temporarily; requires `--expires-at`.
- `exempt`: temporary governance bypass decision record; requires `--expires-at`.
- `tune-law`: law threshold or mapping likely needs adjustment.
- `tune-analyzer`: analyzer heuristic likely needs adjustment.

## Replay Events

OFRR writes to the existing ASK runtime ledger at `.ask/runtime/events.ndjson`.

Events include:

- `OhderFindingDetected`
- `OhderFindingFingerprintAssigned`
- `OhderFindingEvidenceAttached`
- `OhderFindingResolved`
- `OhderFindingSuppressed`
- `OhderFindingExempted`
- `OhderFindingAcceptedRisk`
- `OhderLawTuningRequested`
- `OhderAnalyzerTuningRequested`

The projection file is a disposable cache. Runtime state must be rebuildable from ledger events.
