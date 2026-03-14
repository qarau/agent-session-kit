import { RolloutRuntime } from '../../core/RolloutRuntime.js';

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
  console.log('Usage: ask rollout start|phase|status');
}

function printResult(payload) {
  console.log(JSON.stringify(payload, null, 2));
  if (!payload.ok) {
    process.exitCode = 1;
  }
}

export async function runRollout(subcommand, args = []) {
  const runtime = new RolloutRuntime(process.cwd());

  if (subcommand === 'start') {
    const featureId = args[0] ?? '';
    const phase = getArgValue(args, '--phase');
    const payload = await runtime.start(featureId, phase);
    printResult(payload);
    return;
  }

  if (subcommand === 'phase') {
    const featureId = args[0] ?? '';
    const phase = getArgValue(args, '--phase');
    const payload = await runtime.phase(featureId, phase);
    printResult(payload);
    return;
  }

  if (subcommand === 'status') {
    const featureId = args[0] ?? '';
    const payload = await runtime.status(featureId);
    printResult(payload);
    return;
  }

  printUsage();
}
