import { OhderRefactorMaterializationRuntime } from '../../core/OhderRefactorMaterializationRuntime.js';

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
  console.log('Usage: ask refactor preview|create|approve|reject');
}

function printResult(result) {
  console.log(JSON.stringify(result, null, 2));
  if (!result.ok) {
    process.exitCode = 1;
  }
}

export async function runRefactor(subcommand, args = []) {
  const runtime = new OhderRefactorMaterializationRuntime(process.cwd());

  if (subcommand === 'preview') {
    printResult(await runtime.preview());
    return;
  }

  if (subcommand === 'create') {
    const requestedBy = getArgValue(args, '--requested-by') || 'local';
    const auto = args.includes('--auto');
    printResult(await runtime.create({ requestedBy, auto }));
    return;
  }

  if (subcommand === 'approve') {
    const taskId = args[0] ?? '';
    const approvedBy = getArgValue(args, '--approved-by') || 'local';
    printResult(await runtime.approve(taskId, { approvedBy }));
    return;
  }

  if (subcommand === 'reject') {
    const taskId = args[0] ?? '';
    const reason = getArgValue(args, '--reason');
    const rejectedBy = getArgValue(args, '--rejected-by') || 'local';
    printResult(await runtime.reject(taskId, { reason, rejectedBy }));
    return;
  }

  printUsage();
}

