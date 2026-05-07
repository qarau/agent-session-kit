import { PlanIngestRuntime } from '../../core/PlanIngestRuntime.js';

function normalize(value) {
  return String(value ?? '').trim();
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

function hasFlag(args, name) {
  return args.some(value => value === name || String(value).startsWith(`${name}=`));
}

function printUsage() {
  console.log('Usage: ask plan ingest --task <taskId> --run-id <runId> [--path <file>] [--force-new-batch] [--dry-run]');
  console.log('       ask plan validate --task <taskId> --run-id <runId> [--path <file>] [--force-new-batch]');
  console.log('       ask plan batch show <planBatchId>');
}

function printResult(payload) {
  console.log(JSON.stringify(payload, null, 2));
  if (!payload.ok) {
    process.exitCode = 1;
  }
}

export async function runPlan(subcommand, args = []) {
  const runtime = new PlanIngestRuntime(process.cwd());

  if (subcommand === 'ingest') {
    const taskId = normalize(getArgValue(args, '--task'));
    const runId = normalize(getArgValue(args, '--run-id'));
    const result = await runtime.ingest(taskId, runId, {
      path: normalize(getArgValue(args, '--path')),
      forceNewBatch: hasFlag(args, '--force-new-batch'),
      dryRun: hasFlag(args, '--dry-run'),
    });
    printResult(result);
    return;
  }

  if (subcommand === 'validate') {
    const taskId = normalize(getArgValue(args, '--task'));
    const runId = normalize(getArgValue(args, '--run-id'));
    const result = await runtime.validate(taskId, runId, {
      path: normalize(getArgValue(args, '--path')),
      forceNewBatch: hasFlag(args, '--force-new-batch'),
    });
    printResult(result);
    return;
  }

  if (subcommand === 'batch') {
    const action = normalize(args[0]);
    if (action === 'show') {
      const planBatchId = normalize(args[1]);
      const result = await runtime.batchShow(planBatchId);
      printResult(result);
      return;
    }
  }

  printUsage();
}
