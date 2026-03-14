import { WorkflowRuntime } from '../../core/WorkflowRuntime.js';

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
  console.log('Usage: ask workflow recommend|start|artifact|complete|fail');
}

export async function runWorkflow(subcommand, args = []) {
  const runtime = new WorkflowRuntime(process.cwd());

  if (subcommand === 'recommend') {
    const taskId = args[0] ?? '';
    const workflow = getArgValue(args, '--workflow') || 'superpowers';
    const result = await runtime.recommend(taskId, workflow);
    printResult(result);
    return;
  }

  if (subcommand === 'start') {
    const taskId = args[0] ?? '';
    const workflow = getArgValue(args, '--workflow');
    const skill = getArgValue(args, '--skill');
    const runId = getArgValue(args, '--run-id');
    const result = await runtime.start(taskId, workflow, skill, runId);
    printResult(result);
    return;
  }

  if (subcommand === 'artifact') {
    const taskId = args[0] ?? '';
    const runId = getArgValue(args, '--run-id');
    const type = getArgValue(args, '--type');
    const artifactPath = getArgValue(args, '--path');
    const summary = getArgValue(args, '--summary');
    const result = await runtime.artifact(taskId, runId, type, artifactPath, summary);
    printResult(result);
    return;
  }

  if (subcommand === 'complete') {
    const taskId = args[0] ?? '';
    const runId = getArgValue(args, '--run-id');
    const summary = getArgValue(args, '--summary');
    const result = await runtime.complete(taskId, runId, summary);
    printResult(result);
    return;
  }

  if (subcommand === 'fail') {
    const taskId = args[0] ?? '';
    const runId = getArgValue(args, '--run-id');
    const summary = getArgValue(args, '--summary');
    const result = await runtime.fail(taskId, runId, summary);
    printResult(result);
    return;
  }

  printUsage();
}
