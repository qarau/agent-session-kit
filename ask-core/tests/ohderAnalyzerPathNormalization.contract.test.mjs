import assert from 'node:assert/strict';
import test from 'node:test';
import { SliceCloseRuntime } from '../src/core/SliceCloseRuntime.js';
import { OhderDurabilityValidatorEngine } from '../src/core/OhderDurabilityValidatorEngine.js';
import { OhderComplexityAnalyzerEngine } from '../src/core/OhderComplexityAnalyzerEngine.js';

class TestSliceCloseRuntime extends SliceCloseRuntime {
  constructor(stdout) {
    super(process.cwd());
    this.stdout = stdout;
  }

  runGit() {
    return {
      ok: true,
      stdout: this.stdout,
      stderr: '',
      status: 0,
    };
  }
}

test('slice close workspace path parser preserves ask-core paths from compact status output', () => {
  const runtime = new TestSliceCloseRuntime([
    'M ask-core/src/runtime/projectors/TaskBoardProjector.js',
    'A docs/operations/ohder-analyzer-playbook.md',
  ].join('\n'));

  const files = runtime.getWorkspaceChangedFiles();

  assert.deepEqual(files, [
    'ask-core/src/runtime/projectors/TaskBoardProjector.js',
    'docs/operations/ohder-analyzer-playbook.md',
  ]);
});

test('slice close workspace path parser preserves ask-core paths from standard porcelain output', () => {
  const runtime = new TestSliceCloseRuntime([
    ' M ask-core/src/core/ArchitectRuntime.js',
    '?? ask-core/tests/ohderAnalyzerPathNormalization.contract.test.mjs',
  ].join('\n'));

  const files = runtime.getWorkspaceChangedFiles();

  assert.deepEqual(files, [
    'ask-core/src/core/ArchitectRuntime.js',
    'ask-core/tests/ohderAnalyzerPathNormalization.contract.test.mjs',
  ]);
});

test('OHDER analyzers preserve ask-core paths in findings and analyzed files', () => {
  const touchedFiles = ['ask-core/src/runtime/projectors/TaskBoardProjector.js'];
  const durability = new OhderDurabilityValidatorEngine().analyze({ touchedFiles });
  const complexity = new OhderComplexityAnalyzerEngine(process.cwd()).analyze({ touchedFiles });

  assert.equal(durability.touchpoints[0].filePath, 'ask-core/src/runtime/projectors/TaskBoardProjector.js');
  assert.match(durability.findings[0], /ask-core\/src\/runtime\/projectors\/TaskBoardProjector\.js/u);
  assert.equal(complexity.filesAnalyzed[0].filePath, 'ask-core/src/runtime/projectors/TaskBoardProjector.js');
});
