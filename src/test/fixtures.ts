import { standardConfig } from '../game/config';
import { createInitialState } from '../game/state';
import type { GameConfig, GameState } from '../game/types';

export function stateAt(overrides: Partial<GameState> = {}): GameState {
  const state: GameState = { ...createInitialState(12345), status: 'running', ...overrides };
  if (state.event && overrides.nextEventWarningAt === undefined) state.nextEventWarningAt = null;
  return state;
}

export function configWith(overrides: Partial<GameConfig> = {}): GameConfig {
  return { ...standardConfig, ...overrides };
}
