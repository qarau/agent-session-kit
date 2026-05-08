import assert from 'node:assert/strict';
import test from 'node:test';
import { OhderAutonomousEntropyController } from '../src/core/OhderAutonomousEntropyController.js';
import { resolveRefactorCommand } from '../src/core/OhderRuntimeSummaries.js';

const highConfidenceRecommendation = {
  fingerprint: 'abc123',
  confidence: 'high',
  targetPortfolio: [
    {
      rank: 1,
      selected: true,
      targetId: 'file:ask-core/src/core/Hotspot.js',
      confidence: 'high',
      blastRadius: 'low',
    },
  ],
};

test('autonomous entropy task creation is disabled by default', () => {
  const result = new OhderAutonomousEntropyController().evaluate({
    recommendation: highConfidenceRecommendation,
    policy: {},
    dirtyWorktree: false,
    autoCreatedCount: 0,
  });

  assert.equal(result.createTask, false);
  assert.equal(result.decision, 'auto-disabled');
  assert.equal(result.patchApplicationAllowed, false);
});

test('policy-enabled high-confidence low-blast-radius recommendation can create one bounded task', () => {
  const result = new OhderAutonomousEntropyController().evaluate({
    recommendation: highConfidenceRecommendation,
    policy: {
      ohder_autonomy: {
        auto_create_refactor_tasks: true,
        max_auto_created_tasks_per_session: 1,
        require_clean_worktree: true,
        min_confidence: 'high',
        max_blast_radius: 'medium',
      },
    },
    dirtyWorktree: false,
    autoCreatedCount: 0,
  });

  assert.equal(result.createTask, true);
  assert.equal(result.decision, 'create');
  assert.equal(result.approvalRequired, false);
  assert.equal(result.patchApplicationAllowed, false);
});

test('medium or high blast radius requires approval instead of automatic creation', () => {
  const result = new OhderAutonomousEntropyController().evaluate({
    recommendation: {
      ...highConfidenceRecommendation,
      targetPortfolio: [
        {
          ...highConfidenceRecommendation.targetPortfolio[0],
          blastRadius: 'high',
        },
      ],
    },
    policy: {
      ohder_autonomy: {
        auto_create_refactor_tasks: true,
        max_auto_created_tasks_per_session: 1,
        require_clean_worktree: true,
        min_confidence: 'high',
        max_blast_radius: 'medium',
      },
    },
    dirtyWorktree: false,
    autoCreatedCount: 0,
  });

  assert.equal(result.createTask, false);
  assert.equal(result.decision, 'approval-required');
  assert.equal(result.approvalRequired, true);
});

test('ask next only recommends auto creation when OHDER autonomy policy allows it', () => {
  assert.equal(resolveRefactorCommand(highConfidenceRecommendation, {}), 'ask refactor preview');
  assert.equal(resolveRefactorCommand(highConfidenceRecommendation, {
    ohder_autonomy: {
      auto_create_refactor_tasks: true,
    },
  }), 'ask refactor create --auto');
});
