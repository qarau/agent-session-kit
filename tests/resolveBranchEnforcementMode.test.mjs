import assert from 'node:assert/strict';
import test from 'node:test';

import {
  normalizeBranchEnforcementMode,
  resolveBranchEnforcementMode,
} from '../ask-core/src/core/resolveBranchEnforcementMode.js';

test('main uses enforce mode', () => {
  assert.equal(resolveBranchEnforcementMode('main'), 'enforce');
});

test('release/* uses enforce mode', () => {
  assert.equal(resolveBranchEnforcementMode('release/v0.1.8'), 'enforce');
});

test('feature branch uses advisory mode', () => {
  assert.equal(resolveBranchEnforcementMode('feature/ask-runtime'), 'advisory');
});

test('all mode enforces feature branches', () => {
  assert.equal(resolveBranchEnforcementMode('feature/ask-runtime', 'all'), 'enforce');
});

test('advisory mode keeps main advisory', () => {
  assert.equal(resolveBranchEnforcementMode('main', 'advisory'), 'advisory');
});

test('normalize accepts supported modes only', () => {
  assert.equal(normalizeBranchEnforcementMode('ALL'), 'all');
  assert.equal(normalizeBranchEnforcementMode('protected'), 'protected');
  assert.equal(normalizeBranchEnforcementMode('advisory'), 'advisory');
  assert.equal(normalizeBranchEnforcementMode('invalid-mode'), '');
});
