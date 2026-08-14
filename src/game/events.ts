import { randomBetween } from './random';
import type { EventKind, EventModifiers, EventRuntime, GameConfig, GameState } from './types';

export const EMPTY_EVENT_MODIFIERS: EventModifiers = {
  solarMultiplier: 1,
  homeDelta: 0,
  buyPrice: null,
  sellPrice: null,
};

const EVENT_KINDS: readonly EventKind[] = ['cloudy', 'peakPrice', 'familyLoad', 'evEmergency'];

export function isEvTargetSatisfied(level: number, target: number): boolean {
  return level + 1e-6 >= target;
}

function isEventActive(event: EventRuntime | null, nextTick: number): event is EventRuntime {
  return Boolean(event && event.stage === 'active' && nextTick >= event.startsAt && nextTick < event.endsAt);
}

function isPressurePeriod(nextTick: number, config: GameConfig): boolean {
  const pressurePhase = config.phase[2];
  return pressurePhase ? nextTick >= pressurePhase.from : nextTick >= 180;
}

function chooseEvent(state: GameState, config: GameConfig, firstEvent: boolean): { kind: EventKind; randomState: number } {
  const pool = firstEvent ? EVENT_KINDS.filter((kind) => config.events[kind].warning === 5) : EVENT_KINDS;
  const choices = pool.filter((kind) => kind !== state.lastEventKind);
  const draw = randomBetween(state.randomState, 0, choices.length);
  return { kind: choices[Math.floor(draw.value)], randomState: draw.state };
}

export function advanceEventBeforeEnergy(
  input: GameState,
  config: GameConfig,
  nextTick: number,
): { state: GameState; randomState: number } {
  const state = structuredClone(input);

  if (state.event) {
    if (state.event.stage === 'warning' && nextTick >= state.event.startsAt) {
      state.event.stage = 'active';
      if (state.event.kind === 'evEmergency') {
        state.event.targetEvLevel = Math.min(state.ev.capacity, state.ev.level + config.eventEffects.evTargetDelta);
      }
    }
    // An event ending exactly at the crisis boundary is left for the after-energy resolver.
    if (nextTick >= config.crisisStartTick && state.event.endsAt > config.crisisStartTick) {
      state.event = null;
      state.nextEventWarningAt = null;
    }
    return { state, randomState: state.randomState };
  }

  if (nextTick >= config.crisisStartTick) {
    state.nextEventWarningAt = null;
    return { state, randomState: state.randomState };
  }

  if (state.nextEventWarningAt === null || nextTick < state.nextEventWarningAt) {
    return { state, randomState: state.randomState };
  }

  const firstEvent = state.nextEventWarningAt === 55 && state.lastEventKind === null;
  const selected = chooseEvent(state, config, firstEvent);
  const settings = config.events[selected.kind];
  const startsAt = nextTick + settings.warning;
  const endsAt = startsAt + settings.duration;
  if (startsAt >= config.crisisStartTick || endsAt > config.crisisStartTick) {
    state.event = null;
    state.nextEventWarningAt = null;
    state.randomState = selected.randomState;
    return { state, randomState: selected.randomState };
  }

  state.event = {
    kind: selected.kind,
    stage: 'warning',
    startsAt,
    endsAt,
    allHomeSupplied: true,
    targetEvLevel: null,
  };
  state.nextEventWarningAt = null;
  state.randomState = selected.randomState;
  return { state, randomState: selected.randomState };
}

export function eventModifiers(event: EventRuntime | null, config: GameConfig, nextTick: number): EventModifiers {
  if (!isEventActive(event, nextTick)) return { ...EMPTY_EVENT_MODIFIERS };
  switch (event.kind) {
    case 'cloudy':
      return { ...EMPTY_EVENT_MODIFIERS, solarMultiplier: config.eventEffects.cloudySolarMultiplier };
    case 'peakPrice':
      return { ...EMPTY_EVENT_MODIFIERS, buyPrice: config.eventEffects.peakBuyPrice, sellPrice: config.eventEffects.peakSellPrice };
    case 'familyLoad':
      return { ...EMPTY_EVENT_MODIFIERS, homeDelta: config.eventEffects.familyHomeDelta };
    case 'evEmergency':
      return { ...EMPTY_EVENT_MODIFIERS };
  }
}

export function resolveEventAfterEnergy(
  input: GameState,
  nextTick: number,
  unmetHome: number,
  config: GameConfig,
): GameState {
  if (!input.event) return input;
  const state = structuredClone(input);
  const event = state.event!;

  if (event.kind === 'familyLoad' && isEventActive(event, nextTick) && unmetHome > 0) {
    event.allHomeSupplied = false;
  }
  if (nextTick < event.endsAt) return state;

  if (event.kind === 'familyLoad' && event.allHomeSupplied) {
    state.resources.family = Math.min(100, state.resources.family + config.eventEffects.familyReward);
    state.resources.score = Math.max(0, state.resources.score + config.score.familyEvent);
  } else if (event.kind === 'evEmergency') {
    const target = event.targetEvLevel ?? state.ev.level;
    if (isEvTargetSatisfied(state.ev.level, target)) {
      state.resources.score = Math.max(0, state.resources.score + config.score.evEvent);
    } else {
      state.resources.family = Math.max(0, state.resources.family - config.eventEffects.evFamilyPenalty);
      state.resources.score = Math.max(0, state.resources.score - config.score.evEventMiss);
    }
  }

  state.lastEventKind = event.kind;
  state.event = null;
  if (nextTick >= config.crisisStartTick) {
    state.nextEventWarningAt = null;
    return state;
  }

  const pressure = isPressurePeriod(nextTick, config);
  const min = pressure ? config.eventCooldown.pressureMin : config.eventCooldown.learningMin;
  const max = pressure ? config.eventCooldown.pressureMax : config.eventCooldown.learningMax;
  const cooldown = randomBetween(state.randomState, min, max + 1);
  state.randomState = cooldown.state;
  const candidateWarning = nextTick + Math.floor(cooldown.value);
  state.nextEventWarningAt = candidateWarning < config.crisisStartTick && candidateWarning <= config.durationTicks ? candidateWarning : null;
  return state;
}

export function isGridAvailable(nextTick: number, crisisStartTick: number): boolean {
  if (nextTick < crisisStartTick) return true;
  return (nextTick - crisisStartTick) % 20 < 10;
}
