import type { EventKind, GameOverReason, GameState, ReasonEntry, UpgradeId } from '../game/types';
import { upgradeText } from '../game/upgrades';

interface ResultOverlayProps {
  state: GameState;
  onRestart: () => void;
}

const gameOverLabels: Record<GameOverReason, string> = {
  familyDepleted: '家庭满意度耗尽',
  sustainedOutage: '持续断电',
};

const eventLabels: Record<EventKind, string> = {
  cloudy: '阴天',
  peakPrice: '高峰电价',
  familyLoad: '家庭负载上升',
  evEmergency: 'EV 紧急出行',
};

const formatOne = (value: number): string => value.toFixed(1);

function upgradeName(upgrade: UpgradeId): string {
  return upgradeText[upgrade].name;
}

/** Convert engine reason codes into safe, user-facing Chinese text. */
export function formatReason(entry: ReasonEntry): string {
  const [prefix, detail] = entry.code.split(':', 2);
  const event = detail && detail in eventLabels ? eventLabels[detail as EventKind] : null;
  const amount = entry.amount === undefined ? null : Math.abs(entry.amount).toFixed(1);

  if (prefix === 'eventWarning' && event) return `${event}预警`;
  if (prefix === 'eventStarted' && event) return `${event}开始`;
  if (prefix === 'eventSuccess' && event) return `${event}成功`;
  if (prefix === 'eventFailure' && event) return `${event}未完成`;
  if (prefix === 'eventEnded' && event) return `${event}结束`;
  if (entry.code === 'cloudyRestored') return '阴天影响恢复';
  if (entry.code === 'priceRestored') return '电价恢复';
  if (prefix === 'gameOver') return detail && detail in gameOverLabels ? `游戏结束：${gameOverLabels[detail as GameOverReason]}` : '游戏结束';
  if (prefix === 'upgradeSelected') {
    const selected = detail as UpgradeId;
    return detail && selected in upgradeText ? `已选择升级：${upgradeName(selected)}` : '已选择升级';
  }
  if (entry.code === 'upgradeAvailable') return '升级可用';
  if (entry.code === 'victory') return '达成胜利';
  if (entry.code === 'homeUnmet') return `Home 供电不足${amount ? ` ${amount}` : ''}`;
  if (entry.code === 'solarCurtailed') return `Solar 弃电${amount ? ` ${amount}` : ''}`;
  if (entry.code === 'moneySpent') return `支付电费${amount ? ` ${amount}` : ''}`;
  if (entry.code === 'moneyEarned') return `售电收入${amount ? ` +${amount}` : ''}`;
  if (entry.code === 'familyLost') return `家庭满意度下降${amount ? ` ${amount}` : ''}`;
  if (entry.code === 'familyRecovered') return `家庭满意度恢复${amount ? ` +${amount}` : ''}`;
  if (entry.code === 'scoreGained') return `分数增加${amount ? ` +${amount}` : ''}`;
  if (entry.code === 'scoreLost') return `分数减少${amount ? ` ${amount}` : ''}`;
  return '状态变化';
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
              <li key={`${moment.tick}-${moment.code}-${index}`}>Tick {moment.tick}：{formatReason(moment)}</li>
            ))}
          </ul>
        ) : <p>暂无</p>}
      </section>
      <button type="button" onClick={onRestart}>重新开始</button>
    </section>
  );
}

export { gameOverLabels };
