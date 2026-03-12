import { runInit } from './commands/init.js';
import { runSession } from './commands/session.js';
import { runContext } from './commands/context.js';
import { runPreflight } from './commands/preflight.js';
import { runCanCommit } from './commands/canCommit.js';
import { runPreCommitCheck } from './commands/preCommitCheck.js';
import { runPrePushCheck } from './commands/prePushCheck.js';
import { runHandoff } from './commands/handoff.js';

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
  ask handoff create
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

  if (command === 'handoff') {
    await runHandoff(subcommand);
    return;
  }

  printHelp();
}
