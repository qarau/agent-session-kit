import { EventLedger } from '../../runtime/EventLedger.js';
import { PolicyEngine } from '../../core/PolicyEngine.js';
import { FlowRuntime } from '../../core/FlowRuntime.js';

function normalize(value) {
  return String(value ?? '').trim();
}

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

function printUsage() {
  console.log('Usage: ask flow status | ask flow list | ask flow validate --last | ask flow discover --last | ask flow promote <flow-id> --to <stage> --reason <text> [--approved-by <id>] [--approval-ticket <id>]');
}

function findLatestByType(events, type) {
  const matches = events.filter(event => normalize(event?.type) === type);
  if (matches.length < 1) {
    return null;
  }
  return matches[matches.length - 1];
}

function findLatestValidationEvent(events) {
  const matches = events.filter(event => normalize(event?.type).startsWith('Validation'));
  if (matches.length < 1) {
    return null;
  }
  return matches[matches.length - 1];
}

function normalizeExecution(payload = {}) {
  const status = normalize(payload.status).toLowerCase();
  return {
    ...payload,
    ok: status === 'completed' && Number(payload.exitCode) === 0,
    touchedFiles: Array.isArray(payload.touchedFiles) ? payload.touchedFiles : [],
  };
}

export async function runFlow(subcommand, args = []) {
  const action = String(subcommand || 'status').trim();
  const runtime = new FlowRuntime(process.cwd());
  const policyEngine = new PolicyEngine(process.cwd());

  if (action === 'status') {
    const payload = await runtime.readStatus();
    console.log(JSON.stringify(payload, null, 2));
    return;
  }

  if (action === 'list') {
    const payload = await runtime.listFlows();
    console.log(JSON.stringify(payload, null, 2));
    return;
  }

  if (action === 'promote') {
    const flowId = String(args[0] ?? '');
    const policy = await policyEngine.load();
    const payload = await runtime.promoteFlow({
      flowId,
      toStage: getArgValue(args.slice(1), '--to'),
      reason: getArgValue(args.slice(1), '--reason'),
      approvedBy: getArgValue(args.slice(1), '--approved-by'),
      approvalTicket: getArgValue(args.slice(1), '--approval-ticket'),
      policy,
    });
    console.log(JSON.stringify(payload, null, 2));
    if (!payload.ok) {
      process.exitCode = 1;
    }
    return;
  }

  if (action === 'discover' && args.includes('--last')) {
    const ledger = new EventLedger(process.cwd());
    const events = await ledger.readAll();
    const latestSlice = findLatestByType(events, 'SliceCreated');
    const latestExecution = findLatestByType(events, 'CodexExecutionCaptured');
    const latestValidation = findLatestValidationEvent(events);

    if (!latestSlice || !latestExecution) {
      console.log(JSON.stringify({
        ok: false,
        code: 'missing-runtime-evidence',
        message: 'SliceCreated and CodexExecutionCaptured events are required',
      }, null, 2));
      process.exitCode = 1;
      return;
    }

    const policy = await policyEngine.load();
    const payload = await runtime.discover({
      slice: latestSlice.payload || {},
      execution: normalizeExecution(latestExecution.payload || {}),
      validation: latestValidation?.payload || {},
      policy,
    });
    console.log(JSON.stringify({
      ok: payload.ok !== false,
      discovery: payload,
      source: {
        sliceSeq: latestSlice.seq,
        executionSeq: latestExecution.seq,
        validationSeq: latestValidation?.seq || 0,
      },
    }, null, 2));
    return;
  }

  if (action !== 'validate' || !args.includes('--last')) {
    printUsage();
    return;
  }

  const ledger = new EventLedger(process.cwd());
  const events = await ledger.readAll();
  const latestSlice = findLatestByType(events, 'SliceCreated');
  const latestExecution = findLatestByType(events, 'CodexExecutionCaptured');
  const latestValidation = findLatestValidationEvent(events);

  if (!latestSlice || !latestExecution || !latestValidation) {
    console.log(JSON.stringify({
      ok: false,
      code: 'missing-runtime-evidence',
      message: 'SliceCreated, CodexExecutionCaptured, and Validation* events are required',
    }, null, 2));
    process.exitCode = 1;
    return;
  }

  const policy = await policyEngine.load();
  const payload = await runtime.validate({
    slice: latestSlice.payload || {},
    execution: normalizeExecution(latestExecution.payload || {}),
    validation: latestValidation.payload || {},
    policy,
  });
  const ok = payload.blocking !== true && normalize(payload.status).toLowerCase() !== 'failed';
  console.log(JSON.stringify({
    ok,
    flow: payload,
    source: {
      sliceSeq: latestSlice.seq,
      executionSeq: latestExecution.seq,
      validationSeq: latestValidation.seq,
    },
  }, null, 2));
  if (!ok) {
    process.exitCode = 1;
  }
}
