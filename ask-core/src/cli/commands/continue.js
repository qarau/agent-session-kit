import { AutonomousContinuationRuntime } from '../../core/AutonomousContinuationRuntime.js';

function getArgValue(args, name) {
  for (let index = 0; index < args.length; index += 1) {
    const value = String(args[index] ?? '');
    if (value === name) {
      return String(args[index + 1] ?? '');
    }
    if (value.startsWith(`${name}=`)) {
      return value.slice(name.length + 1);
    }
  }
  return '';
}

function collectArgValues(args, name) {
  const values = [];
  for (let index = 0; index < args.length; index += 1) {
    const value = String(args[index] ?? '');
    if (value === name) {
      values.push(String(args[index + 1] ?? ''));
      index += 1;
      continue;
    }
    if (value.startsWith(`${name}=`)) {
      values.push(value.slice(name.length + 1));
    }
  }
  return values.filter(Boolean);
}

function printUsage() {
  console.log('Usage: ask continue [--once] [--max-slices <n>] [--until blocked|complete] [--command <bin>] [--command-arg <arg>] [--operation <name>] [--allowed-command <cmd>] [--timeout-ms <n>]');
}

export async function runContinue(args = []) {
  if (args.includes('--help') || args.includes('-h')) {
    printUsage();
    return;
  }

  const runtime = new AutonomousContinuationRuntime(process.cwd());
  const once = args.includes('--once');
  const maxSlicesRaw = getArgValue(args, '--max-slices');
  const maxSlices = Number.isFinite(Number(maxSlicesRaw)) ? Number(maxSlicesRaw) : 0;
  const timeoutMsRaw = getArgValue(args, '--timeout-ms');
  const timeoutMs = Number.isFinite(Number(timeoutMsRaw)) ? Number(timeoutMsRaw) : 0;
  const payload = await runtime.run({
    once,
    maxSlices: maxSlices > 0 ? Math.floor(maxSlices) : 0,
    until: getArgValue(args, '--until'),
    command: getArgValue(args, '--command'),
    commandArgs: collectArgValues(args, '--command-arg'),
    operation: getArgValue(args, '--operation'),
    allowedCommands: collectArgValues(args, '--allowed-command'),
    timeoutMs: timeoutMs > 0 ? Math.floor(timeoutMs) : 0,
  });
  console.log(JSON.stringify(payload, null, 2));
  if (!payload.ok) {
    process.exitCode = 1;
  }
}
