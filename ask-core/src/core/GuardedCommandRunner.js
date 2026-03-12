import { spawn } from 'node:child_process';
import { RuntimeOperationStore } from './RuntimeOperationStore.js';

const DEFAULT_WALL_TIMEOUT_MS = 180_000;
const DEFAULT_NO_OUTPUT_TIMEOUT_MS = 180_000;
const DEFAULT_MAX_RETRIES_ON_STALL = 1;

function nowIso() {
  return new Date().toISOString();
}

function toText(value) {
  if (typeof value === 'string') {
    return value;
  }
  return value.toString('utf8');
}

function createFailureError(operation, command, args, attempt, reason, details = {}) {
  const lines = [
    `guarded command failed: ${operation}`,
    `command: ${command} ${args.join(' ')}`,
    `attempt: ${String(attempt)}`,
    `reason: ${reason}`,
  ];
  if (details.exitCode !== undefined) {
    lines.push(`exitCode: ${String(details.exitCode)}`);
  }
  if (details.stdout) {
    lines.push(details.stdout);
  }
  if (details.stderr) {
    lines.push(details.stderr);
  }
  const error = new Error(lines.join('\n'));
  error.reason = reason;
  error.attempt = attempt;
  error.exitCode = details.exitCode ?? null;
  error.stdout = details.stdout ?? '';
  error.stderr = details.stderr ?? '';
  return error;
}

function runSingleAttempt(command, args, options = {}, onStarted) {
  const cwd = options.cwd;
  const env = options.env ?? process.env;
  const wallTimeoutMs = options.wallTimeoutMs ?? DEFAULT_WALL_TIMEOUT_MS;
  const noOutputTimeoutMs = options.noOutputTimeoutMs ?? DEFAULT_NO_OUTPUT_TIMEOUT_MS;

  return new Promise(resolve => {
    let stdout = '';
    let stderr = '';
    let settled = false;
    let killReason = null;
    let hasOutput = false;
    let lastOutputAt = nowIso();
    let noOutputTimer = null;
    let wallTimer = null;

    const settle = (payload) => {
      if (settled) {
        return;
      }
      settled = true;
      clearTimeout(noOutputTimer);
      clearTimeout(wallTimer);
      resolve({
        ...payload,
        stdout,
        stderr,
        lastOutputAt,
      });
    };

    const child = spawn(command, args, {
      cwd,
      env,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    onStarted(child.pid || null);

    const resetNoOutputTimer = () => {
      lastOutputAt = nowIso();
      clearTimeout(noOutputTimer);
      noOutputTimer = setTimeout(() => {
        killReason = 'no-output-timeout';
        child.kill();
      }, noOutputTimeoutMs);
    };

    resetNoOutputTimer();

    wallTimer = setTimeout(() => {
      killReason = !hasOutput && noOutputTimeoutMs <= wallTimeoutMs ? 'no-output-timeout' : 'wall-timeout';
      child.kill();
    }, wallTimeoutMs);

    child.stdout.on('data', chunk => {
      stdout += toText(chunk);
      hasOutput = true;
      resetNoOutputTimer();
    });

    child.stderr.on('data', chunk => {
      stderr += toText(chunk);
      hasOutput = true;
      resetNoOutputTimer();
    });

    child.on('error', error => {
      settle({
        exitCode: null,
        signal: null,
        failureReason: 'spawn-error',
        errorMessage: error.message,
      });
    });

    child.on('close', (code, signal) => {
      settle({
        exitCode: code,
        signal,
        failureReason: killReason,
      });
    });
  });
}

export class GuardedCommandRunner {
  constructor(cwd, options = {}) {
    this.cwd = cwd;
    this.options = {
      wallTimeoutMs: options.wallTimeoutMs ?? DEFAULT_WALL_TIMEOUT_MS,
      noOutputTimeoutMs: options.noOutputTimeoutMs ?? DEFAULT_NO_OUTPUT_TIMEOUT_MS,
      maxRetriesOnStall: options.maxRetriesOnStall ?? DEFAULT_MAX_RETRIES_ON_STALL,
    };
    this.store = options.store || new RuntimeOperationStore(cwd);
  }

  async writeState(payload) {
    return this.store.write(payload);
  }

  async run(spec) {
    const command = spec.command;
    const args = spec.args ?? [];
    const operation = spec.operation ?? `${command} ${args.join(' ')}`.trim();
    const maxAttempts = this.options.maxRetriesOnStall + 1;
    const startedAt = nowIso();
    let attempt = 0;

    while (attempt < maxAttempts) {
      attempt += 1;
      let runningState = await this.writeState({
        operation,
        status: 'running',
        attempt,
        maxAttempts,
        startedAt,
        lastOutputAt: startedAt,
        failureReason: '',
        command: {
          bin: command,
          args,
        },
        pid: null,
      });

      const result = await runSingleAttempt(
        command,
        args,
        {
          cwd: spec.cwd ?? this.cwd,
          env: spec.env ?? process.env,
          wallTimeoutMs: this.options.wallTimeoutMs,
          noOutputTimeoutMs: this.options.noOutputTimeoutMs,
        },
        async (pid) => {
          runningState = await this.writeState({
            ...runningState,
            pid: pid ?? null,
            updatedAt: nowIso(),
          });
        }
      );

      if (result.failureReason === 'no-output-timeout' || result.failureReason === 'wall-timeout') {
        const canRetry = attempt < maxAttempts;
        const status = canRetry ? 'retrying' : 'failed';
        await this.writeState({
          ...runningState,
          status,
          attempt,
          failureReason: result.failureReason,
          lastOutputAt: result.lastOutputAt,
          updatedAt: nowIso(),
          stdout: result.stdout,
          stderr: result.stderr,
        });
        if (canRetry) {
          continue;
        }
        throw createFailureError(operation, command, args, attempt, result.failureReason, {
          stdout: result.stdout,
          stderr: result.stderr,
        });
      }

      if (result.failureReason === 'spawn-error') {
        await this.writeState({
          ...runningState,
          status: 'failed',
          attempt,
          failureReason: 'spawn-error',
          lastOutputAt: result.lastOutputAt,
          updatedAt: nowIso(),
          stdout: result.stdout,
          stderr: result.stderr,
        });
        throw createFailureError(operation, command, args, attempt, 'spawn-error', {
          stdout: result.stdout,
          stderr: result.stderr,
        });
      }

      if (result.exitCode !== 0) {
        await this.writeState({
          ...runningState,
          status: 'failed',
          attempt,
          failureReason: 'exit-nonzero',
          lastOutputAt: result.lastOutputAt,
          updatedAt: nowIso(),
          exitCode: result.exitCode,
          stdout: result.stdout,
          stderr: result.stderr,
        });
        throw createFailureError(operation, command, args, attempt, 'exit-nonzero', {
          exitCode: result.exitCode,
          stdout: result.stdout,
          stderr: result.stderr,
        });
      }

      await this.writeState({
        ...runningState,
        status: 'succeeded',
        attempt,
        failureReason: '',
        lastOutputAt: result.lastOutputAt,
        updatedAt: nowIso(),
      });

      return {
        ok: true,
        attempts: attempt,
      };
    }

    throw createFailureError(operation, command, args, attempt, 'unknown');
  }
}
