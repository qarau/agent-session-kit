import { randomUUID } from 'node:crypto';
import { AskPaths } from '../fs/AskPaths.js';
import { FileStore } from '../fs/FileStore.js';

function nowIso() {
  return new Date().toISOString();
}

function normalize(value) {
  return String(value ?? '').trim();
}

export const AUTONOMOUS_LOOP_STEPS = [
  'hydrate_runtime_state',
  'read_requirement',
  'analyze_architectural_context',
  'generate_intent',
  'create_slice',
  'launch_governed_codex_runtime',
  'execute_changes',
  'run_validation',
  'run_ohder_governance_validation',
  'measure_entropy_impact',
  'trigger_refactor_governance_if_needed',
  'revalidate',
  'update_ledger',
  'generate_checkpoint',
  'update_resume_packet',
  'decide_continue_retry_block_close',
];

function defaultLoopState() {
  return {
    loopId: '',
    sessionId: '',
    status: 'idle',
    currentStep: {
      index: 0,
      name: '',
      enteredAt: '',
    },
    history: [],
    decision: '',
    startedAt: '',
    completedAt: '',
    updatedAt: '',
  };
}

export class AutonomousLoopStateMachine {
  constructor(cwd) {
    this.paths = new AskPaths(cwd);
    this.store = new FileStore();
  }

  async read() {
    return this.store.readJson(this.paths.loopState(), defaultLoopState());
  }

  async start(sessionId, payload = {}) {
    const loopId = `loop_${randomUUID()}`;
    const state = {
      loopId,
      sessionId: normalize(sessionId),
      status: 'running',
      currentStep: {
        index: 0,
        name: '',
        enteredAt: '',
      },
      history: [],
      decision: '',
      startedAt: nowIso(),
      completedAt: '',
      metadata: payload,
      updatedAt: nowIso(),
    };
    await this.store.writeJson(this.paths.loopState(), state);
    return state;
  }

  async enter(stepIndex, details = {}) {
    const state = await this.read();
    const index = Number(stepIndex);
    const name = AUTONOMOUS_LOOP_STEPS[index - 1] || '';
    const entry = {
      index,
      name,
      enteredAt: nowIso(),
      details,
    };
    const history = Array.isArray(state.history) ? [...state.history, entry] : [entry];
    const next = {
      ...state,
      status: 'running',
      currentStep: {
        index,
        name,
        enteredAt: entry.enteredAt,
      },
      history: history.slice(-128),
      updatedAt: nowIso(),
    };
    await this.store.writeJson(this.paths.loopState(), next);
    return entry;
  }

  async complete(decision, details = {}) {
    const state = await this.read();
    const next = {
      ...state,
      status: 'completed',
      decision: normalize(decision),
      completedAt: nowIso(),
      updatedAt: nowIso(),
      completion: details,
    };
    await this.store.writeJson(this.paths.loopState(), next);
    return next;
  }

  async fail(decision, details = {}) {
    const state = await this.read();
    const next = {
      ...state,
      status: 'failed',
      decision: normalize(decision),
      completedAt: nowIso(),
      updatedAt: nowIso(),
      completion: details,
    };
    await this.store.writeJson(this.paths.loopState(), next);
    return next;
  }
}
