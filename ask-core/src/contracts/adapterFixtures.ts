import type {
  AskLanguageAdapter,
  AskLanguageAdapterContext,
  AskLanguageAdapterInspectionResult,
  AskLanguageAdapterResult,
} from './adapter.js';

function skipped(capability: 'install' | 'format' | 'lint'): AskLanguageAdapterResult {
  return {
    capability,
    status: 'skipped',
    reason: 'Capability is declared but not executed by this contract fixture.',
  };
}

function unavailable(capability: 'inspectArchitecture'): AskLanguageAdapterInspectionResult {
  return {
    capability,
    status: 'unavailable',
    reason: 'Architecture inspection is supplied by ASK OHDER runtimes until language adapters are implemented.',
    facts: {},
    findings: [],
    recommendations: [],
  };
}

export const askNodeLanguageAdapterContractFixture = {
  languageId: 'node',
  displayName: 'Node.js / TypeScript',
  fileGlobs: ['package.json', 'tsconfig.json', '**/*.js', '**/*.mjs', '**/*.ts'],
  capabilities: ['install', 'format', 'lint', 'typecheck', 'test', 'build', 'detect', 'mapChangedFilesToTests', 'inspectArchitecture'],
  detect(context: AskLanguageAdapterContext) {
    return {
      capability: 'detect',
      status: 'passed',
      detected: true,
      confidence: 'high',
      evidence: [context.packageManager || 'npm', 'package.json'],
    };
  },
  install() {
    return skipped('install');
  },
  format() {
    return skipped('format');
  },
  lint() {
    return skipped('lint');
  },
  typecheck() {
    return {
      capability: 'typecheck',
      status: 'passed',
      command: 'npm',
      args: ['run', 'typecheck'],
      exitCode: 0,
    };
  },
  test() {
    return {
      capability: 'test',
      status: 'passed',
      command: 'npm',
      args: ['test'],
      exitCode: 0,
    };
  },
  build() {
    return {
      capability: 'build',
      status: 'passed',
      command: 'npm',
      args: ['run', 'build'],
      exitCode: 0,
    };
  },
  mapChangedFilesToTests(context: AskLanguageAdapterContext) {
    return (context.changedFiles || []).map(changedFile => ({
      changedFile,
      testFiles: changedFile.includes('/src/') ? [changedFile.replace('/src/', '/tests/')] : [],
      reason: 'Contract fixture mirrors changed source files to test path candidates.',
    }));
  },
  inspectArchitecture() {
    return unavailable('inspectArchitecture');
  },
} satisfies AskLanguageAdapter;
