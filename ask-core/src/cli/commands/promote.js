import { PromotionRuntime } from '../../core/PromotionRuntime.js';

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
  console.log('Usage: ask promote require|pass|advance|status');
}

function printResult(payload) {
  console.log(JSON.stringify(payload, null, 2));
  if (!payload.ok) {
    process.exitCode = 1;
  }
}

export async function runPromote(subcommand, args = []) {
  const runtime = new PromotionRuntime(process.cwd());

  if (subcommand === 'require') {
    const featureId = args[0] ?? '';
    const gateId = getArgValue(args, '--gate');
    const payload = await runtime.require(featureId, gateId);
    printResult(payload);
    return;
  }

  if (subcommand === 'pass') {
    const featureId = args[0] ?? '';
    const gateId = getArgValue(args, '--gate');
    const payload = await runtime.pass(featureId, gateId);
    printResult(payload);
    return;
  }

  if (subcommand === 'advance') {
    const featureId = args[0] ?? '';
    const stage = getArgValue(args, '--stage');
    const payload = await runtime.advance(featureId, stage);
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
