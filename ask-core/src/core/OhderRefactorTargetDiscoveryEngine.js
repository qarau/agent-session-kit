function normalize(value) {
  return String(value ?? '').trim();
}

function normalizeLower(value) {
  return normalize(value).toLowerCase();
}

function toNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function normalizePath(value) {
  return normalize(value).replace(/\\/gu, '/');
}

function unique(values = []) {
  return Array.from(new Set(values.map(normalize).filter(Boolean)));
}

function isPressureEntry(entry = {}) {
  const refactorPressure = normalizeLower(entry.refactorPressure);
  const entropyTrend = normalizeLower(entry.entropyTrend || entry.trend);
  return refactorPressure === 'high'
    || refactorPressure === 'medium'
    || entropyTrend === 'regressing'
    || toNumber(entry.entropyDelta, 0) > 0
    || toNumber(entry.couplingDelta, 0) > 0;
}

function pressureWeight(entry = {}) {
  const refactorPressure = normalizeLower(entry.refactorPressure);
  const entropyTrend = normalizeLower(entry.entropyTrend || entry.trend);
  let score = 1;
  if (refactorPressure === 'high') {
    score += 4;
  } else if (refactorPressure === 'medium') {
    score += 2;
  }
  if (entropyTrend === 'regressing') {
    score += 2;
  }
  score += Math.max(0, toNumber(entry.entropyDelta, 0));
  score += Math.max(0, toNumber(entry.couplingDelta, 0));
  return score;
}

function taskIdForHistory(entry = {}) {
  return normalize(entry.taskId || entry.sliceId);
}

function completedTargetIds(tasks = {}) {
  return new Set(Object.values(tasks)
    .filter(task => normalizeLower(task?.status) === 'completed')
    .filter(task => normalizeLower(task?.origin?.type) === 'ohder-refactor-governance')
    .map(task => normalize(task?.origin?.targetId || task?.refactorGovernance?.targetId))
    .filter(Boolean));
}

function suppression(reason, baseSignals = []) {
  return {
    target: null,
    candidates: [],
    suppression: {
      reason,
      baseSignals: unique(baseSignals).sort(),
    },
  };
}

function targetForCandidate(candidate) {
  return {
    targetId: candidate.targetId,
    type: 'file',
    path: candidate.path,
    title: `Refactor hotspot: ${candidate.path}`,
    reason: `Recent OHDER pressure repeatedly touched ${candidate.path}.`,
    evidence: {
      score: candidate.score,
      changeCount: candidate.changeCount,
      pressureEntries: candidate.pressureEntries,
      relatedTasks: [...candidate.relatedTasks],
    },
  };
}

export class OhderRefactorTargetDiscoveryEngine {
  discover({ metricsHistory = [], changeSets = [], tasks = {}, policy = {} } = {}) {
    const windowSize = Math.max(1, Math.floor(toNumber(policy?.ohder_refactor?.target_history_window, 12)));
    const historyWindow = Array.isArray(metricsHistory) ? metricsHistory.slice(-windowSize) : [];
    const pressureEntries = historyWindow.filter(isPressureEntry);
    if (pressureEntries.length < 1) {
      return suppression('no-new-refactor-target', ['pressure.none']);
    }

    const pressureByTask = new Map();
    for (const entry of pressureEntries) {
      const taskId = taskIdForHistory(entry);
      if (!taskId) {
        continue;
      }
      pressureByTask.set(taskId, entry);
    }

    const skippedTargets = completedTargetIds(tasks);
    const candidatesByTargetId = new Map();
    const normalizedChangeSets = Array.isArray(changeSets) ? changeSets : [];
    for (const changeSet of normalizedChangeSets) {
      const taskId = normalize(changeSet?.taskId || changeSet?.sliceId);
      const pressureEntry = pressureByTask.get(taskId);
      if (!pressureEntry) {
        continue;
      }
      const files = unique(Array.isArray(changeSet?.files) ? changeSet.files.map(normalizePath) : []);
      for (const filePath of files) {
        if (!filePath || filePath.startsWith('.ask/')) {
          continue;
        }
        const targetId = `file:${filePath}`;
        if (skippedTargets.has(targetId)) {
          continue;
        }
        const current = candidatesByTargetId.get(targetId) ?? {
          targetId,
          type: 'file',
          path: filePath,
          score: 0,
          changeCount: 0,
          pressureEntries: 0,
          relatedTasks: [],
        };
        current.score += pressureWeight(pressureEntry);
        current.changeCount += 1;
        current.pressureEntries += 1;
        current.relatedTasks = unique([...current.relatedTasks, taskId]).sort();
        candidatesByTargetId.set(targetId, current);
      }
    }

    const candidates = Array.from(candidatesByTargetId.values())
      .sort((left, right) => {
        if (right.score !== left.score) {
          return right.score - left.score;
        }
        if (right.changeCount !== left.changeCount) {
          return right.changeCount - left.changeCount;
        }
        return left.path.localeCompare(right.path);
      });

    if (candidates.length < 1) {
      return suppression('no-new-refactor-target', pressureEntries.map(entry => `task:${taskIdForHistory(entry)}`));
    }

    return {
      target: targetForCandidate(candidates[0]),
      candidates,
      suppression: null,
    };
  }
}
