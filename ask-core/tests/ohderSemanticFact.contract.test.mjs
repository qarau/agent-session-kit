import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { Scaffolder } from '../src/fs/Scaffolder.js';
import { OhderSemanticFactEngine } from '../src/core/OhderSemanticFactEngine.js';
import { ArchitectRuntime } from '../src/core/ArchitectRuntime.js';

function writeFile(repoDir, filePath, source) {
  const absolute = path.join(repoDir, filePath);
  fs.mkdirSync(path.dirname(absolute), { recursive: true });
  fs.writeFileSync(absolute, source, 'utf8');
}

async function setupRepo() {
  const repoDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ask-core-ohder-semantic-'));
  await new Scaffolder(repoDir).init();
  return repoDir;
}

function baseAssessment(touchedFiles) {
  return {
    state: {
      sessionId: 'sess-semantic',
      continuityValid: true,
      checkpointMatchesExecution: true,
    },
    slice: {
      id: 'slice-semantic',
      execution: {
        operation: 'semantic-fact-check',
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
        block_on_violation: false,
        max_entropy_delta: 3,
        max_coupling_delta: 3,
        require_replayability: true,
      },
      ohder: {
        mode: 'fast',
      },
    },
  };
}

test('semantic fact engine normalizes confidence, evidence, and duplicate facts', () => {
  const facts = new OhderSemanticFactEngine().normalizeFacts([
    {
      factId: ' security-boundary:auth ',
      metric: ' security_boundary ',
      value: ' invalid ',
      confidence: 'CRITICAL',
      severity: ' critical ',
      source: ' SecurityAnalyzer ',
      evidence: [
        {
          filePath: 'src\\auth\\AuthTokenHandler.js',
          reason: ' auth bypass signal ',
          lineHint: ' skipAuth ',
        },
      ],
      recommendations: [' Add authorization guard tests. ', ''],
    },
    {
      factId: 'security-boundary:auth',
      metric: 'security_boundary',
      value: 'invalid',
      confidence: 'high',
      severity: 'critical',
      source: 'SecurityAnalyzer',
      evidence: [
        {
          filePath: 'src/auth/AuthTokenHandler.js',
          reason: 'duplicate evidence is ignored',
        },
      ],
    },
  ]);

  assert.deepEqual(facts, [
    {
      factId: 'security-boundary:auth',
      metric: 'security_boundary',
      value: 'invalid',
      confidence: 'high',
      severity: 'critical',
      source: 'SecurityAnalyzer',
      evidence: [
        {
          filePath: 'src/auth/AuthTokenHandler.js',
          reason: 'auth bypass signal',
          lineHint: 'skipAuth',
        },
      ],
      recommendations: ['Add authorization guard tests.'],
    },
  ]);
});

test('architect status exposes semantic facts while preserving flat ohder facts', async () => {
  const repoDir = await setupRepo();
  writeFile(
    repoDir,
    'src/auth/AuthTokenHandler.js',
    "export function issueToken(user) { return { token: process.env.JWT_SECRET, user, skipAuth: true }; }\n"
  );

  const status = await new ArchitectRuntime(repoDir).assess(baseAssessment([
    'src/auth/AuthTokenHandler.js',
  ]));
  const securityFact = status.semanticFacts.find(item => item.metric === 'security_boundary');

  assert.equal(status.ohderFacts.security_boundary, 'invalid');
  assert.ok(securityFact);
  assert.equal(securityFact.value, 'invalid');
  assert.equal(securityFact.confidence, 'high');
  assert.equal(securityFact.source, 'OhderSecurityBoundaryAnalyzerEngine');
  assert.equal(securityFact.evidence.some(item => item.filePath === 'src/auth/AuthTokenHandler.js'), true);
});
