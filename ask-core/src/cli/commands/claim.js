import { ClaimRuntime } from '../../core/ClaimRuntime.js';

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
  console.log('Usage: ask claim acquire|release|lock|status');
}

function printResult(payload) {
  console.log(JSON.stringify(payload, null, 2));
  if (!payload.ok) {
    process.exitCode = 1;
  }
}

export async function runClaim(subcommand, args = []) {
  const runtime = new ClaimRuntime(process.cwd());

  if (subcommand === 'acquire') {
    const taskId = args[0] ?? '';
    const agentId = getArgValue(args, '--agent');
    const scope = getArgValue(args, '--scope') || 'task';
    const payload = await runtime.acquire(taskId, agentId, scope);
    printResult(payload);
    return;
  }

  if (subcommand === 'release') {
    const taskId = args[0] ?? '';
    const agentId = getArgValue(args, '--agent');
    const scope = getArgValue(args, '--scope') || 'task';
    const payload = await runtime.release(taskId, agentId, scope);
    printResult(payload);
    return;
  }

  if (subcommand === 'lock') {
    const taskId = args[0] ?? '';
    const agentId = getArgValue(args, '--agent');
    const scope = getArgValue(args, '--scope') || 'task';
    const payload = await runtime.lock(taskId, agentId, scope);
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
