import { ChildSessionRuntime } from '../../core/ChildSessionRuntime.js';

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
  console.log('Usage: ask child-session spawn|status');
}

function printResult(payload) {
  console.log(JSON.stringify(payload, null, 2));
  if (!payload.ok) {
    process.exitCode = 1;
  }
}

export async function runChildSession(subcommand, args = []) {
  const runtime = new ChildSessionRuntime(process.cwd());

  if (subcommand === 'spawn') {
    const taskId = args[0] ?? '';
    const agentId = getArgValue(args, '--agent');
    const childSessionId = getArgValue(args, '--child');
    const payload = await runtime.spawn(taskId, agentId, childSessionId);
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
