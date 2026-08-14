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
    ['event.targetEvLevel', (state: GameState) => { state.event = { kind: 'evEmergency', stage: 'active', startsAt: 0, endsAt: 30, allHomeSupplied: true, targetEvLevel: state.ev.capacity + 1 }; }],
    ['event.targetEvLevel', (state: GameState) => { state.event = { kind: 'evEmergency', stage: 'active', startsAt: 0, endsAt: 30, allHomeSupplied: true, targetEvLevel: Number.NaN }; }],
    ['lastReport.phase', (state: GameState) => { state.lastReport = { tick: 0, phase: 'unknown', solar: 0, home: 0, buyPrice: 0, sellPrice: 0, flows: [], unmetHome: 0, outageTicks: 0, curtailed: 0, reasons: [] }; }],
    ['lastReport.outageTicks', (state: GameState) => { state.lastReport = { tick: 0, phase: 'safe', solar: 0, home: 0, buyPrice: 0, sellPrice: 0, flows: [], unmetHome: 0, outageTicks: 1, curtailed: 0, reasons: [] }; }],
    ['lastReport.reasons', (state: GameState) => { state.lastReport = { tick: 0, phase: 'safe', solar: 0, home: 0, buyPrice: 0, sellPrice: 0, flows: [], unmetHome: 0, outageTicks: 0, curtailed: 0, reasons: [{ code: 'old', tick: 1 }] }; }],
    ['keyMoments', (state: GameState) => { state.keyMoments = [{ code: 'future', tick: 1 }]; }],
    ['pendingUpgrades', (state: GameState) => { state.pendingUpgrades = ['battery_power']; }],
    ['triggeredUpgradeTicks', (state: GameState) => { state.triggeredUpgradeTicks = [90, 180]; state.tick = 100; }],
    ['gameOverReason', (state: GameState) => { state.gameOverReason = 'familyDepleted'; }],
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

  it('requires three unselected pending choices while choosing an upgrade', () => {
    const input = stateAt({ status: 'choosingUpgrade', pendingUpgrades: ['battery_power'] });
    expect(() => dispatchAction(input, { type: 'pause' }, standardConfig)).toThrow(/pendingUpgrades/);
  });

  it('requires an active EV emergency to have a target and a warning to have none', () => {
    const active = stateAt({ tick: 20, event: { kind: 'evEmergency', stage: 'active', startsAt: 10, endsAt: 30, allHomeSupplied: true, targetEvLevel: null } });
    expect(() => assertValidState(active, standardConfig)).toThrow(/targetEvLevel/);
    const warning = stateAt({ tick: 5, event: { kind: 'evEmergency', stage: 'warning', startsAt: 10, endsAt: 30, allHomeSupplied: true, targetEvLevel: 45 } });
    expect(() => assertValidState(warning, standardConfig)).toThrow(/targetEvLevel/);
  });

  it('accepts legal zero-valued report fields and fractional state resources', () => {
    const input = stateAt({ resources: { money: 0.25, family: 0, score: 0.125 }, battery: { ...stateAt().battery, chargePower: 0, dischargePower: 0 }, ev: { ...stateAt().ev, chargePower: 0 } });
    expect(() => assertValidState(input, standardConfig)).not.toThrow();
  });
});
