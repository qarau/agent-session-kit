import { TaskRuntime } from '../../core/TaskRuntime.js';

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
  console.log('Usage: ask task create|assign|start|status');
}

function printResult(result) {
  console.log(JSON.stringify(result, null, 2));
  if (!result.ok) {
    process.exitCode = 1;
  }
}

export async function runTask(subcommand, args = []) {
  const runtime = new TaskRuntime(process.cwd());

  if (subcommand === 'create') {
    const taskId = args[0] ?? '';
    const title = getArgValue(args, '--title');
    const description = getArgValue(args, '--description');
    const result = await runtime.create(taskId, title, description);
    printResult(result);
    return;
  }

  if (subcommand === 'assign') {
    const taskId = args[0] ?? '';
    const owner = getArgValue(args, '--owner');
    const result = await runtime.assign(taskId, owner);
    printResult(result);
    return;
  }

  if (subcommand === 'start') {
    const taskId = args[0] ?? '';
    const result = await runtime.start(taskId);
    printResult(result);
    return;
  }

  if (subcommand === 'status') {
    const taskId = args[0] ?? '';
    const result = await runtime.status(taskId);
    printResult(result);
    return;
  }

  printUsage();
}
