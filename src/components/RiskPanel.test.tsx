import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { RiskPanel } from './RiskPanel';
import { stateAt } from '../test/fixtures';
import { standardConfig } from '../game/config';

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

  it('renders family depletion above outage when both risks are present', () => {
    render(<RiskPanel state={stateAt({ outageTicks: 10, resources: { money: 0, family: 20, score: 0 }, battery: { ...stateAt().battery, level: 10 }, event: { kind: 'familyLoad', stage: 'active', startsAt: 60, endsAt: 65, allHomeSupplied: true, targetEvLevel: null }, tick: 64 })} />);
    expect(screen.getByRole('alert')).toHaveTextContent('家庭满意度即将耗尽');
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

  it('shows the exact sustained-outage countdown for every positive outage tick', () => {
    const config = { ...standardConfig, family: { ...standardConfig.family, sustainedOutageTicks: 10, }, battery: { ...standardConfig.battery, autoReserve: 40 } };
    const { rerender } = render(<RiskPanel state={stateAt({ outageTicks: 1 })} config={config} />);
    expect(screen.getByText('距持续断电失败 9 秒')).toHaveAttribute('aria-hidden', 'true');
    rerender(<RiskPanel state={stateAt({ outageTicks: 9 })} config={config} />);
    expect(screen.getByText('距持续断电失败 1 秒')).toHaveAttribute('aria-hidden', 'true');
  });

  it('uses custom reserve and crisis thresholds', () => {
    const config = { ...standardConfig, crisisStartTick: 200, battery: { ...standardConfig.battery, autoReserve: 40 } };
    render(<RiskPanel state={stateAt({ tick: 211, battery: { ...stateAt().battery, level: 40 }, grid: { buyEnabled: true, sellEnabled: true, available: false } })} config={config} />);
    expect(screen.getByRole('alert')).toHaveTextContent('电池已达储备线');
    expect(screen.getByText('电网将在 10 秒后重新开放')).toBeInTheDocument();
  });

  it('only shows deadline risk for unsatisfied family or EV active objectives', () => {
    const base = { resources: { money: 0, family: 80, score: 0 }, battery: { ...stateAt().battery, level: 50 }, tick: 64 };
    const { rerender } = render(<RiskPanel state={stateAt({ ...base, event: { kind: 'cloudy', stage: 'active', startsAt: 60, endsAt: 65, allHomeSupplied: true, targetEvLevel: null } })} />);
    expect(screen.getByRole('alert')).toHaveTextContent('余额为零');
    rerender(<RiskPanel state={stateAt({ ...base, event: { kind: 'familyLoad', stage: 'active', startsAt: 60, endsAt: 65, allHomeSupplied: true, targetEvLevel: null } })} />);
    expect(screen.getByRole('alert')).toHaveTextContent('事件即将结束');
    rerender(<RiskPanel state={stateAt({ ...base, event: { kind: 'familyLoad', stage: 'active', startsAt: 60, endsAt: 65, allHomeSupplied: false, targetEvLevel: null } })} />);
    expect(screen.getByRole('alert')).toHaveTextContent('余额为零');
  });

  it('keeps the latest milestone as Chinese live feedback after settlement and upgrade selection', () => {
    const { rerender } = render(<RiskPanel state={stateAt({ keyMoments: [{ code: 'eventEnded:cloudy', tick: 90 }, { code: 'cloudyRestored', tick: 90 }] })} />);
    expect(screen.getByLabelText('最近反馈')).toHaveTextContent('阴天影响恢复');
    rerender(<RiskPanel state={stateAt({ keyMoments: [{ code: 'upgradeSelected:battery_power', tick: 125 }] })} />);
    expect(screen.getByLabelText('最近反馈')).toHaveTextContent('已选择升级：高功率逆变器');
    expect(screen.getByLabelText('最近反馈')).not.toHaveTextContent('upgradeSelected');
  });

  it('prioritizes family depletion above the outage countdown', () => {
    render(<RiskPanel state={stateAt({ outageTicks: 1, resources: { money: 80, family: 20, score: 0 } })} />);
    expect(screen.getByRole('alert')).toHaveTextContent('家庭满意度即将耗尽');
    expect(screen.getByText('距持续断电失败 9 秒')).toHaveAttribute('aria-hidden', 'true');
  });

  it('uses a stable outage alert while hiding changing countdown numbers from assistive announcements', () => {
    render(<RiskPanel state={stateAt({ outageTicks: 1 })} />);
    expect(screen.getByRole('alert')).toHaveTextContent('持续断电风险，请立即恢复供电');
    expect(screen.getByRole('alert')).not.toHaveTextContent('距持续断电失败');
    expect(screen.getByText('距持续断电失败 9 秒')).toHaveAttribute('aria-hidden', 'true');
  });

  it('selects the outcome milestone over ending and upgrade milestones on the same tick', () => {
    const { rerender } = render(<RiskPanel state={stateAt({ keyMoments: [
      { code: 'eventEnded:familyLoad', tick: 100 },
      { code: 'eventSuccess:familyLoad', tick: 100 },
      { code: 'upgradeSelected:battery_power', tick: 100 },
    ] })} />);
    expect(screen.getByLabelText('最近反馈')).toHaveTextContent('家庭负载上升成功');
    expect(screen.getByLabelText('最近反馈')).not.toHaveTextContent('eventSuccess');
    rerender(<RiskPanel state={stateAt({ keyMoments: [
      { code: 'eventEnded:evEmergency', tick: 101 },
      { code: 'eventFailure:evEmergency', tick: 101 },
      { code: 'upgradeSelected:ev_fast_charge', tick: 101 },
    ] })} />);
    expect(screen.getByLabelText('最近反馈')).toHaveTextContent('EV 紧急出行未完成');
    expect(screen.getByLabelText('最近反馈')).not.toHaveTextContent('eventFailure');
  });
});
