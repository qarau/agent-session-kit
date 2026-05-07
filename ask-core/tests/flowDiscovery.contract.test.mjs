import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { Scaffolder } from '../src/fs/Scaffolder.js';
import { AskPaths } from '../src/fs/AskPaths.js';
import { FileStore } from '../src/fs/FileStore.js';
import { FlowRuntime } from '../src/core/FlowRuntime.js';
import { EventLedger } from '../src/runtime/EventLedger.js';

const thisFilePath = fileURLToPath(import.meta.url);
const testsDir = path.dirname(thisFilePath);
const askCoreRoot = path.resolve(testsDir, '..');
const askBinPath = path.join(askCoreRoot, 'bin', 'ask.js');

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: options.cwd,
    encoding: 'utf8',
    env: options.env ? { ...process.env, ...options.env } : process.env,
  });
  return {
    status: result.status,
    stdout: result.stdout ?? '',
    stderr: result.stderr ?? '',
  };
}

function runOrThrow(command, args, options = {}) {
  const result = run(command, args, options);
  if (result.status !== 0) {
    throw new Error(
      [
        `Command failed: ${command} ${args.join(' ')}`,
        `status=${String(result.status)}`,
        result.stdout,
        result.stderr,
      ].join('\n')
    );
  }
  return result;
}

function setupRepo() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'ask-core-flow-discovery-'));
}

function setupCliRepo() {
  const repoDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ask-core-flow-discovery-cli-'));
  runOrThrow('git', ['init'], { cwd: repoDir });
  runOrThrow('git', ['config', 'user.email', 'test@example.com'], { cwd: repoDir });
  runOrThrow('git', ['config', 'user.name', 'Test User'], { cwd: repoDir });
  runOrThrow('git', ['checkout', '-b', 'ask-runtime'], { cwd: repoDir });
  runOrThrow(process.execPath, [askBinPath, 'init'], { cwd: repoDir });
  runOrThrow(process.execPath, [askBinPath, 'session', 'start'], { cwd: repoDir });
  return repoDir;
}

test('flow discovery creates experimental flows for unmapped touched files', async () => {
  const repoDir = setupRepo();
  const scaffolder = new Scaffolder(repoDir);
  await scaffolder.init();
  const paths = new AskPaths(repoDir);
  const store = new FileStore();

  await store.writeJson(paths.productFlowContract(), {
    version: 1,
    flows: [
      {
        id: 'existing-checkout-flow',
        name: 'Existing checkout flow',
        stage: 'protected',
        criticality: 'protected',
        given: 'Checkout exists',
        when: 'User checks out',
        then: ['Order succeeds'],
      },
    ],
  });
  await store.writeJson(paths.flowMap(), {
    'existing-checkout-flow': {
      files: ['src/checkout/**'],
      tests: ['checkout-flow'],
    },
  });

  const runtime = new FlowRuntime(repoDir);
  const payload = await runtime.discover({
    slice: { id: 'slice_flow_discovery_1' },
    execution: {
      touchedFiles: [
        'src/checkout/CheckoutPage.js',
        'src/profile/ProfileCard.tsx',
        'src/notifications/InboxPanel.tsx',
      ],
    },
    validation: {
      testsRun: ['npm run profilecard', 'npm run notifications'],
    },
    policy: {
      flow: {
        enabled: true,
        discovery_enabled: true,
      },
    },
  });

  assert.equal(payload.ok, true);
  assert.equal(payload.status, 'discovered');
  assert.equal(payload.discoveredCount, 2);
  assert.equal(payload.skippedMappedFiles.includes('src/checkout/CheckoutPage.js'), true);

  const contract = await store.readJson(paths.productFlowContract(), { flows: [] });
  assert.equal(contract.flows.length, 3);
  const discoveredFlows = contract.flows.filter(flow => String(flow.id).startsWith('auto-'));
  assert.equal(discoveredFlows.length, 2);
  assert.equal(discoveredFlows.every(flow => flow.stage === 'experimental'), true);

  const map = await store.readJson(paths.flowMap(), {});
  for (const discovered of discoveredFlows) {
    assert.ok(Array.isArray(map[discovered.id]?.files));
    assert.equal(map[discovered.id].files.length, 1);
  }

  const flowDoc = await store.readText(paths.productFlowDoc(), '');
  assert.match(flowDoc, /Product Flow Memory/i);
  assert.match(flowDoc, /EXPERIMENTAL/i);
});

test('ask flow discover --last discovers once then becomes noop', async () => {
  const repoDir = setupCliRepo();
  const ledger = new EventLedger(repoDir);

  await ledger.append({
    type: 'SliceCreated',
    sessionId: 'sess_discovery',
    taskId: 'deep-011',
    actor: 'local',
    payload: { id: 'slice_discover_cli' },
    meta: { source: 'test' },
  });
  await ledger.append({
    type: 'CodexExecutionCaptured',
    sessionId: 'sess_discovery',
    taskId: 'deep-011',
    actor: 'local',
    payload: {
      status: 'completed',
      exitCode: 0,
      touchedFiles: ['packages/discovery/FlowSignal.js'],
    },
    meta: { source: 'test' },
  });
  await ledger.append({
    type: 'ValidationPassed',
    sessionId: 'sess_discovery',
    taskId: 'deep-011',
    actor: 'local',
    payload: {
      status: 'passed',
      testsRun: ['npm run flowsignal'],
      warnings: [],
      failures: [],
    },
    meta: { source: 'test' },
  });

  const first = runOrThrow(process.execPath, [askBinPath, 'flow', 'discover', '--last'], { cwd: repoDir });
  const firstPayload = JSON.parse(first.stdout);
  assert.equal(firstPayload.ok, true);
  assert.equal(firstPayload.discovery.status, 'discovered');
  assert.equal(firstPayload.discovery.discoveredCount, 1);

  const second = runOrThrow(process.execPath, [askBinPath, 'flow', 'discover', '--last'], { cwd: repoDir });
  const secondPayload = JSON.parse(second.stdout);
  assert.equal(secondPayload.ok, true);
  assert.equal(secondPayload.discovery.status, 'noop');
  assert.equal(secondPayload.discovery.discoveredCount, 0);
});
