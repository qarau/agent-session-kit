import { EvidenceRecorder } from '../../core/EvidenceRecorder.js';
import { PolicyEngine } from '../../core/PolicyEngine.js';
import { SessionRuntime } from '../../core/SessionRuntime.js';
import { evaluateCanCommitGate } from '../../core/sessionPolicyGates.js';

export async function runCanCommit() {
  const evidenceRecorder = new EvidenceRecorder(process.cwd());
  const policyEngine = new PolicyEngine(process.cwd());
  const sessionRuntime = new SessionRuntime(process.cwd());
  const evidence = await evidenceRecorder.readLatestChecks();
  const policy = await policyEngine.load();
  const session = await sessionRuntime.getActiveSession();
  const gate = evaluateCanCommitGate(policy, session, evidence);
  const missing = gate.missing;

  const ok = missing.length === 0;
  console.log(JSON.stringify({ ok, missing }, null, 2));
  if (!ok) {
    process.exitCode = 1;
  }
}
