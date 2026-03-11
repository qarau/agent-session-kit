import { SessionRuntime } from '../../core/SessionRuntime.js';

export async function runSession(subcommand) {
  const runtime = new SessionRuntime(process.cwd());
  if (subcommand === 'start') {
    await runtime.start();
    return;
  }
  if (subcommand === 'resume') {
    await runtime.resume();
    return;
  }
  if (subcommand === 'status') {
    await runtime.status();
    return;
  }
  if (subcommand === 'close') {
    await runtime.close();
    return;
  }
  console.log('Usage: ask session start|resume|status|close');
}
