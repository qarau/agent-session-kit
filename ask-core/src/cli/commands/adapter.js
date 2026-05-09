import { resolveActiveAdapter } from '../../adapters/AdapterResolutionRuntime.js';

function printJson(payload) {
  console.log(JSON.stringify(payload, null, 2));
}

function getOptionValue(args, optionName) {
  const index = args.indexOf(optionName);
  if (index === -1) {
    return '';
  }
  return args[index + 1] || '';
}

export async function runAdapter(subcommand, args = []) {
  if (subcommand !== 'resolve') {
    printJson({
      ok: false,
      code: 'unknown-adapter-command',
      message: 'Usage: ask adapter resolve [--adapter node]',
    });
    process.exitCode = 1;
    return;
  }

  const result = resolveActiveAdapter({
    cwd: process.cwd(),
    explicitAdapterId: getOptionValue(args, '--adapter'),
  });
  printJson(result);

  if (result.ok === false) {
    process.exitCode = 1;
  }
}
