import { WorkflowAdapter } from './WorkflowAdapter.js';

const SKILLS = {
  PLAN: 'writing-plans',
  EXECUTE: 'executing-plans',
  VERIFY: 'verification-before-completion',
};

export class SuperpowersAdapter extends WorkflowAdapter {
  constructor() {
    super('superpowers', [SKILLS.PLAN, SKILLS.EXECUTE, SKILLS.VERIFY]);
  }

  recommend(input) {
    const task = input?.task ?? {};
    const verification = input?.verification ?? null;
    const status = String(task.status ?? '').trim().toLowerCase();

    if (status === 'created') {
      return {
        workflow: this.workflowName,
        skill: SKILLS.PLAN,
        reason: 'Task is newly created and needs implementation planning.',
      };
    }

    if (status === 'completed' && verification?.status !== 'passed') {
      return {
        workflow: this.workflowName,
        skill: SKILLS.VERIFY,
        reason: 'Task is completed but verification is not yet passed.',
      };
    }

    return {
      workflow: this.workflowName,
      skill: SKILLS.EXECUTE,
      reason: 'Task is active; continue implementation execution.',
    };
  }
}
