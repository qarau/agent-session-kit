import { EventLedger } from '../../runtime/EventLedger.js';
import { PolicyEngine } from '../../core/PolicyEngine.js';
import { ValidationIntelligenceEngine } from '../../core/ValidationIntelligenceEngine.js';

function normalize(value) {
  return String(value ?? '').trim();
}

function printUsage() {
  console.log('Usage: ask validate-last');
}

function findLastEvent(events, type) {
  const matches = events.filter(event => normalize(event?.type) === type);
  if (matches.length < 1) {
    return null;
  }
  return matches[matches.length - 1];
}

function normalizeExecution(latestExecutionEvent) {
  const payload = latestExecutionEvent?.payload || {};
  const status = normalize(payload.status).toLowerCase();
  return {
    ...payload,
    ok: status === 'completed' && Number(payload.exitCode) === 0,
    touchedFiles: Array.isArray(payload.touchedFiles) ? payload.touchedFiles : [],
  };
}

export async function runValidateLast(args = []) {
  if (args.includes('--help') || args.includes('-h')) {
    printUsage();
    return;
  }

  const cwd = process.cwd();
  const ledger = new EventLedger(cwd);
  const policyEngine = new PolicyEngine(cwd);
  const validationEngine = new ValidationIntelligenceEngine(cwd);
  const events = await ledger.readAll();
  const latestSlice = findLastEvent(events, 'SliceCreated');
  const latestExecution = findLastEvent(events, 'CodexExecutionCaptured');

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
  const payload = await validationEngine.validate({
    slice: latestSlice.payload || {},
    execution: normalizeExecution(latestExecution),
    policy,
  });
  const ok = payload.status === 'passed' || payload.status === 'warning';
  console.log(JSON.stringify({
    ok,
    validation: payload,
    source: {
      sliceSeq: latestSlice.seq,
      executionSeq: latestExecution.seq,
    },
  }, null, 2));
  if (!ok) {
    process.exitCode = 1;
  }
}
