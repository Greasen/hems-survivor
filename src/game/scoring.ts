import type { GameConfig, GameState } from './types';

interface ResourceInput {
  unmetHome: number;
  solarDirectUse: number;
  nextTick: number;
}

export function applyTickResources(input: GameState, values: ResourceInput, config: GameConfig): GameState {
  const state = structuredClone(input);
  const familyDepletedBeforeTick = state.resources.family <= 0;
  state.tick = values.nextTick;
  state.resources.score = Math.max(
    0,
    state.resources.score + config.score.survivalPerTick + values.solarDirectUse * config.score.solarDirectPerUnit,
  );

  if (values.unmetHome > 0) {
    state.outageTicks += 1;
    state.stableTicks = 0;
    state.resources.family = Math.max(0, state.resources.family - config.family.outageLoss);
  } else if (!familyDepletedBeforeTick) {
    state.outageTicks = 0;
    state.stableTicks += 1;
    if (state.stableTicks >= config.family.stableRecoveryTicks) {
      state.resources.family = Math.min(100, state.resources.family + config.family.stableRecovery);
      state.stableTicks = 0;
    }
  } else {
    state.outageTicks = 0;
    state.stableTicks = 0;
  }

  if (state.outageTicks >= config.family.sustainedOutageTicks) {
    state.status = 'gameOver';
    state.gameOverReason = 'sustainedOutage';
  } else if (familyDepletedBeforeTick || state.resources.family <= 0) {
    state.status = 'gameOver';
    state.gameOverReason = 'familyDepleted';
  } else if (state.tick >= config.durationTicks) {
    state.status = 'victory';
    state.resources.score += config.score.victory;
  }
  return state;
}
