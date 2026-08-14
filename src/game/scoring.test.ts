import { describe, expect, it } from 'vitest';
import { applyTickResources } from './scoring';
import { standardConfig } from './config';
import { stateAt } from '../test/fixtures';

describe('applyTickResources', () => {
  it('penalizes a shortage and increments outage time', () => {
    const result = applyTickResources(stateAt(), { unmetHome: 0.2, solarDirectUse: 0, nextTick: 1 }, standardConfig);
    expect(result.resources.family).toBe(98);
    expect(result.outageTicks).toBe(1);
    expect(result.stableTicks).toBe(0);
  });

  it('restores one Family after 30 stable Ticks', () => {
    const result = applyTickResources(stateAt({ stableTicks: 29, resources: { money: 120, family: 90, score: 0 } }), { unmetHome: 0, solarDirectUse: 1, nextTick: 30 }, standardConfig);
    expect(result.resources.family).toBe(91);
    expect(result.stableTicks).toBe(0);
  });

  it('prefers sustained outage when both failures happen together', () => {
    const result = applyTickResources(stateAt({ outageTicks: 9, resources: { money: 0, family: 2, score: 0 } }), { unmetHome: 1, solarDirectUse: 0, nextTick: 10 }, standardConfig);
    expect(result.status).toBe('gameOver');
    expect(result.gameOverReason).toBe('sustainedOutage');
  });

  it('wins at Tick 360 and grants the crisis bonus', () => {
    const result = applyTickResources(stateAt({ tick: 359 }), { unmetHome: 0, solarDirectUse: 0, nextTick: 360 }, standardConfig);
    expect(result.status).toBe('victory');
    expect(result.resources.score).toBe(501);
  });
});
