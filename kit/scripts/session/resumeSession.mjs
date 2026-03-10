import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { execFileSync } from 'node:child_process';

function getGitValue(args, fallback = 'unknown') {
  try {
    return execFileSync('git', args, { encoding: 'utf8' }).trim() || fallback;
  } catch {
    return fallback;
  }
}

function readFileIfExists(filePath) {
  if (!fs.existsSync(filePath)) {
    return '';
  }
  return fs.readFileSync(filePath, 'utf8');
}

function extractSectionText(markdown, heading) {
  const lines = markdown.split(/\r?\n/);
  const startIndex = lines.findIndex((line) => line.trim() === heading.trim());
  if (startIndex < 0) {
    return '';
  }

  const sectionLines = [];
  for (let index = startIndex + 1; index < lines.length; index += 1) {
    const line = lines[index];
    if (line.startsWith('## ')) {
      break;
    }
    if (line.trim().length > 0) {
      sectionLines.push(line.trim());
    }
  }

  return sectionLines.join(' ').trim();
}

function extractFirstUncheckedTask(markdown) {
  const lines = markdown.split(/\r?\n/);
  for (const line of lines) {
    const match = line.match(/^- \[ \] (.+)$/);
    if (match) {
      return match[1].trim();
    }
  }
  return 'No open task found';
}

function extractLatestVerification(changeLogMarkdown) {
  const lines = changeLogMarkdown.split(/\r?\n/);
  for (let index = lines.length - 1; index >= 0; index -= 1) {
    const line = lines[index];
    const match = line.match(/`([^`]+)`/);
    if (!match) {
      continue;
    }
    const candidate = match[1];
    if (
      candidate.includes('npm') ||
      candidate.includes('node ') ||
      candidate.startsWith('node') ||
      candidate.includes('vitest') ||
      candidate.includes('playwright') ||
      candidate.includes('test')
    ) {
      return candidate;
    }
  }
  return 'No verification command logged';
}

function main() {
  const repoRoot = getGitValue(['rev-parse', '--show-toplevel'], process.cwd());
  const branch = getGitValue(['branch', '--show-current']);
  const head = getGitValue(['log', '-1', '--pretty=format:%h %s'], 'No commits yet');

  const currentStatusPath = path.join(repoRoot, 'docs', 'session', 'current-status.md');
  const tasksPath = path.join(repoRoot, 'docs', 'session', 'tasks.md');
  const changeLogPath = path.join(repoRoot, 'docs', 'session', 'change-log.md');

  const currentStatus = readFileIfExists(currentStatusPath);
  const tasks = readFileIfExists(tasksPath);
  const changeLog = readFileIfExists(changeLogPath);

  const objective = extractSectionText(currentStatus, '## Active Objective') || 'No active objective found';
  const nextTask = extractFirstUncheckedTask(tasks);
  const latestVerification = extractLatestVerification(changeLog);

  console.log('ASK Resume Snapshot');
  console.log(`Current branch: ${branch}`);
  console.log(`HEAD: ${head}`);
  console.log(`Objective: ${objective}`);
  console.log(`Next task: ${nextTask}`);
  console.log(`Latest verification: ${latestVerification}`);
}

main();
