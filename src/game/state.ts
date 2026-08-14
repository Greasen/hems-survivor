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
    const permitsTailPhase = config.phase.at(-1)?.to !== config.durationTicks - 1;
    if (state.event.endsAt > config.durationTicks && !permitsTailPhase) invalid('event.endsAt', 'exceeds duration');
    if (state.event.startsAt >= state.event.endsAt) invalid('event.startsAt', 'must precede endsAt');
    if (typeof state.event.allHomeSupplied !== 'boolean') invalid('event.allHomeSupplied', 'must be boolean');
    if (state.event.targetEvLevel !== null) {
      if (state.event.kind !== 'evEmergency') invalid('event.targetEvLevel', 'is only valid for evEmergency');
      finite('event.targetEvLevel', state.event.targetEvLevel);
      if (state.event.targetEvLevel < 0 || state.event.targetEvLevel > state.ev.capacity) invalid('event.targetEvLevel', 'is outside EV capacity');
    }
  }
  if (state.nextEventWarningAt !== null) {
    integer('nextEventWarningAt', state.nextEventWarningAt);
    if (state.nextEventWarningAt < 0 || state.nextEventWarningAt > config.durationTicks) invalid('nextEventWarningAt', 'is outside the run');
  }
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
  });

  if (state.gameOverReason !== null) oneOf('gameOverReason', state.gameOverReason, ['familyDepleted', 'sustainedOutage']);

  if (state.lastReport) {
    integer('lastReport.tick', state.lastReport.tick);
    if (state.lastReport.tick !== state.tick) invalid('lastReport.tick', 'must match state.tick');
    if (typeof state.lastReport.phase !== 'string' || state.lastReport.phase.trim() === '') invalid('lastReport.phase', 'must not be empty');
    for (const field of ['solar', 'home', 'buyPrice', 'sellPrice', 'unmetHome', 'outageTicks', 'curtailed'] as const) {
      if (field === 'outageTicks') integer(`lastReport.${field}`, state.lastReport[field]);
      else nonNegative(`lastReport.${field}`, state.lastReport[field]);
    }
    state.lastReport.flows.forEach((flow, index) => {
      oneOf(`lastReport.flows[${index}].from`, flow.from, ['solar', 'home', 'battery', 'ev', 'grid', 'curtailed']);
      oneOf(`lastReport.flows[${index}].to`, flow.to, ['solar', 'home', 'battery', 'ev', 'grid', 'curtailed']);
      nonNegative(`lastReport.flows[${index}].amount`, flow.amount);
    });
    state.lastReport.reasons.forEach((entry, index) => validateReason(`lastReport.reasons[${index}]`, entry));
  }
  state.keyMoments.forEach((entry, index) => validateReason(`keyMoments[${index}]`, entry));
}
