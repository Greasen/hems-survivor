import { describe, expect, it } from 'vitest';
import { standardConfig } from './config';
import { dispatchAction, runTick } from './engine';
import { assertValidState, createInitialState } from './state';
import { stateAt } from '../test/fixtures';
import type { GameState } from './types';

function stateWith(mutator: (state: GameState) => void): GameState {
  const state = structuredClone(createInitialState(123)) as GameState;
  mutator(state);
  return state;
}

describe('assertValidState', () => {
  it.each([
    ['tick', (state: GameState) => { state.tick = -1; }],
    ['outageTicks', (state: GameState) => { state.outageTicks = -1; }],
    ['stableTicks', (state: GameState) => { state.stableTicks = 1.5; }],
    ['randomState', (state: GameState) => { state.randomState = Number.NaN; }],
    ['battery.chargePower', (state: GameState) => { state.battery.chargePower = -1; }],
    ['ev.level', (state: GameState) => { state.ev.level = state.ev.capacity + 1; }],
    ['resources.money', (state: GameState) => { state.resources.money = Number.POSITIVE_INFINITY; }],
    ['event.startsAt', (state: GameState) => { state.event = { kind: 'cloudy', stage: 'warning', startsAt: 20, endsAt: 10, allHomeSupplied: true, targetEvLevel: null }; }],
    ['event.targetEvLevel', (state: GameState) => { state.event = { kind: 'evEmergency', stage: 'active', startsAt: 20, endsAt: 30, allHomeSupplied: true, targetEvLevel: state.ev.capacity + 1 }; }],
  ] as const)('rejects invalid %s with a diagnostic field', (_field, mutate) => {
    expect(() => assertValidState(stateWith(mutate), standardConfig)).toThrow(new RegExp(_field.replace('.', '\\.')));
  });
});

describe('public engine boundaries validate before early returns', () => {
  it('rejects an invalid config even when runTick would be paused', () => {
    const input = stateAt({ status: 'paused' });
    expect(() => runTick(input, { ...standardConfig, tickMs: 0 })).toThrow(/tickMs/);
  });

  it('rejects an invalid state even when dispatchAction would ignore the action', () => {
    const input = stateAt({ status: 'victory', resources: { money: -1, family: 100, score: 0 } });
    expect(() => dispatchAction(input, { type: 'pause' }, standardConfig)).toThrow(/resources\.money/);
  });

  it('validates the state created by restart', () => {
    expect(() => dispatchAction(stateAt(), { type: 'restart', seed: 7 }, { ...standardConfig, durationTicks: 0 })).toThrow(/durationTicks/);
  });
});
