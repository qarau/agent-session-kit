import { ExecutionPolicyRuntime } from '../../core/ExecutionPolicyRuntime.js';

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
  console.log('Usage: ask policy classify|apply|status');
}

function printResult(payload) {
  console.log(JSON.stringify(payload, null, 2));
  if (!payload.ok) {
    process.exitCode = 1;
  }
}

export async function runPolicy(subcommand, args = []) {
  const runtime = new ExecutionPolicyRuntime(process.cwd());

  if (subcommand === 'classify') {
    const taskId = args[0] ?? '';
    const queueClass = getArgValue(args, '--queue-class');
    const payload = await runtime.classify(taskId, queueClass);
    printResult(payload);
    return;
  }

  if (subcommand === 'apply') {
    const taskId = args[0] ?? '';
    const queueClass = getArgValue(args, '--queue-class');
    const payload = await runtime.apply(taskId, queueClass);
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
