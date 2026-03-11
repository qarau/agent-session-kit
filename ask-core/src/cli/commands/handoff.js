import { HandoffEngine } from '../../core/HandoffEngine.js';

export async function runHandoff(subcommand) {
  const engine = new HandoffEngine(process.cwd());
  if (subcommand === 'create') {
    await engine.create();
    return;
  }
  console.log('Usage: ask handoff create');
}
