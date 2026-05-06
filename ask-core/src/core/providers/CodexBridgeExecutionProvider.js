import http from 'node:http';
import https from 'node:https';

function normalize(value) {
  return String(value ?? '').trim();
}

function toNumber(value, fallback = 0) {
  const parsed = Number(value ?? fallback);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function toPositiveNumber(value, fallback = 0) {
  const parsed = toNumber(value, fallback);
  if (parsed <= 0) {
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

function listFromString(value) {
  return String(value ?? '')
    .split(',')
    .map(entry => entry.trim())
    .filter(Boolean);
}

function normalizeBaseUrl(baseUrl) {
  return normalize(baseUrl).replace(/\/+$/u, '');
}

function statusToExitCode(status = '') {
  const key = normalize(status).toLowerCase();
  if (key === 'completed' || key === 'dry-run') {
    return 0;
  }
  if (key === 'timeout') {
    return 124;
  }
  return 1;
}

function isTerminalStatus(status = '') {
  const key = normalize(status).toLowerCase();
  return key === 'completed' || key === 'failed' || key === 'timeout' || key === 'cancelled';
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function requestJson(urlText, options = {}) {
  const timeoutMs = toPositiveNumber(options.timeoutMs, 30_000);
  const method = normalize(options.method).toUpperCase() || 'GET';
  const headers = options.headers && typeof options.headers === 'object'
    ? { ...options.headers }
    : {};

  const bodyText = options.body ? JSON.stringify(options.body) : '';
  if (bodyText) {
    headers['content-type'] = headers['content-type'] || 'application/json';
    headers['content-length'] = Buffer.byteLength(bodyText, 'utf8');
  }

  return new Promise((resolve, reject) => {
    let settled = false;
    const settle = (fn, value) => {
      if (settled) {
        return;
      }
      settled = true;
      fn(value);
    };

    const url = new URL(urlText);
    const transport = url.protocol === 'https:' ? https : http;
    const request = transport.request(
      {
        protocol: url.protocol,
        hostname: url.hostname,
        port: url.port || (url.protocol === 'https:' ? 443 : 80),
        path: `${url.pathname}${url.search}`,
        method,
        headers,
      },
      (response) => {
        let raw = '';
        response.setEncoding('utf8');
        response.on('data', chunk => {
          raw += String(chunk ?? '');
        });
        response.on('end', () => {
          let json = {};
          try {
            json = raw ? JSON.parse(raw) : {};
          } catch {
            json = {};
          }
          settle(resolve, {
            ok: (response.statusCode ?? 500) >= 200 && (response.statusCode ?? 500) < 300,
            status: response.statusCode ?? 500,
            json,
            raw,
          });
        });
      }
    );

    request.on('error', error => {
      settle(reject, error);
    });
    request.setTimeout(timeoutMs, () => {
      request.destroy(new Error(`bridge request timeout (${String(timeoutMs)}ms)`));
    });

    if (bodyText) {
      request.write(bodyText);
    }
    request.end();
  });
}

export class CodexBridgeExecutionProvider {
  async dispatchMock(options = {}) {
    const pollIntervalMs = toPositiveNumber(options.bridgePollIntervalMs, 10);
    const fallbackStatuses = ['queued', 'running', 'completed'];
    const fromOption = list(options.bridgeMockStatuses);
    const fromCsvOption = listFromString(options.bridgeMockStatusesCsv);
    const fromEnv = listFromString(process.env.ASK_SUBAGENT_BRIDGE_MOCK_STATUSES);
    const statuses = fromOption.length > 0
      ? fromOption
      : fromCsvOption.length > 0
        ? fromCsvOption
        : fromEnv.length > 0
          ? fromEnv
          : fallbackStatuses;

    const dispatchId = normalize(options.bridgeDispatchId)
      || normalize(options.bridgeMockDispatchId)
      || `mock-${normalize(options.taskId)}-${Date.now().toString(36)}`;

    let terminalStatus = 'completed';
    for (const status of statuses) {
      const key = normalize(status).toLowerCase();
      if (isTerminalStatus(key)) {
        terminalStatus = key;
        break;
      }
      await sleep(pollIntervalMs);
    }

    return {
      ok: terminalStatus === 'completed',
      status: terminalStatus,
      exitCode: statusToExitCode(terminalStatus),
      dispatchId,
      codexAgentId: normalize(options.bridgeMockAgentId || options.agentId),
      artifacts: [],
      stdout: '',
      stderr: '',
    };
  }

  async dispatch(options = {}) {
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

    const baseUrl = normalizeBaseUrl(options.bridgeUrl || process.env.ASK_SUBAGENT_BRIDGE_URL);
    if (!baseUrl) {
      throw new Error('bridge url is required for codex-bridge provider');
    }
    if (baseUrl.startsWith('mock://')) {
      return this.dispatchMock(options);
    }

    const bridgeToken = normalize(options.bridgeToken || process.env.ASK_SUBAGENT_BRIDGE_TOKEN);
    const pollIntervalMs = toPositiveNumber(options.bridgePollIntervalMs, 250);
    const pollTimeoutMs = toPositiveNumber(options.bridgePollTimeoutMs, toPositiveNumber(options.timeoutMs, 120_000));
    const requestTimeoutMs = toPositiveNumber(options.requestTimeoutMs, 15_000);

    const idempotencyKey = normalize(options.idempotencyKey);
    const headers = {};
    if (bridgeToken) {
      headers.authorization = `Bearer ${bridgeToken}`;
    }
    if (idempotencyKey) {
      headers['x-idempotency-key'] = idempotencyKey;
    }

    let dispatchId = normalize(options.bridgeDispatchId);
    let latest = {
      status: '',
      exitCode: null,
      codexAgentId: '',
      artifacts: [],
      stdout: '',
      stderr: '',
    };

    if (!dispatchId) {
      const created = await requestJson(`${baseUrl}/dispatches`, {
        method: 'POST',
        headers,
        timeoutMs: requestTimeoutMs,
        body: {
          taskId: normalize(options.taskId),
          agentId: normalize(options.agentId),
          childSessionId: normalize(options.childSessionId),
          goal: String(options.goal ?? ''),
          prompt: String(options.prompt ?? ''),
          model: normalize(options.model),
          reasoningEffort: normalize(options.reasoningEffort),
          command: normalize(options.command),
          args: list(options.args),
          cwd: normalize(options.cwd),
          metadata: options.metadata && typeof options.metadata === 'object' ? options.metadata : {},
        },
      });

      if (!created.ok) {
        return {
          ok: false,
          status: 'failed',
          exitCode: 1,
          dispatchId: '',
          codexAgentId: '',
          artifacts: [],
          stdout: '',
          stderr: normalize(created.raw),
          errorMessage: normalize(created.json?.error || `bridge dispatch create failed with status ${String(created.status)}`),
        };
      }

      dispatchId = normalize(created.json?.dispatchId || created.json?.id);
      latest.status = normalize(created.json?.status).toLowerCase() || 'queued';
      latest.codexAgentId = normalize(created.json?.codexAgentId || created.json?.agentId);
      latest.artifacts = Array.isArray(created.json?.artifacts)
        ? created.json.artifacts.map(entry => normalize(entry)).filter(Boolean)
        : [];

      if (!dispatchId) {
        return {
          ok: false,
          status: 'failed',
          exitCode: 1,
          dispatchId: '',
          codexAgentId: '',
          artifacts: [],
          stdout: '',
          stderr: '',
          errorMessage: 'bridge dispatch create response missing dispatch id',
        };
      }
    }

    const startedAtMs = Date.now();
    while (true) {
      const statusResponse = await requestJson(`${baseUrl}/dispatches/${encodeURIComponent(dispatchId)}`, {
        method: 'GET',
        headers,
        timeoutMs: requestTimeoutMs,
      });

      if (!statusResponse.ok) {
        return {
          ok: false,
          status: 'failed',
          exitCode: 1,
          dispatchId,
          codexAgentId: latest.codexAgentId,
          artifacts: latest.artifacts,
          stdout: '',
          stderr: normalize(statusResponse.raw),
          errorMessage: normalize(statusResponse.json?.error || `bridge dispatch status failed with status ${String(statusResponse.status)}`),
        };
      }

      const status = normalize(statusResponse.json?.status).toLowerCase();
      latest = {
        status,
        exitCode: statusResponse.json?.exitCode,
        codexAgentId: normalize(statusResponse.json?.codexAgentId || statusResponse.json?.agentId),
        artifacts: Array.isArray(statusResponse.json?.artifacts)
          ? statusResponse.json.artifacts.map(entry => normalize(entry)).filter(Boolean)
          : [],
        stdout: normalize(statusResponse.json?.stdout),
        stderr: normalize(statusResponse.json?.stderr),
      };

      if (isTerminalStatus(status)) {
        return {
          ok: status === 'completed',
          status: status || 'failed',
          exitCode: toNumber(latest.exitCode, statusToExitCode(status)),
          dispatchId,
          codexAgentId: latest.codexAgentId,
          artifacts: latest.artifacts,
          stdout: latest.stdout,
          stderr: latest.stderr,
        };
      }

      const elapsedMs = Date.now() - startedAtMs;
      if (elapsedMs >= pollTimeoutMs) {
        await requestJson(`${baseUrl}/dispatches/${encodeURIComponent(dispatchId)}/cancel`, {
          method: 'POST',
          headers,
          timeoutMs: requestTimeoutMs,
          body: { reason: 'ask-provider-timeout' },
        }).catch(() => null);
        return {
          ok: false,
          status: 'timeout',
          exitCode: 124,
          dispatchId,
          codexAgentId: latest.codexAgentId,
          artifacts: latest.artifacts,
          stdout: latest.stdout,
          stderr: latest.stderr,
          errorMessage: `bridge dispatch exceeded poll timeout (${String(pollTimeoutMs)}ms)`,
        };
      }

      await sleep(pollIntervalMs);
    }
  }
}
