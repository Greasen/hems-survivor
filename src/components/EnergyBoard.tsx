import type { GameState, FlowNode } from '../game/types';

interface EnergyBoardProps {
  state: GameState;
}

const labels: Record<FlowNode, string> = {
  solar: 'Solar',
  home: 'Home',
  battery: 'Battery',
  ev: 'EV',
  grid: 'Grid',
  curtailed: '弃电',
};

const formatValue = (value: number): string => value.toFixed(1);

export function EnergyBoard({ state }: EnergyBoardProps) {
  const report = state.lastReport;
  const solar = report?.solar;
  const home = report?.home;
  const buyPrice = report?.buyPrice;
  const sellPrice = report?.sellPrice;

  return (
    <div className="energy-board" aria-label="能源总览">
      <section className="energy-card energy-card--solar" aria-label="Solar 电量">
        <h2>Solar</h2>
        <p>{solar === undefined ? '—' : formatValue(solar)}</p>
      </section>
      <section className="energy-card energy-card--home" aria-label="Home 负载">
        <h2>Home</h2>
        <p>{home === undefined ? '—' : formatValue(home)}</p>
      </section>
      <section className="energy-card energy-card--battery" aria-label="Battery 电量">
        <h2>Battery</h2>
        <p>{formatValue(state.battery.level)} / {formatValue(state.battery.capacity)}</p>
        <p>模式 {state.battery.mode}</p>
      </section>
      <section className="energy-card energy-card--ev" aria-label="EV 电量">
        <h2>EV</h2>
        <p>{formatValue(state.ev.level)} / {formatValue(state.ev.capacity)}</p>
        <p>模式 {state.ev.mode}</p>
      </section>
      <section className="energy-card energy-card--grid" aria-label="Grid 状态">
        <h2>Grid</h2>
        <p>Grid 买价 {buyPrice === undefined ? '—' : formatValue(buyPrice)}</p>
        <p>Grid 卖价 {sellPrice === undefined ? '—' : formatValue(sellPrice)}</p>
        <p>{state.grid.available ? '电网可用' : '电网关闭'}</p>
      </section>
      {report && report.flows.length > 0 ? (
        <ul className="energy-flows" aria-label="能源流向">
          {report.flows.map((flow, index) => (
            <li key={`${flow.from}-${flow.to}-${index}`}>
              {labels[flow.from]} → {labels[flow.to]} {formatValue(flow.amount)}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
