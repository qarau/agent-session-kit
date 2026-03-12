import { SessionRuntime } from '../../core/SessionRuntime.js';
import { WorkContextEngine } from '../../core/WorkContextEngine.js';
import { PolicyEngine } from '../../core/PolicyEngine.js';

export async function runPreflight() {
  const sessionRuntime = new SessionRuntime(process.cwd());
  const contextEngine = new WorkContextEngine(process.cwd());
  const policyEngine = new PolicyEngine(process.cwd());

  const session = await sessionRuntime.getActiveSession();
  const context = await contextEngine.getContext();
  const policy = await policyEngine.load();
  const missing = [];
  const sessionState = String(session.status || 'created').toLowerCase();
  const allowedStates = Array.isArray(policy.session?.allowed_preflight_states)
    ? policy.session.allowed_preflight_states
    : ['active', 'paused'];

  if (policy.session?.require_resume_before_edit !== false && !allowedStates.includes(sessionState)) {
    missing.push(`session state ${sessionState} not allowed for preflight`);
  }

  if (!context.branch) {
    missing.push('context verify required');
  }

  const passed = missing.length === 0;
  console.log(JSON.stringify({ passed, missing }, null, 2));
  if (!passed) {
    process.exitCode = 1;
  }
}
