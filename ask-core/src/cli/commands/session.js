import { SessionRuntime } from '../../core/SessionRuntime.js';

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

function failMissingReason(command) {
  const payload = {
    ok: false,
    code: 'missing-reason',
    command,
    message: `--reason is required for session ${command}`,
  };
  console.log(JSON.stringify(payload, null, 2));
  process.exitCode = 1;
}

function printTransitionResult(result) {
  if (!result.ok) {
    console.log(JSON.stringify(result, null, 2));
    process.exitCode = 1;
    return;
  }
  console.log(JSON.stringify(result.session, null, 2));
}

export async function runSession(subcommand, args = []) {
  const runtime = new SessionRuntime(process.cwd());
  if (subcommand === 'start') {
    const result = await runtime.start();
    printTransitionResult(result);
    return;
  }
  if (subcommand === 'pause') {
    const reason = getArgValue(args, '--reason');
    if (!reason) {
      failMissingReason('pause');
      return;
    }
    const result = await runtime.pause(reason, 'session pause');
    printTransitionResult(result);
    return;
  }
  if (subcommand === 'resume') {
    const reason = getArgValue(args, '--reason');
    if (!reason) {
      failMissingReason('resume');
      return;
    }
    const result = await runtime.resume(reason, 'session resume');
    printTransitionResult(result);
    return;
  }
  if (subcommand === 'block') {
    const reason = getArgValue(args, '--reason');
    if (!reason) {
      failMissingReason('block');
      return;
    }
    const result = await runtime.block(reason, 'session block');
    printTransitionResult(result);
    return;
  }
  if (subcommand === 'status') {
    await runtime.status();
    return;
  }
  if (subcommand === 'close') {
    const reason = getArgValue(args, '--reason');
    if (!reason) {
      failMissingReason('close');
      return;
    }
    const result = await runtime.close(reason, 'session close');
    printTransitionResult(result);
    return;
  }
  console.log('Usage: ask session start|pause|resume|block|status|close');
}
