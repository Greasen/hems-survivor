import { act, cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import App from './App';
import * as gameEngine from './game/engine';

describe('App', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] });
    window.history.replaceState({}, '', '/');
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  function setup() {
    return userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
  }

  async function startGame(user: ReturnType<typeof setup>) {
    await user.click(screen.getByRole('button', { name: '开始游戏' }));
    expect(screen.queryByRole('dialog', { name: '电量守卫' })).not.toBeInTheDocument();
  }

  async function chooseUpgrade(user: ReturnType<typeof setup>) {
    const dialog = screen.getByRole('dialog', { name: '选择升级' });
    await user.click(within(dialog).getAllByRole('button', { name: /选择/ })[0]);
    expect(screen.queryByRole('dialog', { name: '选择升级' })).not.toBeInTheDocument();
  }

  async function advanceThroughUpgrade(user: ReturnType<typeof setup>, duration = 90_000) {
    act(() => vi.advanceTimersByTime(duration));
    if (screen.queryByRole('dialog', { name: '选择升级' })) await chooseUpgrade(user);
  }

  async function finishRun(user: ReturnType<typeof setup>) {
    for (let cycle = 0; cycle < 5 && !screen.queryByRole('dialog', { name: /胜利|游戏结束/ }); cycle += 1) {
      await advanceThroughUpgrade(user);
    }
  }

  it('moves from ready to running and exposes all core controls', async () => {
    const user = setup();
    render(<App />);

    expect(screen.getByRole('heading', { name: '电量守卫', level: 1 })).toBeInTheDocument();
    expect(screen.getByRole('dialog', { name: '电量守卫' })).toBeInTheDocument();
    expect(document.querySelector('.overlay')).toBeInTheDocument();
    await startGame(user);

    expect(screen.getByText('时间 00:00')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Battery 充电' }));
    expect(screen.getByRole('button', { name: 'Battery 充电' })).toHaveAttribute('aria-pressed', 'true');
    await user.click(screen.getByRole('button', { name: 'Battery 自动' }));
    expect(screen.getByRole('button', { name: 'Battery 自动' })).toHaveAttribute('aria-pressed', 'true');
    await user.click(screen.getByRole('button', { name: 'Battery 放电' }));
    expect(screen.getByRole('button', { name: 'Battery 放电' })).toHaveAttribute('aria-pressed', 'true');
    await user.click(screen.getByRole('button', { name: 'EV 充电' }));
    expect(screen.getByRole('button', { name: 'EV 充电' })).toHaveAttribute('aria-pressed', 'true');
    await user.click(screen.getByRole('button', { name: 'EV 暂停' }));
    expect(screen.getByRole('button', { name: 'EV 暂停' })).toHaveAttribute('aria-pressed', 'true');

    const buy = screen.getByRole('switch', { name: '允许买电' });
    const sell = screen.getByRole('switch', { name: '允许卖电' });
    expect(buy).toBeChecked();
    expect(sell).not.toBeChecked();
    await user.click(buy);
    await user.click(sell);
    expect(buy).not.toBeChecked();
    expect(sell).toBeChecked();
  });

  it('pauses and resumes the running game without advancing time while paused', async () => {
    const user = setup();
    render(<App />);
    await startGame(user);

    act(() => vi.advanceTimersByTime(1_000));
    expect(screen.getByText('时间 00:01')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '暂停游戏' }));
    expect(screen.getByRole('dialog', { name: '游戏已暂停' })).toBeInTheDocument();
    act(() => vi.advanceTimersByTime(5_000));
    expect(screen.getByText('时间 00:01')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '继续游戏' }));
    act(() => vi.advanceTimersByTime(1_000));
    expect(screen.getByText('时间 00:02')).toBeInTheDocument();
  });

  it('opens the upgrade dialog at Tick 90 and resumes after a real choice', async () => {
    const user = setup();
    render(<App />);
    await startGame(user);

    act(() => vi.advanceTimersByTime(90_000));
    expect(screen.getByRole('dialog', { name: '选择升级' })).toBeInTheDocument();
    await chooseUpgrade(user);
    expect(screen.getByText('时间 01:30')).toBeInTheDocument();
  });

  it('shows Game Over and restarts with clean initial values and a new seed', async () => {
    window.history.replaceState({}, '', '/?seed=101');
    const user = setup();
    render(<App />);
    await startGame(user);
    await user.click(screen.getByRole('switch', { name: '允许买电' }));
    await user.click(screen.getByRole('button', { name: 'Battery 放电' }));

    for (let cycle = 0; cycle < 5 && !screen.queryByRole('dialog', { name: '游戏结束' }); cycle += 1) {
      await advanceThroughUpgrade(user);
    }
    expect(screen.getByRole('dialog', { name: '游戏结束' })).toBeInTheDocument();
    expect(screen.getByText(/Seed/)).toBeInTheDocument();

    vi.spyOn(Date, 'now').mockReturnValue(202);
    await user.click(screen.getByRole('button', { name: '重新开始' }));
    expect(screen.getByRole('dialog', { name: '电量守卫' })).toBeInTheDocument();
    expect(screen.getByText('时间 00:00')).toBeInTheDocument();
    expect(screen.getByLabelText('Battery 电量')).toHaveTextContent('60.0 / 100.0');
    expect(screen.getByLabelText('EV 电量')).toHaveTextContent('30.0 / 80.0');

    await startGame(user);
    await user.click(screen.getByRole('switch', { name: '允许买电' }));
    await user.click(screen.getByRole('button', { name: 'Battery 放电' }));
    await finishRun(user);
    expect(screen.getByText('Seed 202')).toBeInTheDocument();
  });

  it('keeps one Tick per interval across three consecutive starts and restarts', async () => {
    const user = setup();
    render(<App />);

    for (let run = 0; run < 3; run += 1) {
      await startGame(user);
      act(() => vi.advanceTimersByTime(1_000));
      expect(screen.getByText('时间 00:01')).toBeInTheDocument();
      await user.click(screen.getByRole('button', { name: '暂停游戏' }));
      await user.click(screen.getByRole('button', { name: '继续游戏' }));
      act(() => vi.advanceTimersByTime(89_000));
      await chooseUpgrade(user);
      expect(screen.getByText('时间 01:30')).toBeInTheDocument();

      // Finish this run and restart from the result overlay.
      await finishRun(user);
      expect(screen.getByRole('dialog', { name: /胜利|游戏结束/ })).toBeInTheDocument();
      await user.click(screen.getByRole('button', { name: '重新开始' }));
      expect(screen.getByRole('dialog', { name: '电量守卫' })).toBeInTheDocument();
    }
  });

  it('contains a controller Tick error, cleans its timer, and recovers to a fresh ready game', async () => {
    const runTick = vi.spyOn(gameEngine, 'runTick').mockImplementation(() => {
      throw new Error('broken Tick');
    });
    const clearIntervalSpy = vi.spyOn(window, 'clearInterval');
    const user = setup();
    render(<App />);
    await startGame(user);

    act(() => vi.advanceTimersByTime(1_000));
    expect(screen.getByRole('heading', { name: '游戏状态异常' })).toBeInTheDocument();
    expect(screen.getByText('游戏已暂停，请重新开始本局。')).toBeInTheDocument();
    expect(clearIntervalSpy).toHaveBeenCalled();
    const callsAfterError = runTick.mock.calls.length;
    expect(callsAfterError).toBeGreaterThan(0);

    act(() => vi.advanceTimersByTime(5_000));
    expect(runTick).toHaveBeenCalledTimes(callsAfterError);
    await user.click(screen.getByRole('button', { name: '重新开始' }));
    expect(screen.getByRole('dialog', { name: '电量守卫' })).toBeInTheDocument();
    expect(screen.getByText('时间 00:00')).toBeInTheDocument();
  });

  it('exposes the mobile layout regions and named controls', () => {
    const { container } = render(<App />);
    expect(container.querySelector('.game-shell')).toBeInTheDocument();
    expect(container.querySelector('.status-bar')).toBeInTheDocument();
    expect(container.querySelector('.energy-board')).toBeInTheDocument();
    expect(container.querySelector('.risk-panel')).toBeInTheDocument();
    expect(container.querySelector('.control-panel')).toBeInTheDocument();
    for (const control of container.querySelectorAll('button, input')) {
      expect(control).toHaveAccessibleName();
    }
  });
});
