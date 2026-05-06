import { buildPreviewIntent, hydrateRuntimePreview } from './runtimePreviewSupport.js';

function printUsage() {
  console.log('Usage: ask intent preview');
}

export async function runIntent(subcommand) {
  const action = String(subcommand || 'preview');
  if (!['preview'].includes(action)) {
    printUsage();
    return;
  }

  const { state, policy } = await hydrateRuntimePreview(process.cwd());
  const intent = buildPreviewIntent(state, policy);
  console.log(JSON.stringify({
    ok: true,
    intent,
    state: {
      sessionId: state.sessionId,
      status: state.status,
      nextRecommendedAction: state.nextRecommendedAction,
      dirtyWorktree: state.dirtyWorktree,
      continuityValid: state.continuityValid,
    },
  }, null, 2));
}
