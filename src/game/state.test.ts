import { describe, expect, it } from 'vitest';
import { createInitialState } from './state';

describe('createInitialState', () => {
  it('creates the approved ready state', () => {
    const state = createInitialState(123);
    expect(state.status).toBe('ready');
    expect(state.tick).toBe(0);
    expect(state.battery).toMatchObject({ level: 60, capacity: 100, mode: 'auto' });
    expect(state.ev).toMatchObject({ level: 30, capacity: 80, mode: 'paused' });
    expect(state.grid).toMatchObject({ buyEnabled: true, sellEnabled: false });
    expect(state.resources).toEqual({ money: 120, family: 100, score: 0 });
  });
});
