import { SuperpowersAdapter } from './SuperpowersAdapter.js';

function normalize(name) {
  return String(name ?? '').trim().toLowerCase();
}

export class WorkflowRegistry {
  constructor(adapters = [new SuperpowersAdapter()]) {
    this.adapters = new Map();
    for (const adapter of adapters) {
      this.register(adapter);
    }
  }

  register(adapter) {
    if (!adapter || typeof adapter.recommend !== 'function') {
      throw new Error('invalid workflow adapter');
    }
    const key = normalize(adapter.workflowName);
    if (!key) {
      throw new Error('workflow adapter name is required');
    }
    this.adapters.set(key, adapter);
  }

  get(workflowName) {
    const key = normalize(workflowName);
    return this.adapters.get(key) ?? null;
  }

  recommend(workflowName, input) {
    const adapter = this.get(workflowName);
    if (!adapter) {
      return null;
    }
    return adapter.recommend(input);
  }
}
