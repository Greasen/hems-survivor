import { advanceEventBeforeEnergy, eventModifiers, isEvTargetSatisfied, isGridAvailable, resolveEventAfterEnergy } from './events';
import { settleEnergy } from './energy';
import { randomBetween } from './random';
import { applyTickResources } from './scoring';
import { assertValidState, createInitialState } from './state';
import { applyUpgrade, drawUpgradeChoices } from './upgrades';
import type {
  EnergyResult,
  EventRuntime,
  GameConfig,
  GameState,
  PlayerAction,
  ReasonEntry,
  TickEnvironment,
  TickReport,
} from './types';
import { assertValidConfig, standardConfig } from './config';

export interface EnvironmentResult {
  environment: TickEnvironment;
  phase: string;
  phaseIndex: number;
  randomState: number;
  gridAvailable: boolean;
  eventBefore?: EventRuntime | null;
  eventAfterAdvance?: EventRuntime | null;
  eventAfterEnergy?: EventRuntime | null;
  eventAfterResolution?: EventRuntime | null;
  eventResolved?: boolean;
  previousResources?: GameState['resources'];
  previousStatus?: GameState['status'];
}

function phaseForIndex(config: GameConfig, phaseIndex: number) {
  const containing = config.phase.find((phase) => phase.from <= phaseIndex && phaseIndex <= phase.to);
  if (containing) return containing;
  return phaseIndex < config.phase[0].from ? config.phase[0] : config.phase[config.phase.length - 1];
}

/** Calculate the complete environment for one settlement. Random draws are unconditional. */
export function environmentForTick(
  state: GameState,
  config: GameConfig,
  nextTick: number,
  randomState: number,
): EnvironmentResult {
  // The phase index represents the settlement being calculated. Tick 1 maps to index 0.
  const phaseIndex = nextTick - 1;
  const phase = phaseForIndex(config, phaseIndex);
  const solarRandom = randomBetween(randomState, config.random.solarMin, config.random.solarMax);
  const homeRandom = randomBetween(solarRandom.state, config.random.homeMin, config.random.homeMax);
  const modifiers = eventModifiers(state.event, config, nextTick);
  const hasSolarOptimizer = state.selectedUpgrades.includes('solar_optimizer');
  const hasHomeEfficiency = state.selectedUpgrades.includes('home_efficiency');
  const hasGridContract = state.selectedUpgrades.includes('grid_contract');
  const solarUpgrade = hasSolarOptimizer ? config.upgrades.solarMultiplier : 1;
  const homeUpgrade = hasHomeEfficiency ? config.upgrades.homeMultiplier : 1;

  const environment: TickEnvironment = {
    solar: phase.solar * solarRandom.value * modifiers.solarMultiplier * solarUpgrade,
    home: Math.max(0, (phase.home + homeRandom.value + modifiers.homeDelta) * homeUpgrade),
    buyPrice: (modifiers.buyPrice ?? config.grid.buyPrice) * (hasGridContract ? config.upgrades.gridBuyMultiplier : 1),
    sellPrice: (modifiers.sellPrice ?? config.grid.sellPrice) * (hasGridContract ? config.upgrades.gridSellMultiplier : 1),
  };

  // Crisis availability uses phaseIndex so indices 300–309 are open and 310–319 closed.
  const gridAvailable = isGridAvailable(phaseIndex, config.crisisStartTick);
  return {
    environment,
    phase: phase.name,
    phaseIndex,
    randomState: homeRandom.state,
    gridAvailable,
  };
}

function reason(code: string, tick: number, amount?: number): ReasonEntry {
  return amount === undefined ? { code, tick } : { code, amount, tick };
}

function appendReason(reasons: ReasonEntry[], entry: ReasonEntry): void {
  if (!reasons.some((item) => item.code === entry.code && item.tick === entry.tick)) reasons.push(entry);
}

function eventOutcome(event: EventRuntime, state: GameState): 'success' | 'failure' | null {
  if (event.kind === 'familyLoad') return event.allHomeSupplied ? 'success' : 'failure';
  if (event.kind === 'evEmergency') return isEvTargetSatisfied(state.ev.level, event.targetEvLevel ?? state.ev.level) ? 'success' : 'failure';
  return null;
}

export function buildTickReport(
  state: GameState,
  energy: EnergyResult,
  environmentResult: EnvironmentResult,
): TickReport {
  const tick = state.tick;
  const reasons: ReasonEntry[] = [];
  const beforeEvent = environmentResult.eventBefore ?? null;
  const afterAdvance = environmentResult.eventAfterAdvance ?? null;

  if (!beforeEvent && afterAdvance?.stage === 'warning') appendReason(reasons, reason(`eventWarning:${afterAdvance.kind}`, tick));
  if (beforeEvent?.stage === 'warning' && afterAdvance?.stage === 'active') appendReason(reasons, reason(`eventStarted:${afterAdvance.kind}`, tick));

  if (environmentResult.eventResolved && afterAdvance) {
    const outcome = eventOutcome(environmentResult.eventAfterEnergy ?? afterAdvance, state);
    if (outcome) appendReason(reasons, reason(`event${outcome === 'success' ? 'Success' : 'Failure'}:${afterAdvance.kind}`, tick));
    appendReason(reasons, reason(`eventEnded:${afterAdvance.kind}`, tick));
    if (afterAdvance.kind === 'cloudy') appendReason(reasons, reason('cloudyRestored', tick));
    if (afterAdvance.kind === 'peakPrice') appendReason(reasons, reason('priceRestored', tick));
  }

  if (energy.unmetHome > 0) appendReason(reasons, reason('homeUnmet', tick, energy.unmetHome));
  if (energy.curtailed > 0) appendReason(reasons, reason('solarCurtailed', tick, energy.curtailed));

  const previous = environmentResult.previousResources;
  if (previous) {
    const moneyDelta = state.resources.money - previous.money;
    const familyDelta = state.resources.family - previous.family;
    const scoreDelta = state.resources.score - previous.score;
    if (moneyDelta < 0) appendReason(reasons, reason('moneySpent', tick, moneyDelta));
    if (moneyDelta > 0) appendReason(reasons, reason('moneyEarned', tick, moneyDelta));
    if (familyDelta < 0) appendReason(reasons, reason('familyLost', tick, familyDelta));
    if (familyDelta > 0) appendReason(reasons, reason('familyRecovered', tick, familyDelta));
    if (scoreDelta > 0) appendReason(reasons, reason('scoreGained', tick, scoreDelta));
    if (scoreDelta < 0) appendReason(reasons, reason('scoreLost', tick, scoreDelta));
  }

  if (state.status === 'victory') appendReason(reasons, reason('victory', tick));
  if (state.status === 'gameOver') appendReason(reasons, reason(`gameOver:${state.gameOverReason ?? 'unknown'}`, tick));

  return {
    tick,
    phase: environmentResult.phase,
    solar: environmentResult.environment.solar,
    home: environmentResult.environment.home,
    buyPrice: environmentResult.environment.buyPrice,
    sellPrice: environmentResult.environment.sellPrice,
    flows: energy.flows,
    unmetHome: energy.unmetHome,
    outageTicks: state.outageTicks,
    curtailed: energy.curtailed,
    reasons,
  };
}

export function appendKeyMoments(existing: ReasonEntry[], reasons: ReasonEntry[], max = 20): ReasonEntry[] {
  const result = existing.map((entry) => ({ ...entry }));
  for (const entry of reasons) appendReason(result, { ...entry });
  return result.slice(Math.max(0, result.length - max));
}

export function runTick(input: GameState, config: GameConfig = standardConfig): GameState {
  assertValidConfig(config);
  assertValidState(input, config);
  if (input.status !== 'running') return input;
  const nextTick = input.tick + 1;
  const eventBefore = input.event ? structuredClone(input.event) : null;
  const eventAdvanced = advanceEventBeforeEnergy(input, config, nextTick);
  const environmentResult = environmentForTick(eventAdvanced.state, config, nextTick, eventAdvanced.randomState);
  const environmentState = {
    ...eventAdvanced.state,
    randomState: environmentResult.randomState,
    grid: { ...eventAdvanced.state.grid, available: environmentResult.gridAvailable },
  };
  const energy = settleEnergy(environmentState, config, environmentResult.environment);
  const eventResolvedState = resolveEventAfterEnergy(energy.state, nextTick, energy.unmetHome, config);
  let state = applyTickResources(eventResolvedState, {
    unmetHome: energy.unmetHome,
    solarDirectUse: energy.solarDirectUse,
    nextTick,
  }, config);

  const reportContext: EnvironmentResult = {
    ...environmentResult,
    eventBefore,
    eventAfterAdvance: eventAdvanced.state.event ? structuredClone(eventAdvanced.state.event) : null,
    eventAfterEnergy: energy.state.event ? structuredClone(energy.state.event) : null,
    eventAfterResolution: eventResolvedState.event ? structuredClone(eventResolvedState.event) : null,
    eventResolved: Boolean(eventAdvanced.state.event && !eventResolvedState.event && nextTick >= eventAdvanced.state.event.endsAt),
    previousResources: input.resources,
    previousStatus: input.status,
  };
  state.lastReport = buildTickReport(state, energy, reportContext);
  state.keyMoments = appendKeyMoments(state.keyMoments, state.lastReport.reasons, 20);

  if (state.status === 'running' && config.upgradeTicks.includes(nextTick) && !state.triggeredUpgradeTicks.includes(nextTick)) {
    const draw = drawUpgradeChoices(state);
    state.pendingUpgrades = draw.choices;
    state.randomState = draw.randomState;
    state.triggeredUpgradeTicks = [...state.triggeredUpgradeTicks, nextTick];
    state.status = 'choosingUpgrade';
    const upgradeReason = reason('upgradeAvailable', nextTick);
    appendReason(state.lastReport.reasons, upgradeReason);
    state.keyMoments = appendKeyMoments(state.keyMoments, [upgradeReason], 20);
  }
  // Keep the assertion at the orchestration boundary so every module composition is checked.
  assertValidState(state, config);
  return state;
}

export function dispatchAction(state: GameState, action: PlayerAction, config: GameConfig = standardConfig): GameState {
  assertValidConfig(config);
  assertValidState(state, config);
  const finish = (next: GameState): GameState => {
    assertValidState(next, config);
    return next;
  };
  if (action.type === 'restart') return finish(createInitialState(action.seed, config));
  if (action.type === 'start') return finish(state.status === 'ready' ? { ...state, status: 'running' } : state);
  if (action.type === 'pause') return finish(state.status === 'running' ? { ...state, status: 'paused' } : state);
  if (action.type === 'resume') return finish(state.status === 'paused' ? { ...state, status: 'running' } : state);
  if (state.status === 'choosingUpgrade' && action.type === 'chooseUpgrade') {
    if (!state.pendingUpgrades.includes(action.upgrade)) return finish(state);
    const upgraded = applyUpgrade(state, action.upgrade, config);
    return finish({
      ...upgraded,
      status: 'running',
      pendingUpgrades: [],
      keyMoments: appendKeyMoments(upgraded.keyMoments, [reason(`upgradeSelected:${action.upgrade}`, state.tick)], 20),
    });
  }
  if (state.status !== 'running') return finish(state);

  switch (action.type) {
    case 'setBatteryMode':
      return finish({ ...state, battery: { ...state.battery, mode: action.mode } });
    case 'setEvMode':
      return finish({ ...state, ev: { ...state.ev, mode: action.mode } });
    case 'setGridBuy':
      return finish({ ...state, grid: { ...state.grid, buyEnabled: action.enabled } });
    case 'setGridSell':
      return finish({ ...state, grid: { ...state.grid, sellEnabled: action.enabled } });
    default:
      return finish(state);
  }
}
