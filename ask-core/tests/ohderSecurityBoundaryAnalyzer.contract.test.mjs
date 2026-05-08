import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { Scaffolder } from '../src/fs/Scaffolder.js';
import { ArchitectRuntime } from '../src/core/ArchitectRuntime.js';
import { OhderSecurityBoundaryAnalyzerEngine } from '../src/core/OhderSecurityBoundaryAnalyzerEngine.js';

function writeFile(repoDir, filePath, source) {
  const absolute = path.join(repoDir, filePath);
  fs.mkdirSync(path.dirname(absolute), { recursive: true });
  fs.writeFileSync(absolute, source, 'utf8');
}

async function setupRepo() {
  const repoDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ask-core-ohder-security-'));
  await new Scaffolder(repoDir).init();
  return repoDir;
}

function baseAssessment(touchedFiles) {
  return {
    state: {
      sessionId: 'sess-security',
      continuityValid: true,
      checkpointMatchesExecution: true,
    },
    slice: {
      id: 'slice-security',
      execution: {
        operation: 'security-boundary-check',
      },
    },
    execution: {
      ok: true,
      exitCode: 0,
      status: 'completed',
      touchedFiles,
    },
    validation: {
      status: 'passed',
      testsRun: ['unit'],
    },
    policy: {
      architect: {
        enabled: true,
        block_on_violation: true,
        max_entropy_delta: 3,
        max_coupling_delta: 3,
        require_replayability: true,
      },
      ohder: {
        mode: 'strict',
      },
    },
  };
}

test('architect runtime blocks strict-mode security boundary violations', async () => {
  const repoDir = await setupRepo();
  writeFile(
    repoDir,
    'src/auth/AuthTokenHandler.js',
    "export function issueToken(user) { return { token: process.env.JWT_SECRET, user, skipAuth: true }; }\n"
  );

  const status = await new ArchitectRuntime(repoDir).assess(baseAssessment([
    'src/auth/AuthTokenHandler.js',
  ]));

  assert.equal(status.securityAnalysis.risk, 'high');
  assert.equal(status.securityAnalysis.boundaryValid, false);
  assert.equal(status.ohderFacts.security_boundary, 'invalid');
  assert.equal(status.architectureScore.categories.security < 100, true);
  assert.equal(status.blocking, true);
  assert.ok(status.lawViolations.find(item => item.id === 'ohder-security-boundary'));
});

test('security analyzer categorizes role and scope authorization changes without authz tests', async () => {
  const repoDir = await setupRepo();
  writeFile(
    repoDir,
    'src/security/RoleScopePolicy.js',
    "export function canManageBilling(user) { return user.role === 'admin' && user.scope.includes('billing:write'); }\n"
  );

  const result = new OhderSecurityBoundaryAnalyzerEngine(repoDir).analyze({
    touchedFiles: ['src/security/RoleScopePolicy.js'],
  });

  assert.equal(result.risk, 'high');
  assert.equal(result.boundaryValid, false);
  assert.ok(result.filesAnalyzed[0].categories.includes('authz'));
  assert.ok(result.filesAnalyzed[0].findings.find(item => /authorization evidence/u.test(item)));
});

test('security analyzer categorizes hardcoded token and secret evidence', async () => {
  const repoDir = await setupRepo();
  writeFile(
    repoDir,
    'src/auth/TokenIssuer.js',
    "export function issue() { return { token: 'secret-token-123', refreshToken: 'refresh-secret-456' }; }\n"
  );

  const result = new OhderSecurityBoundaryAnalyzerEngine(repoDir).analyze({
    touchedFiles: ['src/auth/TokenIssuer.js'],
  });

  assert.equal(result.risk, 'high');
  assert.ok(result.filesAnalyzed[0].categories.includes('secret'));
  assert.ok(result.filesAnalyzed[0].findings.find(item => /hardcoded credential/u.test(item)));
});

test('security analyzer lowers risk when matching authorization contract test is touched', async () => {
  const repoDir = await setupRepo();
  writeFile(
    repoDir,
    'src/security/RoleScopePolicy.js',
    "export function canManageBilling(user) { return user.role === 'admin' && user.scope.includes('billing:write'); }\n"
  );
  writeFile(
    repoDir,
    'tests/RoleScopePolicy.authz.test.js',
    "import { canManageBilling } from '../src/security/RoleScopePolicy.js';\nassert.equal(canManageBilling({ role: 'admin', scope: ['billing:write'] }), true);\n"
  );

  const result = new OhderSecurityBoundaryAnalyzerEngine(repoDir).analyze({
    touchedFiles: [
      'src/security/RoleScopePolicy.js',
      'tests/RoleScopePolicy.authz.test.js',
    ],
  });

  assert.equal(result.risk, 'low');
  assert.equal(result.boundaryValid, true);
  assert.deepEqual(result.findings, []);
});

test('security analyzer ignores keyword detector literals inside analyzer code', async () => {
  const repoDir = await setupRepo();
  writeFile(
    repoDir,
    'src/core/SecuritySignalAnalyzer.js',
    `export class SecuritySignalAnalyzer {
  signals(source = '') {
    return /\\b(?:skipAuth|disableAuth|bypassAuth|allowAnonymous|permitAll|noAuth)\\b/iu.test(source)
      || /\\b(?:role|permission|scope|rbac|acl|authorize|authenticate)\\b/iu.test(source)
      || /\\b(?:secret|password|credential|privateKey|apiKey|accessToken|refreshToken|jwt|token)\\b/iu.test(source);
  }
}
`
  );
  writeFile(
    repoDir,
    'tests/SecuritySignalAnalyzer.contract.test.js',
    "import { SecuritySignalAnalyzer } from '../src/core/SecuritySignalAnalyzer.js';\nassert.equal(new SecuritySignalAnalyzer().signals('skipAuth'), true);\n"
  );

  const result = new OhderSecurityBoundaryAnalyzerEngine(repoDir).analyze({
    touchedFiles: [
      'src/core/SecuritySignalAnalyzer.js',
      'tests/SecuritySignalAnalyzer.contract.test.js',
    ],
  });

  assert.equal(result.risk, 'low');
  assert.equal(result.boundaryValid, true);
  assert.deepEqual(result.findings, []);
});
