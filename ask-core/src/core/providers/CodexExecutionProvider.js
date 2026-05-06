import { spawnSync } from 'node:child_process';

function normalize(value) {
  return String(value ?? '').trim();
}

function toPositiveNumber(value, fallback = 0) {
  const parsed = Number(value ?? fallback);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }
  return parsed;
}

function list(value) {
  if (Array.isArray(value)) {
    return value.map(entry => String(entry ?? '')).filter(Boolean);
  }
  return [];
}

function parseJsonObject(raw) {
  const text = normalize(raw);
  if (!text.startsWith('{') || !text.endsWith('}')) {
    return null;
  }
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

export class CodexExecutionProvider {
  constructor(overrides = {}) {
    this.spawnSync = overrides.spawnSync ?? spawnSync;
  }

  dispatch(options = {}) {
    if (options.dryRun) {
      return {
        ok: true,
        status: 'dry-run',
        exitCode: 0,
        dispatchId: '',
        codexAgentId: '',
        artifacts: [],
        stdout: '',
        stderr: '',
      };
    }

    const command = normalize(options.command || 'codex');
    if (!command) {
      throw new Error('provider command is required');
    }

    const args = list(options.args);
    const cwd = normalize(options.cwd) || process.cwd();
    const timeoutMs = toPositiveNumber(options.timeoutMs, 0);

    const result = this.spawnSync(command, args, {
      cwd,
      stdio: ['ignore', 'pipe', 'pipe'],
      encoding: 'utf8',
      shell: false,
      timeout: timeoutMs > 0 ? timeoutMs : undefined,
    });

    const stdout = normalize(result.stdout);
    const stderr = normalize(result.stderr);

    if (result.error) {
      if (String(result.error.code ?? '').toUpperCase() === 'ETIMEDOUT') {
        return {
          ok: false,
          status: 'timeout',
          exitCode: 124,
          dispatchId: '',
          codexAgentId: '',
          artifacts: [],
          stdout,
          stderr,
          errorMessage: normalize(result.error.message),
        };
      }
      throw result.error;
    }

    const payload = parseJsonObject(stdout);
    const exitCode = Number(result.status ?? 1);
    const statusFromPayload = normalize(payload?.status).toLowerCase();
    const status = statusFromPayload || (exitCode === 0 ? 'completed' : 'failed');
    const payloadOk = typeof payload?.ok === 'boolean' ? payload.ok : true;
    const terminalFailureStatuses = new Set(['failed', 'timeout', 'cancelled']);
    const ok = exitCode === 0 && payloadOk && !terminalFailureStatuses.has(status);

    return {
      ok,
      status,
      exitCode,
      dispatchId: '',
      codexAgentId: normalize(payload?.codexAgentId || payload?.agentId),
      artifacts: Array.isArray(payload?.artifacts) ? payload.artifacts.map(entry => normalize(entry)).filter(Boolean) : [],
      stdout,
      stderr,
    };
  }
}
