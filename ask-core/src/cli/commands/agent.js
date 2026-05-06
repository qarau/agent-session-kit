import { AgentRuntime } from '../../core/AgentRuntime.js';
import { SubagentDispatchRuntime } from '../../core/SubagentDispatchRuntime.js';

function getArgValue(args, name) {
  for (let index = 0; index < args.length; index += 1) {
    const value = args[index];
    if (value === name) {
      return args[index + 1] ?? '';
    }
    if (value.startsWith(`${name}=`)) {
      return value.slice(name.length + 1);
    }
  }
  return '';
}

function getArgValues(args, name) {
  const values = [];
  for (let index = 0; index < args.length; index += 1) {
    const value = args[index];
    if (value === name) {
      values.push(args[index + 1] ?? '');
      continue;
    }
    if (value.startsWith(`${name}=`)) {
      values.push(value.slice(name.length + 1));
    }
  }
  return values.map(entry => String(entry ?? '').trim()).filter(Boolean);
}

function hasFlag(args, name) {
  return args.some(value => String(value ?? '') === name);
}

function printUsage() {
  console.log('Usage: ask agent register|status|dispatch');
}

function printResult(payload) {
  console.log(JSON.stringify(payload, null, 2));
  if (!payload.ok) {
    process.exitCode = 1;
  }
}

export async function runAgent(subcommand, args = []) {
  if (subcommand === 'dispatch') {
    const runtime = new SubagentDispatchRuntime(process.cwd());
    const taskId = args[0] ?? '';
    const payload = await runtime.dispatch(taskId, {
      title: getArgValue(args, '--title'),
      description: getArgValue(args, '--description'),
      owner: getArgValue(args, '--owner'),
      agentId: getArgValue(args, '--agent'),
      capabilities: getArgValue(args, '--capabilities'),
      candidates: getArgValue(args, '--candidates'),
      queueClass: getArgValue(args, '--queue-class'),
      requiredCapability: getArgValue(args, '--required-capability'),
      goal: getArgValue(args, '--goal'),
      prompt: getArgValue(args, '--prompt'),
      model: getArgValue(args, '--model'),
      reasoningEffort: getArgValue(args, '--reasoning-effort'),
      scope: getArgValue(args, '--scope'),
      childSessionId: getArgValue(args, '--child'),
      provider: getArgValue(args, '--provider') || 'codex',
      providerCommand: getArgValue(args, '--provider-command'),
      providerArgs: getArgValues(args, '--provider-arg'),
      providerCwd: getArgValue(args, '--provider-cwd'),
      bridgeUrl: getArgValue(args, '--bridge-url'),
      bridgeToken: getArgValue(args, '--bridge-token'),
      bridgePollIntervalMs: getArgValue(args, '--bridge-poll-interval-ms'),
      bridgePollTimeoutMs: getArgValue(args, '--bridge-poll-timeout-ms'),
      bridgeMockStatusesCsv: getArgValue(args, '--bridge-mock-statuses'),
      bridgeMockDispatchId: getArgValue(args, '--bridge-mock-dispatch-id'),
      bridgeMockAgentId: getArgValue(args, '--bridge-mock-agent-id'),
      timeoutMs: getArgValue(args, '--timeout-ms'),
      maxRetries: getArgValue(args, '--max-retries'),
      redactionLevel: getArgValue(args, '--redaction-level'),
      overrideApprovedBy: getArgValue(args, '--override-approved-by'),
      allowClaimOverride: hasFlag(args, '--allow-claim-override'),
      claimOverrideReason: getArgValue(args, '--claim-override-reason'),
      allowCapabilityOverride: hasFlag(args, '--allow-capability-override'),
      capabilityOverrideReason: getArgValue(args, '--capability-override-reason'),
      allowPolicyHoldOverride: hasFlag(args, '--allow-policy-hold-override'),
      policyOverrideReason: getArgValue(args, '--policy-override-reason'),
      requirePromotionGates: hasFlag(args, '--require-promotion-gates'),
      allowPromotionGateOverride: hasFlag(args, '--allow-promotion-gate-override'),
      promotionOverrideReason: getArgValue(args, '--promotion-override-reason'),
      artifactPath: getArgValue(args, '--artifact-path'),
      artifactDir: getArgValue(args, '--artifact-dir'),
      evidenceKind: getArgValue(args, '--evidence-kind'),
      evidenceSummary: getArgValue(args, '--evidence-summary'),
      verifySummary: getArgValue(args, '--verify-summary'),
      verifyOutcome: getArgValue(args, '--verify-outcome'),
      dryRun: hasFlag(args, '--dry-run'),
    });
    printResult(payload);
    return;
  }

  const runtime = new AgentRuntime(process.cwd());

  if (subcommand === 'register') {
    const agentId = args[0] ?? '';
    const capabilities = getArgValue(args, '--capabilities');
    const payload = await runtime.register(agentId, capabilities);
    printResult(payload);
    return;
  }

  if (subcommand === 'status') {
    const agentId = args[0] ?? '';
    const payload = await runtime.status(agentId);
    printResult(payload);
    return;
  }

  printUsage();
}
