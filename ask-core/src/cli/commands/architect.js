import { ArchitectRuntime } from '../../core/ArchitectRuntime.js';
import { OhderLawPackEngine } from '../../core/OhderLawPackEngine.js';

function getArgValue(args, name) {
  for (let index = 0; index < args.length; index += 1) {
    const value = String(args[index] ?? '');
    if (value === name) {
      return String(args[index + 1] ?? '');
    }
    if (value.startsWith(`${name}=`)) {
      return value.slice(name.length + 1);
    }
  }
  return '';
}

function normalize(value) {
  return String(value ?? '').trim();
}

function printUsage() {
  console.log('Usage: ask architect status | ask architect exempt list | ask architect exempt add --law-id <id> --reason <text> --approved-by <id> [--operation <name>] [--session-id <id>] [--expires-at <iso>]');
}

export async function runArchitect(subcommand, args = []) {
  const action = String(subcommand || 'status').trim();
  const runtime = new ArchitectRuntime(process.cwd());

  if (action === 'status') {
    const payload = await runtime.readStatus();
    console.log(JSON.stringify(payload, null, 2));
    return;
  }

  if (action === 'exempt') {
    const engine = new OhderLawPackEngine(process.cwd());
    const exemptAction = String(args[0] || 'list').trim();
    if (exemptAction === 'list') {
      const exemptions = await engine.listExemptions();
      console.log(JSON.stringify({
        ok: true,
        exemptions,
      }, null, 2));
      return;
    }
    if (exemptAction === 'add') {
      const lawId = normalize(getArgValue(args.slice(1), '--law-id'));
      const reason = normalize(getArgValue(args.slice(1), '--reason'));
      const approvedBy = normalize(getArgValue(args.slice(1), '--approved-by'));
      if (!lawId) {
        console.log(JSON.stringify({
          ok: false,
          code: 'missing-law-id',
          message: '--law-id is required',
        }, null, 2));
        process.exitCode = 1;
        return;
      }
      if (reason.length < 10) {
        console.log(JSON.stringify({
          ok: false,
          code: 'invalid-reason',
          message: '--reason must be at least 10 characters',
        }, null, 2));
        process.exitCode = 1;
        return;
      }
      if (!approvedBy) {
        console.log(JSON.stringify({
          ok: false,
          code: 'missing-approved-by',
          message: '--approved-by is required',
        }, null, 2));
        process.exitCode = 1;
        return;
      }
      const added = await engine.addExemption({
        lawId,
        reason,
        approvedBy,
        operation: normalize(getArgValue(args.slice(1), '--operation')),
        sessionId: normalize(getArgValue(args.slice(1), '--session-id')),
        expiresAt: normalize(getArgValue(args.slice(1), '--expires-at')),
      });
      console.log(JSON.stringify({
        ok: true,
        ...added,
      }, null, 2));
      return;
    }
    printUsage();
    return;
  }

  printUsage();
}
