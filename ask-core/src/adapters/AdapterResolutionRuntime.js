import fs from 'node:fs';
import path from 'node:path';
import {
  createNodeLanguageAdapter,
  detectNodeProject,
} from './language/node/index.js';

const SUPPORTED_ADAPTERS = ['node'];

function unsupportedAdapter(adapterId, source = 'explicit') {
  return {
    ok: false,
    code: 'adapter-not-supported',
    message: `adapter is not supported: ${adapterId}`,
    adapterId,
    languageId: '',
    profileId: '',
    source,
    reason: 'adapter id is outside the supported adapter registry',
    supportedAdapters: SUPPORTED_ADAPTERS,
    capabilities: [],
    detection: null,
    evidence: [],
  };
}

function resolveNodeAdapter({ profileId = 'node', source, reason, detection = null, evidence = [] }) {
  const adapter = createNodeLanguageAdapter();
  return {
    ok: true,
    adapterId: adapter.adapterId,
    languageId: adapter.languageId,
    profileId,
    source,
    reason,
    capabilities: adapter.capabilities,
    detection,
    evidence,
  };
}

function readProjectProfile(cwd) {
  const relativePath = '.ask/project-profile.json';
  const profilePath = path.join(cwd, relativePath);
  if (!fs.existsSync(profilePath)) {
    return null;
  }

  const profile = JSON.parse(fs.readFileSync(profilePath, 'utf8'));
  return {
    profile,
    evidence: [relativePath],
  };
}

export function resolveActiveAdapter({ cwd = process.cwd(), explicitAdapterId = '' } = {}) {
  if (explicitAdapterId) {
    if (!SUPPORTED_ADAPTERS.includes(explicitAdapterId)) {
      return unsupportedAdapter(explicitAdapterId, 'explicit');
    }
    return resolveNodeAdapter({
      profileId: 'node',
      source: 'explicit',
      reason: 'explicit --adapter option selected the active adapter',
      evidence: ['--adapter node'],
    });
  }

  const profileResult = readProjectProfile(cwd);
  if (profileResult) {
    const { profile, evidence } = profileResult;
    if (!SUPPORTED_ADAPTERS.includes(profile.adapterId)) {
      return unsupportedAdapter(profile.adapterId, 'profile');
    }
    return resolveNodeAdapter({
      profileId: profile.profileId || profile.adapterId,
      source: 'profile',
      reason: '.ask/project-profile.json selected the active adapter',
      evidence,
    });
  }

  const detection = detectNodeProject(cwd);
  if (detection.ok === false) {
    return {
      ...detection,
      source: 'detection',
      capabilities: [],
      detection,
      supportedAdapters: SUPPORTED_ADAPTERS,
    };
  }

  if (detection.adapterId !== 'node') {
    return {
      ok: false,
      code: 'adapter-resolution-unknown-project',
      message: 'project type is unknown and no adapter could be resolved',
      adapterId: '',
      languageId: '',
      profileId: '',
      source: 'detection',
      reason: 'project detection did not identify a supported adapter',
      capabilities: [],
      detection,
      evidence: detection.evidence || [],
      supportedAdapters: SUPPORTED_ADAPTERS,
    };
  }

  return resolveNodeAdapter({
    profileId: detection.profileId,
    source: 'detection',
    reason: 'project detection selected the active adapter',
    detection,
    evidence: detection.evidence || [],
  });
}
