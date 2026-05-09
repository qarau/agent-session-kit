import { ImplementationPreflightRuntime } from '../../core/ImplementationPreflightRuntime.js';
import { ImplementationBeginRuntime } from '../../core/ImplementationBeginRuntime.js';

function normalize(value) {
  return String(value ?? '').trim();
}

function hasFlag(args, name) {
  return args.some(value => value === name || String(value).startsWith(`${name}=`));
}

function getArgValue(args, name) {
  for (let index = 0; index < args.length; index += 1) {
    const value = args[index];
    if (value === name) {
      return args[index + 1] ?? '';
    }
    if (value.startsWith(`${name}=`)) {
      return value.slice(name.length + 1);
    }
  }
  return '';
}

function printUsage() {
  console.log('Usage: ask implementation begin --title <text> --plan <md> [--prefix <prefix>] [--task <taskId>] [--run-id <runId>]\n       ask implementation preflight [--advisory]');
}

function printResult(payload) {
  console.log(JSON.stringify(payload, null, 2));
  if (!payload.ok) {
    process.exitCode = 1;
  }
}

export async function runImplementation(subcommand, args = []) {
  if (normalize(subcommand) === 'begin') {
    const runtime = new ImplementationBeginRuntime(process.cwd());
    const result = await runtime.begin({
      title: getArgValue(args, '--title'),
      planPath: getArgValue(args, '--plan'),
      planPrefix: getArgValue(args, '--prefix'),
      date: getArgValue(args, '--date'),
      taskId: getArgValue(args, '--task'),
      runId: getArgValue(args, '--run-id'),
      workflow: getArgValue(args, '--workflow'),
      skill: getArgValue(args, '--skill'),
      forceNewBatch: hasFlag(args, '--force-new-batch'),
    });
    printResult(result);
    return;
  }

  if (normalize(subcommand) === 'preflight') {
    const runtime = new ImplementationPreflightRuntime(process.cwd());
    const result = await runtime.preflight({
      advisory: hasFlag(args, '--advisory'),
    });
    printResult(result);
    return;
  }

  printUsage();
}
