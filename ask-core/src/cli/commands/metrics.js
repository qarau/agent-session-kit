import { MetricsWriter } from '../../core/MetricsWriter.js';

function printUsage() {
  console.log('Usage: ask metrics show');
}

export async function runMetrics(subcommand) {
  const action = String(subcommand || 'show');
  if (!['show'].includes(action)) {
    printUsage();
    return;
  }

  const writer = new MetricsWriter(process.cwd());
  const payload = await writer.read();
  console.log(JSON.stringify(payload, null, 2));
}
