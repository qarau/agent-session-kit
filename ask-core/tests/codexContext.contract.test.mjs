import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const thisFilePath = fileURLToPath(import.meta.url);
const testsDir = path.dirname(thisFilePath);
const askCoreRoot = path.resolve(testsDir, '..');
const askBinPath = path.join(askCoreRoot, 'bin', 'ask.js');

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: options.cwd,
    encoding: 'utf8',
    env: options.env ? { ...process.env, ...options.env } : process.env,
  });
  return {
    status: result.status,
    stdout: result.stdout ?? '',
    stderr: result.stderr ?? '',
  };
}

function runOrThrow(command, args, options = {}) {
  const result = run(command, args, options);
  if (result.status !== 0) {
    throw new Error(
      [
        `Command failed: ${command} ${args.join(' ')}`,
        `status=${String(result.status)}`,
        result.stdout,
        result.stderr,
      ].join('\n')
    );
  }
  return result;
}

function runAsync(command, args, options = {}) {
  return new Promise((resolve) => {
    const child = spawn(command, args, {
      cwd: options.cwd,
      env: options.env ? { ...process.env, ...options.env } : process.env,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk) => {
      stdout += chunk.toString('utf8');
    });
    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString('utf8');
    });
    child.on('close', (status) => {
      resolve({
        status,
        stdout,
        stderr,
      });
    });
  });
}

function setupRepo() {
  const repoDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ask-codex-context-'));
  runOrThrow('git', ['init'], { cwd: repoDir });
  runOrThrow('git', ['config', 'user.email', 'test@example.com'], { cwd: repoDir });
  runOrThrow('git', ['config', 'user.name', 'Test User'], { cwd: repoDir });
  runOrThrow('git', ['checkout', '-b', 'ask-runtime'], { cwd: repoDir });
  runOrThrow(process.execPath, [askBinPath, 'init'], { cwd: repoDir });
  return repoDir;
}

function writePolicy(repoDir, content) {
  const policyPath = path.join(repoDir, '.ask', 'policy', 'runtime-policy.yaml');
  fs.mkdirSync(path.dirname(policyPath), { recursive: true });
  fs.writeFileSync(policyPath, content, 'utf8');
}

async function withMockServer(handler, callback) {
  const sockets = new Set();
  const server = http.createServer(async (req, res) => {
    let body = '';
    req.on('data', chunk => {
      body += chunk.toString('utf8');
    });
    req.on('end', async () => {
      try {
        await handler(req, body, res);
      } catch (error) {
        res.statusCode = 500;
        res.setHeader('content-type', 'application/json');
        res.end(JSON.stringify({ error: error.message }));
      }
    });
  });
  server.on('connection', (socket) => {
    sockets.add(socket);
    socket.on('close', () => {
      sockets.delete(socket);
    });
  });

  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  const baseUrl = `http://127.0.0.1:${address.port}`;
  try {
    await callback(baseUrl);
  } finally {
    for (const socket of sockets) {
      socket.destroy();
    }
    if (typeof server.closeAllConnections === 'function') {
      server.closeAllConnections();
    }
    await new Promise((resolve) => server.close(resolve));
  }
}

test('codex context status reports disabled policy deterministically', () => {
  const repoDir = setupRepo();
  const result = run(process.execPath, [askBinPath, 'codex', 'context', 'status'], { cwd: repoDir });
  assert.equal(result.status, 0, result.stdout + result.stderr);
  const payload = JSON.parse(result.stdout);
  assert.equal(payload.ok, true);
  assert.equal(payload.status, 'disabled');
});

test('codex context ensure compacts when remaining ratio is below threshold in explicit mode', async () => {
  const repoDir = setupRepo();
  writePolicy(
    repoDir,
    `version: 1

session:
  require_resume_before_edit: true
  allowed_preflight_states: active,paused
  allowed_can_commit_states: active,paused

checks:
  require_docs_freshness: true
  require_tests_before_commit: true

codex_context:
  enabled: true
  min_remaining_ratio: 0.10
  reserve_output_tokens: 0
  max_context_tokens: 1000
  strategy: explicit
`
  );

  let compactCalls = 0;
  await withMockServer(async (req, body, res) => {
    if (req.url === '/responses/input_tokens' && req.method === 'POST') {
      res.statusCode = 200;
      res.setHeader('content-type', 'application/json');
      res.end(JSON.stringify({ input_tokens: 960 }));
      return;
    }
    if (req.url === '/responses/compact' && req.method === 'POST') {
      compactCalls += 1;
      res.statusCode = 200;
      res.setHeader('content-type', 'application/json');
      const parsed = JSON.parse(body || '{}');
      res.end(JSON.stringify({ id: `cmp_${parsed.response_id || 'next'}` }));
      return;
    }
    res.statusCode = 404;
    res.end();
  }, async (baseUrl) => {
    const result = await runAsync(process.execPath, [askBinPath, 'codex', 'context', 'ensure'], {
      cwd: repoDir,
      env: {
        OPENAI_API_KEY: 'test-key',
        OPENAI_BASE_URL: baseUrl,
        ASK_CODEX_RESPONSE_ID: 'resp_123',
      },
    });
    assert.equal(result.status, 0, result.stdout + result.stderr);
    const payload = JSON.parse(result.stdout);
    assert.equal(payload.ok, true);
    assert.equal(payload.status, 'compacted');
    assert.equal(compactCalls, 1);
  });
});

test('codex context ensure skips compact when ratio is above threshold', async () => {
  const repoDir = setupRepo();
  writePolicy(
    repoDir,
    `version: 1

session:
  require_resume_before_edit: true
  allowed_preflight_states: active,paused
  allowed_can_commit_states: active,paused

checks:
  require_docs_freshness: true
  require_tests_before_commit: true

codex_context:
  enabled: true
  min_remaining_ratio: 0.10
  reserve_output_tokens: 0
  max_context_tokens: 1000
  strategy: explicit
`
  );

  let compactCalls = 0;
  await withMockServer(async (req, body, res) => {
    if (req.url === '/responses/input_tokens' && req.method === 'POST') {
      res.statusCode = 200;
      res.setHeader('content-type', 'application/json');
      res.end(JSON.stringify({ input_tokens: 200 }));
      return;
    }
    if (req.url === '/responses/compact' && req.method === 'POST') {
      compactCalls += 1;
      res.statusCode = 200;
      res.setHeader('content-type', 'application/json');
      const parsed = JSON.parse(body || '{}');
      res.end(JSON.stringify({ id: `cmp_${parsed.response_id || 'next'}` }));
      return;
    }
    res.statusCode = 404;
    res.end();
  }, async (baseUrl) => {
    const result = await runAsync(process.execPath, [askBinPath, 'codex', 'context', 'ensure'], {
      cwd: repoDir,
      env: {
        OPENAI_API_KEY: 'test-key',
        OPENAI_BASE_URL: baseUrl,
        ASK_CODEX_RESPONSE_ID: 'resp_123',
      },
    });
    assert.equal(result.status, 0, result.stdout + result.stderr);
    const payload = JSON.parse(result.stdout);
    assert.equal(payload.ok, true);
    assert.equal(payload.status, 'ok');
    assert.equal(compactCalls, 0);
  });
});

test('codex context status degrades gracefully when API key is missing', () => {
  const repoDir = setupRepo();
  writePolicy(
    repoDir,
    `version: 1

session:
  require_resume_before_edit: true
  allowed_preflight_states: active,paused
  allowed_can_commit_states: active,paused

checks:
  require_docs_freshness: true
  require_tests_before_commit: true

codex_context:
  enabled: true
  min_remaining_ratio: 0.10
  reserve_output_tokens: 12000
  max_context_tokens: 400000
  strategy: explicit
`
  );

  const result = run(process.execPath, [askBinPath, 'codex', 'context', 'status'], {
    cwd: repoDir,
    env: {
      OPENAI_API_KEY: '',
      ASK_CODEX_RESPONSE_ID: 'resp_123',
    },
  });
  assert.equal(result.status, 0, result.stdout + result.stderr);
  const payload = JSON.parse(result.stdout);
  assert.equal(payload.ok, false);
  assert.equal(payload.status, 'api-key-missing');
});
