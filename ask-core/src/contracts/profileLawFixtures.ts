import type { AskOhderLawPack } from './lawPacks.js';
import type { AskProjectProfile } from './profiles.js';

export const askNodeTypeScriptProjectProfileFixture = {
  profileId: 'node-typescript',
  name: 'Node.js TypeScript project',
  languageProfiles: [
    {
      id: 'node-typescript',
      languageId: 'node',
      displayName: 'Node.js / TypeScript',
      adapterId: 'node',
      fileGlobs: ['package.json', 'tsconfig.json', '**/*.ts', '**/*.js', '**/*.mjs'],
      capabilities: ['install', 'typecheck', 'test', 'build', 'detect', 'mapChangedFilesToTests', 'inspectArchitecture'],
      defaultPackageManager: 'npm',
    },
  ],
  frameworkProfiles: [
    {
      id: 'node-test',
      languageProfileId: 'node-typescript',
      displayName: 'Node test runner',
      frameworkId: 'node-test',
      fileGlobs: ['ask-core/src/**/*.ts', 'ask-core/src/**/*.js'],
      testGlobs: ['ask-core/tests/**/*.mjs'],
    },
  ],
  gates: [
    {
      id: 'node-typecheck-build-test',
      name: 'Node Typecheck Build Test',
      appliesTo: ['node-typescript'],
      requiredCapabilities: ['typecheck', 'build', 'test'],
      lawPackIds: ['ohder-default'],
      enabled: true,
    },
  ],
  defaultLawPackIds: ['ohder-default'],
} satisfies AskProjectProfile;

export const askDefaultOhderLawPackFixture = {
  id: 'ohder-default',
  version: 1,
  name: 'Default OHDER law pack',
  scope: 'architecture',
  defaultEnabled: true,
  defaultOutcomes: {
    critical: 'block',
    high: 'retry',
    medium: 'warn',
    low: 'warn',
  },
  laws: [
    {
      id: 'ohder-projection-authority',
      name: 'ProjectionAuthority',
      lawClass: 'hard',
      enabled: true,
      severity: 'critical',
      scope: 'runtime',
      metric: 'projection_authority',
      operator: '==',
      value: 'valid',
      outcome: 'block',
      message: 'Projection authority must remain valid.',
    },
    {
      id: 'ohder-entropy-budget',
      name: 'Entropy Budget',
      lawClass: 'soft',
      enabled: true,
      severity: 'high',
      scope: 'architecture',
      metric: 'entropy_delta',
      operator: '<=',
      value: 3,
      outcome: 'retry',
      message: 'Entropy increase exceeded allowed budget.',
    },
  ],
  exemptions: [],
} satisfies AskOhderLawPack;
