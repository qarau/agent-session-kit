import { PreCommitCheckEngine } from '../../core/PreCommitCheckEngine.js';

export async function runPreCommitCheck() {
  const engine = new PreCommitCheckEngine(process.cwd());
  const result = await engine.run();
  console.log(JSON.stringify(result, null, 2));
  if (!result.passed) {
    process.exitCode = 1;
  }
}
