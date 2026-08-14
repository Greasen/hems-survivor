import { describe, expect, it } from 'vitest';
import { appendKeyMoments, dispatchAction, environmentForTick, runTick } from './engine';
import { standardConfig } from './config';
import { createInitialState } from './state';
import { applyTickResources } from './scoring';
import { stateAt } from '../test/fixtures';

describe('game engine', () => {
  it('does not Tick outside running state', () => {
    const ready = stateAt({ status: 'ready' });
    expect(runTick(ready, standardConfig)).toBe(ready);
  });

  it('returns a structured report for a running Tick', () => {
    const result = runTick(stateAt(), standardConfig);
    expect(result.tick).toBe(1);
    expect(result.lastReport).toMatchObject({ tick: 1, phase: 'safe' });
    expect(result.lastReport!.flows.length).toBeGreaterThan(0);
  });

  it.each([
    [1, 'safe'],
    [60, 'safe'],
    [61, 'learning'],
    [180, 'learning'],
    [181, 'pressure'],
    [300, 'pressure'],
    [301, 'crisis'],
    [360, 'crisis'],
  ])('uses the phase row for Tick %i', (tick, phase) => {
    const result = runTick(stateAt({ tick: tick - 1 }), standardConfig);
    expect(result.lastReport?.phase).toBe(phase);
  });

  it('consumes Solar and Home random values regardless of control modes', () => {
    const first = environmentForTick(stateAt({ battery: { ...stateAt().battery, mode: 'auto' }, ev: { ...stateAt().ev, mode: 'paused' } }), standardConfig, 1, 123);
    const second = environmentForTick(stateAt({ battery: { ...stateAt().battery, mode: 'discharge' }, ev: { ...stateAt().ev, mode: 'charging' } }), standardConfig, 1, 123);
    expect(second.randomState).toBe(first.randomState);
    expect(second.environment.solar).toBe(first.environment.solar);
    expect(second.environment.home).toBe(first.environment.home);
  });

  it.each([
    [301, true],
    [310, true],
    [311, false],
    [320, false],
    [321, true],
  ])('uses phaseIndex for crisis Grid cycle at Tick %i', (tick, available) => {
    expect(environmentForTick(stateAt(), standardConfig, tick, 123).gridAvailable).toBe(available);
  });

  it('applies configured derived upgrade multipliers in environment order', () => {
    const base = environmentForTick(stateAt(), standardConfig, 1, 123);
    const upgraded = environmentForTick(stateAt({ selectedUpgrades: ['solar_optimizer', 'home_efficiency', 'grid_contract'] }), standardConfig, 1, 123);
    expect(upgraded.environment.solar).toBeCloseTo(base.environment.solar * 1.25, 12);
    expect(upgraded.environment.home).toBeCloseTo(base.environment.home * 0.85, 12);
    expect(upgraded.environment.buyPrice).toBeCloseTo(base.environment.buyPrice * 0.85, 12);
    expect(upgraded.environment.sellPrice).toBeCloseTo(base.environment.sellPrice * 1.15, 12);
  });

  it('records event warning, start, and end/recovery reasons without duplicates', () => {
    let state = stateAt({ tick: 54, nextEventWarningAt: 55, randomState: 99, lastEventKind: null });
    state = runTick(state, standardConfig);
    expect(state.lastReport?.reasons.some((item) => item.code.startsWith('eventWarning:'))).toBe(true);
    while (state.tick < state.event!.startsAt) state = runTick(state, standardConfig);
    expect(state.lastReport?.reasons.some((item) => item.code.startsWith('eventStarted:'))).toBe(true);
    const ending = stateAt({ tick: 84, event: { kind: 'cloudy', stage: 'active', startsAt: 60, endsAt: 85, allHomeSupplied: true, targetEvLevel: null } });
    const ended = runTick(ending, standardConfig);
    expect(ended.lastReport?.reasons.map((item) => item.code)).toEqual(expect.arrayContaining(['eventEnded:cloudy', 'cloudyRestored']));
    expect(new Set(ended.lastReport!.reasons.map((item) => item.code)).size).toBe(ended.lastReport!.reasons.length);
  });

  it('records event success/failure as structured reasons', () => {
    const success = runTick(stateAt({ tick: 84, event: { kind: 'familyLoad', stage: 'active', startsAt: 60, endsAt: 85, allHomeSupplied: true, targetEvLevel: null } }), standardConfig);
    expect(success.lastReport?.reasons.map((item) => item.code)).toContain('eventSuccess:familyLoad');
    const failure = runTick(stateAt({ tick: 104, event: { kind: 'evEmergency', stage: 'active', startsAt: 60, endsAt: 105, allHomeSupplied: true, targetEvLevel: 80 }, ev: { level: 30, capacity: 80, chargePower: 0.6, mode: 'paused' } }), standardConfig);
    expect(failure.lastReport?.reasons.map((item) => item.code)).toContain('eventFailure:evEmergency');
  });

  it('settles EV emergency success at the epsilon boundary and mirrors it in report moments', () => {
    const input = stateAt({ tick: 104, ev: { ...stateAt().ev, level: 45 - 2.84e-14, mode: 'paused' }, event: { kind: 'evEmergency', stage: 'active', startsAt: 60, endsAt: 105, allHomeSupplied: true, targetEvLevel: 45 } });
    const scoringConfig = { ...standardConfig, score: { ...standardConfig.score, survivalPerTick: 0, solarDirectPerUnit: 0 } };
    const result = runTick(input, scoringConfig);
    expect(result.resources.score - input.resources.score).toBe(150);
    expect(result.resources.family).toBe(input.resources.family);
    expect(result.lastReport?.reasons.map((item) => item.code)).toContain('eventSuccess:evEmergency');
    expect(result.lastReport?.reasons.map((item) => item.code)).not.toContain('eventFailure:evEmergency');
    expect(result.keyMoments.map((item) => item.code)).toContain('eventSuccess:evEmergency');
    expect(result.keyMoments.map((item) => item.code)).not.toContain('eventFailure:evEmergency');
  });

  it('settles EV emergency failure beyond epsilon and mirrors the penalty in report moments', () => {
    const input = stateAt({ tick: 104, ev: { ...stateAt().ev, level: 45 - 1.1e-6, mode: 'paused' }, event: { kind: 'evEmergency', stage: 'active', startsAt: 60, endsAt: 105, allHomeSupplied: true, targetEvLevel: 45 } });
    const scoringConfig = { ...standardConfig, score: { ...standardConfig.score, survivalPerTick: 0, solarDirectPerUnit: 0 } };
    const result = runTick(input, scoringConfig);
    expect(result.resources.score).toBe(input.resources.score);
    expect(result.resources.family).toBe(input.resources.family - 15);
    expect(result.lastReport?.reasons.map((item) => item.code)).toContain('eventFailure:evEmergency');
    expect(result.lastReport?.reasons.map((item) => item.code)).not.toContain('eventSuccess:evEmergency');
    expect(result.keyMoments.map((item) => item.code)).toContain('eventFailure:evEmergency');
    expect(result.keyMoments.map((item) => item.code)).not.toContain('eventSuccess:evEmergency');
  });

  it('keeps the key-moment window bounded and de-duplicates same-tick reasons', () => {
    const entries = appendKeyMoments([], Array.from({ length: 25 }, (_, index) => ({ code: `reason${index}`, tick: index })), 20);
    expect(entries).toHaveLength(20);
    expect(appendKeyMoments(entries, [{ code: 'reason24', tick: 24 }], 20)).toEqual(entries);
  });

  it('pauses for the Tick-90 upgrade before Tick 91 can run', () => {
    const result = runTick(stateAt({ tick: 89 }), standardConfig);
    expect(result.status).toBe('choosingUpgrade');
    expect(result.pendingUpgrades).toHaveLength(3);
    expect(runTick(result, standardConfig)).toBe(result);
  });

  it('accepts only a displayed upgrade and resumes', () => {
    const choosing = runTick(stateAt({ tick: 89 }), standardConfig);
    const result = dispatchAction(choosing, { type: 'chooseUpgrade', upgrade: choosing.pendingUpgrades[0] }, standardConfig);
    expect(result.status).toBe('running');
    expect(result.pendingUpgrades).toEqual([]);
  });

  it('rejects controls outside running and pause/resume mismatches', () => {
    const ready = createInitialState(123);
    expect(dispatchAction(ready, { type: 'setEvMode', mode: 'charging' }, standardConfig)).toBe(ready);
    expect(dispatchAction(ready, { type: 'pause' }, standardConfig)).toBe(ready);
    const running = dispatchAction(ready, { type: 'start' }, standardConfig);
    expect(dispatchAction(running, { type: 'resume' }, standardConfig)).toBe(running);
    const paused = dispatchAction(running, { type: 'pause' }, standardConfig);
    expect(paused.status).toBe('paused');
    expect(dispatchAction(paused, { type: 'pause' }, standardConfig)).toBe(paused);
    expect(dispatchAction(paused, { type: 'resume' }, standardConfig).status).toBe('running');
  });

  it('keeps Grid buy and sell controls as independent switches', () => {
    const initial = stateAt({ grid: { buyEnabled: false, sellEnabled: false, available: true } });
    const selling = dispatchAction(initial, { type: 'setGridSell', enabled: true }, standardConfig);
    const both = dispatchAction(selling, { type: 'setGridBuy', enabled: true }, standardConfig);
    expect(both.grid).toEqual({ buyEnabled: true, sellEnabled: true, available: true });
    expect(both.resources).toEqual(initial.resources);
    expect(both.battery.level).toBe(initial.battery.level);
    expect(both.ev.level).toBe(initial.ev.level);
  });

  it('reports the post-settlement continuous outage seconds', () => {
    const normal = runTick(stateAt(), standardConfig);
    expect(normal.lastReport?.outageTicks).toBe(0);
    const outageConfig = {
      ...standardConfig,
      grid: { ...standardConfig.grid, buyPower: 0 },
      phase: standardConfig.phase.map((phase) => ({ ...phase, solar: 0, home: 2 })),
    };
    const outage = runTick(stateAt({ battery: { ...stateAt().battery, level: 0 }, grid: { buyEnabled: false, sellEnabled: false, available: false } }), outageConfig);
    expect(outage.outageTicks).toBe(1);
    expect(outage.lastReport?.outageTicks).toBe(1);
  });

  it('does not record an upgrade reason or key moment when the upgrade Tick ends the run', () => {
    const failureConfig = {
      ...standardConfig,
      grid: { ...standardConfig.grid, buyPower: 0 },
      phase: standardConfig.phase.map((phase) => ({ ...phase, solar: 0, home: 2 })),
    };
    const failed = runTick(stateAt({ tick: 89, outageTicks: 9, battery: { ...stateAt().battery, level: 0 }, grid: { buyEnabled: false, sellEnabled: false, available: false } }), failureConfig);
    expect(failed.status).toBe('gameOver');
    expect(failed.lastReport?.reasons.some((item) => item.code === 'upgradeAvailable')).toBe(false);
    expect(failed.keyMoments.some((item) => item.code === 'upgradeAvailable')).toBe(false);

    const victoryConfig = { ...standardConfig, durationTicks: 90 };
    const won = runTick(stateAt({ tick: 89 }), victoryConfig);
    expect(won.status).toBe('victory');
    expect(won.lastReport?.reasons.some((item) => item.code === 'upgradeAvailable')).toBe(false);
    expect(won.keyMoments.some((item) => item.code === 'upgradeAvailable')).toBe(false);
  });

  it('clears all per-run fields on restart', () => {
    const dirty = stateAt({ tick: 120, event: { kind: 'cloudy', stage: 'active', startsAt: 100, endsAt: 125, allHomeSupplied: false, targetEvLevel: null }, nextEventWarningAt: null, lastEventKind: 'cloudy', selectedUpgrades: ['solar_optimizer'], pendingUpgrades: ['battery_power'], triggeredUpgradeTicks: [90], outageTicks: 4, stableTicks: 3, gameOverReason: 'familyDepleted', lastReport: null, keyMoments: [{ code: 'old', tick: 120 }] });
    const restarted = dispatchAction(dirty, { type: 'restart', seed: 7 }, standardConfig);
    expect(restarted).toEqual(createInitialState(7));
  });

  it('rejects an upgrade that is not displayed', () => {
    const choosing = runTick(stateAt({ tick: 89 }), standardConfig);
    const hidden = (['battery_capacity', 'battery_power', 'solar_optimizer', 'home_efficiency', 'ev_fast_charge', 'grid_contract'] as const)
      .find((upgrade) => !choosing.pendingUpgrades.includes(upgrade))!;
    expect(dispatchAction(choosing, { type: 'chooseUpgrade', upgrade: hidden }, standardConfig)).toBe(choosing);
  });

  it('replays a complete run deterministically', () => {
    const replay = (seed: number) => {
      let state = dispatchAction(createInitialState(seed), { type: 'start' }, standardConfig);
      while (state.status === 'running' || state.status === 'choosingUpgrade') {
        if (state.status === 'choosingUpgrade') {
          state = dispatchAction(state, { type: 'chooseUpgrade', upgrade: state.pendingUpgrades[0] }, standardConfig);
        } else {
          state = runTick(state, standardConfig);
        }
      }
      return state;
    };
    const first = replay(20260814);
    const second = replay(20260814);
    expect({ status: first.status, resources: first.resources, battery: first.battery, ev: first.ev, upgrades: first.selectedUpgrades, moments: first.keyMoments })
      .toEqual({ status: second.status, resources: second.resources, battery: second.battery, ev: second.ev, upgrades: second.selectedUpgrades, moments: second.keyMoments });
  });

  it('applies Game Over before victory on Tick 360', () => {
    const input = stateAt({ tick: 359, outageTicks: 9, resources: { money: 0, family: 2, score: 0 }, battery: { level: 0, capacity: 100, chargePower: 1, dischargePower: 1, mode: 'charge' }, grid: { buyEnabled: false, sellEnabled: false, available: false } });
    const result = runTick(input, standardConfig);
    expect(result.status).toBe('gameOver');
    expect(result.gameOverReason).toBe('sustainedOutage');
    expect(result.resources.score).toBeLessThan(500);
  });

  it('grants the victory bonus only once', () => {
    const won = applyTickResources(stateAt({ tick: 359 }), { unmetHome: 0, solarDirectUse: 0, nextTick: 360 }, standardConfig);
    expect(won.resources.score).toBe(501);
    expect(runTick(won, standardConfig)).toBe(won);
  });
});
