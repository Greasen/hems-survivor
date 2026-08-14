import { assertValidConfig, standardConfig } from './config';
import { upgradeIds } from './upgrades';
import type { GameConfig, GameState, UpgradeId } from './types';

function invalid(path: string, message: string): never {
  throw new Error(`Invalid state: ${path} ${message}`);
}

function finite(path: string, value: number): void {
  if (!Number.isFinite(value)) invalid(path, 'must be finite');
}

function nonNegative(path: string, value: number): void {
  finite(path, value);
  if (value < 0) invalid(path, 'must be non-negative');
}

function integer(path: string, value: number): void {
  finite(path, value);
  if (!Number.isInteger(value)) invalid(path, 'must be an integer');
}

function oneOf<T extends string>(path: string, value: T, values: readonly T[]): void {
  if (!values.includes(value)) invalid(path, `must be one of ${values.join(', ')}`);
}

function unique(path: string, values: readonly (string | number)[]): void {
  if (new Set(values).size !== values.length) invalid(path, 'must not contain duplicates');
}

function validateReason(path: string, entry: { code: string; tick: number; amount?: number }): void {
  if (typeof entry.code !== 'string' || entry.code.trim() === '') invalid(`${path}.code`, 'must not be empty');
  integer(`${path}.tick`, entry.tick);
  if (entry.amount !== undefined) finite(`${path}.amount`, entry.amount);
}

export function createInitialState(seed: number, config: GameConfig = standardConfig): GameState {
  assertValidConfig(config);
  const normalized = seed >>> 0;
  const state: GameState = {
    status: 'ready',
    tick: 0,
    seed: normalized,
    randomState: normalized,
    battery: {
      level: config.battery.initial,
      capacity: config.battery.capacity,
      chargePower: config.battery.chargePower,
      dischargePower: config.battery.dischargePower,
      mode: 'auto',
    },
    ev: { level: config.ev.initial, capacity: config.ev.capacity, chargePower: config.ev.chargePower, mode: 'paused' },
    grid: { buyEnabled: true, sellEnabled: false, available: true },
    resources: { ...config.resources },
    outageTicks: 0,
    stableTicks: 0,
    event: null,
    nextEventWarningAt: config.crisisStartTick > 55 ? 55 : null,
    lastEventKind: null,
    selectedUpgrades: [],
    pendingUpgrades: [],
    triggeredUpgradeTicks: [],
    gameOverReason: null,
    lastReport: null,
    keyMoments: [],
  };
  assertValidState(state, config);
  return state;
}

export function assertValidState(state: GameState, config: GameConfig = standardConfig): void {
  oneOf('status', state.status, ['ready', 'running', 'paused', 'choosingUpgrade', 'victory', 'gameOver']);
  integer('tick', state.tick);
  if (state.tick < 0 || state.tick > config.durationTicks) invalid('tick', `must be between 0 and ${config.durationTicks}`);
  if (state.status === 'ready' && state.tick !== 0) invalid('status', 'ready state must have tick 0');
  if (['running', 'paused', 'choosingUpgrade'].includes(state.status) && state.tick >= config.durationTicks) invalid('status', `${state.status} must be before duration`);
  if (state.status === 'victory' && state.tick !== config.durationTicks) invalid('status', 'victory must be at duration');
  if (state.status === 'gameOver' && state.tick <= 0) invalid('status', 'gameOver must have a positive tick');
  integer('seed', state.seed);
  if (state.seed < 0 || state.seed > 0xffffffff) invalid('seed', 'must be an unsigned 32-bit integer');
  integer('randomState', state.randomState);
  if (state.randomState < 0 || state.randomState > 0xffffffff) invalid('randomState', 'must be an unsigned 32-bit integer');

  finite('battery.level', state.battery.level);
  finite('battery.capacity', state.battery.capacity);
  if (state.battery.capacity <= 0) invalid('battery.capacity', 'must be greater than 0');
  if (state.battery.level < 0 || state.battery.level > state.battery.capacity) invalid('battery.level', 'is outside capacity');
  nonNegative('battery.chargePower', state.battery.chargePower);
  nonNegative('battery.dischargePower', state.battery.dischargePower);
  oneOf('battery.mode', state.battery.mode, ['charge', 'auto', 'discharge']);

  finite('ev.level', state.ev.level);
  finite('ev.capacity', state.ev.capacity);
  if (state.ev.capacity <= 0) invalid('ev.capacity', 'must be greater than 0');
  if (state.ev.level < 0 || state.ev.level > state.ev.capacity) invalid('ev.level', 'is outside capacity');
  nonNegative('ev.chargePower', state.ev.chargePower);
  oneOf('ev.mode', state.ev.mode, ['paused', 'charging']);

  if (typeof state.grid.buyEnabled !== 'boolean') invalid('grid.buyEnabled', 'must be boolean');
  if (typeof state.grid.sellEnabled !== 'boolean') invalid('grid.sellEnabled', 'must be boolean');
  if (typeof state.grid.available !== 'boolean') invalid('grid.available', 'must be boolean');
  nonNegative('resources.money', state.resources.money);
  finite('resources.family', state.resources.family);
  if (state.resources.family < 0 || state.resources.family > 100) invalid('resources.family', 'must be between 0 and 100');
  nonNegative('resources.score', state.resources.score);
  integer('outageTicks', state.outageTicks);
  integer('stableTicks', state.stableTicks);
  if (state.outageTicks < 0 || state.outageTicks > config.durationTicks) invalid('outageTicks', 'is outside duration');
  if (state.stableTicks < 0 || state.stableTicks > config.family.stableRecoveryTicks) invalid('stableTicks', 'is outside recovery interval');

  if (state.event) {
    oneOf('event.kind', state.event.kind, ['cloudy', 'peakPrice', 'familyLoad', 'evEmergency']);
    oneOf('event.stage', state.event.stage, ['warning', 'active']);
    integer('event.startsAt', state.event.startsAt);
    integer('event.endsAt', state.event.endsAt);
    if (state.event.startsAt < 0) invalid('event.startsAt', 'must be non-negative');
    if (state.event.endsAt > config.durationTicks) invalid('event.endsAt', 'exceeds duration');
    if (state.event.endsAt > config.crisisStartTick) invalid('event.endsAt', 'must not cross crisisStartTick');
    if (state.tick >= config.crisisStartTick) invalid('event', 'must not exist at or after crisisStartTick');
    if (state.event.startsAt >= state.event.endsAt) invalid('event.startsAt', 'must precede endsAt');
    if (state.event.stage === 'warning' && state.tick >= state.event.startsAt) invalid('event.startsAt', 'must be after the warning state tick');
    if (state.event.stage === 'active' && (state.tick < state.event.startsAt || state.tick >= state.event.endsAt)) invalid('event', 'active bounds must contain state.tick');
    if (typeof state.event.allHomeSupplied !== 'boolean') invalid('event.allHomeSupplied', 'must be boolean');
    if (state.event.targetEvLevel !== null) {
      if (state.event.kind !== 'evEmergency') invalid('event.targetEvLevel', 'is only valid for evEmergency');
      finite('event.targetEvLevel', state.event.targetEvLevel);
      if (state.event.targetEvLevel < 0 || state.event.targetEvLevel > state.ev.capacity) invalid('event.targetEvLevel', 'is outside EV capacity');
    }
    if (state.event.kind === 'evEmergency' && state.event.stage === 'active' && state.event.targetEvLevel === null) invalid('event.targetEvLevel', 'is required while evEmergency is active');
    if (state.event.stage === 'warning' && state.event.targetEvLevel !== null) invalid('event.targetEvLevel', 'must be null while warning');
  }
  if (state.nextEventWarningAt !== null) {
    integer('nextEventWarningAt', state.nextEventWarningAt);
    if (state.nextEventWarningAt < state.tick || state.nextEventWarningAt >= config.crisisStartTick || state.nextEventWarningAt > config.durationTicks) invalid('nextEventWarningAt', 'must be at or after state.tick and before crisisStartTick');
  }
  if (state.event && state.nextEventWarningAt !== null) invalid('nextEventWarningAt', 'must be null while an event exists');
  if (state.lastEventKind !== null) oneOf('lastEventKind', state.lastEventKind, ['cloudy', 'peakPrice', 'familyLoad', 'evEmergency']);

  const selected = state.selectedUpgrades as string[];
  const pending = state.pendingUpgrades as string[];
  unique('selectedUpgrades', selected);
  unique('pendingUpgrades', pending);
  selected.forEach((upgrade, index) => oneOf(`selectedUpgrades[${index}]`, upgrade as UpgradeId, upgradeIds));
  pending.forEach((upgrade, index) => oneOf(`pendingUpgrades[${index}]`, upgrade as UpgradeId, upgradeIds));
  if (selected.some((upgrade) => pending.includes(upgrade))) invalid('upgrades', 'selected and pending choices must be disjoint');
  unique('triggeredUpgradeTicks', state.triggeredUpgradeTicks);
  state.triggeredUpgradeTicks.forEach((tick, index) => {
    integer(`triggeredUpgradeTicks[${index}]`, tick);
    if (!config.upgradeTicks.includes(tick)) invalid(`triggeredUpgradeTicks[${index}]`, 'is not configured');
    if (tick > state.tick) invalid(`triggeredUpgradeTicks[${index}]`, 'cannot be in the future');
    if (index > 0 && tick <= state.triggeredUpgradeTicks[index - 1]) invalid(`triggeredUpgradeTicks[${index}]`, 'must be strictly increasing');
  });

  if (state.gameOverReason !== null) oneOf('gameOverReason', state.gameOverReason, ['familyDepleted', 'sustainedOutage']);
  if (state.status === 'gameOver' && state.gameOverReason === null) invalid('gameOverReason', 'is required for gameOver');
  if (state.status !== 'gameOver' && state.gameOverReason !== null) invalid('gameOverReason', 'requires gameOver status');
  if (state.status === 'choosingUpgrade' && state.pendingUpgrades.length !== 3) invalid('pendingUpgrades', 'must contain exactly 3 choices while choosingUpgrade');
  if (state.status !== 'choosingUpgrade' && state.pendingUpgrades.length !== 0) invalid('pendingUpgrades', 'must be empty outside choosingUpgrade');
  if (state.status === 'choosingUpgrade') {
    const latestTrigger = state.triggeredUpgradeTicks.at(-1);
    if (latestTrigger === undefined || latestTrigger !== state.tick || !config.upgradeTicks.includes(latestTrigger)) invalid('triggeredUpgradeTicks', 'choosingUpgrade must be at its configured trigger tick');
    if (state.triggeredUpgradeTicks.length !== state.selectedUpgrades.length + 1) invalid('triggeredUpgradeTicks', 'choosingUpgrade requires one more trigger than selected upgrade');
  } else if (state.triggeredUpgradeTicks.length !== state.selectedUpgrades.length) {
    invalid('triggeredUpgradeTicks', 'non-choosing state requires one trigger per selected upgrade');
  }

  if (state.lastReport) {
    integer('lastReport.tick', state.lastReport.tick);
    if (state.lastReport.tick !== state.tick) invalid('lastReport.tick', 'must match state.tick');
    const reportPhaseIndex = Math.max(0, state.lastReport.tick - 1);
    const reportPhase = config.phase.find((phase) => phase.from <= reportPhaseIndex && reportPhaseIndex <= phase.to);
    if (!reportPhase || state.lastReport.phase !== reportPhase.name) invalid('lastReport.phase', 'does not match configured phase');
    if (state.lastReport.outageTicks !== state.outageTicks) invalid('lastReport.outageTicks', 'must match state.outageTicks');
    if (state.lastReport.outageTicks > state.tick) invalid('lastReport.outageTicks', 'must not exceed state.tick');
    for (const field of ['solar', 'home', 'buyPrice', 'sellPrice', 'unmetHome', 'outageTicks', 'curtailed'] as const) {
      if (field === 'outageTicks') integer(`lastReport.${field}`, state.lastReport[field]);
      else nonNegative(`lastReport.${field}`, state.lastReport[field]);
    }
    state.lastReport.flows.forEach((flow, index) => {
      oneOf(`lastReport.flows[${index}].from`, flow.from, ['solar', 'home', 'battery', 'ev', 'grid', 'curtailed']);
      oneOf(`lastReport.flows[${index}].to`, flow.to, ['solar', 'home', 'battery', 'ev', 'grid', 'curtailed']);
      nonNegative(`lastReport.flows[${index}].amount`, flow.amount);
    });
    state.lastReport.reasons.forEach((entry, index) => {
      validateReason(`lastReport.reasons[${index}]`, entry);
      if (entry.tick !== state.tick) invalid(`lastReport.reasons[${index}].tick`, 'must match state.tick');
    });
  }
  if (state.keyMoments.length > 20) invalid('keyMoments', 'must contain at most 20 entries');
  const keyMomentReasons = new Set<string>();
  let previousMomentTick = -1;
  state.keyMoments.forEach((entry, index) => {
    validateReason(`keyMoments[${index}]`, entry);
    if (entry.tick < 0 || entry.tick > state.tick) invalid(`keyMoments[${index}].tick`, `must be between 0 and ${state.tick}`);
    if (entry.tick < previousMomentTick) invalid(`keyMoments[${index}].tick`, 'must be non-decreasing');
    previousMomentTick = entry.tick;
    const key = `${entry.tick}:${entry.code}`;
    if (keyMomentReasons.has(key)) invalid(`keyMoments[${index}]`, 'duplicates an existing reason at the same tick');
    keyMomentReasons.add(key);
  });
}
