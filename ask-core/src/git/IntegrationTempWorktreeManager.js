import fs from 'node:fs/promises';
import path from 'node:path';

function normalize(value) {
  return String(value ?? '').trim();
}

export class IntegrationTempWorktreeManager {
  constructor(cwd) {
    this.cwd = cwd;
  }

  async provision(runId = '') {
    const resolvedRunId = normalize(runId) || 'default';
    const workspacePath = path.join(this.cwd, '.ask', 'runtime', 'integration-workspaces', resolvedRunId);
    await fs.mkdir(workspacePath, { recursive: true });
    return {
      path: workspacePath,
      mode: 'runtime-workspace',
      async cleanup() {
        try {
          await fs.rm(workspacePath, { recursive: true, force: true });
        } catch {
          // no-op cleanup fallback
        }
      },
    };
  }
}
