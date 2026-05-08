import { CommitMessageCheckEngine } from '../../core/CommitMessageCheckEngine.js';

export async function runCommitMsgCheck(args = []) {
  const engine = new CommitMessageCheckEngine(process.cwd());
  const result = await engine.run(args[0] ?? '');
  console.log(JSON.stringify(result, null, 2));
  if (!result.passed) {
    process.exitCode = 1;
  }
}
