#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

function getArgValue(argv, name, fallback = '') {
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === name) {
      const next = argv[index + 1];
      if (!next || next.startsWith('--')) {
        return fallback;
      }
      return next;
    }
    if (arg.startsWith(`${name}=`)) {
      return arg.slice(name.length + 1);
    }
  }
  return fallback;
}

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function writeFileIfMissing(filePath, content) {
  ensureDir(path.dirname(filePath));
  if (fs.existsSync(filePath)) {
    console.log(`[skip] ${filePath}`);
    return;
  }
  fs.writeFileSync(filePath, content, 'utf8');
  console.log(`[write] ${filePath}`);
}

const files = {
  'ask-core/package.json': `{
  "name": "ask-core",
  "version": "0.1.0",
  "type": "module",
  "description": "Platform-agnostic developer-agent runtime",
  "bin": {
    "ask": "./bin/ask.js"
  },
  "scripts": {
    "test": "node --test tests"
  },
  "license": "MIT"
}
`,
  'ask-core/README.md': `# ask-core

Standalone runtime core for ASK.
`,
  'ask-core/bin/ask.js': `#!/usr/bin/env node
import { runCli } from '../src/cli/index.js';

runCli(process.argv.slice(2)).catch(error => {
  console.error(\`[ask-core] \${error.message}\`);
  process.exit(1);
});
`,
  'ask-core/src/cli/index.js': `import { runInit } from './commands/init.js';
import { runSession } from './commands/session.js';
import { runContext } from './commands/context.js';
import { runPreflight } from './commands/preflight.js';
import { runCanCommit } from './commands/canCommit.js';
import { runHandoff } from './commands/handoff.js';

function printHelp() {
  console.log(\`ASK Core CLI

Usage:
  ask init
  ask session start|resume|status|close
  ask context verify|status
  ask preflight
  ask can-commit
  ask handoff create
\`);
}

export async function runCli(args) {
  const [command, subcommand] = args;
  if (!command) {
    printHelp();
    return;
  }

  if (command === 'init') {
    await runInit();
    return;
  }

  if (command === 'session') {
    await runSession(subcommand);
    return;
  }

  if (command === 'context') {
    await runContext(subcommand);
    return;
  }

  if (command === 'preflight') {
    await runPreflight();
    return;
  }

  if (command === 'can-commit') {
    await runCanCommit();
    return;
  }

  if (command === 'handoff') {
    await runHandoff(subcommand);
    return;
  }

  printHelp();
}
`,
  'ask-core/src/cli/commands/init.js': `import { Scaffolder } from '../../fs/Scaffolder.js';

export async function runInit() {
  const scaffolder = new Scaffolder(process.cwd());
  await scaffolder.init();
  console.log('[ask-core] initialized .ask control plane');
}
`,
  'ask-core/src/cli/commands/session.js': `import { SessionRuntime } from '../../core/SessionRuntime.js';

export async function runSession(subcommand) {
  const runtime = new SessionRuntime(process.cwd());
  if (subcommand === 'start') {
    await runtime.start();
    return;
  }
  if (subcommand === 'resume') {
    await runtime.resume();
    return;
  }
  if (subcommand === 'status') {
    await runtime.status();
    return;
  }
  if (subcommand === 'close') {
    await runtime.close();
    return;
  }
  console.log('Usage: ask session start|resume|status|close');
}
`,
  'ask-core/src/cli/commands/context.js': `import { WorkContextEngine } from '../../core/WorkContextEngine.js';

export async function runContext(subcommand) {
  const engine = new WorkContextEngine(process.cwd());
  if (subcommand === 'verify') {
    await engine.verify();
    return;
  }
  if (subcommand === 'status') {
    await engine.status();
    return;
  }
  console.log('Usage: ask context verify|status');
}
`,
  'ask-core/src/cli/commands/preflight.js': `import { SessionRuntime } from '../../core/SessionRuntime.js';
import { WorkContextEngine } from '../../core/WorkContextEngine.js';
import { PolicyEngine } from '../../core/PolicyEngine.js';

export async function runPreflight() {
  const sessionRuntime = new SessionRuntime(process.cwd());
  const contextEngine = new WorkContextEngine(process.cwd());
  const policyEngine = new PolicyEngine(process.cwd());

  const session = await sessionRuntime.getActiveSession();
  const context = await contextEngine.getContext();
  const policy = await policyEngine.load();
  const missing = [];

  if (policy.session?.require_resume_before_edit && session.status !== 'active') {
    missing.push('active session required');
  }

  if (!context.branch) {
    missing.push('context verify required');
  }

  const passed = missing.length === 0;
  console.log(JSON.stringify({ passed, missing }, null, 2));
  if (!passed) {
    process.exitCode = 1;
  }
}
`,
  'ask-core/src/cli/commands/canCommit.js': `import { EvidenceRecorder } from '../../core/EvidenceRecorder.js';
import { PolicyEngine } from '../../core/PolicyEngine.js';

export async function runCanCommit() {
  const evidenceRecorder = new EvidenceRecorder(process.cwd());
  const policyEngine = new PolicyEngine(process.cwd());
  const evidence = await evidenceRecorder.readLatestChecks();
  const policy = await policyEngine.load();
  const missing = [];

  if (policy.checks?.require_docs_freshness && !evidence.docsFresh) {
    missing.push('docs freshness');
  }

  if (policy.checks?.require_tests_before_commit && !evidence.testsPassed) {
    missing.push('tests');
  }

  const ok = missing.length === 0;
  console.log(JSON.stringify({ ok, missing }, null, 2));
  if (!ok) {
    process.exitCode = 1;
  }
}
`,
  'ask-core/src/cli/commands/handoff.js': `import { HandoffEngine } from '../../core/HandoffEngine.js';

export async function runHandoff(subcommand) {
  const engine = new HandoffEngine(process.cwd());
  if (subcommand === 'create') {
    await engine.create();
    return;
  }
  console.log('Usage: ask handoff create');
}
`,
  'ask-core/src/core/SessionRuntime.js': `import { AskPaths } from '../fs/AskPaths.js';
import { FileStore } from '../fs/FileStore.js';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

function nowIso() {
  return new Date().toISOString();
}

function createSession(overrides = {}) {
  return {
    sessionId: \`sess_\${Date.now().toString(36)}\`,
    status: 'idle',
    branch: '',
    worktree: '',
    taskId: '',
    actorType: 'human',
    actorId: 'local',
    startedAt: '',
    lastActiveAt: '',
    ...overrides,
  };
}

async function getGitValue(cwd, args, allowFailure = false) {
  try {
    const { stdout } = await execFileAsync('git', args, { cwd });
    return stdout.trim();
  } catch (error) {
    if (allowFailure) {
      return '';
    }
    throw error;
  }
}

export class SessionRuntime {
  constructor(cwd) {
    this.cwd = cwd;
    this.paths = new AskPaths(cwd);
    this.store = new FileStore();
  }

  async start() {
    const branch = await getGitValue(this.cwd, ['branch', '--show-current'], true);
    const worktree = await getGitValue(this.cwd, ['rev-parse', '--show-toplevel'], true);
    const session = createSession({
      status: 'active',
      branch,
      worktree,
      startedAt: nowIso(),
      lastActiveAt: nowIso(),
    });
    await this.store.writeJson(this.paths.activeSession(), session);
    console.log(JSON.stringify(session, null, 2));
  }

  async resume() {
    const session = await this.getActiveSession();
    session.status = 'active';
    session.lastActiveAt = nowIso();
    await this.store.writeJson(this.paths.activeSession(), session);
    console.log(JSON.stringify(session, null, 2));
  }

  async status() {
    const session = await this.getActiveSession();
    console.log(JSON.stringify(session, null, 2));
  }

  async close() {
    const session = await this.getActiveSession();
    session.status = 'closed';
    session.lastActiveAt = nowIso();
    await this.store.writeJson(this.paths.activeSession(), session);
    console.log(JSON.stringify(session, null, 2));
  }

  async getActiveSession() {
    return this.store.readJson(this.paths.activeSession(), createSession());
  }
}
`,
  'ask-core/src/core/WorkContextEngine.js': `import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { AskPaths } from '../fs/AskPaths.js';
import { FileStore } from '../fs/FileStore.js';

const execFileAsync = promisify(execFile);

function nowIso() {
  return new Date().toISOString();
}

async function getGitValue(cwd, args, allowFailure = false) {
  try {
    const { stdout } = await execFileAsync('git', args, { cwd });
    return stdout.trim();
  } catch (error) {
    if (allowFailure) {
      return '';
    }
    throw error;
  }
}

export class WorkContextEngine {
  constructor(cwd) {
    this.cwd = cwd;
    this.paths = new AskPaths(cwd);
    this.store = new FileStore();
  }

  async verify() {
    const repoRoot = await getGitValue(this.cwd, ['rev-parse', '--show-toplevel'], true);
    const branch = await getGitValue(this.cwd, ['branch', '--show-current'], true);
    const context = {
      repoRoot,
      branch,
      worktree: this.cwd,
      verifiedAt: nowIso(),
    };
    await this.store.writeJson(this.paths.workContext(), context);
    console.log(JSON.stringify(context, null, 2));
  }

  async status() {
    const context = await this.getContext();
    console.log(JSON.stringify(context, null, 2));
  }

  async getContext() {
    return this.store.readJson(this.paths.workContext(), {
      repoRoot: '',
      branch: '',
      worktree: '',
      verifiedAt: '',
    });
  }
}
`,
  'ask-core/src/core/PolicyEngine.js': `import { AskPaths } from '../fs/AskPaths.js';
import { FileStore } from '../fs/FileStore.js';
import { defaultPolicyYaml } from '../policy/defaultPolicy.js';

function coerceYamlValue(value) {
  if (value === 'true') {
    return true;
  }
  if (value === 'false') {
    return false;
  }
  return value;
}

function parseSimpleYaml(text) {
  const result = {};
  let section = '';
  const lines = text.split(/\\r?\\n/);
  for (const rawLine of lines) {
    const line = rawLine.trimEnd();
    if (!line || line.trim().startsWith('#')) {
      continue;
    }
    if (!line.startsWith(' ') && line.endsWith(':')) {
      section = line.slice(0, -1).trim();
      if (!result[section]) {
        result[section] = {};
      }
      continue;
    }
    if (section && line.startsWith('  ') && line.includes(':')) {
      const split = line.trim().split(':');
      const key = split.shift().trim();
      const value = split.join(':').trim();
      result[section][key] = coerceYamlValue(value);
    }
  }
  return result;
}

export class PolicyEngine {
  constructor(cwd) {
    this.paths = new AskPaths(cwd);
    this.store = new FileStore();
  }

  async load() {
    const raw = await this.store.readText(this.paths.runtimePolicy(), defaultPolicyYaml);
    return parseSimpleYaml(raw);
  }
}
`,
  'ask-core/src/core/EvidenceRecorder.js': `import { AskPaths } from '../fs/AskPaths.js';
import { FileStore } from '../fs/FileStore.js';

export class EvidenceRecorder {
  constructor(cwd) {
    this.paths = new AskPaths(cwd);
    this.store = new FileStore();
  }

  async readLatestChecks() {
    return this.store.readJson(this.paths.latestChecks(), {
      docsFresh: false,
      testsPassed: false,
      checks: [],
    });
  }

  async writeLatestChecks(payload) {
    await this.store.writeJson(this.paths.latestChecks(), payload);
  }
}
`,
  'ask-core/src/core/HandoffEngine.js': `import { AskPaths } from '../fs/AskPaths.js';
import { FileStore } from '../fs/FileStore.js';

export class HandoffEngine {
  constructor(cwd) {
    this.paths = new AskPaths(cwd);
    this.store = new FileStore();
  }

  async create() {
    const content = \`# Latest Handoff

## Summary
- session paused

## Open Loops
- none

## Next Actions
- resume session
\`;
    await this.store.writeText(this.paths.latestHandoff(), content);
    console.log('[ask-core] handoff created');
  }
}
`,
  'ask-core/src/fs/AskPaths.js': `import path from 'node:path';

export class AskPaths {
  constructor(cwd) {
    this.cwd = cwd;
    this.root = path.join(cwd, '.ask');
  }

  policyDir() {
    return path.join(this.root, 'policy');
  }

  sessionsDir() {
    return path.join(this.root, 'sessions');
  }

  continuityDir() {
    return path.join(this.root, 'continuity');
  }

  evidenceDir() {
    return path.join(this.root, 'evidence');
  }

  handoffsDir() {
    return path.join(this.root, 'handoffs');
  }

  stateDir() {
    return path.join(this.root, 'state');
  }

  runtimePolicy() {
    return path.join(this.policyDir(), 'runtime-policy.yaml');
  }

  activeSession() {
    return path.join(this.sessionsDir(), 'active-session.json');
  }

  currentStatus() {
    return path.join(this.continuityDir(), 'current-status.md');
  }

  openLoops() {
    return path.join(this.continuityDir(), 'open-loops.md');
  }

  nextActions() {
    return path.join(this.continuityDir(), 'next-actions.md');
  }

  latestChecks() {
    return path.join(this.evidenceDir(), 'latest-checks.json');
  }

  latestHandoff() {
    return path.join(this.handoffsDir(), 'latest-handoff.md');
  }

  workContext() {
    return path.join(this.stateDir(), 'work-context.json');
  }
}
`,
  'ask-core/src/fs/FileStore.js': `import fs from 'node:fs/promises';
import path from 'node:path';

export class FileStore {
  async ensureDir(dirPath) {
    await fs.mkdir(dirPath, { recursive: true });
  }

  async writeJson(filePath, data) {
    await this.ensureDir(path.dirname(filePath));
    await fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf8');
  }

  async readJson(filePath, fallback = {}) {
    try {
      const raw = await fs.readFile(filePath, 'utf8');
      return JSON.parse(raw);
    } catch {
      return fallback;
    }
  }

  async writeText(filePath, content) {
    await this.ensureDir(path.dirname(filePath));
    await fs.writeFile(filePath, content, 'utf8');
  }

  async readText(filePath, fallback = '') {
    try {
      return await fs.readFile(filePath, 'utf8');
    } catch {
      return fallback;
    }
  }

  async ensureText(filePath, content) {
    try {
      await fs.access(filePath);
    } catch {
      await this.writeText(filePath, content);
    }
  }
}
`,
  'ask-core/src/fs/Scaffolder.js': `import { AskPaths } from './AskPaths.js';
import { FileStore } from './FileStore.js';
import { defaultPolicyYaml } from '../policy/defaultPolicy.js';

export class Scaffolder {
  constructor(cwd) {
    this.paths = new AskPaths(cwd);
    this.store = new FileStore();
  }

  async init() {
    await this.store.ensureDir(this.paths.policyDir());
    await this.store.ensureDir(this.paths.sessionsDir());
    await this.store.ensureDir(this.paths.continuityDir());
    await this.store.ensureDir(this.paths.evidenceDir());
    await this.store.ensureDir(this.paths.handoffsDir());
    await this.store.ensureDir(this.paths.stateDir());

    await this.store.ensureText(this.paths.runtimePolicy(), defaultPolicyYaml);
    await this.store.writeJson(this.paths.activeSession(), {
      sessionId: '',
      status: 'idle',
      branch: '',
      worktree: '',
      taskId: '',
      actorType: '',
      actorId: '',
      startedAt: '',
      lastActiveAt: '',
    });
    await this.store.ensureText(this.paths.currentStatus(), '# Current Status\\n');
    await this.store.ensureText(this.paths.openLoops(), '# Open Loops\\n');
    await this.store.ensureText(this.paths.nextActions(), '# Next Actions\\n');
    await this.store.writeJson(this.paths.latestChecks(), {
      docsFresh: false,
      testsPassed: false,
      checks: [],
    });
    await this.store.ensureText(this.paths.latestHandoff(), '# Latest Handoff\\n');
    await this.store.writeJson(this.paths.workContext(), {
      repoRoot: '',
      branch: '',
      worktree: '',
      verifiedAt: '',
    });
  }
}
`,
  'ask-core/src/policy/defaultPolicy.js': `export const defaultPolicyYaml = \`version: 1

session:
  require_resume_before_edit: true

checks:
  require_docs_freshness: true
  require_tests_before_commit: false
\`;
`,
};

function main() {
  const targetRoot = path.resolve(getArgValue(process.argv.slice(2), '--target', process.cwd()));
  for (const [relativePath, content] of Object.entries(files)) {
    writeFileIfMissing(path.join(targetRoot, relativePath), content);
  }

  const askBinPath = path.join(targetRoot, 'ask-core', 'bin', 'ask.js');
  try {
    fs.chmodSync(askBinPath, 0o755);
  } catch {
    // no-op on platforms without chmod semantics
  }
}

main();
