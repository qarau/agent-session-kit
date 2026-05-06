import { SessionRuntime } from '../../core/SessionRuntime.js';
import { WorkContextEngine } from '../../core/WorkContextEngine.js';
import { PolicyEngine } from '../../core/PolicyEngine.js';
import { evaluatePreflightGate } from '../../core/sessionPolicyGates.js';

export async function runPreflight() {
  const sessionRuntime = new SessionRuntime(process.cwd());
  const contextEngine = new WorkContextEngine(process.cwd());
  const policyEngine = new PolicyEngine(process.cwd());

  const session = await sessionRuntime.getActiveSession();
  const context = await contextEngine.getContext();
  const policy = await policyEngine.load();
  const gate = evaluatePreflightGate(policy, session, context);
  const missing = gate.missing;

  const passed = missing.length === 0;
  console.log(JSON.stringify({ passed, missing }, null, 2));
  if (!passed) {
    process.exitCode = 1;
  }
}
