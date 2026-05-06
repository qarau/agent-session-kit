#!/usr/bin/env node

import http from 'node:http';
import os from 'node:os';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

import { Scaffolder } from '../../src/fs/Scaffolder.js';
import { SessionRuntime } from '../../src/core/SessionRuntime.js';
import { SubagentDispatchRuntime } from '../../src/core/SubagentDispatchRuntime.js';

function runOrThrow(command, args, cwd) {
  const result = spawnSync(command, args, {
    cwd,
    encoding: 'utf8',
    stdio: 'pipe',
  });
  if (result.status !== 0) {
    throw new Error(
      [
        `Command failed: ${command} ${args.join(' ')}`,
        `status=${String(result.status)}`,
        result.stdout ?? '',
        result.stderr ?? '',
      ].join('\n')
    );
  }
}

async function startBridgeServer() {
  const dispatches = new Map();
  let createCalls = 0;

  const server = http.createServer((req, res) => {
    const method = String(req.method || '').toUpperCase();
    const url = String(req.url || '');
    let body = '';
    req.on('data', chunk => {
      body += String(chunk ?? '');
    });
    req.on('end', () => {
      const json = body ? JSON.parse(body) : {};
      if (method === 'POST' && url === '/dispatches') {
        createCalls += 1;
        const dispatchId = `ci-disp-${createCalls}`;
        dispatches.set(dispatchId, { statusCursor: 0 });
        res.writeHead(201, { 'content-type': 'application/json' });
        res.end(JSON.stringify({
          ok: true,
          dispatchId,
          status: 'queued',
        }));
        return;
      }

      if (method === 'GET' && url.startsWith('/dispatches/')) {
        const dispatchId = url.slice('/dispatches/'.length);
        const record = dispatches.get(dispatchId);
        if (!record) {
          res.writeHead(404, { 'content-type': 'application/json' });
          res.end(JSON.stringify({ ok: false, error: 'not-found' }));
          return;
        }
        const statuses = ['queued', 'running', 'completed'];
        const status = statuses[Math.min(record.statusCursor, statuses.length - 1)];
        record.statusCursor = Math.min(record.statusCursor + 1, statuses.length - 1);
        res.writeHead(200, { 'content-type': 'application/json' });
        res.end(JSON.stringify({
          ok: true,
          dispatchId,
          status,
          exitCode: status === 'completed' ? 0 : null,
          codexAgentId: 'ci-codex-agent',
          artifacts: [],
        }));
        return;
      }

      if (method === 'POST' && url.startsWith('/dispatches/') && url.endsWith('/cancel')) {
        const dispatchId = url.slice('/dispatches/'.length, -('/cancel'.length));
        res.writeHead(200, { 'content-type': 'application/json' });
        res.end(JSON.stringify({
          ok: true,
          dispatchId,
          status: 'cancelled',
        }));
        return;
      }

      res.writeHead(404, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ ok: false, error: 'unknown-route' }));
    });
  });

  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, () => {
      server.removeListener('error', reject);
      resolve();
    });
  });

  const address = server.address();
  const port = typeof address === 'object' && address ? address.port : 0;
  return {
    baseUrl: `http://localhost:${String(port)}`,
    close: async () => {
      await new Promise(resolve => server.close(() => resolve()));
    },
  };
}

async function main() {
  const repoDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ask-bridge-smoke-'));
  runOrThrow('git', ['init'], repoDir);
  runOrThrow('git', ['config', 'user.email', 'test@example.com'], repoDir);
  runOrThrow('git', ['config', 'user.name', 'Test User'], repoDir);
  runOrThrow('git', ['checkout', '-b', 'ask-runtime'], repoDir);

  const scaffolder = new Scaffolder(repoDir);
  await scaffolder.init();
  const sessionRuntime = new SessionRuntime(repoDir);
  const started = await sessionRuntime.start();
  if (!started.ok) {
    throw new Error(`session start failed: ${started.message || 'unknown error'}`);
  }

  const bridge = await startBridgeServer();
  try {
    const runtime = new SubagentDispatchRuntime(repoDir);
    const result = await runtime.dispatch('ci-bridge-smoke-task', {
      title: 'CI Bridge Smoke Task',
      description: 'validate codex-bridge provider lifecycle',
      agentId: 'ci-bridge-agent',
      capabilities: 'implementer',
      provider: 'codex-bridge',
      bridgeUrl: bridge.baseUrl,
      bridgePollIntervalMs: 1,
      bridgePollTimeoutMs: 5_000,
      goal: 'bridge smoke test',
      prompt: 'execute smoke lifecycle',
    });

    if (!result.ok) {
      throw new Error(`dispatch failed: ${JSON.stringify(result)}`);
    }
    if (String(result.dispatch?.status || '') !== 'completed') {
      throw new Error(`unexpected bridge dispatch status: ${String(result.dispatch?.status || '<none>')}`);
    }
    console.log('[bridge-dispatch-smoke] PASS');
  } finally {
    await bridge.close();
  }
}

main().catch((error) => {
  console.error(`[bridge-dispatch-smoke] ${error?.message || String(error)}`);
  process.exit(1);
});
