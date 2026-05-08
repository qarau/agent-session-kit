import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { Scaffolder } from '../src/fs/Scaffolder.js';
import { OhderTestabilityAnalyzerEngine } from '../src/core/OhderTestabilityAnalyzerEngine.js';
import { ArchitectRuntime } from '../src/core/ArchitectRuntime.js';

function writeFile(repoDir, filePath, source) {
  const absolute = path.join(repoDir, filePath);
  fs.mkdirSync(path.dirname(absolute), { recursive: true });
  fs.writeFileSync(absolute, source, 'utf8');
}

async function setupRepo() {
  const repoDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ask-core-ohder-testability-'));
  await new Scaffolder(repoDir).init();
  writeFile(
    repoDir,
    'ask-core/src/core/UntestedDecisionRuntime.js',
    `export function decideRuntimePath(input = {}) {
  if (process.env.ASK_FORCE_PATH) {
    return process.env.ASK_FORCE_PATH;
  }
  if (input.strict) {
    return 'strict';
  }
  return 'fast';
}
`
  );
  writeFile(
    repoDir,
    'ask-core/src/core/TestedDecisionRuntime.js',
    `export function normalizeDecision(input = {}) {
  return String(input.mode ?? 'fast').trim().toLowerCase();
}
`
  );
  writeFile(
    repoDir,
    'ask-core/tests/testedDecisionRuntime.contract.test.mjs',
    `import { normalizeDecision } from '../src/core/TestedDecisionRuntime.js';

assert.equal(normalizeDecision({ mode: ' STRICT ' }), 'strict');
`
  );
  writeFile(
    repoDir,
    'ask-core/src/cli/commands/largeCommand.js',
    `import fs from 'node:fs';

export async function run(argv, policy) {
  const mode = argv.includes('--strict') ? 'strict' : 'fast';
  const config = fs.readFileSync(policy.path, 'utf8');
  if (process.argv.includes('--dry-run')) {
    return { ok: true, mode, config };
  }
  if (policy.block) {
    return { ok: false, code: 'blocked', message: 'blocked' };
  }
  return { ok: true, mode, config };
}
`
  );
  return repoDir;
}

function baseAssessment(touchedFiles) {
  return {
    state: {
      sessionId: 'sess-testability',
      continuityValid: true,
      checkpointMatchesExecution: true,
    },
    slice: {
      id: 'slice-testability',
      execution: {
        operation: 'testability-check',
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
        max_entropy_delta: 4,
        max_coupling_delta: 4,
        require_replayability: true,
      },
      ohder: {
        mode: 'strict',
      },
    },
  };
}

test('testability analyzer reports exported runtime behavior without matching contract test', async () => {
  const repoDir = await setupRepo();
  const result = new OhderTestabilityAnalyzerEngine(repoDir).analyze({
    touchedFiles: ['ask-core/src/core/UntestedDecisionRuntime.js'],
  });

  assert.equal(result.risk, 'high');
  assert.equal(result.testabilityValid, false);
  assert.ok(result.violations.find(item => item.kind === 'untested-exported-runtime-behavior'));
  assert.ok(result.violations.find(item => item.kind === 'core-global-state-coupling'));
});

test('testability analyzer lowers risk when matching contract test is touched', async () => {
  const repoDir = await setupRepo();
  const result = new OhderTestabilityAnalyzerEngine(repoDir).analyze({
    touchedFiles: [
      'ask-core/src/core/TestedDecisionRuntime.js',
      'ask-core/tests/testedDecisionRuntime.contract.test.mjs',
    ],
  });

  assert.equal(result.risk, 'low');
  assert.equal(result.testabilityValid, true);
  assert.deepEqual(result.violations, []);
});

test('testability analyzer reports CLI-heavy filesystem-coupled decision logic', async () => {
  const repoDir = await setupRepo();
  const result = new OhderTestabilityAnalyzerEngine(repoDir).analyze({
    touchedFiles: ['ask-core/src/cli/commands/largeCommand.js'],
  });

  assert.equal(result.risk, 'high');
  assert.ok(result.violations.find(item => item.kind === 'cli-heavy-decision-logic'));
});

test('architect runtime maps testability risk into semantic facts and score', async () => {
  const repoDir = await setupRepo();
  const status = await new ArchitectRuntime(repoDir).assess(baseAssessment([
    'ask-core/src/core/UntestedDecisionRuntime.js',
  ]));

  assert.equal(status.ohderFacts.testability_risk, 'high');
  assert.equal(status.testabilityAnalysis.risk, 'high');
  assert.equal(status.architectureScore.categories.testability < 100, true);
  assert.ok(status.semanticFacts.find(item => item.metric === 'testability_risk' && item.value === 'high'));
});
