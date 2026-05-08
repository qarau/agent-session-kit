import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { OhderComplexityAnalyzerEngine } from '../src/core/OhderComplexityAnalyzerEngine.js';
import { ArchitectRuntime } from '../src/core/ArchitectRuntime.js';

function setupRepo() {
  const repoDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ask-core-ohder-complexity-'));
  fs.mkdirSync(path.join(repoDir, 'ask-core', 'src', 'core'), { recursive: true });
  fs.writeFileSync(
    path.join(repoDir, 'ask-core', 'src', 'core', 'FocusedEngine.js'),
    'export function score(value) {\n  return value > 0 ? 1 : 0;\n}\n',
    'utf8'
  );
  const branches = Array.from({ length: 18 }, (_, index) => `  if (input.step === ${index}) { console.log(input.step); }\n`).join('');
  const filler = Array.from({ length: 130 }, (_, index) => `  const line${index} = ${index};\n`).join('');
  fs.writeFileSync(
    path.join(repoDir, 'ask-core', 'src', 'core', 'MixedRuntime.js'),
    `import fs from 'node:fs';\nexport class MixedRuntime {\n  async run(input, policy, ledger) {\n${branches}${filler}    await fs.promises.writeFile('tmp.json', JSON.stringify({ policy, ledger }));\n    return input.score + policy.entropy + ledger.snapshot;\n  }\n}\n`,
    'utf8'
  );
  return repoDir;
}

test('complexity analyzer keeps focused files low risk', () => {
  const repoDir = setupRepo();
  const engine = new OhderComplexityAnalyzerEngine(repoDir);

  const result = engine.analyze({
    touchedFiles: ['ask-core/src/core/FocusedEngine.js'],
  });

  assert.equal(result.risk, 'low');
  assert.equal(result.complexityDelta, 0);
  assert.deepEqual(result.findings, []);
});

test('complexity analyzer reports large mixed-responsibility files', () => {
  const repoDir = setupRepo();
  const engine = new OhderComplexityAnalyzerEngine(repoDir);

  const result = engine.analyze({
    touchedFiles: ['ask-core/src/core/MixedRuntime.js'],
  });

  assert.equal(result.risk, 'high');
  assert.equal(result.complexityDelta >= 4, true);
  assert.match(result.findings.join('\n'), /large file/u);
  assert.match(result.findings.join('\n'), /mixed responsibilities/u);
});

test('architect runtime exposes complexity analysis and score penalty', async () => {
  const repoDir = setupRepo();
  const runtime = new ArchitectRuntime(repoDir);

  const status = await runtime.assess({
    state: {
      sessionId: 'sess-complexity',
      continuityValid: true,
      checkpointMatchesExecution: true,
    },
    slice: {
      id: 'slice-complexity',
      execution: {
        operation: 'complexity-test',
      },
    },
    execution: {
      ok: true,
      status: 'completed',
      exitCode: 0,
      touchedFiles: ['ask-core/src/core/MixedRuntime.js'],
    },
    validation: {
      status: 'passed',
      testsRun: ['node --test'],
    },
    policy: {
      architect: {
        block_on_violation: false,
      },
    },
  });

  assert.equal(status.complexityAnalysis.risk, 'high');
  assert.equal(status.complexityAnalysis.findings.length >= 1, true);
  assert.equal(status.architectureScore.categories.testability < 100, true);
});
