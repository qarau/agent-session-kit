import process from 'node:process';

const rawCode = Number(process.argv[2] ?? '1');
const exitCode = Number.isFinite(rawCode) ? rawCode : 1;
process.stdout.write(`exiting-${String(exitCode)}\n`);
process.exit(exitCode);
