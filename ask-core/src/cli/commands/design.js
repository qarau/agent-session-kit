import { EventLedger } from '../../runtime/EventLedger.js';
import { PolicyEngine } from '../../core/PolicyEngine.js';
import { DesignRuntime } from '../../core/DesignRuntime.js';

function normalize(value) {
  return String(value ?? '').trim();
}

function printUsage() {
  console.log('Usage: ask design status | ask design list | ask design discover --last | ask design validate --last');
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

export async function runDesign(subcommand, args = []) {
  const action = String(subcommand || 'status').trim();
  const runtime = new DesignRuntime(process.cwd());
  const policyEngine = new PolicyEngine(process.cwd());

  if (action === 'status') {
    const payload = await runtime.status();
    console.log(JSON.stringify(payload, null, 2));
    return;
  }

  if (action === 'list') {
    const payload = await runtime.list();
    console.log(JSON.stringify(payload, null, 2));
    return;
  }

  if (action !== 'discover' && action !== 'validate') {
    printUsage();
    return;
  }
  if (!args.includes('--last')) {
    printUsage();
    return;
  }

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
  if (action === 'discover') {
    const payload = await runtime.discoverFromLast({
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

  const payload = await runtime.validateFromLast({
    slice: latestSlice.payload || {},
    execution: normalizeExecution(latestExecution.payload || {}),
    validation: latestValidation?.payload || {},
    policy,
  });
  const ok = payload.blocking !== true;
  console.log(JSON.stringify({
    ok,
    design: payload,
    source: {
      sliceSeq: latestSlice.seq,
      executionSeq: latestExecution.seq,
      validationSeq: latestValidation?.seq || 0,
    },
  }, null, 2));
  if (!ok) {
    process.exitCode = 1;
  }
}

