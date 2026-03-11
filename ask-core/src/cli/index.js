import { runInit } from './commands/init.js';
import { runSession } from './commands/session.js';
import { runContext } from './commands/context.js';
import { runPreflight } from './commands/preflight.js';
import { runCanCommit } from './commands/canCommit.js';
import { runHandoff } from './commands/handoff.js';

function printHelp() {
  console.log(`ASK Core CLI

Usage:
  ask init
  ask session start|resume|status|close
  ask context verify|status
  ask preflight
  ask can-commit
  ask handoff create
`);
}

export async function runCli(args) {
  const [command, subcommand] = args;
  if (!command) {
    printHelp();
    return;
  }

  if (command === 'init') {
    await runInit();
    return;
  }

  if (command === 'session') {
    await runSession(subcommand);
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

  if (command === 'handoff') {
    await runHandoff(subcommand);
    return;
  }

  printHelp();
}
