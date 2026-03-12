import { AskPaths } from '../../fs/AskPaths.js';
import { FileStore } from '../../fs/FileStore.js';
import { PolicyEngine } from '../../core/PolicyEngine.js';

const DEFAULTS = {
  enabled: false,
  minRemainingRatio: 0.1,
  reserveOutputTokens: 12_000,
  maxContextTokens: 400_000,
  strategy: 'explicit',
  model: 'gpt-5-codex',
};

function nowIso() {
  return new Date().toISOString();
}

function parsePositiveNumber(value, fallback) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return fallback;
  }
  return parsed;
}

function round4(value) {
  return Math.round(value * 10_000) / 10_000;
}

function normalizeStrategy(value) {
  const strategy = String(value ?? '').trim().toLowerCase();
  if (strategy === 'auto') {
    return 'auto';
  }
  return 'explicit';
}

function createBaseState(config) {
  return {
    provider: 'openai-responses',
    enabled: config.enabled,
    strategy: config.strategy,
    minRemainingRatio: config.minRemainingRatio,
    reserveOutputTokens: config.reserveOutputTokens,
    maxContextTokens: config.maxContextTokens,
    lastCountAt: '',
    inputTokens: 0,
    remainingTokens: config.maxContextTokens,
    remainingRatio: 1,
    lastCompactedAt: '',
    lastCompactionResponseId: '',
    status: 'disabled',
    message: '',
    suggestedAction: 'none',
  };
}

function compactSuggestion(status, strategy) {
  if (status === 'below-threshold') {
    return strategy === 'auto' ? 'monitor-auto-compact' : 'compact-now';
  }
  if (status === 'api-key-missing') {
    return 'set-openai-api-key';
  }
  if (status === 'no-response-id') {
    return 'set-ask-codex-response-id';
  }
  if (status === 'api-error' || status === 'compact-failed') {
    return 'retry-after-api-recovery';
  }
  if (status === 'compacted') {
    return 'continue';
  }
  return 'none';
}

function resolveResponseId(lastState) {
  return (
    process.env.ASK_CODEX_RESPONSE_ID ||
    process.env.OPENAI_RESPONSES_PREVIOUS_RESPONSE_ID ||
    lastState?.lastCompactionResponseId ||
    ''
  );
}

function parseInputTokens(payload) {
  const raw =
    payload?.input_tokens ??
    payload?.usage?.input_tokens ??
    payload?.usage?.input_tokens_total ??
    payload?.total_input_tokens ??
    0;
  return Math.max(0, Number(raw) || 0);
}

async function parseJsonSafe(response) {
  try {
    return await response.json();
  } catch {
    return {};
  }
}

export class ContextBudgetManager {
  constructor(cwd, options = {}) {
    this.cwd = cwd;
    this.paths = new AskPaths(cwd);
    this.store = options.store || new FileStore();
    this.policy = options.policy || new PolicyEngine(cwd);
    this.fetchImpl = options.fetchImpl || globalThis.fetch;
    this.baseUrl = (process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1').replace(/\/+$/u, '');
  }

  async loadConfig() {
    const loaded = await this.policy.load();
    const codex = loaded.codex_context ?? {};
    const enabled = codex.enabled === true;
    const minRemainingRatio = parsePositiveNumber(codex.min_remaining_ratio, DEFAULTS.minRemainingRatio);
    const reserveOutputTokens = parsePositiveNumber(codex.reserve_output_tokens, DEFAULTS.reserveOutputTokens);
    const maxContextTokens = parsePositiveNumber(codex.max_context_tokens, DEFAULTS.maxContextTokens);
    const strategy = normalizeStrategy(codex.strategy || DEFAULTS.strategy);
    return {
      enabled,
      minRemainingRatio,
      reserveOutputTokens,
      maxContextTokens,
      strategy,
      model: process.env.ASK_CODEX_MODEL || DEFAULTS.model,
    };
  }

  async readState() {
    return this.store.readJson(this.paths.contextSession(), null);
  }

  async writeState(state) {
    await this.store.writeJson(this.paths.contextSession(), state);
    return state;
  }

  async postJson(pathname, payload, apiKey) {
    if (typeof this.fetchImpl !== 'function') {
      return {
        ok: false,
        status: 0,
        payload: {},
        errorMessage: 'fetch unavailable',
      };
    }

    let response;
    try {
      response = await this.fetchImpl(`${this.baseUrl}${pathname}`, {
        method: 'POST',
        headers: {
          authorization: `Bearer ${apiKey}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify(payload),
      });
    } catch (error) {
      return {
        ok: false,
        status: 0,
        payload: {},
        errorMessage: error?.message || 'network error',
      };
    }

    const data = await parseJsonSafe(response);
    if (!response.ok) {
      return {
        ok: false,
        status: response.status,
        payload: data,
        errorMessage: data?.error?.message || `http ${String(response.status)}`,
      };
    }
    return {
      ok: true,
      status: response.status,
      payload: data,
      errorMessage: '',
    };
  }

  buildComputedState(config, inputTokens, status, responseId, message = '') {
    const available = Math.max(0, config.maxContextTokens - config.reserveOutputTokens);
    const remainingTokens = Math.max(0, available - inputTokens);
    const remainingRatio = available > 0 ? remainingTokens / available : 0;
    return {
      provider: 'openai-responses',
      enabled: config.enabled,
      strategy: config.strategy,
      minRemainingRatio: config.minRemainingRatio,
      reserveOutputTokens: config.reserveOutputTokens,
      maxContextTokens: config.maxContextTokens,
      lastCountAt: nowIso(),
      inputTokens,
      remainingTokens,
      remainingRatio: round4(remainingRatio),
      lastCompactedAt: '',
      lastCompactionResponseId: responseId || '',
      status,
      message,
      suggestedAction: compactSuggestion(status, config.strategy),
    };
  }

  async status() {
    const config = await this.loadConfig();
    const lastState = await this.readState();
    const baseState = createBaseState(config);
    if (!config.enabled) {
      const next = {
        ...baseState,
        status: 'disabled',
        message: 'codex context policy disabled',
        suggestedAction: 'none',
      };
      await this.writeState(next);
      return { ok: true, ...next };
    }

    const apiKey = process.env.OPENAI_API_KEY || '';
    if (!apiKey) {
      const next = {
        ...baseState,
        status: 'api-key-missing',
        message: 'OPENAI_API_KEY is required for codex context management',
        suggestedAction: 'set-openai-api-key',
      };
      await this.writeState(next);
      return { ok: false, ...next };
    }

    const responseId = resolveResponseId(lastState);
    if (!responseId) {
      const next = {
        ...baseState,
        status: 'no-response-id',
        message: 'ASK_CODEX_RESPONSE_ID (or previous compaction id) is required',
        suggestedAction: 'set-ask-codex-response-id',
      };
      await this.writeState(next);
      return { ok: false, ...next };
    }

    const countResult = await this.postJson(
      '/responses/input_tokens',
      {
        response_id: responseId,
        model: config.model,
      },
      apiKey
    );
    if (!countResult.ok) {
      const next = {
        ...baseState,
        status: 'api-error',
        message: `input token count failed: ${countResult.errorMessage}`,
        suggestedAction: 'retry-after-api-recovery',
      };
      await this.writeState(next);
      return { ok: false, ...next };
    }

    const inputTokens = parseInputTokens(countResult.payload);
    const computed = this.buildComputedState(config, inputTokens, 'ok', responseId, '');
    if (computed.remainingRatio < config.minRemainingRatio) {
      computed.status = 'below-threshold';
      computed.suggestedAction = compactSuggestion('below-threshold', config.strategy);
      computed.message = `remaining ratio ${computed.remainingRatio} is below ${config.minRemainingRatio}`;
    }

    const next = await this.writeState(computed);
    return { ok: true, ...next };
  }

  async compact() {
    const statusPayload = await this.status();
    if (!statusPayload.enabled) {
      return statusPayload;
    }
    if (statusPayload.status === 'api-key-missing' || statusPayload.status === 'no-response-id' || statusPayload.status === 'api-error') {
      return statusPayload;
    }

    const apiKey = process.env.OPENAI_API_KEY || '';
    const responseId = statusPayload.lastCompactionResponseId || resolveResponseId(statusPayload);
    const compactResult = await this.postJson(
      '/responses/compact',
      {
        response_id: responseId,
      },
      apiKey
    );

    if (!compactResult.ok) {
      const failed = await this.writeState({
        ...statusPayload,
        status: 'compact-failed',
        message: `compaction failed: ${compactResult.errorMessage}`,
        suggestedAction: 'retry-after-api-recovery',
      });
      return { ok: false, ...failed };
    }

    const nextResponseId =
      compactResult.payload?.id || compactResult.payload?.response?.id || compactResult.payload?.response_id || responseId;
    const compacted = await this.writeState({
      ...statusPayload,
      status: 'compacted',
      lastCompactedAt: nowIso(),
      lastCompactionResponseId: nextResponseId,
      message: 'compaction completed',
      suggestedAction: 'continue',
    });
    return { ok: true, ...compacted };
  }

  async ensure() {
    const statusPayload = await this.status();
    if (!statusPayload.enabled || statusPayload.status !== 'below-threshold') {
      return statusPayload;
    }

    if (statusPayload.strategy === 'auto') {
      const next = await this.writeState({
        ...statusPayload,
        message: 'below threshold; server-side auto compact strategy selected',
        suggestedAction: 'monitor-auto-compact',
      });
      return { ok: true, ...next };
    }

    return this.compact();
  }
}
