import { standardConfig } from './config';
import type { GameConfig, GameState } from './types';

export function createInitialState(seed: number, config: GameConfig = standardConfig): GameState {
  const normalized = seed >>> 0;
  return {
    status: 'ready',
    tick: 0,
    seed: normalized,
    randomState: normalized,
    battery: {
      level: config.battery.initial,
      capacity: config.battery.capacity,
      chargePower: config.battery.chargePower,
      dischargePower: config.battery.dischargePower,
      mode: 'auto',
    },
    ev: { level: config.ev.initial, capacity: config.ev.capacity, chargePower: config.ev.chargePower, mode: 'paused' },
    grid: { buyEnabled: true, sellEnabled: false, available: true },
    resources: { ...config.resources },
    outageTicks: 0,
    stableTicks: 0,
    event: null,
    nextEventWarningAt: 55,
    lastEventKind: null,
    selectedUpgrades: [],
    pendingUpgrades: [],
    triggeredUpgradeTicks: [],
    gameOverReason: null,
    lastReport: null,
    keyMoments: [],
  };
}

export function assertValidState(state: GameState): void {
  const numbers = [state.battery.level, state.battery.capacity, state.ev.level, state.ev.capacity, state.resources.money, state.resources.family, state.resources.score];
  if (numbers.some((value) => !Number.isFinite(value))) throw new Error('Game state contains a non-finite number');
  if (state.battery.level < 0 || state.battery.level > state.battery.capacity) throw new Error('Battery is outside capacity');
  if (state.ev.level < 0 || state.ev.level > state.ev.capacity) throw new Error('EV is outside capacity');
  if (state.resources.money < 0 || state.resources.family < 0 || state.resources.family > 100 || state.resources.score < 0) throw new Error('Resource is outside bounds');
}
