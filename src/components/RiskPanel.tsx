import type { EventKind, GameState } from '../game/types';

interface RiskPanelProps {
  state: GameState;
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
  if (eventRemaining !== null && state.event?.stage === 'active' && eventRemaining > 0 && eventRemaining <= 5) return '事件即将结束';
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

  return (
    <section className="risk-panel" aria-label="事件与风险">
      <div className="risk-panel__event" aria-label="当前事件">
        <h2>事件</h2>
        {state.event ? (
          <>
            <p>{eventLabels[state.event.kind]}</p>
            <p>{state.event.stage === 'warning' ? '预警' : '进行中'}</p>
            <p>{eventTiming(state)}</p>
          </>
        ) : <p>暂无事件</p>}
      </div>
      <p className="risk-panel__outage" aria-label="连续断电时间">连续断电 {state.outageTicks} 秒</p>
      <p className="risk-panel__primary-risk" role={riskRole}>{risk}</p>
    </section>
  );
}
