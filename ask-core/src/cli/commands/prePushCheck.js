import { PrePushCheckEngine } from '../../core/PrePushCheckEngine.js';

export async function runPrePushCheck() {
  const engine = new PrePushCheckEngine(process.cwd());
  const result = await engine.run();
  console.log(JSON.stringify(result, null, 2));
  if (!result.passed) {
    process.exitCode = 1;
  }
}
