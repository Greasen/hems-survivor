import { describe, expect, it } from 'vitest';
import { standardConfig } from './config';
import { dispatchAction, runTick } from './engine';
import { assertValidState, createInitialState } from './state';
import { stateAt } from '../test/fixtures';
import type { GameState } from './types';

function stateWith(mutator: (state: GameState) => void): GameState {
  const state = structuredClone(createInitialState(123)) as GameState;
  mutator(state);
  if (state.nextEventWarningAt !== null && state.nextEventWarningAt < state.tick) state.nextEventWarningAt = null;
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
    ['triggeredUpgradeTicks', (state: GameState) => { state.triggeredUpgradeTicks = [90, 180]; state.status = 'running'; state.tick = 100; }],
    ['triggeredUpgradeTicks', (state: GameState) => { state.triggeredUpgradeTicks = [180, 90]; state.status = 'running'; state.tick = 180; }],
    ['triggeredUpgradeTicks', (state: GameState) => { state.triggeredUpgradeTicks = [90]; state.status = 'running'; state.tick = 100; }],
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
    const input = stateAt({ status: 'victory', tick: standardConfig.durationTicks, resources: { money: -1, family: 100, score: 0 } });
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

  it.each([
    ['ready', 1],
    ['running', standardConfig.durationTicks],
    ['paused', standardConfig.durationTicks],
    ['choosingUpgrade', standardConfig.durationTicks],
    ['victory', 0],
  ] as const)('rejects status %s at invalid tick %i', (status, tick) => {
    const pendingUpgrades = status === 'choosingUpgrade' ? ['battery_power', 'solar_optimizer', 'home_efficiency'] as const : [];
    const gameOverReason = null;
    expect(() => assertValidState(stateAt({ status, tick, pendingUpgrades: [...pendingUpgrades], gameOverReason }), standardConfig)).toThrow(/status|tick/);
  });

  it('requires event warning state to clear the next warning and stay before crisis', () => {
    const withWarning = stateAt({ tick: 57, nextEventWarningAt: 58, event: { kind: 'cloudy', stage: 'warning', startsAt: 60, endsAt: 85, allHomeSupplied: true, targetEvLevel: null } });
    expect(() => assertValidState(withWarning, standardConfig)).toThrow(/nextEventWarningAt/);
    const atCrisisBoundary = stateAt({ tick: 299, event: { kind: 'cloudy', stage: 'active', startsAt: 295, endsAt: 300, allHomeSupplied: true, targetEvLevel: null } });
    expect(() => assertValidState(atCrisisBoundary, standardConfig)).not.toThrow();
    const acrossCrisis = stateAt({ tick: 299, event: { kind: 'cloudy', stage: 'active', startsAt: 295, endsAt: 301, allHomeSupplied: true, targetEvLevel: null } });
    expect(() => assertValidState(acrossCrisis, standardConfig)).toThrow(/event/);
    expect(() => assertValidState(stateAt({ tick: 58, nextEventWarningAt: 57 }), standardConfig)).toThrow(/nextEventWarningAt/);
    expect(() => assertValidState(stateAt({ tick: 58, nextEventWarningAt: 300 }), standardConfig)).toThrow(/nextEventWarningAt/);
  });

  it('requires report reasons to belong to the report tick', () => {
    const state = stateAt({ tick: 2, lastReport: { tick: 2, phase: 'safe', solar: 0, home: 0, buyPrice: 0, sellPrice: 0, flows: [], unmetHome: 0, outageTicks: 0, curtailed: 0, reasons: [{ code: 'old', tick: 1 }] } });
    expect(() => assertValidState(state, standardConfig)).toThrow(/reasons/);
  });

  it('rejects a crisis report for standard Tick 1', () => {
    const state = stateAt({ tick: 1, lastReport: { tick: 1, phase: 'crisis', solar: 0, home: 0, buyPrice: 0, sellPrice: 0, flows: [], unmetHome: 0, outageTicks: 0, curtailed: 0, reasons: [] } });
    expect(() => assertValidState(state, standardConfig)).toThrow(/lastReport\.phase/);
  });

  it('rejects oversized, descending, or duplicate key moments', () => {
    const tooMany = stateAt({ tick: 21, keyMoments: Array.from({ length: 21 }, (_, index) => ({ code: `m${index}`, tick: index })) });
    expect(() => assertValidState(tooMany, standardConfig)).toThrow(/keyMoments/);
    const descending = stateAt({ tick: 2, keyMoments: [{ code: 'a', tick: 2 }, { code: 'b', tick: 1 }] });
    expect(() => assertValidState(descending, standardConfig)).toThrow(/keyMoments/);
    const duplicate = stateAt({ tick: 1, keyMoments: [{ code: 'a', tick: 1 }, { code: 'a', tick: 1, amount: 2 }] });
    expect(() => assertValidState(duplicate, standardConfig)).toThrow(/keyMoments/);
  });

  it('requires choosingUpgrade to be at its latest trigger and gameOver to have a positive tick', () => {
    const pseudoChoosing = stateAt({ status: 'choosingUpgrade', tick: 1, pendingUpgrades: ['battery_power', 'solar_optimizer', 'home_efficiency'] });
    expect(() => assertValidState(pseudoChoosing, standardConfig)).toThrow(/triggeredUpgradeTicks/);
    const zeroGameOver = stateAt({ status: 'gameOver', tick: 0, gameOverReason: 'familyDepleted' });
    expect(() => assertValidState(zeroGameOver, standardConfig)).toThrow(/gameOver|tick/);
  });

  it('accepts the normal three-trigger state and a legal four-trigger config', () => {
    const choosing = stateAt({ status: 'choosingUpgrade', tick: 180, pendingUpgrades: ['battery_power', 'solar_optimizer', 'home_efficiency'], triggeredUpgradeTicks: [90, 180], selectedUpgrades: ['battery_capacity'] });
    expect(() => assertValidState(choosing, standardConfig)).not.toThrow();
    const config = { ...standardConfig, upgradeTicks: [30, 60, 90, 120] };
    const fourth = stateAt({ status: 'choosingUpgrade', tick: 120, pendingUpgrades: ['battery_power', 'solar_optimizer', 'home_efficiency'], triggeredUpgradeTicks: [30, 60, 90, 120], selectedUpgrades: ['battery_capacity', 'ev_fast_charge', 'grid_contract'] });
    expect(() => assertValidState(fourth, config)).not.toThrow();
  });

  it('accepts legal zero-valued report fields and fractional state resources', () => {
    const input = stateAt({ resources: { money: 0.25, family: 0, score: 0.125 }, battery: { ...stateAt().battery, chargePower: 0, dischargePower: 0 }, ev: { ...stateAt().ev, chargePower: 0 } });
    expect(() => assertValidState(input, standardConfig)).not.toThrow();
  });
});
