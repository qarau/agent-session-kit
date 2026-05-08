import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { Scaffolder } from '../src/fs/Scaffolder.js';
import { EventLedger } from '../src/runtime/EventLedger.js';
import { GovernanceValidationRuntime } from '../src/core/GovernanceValidationRuntime.js';
import { OhderNextActionEngine } from '../src/core/OhderNextActionEngine.js';

async function setupRepo() {
  const repoDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ask-core-governance-validation-'));
  await new Scaffolder(repoDir).init();
  return repoDir;
}

function disableReplayabilityRequirement(repoDir) {
  const policyPath = path.join(repoDir, '.ask', 'policy', 'runtime-policy.yaml');
  const raw = fs.readFileSync(policyPath, 'utf8');
  fs.writeFileSync(policyPath, raw.replace('require_replayability: true', 'require_replayability: false'), 'utf8');
}

test('OHDER next action recommends mutating governance validation command', () => {
  const decision = new OhderNextActionEngine().decide({
    state: {},
    architect: {
      status: 'warning',
      blocking: false,
      replayabilityRisk: 'low',
      architectureScore: {
        overallScore: 92,
      },
    },
    entropy: {
      refactorPressure: 'medium',
      trend: 'stable',
      entropyScore: 0.24,
    },
    tasks: {
      active: [],
      ready: [],
    },
    policy: {},
  });

  assert.equal(decision.action, 'run-governance-validation');
  assert.equal(decision.recommendedCommand, 'ask governance validate');
});

test('governance validation runtime writes decision state and replay event', async () => {
  const repoDir = await setupRepo();
  disableReplayabilityRequirement(repoDir);
  const result = await new GovernanceValidationRuntime(repoDir).run();

  assert.equal(result.ok, true);
  assert.equal(result.decision.decision, 'continue');
  assert.equal(result.decision.validationStatus, 'passed');

  const events = await new EventLedger(repoDir).readAll();
  assert.ok(events.some(event => event.type === 'GovernanceDecisionWritten'));
  assert.ok(events.some(event => event.type === 'GovernanceValidationCompleted'));
});

test('fresh continue governance decision clears validation-only next action', () => {
  const decision = new OhderNextActionEngine().decide({
    state: {
      governanceDecision: {
        decision: 'continue',
        validationStatus: 'passed',
        reason: 'governance validation clear',
      },
    },
    architect: {
      status: 'passed',
      blocking: false,
      replayabilityRisk: 'low',
      architectureScore: {
        overallScore: 94,
      },
    },
    entropy: {
      refactorPressure: 'medium',
      trend: 'stable',
      entropyScore: 0.22,
    },
    tasks: {
      active: [],
      ready: [],
    },
    policy: {},
  });

  assert.equal(decision.action, 'await-new-requirement');
});
