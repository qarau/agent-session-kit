import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { Scaffolder } from '../src/fs/Scaffolder.js';
import { ArchitectRuntime } from '../src/core/ArchitectRuntime.js';
import { OhderArchitectureReviewEnvelope } from '../src/core/OhderArchitectureReviewEnvelope.js';

test('architecture review envelope is deterministic and perspective-based', () => {
  const input = {
    semanticFacts: [
      {
        metric: 'security_boundary',
        value: 'invalid',
        confidence: 'high',
        evidence: [{ filePath: 'src/auth/Auth.js', reason: 'missing authz tests' }],
      },
    ],
    architectureScore: {
      overallScore: 72,
      categories: {
        replayability: 90,
        security: 70,
        durability: 86,
        replaceability: 90,
      },
    },
  };
  const first = new OhderArchitectureReviewEnvelope().review(input);
  const second = new OhderArchitectureReviewEnvelope().review(input);

  assert.deepEqual(first, second);
  assert.deepEqual(first.perspectives.map(item => item.name), [
    'survivability',
    'replayability',
    'security',
    'durability',
    'replaceability',
  ]);
  assert.equal(first.councilType, 'council-lite');
  assert.equal(first.llmCouncilUsed, false);
  assert.equal(first.perspectives.find(item => item.name === 'security').status, 'attention');
});

test('architect status includes review envelope evidence', async () => {
  const repoDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ask-core-review-envelope-'));
  await new Scaffolder(repoDir).init();

  const status = await new ArchitectRuntime(repoDir).assess({
    state: {
      sessionId: 'sess-review',
      continuityValid: true,
      checkpointMatchesExecution: true,
    },
    slice: {
      id: 'slice-review',
      execution: {
        operation: 'review-envelope-test',
      },
    },
    execution: {
      ok: true,
      status: 'completed',
      exitCode: 0,
      touchedFiles: [],
    },
    validation: {
      status: 'passed',
      testsRun: ['unit'],
    },
    policy: {
      architect: {
        enabled: true,
      },
      ohder: {
        mode: 'fast',
      },
    },
  });

  assert.equal(status.architectureReview.councilType, 'council-lite');
  assert.equal(status.architectureReview.llmCouncilUsed, false);
  assert.equal(status.architectureReview.perspectives.length, 5);
});
