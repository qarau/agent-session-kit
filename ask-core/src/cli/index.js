import { runInit } from './commands/init.js';
import { runSession } from './commands/session.js';
import { runContext } from './commands/context.js';
import { runPreflight } from './commands/preflight.js';
import { runCanCommit } from './commands/canCommit.js';
import { runPreCommitCheck } from './commands/preCommitCheck.js';
import { runPrePushCheck } from './commands/prePushCheck.js';
import { runHandoff } from './commands/handoff.js';
import { runCodex } from './commands/codex.js';
import { runReplay } from './commands/replay.js';
import { runTask } from './commands/task.js';
import { runEvidence } from './commands/evidence.js';
import { runVerify } from './commands/verify.js';
import { runWorkflow } from './commands/workflow.js';
import { runWorkflowProvider } from './commands/workflow-provider.js';
import { runFreshness } from './commands/freshness.js';
import { runIntegration } from './commands/integration.js';
import { runIntegrationAuto } from './commands/integration-auto.js';
import { runRoute } from './commands/route.js';
import { runClaim } from './commands/claim.js';
import { runChildSession } from './commands/child-session.js';
import { runAgent } from './commands/agent.js';
import { runPolicy } from './commands/policy.js';
import { runFeature } from './commands/feature.js';
import { runRelease } from './commands/release.js';
import { runPromote } from './commands/promote.js';
import { runRollout } from './commands/rollout.js';
import { runRollback } from './commands/rollback.js';
import { runContinue } from './commands/continue.js';
import { runProjectState } from './commands/project-state.js';
import { runIntent } from './commands/intent.js';
import { runSlice } from './commands/slice.js';
import { runValidateLast } from './commands/validate-last.js';
import { runResumePacket } from './commands/resume-packet.js';
import { runMetrics } from './commands/metrics.js';
import { runArchitect } from './commands/architect.js';
import { runNext } from './commands/next.js';
import { runFlow } from './commands/flow.js';
import { runGovernance } from './commands/governance.js';
import { runDesign } from './commands/design.js';
import { runPlan } from './commands/plan.js';

function printHelp() {
  console.log(`ASK Core CLI

Usage:
  ask init [--reset-runtime]
  ask session start|pause|resume|block|status|close|doctor
  ask context verify|status
  ask preflight
  ask can-commit
  ask pre-commit-check
  ask pre-push-check
  ask task create|assign|start|complete|reopen|depends|status
  ask evidence attach
  ask evidence checks record|status
  ask verify pass|fail
  ask workflow recommend|start|artifact|complete|fail
  ask workflow-provider status [--workflow superpowers] [--version <version>]
  ask freshness status|explain [task-id]
  ask integration plan|run|status
  ask integration-auto run|status
  ask route recommend|status
  ask claim acquire|release|lock|status
  ask child-session spawn|status
  ask agent register|status|dispatch
  ask policy classify|apply|status|schema|migrate
  ask feature create|link-task|status
  ask release create|link-feature|status
  ask promote require|pass|advance|status
  ask rollout start|phase|status
  ask rollback trigger
  ask continue [--once] [--max-slices <n>] [--until blocked|complete]
  ask project-state
  ask intent preview
  ask slice preview [--command <bin>] [--command-arg <arg>] [--operation <name>] [--allowed-command <cmd>]
  ask slice close <taskId>
  ask validate-last
  ask architect status
  ask architect exempt list|add --law-id <id> --reason <text> --approved-by <id> [--operation <name>] [--session-id <id>] [--expires-at <iso>]
  ask flow status|list
  ask flow discover --last
  ask flow validate --last
  ask flow promote <flow-id> --to <stage> --reason <text> [--approved-by <id>] [--approval-ticket <id>]
  ask design status|list
  ask design discover --last
  ask design validate --last
  ask design promote <region-id> --to <stage> --reason <text> [--approved-by <id>] [--approval-ticket <id>]
  ask governance status|explain
  ask plan ingest|validate|batch show
  ask next
  ask resume-packet show
  ask metrics show [--history <n>]
  ask replay
  ask handoff create
  ask codex [launch] [--command <bin>] [--command-arg <arg>] [--operation <name>] [--timeout-ms <n>] [--allow-fail-open] [--fail-open-reason <text>] [--approved-by <id>] [--approval-ticket <id>] [--touched-file <path>] [-- <args...>]
  ask codex direct --reason <text> [--approved-by <id>] [--approval-ticket <id>] [--command <bin>] [--command-arg <arg>] [--operation <name>] [--timeout-ms <n>] [--touched-file <path>] [-- <args...>]
  ask codex context status|ensure|compact
`);
}

export async function runCli(args) {
  const [command, subcommand, ...rest] = args;
  if (!command) {
    printHelp();
    return;
  }

  if (command === 'init') {
    await runInit([subcommand, ...rest].filter(Boolean));
    return;
  }

  if (command === 'session') {
    await runSession(subcommand, rest);
    return;
  }

  if (command === 'context') {
    await runContext(subcommand);
    return;
  }

  if (command === 'preflight') {
    await runPreflight();
    return;
  }

  if (command === 'can-commit') {
    await runCanCommit();
    return;
  }

  if (command === 'pre-commit-check') {
    await runPreCommitCheck();
    return;
  }

  if (command === 'pre-push-check') {
    await runPrePushCheck();
    return;
  }

  if (command === 'replay') {
    await runReplay();
    return;
  }

  if (command === 'task') {
    await runTask(subcommand, rest);
    return;
  }

  if (command === 'evidence') {
    await runEvidence(subcommand, rest);
    return;
  }

  if (command === 'verify') {
    await runVerify(subcommand, rest);
    return;
  }

  if (command === 'workflow') {
    await runWorkflow(subcommand, rest);
    return;
  }

  if (command === 'workflow-provider') {
    await runWorkflowProvider(subcommand, rest);
    return;
  }

  if (command === 'freshness') {
    await runFreshness(subcommand, rest);
    return;
  }

  if (command === 'integration') {
    await runIntegration(subcommand, rest);
    return;
  }

  if (command === 'integration-auto') {
    await runIntegrationAuto(subcommand, rest);
    return;
  }

  if (command === 'route') {
    await runRoute(subcommand, rest);
    return;
  }

  if (command === 'claim') {
    await runClaim(subcommand, rest);
    return;
  }

  if (command === 'child-session') {
    await runChildSession(subcommand, rest);
    return;
  }

  if (command === 'agent') {
    await runAgent(subcommand, rest);
    return;
  }

  if (command === 'policy') {
    await runPolicy(subcommand, rest);
    return;
  }

  if (command === 'feature') {
    await runFeature(subcommand, rest);
    return;
  }

  if (command === 'release') {
    await runRelease(subcommand, rest);
    return;
  }

  if (command === 'promote') {
    await runPromote(subcommand, rest);
    return;
  }

  if (command === 'rollout') {
    await runRollout(subcommand, rest);
    return;
  }

  if (command === 'rollback') {
    await runRollback(subcommand, rest);
    return;
  }

  if (command === 'continue') {
    await runContinue([subcommand, ...rest].filter(Boolean));
    return;
  }

  if (command === 'project-state') {
    await runProjectState();
    return;
  }

  if (command === 'intent') {
    await runIntent(subcommand);
    return;
  }

  if (command === 'slice') {
    await runSlice(subcommand, rest);
    return;
  }

  if (command === 'validate-last') {
    await runValidateLast([subcommand, ...rest].filter(Boolean));
    return;
  }

  if (command === 'architect') {
    await runArchitect(subcommand, rest);
    return;
  }

  if (command === 'flow') {
    await runFlow(subcommand, rest);
    return;
  }

  if (command === 'design') {
    await runDesign(subcommand, rest);
    return;
  }

  if (command === 'next') {
    await runNext();
    return;
  }

  if (command === 'governance') {
    await runGovernance(subcommand);
    return;
  }

  if (command === 'plan') {
    await runPlan(subcommand, rest);
    return;
  }

  if (command === 'resume-packet') {
    await runResumePacket(subcommand);
    return;
  }

  if (command === 'metrics') {
    await runMetrics(subcommand, rest);
    return;
  }

  if (command === 'handoff') {
    await runHandoff(subcommand);
    return;
  }

  if (command === 'codex') {
    await runCodex(subcommand, rest);
    return;
  }

  printHelp();
}
