#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const PHASES = {
  baseline: {
    description: 'Current stable verification baseline',
    commands: [
      { type: 'shell', label: 'repo tests', command: 'cmd /c npm run test' },
    ],
  },
  phase1: {
    description: 'Event ledger foundation + replay bridge',
    commands: [
      {
        type: 'node-test',
        label: 'ask-core phase1 contracts',
        files: [
          'ask-core/tests/eventLedger.foundation.contract.test.mjs',
          'ask-core/tests/replayProjection.contract.test.mjs',
          'ask-core/tests/sessionEventBridge.contract.test.mjs',
        ],
      },
      { type: 'shell', label: 'repo tests', command: 'cmd /c npm run test' },
    ],
  },
  phase2: {
    description: 'Task/evidence/verify runtime',
    commands: [
      {
        type: 'node-test',
        label: 'ask-core phase2 contracts',
        files: [
          'ask-core/tests/taskRuntime.contract.test.mjs',
          'ask-core/tests/evidenceVerify.contract.test.mjs',
        ],
      },
      { type: 'shell', label: 'repo tests', command: 'cmd /c npm run test' },
    ],
  },
  phase3: {
    description: 'Workflow adapter + enterprise guardrails',
    commands: [
      {
        type: 'node-test',
        label: 'workflow adapter contracts',
        files: [
          'ask-core/tests/workflowAdapter.contract.test.mjs',
          'ask-core/tests/superpowersEnterprise.contract.test.mjs',
        ],
      },
      { type: 'shell', label: 'repo tests', command: 'cmd /c npm run test' },
    ],
  },
  phase4: {
    description: 'Freshness and integration orchestration',
    commands: [
      {
        type: 'node-test',
        label: 'integration/freshness contracts',
        files: [
          'ask-core/tests/freshness.contract.test.mjs',
          'ask-core/tests/integrationRuntime.contract.test.mjs',
        ],
      },
      { type: 'shell', label: 'repo tests', command: 'cmd /c npm run test' },
    ],
  },
  phase5: {
    description: 'Agent routing and child sessions',
    commands: [
      {
        type: 'node-test',
        label: 'agent coordination contracts',
        files: [
          'ask-core/tests/agentCoordination.contract.test.mjs',
          'ask-core/tests/policyPacks.contract.test.mjs',
        ],
      },
      { type: 'shell', label: 'repo tests', command: 'cmd /c npm run test' },
    ],
  },
  phase6: {
    description: 'Delivery governance (release/promotion/rollout)',
    commands: [
      {
        type: 'node-test',
        label: 'delivery governance contracts',
        files: ['ask-core/tests/deliveryGovernance.contract.test.mjs'],
      },
      { type: 'shell', label: 'repo tests', command: 'cmd /c npm run test' },
    ],
  },
};

function parseArgs(argv) {
  let phase = 'baseline';
  let dryRun = false;
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--phase' && argv[i + 1]) {
      phase = String(argv[i + 1]).trim();
      i += 1;
      continue;
    }
    if (arg === '--dry-run') {
      dryRun = true;
    }
  }
  return { phase, dryRun };
}

function runShell(command, label, dryRun) {
  console.log(`\n[autonomy] ${label}`);
  console.log(`[autonomy] run: ${command}`);
  if (dryRun) {
    return;
  }
  const result = spawnSync(command, {
    shell: true,
    stdio: 'inherit',
    cwd: process.cwd(),
    env: process.env,
  });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

function runNodeTests(files, label, dryRun) {
  const existing = files.filter(file => fs.existsSync(path.resolve(process.cwd(), file)));
  if (existing.length === 0) {
    console.log(`\n[autonomy] ${label}`);
    console.log('[autonomy] skip: no listed test files exist yet');
    return;
  }
  const cmd = `cmd /c node --test ${existing.join(' ')}`;
  runShell(cmd, label, dryRun);
}

function printHelp() {
  const names = Object.keys(PHASES).join(', ');
  console.log(`Usage: node scripts/autonomy/runPhaseVerification.mjs --phase <name> [--dry-run]

Available phases: ${names}
`);
}

function main() {
  const { phase, dryRun } = parseArgs(process.argv.slice(2));
  const profile = PHASES[phase];
  if (!profile) {
    console.error(`[autonomy] unknown phase: ${phase}`);
    printHelp();
    process.exit(1);
  }

  console.log(`[autonomy] phase=${phase}`);
  console.log(`[autonomy] description=${profile.description}`);

  for (const command of profile.commands) {
    if (command.type === 'node-test') {
      runNodeTests(command.files, command.label, dryRun);
      continue;
    }
    runShell(command.command, command.label, dryRun);
  }

  console.log('\n[autonomy] phase verification complete');
}

main();
