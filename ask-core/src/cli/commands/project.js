import { detectNodeProject } from '../../adapters/language/node/index.js';

function printJson(payload) {
  console.log(JSON.stringify(payload, null, 2));
}

export async function runProject(subcommand) {
  if (subcommand !== 'detect') {
    printJson({
      ok: false,
      code: 'unknown-project-command',
      message: 'Usage: ask project detect',
    });
    process.exitCode = 1;
    return;
  }

  const result = detectNodeProject(process.cwd());
  printJson(result);

  if (result.ok === false) {
    process.exitCode = 1;
  }
}
