import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useState } from 'react';
import { stateAt } from '../test/fixtures';
import type { GameState } from '../game/types';
import { StartOverlay } from './StartOverlay';
import { UpgradeOverlay } from './UpgradeOverlay';
import { PauseOverlay } from './PauseOverlay';
import { ResultOverlay } from './ResultOverlay';
import { GameErrorBoundary } from './GameErrorBoundary';

afterEach(cleanup);

describe('StartOverlay', () => {
  it('shows only the title, three approved instructions, and start action', () => {
    render(<StartOverlay onStart={vi.fn()} />);
    expect(screen.getByRole('dialog', { name: '电量守卫' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '电量守卫' })).toBeInTheDocument();
    expect(screen.getByText('保证 Home 持续供电')).toBeInTheDocument();
    expect(screen.getByText('使用 Battery 应对供电缺口')).toBeInTheDocument();
    expect(screen.getByText('根据事件控制 EV 和 Grid')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '开始游戏' })).toBeInTheDocument();
    expect(screen.getByRole('dialog').querySelectorAll('li')).toHaveLength(3);
  });

  it('starts once when the native action is clicked', async () => {
    const onStart = vi.fn();
    const user = userEvent.setup();
    render(<StartOverlay onStart={onStart} />);
    await user.click(screen.getByRole('button', { name: '开始游戏' }));
    expect(onStart).toHaveBeenCalledOnce();
  });

  it('owns keyboard focus while open and restores the previous focus on close', async () => {
    const user = userEvent.setup();
    const background = document.createElement('button');
    background.type = 'button';
    background.textContent = '背景按钮';
    document.body.append(background);
    background.focus();

    const { unmount } = render(<StartOverlay onStart={vi.fn()} />);
    const start = screen.getByRole('button', { name: '开始游戏' });
    expect(start).toHaveFocus();
    await user.tab();
    expect(start).toHaveFocus();
    await user.tab({ shift: true });
    expect(start).toHaveFocus();
    expect(background).not.toHaveFocus();

    unmount();
    expect(background).toHaveFocus();
    background.remove();
  });
});

describe('UpgradeOverlay', () => {
  it('renders exactly the supplied three choices with their exact text', async () => {
    const onChoose = vi.fn();
    const choices = ['battery_capacity', 'solar_optimizer', 'grid_contract'] as const;
    const user = userEvent.setup();
    render(<UpgradeOverlay choices={[...choices]} onChoose={onChoose} />);
    expect(screen.getByRole('dialog', { name: '选择升级' })).toBeInTheDocument();
    expect(screen.getByText('扩容电芯')).toBeInTheDocument();
    expect(screen.getByText('Battery 容量 +25，当前电量 +10')).toBeInTheDocument();
    expect(screen.getByText('光伏优化')).toBeInTheDocument();
    expect(screen.getByText('Solar 输出永久 +25%')).toBeInTheDocument();
    expect(screen.getByText('电网合约')).toBeInTheDocument();
    expect(screen.getByText('买价 -15%，卖价 +15%')).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /选择/ })).toHaveLength(3);
    await user.click(screen.getByRole('button', { name: '选择扩容电芯' }));
    expect(onChoose).toHaveBeenCalledOnce();
    expect(onChoose).toHaveBeenCalledWith('battery_capacity');
  });

  it('locks all choices after the first rapid selection', async () => {
    const onChoose = vi.fn();
    const user = userEvent.setup();
    render(<UpgradeOverlay choices={['battery_capacity', 'solar_optimizer', 'grid_contract']} onChoose={onChoose} />);
    const buttons = screen.getAllByRole('button', { name: /选择/ });
    await user.dblClick(buttons[0]);
    await user.click(buttons[1]);
    expect(onChoose).toHaveBeenCalledOnce();
    expect(onChoose).toHaveBeenCalledWith('battery_capacity');
    expect(buttons.every((button) => button.hasAttribute('disabled'))).toBe(true);
  });
});

describe('PauseOverlay', () => {
  it('offers a resume action', async () => {
    const onResume = vi.fn();
    const user = userEvent.setup();
    render(<PauseOverlay onResume={onResume} />);
    expect(screen.getByRole('dialog', { name: '游戏已暂停' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '继续游戏' }));
    expect(onResume).toHaveBeenCalledOnce();
  });
});

describe('ResultOverlay', () => {
  it('summarizes victory with status, seed, resources, upgrades, moments, and restart', async () => {
    const onRestart = vi.fn();
    const user = userEvent.setup();
    const state = stateAt({
      status: 'victory',
      seed: 42,
      tick: 360,
      battery: { level: 73.456, capacity: 100, chargePower: 1, dischargePower: 1, mode: 'auto' },
      ev: { level: 44.444, capacity: 80, chargePower: 0.6, mode: 'paused' },
      resources: { money: 98.765, family: 88.888, score: 123.4 },
      selectedUpgrades: ['battery_capacity', 'grid_contract'],
      keyMoments: [
        { code: 'eventSuccess:familyLoad', tick: 123 },
        { code: 'moneySpent', amount: -2.4, tick: 124 },
        { code: 'upgradeSelected:battery_capacity', tick: 125 },
      ],
    });
    render(<ResultOverlay state={state} onRestart={onRestart} />);
    expect(screen.getByRole('dialog', { name: '胜利' })).toBeInTheDocument();
    expect(screen.getByText('胜利')).toBeInTheDocument();
    expect(screen.getByText('Seed 42')).toBeInTheDocument();
    expect(screen.getByText('Money 98.8')).toBeInTheDocument();
    expect(screen.getByText('Family 88.9')).toBeInTheDocument();
    expect(screen.getByText('Score 123')).toBeInTheDocument();
    expect(screen.getByText('扩容电芯')).toBeInTheDocument();
    expect(screen.getByText('电网合约')).toBeInTheDocument();
    expect(screen.getByText(/最近关键时刻/)).toBeInTheDocument();
    expect(screen.getByText(/家庭负载上升成功/)).toBeInTheDocument();
    expect(screen.getByText(/支付电费/)).toBeInTheDocument();
    expect(screen.getByText(/已选择升级：扩容电芯/)).toBeInTheDocument();
    expect(screen.queryByText('eventSuccess:familyLoad')).not.toBeInTheDocument();
    expect(screen.queryByText('moneySpent')).not.toBeInTheDocument();
    expect(screen.queryByText('upgradeSelected:battery_capacity')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '重新开始' }));
    expect(onRestart).toHaveBeenCalledOnce();
  });

  it('shows a mapped Game Over reason and formatted energy values', () => {
    const state: GameState = stateAt({
      status: 'gameOver',
      gameOverReason: 'sustainedOutage',
      battery: { level: 1.234, capacity: 100, chargePower: 1, dischargePower: 1, mode: 'auto' },
      ev: { level: 2.345, capacity: 80, chargePower: 0.6, mode: 'paused' },
    });
    render(<ResultOverlay state={state} onRestart={vi.fn()} />);
    expect(screen.getByRole('dialog', { name: '游戏结束' })).toBeInTheDocument();
    expect(screen.getByText('持续断电')).toBeInTheDocument();
    expect(screen.getByText('Battery 1.2 / 100.0')).toBeInTheDocument();
    expect(screen.getByText('EV 2.3 / 80.0')).toBeInTheDocument();
  });
});

describe('GameErrorBoundary', () => {
  function BrokenChild(): never {
    throw new Error('broken state');
  }

  it('offers a clean restart after an unrecoverable render error', async () => {
    const onRestart = vi.fn();
    const onError = vi.fn();
    const user = userEvent.setup();
    render(<GameErrorBoundary onRestart={onRestart} onError={onError}><BrokenChild /></GameErrorBoundary>);
    expect(screen.getByRole('heading', { name: '游戏状态异常' })).toBeInTheDocument();
    expect(screen.getByText('游戏已暂停，请重新开始本局。')).toBeInTheDocument();
    expect(onError).toHaveBeenCalledOnce();
    expect(onError).toHaveBeenCalledWith(expect.objectContaining({ message: 'broken state' }));
    await user.click(screen.getByRole('button', { name: '重新开始' }));
    expect(onRestart).toHaveBeenCalledOnce();
  });

  it('recovers to a healthy child and reports the initial error only once', async () => {
    function HealthyChild() {
      return <p>健康状态</p>;
    }

    function Harness() {
      const [healthy, setHealthy] = useState(false);
      const onRestart = () => setHealthy(true);
      return (
        <GameErrorBoundary onRestart={onRestart} onError={onError}>
          {healthy ? <HealthyChild /> : <BrokenChild />}
        </GameErrorBoundary>
      );
    }

    const onError = vi.fn();
    const user = userEvent.setup();
    render(<Harness />);
    expect(screen.getByRole('heading', { name: '游戏状态异常' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '重新开始' }));
    expect(screen.getByText('健康状态')).toBeInTheDocument();
    expect(screen.queryByRole('dialog', { name: '游戏状态异常' })).not.toBeInTheDocument();
    expect(onError).toHaveBeenCalledOnce();
  });
});
