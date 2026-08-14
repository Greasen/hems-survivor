import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { RiskPanel, getPrimaryRisk } from './RiskPanel';
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

  it.each([
    ['sustained outage', stateAt({ outageTicks: 10, resources: { money: 0, family: 10, score: 0 }, battery: { ...stateAt().battery, level: 10 } }), '持续断电风险'],
    ['family', stateAt({ outageTicks: 1, resources: { money: 20, family: 20, score: 0 } }), '家庭满意度即将耗尽'],
    ['event deadline', stateAt({ event: { kind: 'familyLoad', stage: 'active', startsAt: 60, endsAt: 65, allHomeSupplied: true, targetEvLevel: null }, tick: 64 }), '事件即将结束'],
    ['money', stateAt({ resources: { money: 0, family: 80, score: 0 } }), '余额为零'],
    ['battery', stateAt({ battery: { ...stateAt().battery, level: 25 } }), '电池已达储备线'],
    ['stable', stateAt(), '当前风险稳定'],
  ])('selects %s by exact priority', (_, state, expected) => {
    expect(getPrimaryRisk(state)).toBe(expected);
  });

  it('exposes risk text semantically instead of relying on color', () => {
    render(<RiskPanel state={stateAt({ outageTicks: 10 })} />);
    expect(screen.getByRole('alert')).toHaveTextContent('持续断电风险');
  });
});
