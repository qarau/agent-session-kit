import { runPrePushAdapter } from '../../ask-core/src/adapters/sessionKit/runPrePushAdapter.js';

runPrePushAdapter(process.cwd()).catch((error) => {
  console.error(error?.message ?? String(error));
  process.exit(1);
});
