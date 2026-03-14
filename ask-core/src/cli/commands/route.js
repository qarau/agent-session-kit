import { RoutingRuntime } from '../../core/RoutingRuntime.js';

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
  console.log('Usage: ask route recommend|status');
}

function printResult(payload) {
  console.log(JSON.stringify(payload, null, 2));
  if (!payload.ok) {
    process.exitCode = 1;
  }
}

export async function runRoute(subcommand, args = []) {
  const runtime = new RoutingRuntime(process.cwd());

  if (subcommand === 'recommend') {
    const taskId = args[0] ?? '';
    const candidates = getArgValue(args, '--candidates');
    const payload = await runtime.recommend(taskId, candidates);
    printResult(payload);
    return;
  }

  if (subcommand === 'status') {
    const taskId = args[0] ?? '';
    const payload = await runtime.status(taskId);
    printResult(payload);
    return;
  }

  printUsage();
}
