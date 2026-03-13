import assert from 'node:assert/strict';
import test from 'node:test';
import {
  parseShipArgs,
  resolveCommitMessage,
  resolvePushArgs,
  validateShipConfig,
} from '../scripts/autonomy/runAutonomousShip.mjs';

test('parseShipArgs reads phase/message/remote and dry-run flag', () => {
  const parsed = parseShipArgs(['--phase', 'phase2', '--message', 'feat: runtime', '--remote', 'upstream', '--dry-run']);
  assert.equal(parsed.phase, 'phase2');
  assert.equal(parsed.message, 'feat: runtime');
  assert.equal(parsed.remote, 'upstream');
  assert.equal(parsed.dryRun, true);
});

test('parseShipArgs defaults phase baseline and remote origin', () => {
  const parsed = parseShipArgs([]);
  assert.equal(parsed.phase, 'baseline');
  assert.equal(parsed.remote, 'origin');
  assert.equal(parsed.message, '');
  assert.equal(parsed.dryRun, false);
});

test('resolveCommitMessage prefers CLI value and trims whitespace', () => {
  const message = resolveCommitMessage('  feat: ship  ', { ASK_AUTONOMY_COMMIT_MESSAGE: 'chore: fallback' });
  assert.equal(message, 'feat: ship');
});

test('resolveCommitMessage falls back to environment variable', () => {
  const message = resolveCommitMessage('', { ASK_AUTONOMY_COMMIT_MESSAGE: ' chore: env message ' });
  assert.equal(message, 'chore: env message');
});

test('validateShipConfig rejects missing commit message in non-dry-run mode', () => {
  assert.throws(
    () => validateShipConfig({ message: '', dryRun: false }),
    /commit message is required/i
  );
});

test('validateShipConfig allows missing commit message in dry-run mode', () => {
  assert.doesNotThrow(() => validateShipConfig({ message: '', dryRun: true }));
});

test('resolvePushArgs uses plain push when upstream exists', () => {
  const args = resolvePushArgs({ hasUpstream: true, remote: 'origin', branch: 'main' });
  assert.deepEqual(args, ['push']);
});

test('resolvePushArgs sets upstream when branch has no upstream', () => {
  const args = resolvePushArgs({ hasUpstream: false, remote: 'origin', branch: 'feature/autonomy' });
  assert.deepEqual(args, ['push', '-u', 'origin', 'feature/autonomy']);
});
