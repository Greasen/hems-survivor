import { describe, expect, it } from 'vitest';
import { advanceEventBeforeEnergy, eventModifiers, resolveEventAfterEnergy, isGridAvailable } from './events';
import { standardConfig } from './config';
import { stateAt } from '../test/fixtures';

describe('events', () => {
  it('starts every first-event warning at Tick 55 and activates at Tick 60', () => {
    for (const seed of Array.from({ length: 32 }, (_, index) => index)) {
      const input = stateAt({ tick: 54, nextEventWarningAt: 55, lastEventKind: null, randomState: seed });
      const warned = advanceEventBeforeEnergy(input, standardConfig, 55);
      expect(warned.state.event?.startsAt, `seed ${seed}`).toBe(60);
      expect(warned.state.event?.stage, `seed ${seed}`).toBe('warning');
      const active = advanceEventBeforeEnergy({ ...warned.state, tick: 59 }, standardConfig, 60);
      expect(active.state.event?.stage, `seed ${seed}`).toBe('active');
    }
  });

  it('starts the first warning at Tick 55 and activates it at its startsAt Tick', () => {
    const warned = advanceEventBeforeEnergy(stateAt({ tick: 54, nextEventWarningAt: 55 }), standardConfig, 55);
    expect(warned.state.event?.stage).toBe('warning');
    const active = advanceEventBeforeEnergy({ ...warned.state, tick: warned.state.event!.startsAt - 1 }, standardConfig, warned.state.event!.startsAt);
    expect(active.state.event?.stage).toBe('active');
  });

  it('applies cloudy and peak-price modifiers only while active', () => {
    expect(eventModifiers({ kind: 'cloudy', stage: 'active', startsAt: 60, endsAt: 85, allHomeSupplied: true, targetEvLevel: null }, standardConfig, 60)).toMatchObject({ solarMultiplier: 0.4 });
    expect(eventModifiers({ kind: 'cloudy', stage: 'warning', startsAt: 60, endsAt: 85, allHomeSupplied: true, targetEvLevel: null }, standardConfig, 60)).toMatchObject({ solarMultiplier: 1 });
    expect(eventModifiers({ kind: 'cloudy', stage: 'active', startsAt: 60, endsAt: 85, allHomeSupplied: true, targetEvLevel: null }, standardConfig, 85)).toEqual({ solarMultiplier: 1, homeDelta: 0, buyPrice: null, sellPrice: null });
    expect(eventModifiers({ kind: 'peakPrice', stage: 'active', startsAt: 60, endsAt: 90, allHomeSupplied: true, targetEvLevel: null }, standardConfig, 60)).toMatchObject({ buyPrice: 2.2, sellPrice: 1.4 });
    expect(eventModifiers({ kind: 'familyLoad', stage: 'active', startsAt: 60, endsAt: 85, allHomeSupplied: true, targetEvLevel: null }, standardConfig, 60)).toMatchObject({ homeDelta: 0.6 });
  });

  it('rewards a fully supplied family-load event', () => {
    const state = stateAt({ event: { kind: 'familyLoad', stage: 'active', startsAt: 60, endsAt: 85, allHomeSupplied: true, targetEvLevel: null } });
    const result = resolveEventAfterEnergy(state, 85, 0, standardConfig);
    expect(result.resources.family).toBe(100);
    expect(result.resources.score).toBe(100);
    expect(result.event).toBeNull();
  });

  it('penalizes a missed EV target without ending the run directly', () => {
    const state = stateAt({ event: { kind: 'evEmergency', stage: 'active', startsAt: 60, endsAt: 105, allHomeSupplied: true, targetEvLevel: 45 } });
    const result = resolveEventAfterEnergy(state, 105, 0, standardConfig);
    expect(result.resources.family).toBe(85);
    expect(result.resources.score).toBe(0);
    expect(result.status).toBe('running');
  });

  it('treats an EV level within epsilon as satisfied at the deadline', () => {
    const state = stateAt({ ev: { ...stateAt().ev, level: 45 - 2.84e-14 }, event: { kind: 'evEmergency', stage: 'active', startsAt: 60, endsAt: 105, allHomeSupplied: true, targetEvLevel: 45 } });
    const result = resolveEventAfterEnergy(state, 105, 0, standardConfig);
    expect(result.resources.score).toBe(150);
    expect(result.resources.family).toBe(100);
  });

  it('fails an EV target beyond epsilon at the deadline', () => {
    const state = stateAt({ ev: { ...stateAt().ev, level: 45 - 1.1e-6 }, event: { kind: 'evEmergency', stage: 'active', startsAt: 60, endsAt: 105, allHomeSupplied: true, targetEvLevel: 45 } });
    const result = resolveEventAfterEnergy(state, 105, 0, standardConfig);
    expect(result.resources.score).toBe(0);
    expect(result.resources.family).toBe(85);
  });

  it('marks family-load events unsuccessful after any positive unmet home', () => {
    const state = stateAt({ event: { kind: 'familyLoad', stage: 'active', startsAt: 60, endsAt: 85, allHomeSupplied: true, targetEvLevel: null } });
    const result = resolveEventAfterEnergy(state, 70, 0.1, standardConfig);
    expect(result.event?.allHomeSupplied).toBe(false);
    expect(state.event?.allHomeSupplied).toBe(true);
  });

  it('does not settle an active event before its exclusive end tick', () => {
    const state = stateAt({ event: { kind: 'familyLoad', stage: 'active', startsAt: 60, endsAt: 85, allHomeSupplied: true, targetEvLevel: null } });
    const result = resolveEventAfterEnergy(state, 84, 0, standardConfig);
    expect(result.event?.kind).toBe('familyLoad');
    expect(result.resources.score).toBe(0);
  });

  it.each([
    ['cloudy', 5, 25],
    ['peakPrice', 10, 30],
    ['familyLoad', 5, 25],
    ['evEmergency', 5, 45],
  ] as const)('%s uses the configured warning and duration', (kind, warning, duration) => {
    expect(standardConfig.events[kind]).toEqual({ warning, duration });
  });

  it('does not schedule an event whose active window crosses Tick 300', () => {
    const result = advanceEventBeforeEnergy(stateAt({ tick: 294, nextEventWarningAt: 295 }), standardConfig, 295);
    expect(result.state.event).toBeNull();
    expect(result.state.nextEventWarningAt).toBeNull();
  });

  it('replays event selection and excludes the previous kind', () => {
    const input = stateAt({ tick: 54, nextEventWarningAt: 55, randomState: 99, lastEventKind: 'cloudy' });
    const first = advanceEventBeforeEnergy(input, standardConfig, 55);
    const replay = advanceEventBeforeEnergy(input, standardConfig, 55);
    expect(first.state.event?.kind).toBe(replay.state.event?.kind);
    expect(first.state.event?.kind).not.toBe('cloudy');
    expect(first.randomState).toBe(replay.randomState);
  });

  it('resolves an event only once and schedules a deterministic cooldown', () => {
    const state = stateAt({ event: { kind: 'cloudy', stage: 'active', startsAt: 60, endsAt: 85, allHomeSupplied: true, targetEvLevel: null }, randomState: 123 });
    const first = resolveEventAfterEnergy(state, 85, 0, standardConfig);
    const second = resolveEventAfterEnergy(first, 85, 0, standardConfig);
    expect(first.nextEventWarningAt).toBeGreaterThan(85);
    expect(second).toEqual(first);
    expect(state.event?.kind).toBe('cloudy');
  });

  it('draws learning and pressure cooldowns from their configured ranges', () => {
    const learning = resolveEventAfterEnergy(stateAt({ event: { kind: 'cloudy', stage: 'active', startsAt: 60, endsAt: 85, allHomeSupplied: true, targetEvLevel: null } }), 85, 0, standardConfig);
    expect(learning.nextEventWarningAt).toBeGreaterThanOrEqual(85 + standardConfig.eventCooldown.learningMin);
    expect(learning.nextEventWarningAt).toBeLessThanOrEqual(85 + standardConfig.eventCooldown.learningMax);

    const pressure = resolveEventAfterEnergy(stateAt({ event: { kind: 'cloudy', stage: 'active', startsAt: 180, endsAt: 200, allHomeSupplied: true, targetEvLevel: null } }), 200, 0, standardConfig);
    expect(pressure.nextEventWarningAt).toBeGreaterThanOrEqual(200 + standardConfig.eventCooldown.pressureMin);
    expect(pressure.nextEventWarningAt).toBeLessThanOrEqual(200 + standardConfig.eventCooldown.pressureMax);
  });

  it('sets the EV target when the event activates and clamps it to capacity', () => {
    const state = stateAt({ tick: 59, ev: { level: 75, capacity: 80, chargePower: 0.6, mode: 'paused' }, event: { kind: 'evEmergency', stage: 'warning', startsAt: 60, endsAt: 105, allHomeSupplied: true, targetEvLevel: null } });
    const active = advanceEventBeforeEnergy(state, standardConfig, 60);
    expect(active.state.event?.stage).toBe('active');
    expect(active.state.event?.targetEvLevel).toBe(80);
  });

  it.each([
    [299, true], [300, true], [309, true], [310, false], [319, false], [320, true],
  ])('returns the approved Grid state at Tick %i', (tick, available) => {
    expect(isGridAvailable(tick, 300)).toBe(available);
  });

  it('clears ordinary scheduling at the fixed Tick-300 crisis boundary', () => {
    const input = stateAt({ tick: 299, nextEventWarningAt: 299, randomState: 123 });
    const result = advanceEventBeforeEnergy(input, standardConfig, 300);
    expect(result.state.event).toBeNull();
    expect(result.state.nextEventWarningAt).toBeNull();
    expect(result.randomState).toBe(input.randomState);
  });
});
