import type { GameState } from '../game/types';

interface StatusBarProps {
  state: GameState;
  onPause: () => void;
}

function formatTime(tick: number): string {
  const minutes = Math.floor(Math.max(0, tick) / 60);
  const seconds = Math.max(0, tick) % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

export function StatusBar({ state, onPause }: StatusBarProps) {
  const { money, family, score } = state.resources;

  return (
    <header className="status-bar">
      <div className="status-bar__item">
        <span>时间 {formatTime(state.tick)}</span>
      </div>
      <div className="status-bar__item">
        <span>Money {money}</span>
      </div>
      <label className="status-bar__item" aria-label="家庭满意度">
        <span>Family</span>
        <meter min={0} max={100} value={family} />
        <strong>{family}</strong>
      </label>
      <div className="status-bar__item">
        <span>Score {score}</span>
      </div>
      <button type="button" onClick={onPause} aria-label="暂停游戏">
        暂停
      </button>
    </header>
  );
}
