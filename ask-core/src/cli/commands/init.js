import { Scaffolder } from '../../fs/Scaffolder.js';

export async function runInit() {
  const scaffolder = new Scaffolder(process.cwd());
  await scaffolder.init();
  console.log('[ask-core] initialized .ask control plane');
}
