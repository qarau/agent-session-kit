import { ContextBudgetManager } from '../../integrations/codex/ContextBudgetManager.js';

function printUsage() {
  console.log('Usage: ask codex context status|ensure|compact');
}

function printPayload(payload) {
  console.log(JSON.stringify(payload, null, 2));
}

export async function runCodex(subcommand, args = []) {
  if (subcommand !== 'context') {
    printUsage();
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
