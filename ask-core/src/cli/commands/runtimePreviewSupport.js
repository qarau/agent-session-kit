import { PolicyEngine } from '../../core/PolicyEngine.js';
import { RuntimeStateEngine } from '../../core/RuntimeStateEngine.js';
import { IntentEngine } from '../../core/IntentEngine.js';
import { SlicePlanner } from '../../core/SlicePlanner.js';

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

function collectArgValues(args, name) {
  const values = [];
  for (let index = 0; index < args.length; index += 1) {
    const value = String(args[index] ?? '');
    if (value === name) {
      values.push(String(args[index + 1] ?? ''));
      index += 1;
      continue;
    }
    if (value.startsWith(`${name}=`)) {
      values.push(value.slice(name.length + 1));
    }
  }
  return values.filter(Boolean);
}

function toNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export async function hydrateRuntimePreview(cwd) {
  const policyEngine = new PolicyEngine(cwd);
  const stateEngine = new RuntimeStateEngine(cwd);
  const policy = await policyEngine.load();
  const state = await stateEngine.hydrate(policy);
  return {
    policy,
    state,
  };
}

export function buildPreviewIntent(state, policy) {
  const intentEngine = new IntentEngine();
  return intentEngine.select(state, policy);
}

export function buildPreviewSlice(intent, state, policy, args = []) {
  const planner = new SlicePlanner();
  const maxSlicesRaw = getArgValue(args, '--max-slices');
  const maxSlices = toNumber(maxSlicesRaw, 0);
  return planner.create(intent, state, policy, {
    command: getArgValue(args, '--command'),
    commandArgs: collectArgValues(args, '--command-arg'),
    operation: getArgValue(args, '--operation'),
    allowedCommands: collectArgValues(args, '--allowed-command'),
    maxSlices,
  });
}
