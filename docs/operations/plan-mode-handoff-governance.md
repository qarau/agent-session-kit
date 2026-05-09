# Plan Mode Handoff Governance

ASK Forge uses Plan Mode handoff to prevent implementation from starting from an ungoverned written plan. The handoff boundary is explicit: Codex or Superpowers can write a plan, but ASK must ingest it before development begins.

## Roles

- **ASK Forge = Governance Constitution**: owns the lifecycle rules, plan ingestion, slice queue, implementation preflight, OHDER validation, findings, hook enforcement, and commit provenance.
- **Codex = Implementation Engine**: performs code, test, documentation, and refactor work only after ASK presents and starts a governed slice.
- **Superpowers = Workflow Discipline**: supplies planning, TDD, debugging, verification, and branch-completion methods that feed plans and evidence into ASK.

ASK does not replace Codex or Superpowers. ASK makes their output governable, replayable, and auditable.

## Automatic Implementation Boundary

When the operator chooses **Implement the plan**, Codex or Superpowers must call ASK before editing:

```bash
node ask-core/bin/ask.js implementation begin --plan <md> --title <title>
```

The adapter entrypoint for automation is:

```bash
node scripts/session/runAskImplementationBeginAdapter.mjs --plan <md> --title <title>
```

This command prepares canonical markdown and JSON plan artifacts, commits those artifacts as the session's ready-plan commit, hands them to ASK, ingests governed slices, and returns the next `ask task start <taskId>` command. Direct editing before this boundary remains a governance bypass.

## Governed Flow

1. Write or receive the plan as markdown.
2. Run `ask implementation begin --plan <md> --title <title>` before editing.
3. ASK converts the plan into canonical markdown and structured ASK plan JSON artifacts.
4. ASK runs `ask ready-plan commit --title <title> --source <md> --plan-json <json>` against the canonical artifacts.
5. Git records the ready-plan commit with `ASK-Plan: <planId>` provenance.
6. ASK hands both artifacts to Plan Mode handoff.
7. ASK records workflow artifacts, validates the plan, and ingests slices.
8. Run `ask next` to see the next governed slice.
9. Start the slice with `ask task start <taskId>`.
10. Codex implements the slice.
11. Run validation as needed during development.
12. Close with `ask slice close <taskId>` so ASK runs full suite validation, OHDER governance, task completion, commit creation, and pre-push validation.
13. The resulting implementation commit carries `ASK-Slice: <taskId>` provenance.

## Ready-Plan Commit

The ready-plan commit is the historical marker for what the development session was about before implementation starts. It commits only the canonical markdown plan and its `.plan.json` artifact under `docs/plans/`.

```bash
node ask-core/bin/ask.js ready-plan commit --title <title> --source <md> --plan-json <json>
```

The commit message shape is:

```text
chore(plan): ready <title>

ASK-Plan: <planId>
ASK-Plan-Markdown: docs/plans/<plan>.md
ASK-Plan-JSON: docs/plans/<plan>.plan.json
```

`ask implementation begin` runs this command automatically after prepare and before handoff. Re-running it does not create a duplicate commit when the canonical artifacts are unchanged.

The intended git history shape is:

```text
chore(plan): ready <title>
ASK-Plan: <planId>

chore(slice): close <taskId>
ASK-Slice: <taskId>
```

That history makes each session readable: first the plan intent, then each governed slice that implemented it.

## Example Handoff

```bash
node ask-core/bin/ask.js task create plan-source --title "Runtime enforcement plan"
node ask-core/bin/ask.js workflow start plan-source --workflow superpowers --skill writing-plans --run-id plan-run
node ask-core/bin/ask.js workflow artifact plan-source --run-id plan-run --type plan --path docs/plans/runtime-enforcement.plan.json --summary "Structured implementation plan"
node ask-core/bin/ask.js plan validate --task plan-source --run-id plan-run --path docs/plans/runtime-enforcement.plan.json
node ask-core/bin/ask.js plan ingest --task plan-source --run-id plan-run --path docs/plans/runtime-enforcement.plan.json
```

The explicit validation and ingestion commands are `ask plan validate` and `ask plan ingest`. The shorter operator command does the same lifecycle in one place:

Shorthand: `ask plan-mode handoff`.

```bash
node ask-core/bin/ask.js plan-mode handoff \
  --title "Runtime enforcement plan" \
  --source docs/plans/runtime-enforcement.md \
  --plan-json docs/plans/runtime-enforcement.plan.json \
  --task plan-source \
  --run-id plan-run \
  --workflow superpowers \
  --skill writing-plans
```

## Starting Work

After handoff, ASK owns the slice queue:

```bash
node ask-core/bin/ask.js next
node ask-core/bin/ask.js task start pmh-001
node ask-core/bin/ask.js implementation preflight
```

`ask next` reports pending handoff errors, the next generated task, and the exact `ask task start <taskId>` command when implementation has not started.

`ask implementation preflight` blocks when a plan has not been handed off or when no active ASK slice exists. Use `--advisory` for non-Plan-Mode maintenance checks that should warn without blocking.

## Closing Work

Do not manually commit implementation slices. Close the active ASK slice:

```bash
node ask-core/bin/ask.js slice close pmh-001
```

Slice close runs the governed completion loop:

- full-suite validation for integrator/protected lanes
- OHDER architecture validation
- entropy impact measurement
- task verification and completion
- auto commit with `ASK-Slice: <taskId>`
- pre-push validation of outgoing commit lineage

## Hook Enforcement

ASK installs three hook entrypoints:

- `.githooks/pre-commit` runs `scripts/session/runAskCorePreCommitAdapter.mjs`
- `.githooks/commit-msg` runs `scripts/session/runAskCoreCommitMsgAdapter.mjs`
- `.githooks/pre-push` runs `scripts/session/runAskCorePrePushAdapter.mjs`

Install hooks with:

```bash
npm run session:hooks:install
```

The pre-commit gate checks implementation handoff state when Plan Mode governance is active. The commit-msg gate requires exactly one of `ASK-Plan: <planId>`, `ASK-Slice: <taskId>`, or a valid `ASK-Exempt: <kind>` footer. The pre-push gate validates outgoing commit lineage before remote publication and only allows `ASK-Plan` commits to change plan artifacts under `docs/plans/`.

## Recovery

If handoff is missing:

```bash
node ask-core/bin/ask.js implementation begin --plan <md> --title <title>
```

If the plan artifact is invalid:

```bash
node ask-core/bin/ask.js plan validate --task <taskId> --run-id <runId> --path <json>
```

If no slice is active:

```bash
node ask-core/bin/ask.js next
node ask-core/bin/ask.js task start <taskId>
```

If commit provenance is missing:

```text
ASK-Plan: <planId>
```

for ready-plan commits, or:

```text
ASK-Slice: <taskId>
```

for implementation slice commits, or for approved maintenance-only commits:

```text
ASK-Exempt: meta
```

Governance bypass failures are recorded as OHDER/ASK findings so operators can inspect evidence, fix the issue, justify it, exempt it, or tune the analyzer/law.

