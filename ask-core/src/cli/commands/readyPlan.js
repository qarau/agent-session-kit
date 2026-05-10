import { ReadyPlanCommitRuntime } from '../../core/ReadyPlanCommitRuntime.js';

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

function printResult(payload) {
  console.log(JSON.stringify(payload, null, 2));
  if (!payload.ok) {
    process.exitCode = 1;
  }
}

function printUsage() {
  console.log('Usage: ask ready-plan commit --title <text> --source <md> --plan-json <json> [--plan-id <id>]');
}

export async function runReadyPlan(subcommand, args = []) {
  if (normalize(subcommand) === 'commit') {
    const runtime = new ReadyPlanCommitRuntime(process.cwd());
    const result = await runtime.commit({
      title: getArgValue(args, '--title'),
      sourceMarkdownPath: getArgValue(args, '--source'),
      planJsonPath: getArgValue(args, '--plan-json'),
      planId: getArgValue(args, '--plan-id'),
    });
    printResult(result);
    return;
  }

  printUsage();
}
