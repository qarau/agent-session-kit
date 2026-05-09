import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const thisFilePath = fileURLToPath(import.meta.url);
const repoRoot = path.resolve(path.dirname(thisFilePath), '..', '..');
const askBin = path.join(repoRoot, 'ask-core', 'bin', 'ask.js');
const args = process.argv.slice(2);

if (!args.includes('--plan') || !args.includes('--title')) {
  console.error('Usage: node scripts/session/runAskImplementationBeginAdapter.mjs --plan <md> --title <title>');
  process.exit(1);
}

const result = spawnSync(process.execPath, [askBin, 'implementation', 'begin', ...args], {
  cwd: process.cwd(),
  encoding: 'utf8',
  stdio: ['ignore', 'pipe', 'pipe'],
});

if (result.stdout) {
  process.stdout.write(result.stdout);
}
if (result.stderr) {
  process.stderr.write(result.stderr);
}

process.exit(result.status ?? 1);
