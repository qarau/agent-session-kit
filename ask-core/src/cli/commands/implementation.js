import { ImplementationPreflightRuntime } from '../../core/ImplementationPreflightRuntime.js';

function normalize(value) {
  return String(value ?? '').trim();
}

function hasFlag(args, name) {
  return args.some(value => value === name || String(value).startsWith(`${name}=`));
}

function printUsage() {
  console.log('Usage: ask implementation preflight [--advisory]');
}

function printResult(payload) {
  console.log(JSON.stringify(payload, null, 2));
  if (!payload.ok) {
    process.exitCode = 1;
  }
}

export async function runImplementation(subcommand, args = []) {
  if (normalize(subcommand) === 'preflight') {
    const runtime = new ImplementationPreflightRuntime(process.cwd());
    const result = await runtime.preflight({
      advisory: hasFlag(args, '--advisory'),
    });
    printResult(result);
    return;
  }

  printUsage();
}
