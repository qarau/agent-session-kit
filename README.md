# ASK Forge

Governed Autonomous Software Development

## Runtime Status

Current release line: `v5.1.0`

ASK Forge is a Developer-Agent Runtime for governing long-running implementation sessions before code reaches remote CI. It enforces session and policy checks at commit/push boundaries and keeps runtime state reconstructable through an event ledger.

ASK is implemented in `ask-core/` and integrated through git hooks and session adapter wrappers.

## Best Use of ASK Forge

ASK Forge works best as the governance layer in a three-part autonomous development model:

- **ASK Forge = Governance Constitution**: defines the rules, lifecycle gates, slice contracts, policy checks, OHDER architecture validation, and replayable evidence trail.
- **Codex = Implementation Engine**: reads the governed plan and performs code, test, documentation, and refactor work inside the enforced ASK lifecycle.
- **Superpowers = Workflow Discipline**: supplies structured methods for brainstorming, planning, test-driven development, debugging, verification, and branch completion.

In this model, ASK does not replace Codex or Superpowers. ASK governs the software delivery lifecycle so Codex can implement with clear boundaries and Superpowers can provide repeatable development practices.

When a user chooses "Implement the plan", the implementation boundary is `ask implementation begin --plan <md> --title <title>` before Codex edits code.

## Why 5.0.0 Is Special

`v5.0.0` is the release where ASK moves from "runtime checks around coding" to a governed autonomous delivery loop.

- plans can be ingested into runtime-governed slices (`ask plan ingest`) instead of staying as static docs
- slice execution has an explicit governed close contract (`ask slice close`) with OHDER architecture governance, verify/complete/commit/push validation gates
- push lineage is enforced through `ASK-Slice` or `ASK-Exempt` metadata checks at pre-push
- Codex runtime controls, architect/flow/design governance runtimes, and ASK Forge branding make the autonomous governance model explicit
- delivery and coordination runtime surfaces (feature/release/promote/rollout + route/claim/agent/child-session) move ASK from policy helper to end-to-end governed execution control plane

In short: 4.x proved runtime governance works; 5.0.0 turns that governance into an operational execution system.

## Why 5.1.0 Is Special

`v5.1.0` is the OHDER Semantic Autonomy release. It moves ASK Forge from architecture checks and refactor suggestions toward semantic, evidence-backed architecture governance.

What changed:

- `semanticFacts` normalize analyzer evidence across OHDER laws, architecture scoring, and future automation.
- `ask governance validate` is now the explicit mutating governance refresh command; it recomputes architecture/entropy evidence and writes a replayable governance decision.
- OHDER refactor recommendations now include a ranked `targetPortfolio` with confidence, blast radius, freshness, reasons, and related slice evidence.
- `ohder_autonomy` can create bounded refactor tasks when policy allows, but ASK still does not apply patches automatically.
- `OhderPatchReadinessGate` can say whether a future autonomous patch is safe to consider while keeping `patchExecutionAllowed: false`.
- `architectureReview` adds a deterministic `council-lite` envelope with survivability, replayability, security, durability, and replaceability perspectives.

In short: 5.0 made ASK Forge an execution control plane; 5.1 makes OHDER smarter, more semantic, and more explicit about the boundary between task autonomy and future patch autonomy.

## What Changed in 5.0.0 (from 4.x)

ASK 4.x established a runtime-first governance layer (`ask-core`) with hook-enforced policy gates and governed execution controls.
ASK Forge 5.0.0 extends this into governed autonomous software development by adding:

- plan ingestion runtime (`ask plan ingest|validate|batch show`) that materializes deterministic governed slices from planning artifacts
- governed slice close flow (`ask slice close <taskId>`) for OHDER validation + auto verify + auto complete + auto commit + pre-push validation
- architect governance runtime (`ask architect ...`) integrated with OHDER law-pack decisions and exemption controls
- flow and design governance runtimes (`ask flow ...`, `ask design ...`) for behavior continuity and visual drift control
- coordination runtime (`ask route ...`, `ask claim ...`, `ask child-session ...`, `ask agent ...`) for governed multi-agent execution routing
- delivery runtime (`ask feature ...`, `ask release ...`, `ask promote ...`, `ask rollout ...`, `ask rollback ...`) for release-lifecycle governance
- stronger pre-push slice traceability (`ASK-Slice` / `ASK-Exempt`) for auditable execution lineage
- brand evolution to **ASK Forge** with the explicit autonomous-governance product direction

For developers, this means less tooling sprawl, clearer enforcement boundaries, and a more explicit operating model for long-running AI-assisted delivery.

## What ASK Forge Is

ASK is a runtime discipline layer for AI-assisted software delivery. It gives teams:

- deterministic session and task lifecycle signals
- policy-aware preflight and commit readiness checks
- commit/push guard enforcement through hooks
- replayable runtime history via `.ask/runtime/events.ndjson`
- projection snapshots for operational visibility

In practical terms, ASK reduces avoidable integration mistakes by enforcing the same checks locally that teams usually discover too late in CI.

## Why Teams Use It

Without explicit runtime governance, agent sessions drift: context mismatches, stale verification, and weak handoff continuity. ASK addresses this by coupling workflow commands with policy gates.

Developer outcomes:

- safer day-to-day commit/push behavior
- consistent policy behavior across contributors and machines
- faster resume/recovery for long-running sessions
- clearer evidence trail for merge readiness

## ASK Forge 5 Architecture at a Glance

- `ask-core/`: runtime engine + CLI command surface
- `.ask/`: runtime state directory generated at execution time
- `.githooks/pre-commit`, `.githooks/commit-msg`, and `.githooks/pre-push`: enforcement entrypoints
- `scripts/session/runAskCorePreCommitAdapter.mjs`, `scripts/session/runAskCoreCommitMsgAdapter.mjs`, and `scripts/session/runAskCorePrePushAdapter.mjs`: wrapper adapters called by hooks
- `scripts/session/installHooks.mjs`: hook activation helper (`core.hooksPath=.githooks`)

Core runtime layers active in v5:

- ASK runtime: session lifecycle, task/slice orchestration, continuation state
- Projection runtime: event replay, snapshot hydration, continuity proofs
- Architect runtime: OHDER governance law evaluation, hard/soft law taxonomy, architecture scoring, and exemptions
- Analyzer runtime: coupling, durability, authority, security boundary, and complexity/SRP analysis for changed files
- Semantic fact runtime: normalized `semanticFacts` with confidence, severity, source, evidence, and recommendations
- OHDER finding resolution runtime: stable finding IDs, evidence packs, false-positive adjudication, and record-only resolution history
- Flow runtime: protected/hard-flow continuity governance
- Design runtime: visual continuity and drift governance
- Ingestion runtime: plan-to-slice materialization and batch traceability
- Refactor execution planner: concrete, approval-aware refactor plans derived from OHDER findings
- OHDER semantic autonomy runtime: ranked `targetPortfolio`, `ohder_autonomy`, `OhderPatchReadinessGate`, and `council-lite` architecture review
- Delivery runtime: feature/release/promotion/rollout governance

## Prerequisites

- Node.js 20+
- Git

## Quick Start (Inside This Repository)

```bash
npm test
node ask-core/bin/ask.js --help
node ask-core/bin/ask.js preflight
node ask-core/bin/ask.js can-commit
node ask-core/bin/ask.js implementation begin --plan <md> --title <title>
node ask-core/bin/ask.js plan-mode handoff --title <title> --source <md> --plan-json <json>
node ask-core/bin/ask.js implementation preflight
# shorthand: ask plan-mode handoff
```

Enable hooks:

```bash
npm run session:hooks:install
git config --get core.hooksPath
```

Expected output:

```text
.githooks
```

## Operations Docs

Operational runtime guidance lives in:

- `docs/operations/README.md`
- `docs/operations/runtime-architecture.md`
- `docs/operations/policy-reference.md`
- `docs/operations/operator-playbooks.md`
- `docs/operations/ohder-finding-resolution-runtime.md`
- `docs/operations/plan-mode-handoff-governance.md`
- `docs/operations/future-ohder-runtime.md`

## Adopt ASK Forge in Another Repository (Vendor Copy + Hooks)

ASK Forge 5 currently uses a vendor-copy model. Copy these assets into your target repository:

- `ask-core/`
- `.githooks/`
- `scripts/session/installHooks.mjs`
- `scripts/session/runAskCorePreCommitAdapter.mjs`
- `scripts/session/runAskCorePrePushAdapter.mjs`

Then in the target repo:

```bash
node scripts/session/installHooks.mjs
node ask-core/bin/ask.js init
```

Optional validation:

```bash
node scripts/session/runAskCorePreCommitAdapter.mjs
node scripts/session/runAskCorePrePushAdapter.mjs
```

## Git Hook Enforcement Contract

ASK hook enforcement is intentionally explicit and stable:

- `.githooks/pre-commit` executes `node scripts/session/runAskCorePreCommitAdapter.mjs`
- `.githooks/commit-msg` executes `node scripts/session/runAskCoreCommitMsgAdapter.mjs`
- `.githooks/pre-push` executes `node scripts/session/runAskCorePrePushAdapter.mjs`
- adapters execute `ask init`, `ask context verify`, then gate checks (`ask pre-commit-check` / `ask pre-push-check`)

A non-zero adapter exit blocks the git operation.

## CLI Command Catalog (Grouped)

Run all commands via:

```bash
node ask-core/bin/ask.js <command>
```

Session and context:

- `ask init [--reset-runtime]`
- `ask session start|pause|resume|block|status|close|doctor`
- `ask context verify|status`

Policy and commit readiness:

- `ask preflight`
- `ask can-commit`
- `ask pre-commit-check`
- `ask pre-push-check`

Task, workflow, and continuity:

- `ask task create|assign|start|complete|reopen|depends|status`
- `ask plan ingest --task <taskId> --run-id <runId> [--path <file>] [--force-new-batch] [--dry-run]`
- `ask plan validate --task <taskId> --run-id <runId> [--path <file>] [--force-new-batch]`
- `ask plan batch show <planBatchId>`
- `ask slice preview|close`
- `ask refactor preview|create|approve|reject`
- `ask governance status|explain|validate`
- `ask architect finding list|explain|resolve`
- `ask workflow recommend|start|artifact|complete|fail`
- `ask flow list|status|discover --last|validate --last|promote ...`
- `ask design list|status|discover --last|validate --last|promote ...`
- `ask continue`, `ask project-state`, `ask resume-packet show`, `ask metrics show`

Coordination and routing:

- `ask route recommend|status`
- `ask claim acquire|release|lock|status`
- `ask child-session spawn|status`
- `ask agent register|status|dispatch`

Delivery governance:

- `ask feature create|link-task|status`
- `ask release create|link-feature|status`
- `ask promote require|pass|advance|status`
- `ask rollout start|phase|status`
- `ask rollback trigger`

Codex-specific controls:

- `ask codex [launch] ...`
- `ask codex direct --reason <text> ...`
- `ask codex context status|ensure|compact`

## Recommended Developer Flow

1. `ask init`
2. `ask session start`
3. `ask context verify`
4. Implement work and track runtime artifacts
5. `ask preflight` and `ask can-commit`
6. Close each slice with `ask slice close <taskId>` (OHDER governance + auto verify + auto complete + auto commit + pre-push-check)
7. Use `ask next` between slices to select the next task or OHDER-driven next action
8. Push with hooks enforcing final gates

## OHDER-Driven Next Actions

`ask next` is task-first: in-progress tasks and dependency-ready created tasks always take precedence. When no task is available, ASK asks OHDER what architecture governance requires next and returns `next.type: "ohder-action"` instead of stale runtime text.

OHDER-driven next actions:

- `resolve-architecture-block`: an architect hard-law or blocking status must be resolved before normal continuation.
- `create-refactor-slice`: refactor governance, high `refactorPressure`, or regressing entropy trend requires a focused architecture repair slice before more feature work.
- `run-governance-validation`: replayability risk, medium `refactorPressure`, low architecture score, or a blocked governance decision requires validation before choosing new work.
- `await-new-requirement`: architecture governance is clear and ASK is ready for a new requirement.

When the action is `create-refactor-slice`, `ask next` now includes a compact `refactorRecommendation` and the concrete command `ask refactor preview` by default. If policy explicitly enables automatic high-confidence materialization, the command becomes `ask refactor create --auto`.

Each OHDER fallback recommendation emits `OhderNextActionRecommended` into the runtime ledger with a compact entropy summary when entropy data is available. The command does not mutate task state when it recommends an OHDER action.

## OHDER Entropy Runtime

The OHDER Entropy Runtime tracks whether governed development is making the codebase healthier or more chaotic over time. `ask slice close <taskId>` records entropy after the OHDER architect assessment and before auto verification, completion, and commit.

Slice-close entropy capture emits:

- `EntropyImpactMeasured`
- `EntropyTrendChanged`

Entropy history is written to `.ask/runtime/metrics-history.ndjson` and surfaced through:

```bash
node ask-core/bin/ask.js metrics show --history 20
```

Key fields are `entropyScore`, `refactorPressure`, `architectureScoreDelta`, `couplingTrend`, and `replayabilityTrend`. `ask next` uses these signals when no task is ready: high pressure or regressing trend recommends a refactor only when ASK can identify a concrete target; medium pressure recommends `run-governance-validation`; clear entropy allows `await-new-requirement`.

## OHDER Deep Analyzer Runtime

The OHDER architect runtime now includes deterministic analyzers that explain why a slice changes architectural pressure. The goal is not just to say "entropy increased"; the goal is to show which runtime quality moved and what an operator should do next.

Architect status can now include:

- `couplingAnalysis`: touched runtime layers, cross-layer imports, coupling hotspots, and layer-discipline risk.
- `durabilityAnalysis`: projector, snapshot, ledger, sequence, policy, and migration touchpoints that may require replay validation.
- `authorityAnalysis`: governed-state write authority checks, including direct `.ask` runtime writes outside approved projection, ledger, sequence, or snapshot authorities.
- `securityAnalysis`: auth, token, permission, session, credential, and bypass-sensitive change detection with matching-test guardrail checks.
- `complexityAnalysis`: file size, branch pressure, concern mixing, and SRP risk for changed source files.

These analyzers feed the weighted `architectureScore` categories:

- Coupling risk affects `layerDiscipline`.
- Durability risk affects `durability`.
- Authority violations affect `ssotIntegrity`.
- Complexity/SRP risk affects `testability` and `replaceability`.

Example: if a slice changes `ask-core/src/runtime/projectors/TaskBoardProjector.js`, OHDER can mark the slice as durability-sensitive because projection snapshots may need replay validation. If a core runtime imports a CLI command directly, OHDER can mark the slice as a coupling risk because the domain layer now depends on an outer orchestration layer. If a slice changes auth or token handling without matching tests, OHDER can mark the security boundary as invalid in strict governance.

Future-facing OHDER capabilities are tracked separately in `docs/operations/future-ohder-runtime.md` so current, partial, planned, and future runtime behavior stays explicit.

## OHDER Refactor Governance Materialization

OHDER Refactor Governance Materialization is the bridge between architecture pressure and executable ASK work. Entropy and architect signals no longer stop at "create a refactor slice" text; ASK can now generate a deterministic recommendation and materialize it into a normal governed task.

In the targeted refactor flow, ASK does not keep repeating the same generic entropy recommendation. It reads recent slice commits, `ASK-Slice` footers, changed files, entropy history, and completed OHDER refactor tasks to select a concrete hotspot target. The recommendation fingerprint includes that target, so a new target becomes a new governed task while a completed target is skipped.

The refactor execution planner turns recommendations and analyzer findings into concrete plan actions without applying patches automatically:

- documentation targets become `split-doc-section` plans
- cross-layer coupling findings become `reduce-cross-layer-import` plans
- high-risk plans require approval before execution
- the generated `refactorExecutionPlan` is embedded into refactor task metadata for replayability

If entropy is regressing but ASK cannot discover a new concrete target, `ask refactor preview` returns `recommendation: null` with `suppression.reason: "no-new-refactor-target"`. In that state, `ask next` recommends `run-governance-validation` instead of another vague refactor slice.

Operator flow:

```bash
node ask-core/bin/ask.js next
node ask-core/bin/ask.js refactor preview
node ask-core/bin/ask.js refactor create
node ask-core/bin/ask.js refactor approve <taskId> --approved-by <id>
node ask-core/bin/ask.js refactor reject <taskId> --reason "too risky"
```

Confidence governance:

- `low`: suggest-only; no task is created by `ask refactor create`.
- `medium`: creates an approval-required governed task with `refactorGovernance.approvalStatus: "pending"`.
- `high`: explicit `ask refactor create` creates a governed task; automatic creation only happens when policy enables `refactor_materialization.auto_materialize_high_confidence`.

Replayable events:

- `RefactorSuggested`: a recommendation was materialized into a task.
- `RefactorApproved`: an approval-required refactor task was approved.
- `RefactorRejected`: a refactor task was rejected and blocked.

The created task includes the recommendation title, objective, reason, concrete target, target signals, acceptance criteria, confidence, recommendation fingerprint, and refactor execution plan. It still closes through `ask slice close <taskId>`, so OHDER validation, full-suite checks, auto commit, and pre-push validation remain enforced.

## OHDER Slice-Close Governance

`ask slice close <taskId>` now runs OHDER architect governance before ASK marks the task verified, completed, or committed.

Close order:

1. Session/context preflight
2. Required full-suite checks for protected lanes
3. Can-commit evidence gate
4. Dirty-index guard
5. OHDER architect assessment
6. ASK verification
7. Task completion
8. `ASK-Slice` commit
9. Pre-push governance check

If OHDER reports a blocking hard-law violation, slice close returns `slice-close-ohder-blocked`, keeps the task `in-progress`, emits architectural replayability events, and creates no commit.

Inspect OHDER state with:

```bash
node ask-core/bin/ask.js architect status
node ask-core/bin/ask.js governance explain
node ask-core/bin/ask.js architect finding list
```

## OHDER Finding Resolution Runtime

OHDER findings are architecture risk claims backed by evidence. They can be wrong, stale, or too broad. ASK Forge now gives those claims stable IDs and a governed adjudication path:

```bash
node ask-core/bin/ask.js architect finding list
node ask-core/bin/ask.js architect finding explain <finding-id>
node ask-core/bin/ask.js architect finding resolve <finding-id> \
  --decision false-positive \
  --reason "Analyzer matched fixture-only token text" \
  --approved-by "architect"
```

V1 is intentionally record-only. A false-positive or tune-analyzer decision becomes replayable governance memory, but it does not silently suppress OHDER blocking. Use explicit law-pack exemptions for approved temporary hard-law bypasses.

Architect status includes an `architectureScore` with weighted categories for SSoT integrity, replayability, layer discipline, durability, testability, security, observability, and replaceability. The score is telemetry; hard-law blocking still takes precedence.

## Runtime State and Source Control

- ASK runtime state is generated under `.ask/`.
- Volatile runtime logs and snapshots should remain excluded from version control.
- Keep static policy/configuration files as needed by your team.

## v4 to v5 Migration Notes

v5 keeps v4 runtime governance and hook enforcement, then adds governed ingestion-to-slice execution flow.
The shift is intentional: v5 moves from "governed runtime checks" to "governed autonomous execution lifecycle."

Key changes from v4:

- Added governed plan ingestion (`ask plan ingest|validate|batch show`)
- Added governed slice close path (`ask slice close <taskId>`) with OHDER architecture validation before auto-complete and auto-commit
- Added explicit architect/flow/design governance runtime surfaces (`ask architect ...`, `ask flow ...`, `ask design ...`)
- Added coordination and delivery governance runtimes (`ask route|claim|child-session|agent ...`, `ask feature|release|promote|rollout|rollback ...`)
- Enforced pre-push lineage metadata (`ASK-Slice` / `ASK-Exempt`)
- Expanded Codex runtime controls (`ask codex ...`) as first-class governed surfaces
- Repositioned product identity to ASK Forge (Governed Autonomous Software Development)

Migration checklist for v4 users:

1. Vendor-copy the v5 assets listed in "Adopt ASK Forge in Another Repository".
2. Run `ask plan validate` and `ask plan ingest` for governed plan-to-slice execution.
3. Run `node scripts/session/installHooks.mjs` in each target repo.
4. Validate `core.hooksPath` is `.githooks`.
5. Verify workflow with `ask preflight`, `ask can-commit`, `ask slice close`, and pre-push lineage gates.

## Local Development

```bash
npm test
npm run ask
npm run ask:preflight
npm run ask:can-commit
npm run ask:pre-commit-check
npm run ask:pre-push-check
```

## Open Source Files

- `LICENSE` (MIT)
- `CONTRIBUTING.md`
- `CODE_OF_CONDUCT.md`
- `SECURITY.md`




