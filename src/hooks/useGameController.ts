import { useCallback, useEffect, useReducer } from 'react';
import { createInitialState, dispatchAction, normalizeSeed, runTick, standardConfig } from '../game';
import type { GameConfig, GameState, PlayerAction } from '../game';

type ControllerAction = PlayerAction | { type: 'tick' };

function initialState(config: GameConfig): GameState {
  const fallback = Date.now() >>> 0;
  const rawSeed = typeof window === 'undefined' ? null : new URLSearchParams(window.location.search).get('seed');
  return createInitialState(normalizeSeed(rawSeed, fallback), config);
}

function reduceGameState(state: GameState, action: ControllerAction, config: GameConfig): GameState {
  return action.type === 'tick' ? runTick(state, config) : dispatchAction(state, action, config);
}

export function useGameController(config: GameConfig = standardConfig) {
  const reducer = useCallback(
    (state: GameState, action: ControllerAction) => reduceGameState(state, action, config),
    [config],
  );
  const [state, rawDispatch] = useReducer(reducer, config, initialState);
  const dispatch = useCallback((action: PlayerAction) => rawDispatch(action), [rawDispatch]);

  useEffect(() => {
    if (state.status !== 'running') return undefined;
    const interval = window.setInterval(() => rawDispatch({ type: 'tick' }), config.tickMs);
    return () => window.clearInterval(interval);
  }, [config.tickMs, rawDispatch, state.status]);

  useEffect(() => {
    const onVisibility = () => {
      if (document.hidden) rawDispatch({ type: 'pause' });
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, [rawDispatch]);

  return { state, dispatch };
}
