# OHDER Refactor Recommendation Targeting

## Goal

Make ASK Forge produce specific, non-repeating OHDER refactor recommendations.

The current recommendation engine can detect broad entropy pressure, but it does not select a concrete target. As a result, `ask refactor preview` keeps producing the same generic recommendation and fingerprint while entropy remains regressing.

## Runtime Direction

ASK should turn broad OHDER entropy pressure into a governed refactor target using runtime evidence:

- recent ASK slice commits and changed files
- metrics history and refactor pressure
- completed OHDER refactor tasks
- existing architect, entropy, and refactor governance signals

If ASK cannot discover a new concrete target, it should suppress the generic refactor recommendation and route the operator toward governance validation or new evidence. It should not keep materializing vague refactor work.

## Implementation Slices

1. Add a pure refactor target discovery engine.
2. Integrate target selection into recommendation fingerprints.
3. Persist target metadata through refactor materialization and next-action output.
4. Document targeted OHDER refactor governance.

## Acceptance

- A regressing entropy state can produce a concrete file or runtime hotspot target.
- Different targets produce different recommendation fingerprints.
- Completed refactor targets are skipped.
- No new target means no generic refactor task.
- `ask next` recommends governance validation instead of repeated generic refactor previews when target discovery is exhausted.
- All tests and ASK gates pass.
