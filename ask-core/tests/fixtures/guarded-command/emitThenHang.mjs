import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const counterPath = process.argv[2] ?? '';

if (!counterPath) {
  console.error('counter path required');
  process.exit(2);
}

let attempts = 0;
try {
  attempts = Number(fs.readFileSync(counterPath, 'utf8').trim()) || 0;
} catch {
  attempts = 0;
}

attempts += 1;
fs.mkdirSync(path.dirname(counterPath), { recursive: true });
fs.writeFileSync(counterPath, `${String(attempts)}\n`, 'utf8');

if (attempts === 1) {
  process.stdout.write('first-attempt-output\n');
  setInterval(() => {}, 1000);
} else {
  process.stdout.write('second-attempt-success\n');
  process.exit(0);
}
