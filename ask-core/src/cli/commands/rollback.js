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
  console.log('Usage: ask rollback trigger');
}

function printResult(payload) {
  console.log(JSON.stringify(payload, null, 2));
  if (!payload.ok) {
    process.exitCode = 1;
  }
}

export async function runRollback(subcommand, args = []) {
  const runtime = new RolloutRuntime(process.cwd());

  if (subcommand === 'trigger') {
    const featureId = args[0] ?? '';
    const reason = getArgValue(args, '--reason');
    const payload = await runtime.rollback(featureId, reason);
    printResult(payload);
    return;
  }

  printUsage();
}
