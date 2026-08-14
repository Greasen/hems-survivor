import { StrictMode, type ReactNode } from 'react';
import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { acceleratedConfig, createInitialState, standardConfig } from '../game';
import type { GameState } from '../game';
import {
  GAME_SESSION_SCHEMA_VERSION,
  GAME_SESSION_STORAGE_KEY,
  loadGameSession,
  saveGameSession,
  useGameController,
} from './useGameController';

function testConfig(overrides: Partial<typeof standardConfig> = {}) {
  return { ...standardConfig, tickMs: 100, ...overrides };
}

function replaceSearch(search = '') {
  window.history.replaceState({}, '', `${window.location.pathname}${search}`);
}

describe('useGameController', () => {
  beforeEach(() => {
    localStorage.clear();
    replaceSearch();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('advances exactly one Tick per configured interval', () => {
    vi.useFakeTimers();
    const { result } = renderHook(() => useGameController(testConfig()));

    act(() => result.current.dispatch({ type: 'start' }));
    act(() => vi.advanceTimersByTime(300));

    expect(result.current.state.tick).toBe(3);
  });

  it('stops Tick progression while paused or choosing an upgrade', () => {
    vi.useFakeTimers();
    const config = testConfig({ upgradeTicks: [1] });
    const { result } = renderHook(() => useGameController(config));

    act(() => result.current.dispatch({ type: 'start' }));
    act(() => result.current.dispatch({ type: 'pause' }));
    act(() => vi.advanceTimersByTime(500));
    expect(result.current.state.tick).toBe(0);

    act(() => result.current.dispatch({ type: 'resume' }));
    act(() => vi.advanceTimersByTime(100));
    expect(result.current.state.status).toBe('choosingUpgrade');
    act(() => vi.advanceTimersByTime(500));
    expect(result.current.state.tick).toBe(1);
  });

  it('owns one interval under React Strict Mode', () => {
    vi.useFakeTimers();
    const wrapper = ({ children }: { children: ReactNode }) => <StrictMode>{children}</StrictMode>;
    const { result } = renderHook(() => useGameController(testConfig()), { wrapper });

    act(() => result.current.dispatch({ type: 'start' }));
    act(() => vi.advanceTimersByTime(100));

    expect(result.current.state.tick).toBe(1);
  });

  it('auto-pauses when the document becomes hidden and does not catch up', () => {
    vi.useFakeTimers();
    const { result } = renderHook(() => useGameController(testConfig()));

    act(() => result.current.dispatch({ type: 'start' }));
    Object.defineProperty(document, 'hidden', { configurable: true, value: true });
    act(() => document.dispatchEvent(new Event('visibilitychange')));
    act(() => vi.advanceTimersByTime(1_000));

    expect(result.current.state.status).toBe('paused');
    expect(result.current.state.tick).toBe(0);
    Object.defineProperty(document, 'hidden', { configurable: true, value: false });
  });

  it('restarts with a clean state and the supplied seed', () => {
    const { result } = renderHook(() => useGameController(standardConfig));

    act(() => result.current.dispatch({ type: 'start' }));
    act(() => result.current.dispatch({ type: 'setBatteryMode', mode: 'discharge' }));
    act(() => result.current.dispatch({ type: 'restart', seed: 88 }));

    expect(result.current.state).toMatchObject({ status: 'ready', tick: 0, seed: 88 });
    expect(result.current.state.battery.mode).toBe('auto');
  });

  it('normalizes an unsigned URL seed before creating the initial state', () => {
    replaceSearch('?seed=4294967297');
    const { result } = renderHook(() => useGameController(standardConfig));

    expect(result.current.state.seed).toBe(1);
  });

  it('falls back safely when the URL seed is invalid', () => {
    vi.spyOn(Date, 'now').mockReturnValue(0x1_0000_0001);
    replaceSearch('?seed=not-a-number');
    const { result } = renderHook(() => useGameController(standardConfig));

    expect(result.current.state.seed).toBe(1);
  });

  it('restores a saved run as paused without catching up elapsed wall time', () => {
    vi.useFakeTimers();
    const saved = { ...createInitialState(12), status: 'running' as const, tick: 7 };
    saveGameSession(saved);

    const { result } = renderHook(() => useGameController(testConfig()));
    expect(result.current.state.status).toBe('paused');
    expect(result.current.state.tick).toBe(7);

    act(() => vi.advanceTimersByTime(1_000));
    expect(result.current.state.tick).toBe(7);
  });

  it('saves every changed state with the current schema version', () => {
    const setItem = vi.spyOn(Storage.prototype, 'setItem');
    const { result } = renderHook(() => useGameController(standardConfig));

    act(() => result.current.dispatch({ type: 'start' }));
    const latest = JSON.parse(setItem.mock.calls.at(-1)?.[1] ?? '{}') as { version?: number; state?: GameState };

    expect(latest.version).toBe(GAME_SESSION_SCHEMA_VERSION);
    expect(latest.state?.status).toBe('running');
    expect(latest.state?.seed).toBe(result.current.state.seed);
  });

  it('rejects invalid and unsupported saved data and falls back to a ready state', () => {
    localStorage.setItem(GAME_SESSION_STORAGE_KEY, '{not-json');
    expect(loadGameSession()).toBeNull();
    const first = renderHook(() => useGameController(standardConfig));
    expect(first.result.current.state.status).toBe('ready');
    first.unmount();

    localStorage.setItem(GAME_SESSION_STORAGE_KEY, JSON.stringify({ version: 999, state: createInitialState(8) }));
    expect(loadGameSession()).toBeNull();
    const second = renderHook(() => useGameController(standardConfig));
    expect(second.result.current.state.status).toBe('ready');
  });

  it('does not crash when storage reads and writes are unavailable', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });

    expect(() => {
      const { result } = renderHook(() => useGameController(standardConfig));
      act(() => result.current.dispatch({ type: 'start' }));
    }).not.toThrow();
  });

  it('cleans the timer and visibility listener on unmount', () => {
    vi.useFakeTimers();
    const clearIntervalSpy = vi.spyOn(window, 'clearInterval');
    const { result, unmount } = renderHook(() => useGameController(testConfig()));
    act(() => result.current.dispatch({ type: 'start' }));

    unmount();
    act(() => vi.advanceTimersByTime(500));
    expect(clearIntervalSpy).toHaveBeenCalled();
  });

  it('does not restore a session when an explicit URL seed is supplied', () => {
    saveGameSession({ ...createInitialState(99), status: 'running' as const, tick: 4 });
    replaceSearch('?seed=44');

    const { result } = renderHook(() => useGameController(standardConfig));

    expect(result.current.state.seed).toBe(44);
    expect(result.current.state.tick).toBe(0);
    expect(result.current.state.status).toBe('ready');
  });

  it('supports an accelerated config without changing controller semantics', () => {
    const { result } = renderHook(() => useGameController({ ...acceleratedConfig, tickMs: 100 }));
    expect(result.current.state.status).toBe('ready');
  });
});
