import fs from 'node:fs';
import path from 'node:path';

const LOCKFILE_PRECEDENCE = [
  ['pnpm-lock.yaml', 'pnpm'],
  ['package-lock.json', 'npm'],
  ['yarn.lock', 'yarn'],
  ['bun.lockb', 'bun'],
];

const NODE_CAPABILITIES = [
  'install',
  'format',
  'lint',
  'typecheck',
  'test',
  'build',
  'detect',
  'mapChangedFilesToTests',
  'inspectArchitecture',
];

const NODE_COMMANDS = {
  install: { command: 'npm', args: ['install'] },
  typecheck: { command: 'npm', args: ['run', 'typecheck'] },
  test: { command: 'npm', args: ['test'] },
  build: { command: 'npm', args: ['run', 'build'] },
};

function normalizePath(value) {
  return String(value ?? '').replaceAll('\\', '/').trim();
}

function exists(cwd, relativePath) {
  return fs.existsSync(path.join(cwd, relativePath));
}

function readPackageJson(cwd) {
  const packagePath = path.join(cwd, 'package.json');
  if (!fs.existsSync(packagePath)) {
    return { exists: false, ok: true, packageJson: null };
  }
  try {
    return {
      exists: true,
      ok: true,
      packageJson: JSON.parse(fs.readFileSync(packagePath, 'utf8')),
    };
  } catch (error) {
    return {
      exists: true,
      ok: false,
      code: 'project-detect-invalid-package-json',
      message: `invalid package.json: ${error.message}`,
    };
  }
}

function packageHasTypeScriptSignal(packageJson = {}) {
  const dependencySections = [
    packageJson.dependencies,
    packageJson.devDependencies,
    packageJson.peerDependencies,
    packageJson.optionalDependencies,
  ];
  return dependencySections.some(section => section && typeof section === 'object' && Object.hasOwn(section, 'typescript'));
}

function unknownDetection(packageManager = 'unknown', warnings = []) {
  return {
    ok: true,
    projectType: 'unknown',
    languageId: '',
    adapterId: '',
    profileId: '',
    packageManager,
    confidence: 'low',
    evidence: [],
    warnings,
  };
}

export function detectPackageManager(cwd = process.cwd()) {
  const found = LOCKFILE_PRECEDENCE
    .filter(([lockfile]) => exists(cwd, lockfile))
    .map(([lockfile, packageManager]) => ({ lockfile, packageManager }));
  const warnings = [];
  if (found.length > 1) {
    warnings.push(`multiple package manager lockfiles detected: ${found.map(item => item.lockfile).join(', ')}`);
  }
  return {
    packageManager: found[0]?.packageManager || 'unknown',
    evidence: found.map(item => item.lockfile),
    warnings,
  };
}

export function detectNodeProject(cwd = process.cwd()) {
  const packageManager = detectPackageManager(cwd);
  const packageResult = readPackageJson(cwd);
  if (!packageResult.ok) {
    return {
      ok: false,
      code: packageResult.code,
      message: packageResult.message,
      projectType: 'unknown',
      languageId: '',
      adapterId: '',
      profileId: '',
      packageManager: packageManager.packageManager,
      confidence: 'low',
      evidence: packageManager.evidence,
      warnings: packageManager.warnings,
    };
  }

  const evidence = [...packageManager.evidence];
  if (packageResult.exists) {
    evidence.push('package.json');
  }
  const hasTsconfig = exists(cwd, 'tsconfig.json');
  if (hasTsconfig) {
    evidence.push('tsconfig.json');
  }
  const hasTypeScriptSignal = hasTsconfig || packageHasTypeScriptSignal(packageResult.packageJson || {});
  if (!packageResult.exists && !hasTsconfig) {
    return unknownDetection(packageManager.packageManager, packageManager.warnings);
  }

  const projectType = hasTypeScriptSignal ? 'node-typescript' : 'node-javascript';
  return {
    ok: true,
    projectType,
    languageId: 'node',
    adapterId: 'node',
    profileId: projectType,
    packageManager: packageManager.packageManager,
    confidence: hasTypeScriptSignal ? 'high' : 'medium',
    evidence,
    warnings: packageManager.warnings,
  };
}

function result(capability, status, extra = {}) {
  return {
    capability,
    status,
    ...extra,
  };
}

export function createNodeLanguageAdapter() {
  return {
    adapterId: 'node',
    languageId: 'node',
    displayName: 'Node.js / JavaScript / TypeScript',
    fileGlobs: ['package.json', 'tsconfig.json', '**/*.js', '**/*.mjs', '**/*.ts'],
    capabilities: [...NODE_CAPABILITIES],
    commands: { ...NODE_COMMANDS },
    detect(context = {}) {
      const cwd = context.cwd || process.cwd();
      const detected = detectNodeProject(cwd);
      return {
        capability: 'detect',
        status: detected.ok === false ? 'failed' : 'passed',
        detected: detected.projectType !== 'unknown',
        confidence: detected.confidence,
        evidence: detected.evidence,
        metadata: detected,
      };
    },
    install() {
      return result('install', 'unavailable', { reason: 'Node adapter command descriptors are not executed by this wrapper yet.' });
    },
    format() {
      return result('format', 'unavailable', { reason: 'No format command is wired by this wrapper yet.' });
    },
    lint() {
      return result('lint', 'unavailable', { reason: 'No lint command is wired by this wrapper yet.' });
    },
    typecheck() {
      return result('typecheck', 'skipped', { ...NODE_COMMANDS.typecheck });
    },
    test() {
      return result('test', 'skipped', { ...NODE_COMMANDS.test });
    },
    build() {
      return result('build', 'skipped', { ...NODE_COMMANDS.build });
    },
    mapChangedFilesToTests(context = {}) {
      return (Array.isArray(context.changedFiles) ? context.changedFiles : []).map(filePath => ({
        changedFile: normalizePath(filePath),
        testFiles: [],
        reason: 'Node adapter wrapper does not infer test ownership yet.',
      }));
    },
    inspectArchitecture() {
      return result('inspectArchitecture', 'unavailable', {
        reason: 'Architecture inspection remains owned by OHDER runtimes.',
        facts: {},
        findings: [],
        recommendations: [],
      });
    },
  };
}
