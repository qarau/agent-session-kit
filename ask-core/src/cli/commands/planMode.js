import { PlanModeHandoffRuntime } from '../../core/PlanModeHandoffRuntime.js';

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
  console.log('Usage: ask plan-mode handoff --title <text> --source <md> --plan-json <json> [--task <taskId>] [--run-id <runId>] [--workflow <name>] [--skill <name>] [--force-new-batch] [--dry-run]');
}

function printResult(payload) {
  console.log(JSON.stringify(payload, null, 2));
  if (!payload.ok) {
    process.exitCode = 1;
  }
}

export async function runPlanMode(subcommand, args = []) {
  if (normalize(subcommand) === 'handoff') {
    const runtime = new PlanModeHandoffRuntime(process.cwd());
    const result = await runtime.handoff({
      title: getArgValue(args, '--title'),
      sourceMarkdownPath: getArgValue(args, '--source'),
      planJsonPath: getArgValue(args, '--plan-json'),
      taskId: getArgValue(args, '--task'),
      runId: getArgValue(args, '--run-id'),
      workflow: getArgValue(args, '--workflow'),
      skill: getArgValue(args, '--skill'),
      forceNewBatch: hasFlag(args, '--force-new-batch'),
      dryRun: hasFlag(args, '--dry-run'),
    });
    printResult(result);
    return;
  }

  printUsage();
}
