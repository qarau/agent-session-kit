import { PlanModePrepareRuntime } from './PlanModePrepareRuntime.js';
import { PlanModeHandoffRuntime } from './PlanModeHandoffRuntime.js';

function normalize(value) {
  return String(value ?? '').trim();
}

function slugify(value, fallback = 'implementation-plan') {
  const slug = normalize(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/gu, '-')
    .replace(/^-+|-+$/gu, '');
  return slug || fallback;
}

function fail(code, message, extra = {}) {
  return {
    ok: false,
    code,
    message,
    ...extra,
  };
}

export class ImplementationBeginRuntime {
  constructor(cwd) {
    this.cwd = cwd;
    this.prepareRuntime = new PlanModePrepareRuntime(cwd);
    this.handoffRuntime = new PlanModeHandoffRuntime(cwd);
  }

  validateInput(options = {}) {
    const title = normalize(options.title);
    const planPath = normalize(options.planPath || options.plan || options.source);
    if (!title) {
      return fail('missing-title', 'title is required');
    }
    if (!planPath) {
      return fail('missing-plan', 'plan markdown path is required');
    }
    return {
      ok: true,
      title,
      planPath,
      planPrefix: normalize(options.planPrefix || options.prefix),
      date: normalize(options.date),
      taskId: normalize(options.taskId || options.task) || slugify(title),
      runId: normalize(options.runId) || `${slugify(title)}-run`,
      workflow: normalize(options.workflow) || 'superpowers',
      skill: normalize(options.skill) || 'writing-plans',
      forceNewBatch: options.forceNewBatch === true,
    };
  }

  async begin(options = {}) {
    const input = this.validateInput(options);
    if (!input.ok) {
      return input;
    }

    const prepared = await this.prepareRuntime.prepare({
      title: input.title,
      sourceMarkdownPath: input.planPath,
      planPrefix: input.planPrefix,
      date: input.date,
    });
    if (!prepared.ok) {
      return {
        ...prepared,
        phase: 'prepare',
      };
    }

    const handoff = await this.handoffRuntime.handoff({
      title: input.title,
      sourceMarkdownPath: prepared.markdownPath,
      planJsonPath: prepared.planJsonPath,
      taskId: input.taskId,
      runId: input.runId,
      workflow: input.workflow,
      skill: input.skill,
      forceNewBatch: input.forceNewBatch,
    });
    if (!handoff.ok) {
      return {
        ...handoff,
        phase: 'handoff',
        prepare: prepared,
      };
    }

    return {
      ok: true,
      title: input.title,
      prepare: prepared,
      handoff,
      createdTaskIds: Array.isArray(handoff.createdTaskIds) ? [...handoff.createdTaskIds] : [],
      nextTask: handoff.nextTask ?? null,
      nextAction: normalize(handoff.nextAction) || 'ask next',
    };
  }
}
