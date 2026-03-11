import { WorkContextEngine } from '../../core/WorkContextEngine.js';

export async function runContext(subcommand) {
  const engine = new WorkContextEngine(process.cwd());
  if (subcommand === 'verify') {
    await engine.verify();
    return;
  }
  if (subcommand === 'status') {
    await engine.status();
    return;
  }
  console.log('Usage: ask context verify|status');
}
