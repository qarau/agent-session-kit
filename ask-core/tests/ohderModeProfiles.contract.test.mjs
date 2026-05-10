import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { Scaffolder } from '../src/fs/Scaffolder.js';
import { PolicyEngine } from '../src/core/PolicyEngine.js';
import { ArchitectRuntime } from '../src/core/ArchitectRuntime.js';
import { SliceCloseRuntime } from '../src/core/SliceCloseRuntime.js';

function writeFile(repoDir, filePath, source) {
  const absolute = path.join(repoDir, filePath);
  fs.mkdirSync(path.dirname(absolute), { recursive: true });
  fs.writeFileSync(absolute, source, 'utf8');
}

async function setupRepo() {
  const repoDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ask-core-ohder-profiles-'));
  await new Scaffolder(repoDir).init();
  return repoDir;
}

function baseAssessment(touchedFiles, policy) {
  return {
    state: {
      sessionId: 'sess-profile',
      continuityValid: true,
      checkpointMatchesExecution: true,
    },
    slice: {
      id: 'slice-profile',
      execution: {
        operation: 'mode-profile-test',
      },
    },
    execution: {
      ok: true,
      status: 'completed',
      exitCode: 0,
      touchedFiles,
    },
    validation: {
      status: 'passed',
      testsRun: ['unit'],
    },
    policy,
  };
}

test('policy engine exposes normalized OHDER profile defaults', async () => {
  const repoDir = await setupRepo();
  const policy = await new PolicyEngine(repoDir).load();

  assert.equal(policy.ohder.mode, 'fast');
  assert.deepEqual(policy.ohder_profile, {
    mode: 'fast',
    warningFirst: true,
    requireSemanticFactEvidence: false,
    requireReplayability: true,
    blockNonRefactorSlices: false,
    requireRefactorOutcome: false,
  });
});

test('strict mode records semantic evidence requirements for risky analyzer facts', async () => {
  const repoDir = await setupRepo();
  writeFile(
    repoDir,
    'src/security/RoleScopePolicy.js',
    "export function canManageBilling(user) { return user.role === 'admin' && user.scope.includes('billing:write'); }\n"
  );

  const status = await new ArchitectRuntime(repoDir).assess(baseAssessment(
    ['src/security/RoleScopePolicy.js'],
    {
      architect: {
        enabled: true,
        block_on_violation: true,
        max_entropy_delta: 4,
        max_coupling_delta: 4,
        require_replayability: false,
      },
      ohder: {
        mode: 'strict',
      },
    }
  ));

  assert.equal(status.ohderProfile.mode, 'strict');
  assert.equal(status.ohderProfile.requireSemanticFactEvidence, true);
  assert.equal(status.semanticEvidence.status, 'satisfied');
  assert.ok(status.semanticEvidence.requiredMetrics.includes('security_boundary'));
});

test('refactor mode blocks non-refactor slice close unless policy exempted', () => {
  const runtime = new SliceCloseRuntime(process.cwd());
  const blocked = runtime.evaluateOhderModeCloseGuard({
    taskId: 'feature-001',
    title: 'Add normal feature',
  }, {
    ohder: {
      mode: 'refactor',
    },
  });

  assert.equal(blocked.ok, false);
  assert.equal(blocked.code, 'ohder-refactor-mode-non-refactor-slice');

  const allowed = runtime.evaluateOhderModeCloseGuard({
    taskId: 'feature-001',
    title: 'Add normal feature',
  }, {
    ohder: {
      mode: 'refactor',
      allow_non_refactor_close: true,
    },
  });

  assert.equal(allowed.ok, true);
});
