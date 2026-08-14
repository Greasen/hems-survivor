import { acceleratedConfig, standardConfig } from './config';
import type { GameConfig } from './types';

const zeroSupplyPhase = standardConfig.phase.map((phase) => ({ ...phase, solar: 0, home: 2 }));

const scenarios: Record<string, GameConfig> = {
  victory: {
    ...standardConfig,
    tickMs: 10,
    battery: { ...standardConfig.battery, initial: standardConfig.battery.capacity },
    resources: { ...standardConfig.resources, money: 10_000 },
  },
  family: {
    ...standardConfig,
    tickMs: 10,
    battery: { ...standardConfig.battery, initial: 0 },
    resources: { ...standardConfig.resources, family: 2 },
    grid: { ...standardConfig.grid, buyPower: 0 },
    phase: zeroSupplyPhase,
  },
  outage: {
    ...standardConfig,
    tickMs: 10,
    battery: { ...standardConfig.battery, initial: 0 },
    grid: { ...standardConfig.grid, buyPower: 0 },
    phase: zeroSupplyPhase,
  },
};

export function selectRuntimeConfig(search: string, isDev: boolean): GameConfig {
  if (!isDev) return standardConfig;
  const params = new URLSearchParams(search);
  if (params.get('testMode') !== '1') return standardConfig;
  return scenarios[params.get('scenario') ?? ''] ?? acceleratedConfig;
}
