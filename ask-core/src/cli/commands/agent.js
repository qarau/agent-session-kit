import { AgentRuntime } from '../../core/AgentRuntime.js';

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
  console.log('Usage: ask agent register|status');
}

function printResult(payload) {
  console.log(JSON.stringify(payload, null, 2));
  if (!payload.ok) {
    process.exitCode = 1;
  }
}

export async function runAgent(subcommand, args = []) {
  const runtime = new AgentRuntime(process.cwd());

  if (subcommand === 'register') {
    const agentId = args[0] ?? '';
    const capabilities = getArgValue(args, '--capabilities');
    const payload = await runtime.register(agentId, capabilities);
    printResult(payload);
    return;
  }

  if (subcommand === 'status') {
    const agentId = args[0] ?? '';
    const payload = await runtime.status(agentId);
    printResult(payload);
    return;
  }

  printUsage();
}
