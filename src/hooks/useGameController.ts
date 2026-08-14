import { useCallback, useEffect, useReducer } from 'react';
import { createInitialState, dispatchAction, normalizeSeed, runTick, standardConfig } from '../game';
import { assertValidState } from '../game/state';
import type { GameConfig, GameState, PlayerAction } from '../game';

export const GAME_SESSION_STORAGE_KEY = 'hems-survivor:game-session';
export const GAME_SESSION_SCHEMA_VERSION = 1;

interface StoredGameSession {
  version: number;
  schemaVersion: number;
  state: GameState;
}

type ControllerAction = PlayerAction | { type: 'tick' };

function getStorage(): Storage | null {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return null;
    return window.localStorage;
  } catch {
    return null;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function isValidGameState(value: unknown): value is GameState {
  if (!isRecord(value)) return false;

  const statuses = ['ready', 'running', 'paused', 'choosingUpgrade', 'victory', 'gameOver'];
  const batteryModes = ['charge', 'auto', 'discharge'];
  const evModes = ['paused', 'charging'];
  const eventKinds = ['cloudy', 'peakPrice', 'familyLoad', 'evEmergency'];
  const eventStages = ['warning', 'active'];
  const upgradeIds = ['battery_capacity', 'battery_power', 'solar_optimizer', 'home_efficiency', 'ev_fast_charge', 'grid_contract'];
  const gameOverReasons = ['familyDepleted', 'sustainedOutage'];
  if (!statuses.includes(value.status as string) || !isFiniteNumber(value.tick) || !isFiniteNumber(value.seed) || !isFiniteNumber(value.randomState)) return false;
  if (!isRecord(value.battery) || !isRecord(value.ev) || !isRecord(value.grid) || !isRecord(value.resources)) return false;

  const battery = value.battery;
  const ev = value.ev;
  const grid = value.grid;
  const resources = value.resources;
  if (!isFiniteNumber(battery.level) || !isFiniteNumber(battery.capacity) || !isFiniteNumber(battery.chargePower) || !isFiniteNumber(battery.dischargePower) || !batteryModes.includes(battery.mode as string)) return false;
  if (!isFiniteNumber(ev.level) || !isFiniteNumber(ev.capacity) || !isFiniteNumber(ev.chargePower) || !evModes.includes(ev.mode as string)) return false;
  if (typeof grid.buyEnabled !== 'boolean' || typeof grid.sellEnabled !== 'boolean' || typeof grid.available !== 'boolean') return false;
  if (!isFiniteNumber(resources.money) || !isFiniteNumber(resources.family) || !isFiniteNumber(resources.score)) return false;
  if (!isFiniteNumber(value.outageTicks) || !isFiniteNumber(value.stableTicks)) return false;
  if (!Array.isArray(value.selectedUpgrades) || !value.selectedUpgrades.every((id) => typeof id === 'string' && upgradeIds.includes(id))) return false;
  if (!Array.isArray(value.pendingUpgrades) || !value.pendingUpgrades.every((id) => typeof id === 'string' && upgradeIds.includes(id))) return false;
  if (!Array.isArray(value.triggeredUpgradeTicks) || !value.triggeredUpgradeTicks.every(isFiniteNumber)) return false;
  if (value.event !== null && (!isRecord(value.event)
    || !eventKinds.includes(value.event.kind as string)
    || !eventStages.includes(value.event.stage as string)
    || !isFiniteNumber(value.event.startsAt)
    || !isFiniteNumber(value.event.endsAt)
    || typeof value.event.allHomeSupplied !== 'boolean'
    || (value.event.targetEvLevel !== null && !isFiniteNumber(value.event.targetEvLevel)))) return false;
  if (value.nextEventWarningAt !== null && !isFiniteNumber(value.nextEventWarningAt)) return false;
  if (value.lastEventKind !== null && !eventKinds.includes(value.lastEventKind as string)) return false;
  if (value.gameOverReason !== null && !gameOverReasons.includes(value.gameOverReason as string)) return false;
  if (value.lastReport !== null && !isRecord(value.lastReport)) return false;
  if (!Array.isArray(value.keyMoments)) return false;

  try {
    assertValidState(value as unknown as GameState);
  } catch {
    return false;
  }
  return true;
}

/** Read a versioned session. Malformed, stale, or unavailable storage is treated as empty. */
export function loadGameSession(): GameState | null {
  const storage = getStorage();
  if (!storage) return null;

  try {
    const raw = storage.getItem(GAME_SESSION_STORAGE_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (!isRecord(parsed) || (parsed.version !== GAME_SESSION_SCHEMA_VERSION && parsed.schemaVersion !== GAME_SESSION_SCHEMA_VERSION)) return null;
    const candidate = parsed.state;
    if (!isValidGameState(candidate)) return null;
    return candidate;
  } catch {
    return null;
  }
}

/** Persist one complete state snapshot. Storage failures never interrupt gameplay. */
export function saveGameSession(state: GameState): void {
  const storage = getStorage();
  if (!storage) return;

  try {
    const payload: StoredGameSession = {
      version: GAME_SESSION_SCHEMA_VERSION,
      schemaVersion: GAME_SESSION_SCHEMA_VERSION,
      state,
    };
    storage.setItem(GAME_SESSION_STORAGE_KEY, JSON.stringify(payload));
  } catch {
    // Private browsing, quota exhaustion, and cyclic user-provided data must not crash a run.
  }
}

function seedFromLocation(): { seed: number; explicit: boolean } {
  const fallback = Date.now() >>> 0;
  if (typeof window === 'undefined') return { seed: fallback, explicit: false };
  const params = new URLSearchParams(window.location.search);
  const explicit = params.has('seed');
  return { seed: normalizeSeed(params.get('seed'), fallback), explicit };
}

function restoreState(config: GameConfig): GameState {
  const locationSeed = seedFromLocation();
  if (!locationSeed.explicit) {
    const restored = loadGameSession();
    if (restored) {
      // A restored run never resumes on its own. Terminal states remain terminal so
      // their result screen cannot become an actionable paused run.
      if (restored.status === 'running' || restored.status === 'choosingUpgrade') {
        return { ...restored, status: 'paused' };
      }
      return restored;
    }
  }
  return createInitialState(locationSeed.seed, config);
}

function reduceGameState(state: GameState, action: ControllerAction, config: GameConfig): GameState {
  return action.type === 'tick' ? runTick(state, config) : dispatchAction(state, action, config);
}

export function useGameController(config: GameConfig = standardConfig) {
  const reducer = useCallback(
    (state: GameState, action: ControllerAction) => reduceGameState(state, action, config),
    [config],
  );
  const [state, rawDispatch] = useReducer(reducer, config, restoreState);
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

  useEffect(() => {
    saveGameSession(state);
  }, [state]);

  return { state, dispatch };
}
