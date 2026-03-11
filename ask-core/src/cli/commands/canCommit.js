import { EvidenceRecorder } from '../../core/EvidenceRecorder.js';
import { PolicyEngine } from '../../core/PolicyEngine.js';

export async function runCanCommit() {
  const evidenceRecorder = new EvidenceRecorder(process.cwd());
  const policyEngine = new PolicyEngine(process.cwd());
  const evidence = await evidenceRecorder.readLatestChecks();
  const policy = await policyEngine.load();
  const missing = [];

  if (policy.checks?.require_docs_freshness && !evidence.docsFresh) {
    missing.push('docs freshness');
  }

  if (policy.checks?.require_tests_before_commit && !evidence.testsPassed) {
    missing.push('tests');
  }

  const ok = missing.length === 0;
  console.log(JSON.stringify({ ok, missing }, null, 2));
  if (!ok) {
    process.exitCode = 1;
  }
}
