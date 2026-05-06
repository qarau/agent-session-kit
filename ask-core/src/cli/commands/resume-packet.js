import { ResumePacketReader } from '../../core/ResumePacketReader.js';

function printUsage() {
  console.log('Usage: ask resume-packet show');
}

export async function runResumePacket(subcommand) {
  const action = String(subcommand || 'show');
  if (!['show'].includes(action)) {
    printUsage();
    return;
  }

  const reader = new ResumePacketReader(process.cwd());
  const payload = await reader.read();
  console.log(JSON.stringify(payload, null, 2));
}
