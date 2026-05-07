import { buildPreviewIntent, buildPreviewSlice, hydrateRuntimePreview } from './runtimePreviewSupport.js';
import { SliceCloseRuntime } from '../../core/SliceCloseRuntime.js';

function printUsage() {
  console.log('Usage: ask slice preview [--command <bin>] [--command-arg <arg>] [--operation <name>] [--allowed-command <cmd>]');
  console.log('       ask slice close <taskId>');
}

export async function runSlice(subcommand, args = []) {
  const action = String(subcommand || 'preview');
  if (!['preview', 'close'].includes(action)) {
    printUsage();
    return;
  }

  if (action === 'close') {
    const taskId = args[0] ?? '';
    const runtime = new SliceCloseRuntime(process.cwd());
    const payload = await runtime.run(taskId);
    console.log(JSON.stringify(payload, null, 2));
    if (!payload.ok) {
      process.exitCode = 1;
    }
    return;
  }

  const { state, policy } = await hydrateRuntimePreview(process.cwd());
  const intent = buildPreviewIntent(state, policy);
  const planned = buildPreviewSlice(intent, state, policy, args);
  if (!planned.ok) {
    console.log(JSON.stringify({
      ok: false,
      code: planned.code,
      message: planned.message,
      intent,
      slice: planned.slice,
    }, null, 2));
    process.exitCode = 1;
    return;
  }

  console.log(JSON.stringify({
    ok: true,
    intent,
    slice: planned.slice,
  }, null, 2));
}
