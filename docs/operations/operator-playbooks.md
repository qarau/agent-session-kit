# Operator Playbooks

## Daily Start

1. Initialize and verify context:
   - `node ask-core/bin/ask.js init`
   - `node ask-core/bin/ask.js session start`
   - `node ask-core/bin/ask.js context verify`
2. Confirm governance state:
   - `node ask-core/bin/ask.js governance status`
   - `node ask-core/bin/ask.js next`
3. Start the next task from `ask next`, or follow the OHDER-driven next action when no task is available.

## OHDER-Driven Next Action Playbook

`ask next` selects tasks first. If it returns `next.type: "ohder-action"`, do not start unrelated feature work until the recommendation is handled.

Action responses:

- `resolve-architecture-block`: run `node ask-core/bin/ask.js architect status` and `node ask-core/bin/ask.js governance explain`, then fix the blocking law violation or use an approved short-lived exemption.
- `create-refactor-slice`: create or ingest a focused refactor slice that reduces entropy/coupling or restores replayability before continuing feature work.
- `run-governance-validation`: run `node ask-core/bin/ask.js governance status`, `node ask-core/bin/ask.js architect status`, and relevant tests before asking for the next task again.
- `await-new-requirement`: architecture governance is clear; add or ingest the next product requirement.

OHDER-driven next actions are advisory task-selection outputs. They emit `OhderNextActionRecommended` for replayability but do not mutate the task board.

## Executing a Governed Loop

Use governed continuation for checkpointed execution:

- `node ask-core/bin/ask.js continue --once`

If blocked:

1. Run `node ask-core/bin/ask.js governance explain`
2. Inspect `node ask-core/bin/ask.js project-state`
3. Resolve policy blockers (dirty worktree, missing evidence, flow/architect violations)
4. Resume session if needed:
   - `node ask-core/bin/ask.js session resume --reason "..."`.

## Flow Governance Operations

Inspect flows:

- `node ask-core/bin/ask.js flow list`
- `node ask-core/bin/ask.js flow status`
- `node ask-core/bin/ask.js flow discover --last`

Promote lifecycle stages (sequential only):

- `node ask-core/bin/ask.js flow promote <flow-id> --to observed --reason "..."`
- `node ask-core/bin/ask.js flow promote <flow-id> --to accepted --reason "..."`
- `node ask-core/bin/ask.js flow promote <flow-id> --to protected --reason "..." --approved-by <id>`
- `node ask-core/bin/ask.js flow promote <flow-id> --to hard-flow --reason "..." --approved-by <id> --approval-ticket <ticket>`

## Design Governance Operations

Inspect design runtime state:

- `node ask-core/bin/ask.js design list`
- `node ask-core/bin/ask.js design status`
- `node ask-core/bin/ask.js design discover --last`
- `node ask-core/bin/ask.js design validate --last`

Promote design lifecycle stages (sequential only):

- `node ask-core/bin/ask.js design promote <region-id> --to emerging --reason "..."`
- `node ask-core/bin/ask.js design promote <region-id> --to guided --reason "..."`
- `node ask-core/bin/ask.js design promote <region-id> --to standardized --reason "..." --approved-by <id>`
- `node ask-core/bin/ask.js design promote <region-id> --to protected --reason "..." --approved-by <id> --approval-ticket <ticket>`

In governance-light mode, design violations are warning-level and do not block continuation.

## Architect Governance Operations

Inspect architect status:

- `node ask-core/bin/ask.js architect status`
- `node ask-core/bin/ask.js governance explain`

Review the `architectureScore` fields:

- `overallScore`
- `grade`
- category scores for SSoT integrity, replayability, layer discipline, durability, testability, security, observability, and replaceability

Manage temporary exemptions:

- Add: `node ask-core/bin/ask.js architect exempt add --law-id <id> --reason "<text>" --approved-by <id> [--operation <name>] [--session-id <id>] [--expires-at <iso>]`
- List: `node ask-core/bin/ask.js architect exempt list`

Use exemptions as short-lived operational controls, not permanent policy.

## Metrics and Drift Monitoring

Inspect latest metrics and trends:

- `node ask-core/bin/ask.js metrics show`
- `node ask-core/bin/ask.js metrics show --history 20`

Watch:

- `driftAnalytics.overall.trend`
- `architectureDriftScore`
- `behaviorDriftScore`
- latest `history[].entropyScore`
- latest `history[].refactorPressure`
- latest `history[].architectureScoreDelta`
- hard-flow/protected-flow violation trend

Entropy events:

- `EntropyImpactMeasured`: a slice-close OHDER assessment was converted into entropy history.
- `EntropyTrendChanged`: the architecture trend changed or the first slice-close entropy record was created.

Escalation rules:

- If `refactorPressure` is `high`, create or ingest a focused refactor slice.
- If `refactorPressure` is `medium`, run governance validation before selecting new feature work.
- If `driftAnalytics.overall.trend` is `regressing` across multiple windows, stop feature expansion and reduce entropy first.

## Pre-Commit and Pre-Push Guard Failures

1. Run:
   - `node ask-core/bin/ask.js pre-commit-check`
   - `node ask-core/bin/ask.js pre-push-check`
2. Record missing evidence if needed:
   - `node ask-core/bin/ask.js evidence checks record --tests-passed true|false --docs-fresh true|false --checks "<csv>" --source "<id>"`
3. Re-run checks until gates pass.

Pre-push traceability gate:

- Normal commits must include exactly one footer: `ASK-Slice: <taskId>`.
- Non-slice commits must include exactly one exemption footer: `ASK-Exempt: release` or `ASK-Exempt: meta`.
- Exemption commits must stay within release/meta file scope.

## Slice Close Playbook (Auto Complete + Auto Commit)

1. Ensure task is `in-progress` and evidence gates are healthy.
2. Run `node ask-core/bin/ask.js slice close <taskId>`.
3. Runtime flow:
   - session/context preflight
   - required full suite for protected lanes
   - can-commit evidence gate
   - dirty-index guard
   - OHDER architect governance
   - auto verification pass
   - auto task completion
   - auto commit with `ASK-Slice: <taskId>`
   - auto `pre-push-check`
4. Failure semantics:
   - OHDER block: task remains `in-progress`, no commit is created, inspect `ask architect status`
   - commit failure: task auto-reopens to `in-progress`
   - pre-push failure after commit: task remains `completed` and session blocks pending remediation

When OHDER blocks slice close:

1. Read the returned `architect.findings` and `architect.lawViolations`.
2. Run `node ask-core/bin/ask.js architect status`.
3. Run `node ask-core/bin/ask.js governance explain`.
4. Fix the architecture issue, reduce the slice scope, or add a short-lived exemption only when approved.
5. Re-run validation and `ask slice close <taskId>`.

## Plan Ingestion Playbook

1. Attach a planning artifact through workflow runtime:
   - `node ask-core/bin/ask.js workflow artifact <taskId> --run-id <runId> --type plan --path <json-path>`
2. Validate plan ingest contract:
   - `node ask-core/bin/ask.js plan validate --task <taskId> --run-id <runId>`
3. Materialize governed slices:
   - `node ask-core/bin/ask.js plan ingest --task <taskId> --run-id <runId>`
4. Execute through normal governance:
   - `node ask-core/bin/ask.js next`

## Incident Playbook: Governance Block

When session is blocked:

1. `node ask-core/bin/ask.js session status`
2. `node ask-core/bin/ask.js governance explain`
3. `node ask-core/bin/ask.js project-state`
4. Resolve root cause:
   - dirty worktree gating
   - failed architect laws
   - slice-close OHDER block
   - hard-flow behavior replay regressions
   - refactor revalidation failure
5. Resume:
   - `node ask-core/bin/ask.js session resume --reason "Governance issue resolved"`

## Release Readiness Playbook

1. Confirm no unresolved governance blocks:
   - `node ask-core/bin/ask.js governance status`
2. Confirm metrics and drift trend:
   - `node ask-core/bin/ask.js metrics show --history 20`
3. Run final gates:
   - `node ask-core/bin/ask.js preflight`
   - `node ask-core/bin/ask.js can-commit`
   - `node ask-core/bin/ask.js pre-commit-check`
   - `node ask-core/bin/ask.js pre-push-check`
