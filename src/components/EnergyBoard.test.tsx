import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { EnergyBoard } from './EnergyBoard';
import { stateAt } from '../test/fixtures';
import { standardConfig } from '../game/config';

describe('EnergyBoard', () => {
  afterEach(cleanup);
  it('renders five labelled energy cards with one-decimal values and prices', () => {
    const state = stateAt({
      battery: { ...stateAt().battery, level: 60, capacity: 100 },
      ev: { ...stateAt().ev, level: 30, capacity: 80 },
      lastReport: { ...stateAt().lastReport, tick: 1, phase: 'safe', solar: 1, home: 1, buyPrice: 1, sellPrice: 0.6, flows: [], unmetHome: 0, outageTicks: 0, curtailed: 0, reasons: [] },
    });

    render(<EnergyBoard state={state} />);

    expect(screen.getAllByRole('region')).toHaveLength(5);
    expect(screen.getByLabelText('Solar 电量')).toHaveTextContent('1.0');
    expect(screen.getByLabelText('Home 负载')).toHaveTextContent('1.0');
    expect(screen.getByLabelText('Battery 电量')).toHaveTextContent('60.0 / 100.0');
    expect(screen.getByLabelText('EV 电量')).toHaveTextContent('30.0 / 80.0');
    expect(screen.getByLabelText('Grid 状态')).toHaveTextContent('Grid 买价 1.0');
    expect(screen.getByLabelText('Grid 状态')).toHaveTextContent('Grid 卖价 0.6');
  });

  it('renders report flows with semantic labels and shows no placeholder without a report', () => {
    const state = stateAt({
      lastReport: {
        tick: 1,
        phase: 'safe',
        solar: 1,
        home: 1,
        buyPrice: 1,
        sellPrice: 0.6,
        flows: [
          { from: 'solar', to: 'home', amount: 1 },
          { from: 'grid', to: 'battery', amount: 0.5 },
          { from: 'solar', to: 'curtailed', amount: 0.2 },
        ],
        unmetHome: 0,
        outageTicks: 0,
        curtailed: 0.2,
        reasons: [],
      },
    });
    const { rerender } = render(<EnergyBoard state={state} />);

    expect(screen.getByText('Solar → Home 1.0')).toBeInTheDocument();
    expect(screen.getByText('Grid → Battery 0.5')).toBeInTheDocument();
    expect(screen.getByText('Solar → 弃电 0.2')).toBeInTheDocument();

    rerender(<EnergyBoard state={{ ...state, lastReport: null }} />);
    expect(screen.queryByText('暂无能源流')).not.toBeInTheDocument();
  });

  it('shows selected upgrade descriptions and live power values', () => {
    const state = stateAt({
      selectedUpgrades: ['battery_power', 'ev_fast_charge'],
      battery: { ...stateAt().battery, chargePower: 1.35, dischargePower: 1.35 },
      ev: { ...stateAt().ev, chargePower: 0.85 },
    });
    render(<EnergyBoard state={state} />);
    expect(screen.getByText('高功率逆变器')).toBeInTheDocument();
    expect(screen.getByText('Battery 充放电功率各 +0.35')).toBeInTheDocument();
    expect(screen.getByText('EV 快充')).toBeInTheDocument();
    expect(screen.getByLabelText('Battery 电量')).toHaveTextContent('充电功率 1.4');
    expect(screen.getByLabelText('Battery 电量')).toHaveTextContent('放电功率 1.4');
    expect(screen.getByLabelText('EV 电量')).toHaveTextContent('充电功率 0.9');
  });

  it('uses runtime config values when rendering selected upgrade effects', () => {
    const config = {
      ...standardConfig,
      upgrades: { ...standardConfig.upgrades, batteryCapacity: 40, batteryInitialBonus: 7, batteryPower: 0.5, evPower: 0.4 },
    };
    render(<EnergyBoard state={stateAt({ selectedUpgrades: ['battery_capacity', 'battery_power', 'ev_fast_charge'] })} config={config} />);
    expect(screen.getByText('Battery 容量 +40，当前电量 +7')).toBeInTheDocument();
    expect(screen.getByText('Battery 充放电功率各 +0.5')).toBeInTheDocument();
    expect(screen.getByText('EV 充电功率 +0.4')).toBeInTheDocument();
    expect(screen.queryByText('Battery 容量 +25，当前电量 +10')).not.toBeInTheDocument();
  });

  it('places selected upgrades across the full energy board width', () => {
    const { container } = render(<EnergyBoard state={stateAt({ selectedUpgrades: ['battery_power'] })} />);
    const board = container.querySelector('.energy-board');
    const upgrades = container.querySelector('.energy-upgrades');
    expect(board).toBeInTheDocument();
    expect(upgrades).toHaveClass('energy-upgrades');
    expect(upgrades).toHaveAttribute('data-grid-span', 'full');
  });
});
