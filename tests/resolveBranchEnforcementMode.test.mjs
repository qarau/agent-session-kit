import assert from 'node:assert/strict';
import test from 'node:test';

import { resolveBranchEnforcementMode } from '../ask-core/src/core/resolveBranchEnforcementMode.js';

test('main uses enforce mode', () => {
  assert.equal(resolveBranchEnforcementMode('main'), 'enforce');
});

test('release/* uses enforce mode', () => {
  assert.equal(resolveBranchEnforcementMode('release/v0.1.8'), 'enforce');
});

test('feature branch uses advisory mode', () => {
  assert.equal(resolveBranchEnforcementMode('feature/ask-runtime'), 'advisory');
});
