import { CodexExecutionProvider } from './CodexExecutionProvider.js';
import { CodexBridgeExecutionProvider } from './CodexBridgeExecutionProvider.js';

function normalize(value) {
  return String(value ?? '').trim().toLowerCase();
}

export class ExecutionProviderRegistry {
  constructor(overrides = {}) {
    const providers = overrides.providers ?? {};
    this.providers = {
      codex: providers.codex ?? new CodexExecutionProvider(overrides.codexOverrides ?? {}),
      'codex-bridge': providers['codex-bridge'] ?? new CodexBridgeExecutionProvider(overrides.codexBridgeOverrides ?? {}),
      ...providers,
    };
  }

  resolve(name = 'codex') {
    const providerName = normalize(name) || 'codex';
    const provider = this.providers[providerName];
    if (!provider || typeof provider.dispatch !== 'function') {
      throw new Error(`unknown execution provider: ${providerName}`);
    }
    return {
      providerName,
      provider,
    };
  }
}
