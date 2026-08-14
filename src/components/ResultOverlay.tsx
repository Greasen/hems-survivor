import type { GameOverReason, GameState, UpgradeId } from '../game/types';
import { upgradeText } from '../game/upgrades';

interface ResultOverlayProps {
  state: GameState;
  onRestart: () => void;
}

const gameOverLabels: Record<GameOverReason, string> = {
  familyDepleted: '家庭满意度耗尽',
  sustainedOutage: '持续断电',
};

const formatOne = (value: number): string => value.toFixed(1);

function upgradeName(upgrade: UpgradeId): string {
  return upgradeText[upgrade].name;
}

export function ResultOverlay({ state, onRestart }: ResultOverlayProps) {
  const victory = state.status === 'victory';
  const title = victory ? '胜利' : '游戏结束';
  const reason = state.gameOverReason ? gameOverLabels[state.gameOverReason] : null;

  return (
    <section className="overlay overlay--result" role="dialog" aria-modal="true" aria-labelledby="result-title">
      <h2 id="result-title">{title}</h2>
      {reason ? <><p>主要原因</p><p>{reason}</p></> : null}
      <p>Seed {state.seed}</p>
      <div className="result-metrics">
        <p>Money {formatOne(state.resources.money)}</p>
        <p>Family {formatOne(state.resources.family)}</p>
        <p>Score {Math.round(state.resources.score)}</p>
        <p>Battery {formatOne(state.battery.level)} / {formatOne(state.battery.capacity)}</p>
        <p>EV {formatOne(state.ev.level)} / {formatOne(state.ev.capacity)}</p>
      </div>
      <section aria-labelledby="selected-upgrades-title">
        <h3 id="selected-upgrades-title">已选升级</h3>
        {state.selectedUpgrades.length > 0 ? (
          <ul>
            {state.selectedUpgrades.map((upgrade) => <li key={upgrade}>{upgradeName(upgrade)}</li>)}
          </ul>
        ) : <p>暂无</p>}
      </section>
      <section aria-labelledby="key-moments-title">
        <h3 id="key-moments-title">最近关键时刻</h3>
        {state.keyMoments.length > 0 ? (
          <ul>
            {state.keyMoments.map((moment, index) => (
              <li key={`${moment.tick}-${moment.code}-${index}`}>Tick {moment.tick}：{moment.code}</li>
            ))}
          </ul>
        ) : <p>暂无</p>}
      </section>
      <button type="button" onClick={onRestart}>重新开始</button>
    </section>
  );
}

export { gameOverLabels };
