import type { EventKind, GameOverReason, ReasonEntry, UpgradeId } from '../game/types';
import { upgradeText } from '../game/upgrades';

const eventLabels: Record<EventKind, string> = {
  cloudy: '阴天',
  peakPrice: '高峰电价',
  familyLoad: '家庭负载上升',
  evEmergency: 'EV 紧急出行',
};

export const gameOverLabels: Record<GameOverReason, string> = {
  familyDepleted: '家庭满意度耗尽',
  sustainedOutage: '持续断电',
};

/** Convert structured engine reason codes into safe, user-facing Chinese text. */
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
    return detail && selected in upgradeText ? `已选择升级：${upgradeText[selected].name}` : '已选择升级';
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

export function isMilestoneReason(entry: ReasonEntry): boolean {
  return /^(eventWarning|eventStarted|eventSuccess|eventFailure|eventEnded):/.test(entry.code)
    || entry.code === 'cloudyRestored'
    || entry.code === 'priceRestored'
    || entry.code.startsWith('upgradeSelected:');
}
