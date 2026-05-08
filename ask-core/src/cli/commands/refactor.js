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
  console.log('Usage: ask refactor preview|create');
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
    printResult(await runtime.create({ requestedBy }));
    return;
  }

  printUsage();
}
