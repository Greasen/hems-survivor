import type { EventKind, GameConfig, GameState } from '../game/types';
import { standardConfig } from '../game/config';
import { isEvTargetSatisfied } from '../game/events';
import { formatReason, isMilestoneReason } from './reasonText';

interface RiskPanelProps {
  state: GameState;
  config?: GameConfig;
}

/** Returns seconds until the next open settlement during the final crisis, or null when not in a closed cycle. */
export function getGridReopenCountdown(state: GameState, configOrCrisis: GameConfig | number = standardConfig): number | null {
  if (state.grid.available) return null;
  const crisisStartTick = typeof configOrCrisis === 'number' ? configOrCrisis : configOrCrisis.crisisStartTick;
  const phaseIndex = state.tick - 1;
  if (phaseIndex < crisisStartTick) return null;
  const offset = (phaseIndex - crisisStartTick) % 20;
  if (offset < 10) return null;
  return 20 - offset;
}

const eventLabels: Record<EventKind, string> = {
  cloudy: '阴天',
  peakPrice: '高峰电价',
  familyLoad: '家庭负载上升',
  evEmergency: 'EV 紧急出行',
};

export function getPrimaryRisk(state: GameState, config: GameConfig = standardConfig): string {
  if (state.resources.family <= 20) return '家庭满意度即将耗尽';
  if (state.outageTicks > 0) return `距持续断电失败 ${Math.max(0, config.family.sustainedOutageTicks - state.outageTicks)} 秒`;
  const eventRemaining = state.event ? state.event.endsAt - state.tick : null;
  const event = state.event;
  const familyDeadline = event?.kind === 'familyLoad' && event.allHomeSupplied;
  const evSatisfied = event?.kind === 'evEmergency' && event.targetEvLevel !== null && isEvTargetSatisfied(state.ev.level, event.targetEvLevel);
  const evDeadline = event?.kind === 'evEmergency' && event.targetEvLevel !== null && !evSatisfied;
  if ((familyDeadline || evDeadline) && eventRemaining !== null && event?.stage === 'active' && eventRemaining >= 0 && eventRemaining <= 5) return '事件即将结束';
  if (state.resources.money <= 0) return '余额为零';
  if (state.battery.level <= config.battery.autoReserve) return '电池已达储备线';
  return '当前风险稳定';
}

function eventTiming(state: GameState): string {
  const event = state.event;
  if (!event) return '暂无事件';
  if (event.stage === 'warning') return `将在 ${Math.max(0, event.startsAt - state.tick)} 秒后开始`;
  return `剩余 ${Math.max(0, event.endsAt - state.tick)} 秒`;
}

function milestonePriority(code: string): number {
  if (code.startsWith('eventFailure:')) return 6;
  if (code.startsWith('eventSuccess:')) return 5;
  if (code.startsWith('upgradeSelected:')) return 4;
  if (code.startsWith('eventStarted:')) return 3;
  if (code.startsWith('eventWarning:')) return 2;
  if (code === 'cloudyRestored' || code === 'priceRestored') return 1;
  if (code.startsWith('eventEnded:')) return 0;
  return -1;
}

function latestMilestone(state: GameState) {
  const milestones = state.keyMoments.filter(isMilestoneReason);
  if (milestones.length === 0) return undefined;
  const latestTick = Math.max(...milestones.map((entry) => entry.tick));
  return milestones
    .filter((entry) => entry.tick === latestTick)
    .sort((a, b) => milestonePriority(b.code) - milestonePriority(a.code))[0];
}

export function RiskPanel({ state, config = standardConfig }: RiskPanelProps) {
  const risk = getPrimaryRisk(state, config);
  const riskRole = risk === '当前风险稳定' ? 'status' : 'alert';
  const outageCountdown = state.outageTicks > 0;
  const evSatisfied = state.event?.kind === 'evEmergency' && state.event.targetEvLevel !== null && isEvTargetSatisfied(state.ev.level, state.event.targetEvLevel);
  const gridReopenIn = getGridReopenCountdown(state, config);
  const latestFeedback = latestMilestone(state);

  return (
    <section className={`risk-panel${riskRole === 'alert' ? ' risk-panel--alert' : ''}`} aria-label="事件与风险">
      <div className="risk-panel__event" aria-label="当前事件">
        <h2>事件</h2>
        {state.event ? (
          <>
            <p>{eventLabels[state.event.kind]}</p>
            <p>{evSatisfied ? '已满足' : state.event.stage === 'warning' ? '预警' : '进行中'}</p>
            <p>{eventTiming(state)}</p>
          </>
        ) : <p>暂无事件</p>}
      </div>
      {gridReopenIn !== null ? <p aria-label="危机电网">电网将在 {gridReopenIn} 秒后重新开放</p> : null}
      <p className="risk-panel__outage" aria-label="连续断电时间">连续断电 {state.outageTicks} 秒</p>
      {outageCountdown ? <p className="risk-panel__primary-risk" aria-hidden="true">{`距持续断电失败 ${Math.max(0, config.family.sustainedOutageTicks - state.outageTicks)} 秒`}</p> : null}
      {outageCountdown && risk === `距持续断电失败 ${Math.max(0, config.family.sustainedOutageTicks - state.outageTicks)} 秒` ? (
        <p className="sr-only" role="alert">持续断电风险，请立即恢复供电</p>
      ) : null}
      {(!outageCountdown || risk !== `距持续断电失败 ${Math.max(0, config.family.sustainedOutageTicks - state.outageTicks)} 秒`) ? (
        <p className="risk-panel__primary-risk" role={riskRole}>{risk}</p>
      ) : null}
      <p aria-label="最近反馈" aria-live="polite">最近反馈：{latestFeedback ? formatReason(latestFeedback) : '暂无'}</p>
    </section>
  );
}
