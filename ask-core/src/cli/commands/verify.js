import { VerificationRuntime } from '../../core/VerificationRuntime.js';

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

export async function runVerify(subcommand, args = []) {
  if (subcommand !== 'pass' && subcommand !== 'fail') {
    console.log('Usage: ask verify pass|fail <taskId> [--summary "..."]');
    return;
  }

  const runtime = new VerificationRuntime(process.cwd());
  const taskId = args[0] ?? '';
  const summary = getArgValue(args, '--summary');
  const result = await runtime.verify(taskId, subcommand, summary);
  printResult(result);
}
