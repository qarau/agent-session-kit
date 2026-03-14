import { spawnSync } from 'node:child_process';

function normalize(value) {
  return String(value ?? '').trim();
}

export class IntegrationOrchestrator {
  run(command, options = {}) {
    const resolvedCommand = normalize(command) || 'node -e "process.exit(0)"';
    const startedAt = Date.now();
    const result = spawnSync(resolvedCommand, {
      cwd: options.cwd,
      shell: true,
      encoding: 'utf8',
      env: options.env ?? process.env,
    });
    const finishedAt = Date.now();

    const exitCode = Number(result.status ?? 1);
    return {
      ok: exitCode === 0,
      exitCode,
      stdout: String(result.stdout ?? ''),
      stderr: String(result.stderr ?? ''),
      durationMs: finishedAt - startedAt,
      command: resolvedCommand,
    };
  }
}
