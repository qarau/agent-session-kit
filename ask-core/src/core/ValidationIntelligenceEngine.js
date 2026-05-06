import { randomUUID } from 'node:crypto';
import { spawn } from 'node:child_process';
import { AcceptanceCriteriaEvaluator } from './AcceptanceCriteriaEvaluator.js';
import { DiffRiskEvaluator } from './DiffRiskEvaluator.js';
import { TestResultParser } from './TestResultParser.js';

function normalize(value) {
  return String(value ?? '').trim();
}

function nowIso() {
  return new Date().toISOString();
}

function runCommand(command, cwd) {
  return new Promise(resolve => {
    const child = spawn(command, {
      cwd,
      shell: true,
      stdio: 'inherit',
      env: process.env,
    });
    child.on('close', code => {
      resolve({
        exitCode: Number.isFinite(code) ? Number(code) : 1,
        failureReason: Number(code) === 0 ? '' : 'non-zero-exit',
      });
    });
    child.on('error', error => {
      resolve({
        exitCode: 1,
        failureReason: normalize(error?.message || 'spawn-error'),
      });
    });
  });
}

export class ValidationIntelligenceEngine {
  constructor(cwd) {
    this.cwd = cwd;
    this.criteriaEvaluator = new AcceptanceCriteriaEvaluator();
    this.diffRiskEvaluator = new DiffRiskEvaluator();
    this.testResultParser = new TestResultParser();
  }

  async validate({ slice, execution, policy = {} }) {
    const testsRun = [];
    const testResults = [];
    const commands = Array.isArray(slice?.allowedCommands) ? slice.allowedCommands : [];
    for (const command of commands) {
      const normalized = normalize(command);
      if (!normalized) {
        continue;
      }
      testsRun.push(normalized);
      const result = await runCommand(normalized, this.cwd);
      testResults.push(this.testResultParser.summarize(normalized, result));
    }

    const requireAcceptanceCriteria = policy?.validation?.require_acceptance_criteria !== false;
    const requireTestEvidence = policy?.validation?.require_test_evidence !== false;
    const allowInconclusivePass = policy?.validation?.allow_inconclusive_pass === true;
    const criteria = Array.isArray(slice?.acceptanceCriteria) ? slice.acceptanceCriteria : [];
    const criteriaResults = this.criteriaEvaluator.evaluate(criteria, {
      executionOk: execution?.ok === true,
    });
    const failures = [];
    const warnings = [];

    if (requireAcceptanceCriteria && criteriaResults.length < 1) {
      failures.push('acceptance criteria missing');
    }
    if (execution?.ok !== true) {
      failures.push(`execution failed (${normalize(execution?.exitCode)})`);
    }
    if (requireTestEvidence && testResults.length < 1) {
      failures.push('test evidence required but no test commands were configured');
    }
    if (testResults.some(result => result.status !== 'passed')) {
      failures.push('one or more test commands failed');
    }

    if (criteriaResults.some(result => result.status !== 'passed')) {
      failures.push('acceptance criteria not satisfied');
    }

    const diffRisk = this.diffRiskEvaluator.evaluate(execution?.touchedFiles || []);
    if (diffRisk.level === 'high') {
      warnings.push('high diff risk for this slice');
    }

    let status = 'passed';
    if (failures.length > 0) {
      status = 'failed';
    } else if (!allowInconclusivePass && criteriaResults.length < 1) {
      status = 'inconclusive';
    } else if (warnings.length > 0) {
      status = 'warning';
    }

    const confidence = status === 'passed'
      ? 0.91
      : status === 'warning'
        ? 0.72
        : status === 'inconclusive'
          ? 0.5
          : 0.18;

    return {
      id: `validation_${randomUUID()}`,
      sliceId: normalize(slice?.id),
      status,
      testsRun,
      acceptanceCriteria: criteriaResults,
      warnings,
      failures,
      confidence,
      diffRisk,
      createdAt: nowIso(),
    };
  }
}
