import { PolicyEngine } from '../../core/PolicyEngine.js';
import { RuntimeStateEngine } from '../../core/RuntimeStateEngine.js';

function normalize(value) {
  return String(value ?? '').trim();
}

function printUsage() {
  console.log('Usage: ask governance status|explain');
}

function explainDecision(state = {}) {
  const decision = state.governanceDecision || {};
  const loop = state.loop || {};
  const reasons = [];
  if (normalize(decision.reason)) {
    reasons.push(normalize(decision.reason));
  }
  if (normalize(loop.completion?.reason)) {
    reasons.push(normalize(loop.completion.reason));
  }
  const steps = Array.isArray(loop.history) ? loop.history : [];
  const compactSteps = steps.map(step => ({
    index: step.index,
    name: step.name,
    details: step.details || {},
  }));
  return {
    decision: normalize(decision.decision || loop.decision || 'unknown'),
    blocking: decision.blocking === true || normalize(loop.decision) === 'block',
    reasons: [...new Set(reasons)],
    loopId: normalize(loop.loopId),
    loopStatus: normalize(loop.status),
    lastStep: compactSteps.length > 0 ? compactSteps[compactSteps.length - 1] : null,
    steps: compactSteps,
  };
}

export async function runGovernance(subcommand) {
  const action = String(subcommand || 'status').trim();
  if (!['status', 'explain'].includes(action)) {
    printUsage();
    return;
  }

  const cwd = process.cwd();
  const policyEngine = new PolicyEngine(cwd);
  const stateEngine = new RuntimeStateEngine(cwd);
  const policy = await policyEngine.load();
  const state = await stateEngine.hydrate(policy);

  if (action === 'status') {
    console.log(JSON.stringify({
      ok: true,
      sessionId: normalize(state.sessionId),
      runtimeStatus: normalize(state.status),
      nextRecommendedAction: normalize(state.nextRecommendedAction),
      continuityValid: state.continuityValid === true,
      dirtyWorktree: state.dirtyWorktree === true,
      architect: state.architect || {},
      flow: state.flow || {},
      loop: state.loop || {},
      governanceDecision: state.governanceDecision || {},
    }, null, 2));
    return;
  }

  const explanation = explainDecision(state);
  console.log(JSON.stringify({
    ok: true,
    sessionId: normalize(state.sessionId),
    explanation,
  }, null, 2));
}
