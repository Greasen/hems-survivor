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
        <span className="status-bar__value">时间 {formatTime(state.tick)}</span>
      </div>
      <div className="status-bar__item">
        <span className="status-bar__value">Money {money.toFixed(1)}</span>
      </div>
      <label className="status-bar__item" aria-label="家庭满意度">
        <span>Family</span>
        <meter min={0} max={100} value={family} />
        <strong className="status-bar__value">{family.toFixed(1)}</strong>
      </label>
      <div className="status-bar__item">
        <span className="status-bar__value">Score {Math.round(score)}</span>
      </div>
      <button type="button" onClick={onPause} aria-label="暂停游戏">
        暂停
      </button>
    </header>
  );
}
