import { MetricsWriter } from '../../core/MetricsWriter.js';

function getArgValue(args, name) {
  for (let index = 0; index < args.length; index += 1) {
    const value = String(args[index] ?? '');
    if (value === name) {
      return String(args[index + 1] ?? '');
    }
    if (value.startsWith(`${name}=`)) {
      return value.slice(name.length + 1);
    }
  }
  return '';
}

function toNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function printUsage() {
  console.log('Usage: ask metrics show [--history <n>]');
}

export async function runMetrics(subcommand, args = []) {
  const action = String(subcommand || 'show');
  if (!['show'].includes(action)) {
    printUsage();
    return;
  }

  const writer = new MetricsWriter(process.cwd());
  const metrics = await writer.read();
  const driftAnalytics = await writer.readDriftAnalytics();
  const historyLimit = Math.max(0, Math.floor(toNumber(getArgValue(args, '--history'), 0)));
  const history = historyLimit > 0
    ? (await writer.readHistory()).slice(-historyLimit)
    : [];
  console.log(JSON.stringify({
    ...metrics,
    driftAnalytics,
    history,
  }, null, 2));
}
