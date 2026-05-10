import { PolicyEngine } from '../../core/PolicyEngine.js';
import { RuntimeStateEngine } from '../../core/RuntimeStateEngine.js';
import { GovernanceValidationRuntime } from '../../core/GovernanceValidationRuntime.js';
import {
  buildGovernanceExplainReport,
  buildGovernanceStatusReport,
} from '../../core/GovernanceReportBuilder.js';

function printUsage() {
  console.log('Usage: ask governance status|explain|validate');
}

export async function runGovernance(subcommand) {
  const action = String(subcommand || 'status').trim();
  if (!['status', 'explain', 'validate'].includes(action)) {
    printUsage();
    return;
  }

  const cwd = process.cwd();
  if (action === 'validate') {
    const result = await new GovernanceValidationRuntime(cwd).run();
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  const policyEngine = new PolicyEngine(cwd);
  const stateEngine = new RuntimeStateEngine(cwd);
  const policy = await policyEngine.load();
  const state = await stateEngine.hydrate(policy);

  if (action === 'status') {
    console.log(JSON.stringify(buildGovernanceStatusReport(state), null, 2));
    return;
  }

  console.log(JSON.stringify(buildGovernanceExplainReport(state), null, 2));
}
