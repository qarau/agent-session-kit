import { PolicyEngine } from '../../core/PolicyEngine.js';
import { RuntimeStateEngine } from '../../core/RuntimeStateEngine.js';

export async function runProjectState() {
  const policyEngine = new PolicyEngine(process.cwd());
  const stateEngine = new RuntimeStateEngine(process.cwd());
  const policy = await policyEngine.load();
  const payload = await stateEngine.hydrate(policy);
  console.log(JSON.stringify(payload, null, 2));
}
