import { Scaffolder } from '../../fs/Scaffolder.js';

function hasFlag(args, name) {
  return args.some(value => String(value ?? '').trim() === name);
}

export async function runInit(args = []) {
  const scaffolder = new Scaffolder(process.cwd());
  await scaffolder.init({
    resetRuntime: hasFlag(args, '--reset-runtime'),
  });
  console.log('[ask-core] initialized .ask control plane');
}
