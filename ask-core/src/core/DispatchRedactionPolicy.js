import { createHash } from 'node:crypto';

function normalize(value) {
  return String(value ?? '').trim();
}

function list(value) {
  if (Array.isArray(value)) {
    return value.map(entry => normalize(entry)).filter(Boolean);
  }
  return [];
}

function hashText(value) {
  return createHash('sha256').update(String(value ?? ''), 'utf8').digest('hex');
}

const SENSITIVE_HINTS = Object.freeze([
  'token',
  'secret',
  'password',
  'passwd',
  'apikey',
  'api-key',
  'authorization',
  'auth',
  'cookie',
  'bearer',
  'session',
  'private',
  'credential',
  'prompt',
]);

function hasSensitiveHint(text) {
  const lower = normalize(text).toLowerCase();
  if (!lower) {
    return false;
  }
  return SENSITIVE_HINTS.some(hint => lower.includes(hint));
}

function normalizeLevel(level = '') {
  const normalized = normalize(level).toLowerCase();
  if (normalized === 'none' || normalized === 'standard' || normalized === 'strict') {
    return normalized;
  }
  return 'standard';
}

function redactArgValue(arg, level) {
  const value = String(arg ?? '');
  if (level === 'none') {
    return value;
  }
  if (!hasSensitiveHint(value)) {
    return value;
  }
  if (value.includes('=')) {
    const key = value.slice(0, value.indexOf('='));
    return `${key}=[REDACTED]`;
  }
  return '[REDACTED]';
}

function redactText(value, level) {
  const text = String(value ?? '');
  if (level === 'none' || !text) {
    return text;
  }
  if (level === 'strict') {
    const digest = hashText(text).slice(0, 12);
    return `[REDACTED:${digest}]`;
  }
  if (hasSensitiveHint(text)) {
    return '[REDACTED]';
  }
  return text;
}

export class DispatchRedactionPolicy {
  constructor(level = 'standard') {
    this.level = normalizeLevel(level);
  }

  metadata(value) {
    const text = String(value ?? '');
    return {
      redacted: redactText(text, this.level),
      hash: text ? hashText(text) : '',
      length: text.length,
    };
  }

  redactArgs(args = []) {
    return list(args).map(arg => redactArgValue(arg, this.level));
  }

  redactCommand(command = '') {
    return redactText(command, this.level);
  }

  redactPath(cwd = '') {
    return redactText(cwd, this.level);
  }

  redactText(value = '') {
    return redactText(value, this.level);
  }
}

export function resolveRedactionLevel(policyDecision = {}, options = {}) {
  const fromOption = normalize(options.redactionLevel).toLowerCase();
  if (fromOption === 'none' || fromOption === 'standard' || fromOption === 'strict') {
    return fromOption;
  }
  const fromPolicy = normalize(policyDecision?.redactionLevel).toLowerCase();
  if (fromPolicy === 'none' || fromPolicy === 'standard' || fromPolicy === 'strict') {
    return fromPolicy;
  }
  return 'standard';
}
