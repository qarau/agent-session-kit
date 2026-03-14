import { AskPaths } from '../fs/AskPaths.js';
import { FileStore } from '../fs/FileStore.js';
import { defaultPolicyYaml } from '../policy/defaultPolicy.js';

function coerceYamlValue(value) {
  if (value === 'true') {
    return true;
  }
  if (value === 'false') {
    return false;
  }
  if (/^-?\d+(\.\d+)?$/u.test(value)) {
    return Number(value);
  }
  return value;
}

function parseStateList(value) {
  return String(value)
    .split(',')
    .map(entry => entry.trim().toLowerCase())
    .filter(Boolean);
}

function isCsvListSectionKey(section, key) {
  if (section === 'session') {
    return key === 'allowed_preflight_states' || key === 'allowed_can_commit_states';
  }

  if (section === 'workflow_provider') {
    return key === 'superpowers_approved_versions'
      || key === 'superpowers_allowed_skills'
      || key === 'superpowers_incompatible_versions';
  }

  return false;
}

function parseSimpleYaml(text) {
  const result = {};
  let section = '';
  const lines = text.split(/\r?\n/);
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
      if (isCsvListSectionKey(section, key)) {
        result[section][key] = parseStateList(value);
      } else {
        result[section][key] = coerceYamlValue(value);
      }
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
