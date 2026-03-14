import { ReleaseTrainRuntime } from '../../core/ReleaseTrainRuntime.js';

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
  console.log('Usage: ask release create|link-feature|status');
}

function printResult(payload) {
  console.log(JSON.stringify(payload, null, 2));
  if (!payload.ok) {
    process.exitCode = 1;
  }
}

export async function runRelease(subcommand, args = []) {
  const runtime = new ReleaseTrainRuntime(process.cwd());

  if (subcommand === 'create') {
    const releaseId = args[0] ?? '';
    const title = getArgValue(args, '--title');
    const payload = await runtime.create(releaseId, title);
    printResult(payload);
    return;
  }

  if (subcommand === 'link-feature') {
    const releaseId = args[0] ?? '';
    const featureId = getArgValue(args, '--feature');
    const payload = await runtime.linkFeature(releaseId, featureId);
    printResult(payload);
    return;
  }

  if (subcommand === 'status') {
    const releaseId = args[0] ?? '';
    const payload = await runtime.status(releaseId);
    printResult(payload);
    return;
  }

  printUsage();
}
