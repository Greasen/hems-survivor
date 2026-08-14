import { standardConfig } from '../game/config';
import { createInitialState } from '../game/state';
import type { GameConfig, GameState } from '../game/types';

export function stateAt(overrides: Partial<GameState> = {}): GameState {
  return { ...createInitialState(12345), status: 'running', ...overrides };
}

export function configWith(overrides: Partial<GameConfig> = {}): GameConfig {
  return { ...standardConfig, ...overrides };
}
