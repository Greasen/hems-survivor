import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ControlPanel } from './ControlPanel';
import { stateAt } from '../test/fixtures';
import type { PlayerAction } from '../game/types';
import { standardConfig } from '../game/config';

describe('ControlPanel', () => {
  afterEach(cleanup);

  it('emits exact battery, EV, and grid actions without mutating state', async () => {
    const user = userEvent.setup();
    const onAction = vi.fn<(action: PlayerAction) => void>();
    const state = stateAt();
    render(<ControlPanel state={state} onAction={onAction} />);

    await user.click(screen.getByRole('button', { name: 'Battery 放电' }));
    expect(onAction).toHaveBeenLastCalledWith({ type: 'setBatteryMode', mode: 'discharge' });
    await user.click(screen.getByRole('button', { name: 'EV 充电' }));
    expect(onAction).toHaveBeenLastCalledWith({ type: 'setEvMode', mode: 'charging' });
    await user.click(screen.getByRole('switch', { name: '允许卖电' }));
    expect(onAction).toHaveBeenLastCalledWith({ type: 'setGridSell', enabled: true });
    expect(state.battery.mode).toBe('auto');
    expect(state.ev.mode).toBe('paused');
    expect(state.grid.sellEnabled).toBe(false);
  });

  it('emits each of the seven control actions exactly', async () => {
    const user = userEvent.setup();
    const onAction = vi.fn<(action: PlayerAction) => void>();
    render(<ControlPanel state={stateAt()} onAction={onAction} />);
    for (const [name, action] of [
      ['Battery 充电', { type: 'setBatteryMode', mode: 'charge' }],
      ['Battery 自动', { type: 'setBatteryMode', mode: 'auto' }],
      ['Battery 放电', { type: 'setBatteryMode', mode: 'discharge' }],
      ['EV 暂停', { type: 'setEvMode', mode: 'paused' }],
      ['EV 充电', { type: 'setEvMode', mode: 'charging' }],
    ] as const) {
      await user.click(screen.getByRole('button', { name }));
      expect(onAction).toHaveBeenLastCalledWith(action);
    }
    await user.click(screen.getByRole('switch', { name: '允许买电' }));
    expect(onAction).toHaveBeenLastCalledWith({ type: 'setGridBuy', enabled: false });
    await user.click(screen.getByRole('switch', { name: '允许卖电' }));
    expect(onAction).toHaveBeenLastCalledWith({ type: 'setGridSell', enabled: true });
  });

  it('marks the active battery and EV modes with aria-pressed', () => {
    render(<ControlPanel state={stateAt({ battery: { ...stateAt().battery, mode: 'auto' }, ev: { ...stateAt().ev, mode: 'paused' } })} onAction={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'Battery 自动' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'Battery 充电' })).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByRole('button', { name: 'EV 暂停' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'EV 充电' })).toHaveAttribute('aria-pressed', 'false');
  });

  it('exposes both Grid switch labels as full-row touch targets', () => {
    const { container } = render(<ControlPanel state={stateAt()} onAction={vi.fn()} />);
    const switchLabels = container.querySelectorAll('label.grid-switch');
    expect(switchLabels).toHaveLength(2);
    for (const label of switchLabels) {
      expect(label.querySelector('input[role="switch"]')).toBeInTheDocument();
    }
  });

  it('disables both grid switches with a visible reason when grid is closed', () => {
    render(<ControlPanel state={stateAt({ grid: { buyEnabled: true, sellEnabled: true, available: false } })} onAction={vi.fn()} />);
    expect(screen.getByRole('switch', { name: '允许买电' })).toBeDisabled();
    expect(screen.getByRole('switch', { name: '允许卖电' })).toBeDisabled();
    expect(screen.getByText('电网关闭')).toBeInTheDocument();
  });

  it('disables buying and explains insufficient money', () => {
    render(<ControlPanel state={stateAt({ resources: { money: 0, family: 100, score: 0 } })} onAction={vi.fn()} />);
    expect(screen.getByRole('switch', { name: '允许买电' })).toBeDisabled();
    expect(screen.getByText('余额不足')).toBeInTheDocument();
    expect(screen.getByRole('switch', { name: '允许卖电' })).not.toBeDisabled();
  });

  it('shows the crisis grid reopen countdown at closed-cycle boundaries', () => {
    const { rerender } = render(<ControlPanel state={stateAt({ tick: 311, grid: { buyEnabled: true, sellEnabled: true, available: false } })} onAction={vi.fn()} />);
    expect(screen.getByText('电网将在 10 秒后重新开放')).toBeInTheDocument();
    rerender(<ControlPanel state={stateAt({ tick: 320, grid: { buyEnabled: true, sellEnabled: true, available: false } })} onAction={vi.fn()} />);
    expect(screen.getByText('电网将在 1 秒后重新开放')).toBeInTheDocument();
  });

  it('uses the supplied runtime config for crisis grid countdown', () => {
    const config = { ...standardConfig, crisisStartTick: 200 };
    render(<ControlPanel state={stateAt({ tick: 211, grid: { buyEnabled: true, sellEnabled: true, available: false } })} onAction={vi.fn()} config={config} />);
    expect(screen.getByText('电网将在 10 秒后重新开放')).toBeInTheDocument();
  });

  it('associates closed-grid explanation with both switches without a live status role', () => {
    render(<ControlPanel state={stateAt({ tick: 311, grid: { buyEnabled: true, sellEnabled: true, available: false } })} onAction={vi.fn()} />);
    const reason = screen.getByText('电网将在 10 秒后重新开放');
    expect(reason).not.toHaveAttribute('role');
    expect(reason).toHaveAttribute('id');
    const reasonId = reason.getAttribute('id');
    expect(screen.getByRole('switch', { name: '允许买电' })).toHaveAttribute('aria-describedby', reasonId);
    expect(screen.getByRole('switch', { name: '允许卖电' })).toHaveAttribute('aria-describedby', reasonId);
  });
});
