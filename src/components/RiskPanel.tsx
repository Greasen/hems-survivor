import type { EventKind, GameState } from '../game/types';
import { standardConfig } from '../game/config';

interface RiskPanelProps {
  state: GameState;
}

/** Returns seconds until the next open settlement during the final crisis, or null when not in a closed cycle. */
export function getGridReopenCountdown(state: GameState, crisisStartTick = standardConfig.crisisStartTick): number | null {
  if (state.grid.available) return null;
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

export function getPrimaryRisk(state: GameState): string {
  if (state.outageTicks >= 10) return '持续断电风险';
  if (state.resources.family <= 20) return '家庭满意度即将耗尽';
  const eventRemaining = state.event ? state.event.endsAt - state.tick : null;
  const evSatisfied = state.event?.kind === 'evEmergency' && state.event.targetEvLevel !== null && state.ev.level >= state.event.targetEvLevel;
  if (!evSatisfied && eventRemaining !== null && state.event?.stage === 'active' && eventRemaining > 0 && eventRemaining <= 5) return '事件即将结束';
  if (state.resources.money <= 0) return '余额为零';
  if (state.battery.level <= 25) return '电池已达储备线';
  return '当前风险稳定';
}

function eventTiming(state: GameState): string {
  const event = state.event;
  if (!event) return '暂无事件';
  if (event.stage === 'warning') return `将在 ${Math.max(0, event.startsAt - state.tick)} 秒后开始`;
  return `剩余 ${Math.max(0, event.endsAt - state.tick)} 秒`;
}

export function RiskPanel({ state }: RiskPanelProps) {
  const risk = getPrimaryRisk(state);
  const riskRole = risk === '当前风险稳定' ? 'status' : 'alert';
  const evSatisfied = state.event?.kind === 'evEmergency' && state.event.targetEvLevel !== null && state.ev.level >= state.event.targetEvLevel;
  const gridReopenIn = getGridReopenCountdown(state);

  return (
    <section className="risk-panel" aria-label="事件与风险">
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
      <p className="risk-panel__primary-risk" role={riskRole}>{risk}</p>
    </section>
  );
}
