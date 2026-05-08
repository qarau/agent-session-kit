import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { Scaffolder } from '../src/fs/Scaffolder.js';
import { ArchitectRuntime } from '../src/core/ArchitectRuntime.js';

function writeFile(repoDir, filePath, source) {
  const absolute = path.join(repoDir, filePath);
  fs.mkdirSync(path.dirname(absolute), { recursive: true });
  fs.writeFileSync(absolute, source, 'utf8');
}

async function setupRepo() {
  const repoDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ask-core-ohder-security-'));
  await new Scaffolder(repoDir).init();
  return repoDir;
}

function baseAssessment(touchedFiles) {
  return {
    state: {
      sessionId: 'sess-security',
      continuityValid: true,
      checkpointMatchesExecution: true,
    },
    slice: {
      id: 'slice-security',
      execution: {
        operation: 'security-boundary-check',
      },
    },
    execution: {
      ok: true,
      exitCode: 0,
      status: 'completed',
      touchedFiles,
    },
    validation: {
      status: 'passed',
      testsRun: ['unit'],
    },
    policy: {
      architect: {
        enabled: true,
        block_on_violation: true,
        max_entropy_delta: 3,
        max_coupling_delta: 3,
        require_replayability: true,
      },
      ohder: {
        mode: 'strict',
      },
    },
  };
}

test('architect runtime blocks strict-mode security boundary violations', async () => {
  const repoDir = await setupRepo();
  writeFile(
    repoDir,
    'src/auth/AuthTokenHandler.js',
    "export function issueToken(user) { return { token: process.env.JWT_SECRET, user, skipAuth: true }; }\n"
  );

  const status = await new ArchitectRuntime(repoDir).assess(baseAssessment([
    'src/auth/AuthTokenHandler.js',
  ]));

  assert.equal(status.securityAnalysis.risk, 'high');
  assert.equal(status.securityAnalysis.boundaryValid, false);
  assert.equal(status.ohderFacts.security_boundary, 'invalid');
  assert.equal(status.architectureScore.categories.security < 100, true);
  assert.equal(status.blocking, true);
  assert.ok(status.lawViolations.find(item => item.id === 'ohder-security-boundary'));
});
