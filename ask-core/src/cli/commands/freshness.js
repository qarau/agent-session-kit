import { FreshnessRuntime } from '../../core/FreshnessRuntime.js';

function printUsage() {
  console.log('Usage: ask freshness status|explain [task-id]');
}

function printResult(payload) {
  console.log(JSON.stringify(payload, null, 2));
  if (!payload.ok) {
    process.exitCode = 1;
  }
}

export async function runFreshness(subcommand, args = []) {
  const runtime = new FreshnessRuntime(process.cwd());
  const taskId = args[0] ?? '';

  if (subcommand === 'status') {
    const payload = await runtime.status(taskId);
    printResult(payload);
    return;
  }

  if (subcommand === 'explain') {
    const payload = await runtime.explain(taskId);
    printResult(payload);
    return;
  }

  printUsage();
}
