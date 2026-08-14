import { describe, expect, it } from 'vitest';
import { assertValidConfig, standardConfig } from './config';
import type { GameConfig } from './types';

function configWith(mutator: (config: GameConfig) => void): GameConfig {
  const config = structuredClone(standardConfig) as GameConfig;
  mutator(config);
  return config;
}

describe('assertValidConfig', () => {
  it.each([
    ['tickMs', (config: GameConfig) => { config.tickMs = Number.NaN; }],
    ['durationTicks', (config: GameConfig) => { config.durationTicks = 0; }],
    ['crisisStartTick', (config: GameConfig) => { config.crisisStartTick = config.durationTicks; }],
    ['upgradeTicks', (config: GameConfig) => { config.upgradeTicks = [90, 90]; }],
    ['battery.initial', (config: GameConfig) => { config.battery.initial = config.battery.capacity + 1; }],
    ['battery.autoReserve', (config: GameConfig) => { config.battery.autoReserve = config.battery.capacity + 1; }],
    ['ev.initial', (config: GameConfig) => { config.ev.initial = -1; }],
    ['resources.family', (config: GameConfig) => { config.resources.family = 101; }],
    ['grid.buyPower', (config: GameConfig) => { config.grid.buyPower = -1; }],
    ['family.outageLoss', (config: GameConfig) => { config.family.outageLoss = -1; }],
    ['score.survivalPerTick', (config: GameConfig) => { config.score.survivalPerTick = Number.POSITIVE_INFINITY; }],
    ['random.solar', (config: GameConfig) => { config.random.solarMin = 2; config.random.solarMax = 1; }],
    ['eventCooldown.learning', (config: GameConfig) => { config.eventCooldown.learningMin = 61; config.eventCooldown.learningMax = 60; }],
    ['events.cloudy', (config: GameConfig) => { config.events.cloudy.duration = 0; }],
    ['eventEffects.cloudySolarMultiplier', (config: GameConfig) => { config.eventEffects.cloudySolarMultiplier = -0.1; }],
    ['upgrades.solarMultiplier', (config: GameConfig) => { config.upgrades.solarMultiplier = Number.NaN; }],
    ['phase', (config: GameConfig) => { config.phase = [{ ...config.phase[0], from: 1 }]; }],
    ['phase coverage', (config: GameConfig) => { config.phase = [...config.phase, { name: 'extra', from: 360, to: 360, solar: 0, home: 0 }]; }],
    ['random.solar', (config: GameConfig) => { config.random.solarMin = -0.1; }],
    ['upgradeTicks', (config: GameConfig) => { config.upgradeTicks = [180, 90]; }],
    ['upgradeTicks', (config: GameConfig) => { config.upgradeTicks = [30, 60, 90, 120, 150]; }],
    ['events', (config: GameConfig) => { config.events = Object.fromEntries(Object.entries(config.events).map(([kind, value]) => [kind, { ...value, warning: 10 }])) as GameConfig['events']; }],
  ] as const)('rejects invalid %s with a diagnostic field', (_field, mutate) => {
    expect(() => assertValidConfig(configWith(mutate))).toThrow(new RegExp(_field.replace('.', '\\.') + '|phase'));
  });

  it('accepts zero-valued prices, powers, phase supply, and non-negative multipliers', () => {
    const config = configWith((value) => {
      value.grid.buyPrice = 0;
      value.grid.sellPrice = 0;
      value.grid.buyPower = 0;
      value.grid.sellPower = 0;
      value.phase = value.phase.map((phase) => ({ ...phase, solar: 0, home: 0 }));
      value.upgrades.solarMultiplier = 0;
      value.upgrades.homeMultiplier = 0;
    });
    expect(() => assertValidConfig(config)).not.toThrow();
  });

  it('accepts legal fractional scores and negative home randomness', () => {
    const config = configWith((value) => {
      value.score.survivalPerTick = 0.25;
      value.score.solarDirectPerUnit = 0.125;
      value.random.homeMin = -0.25;
      value.random.homeMax = 0.25;
    });
    expect(() => assertValidConfig(config)).not.toThrow();
  });
});
