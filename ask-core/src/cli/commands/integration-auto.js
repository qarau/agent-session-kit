import { AutoIntegrationRuntime } from '../../core/AutoIntegrationRuntime.js';

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
  console.log('Usage: ask integration-auto run|status');
}

function printResult(payload) {
  console.log(JSON.stringify(payload, null, 2));
  if (!payload.ok) {
    process.exitCode = 1;
  }
}

export async function runIntegrationAuto(subcommand, args = []) {
  const runtime = new AutoIntegrationRuntime(process.cwd());

  if (subcommand === 'run') {
    const taskId = args[0] ?? '';
    const runId = getArgValue(args, '--run-id');
    const command = getArgValue(args, '--command');
    const payload = await runtime.run(taskId, {
      runId,
      command,
    });
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
