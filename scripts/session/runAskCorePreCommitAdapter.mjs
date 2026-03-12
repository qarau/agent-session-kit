import { runPreCommitAdapter } from '../../ask-core/src/adapters/sessionKit/runPreCommitAdapter.js';

runPreCommitAdapter(process.cwd()).catch((error) => {
  console.error(error?.message ?? String(error));
  process.exit(1);
});
