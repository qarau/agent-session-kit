import { AskPaths } from '../fs/AskPaths.js';
import { FileStore } from '../fs/FileStore.js';
import { defaultPolicyYaml } from '../policy/defaultPolicy.js';

const RUNTIME_POLICY_SCHEMA_VERSION = 2;
const POLICY_SCHEMA_META_KEY = '__schema';

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

function toFiniteNumber(value, fallback = 0) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
}

function normalizeSchemaVersion(policy = {}) {
  if (Number.isFinite(Number(policy.schema_version))) {
    return toFiniteNumber(policy.schema_version, 1);
  }
  if (Number.isFinite(Number(policy.version))) {
    return toFiniteNumber(policy.version, 1);
  }
  return 1;
}

function asObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function normalizeOhderMode(value) {
  const normalized = String(value ?? '').trim().toLowerCase();
  return ['fast', 'strict', 'refactor'].includes(normalized) ? normalized : 'fast';
}

function toPolicyBoolean(value, fallback = false) {
  if (typeof value === 'boolean') {
    return value;
  }
  const normalized = String(value ?? '').trim().toLowerCase();
  if (['1', 'true', 'yes', 'on'].includes(normalized)) {
    return true;
  }
  if (['0', 'false', 'no', 'off'].includes(normalized)) {
    return false;
  }
  return fallback;
}

export function normalizeOhderProfile(policy = {}) {
  const mode = normalizeOhderMode(policy?.ohder?.mode);
  const requireReplayability = mode === 'strict'
    ? true
    : policy?.architect?.require_replayability !== false;
  return {
    mode,
    warningFirst: mode === 'fast',
    requireSemanticFactEvidence: mode === 'strict',
    requireReplayability,
    blockNonRefactorSlices: mode === 'refactor'
      && toPolicyBoolean(policy?.ohder?.allow_non_refactor_close, false) !== true,
    requireRefactorOutcome: mode === 'refactor',
  };
}

function mergePolicy(defaults, overrides) {
  const result = { ...defaults };
  for (const [key, value] of Object.entries(overrides ?? {})) {
    const defaultValue = defaults?.[key];
    if (
      defaultValue
      && typeof defaultValue === 'object'
      && !Array.isArray(defaultValue)
      && value
      && typeof value === 'object'
      && !Array.isArray(value)
    ) {
      result[key] = mergePolicy(defaultValue, value);
      continue;
    }
    result[key] = value;
  }
  return result;
}

function applyMigrationV1ToV2(policy = {}) {
  const migrated = { ...policy };
  const migrations = [];
  const architect = { ...asObject(migrated.architect) };
  const flow = { ...asObject(migrated.flow) };
  const autonomy = { ...asObject(migrated.autonomy) };
  const retry = { ...asObject(migrated.retry) };

  if (Number.isFinite(Number(architect.max_entropy)) && architect.max_entropy_delta === undefined) {
    architect.max_entropy_delta = toFiniteNumber(architect.max_entropy, 0);
    delete architect.max_entropy;
    migrations.push('architect.max_entropy -> architect.max_entropy_delta');
  }

  if (Number.isFinite(Number(architect.max_coupling)) && architect.max_coupling_delta === undefined) {
    architect.max_coupling_delta = toFiniteNumber(architect.max_coupling, 0);
    delete architect.max_coupling;
    migrations.push('architect.max_coupling -> architect.max_coupling_delta');
  }

  if (flow.min_replay_confidence !== undefined && flow.min_behavior_replay_confidence === undefined) {
    flow.min_behavior_replay_confidence = toFiniteNumber(flow.min_replay_confidence, 0.65);
    delete flow.min_replay_confidence;
    migrations.push('flow.min_replay_confidence -> flow.min_behavior_replay_confidence');
  }

  if (flow.min_protected_confidence !== undefined && flow.min_protected_replay_confidence === undefined) {
    flow.min_protected_replay_confidence = toFiniteNumber(flow.min_protected_confidence, 0.75);
    delete flow.min_protected_confidence;
    migrations.push('flow.min_protected_confidence -> flow.min_protected_replay_confidence');
  }

  if (flow.min_hard_confidence !== undefined && flow.min_hard_flow_replay_confidence === undefined) {
    flow.min_hard_flow_replay_confidence = toFiniteNumber(flow.min_hard_confidence, 0.85);
    delete flow.min_hard_confidence;
    migrations.push('flow.min_hard_confidence -> flow.min_hard_flow_replay_confidence');
  }

  if (Number.isFinite(Number(autonomy.max_slices)) && autonomy.max_slices_per_run === undefined) {
    autonomy.max_slices_per_run = toFiniteNumber(autonomy.max_slices, 1);
    delete autonomy.max_slices;
    migrations.push('autonomy.max_slices -> autonomy.max_slices_per_run');
  }

  if (Number.isFinite(Number(retry.max_attempts)) && retry.max_attempts_per_slice === undefined) {
    retry.max_attempts_per_slice = toFiniteNumber(retry.max_attempts, 2);
    delete retry.max_attempts;
    migrations.push('retry.max_attempts -> retry.max_attempts_per_slice');
  }

  if (Number.isFinite(Number(retry.max_same_failure)) && retry.max_same_failure_repeats === undefined) {
    retry.max_same_failure_repeats = toFiniteNumber(retry.max_same_failure, 2);
    delete retry.max_same_failure;
    migrations.push('retry.max_same_failure -> retry.max_same_failure_repeats');
  }

  if (Number.isFinite(Number(retry.max_total_failures)) && retry.max_total_failures_per_session === undefined) {
    retry.max_total_failures_per_session = toFiniteNumber(retry.max_total_failures, 5);
    delete retry.max_total_failures;
    migrations.push('retry.max_total_failures -> retry.max_total_failures_per_session');
  }

  if (migrations.length > 0) {
    migrated.architect = architect;
    migrated.flow = flow;
    migrated.autonomy = autonomy;
    migrated.retry = retry;
  }

  migrated.schema_version = RUNTIME_POLICY_SCHEMA_VERSION;
  migrated.version = RUNTIME_POLICY_SCHEMA_VERSION;
  return {
    migrated,
    migrations,
  };
}

function migratePolicy(parsed = {}, defaults = {}) {
  const fromVersion = normalizeSchemaVersion(parsed);
  let working = { ...parsed };
  const migrations = [];
  let nextVersion = fromVersion;

  if (fromVersion < 2) {
    const migrated = applyMigrationV1ToV2(working);
    working = migrated.migrated;
    migrations.push(...migrated.migrations);
    nextVersion = 2;
  }

  const merged = mergePolicy(defaults, working);
  merged.schema_version = RUNTIME_POLICY_SCHEMA_VERSION;
  merged.version = RUNTIME_POLICY_SCHEMA_VERSION;

  const governanceContract = asObject(merged.governance_contract);
  merged.governance_contract = {
    ...governanceContract,
    policy_schema_version: RUNTIME_POLICY_SCHEMA_VERSION,
  };
  merged.ohder = {
    ...asObject(merged.ohder),
    mode: normalizeOhderMode(merged.ohder?.mode),
  };
  merged.ohder_profile = normalizeOhderProfile(merged);

  return {
    policy: merged,
    meta: {
      fromVersion,
      toVersion: RUNTIME_POLICY_SCHEMA_VERSION,
      migrated: fromVersion !== RUNTIME_POLICY_SCHEMA_VERSION || migrations.length > 0,
      appliedMigrations: migrations,
      sourceVersion: nextVersion,
    },
  };
}

function yamlValue(value) {
  if (typeof value === 'boolean' || typeof value === 'number') {
    return String(value);
  }
  return String(value ?? '');
}

function stringifySimpleYaml(policy = {}) {
  const lines = [];
  const topLevelKeys = Object.keys(policy);
  for (const key of topLevelKeys) {
    const value = policy[key];
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      lines.push(`${key}:`);
      for (const childKey of Object.keys(value)) {
        const childValue = value[childKey];
        if (Array.isArray(childValue)) {
          lines.push(`  ${childKey}: ${childValue.map(entry => String(entry)).join(',')}`);
        } else {
          lines.push(`  ${childKey}: ${yamlValue(childValue)}`);
        }
      }
      lines.push('');
      continue;
    }
    lines.push(`${key}: ${yamlValue(value)}`);
  }

  return `${lines.join('\n').replace(/\n{3,}/gu, '\n\n').trimEnd()}\n`;
}

export class PolicyEngine {
  constructor(cwd) {
    this.paths = new AskPaths(cwd);
    this.store = new FileStore();
  }

  async load() {
    const defaults = parseSimpleYaml(defaultPolicyYaml);
    const raw = await this.store.readText(this.paths.runtimePolicy(), defaultPolicyYaml);
    const parsed = parseSimpleYaml(raw);
    const migrated = migratePolicy(parsed, defaults);
    return {
      ...migrated.policy,
      [POLICY_SCHEMA_META_KEY]: migrated.meta,
    };
  }

  async inspect() {
    const policy = await this.load();
    return policy[POLICY_SCHEMA_META_KEY] ?? {
      fromVersion: RUNTIME_POLICY_SCHEMA_VERSION,
      toVersion: RUNTIME_POLICY_SCHEMA_VERSION,
      migrated: false,
      appliedMigrations: [],
    };
  }

  async migrateInPlace() {
    const policy = await this.load();
    const serializable = { ...policy };
    delete serializable[POLICY_SCHEMA_META_KEY];
    const yaml = stringifySimpleYaml(serializable);
    await this.store.writeText(this.paths.runtimePolicy(), yaml);
    return {
      ok: true,
      path: this.paths.runtimePolicy(),
      schema: policy[POLICY_SCHEMA_META_KEY] ?? {},
    };
  }
}
