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

export async function runEvidence(subcommand, args = []) {
  const runtime = new VerificationRuntime(process.cwd());

  if (subcommand === 'attach') {
    const taskId = args[0] ?? '';
    const kind = getArgValue(args, '--kind');
    const filePath = getArgValue(args, '--path');
    const summary = getArgValue(args, '--summary');
    const result = await runtime.attach(taskId, kind, filePath, summary);
    printResult(result);
    return;
  }

  console.log('Usage: ask evidence attach <taskId> --kind <kind> --path <path> [--summary "..."]');
}
