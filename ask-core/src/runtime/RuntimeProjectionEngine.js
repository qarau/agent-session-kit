import { EventLedger } from './EventLedger.js';
import { RuntimeSnapshotStore } from './RuntimeSnapshotStore.js';
import crypto from 'node:crypto';
import { SessionProjector } from './projectors/SessionProjector.js';
import { TaskBoardProjector } from './projectors/TaskBoardProjector.js';
import { VerificationProjector } from './projectors/VerificationProjector.js';
import { WorkflowProjector } from './projectors/WorkflowProjector.js';
import { FreshnessProjector } from './projectors/FreshnessProjector.js';
import { IntegrationProjector } from './projectors/IntegrationProjector.js';
import { MergeReadinessProjector } from './projectors/MergeReadinessProjector.js';
import { ClaimProjector } from './projectors/ClaimProjector.js';
import { RoutingProjector } from './projectors/RoutingProjector.js';
import { ChildSessionProjector } from './projectors/ChildSessionProjector.js';
import { AgentProjector } from './projectors/AgentProjector.js';
import { QueueClassProjector } from './projectors/QueueClassProjector.js';
import { PolicyPackProjector } from './projectors/PolicyPackProjector.js';
import { FeatureProjector } from './projectors/FeatureProjector.js';
import { ReleaseTrainProjector } from './projectors/ReleaseTrainProjector.js';
import { PromotionGateProjector } from './projectors/PromotionGateProjector.js';
import { RolloutProjector } from './projectors/RolloutProjector.js';
import { SubagentDispatchProjector } from './projectors/SubagentDispatchProjector.js';

function toNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function sortEvents(events = []) {
  return [...events].sort((left, right) => toNumber(left.seq, 0) - toNumber(right.seq, 0));
}

function stableStringify(value) {
  if (Array.isArray(value)) {
    return `[${value.map(entry => stableStringify(entry)).join(',')}]`;
  }
  if (value && typeof value === 'object') {
    const keys = Object.keys(value).sort();
    return `{${keys.map(key => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

function hashString(value) {
  return `sha256:${crypto.createHash('sha256').update(String(value), 'utf8').digest('hex')}`;
}

function buildSequenceIntegrity(events = [], projectionCursor = 0) {
  if (events.length < 1) {
    return {
      contiguous: true,
      monotonic: true,
      hasDuplicates: false,
      hasGaps: false,
      cursorIntegrity: projectionCursor === 0 ? 'valid' : 'ahead',
    };
  }

  let monotonic = true;
  let hasDuplicates = false;
  let hasGaps = false;
  const seen = new Set();
  let previous = Number.NEGATIVE_INFINITY;

  for (let index = 0; index < events.length; index += 1) {
    const seq = toNumber(events[index]?.seq, 0);
    if (seen.has(seq)) {
      hasDuplicates = true;
    }
    if (seq <= previous) {
      monotonic = false;
    }
    if (index > 0 && seq !== previous + 1) {
      hasGaps = true;
    }
    previous = seq;
    seen.add(seq);
  }

  const lastSeq = toNumber(events[events.length - 1]?.seq, 0);
  const cursorIntegrity = projectionCursor > lastSeq
    ? 'ahead'
    : (projectionCursor < lastSeq ? 'behind' : 'valid');

  return {
    contiguous: !hasGaps && monotonic,
    monotonic,
    hasDuplicates,
    hasGaps,
    cursorIntegrity,
  };
}

export class RuntimeProjectionEngine {
  constructor(cwd, overrides = {}) {
    this.ledger = overrides.ledger ?? new EventLedger(cwd);
    this.snapshots = overrides.snapshots ?? new RuntimeSnapshotStore(cwd);
    this.sessionProjector = overrides.sessionProjector ?? new SessionProjector();
    this.taskBoardProjector = overrides.taskBoardProjector ?? new TaskBoardProjector();
    this.verificationProjector = overrides.verificationProjector ?? new VerificationProjector();
    this.workflowProjector = overrides.workflowProjector ?? new WorkflowProjector();
    this.freshnessProjector = overrides.freshnessProjector ?? new FreshnessProjector();
    this.integrationProjector = overrides.integrationProjector ?? new IntegrationProjector();
    this.mergeReadinessProjector = overrides.mergeReadinessProjector ?? new MergeReadinessProjector();
    this.claimProjector = overrides.claimProjector ?? new ClaimProjector();
    this.routingProjector = overrides.routingProjector ?? new RoutingProjector();
    this.childSessionProjector = overrides.childSessionProjector ?? new ChildSessionProjector();
    this.agentProjector = overrides.agentProjector ?? new AgentProjector();
    this.queueClassProjector = overrides.queueClassProjector ?? new QueueClassProjector();
    this.policyPackProjector = overrides.policyPackProjector ?? new PolicyPackProjector();
    this.featureProjector = overrides.featureProjector ?? new FeatureProjector();
    this.releaseTrainProjector = overrides.releaseTrainProjector ?? new ReleaseTrainProjector();
    this.promotionGateProjector = overrides.promotionGateProjector ?? new PromotionGateProjector();
    this.rolloutProjector = overrides.rolloutProjector ?? new RolloutProjector();
    this.subagentDispatchProjector = overrides.subagentDispatchProjector ?? new SubagentDispatchProjector();
  }

  initialStates() {
    return {
      session: this.sessionProjector.initialState(),
      tasks: this.taskBoardProjector.initialState(),
      verification: this.verificationProjector.initialState(),
      workflow: this.workflowProjector.initialState(),
      freshness: this.freshnessProjector.initialState(),
      integration: this.integrationProjector.initialState(),
      mergeReadiness: this.mergeReadinessProjector.initialState(),
      claims: this.claimProjector.initialState(),
      routing: this.routingProjector.initialState(),
      childSessions: this.childSessionProjector.initialState(),
      agents: this.agentProjector.initialState(),
      queueClasses: this.queueClassProjector.initialState(),
      policyPacks: this.policyPackProjector.initialState(),
      features: this.featureProjector.initialState(),
      releaseTrains: this.releaseTrainProjector.initialState(),
      promotionGates: this.promotionGateProjector.initialState(),
      rollout: this.rolloutProjector.initialState(),
      subagentDispatch: this.subagentDispatchProjector.initialState(),
    };
  }

  applyEvent(states, event) {
    return {
      session: this.sessionProjector.apply(states.session, event),
      tasks: this.taskBoardProjector.apply(states.tasks, event),
      verification: this.verificationProjector.apply(states.verification, event),
      workflow: this.workflowProjector.apply(states.workflow, event),
      freshness: this.freshnessProjector.apply(states.freshness, event),
      integration: this.integrationProjector.apply(states.integration, event),
      mergeReadiness: this.mergeReadinessProjector.apply(states.mergeReadiness, event),
      claims: this.claimProjector.apply(states.claims, event),
      routing: this.routingProjector.apply(states.routing, event),
      childSessions: this.childSessionProjector.apply(states.childSessions, event),
      agents: this.agentProjector.apply(states.agents, event),
      queueClasses: this.queueClassProjector.apply(states.queueClasses, event),
      policyPacks: this.policyPackProjector.apply(states.policyPacks, event),
      features: this.featureProjector.apply(states.features, event),
      releaseTrains: this.releaseTrainProjector.apply(states.releaseTrains, event),
      promotionGates: this.promotionGateProjector.apply(states.promotionGates, event),
      rollout: this.rolloutProjector.apply(states.rollout, event),
      subagentDispatch: this.subagentDispatchProjector.apply(states.subagentDispatch, event),
    };
  }

  applyEvents(baseStates, events) {
    let states = { ...baseStates };
    for (const event of events) {
      states = this.applyEvent(states, event);
    }
    return states;
  }

  async writeReplayProof({ mode, events = [], states = {}, projectionCursor = 0 }) {
    const firstSeq = events.length > 0 ? toNumber(events[0]?.seq, 0) : 0;
    const lastSeq = events.length > 0 ? toNumber(events[events.length - 1]?.seq, 0) : 0;
    const eventDigestInput = events.map(event => ({
      seq: toNumber(event?.seq, 0),
      type: String(event?.type ?? ''),
      sessionId: String(event?.sessionId ?? ''),
      taskId: String(event?.taskId ?? ''),
      payload: event?.payload ?? {},
      meta: event?.meta ?? {},
    }));
    const replayHash = hashString(stableStringify(eventDigestInput));
    const snapshotHash = hashString(stableStringify(states));
    const sequenceIntegrity = buildSequenceIntegrity(events, projectionCursor);

    await this.snapshots.writeReplayProof({
      schemaVersion: 1,
      mode,
      eventCount: events.length,
      firstSeq,
      lastSeq,
      projectionCursor,
      replayHash,
      snapshotHash,
      sequenceIntegrity,
      generatedAt: new Date().toISOString(),
    });

    return {
      replayHash,
      snapshotHash,
      sequenceIntegrity,
    };
  }

  async writeStates(states, lastSeq, reason = '') {
    await this.snapshots.writeSession(states.session);
    await this.snapshots.writeTasks(states.tasks);
    await this.snapshots.writeVerification(states.verification);
    await this.snapshots.writeWorkflow(states.workflow);
    await this.snapshots.writeFreshness(states.freshness);
    await this.snapshots.writeIntegration(states.integration);
    await this.snapshots.writeMergeReadiness(states.mergeReadiness);
    await this.snapshots.writeClaims(states.claims);
    await this.snapshots.writeRouting(states.routing);
    await this.snapshots.writeChildSessions(states.childSessions);
    await this.snapshots.writeAgents(states.agents);
    await this.snapshots.writeQueueClasses(states.queueClasses);
    await this.snapshots.writePolicyPacks(states.policyPacks);
    await this.snapshots.writeFeatures(states.features);
    await this.snapshots.writeReleaseTrains(states.releaseTrains);
    await this.snapshots.writePromotionGates(states.promotionGates);
    await this.snapshots.writeRollout(states.rollout);
    await this.snapshots.writeSubagentDispatch(states.subagentDispatch);
    await this.snapshots.writeProjectionState({
      lastAppliedSeq: lastSeq,
      requiresReplay: false,
      reason,
      updatedAt: new Date().toISOString(),
    });
  }

  async readStatesFromSnapshots() {
    const initial = this.initialStates();
    return {
      session: await this.snapshots.readSession(initial.session),
      tasks: await this.snapshots.readTasks(initial.tasks),
      verification: await this.snapshots.readVerification(initial.verification),
      workflow: await this.snapshots.readWorkflow(initial.workflow),
      freshness: await this.snapshots.readFreshness(initial.freshness),
      integration: await this.snapshots.readIntegration(initial.integration),
      mergeReadiness: await this.snapshots.readMergeReadiness(initial.mergeReadiness),
      claims: await this.snapshots.readClaims(initial.claims),
      routing: await this.snapshots.readRouting(initial.routing),
      childSessions: await this.snapshots.readChildSessions(initial.childSessions),
      agents: await this.snapshots.readAgents(initial.agents),
      queueClasses: await this.snapshots.readQueueClasses(initial.queueClasses),
      policyPacks: await this.snapshots.readPolicyPacks(initial.policyPacks),
      features: await this.snapshots.readFeatures(initial.features),
      releaseTrains: await this.snapshots.readReleaseTrains(initial.releaseTrains),
      promotionGates: await this.snapshots.readPromotionGates(initial.promotionGates),
      rollout: await this.snapshots.readRollout(initial.rollout),
      subagentDispatch: await this.snapshots.readSubagentDispatch(initial.subagentDispatch),
    };
  }

  snapshotPaths() {
    const paths = this.snapshots.paths;
    return [
      paths.sessionSnapshot(),
      paths.taskBoardSnapshot(),
      paths.verificationSnapshot(),
      paths.workflowSnapshot(),
      paths.freshnessSnapshot(),
      paths.integrationSnapshot(),
      paths.mergeReadinessSnapshot(),
      paths.claimsSnapshot(),
      paths.routingSnapshot(),
      paths.childSessionsSnapshot(),
      paths.agentsSnapshot(),
      paths.queueClassesSnapshot(),
      paths.policyPacksSnapshot(),
      paths.featuresSnapshot(),
      paths.releaseTrainsSnapshot(),
      paths.promotionGatesSnapshot(),
      paths.rolloutSnapshot(),
      paths.subagentDispatchSnapshot(),
    ];
  }

  async shouldForceReplay(events, projectionState) {
    if (!await this.snapshots.store.exists(this.snapshots.paths.projectionState())) {
      return true;
    }

    if (projectionState.requiresReplay === true) {
      return true;
    }

    const lastAppliedSeq = toNumber(projectionState.lastAppliedSeq, 0);
    const lastEventSeq = events.length > 0 ? toNumber(events[events.length - 1].seq, 0) : 0;
    if (lastAppliedSeq < 0 || lastAppliedSeq > lastEventSeq) {
      return true;
    }

    for (const snapshotPath of this.snapshotPaths()) {
      if (!await this.snapshots.store.exists(snapshotPath)) {
        return true;
      }
    }
    return false;
  }

  async replay() {
    const sorted = sortEvents(await this.ledger.readAll());
    const nextStates = this.applyEvents(this.initialStates(), sorted);
    const lastSeq = sorted.length > 0 ? toNumber(sorted[sorted.length - 1].seq, 0) : 0;
    await this.writeStates(nextStates, lastSeq, 'full-replay');
    const proof = await this.writeReplayProof({
      mode: 'full-replay',
      events: sorted,
      states: nextStates,
      projectionCursor: lastSeq,
    });

    return {
      mode: 'full-replay',
      eventsProcessed: sorted.length,
      lastSeq,
      replayHash: proof.replayHash,
      snapshotHash: proof.snapshotHash,
      sequenceIntegrity: proof.sequenceIntegrity,
    };
  }

  async projectIncremental() {
    const sorted = sortEvents(await this.ledger.readAll());
    const projectionState = await this.snapshots.readProjectionState();

    if (await this.shouldForceReplay(sorted, projectionState)) {
      return this.replay();
    }

    const lastAppliedSeq = toNumber(projectionState.lastAppliedSeq, 0);
    const pending = sorted.filter(event => toNumber(event.seq, 0) > lastAppliedSeq);
    if (pending.length < 1) {
      return {
        mode: 'incremental',
        eventsProcessed: 0,
        lastSeq: lastAppliedSeq,
      };
    }

    const baseStates = await this.readStatesFromSnapshots();
    const nextStates = this.applyEvents(baseStates, pending);
    const lastSeq = toNumber(pending[pending.length - 1].seq, lastAppliedSeq);
    await this.writeStates(nextStates, lastSeq, 'incremental');
    const proof = await this.writeReplayProof({
      mode: 'incremental',
      events: sorted,
      states: nextStates,
      projectionCursor: lastSeq,
    });
    return {
      mode: 'incremental',
      eventsProcessed: pending.length,
      lastSeq,
      replayHash: proof.replayHash,
      snapshotHash: proof.snapshotHash,
      sequenceIntegrity: proof.sequenceIntegrity,
    };
  }
}
