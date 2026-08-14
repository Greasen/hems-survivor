import type { BatteryMode, EvMode, GameConfig, GameState, PlayerAction } from '../game/types';
import { standardConfig } from '../game/config';
import { getGridReopenCountdown } from './RiskPanel';

interface ControlPanelProps {
  state: GameState;
  onAction: (action: PlayerAction) => void;
  config?: GameConfig;
}

const batteryModes: readonly [BatteryMode, string][] = [
  ['charge', '充电'],
  ['auto', '自动'],
  ['discharge', '放电'],
];

const evModes: readonly [EvMode, string][] = [
  ['paused', '暂停'],
  ['charging', '充电'],
];

const gridReasonId = 'grid-control-reason';

export function ControlPanel({ state, onAction, config = standardConfig }: ControlPanelProps) {
  const gridUnavailable = !state.grid.available;
  const buyUnavailable = gridUnavailable || state.resources.money <= 0;
  const reopenIn = gridUnavailable ? getGridReopenCountdown(state, config) : null;
  const gridReason = gridUnavailable
    ? (reopenIn === null ? '电网关闭' : `电网将在 ${reopenIn} 秒后重新开放`)
    : state.resources.money <= 0 ? '余额不足' : null;

  return (
    <section className="control-panel" aria-label="能源控制">
      <fieldset>
        <legend>Battery 模式</legend>
        <div className="control-group" role="group" aria-label="Battery 模式">
          {batteryModes.map(([mode, label]) => (
            <button
              key={mode}
              type="button"
              aria-label={`Battery ${label}`}
              aria-pressed={state.battery.mode === mode}
              onClick={() => onAction({ type: 'setBatteryMode', mode })}
            >
              {label}
            </button>
          ))}
        </div>
      </fieldset>

      <fieldset>
        <legend>EV 模式</legend>
        <div className="control-group control-group--two" role="group" aria-label="EV 模式">
          {evModes.map(([mode, label]) => (
            <button
              key={mode}
              type="button"
              aria-label={`EV ${label}`}
              aria-pressed={state.ev.mode === mode}
              onClick={() => onAction({ type: 'setEvMode', mode })}
            >
              {label}
            </button>
          ))}
        </div>
      </fieldset>

      <fieldset>
        <legend>Grid 控制</legend>
        <label className="grid-switch">
          <input
            type="checkbox"
            role="switch"
            aria-label="允许买电"
            checked={state.grid.buyEnabled}
            disabled={buyUnavailable}
            aria-describedby={gridReason ? gridReasonId : undefined}
            onChange={(event) => onAction({ type: 'setGridBuy', enabled: event.target.checked })}
          />
          允许买电
        </label>
        <label className="grid-switch">
          <input
            type="checkbox"
            role="switch"
            aria-label="允许卖电"
            checked={state.grid.sellEnabled}
            disabled={gridUnavailable}
            aria-describedby={gridReason ? gridReasonId : undefined}
            onChange={(event) => onAction({ type: 'setGridSell', enabled: event.target.checked })}
          />
          允许卖电
        </label>
        {gridReason ? <p id={gridReasonId} className="disabled-reason">{gridReason}</p> : null}
      </fieldset>
    </section>
  );
}
