import { StrictMode, type ReactNode } from 'react';
import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { acceleratedConfig, standardConfig } from '../game';
import { useGameController } from './useGameController';

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

  it('cleans the timer and visibility listener on unmount', () => {
    vi.useFakeTimers();
    const clearIntervalSpy = vi.spyOn(window, 'clearInterval');
    const { result, unmount } = renderHook(() => useGameController(testConfig()));
    act(() => result.current.dispatch({ type: 'start' }));

    unmount();
    act(() => vi.advanceTimersByTime(500));
    expect(clearIntervalSpy).toHaveBeenCalled();
  });

  it('uses an explicit URL seed for a fresh state', () => {
    replaceSearch('?seed=44');

    const { result } = renderHook(() => useGameController(standardConfig));

    expect(result.current.state.seed).toBe(44);
    expect(result.current.state.tick).toBe(0);
    expect(result.current.state.status).toBe('ready');
  });

  it('starts a fresh ready state after the hook is remounted', () => {
    const first = renderHook(() => useGameController(standardConfig));
    act(() => first.result.current.dispatch({ type: 'start' }));
    first.unmount();

    const second = renderHook(() => useGameController(standardConfig));
    expect(second.result.current.state.status).toBe('ready');
    expect(second.result.current.state.tick).toBe(0);
  });

  it('supports an accelerated config without changing controller semantics', () => {
    const { result } = renderHook(() => useGameController({ ...acceleratedConfig, tickMs: 100 }));
    expect(result.current.state.status).toBe('ready');
  });
});
