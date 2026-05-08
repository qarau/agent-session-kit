import { CommitMessageCheckEngine } from '../../ask-core/src/core/CommitMessageCheckEngine.js';

const messagePath = process.argv[2] ?? '';
const engine = new CommitMessageCheckEngine(process.cwd());
const result = await engine.run(messagePath);

console.log(JSON.stringify(result, null, 2));
if (!result.passed) {
  process.exit(1);
}
