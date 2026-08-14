import { describe, expect, it } from 'vitest';
import { applyUpgrade, drawUpgradeChoices } from './upgrades';
import { standardConfig } from './config';
import { stateAt } from '../test/fixtures';

describe('upgrades', () => {
  it('draws three unique unselected upgrades reproducibly', () => {
    const first = drawUpgradeChoices(stateAt({ randomState: 77 }));
    const replay = drawUpgradeChoices(stateAt({ randomState: 77 }));
    expect(first.choices).toEqual(replay.choices);
    expect(new Set(first.choices).size).toBe(3);
  });

  it('applies Battery capacity exactly once', () => {
    const once = applyUpgrade(stateAt(), 'battery_capacity', standardConfig);
    expect(once.battery).toMatchObject({ capacity: 125, level: 70 });
    expect(() => applyUpgrade(once, 'battery_capacity', standardConfig)).toThrow('Upgrade already selected');
  });

  it.each([
    ['battery_power', 'battery'],
    ['solar_optimizer', 'selectedUpgrades'],
    ['home_efficiency', 'selectedUpgrades'],
    ['ev_fast_charge', 'ev'],
    ['grid_contract', 'selectedUpgrades'],
  ] as const)('applies %s', (upgrade, _field) => {
    expect(applyUpgrade(stateAt(), upgrade, standardConfig).selectedUpgrades).toContain(upgrade);
  });

  it('applies configured Battery and EV power increases', () => {
    const battery = applyUpgrade(stateAt(), 'battery_power', standardConfig);
    const ev = applyUpgrade(stateAt(), 'ev_fast_charge', standardConfig);
    expect(battery.battery.chargePower).toBe(1.35);
    expect(battery.battery.dischargePower).toBe(1.35);
    expect(ev.ev.chargePower).toBe(0.85);
  });

  it('excludes selected upgrades but retains unselected upgrades', () => {
    const state = stateAt({ selectedUpgrades: ['battery_capacity'], randomState: 123 });
    const draw = drawUpgradeChoices(state);
    expect(draw.choices).not.toContain('battery_capacity');
    expect(draw.choices).toHaveLength(3);
  });

  it('keeps Solar, Home, and Grid upgrades as derived flags', () => {
    const solar = applyUpgrade(stateAt(), 'solar_optimizer', standardConfig);
    const home = applyUpgrade(stateAt(), 'home_efficiency', standardConfig);
    const grid = applyUpgrade(stateAt(), 'grid_contract', standardConfig);
    expect(solar.selectedUpgrades).toContain('solar_optimizer');
    expect(home.selectedUpgrades).toContain('home_efficiency');
    expect(grid.selectedUpgrades).toContain('grid_contract');
  });
});
