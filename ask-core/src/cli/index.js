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

function printHelp() {
  console.log(`ASK Core CLI

Usage:
  ask init
  ask session start|pause|resume|block|status|close|doctor
  ask context verify|status
  ask preflight
  ask can-commit
  ask pre-commit-check
  ask pre-push-check
  ask task create|assign|start|depends|status
  ask evidence attach
  ask verify pass|fail
  ask workflow recommend|start|artifact|complete|fail
  ask workflow-provider status [--workflow superpowers] [--version <version>]
  ask freshness status|explain [task-id]
  ask replay
  ask handoff create
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
    await runInit();
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
