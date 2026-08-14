import { describe, expect, it } from 'vitest';
import { settleEnergy } from './energy';
import { standardConfig } from './config';
import { stateAt } from '../test/fixtures';

describe('settleEnergy', () => {
  it('sends solar to Home before charging storage', () => {
    const result = settleEnergy(stateAt(), standardConfig, { solar: 2, home: 1, buyPrice: 1, sellPrice: 0.6 });
    expect(result.flows).toContainEqual({ from: 'solar', to: 'home', amount: 1 });
    expect(result.flows).toContainEqual({ from: 'solar', to: 'battery', amount: 1 });
    expect(result.state.battery.level).toBe(61);
  });

  it('uses automatic Battery above reserve before Grid', () => {
    const result = settleEnergy(stateAt({ battery: { level: 26, capacity: 100, chargePower: 1, dischargePower: 1, mode: 'auto' } }), standardConfig, { solar: 0, home: 2, buyPrice: 1, sellPrice: 0.6 });
    expect(result.flows).toContainEqual({ from: 'battery', to: 'home', amount: 1 });
    expect(result.flows).toContainEqual({ from: 'grid', to: 'home', amount: 1 });
    expect(result.state.battery.level).toBe(25);
  });

  it('buys only the energy Money can pay for', () => {
    const state = stateAt({ resources: { money: 0.5, family: 100, score: 0 }, battery: { level: 0, capacity: 100, chargePower: 1, dischargePower: 1, mode: 'charge' } });
    const result = settleEnergy(state, standardConfig, { solar: 0, home: 1, buyPrice: 1, sellPrice: 0.6 });
    expect(result.bought).toBe(0.5);
    expect(result.unmetHome).toBe(0.5);
    expect(result.state.resources.money).toBe(0);
  });

  it('never buys and sells during the same Tick', () => {
    const state = stateAt({ grid: { buyEnabled: true, sellEnabled: true, available: true }, battery: { level: 60, capacity: 100, chargePower: 1, dischargePower: 1, mode: 'discharge' } });
    const result = settleEnergy(state, standardConfig, { solar: 0, home: 2, buyPrice: 1, sellPrice: 0.6 });
    expect(result.bought).toBeGreaterThan(0);
    expect(result.sold).toBe(0);
  });

  it('uses Grid to charge Battery only in charge mode', () => {
    const state = stateAt({ battery: { level: 50, capacity: 100, chargePower: 1, dischargePower: 1, mode: 'charge' } });
    const result = settleEnergy(state, standardConfig, { solar: 1, home: 1, buyPrice: 1, sellPrice: 0.6 });
    expect(result.flows).toContainEqual({ from: 'grid', to: 'battery', amount: 1 });
    expect(result.state.battery.level).toBe(51);
  });

  it('charges EV from Solar before Battery and Grid', () => {
    const state = stateAt({ ev: { level: 30, capacity: 80, chargePower: 0.6, mode: 'charging' }, battery: { level: 60, capacity: 100, chargePower: 1, dischargePower: 1, mode: 'discharge' } });
    const result = settleEnergy(state, standardConfig, { solar: 1.6, home: 1, buyPrice: 1, sellPrice: 0.6 });
    expect(result.flows).toContainEqual({ from: 'solar', to: 'ev', amount: 0.6 });
    expect(result.state.ev.level).toBe(30.6);
  });

  it('does not exceed full Battery or EV capacities', () => {
    const state = stateAt({ battery: { level: 100, capacity: 100, chargePower: 1, dischargePower: 1, mode: 'charge' }, ev: { level: 80, capacity: 80, chargePower: 0.6, mode: 'charging' } });
    const result = settleEnergy(state, standardConfig, { solar: 3, home: 1, buyPrice: 1, sellPrice: 0.6 });
    expect(result.state.battery.level).toBe(100);
    expect(result.state.ev.level).toBe(80);
    expect(result.curtailed).toBe(2);
  });

  it('cannot buy or sell while Grid is unavailable', () => {
    const state = stateAt({ grid: { buyEnabled: true, sellEnabled: true, available: false }, battery: { level: 0, capacity: 100, chargePower: 1, dischargePower: 1, mode: 'charge' } });
    const result = settleEnergy(state, standardConfig, { solar: 0, home: 1, buyPrice: 1, sellPrice: 0.6 });
    expect(result.bought).toBe(0);
    expect(result.sold).toBe(0);
    expect(result.unmetHome).toBe(1);
  });

  it('sells Solar before Battery and respects the combined sell cap', () => {
    const state = stateAt({ grid: { buyEnabled: false, sellEnabled: true, available: true }, battery: { level: 60, capacity: 100, chargePower: 1, dischargePower: 1, mode: 'discharge' } });
    const result = settleEnergy(state, standardConfig, { solar: 1.5, home: 1, buyPrice: 1, sellPrice: 0.6 });
    expect(result.flows).toContainEqual({ from: 'solar', to: 'grid', amount: 0.5 });
    expect(result.flows).toContainEqual({ from: 'battery', to: 'grid', amount: 0.5 });
    expect(result.sold).toBe(1);
  });

  it('conserves supplied, stored, sold, unmet, and curtailed energy', () => {
    const before = stateAt({ ev: { level: 30, capacity: 80, chargePower: 0.6, mode: 'charging' } });
    const result = settleEnergy(before, standardConfig, { solar: 2.4, home: 1.2, buyPrice: 1, sellPrice: 0.6 });
    const storageIncrease = result.state.battery.level - before.battery.level + result.state.ev.level - before.ev.level;
    const delivered = result.flows.filter((item) => item.to === 'home').reduce((sum, item) => sum + item.amount, 0);
    const externalInput = 2.4 + result.bought;
    expect(Math.abs(externalInput - storageIncrease - delivered - result.sold - result.curtailed)).toBeLessThan(0.000001);
  });

  it('does not mutate the input state', () => {
    const before = stateAt({ resources: { money: 2, family: 100, score: 0 } });
    const snapshot = structuredClone(before);
    settleEnergy(before, standardConfig, { solar: 0, home: 2, buyPrice: 1, sellPrice: 0.6 });
    expect(before).toEqual(snapshot);
  });
});
