import { RuntimeProjectionEngine } from '../../runtime/RuntimeProjectionEngine.js';

export async function runReplay() {
  const engine = new RuntimeProjectionEngine(process.cwd());
  const summary = await engine.replay();
  console.log(
    JSON.stringify(
      {
        ok: true,
        ...summary,
      },
      null,
      2
    )
  );
}
