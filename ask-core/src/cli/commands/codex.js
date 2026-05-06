import { ContextBudgetManager } from '../../integrations/codex/ContextBudgetManager.js';
import { CodexLaunchRuntime } from '../../core/CodexLaunchRuntime.js';

function printUsage() {
  console.log('Usage: ask codex [launch] [--command <bin>] [--command-arg <arg>] [--operation <name>] [--timeout-ms <n>] [--allow-fail-open] [--fail-open-reason <text>] [--approved-by <id>] [--approval-ticket <id>] [--touched-file <path>] [-- <args...>] | ask codex direct --reason <text> [--approved-by <id>] [--approval-ticket <id>] [--command <bin>] [--command-arg <arg>] [--operation <name>] [--timeout-ms <n>] [--touched-file <path>] [-- <args...>] | ask codex context status|ensure|compact');
}

function printPayload(payload) {
  console.log(JSON.stringify(payload, null, 2));
}

function parseLaunchArgs(args = []) {
  const sentinelIndex = args.indexOf('--');
  const forwarded = sentinelIndex >= 0 ? args.slice(sentinelIndex + 1) : [];
  const parsed = sentinelIndex >= 0 ? args.slice(0, sentinelIndex) : [...args];
  const commandArgs = [];
  const touchedFiles = [];
  const passthrough = [];
  let command = '';
  let operation = 'codex-launch';
  let allowFailOpen = false;
  let reason = '';
  let failOpenReason = '';
  let overrideApprovedBy = '';
  let overrideApprovalTicket = '';
  let timeoutMs = 0;

  for (let index = 0; index < parsed.length; index += 1) {
    const value = parsed[index];
    if (value === '--allow-fail-open') {
      allowFailOpen = true;
      continue;
    }
    if (value === '--command') {
      command = String(parsed[index + 1] || '');
      index += 1;
      continue;
    }
    if (value === '--command-arg') {
      commandArgs.push(String(parsed[index + 1] || ''));
      index += 1;
      continue;
    }
    if (value === '--operation') {
      operation = String(parsed[index + 1] || operation);
      index += 1;
      continue;
    }
    if (value === '--reason') {
      reason = String(parsed[index + 1] || '');
      index += 1;
      continue;
    }
    if (value === '--fail-open-reason') {
      failOpenReason = String(parsed[index + 1] || '');
      index += 1;
      continue;
    }
    if (value === '--approved-by') {
      overrideApprovedBy = String(parsed[index + 1] || '');
      index += 1;
      continue;
    }
    if (value === '--approval-ticket') {
      overrideApprovalTicket = String(parsed[index + 1] || '');
      index += 1;
      continue;
    }
    if (value === '--timeout-ms') {
      const parsedTimeout = Number(parsed[index + 1] || 0);
      timeoutMs = Number.isFinite(parsedTimeout) && parsedTimeout > 0 ? Math.floor(parsedTimeout) : 0;
      index += 1;
      continue;
    }
    if (value === '--touched-file') {
      touchedFiles.push(String(parsed[index + 1] || ''));
      index += 1;
      continue;
    }
    passthrough.push(String(value));
  }

  return {
    command: command || 'codex',
    args: [...commandArgs, ...passthrough, ...forwarded],
    operation,
    allowFailOpen,
    touchedFiles: touchedFiles.filter(Boolean),
    reason: reason.trim(),
    failOpenReason: failOpenReason.trim(),
    overrideApprovedBy: overrideApprovedBy.trim(),
    overrideApprovalTicket: overrideApprovalTicket.trim(),
    timeoutMs,
  };
}

export async function runCodex(subcommand, args = []) {
  const runtime = new CodexLaunchRuntime(process.cwd());
  if (subcommand === 'help' || subcommand === '--help' || subcommand === '-h') {
    printUsage();
    return;
  }

  if (subcommand === 'launch') {
    const options = parseLaunchArgs(args);
    const payload = await runtime.launch(options);
    printPayload(payload);
    if (!payload.ok) {
      process.exitCode = 1;
    }
    return;
  }

  if (subcommand === 'direct') {
    const options = parseLaunchArgs(args);
    const payload = await runtime.directLaunch(options);
    printPayload(payload);
    if (!payload.ok) {
      process.exitCode = 1;
    }
    return;
  }

  if (subcommand && subcommand !== 'context') {
    const options = parseLaunchArgs([subcommand, ...args]);
    const payload = await runtime.launch(options);
    printPayload(payload);
    if (!payload.ok) {
      process.exitCode = 1;
    }
    return;
  }

  if (!subcommand) {
    const options = parseLaunchArgs(args);
    const payload = await runtime.launch(options);
    printPayload(payload);
    if (!payload.ok) {
      process.exitCode = 1;
    }
    return;
  }

  const action = args[0] || 'status';
  if (!['status', 'ensure', 'compact'].includes(action)) {
    printUsage();
    return;
  }

  const manager = new ContextBudgetManager(process.cwd());

  if (action === 'status') {
    const payload = await manager.status();
    printPayload(payload);
    return;
  }

  if (action === 'ensure') {
    const payload = await manager.ensure();
    printPayload(payload);
    return;
  }

  const payload = await manager.compact();
  printPayload(payload);
  if (!payload.ok) {
    process.exitCode = 1;
  }
}
