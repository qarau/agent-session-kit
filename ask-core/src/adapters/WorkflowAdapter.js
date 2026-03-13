export class WorkflowAdapter {
  constructor(workflowName, supportedSkills = []) {
    this.workflowName = String(workflowName ?? '').trim();
    this.supportedSkills = Array.isArray(supportedSkills) ? [...supportedSkills] : [];
  }

  recommend(_input) {
    throw new Error('recommend() must be implemented by workflow adapter');
  }
}
