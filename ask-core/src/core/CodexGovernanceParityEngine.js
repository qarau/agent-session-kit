import fs from 'node:fs';
import { AskPaths } from '../fs/AskPaths.js';

function normalize(value) {
  return String(value ?? '').trim();
}

function toBooleanOrDefault(value, fallback) {
  if (typeof value === 'boolean') {
    return value;
  }
  const normalized = normalize(value).toLowerCase();
  if (normalized === 'true' || normalized === '1' || normalized === 'yes' || normalized === 'on') {
    return true;
  }
  if (normalized === 'false' || normalized === '0' || normalized === 'no' || normalized === 'off') {
    return false;
  }
  return fallback;
}

function parseNdjson(text) {
  return String(text ?? '')
    .split(/\r?\n/u)
    .map(line => line.trim())
    .filter(Boolean)
    .map(line => {
      try {
        return JSON.parse(line);
      } catch {
        return null;
      }
    })
    .filter(Boolean);
}

function eventPayload(event) {
  if (!event || typeof event !== 'object') {
    return {};
  }
  if (!event.payload || typeof event.payload !== 'object') {
    return {};
  }
  return event.payload;
}

export class CodexGovernanceParityEngine {
  constructor(cwd) {
    this.paths = new AskPaths(cwd);
  }

  readRuntimeEvents() {
    const filePath = this.paths.runtimeEvents();
    if (!fs.existsSync(filePath)) {
      return [];
    }
    const raw = fs.readFileSync(filePath, 'utf8');
    return parseNdjson(raw);
  }

  getSessionEvents(events, sessionId) {
    const resolvedSessionId = normalize(sessionId);
    if (!resolvedSessionId) {
      return [];
    }
    return events.filter(event => normalize(event.sessionId) === resolvedSessionId);
  }

  evaluate({ policy = {}, sessionId = '' } = {}) {
    const codexPolicy = policy?.codex_runtime ?? {};
    const requireEvidence = toBooleanOrDefault(
      codexPolicy.require_governed_launch_evidence_for_change_gates,
      true
    );
    const requireCheckpoint = toBooleanOrDefault(
      codexPolicy.require_governed_checkpoint_for_change_gates,
      true
    );
    const forbidDirect = toBooleanOrDefault(
      codexPolicy.forbid_direct_launch_exception_for_change_gates,
      true
    );

    const missing = [];
    const events = this.getSessionEvents(this.readRuntimeEvents(), sessionId);
    const types = new Set(events.map(event => normalize(event.type)));
    const hasGovernedStart = types.has('CodexGovernedLaunchStarted');
    const hasExecutionCapture = types.has('CodexExecutionCaptured');
    const hasCheckpoint = types.has('CodexGovernedCheckpointCreated');
    const hasInteractiveCheckpoint = types.has('CodexInteractiveCheckpointCreated');
    const hasDirectApproved = types.has('CodexDirectLaunchApproved');
    const hasDirectExecution = events.some(
      event =>
        normalize(event.type) === 'CodexExecutionCaptured' &&
        normalize(eventPayload(event).launchMode).toLowerCase() === 'direct-exception'
    );

    if (requireEvidence && !(hasInteractiveCheckpoint || (hasGovernedStart && hasExecutionCapture))) {
      missing.push('governed codex launch evidence required');
    }
    if (requireCheckpoint && !(hasCheckpoint || hasInteractiveCheckpoint)) {
      missing.push('governed codex checkpoint evidence required');
    }
    if (forbidDirect && (hasDirectApproved || hasDirectExecution)) {
      missing.push('direct codex launch exceptions are not allowed for change gates');
    }

    return {
      missing,
      checks: ['codex-governance-parity'],
    };
  }
}
