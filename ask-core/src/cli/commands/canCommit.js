import { EvidenceRecorder } from '../../core/EvidenceRecorder.js';
import { PolicyEngine } from '../../core/PolicyEngine.js';
import { SessionRuntime } from '../../core/SessionRuntime.js';

export async function runCanCommit() {
  const evidenceRecorder = new EvidenceRecorder(process.cwd());
  const policyEngine = new PolicyEngine(process.cwd());
  const sessionRuntime = new SessionRuntime(process.cwd());
  const evidence = await evidenceRecorder.readLatestChecks();
  const policy = await policyEngine.load();
  const session = await sessionRuntime.getActiveSession();
  const missing = [];
  const sessionState = String(session.status || 'created').toLowerCase();
  const allowedStates = Array.isArray(policy.session?.allowed_can_commit_states)
    ? policy.session.allowed_can_commit_states
    : ['active', 'paused'];

  if (policy.checks?.require_docs_freshness && !evidence.docsFresh) {
    missing.push('docs freshness');
  }

  if (policy.checks?.require_tests_before_commit && !evidence.testsPassed) {
    missing.push('tests');
  }

  if (!allowedStates.includes(sessionState)) {
    missing.push(`session state ${sessionState} not allowed for can-commit`);
  }

  const ok = missing.length === 0;
  console.log(JSON.stringify({ ok, missing }, null, 2));
  if (!ok) {
    process.exitCode = 1;
  }
}
