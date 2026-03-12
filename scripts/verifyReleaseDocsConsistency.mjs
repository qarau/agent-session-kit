import process from 'node:process';
import path from 'node:path';
import { ReleaseDocsConsistencyEngine } from '../ask-core/src/core/ReleaseDocsConsistencyEngine.js';

function getArgValue(argv, name, fallback) {
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === name) {
      const next = argv[index + 1];
      if (!next || next.startsWith('--')) {
        return fallback;
      }
      return next;
    }
    if (arg.startsWith(`${name}=`)) {
      return arg.slice(name.length + 1);
    }
  }
  return fallback;
}

function main() {
  const argv = process.argv.slice(2);
  const rootDir = path.resolve(process.cwd(), getArgValue(argv, '--root', '.'));
  const engine = new ReleaseDocsConsistencyEngine();
  const errors = engine.verify(rootDir);

  if (errors.length > 0) {
    console.error('[release-docs] guard failed');
    for (const error of errors) {
      console.error(` - ${error}`);
    }
    process.exit(1);
  }

  console.log('[release-docs] OK');
}

main();
