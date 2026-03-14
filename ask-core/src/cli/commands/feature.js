import { FeatureRuntime } from '../../core/FeatureRuntime.js';

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
  console.log('Usage: ask feature create|link-task|status');
}

function printResult(payload) {
  console.log(JSON.stringify(payload, null, 2));
  if (!payload.ok) {
    process.exitCode = 1;
  }
}

export async function runFeature(subcommand, args = []) {
  const runtime = new FeatureRuntime(process.cwd());

  if (subcommand === 'create') {
    const featureId = args[0] ?? '';
    const title = getArgValue(args, '--title');
    const payload = await runtime.create(featureId, title);
    printResult(payload);
    return;
  }

  if (subcommand === 'link-task') {
    const featureId = args[0] ?? '';
    const taskId = getArgValue(args, '--task');
    const payload = await runtime.linkTask(featureId, taskId);
    printResult(payload);
    return;
  }

  if (subcommand === 'status') {
    const featureId = args[0] ?? '';
    const payload = await runtime.status(featureId);
    printResult(payload);
    return;
  }

  printUsage();
}
