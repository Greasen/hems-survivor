import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { RiskPanel } from './RiskPanel';
import { stateAt } from '../test/fixtures';

describe('RiskPanel', () => {
  afterEach(cleanup);

  it('renders event label, stage, and tick-based remaining time', () => {
    const state = stateAt({ tick: 62, event: { kind: 'cloudy', stage: 'active', startsAt: 60, endsAt: 85, allHomeSupplied: true, targetEvLevel: null } });
    render(<RiskPanel state={state} />);
    expect(screen.getByText('阴天')).toBeInTheDocument();
    expect(screen.getByText('进行中')).toBeInTheDocument();
    expect(screen.getByText('剩余 23 秒')).toBeInTheDocument();
  });

  it('shows warning countdown and outage seconds', () => {
    const state = stateAt({ tick: 57, outageTicks: 4, event: { kind: 'peakPrice', stage: 'warning', startsAt: 60, endsAt: 90, allHomeSupplied: true, targetEvLevel: null } });
    render(<RiskPanel state={state} />);
    expect(screen.getByText('高峰电价')).toBeInTheDocument();
    expect(screen.getByText('预警')).toBeInTheDocument();
    expect(screen.getByText('将在 3 秒后开始')).toBeInTheDocument();
    expect(screen.getByText('连续断电 4 秒')).toBeInTheDocument();
  });

  it('shows EV emergency as satisfied and does not report its deadline risk', () => {
    const state = stateAt({ tick: 64, event: { kind: 'evEmergency', stage: 'active', startsAt: 60, endsAt: 65, allHomeSupplied: true, targetEvLevel: 45 }, ev: { ...stateAt().ev, level: 45 - 2.84e-14 } });
    render(<RiskPanel state={state} />);
    expect(screen.getByText('已满足')).toBeInTheDocument();
    expect(screen.queryByText('事件即将结束')).not.toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('当前风险稳定');
  });

  it('keeps an EV emergency unsatisfied when it exceeds epsilon', () => {
    render(<RiskPanel state={stateAt({ tick: 64, event: { kind: 'evEmergency', stage: 'active', startsAt: 60, endsAt: 65, allHomeSupplied: true, targetEvLevel: 45 }, ev: { ...stateAt().ev, level: 45 - 1.1e-6 } })} />);
    expect(screen.getByText('进行中')).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent('事件即将结束');
  });

  it('shows crisis grid reopen countdown when the current grid is closed', () => {
    render(<RiskPanel state={stateAt({ tick: 311, grid: { buyEnabled: true, sellEnabled: true, available: false } })} />);
    expect(screen.getByText('电网将在 10 秒后重新开放')).toBeInTheDocument();
  });

  it('renders sustained outage above every lower-priority risk', () => {
    render(<RiskPanel state={stateAt({ outageTicks: 10, resources: { money: 0, family: 20, score: 0 }, battery: { ...stateAt().battery, level: 10 }, event: { kind: 'familyLoad', stage: 'active', startsAt: 60, endsAt: 65, allHomeSupplied: true, targetEvLevel: null }, tick: 64 })} />);
    expect(screen.getByRole('alert')).toHaveTextContent('持续断电风险');
  });

  it('renders family risk above deadline, money, and battery risks', () => {
    render(<RiskPanel state={stateAt({ outageTicks: 1, resources: { money: 0, family: 20, score: 0 }, battery: { ...stateAt().battery, level: 25 }, event: { kind: 'familyLoad', stage: 'active', startsAt: 60, endsAt: 65, allHomeSupplied: true, targetEvLevel: null }, tick: 64 })} />);
    expect(screen.getByRole('alert')).toHaveTextContent('家庭满意度即将耗尽');
  });

  it('renders an unsatisfied event deadline above money and battery risks', () => {
    render(<RiskPanel state={stateAt({ resources: { money: 0, family: 80, score: 0 }, battery: { ...stateAt().battery, level: 25 }, event: { kind: 'familyLoad', stage: 'active', startsAt: 60, endsAt: 65, allHomeSupplied: true, targetEvLevel: null }, tick: 64 })} />);
    expect(screen.getByRole('alert')).toHaveTextContent('事件即将结束');
  });

  it('renders money risk above battery reserve risk', () => {
    render(<RiskPanel state={stateAt({ resources: { money: 0, family: 80, score: 0 }, battery: { ...stateAt().battery, level: 25 } })} />);
    expect(screen.getByRole('alert')).toHaveTextContent('余额为零');
  });

  it('renders battery reserve risk as an alert', () => {
    render(<RiskPanel state={stateAt({ battery: { ...stateAt().battery, level: 25 } })} />);
    expect(screen.getByRole('alert')).toHaveTextContent('电池已达储备线');
  });

  it('renders stable risk as a status', () => {
    render(<RiskPanel state={stateAt()} />);
    expect(screen.getByRole('status')).toHaveTextContent('当前风险稳定');
  });

  it('marks the panel as alert only when the primary risk is not stable', () => {
    const view = render(<RiskPanel state={stateAt({ outageTicks: 10 })} />);
    expect(view.container.querySelector('.risk-panel')).toHaveClass('risk-panel--alert');

    view.rerender(<RiskPanel state={stateAt()} />);
    expect(view.container.querySelector('.risk-panel')).not.toHaveClass('risk-panel--alert');
  });

  it('exposes risk text semantically instead of relying on color', () => {
    render(<RiskPanel state={stateAt({ outageTicks: 10 })} />);
    expect(screen.getByRole('alert')).toHaveTextContent('持续断电风险');
  });
});
