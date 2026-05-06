import { VerificationRuntime } from '../../core/VerificationRuntime.js';
import { EvidenceRecorder } from '../../core/EvidenceRecorder.js';

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

function printResult(payload) {
  console.log(JSON.stringify(payload, null, 2));
  if (!payload.ok) {
    process.exitCode = 1;
  }
}

function normalize(value) {
  return String(value ?? '').trim();
}

function parseBoolean(value) {
  const raw = normalize(value).toLowerCase();
  if (raw === 'true' || raw === '1' || raw === 'yes') {
    return true;
  }
  if (raw === 'false' || raw === '0' || raw === 'no') {
    return false;
  }
  return null;
}

function parseChecksCsv(value) {
  return normalize(value)
    .split(',')
    .map(entry => entry.trim())
    .filter(Boolean);
}

export async function runEvidence(subcommand, args = []) {
  const runtime = new VerificationRuntime(process.cwd());

  if (subcommand === 'attach') {
    const taskId = args[0] ?? '';
    const kind = getArgValue(args, '--kind');
    const filePath = getArgValue(args, '--path');
    const summary = getArgValue(args, '--summary');
    const result = await runtime.attach(taskId, kind, filePath, summary);
    printResult(result);
    return;
  }

  if (subcommand === 'checks') {
    const action = args[0] ?? '';
    const recorder = new EvidenceRecorder(process.cwd());

    if (action === 'status') {
      const evidence = await recorder.readLatestChecks();
      printResult({
        ok: true,
        evidence,
      });
      return;
    }

    if (action === 'record') {
      const testsPassedRaw = getArgValue(args, '--tests-passed');
      const docsFreshRaw = getArgValue(args, '--docs-fresh');
      const checksRaw = getArgValue(args, '--checks');
      const source = normalize(getArgValue(args, '--source'));

      const testsPassed = parseBoolean(testsPassedRaw);
      if (testsPassed === null) {
        printResult({
          ok: false,
          code: 'invalid-tests-passed',
          message: '--tests-passed must be true|false',
        });
        return;
      }

      const previous = await recorder.readLatestChecks();
      const docsFresh = docsFreshRaw ? parseBoolean(docsFreshRaw) : Boolean(previous.docsFresh);
      if (docsFresh === null) {
        printResult({
          ok: false,
          code: 'invalid-docs-fresh',
          message: '--docs-fresh must be true|false',
        });
        return;
      }

      const checks = checksRaw ? parseChecksCsv(checksRaw) : (
        Array.isArray(previous.checks) ? [...previous.checks] : []
      );
      const evidence = {
        docsFresh,
        testsPassed,
        checks,
        source,
        updatedAt: new Date().toISOString(),
      };
      await recorder.writeLatestChecks(evidence);
      printResult({
        ok: true,
        evidence,
      });
      return;
    }

    console.log('Usage: ask evidence checks record|status');
    return;
  }

  console.log('Usage: ask evidence attach <taskId> --kind <kind> --path <path> [--summary "..."]');
}
