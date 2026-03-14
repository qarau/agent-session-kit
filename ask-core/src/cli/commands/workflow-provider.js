import { WorkflowRuntime } from '../../core/WorkflowRuntime.js';

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

function printResult(payload) {
  console.log(JSON.stringify(payload, null, 2));
  if (!payload.ok) {
    process.exitCode = 1;
  }
}

function printUsage() {
  console.log('Usage: ask workflow-provider status [--workflow superpowers] [--version <version>]');
}

export async function runWorkflowProvider(subcommand, args = []) {
  if (subcommand !== 'status') {
    printUsage();
    return;
  }

  const runtime = new WorkflowRuntime(process.cwd());
  const workflow = getArgValue(args, '--workflow') || 'superpowers';
  const version = getArgValue(args, '--version');
  const result = await runtime.providerStatus(workflow, version);
  printResult(result);
}
