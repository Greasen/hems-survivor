import type { EnergyFlow, EnergyResult, FlowNode, GameConfig, GameState, TickEnvironment } from './types';

const EPSILON = 0.000001;
const clean = (value: number) => Math.abs(value) < EPSILON ? 0 : value;

export function settleEnergy(input: GameState, config: GameConfig, environment: TickEnvironment): EnergyResult {
  const state = structuredClone(input);
  const flows: EnergyFlow[] = [];
  let solar = environment.solar;
  let home = environment.home;
  let batteryChargeBudget = state.battery.chargePower;
  let batteryDischargeBudget = Math.min(state.battery.dischargePower, state.battery.level);
  let gridBuyBudget = state.grid.available && state.grid.buyEnabled ? config.grid.buyPower : 0;
  let gridSellBudget = state.grid.available && state.grid.sellEnabled ? config.grid.sellPower : 0;
  let bought = 0;
  let sold = 0;
  let solarDirectUse = 0;

  const flow = (from: FlowNode, to: FlowNode, amount: number) => {
    const normalized = clean(amount);
    if (normalized > 0) flows.push({ from, to, amount: normalized });
    return normalized;
  };
  const buy = (target: 'home' | 'battery' | 'ev', wanted: number) => {
    if (bought > 0 || sold === 0) {
      const affordable = environment.buyPrice > 0 ? state.resources.money / environment.buyPrice : wanted;
      const amount = Math.min(wanted, gridBuyBudget, affordable);
      if (amount > 0) {
        flow('grid', target, amount);
        gridBuyBudget -= amount;
        bought += amount;
        state.resources.money -= amount * environment.buyPrice;
      }
      return amount;
    }
    return 0;
  };

  const solarToHome = Math.min(solar, home);
  flow('solar', 'home', solarToHome);
  solarDirectUse += solarToHome;
  solar -= solarToHome;
  home -= solarToHome;

  if (home > 0 && (state.battery.mode === 'auto' || state.battery.mode === 'discharge')) {
    const reserve = state.battery.mode === 'auto' ? config.battery.autoReserve : 0;
    const available = Math.max(0, state.battery.level - reserve);
    const amount = Math.min(home, batteryDischargeBudget, available);
    flow('battery', 'home', amount);
    state.battery.level -= amount;
    batteryDischargeBudget -= amount;
    home -= amount;
  }

  if (home > 0) home -= buy('home', home);
  const unmetHome = clean(home);

  if (solar > 0 && state.battery.mode !== 'discharge') {
    const amount = Math.min(solar, batteryChargeBudget, state.battery.capacity - state.battery.level);
    flow('solar', 'battery', amount);
    state.battery.level += amount;
    batteryChargeBudget -= amount;
    solar -= amount;
  }

  if (state.battery.mode === 'charge' && batteryChargeBudget > 0 && state.battery.level < state.battery.capacity) {
    const amount = buy('battery', Math.min(batteryChargeBudget, state.battery.capacity - state.battery.level));
    state.battery.level += amount;
    batteryChargeBudget -= amount;
  }

  if (state.ev.mode === 'charging' && state.ev.level < state.ev.capacity) {
    let wanted = Math.min(state.ev.chargePower, state.ev.capacity - state.ev.level);
    const fromSolar = Math.min(solar, wanted);
    flow('solar', 'ev', fromSolar);
    solarDirectUse += fromSolar;
    solar -= fromSolar;
    wanted -= fromSolar;
    state.ev.level += fromSolar;
    if (wanted > 0 && state.battery.mode === 'discharge') {
      const fromBattery = Math.min(wanted, batteryDischargeBudget, state.battery.level);
      flow('battery', 'ev', fromBattery);
      batteryDischargeBudget -= fromBattery;
      state.battery.level -= fromBattery;
      state.ev.level += fromBattery;
      wanted -= fromBattery;
    }
    if (wanted > 0) {
      const fromGrid = buy('ev', wanted);
      state.ev.level += fromGrid;
    }
  }

  if (bought === 0 && gridSellBudget > 0) {
    const solarSold = Math.min(solar, gridSellBudget);
    flow('solar', 'grid', solarSold);
    solar -= solarSold;
    gridSellBudget -= solarSold;
    sold += solarSold;
    if (state.battery.mode === 'discharge' && gridSellBudget > 0) {
      const batterySold = Math.min(gridSellBudget, batteryDischargeBudget, state.battery.level);
      flow('battery', 'grid', batterySold);
      state.battery.level -= batterySold;
      sold += batterySold;
    }
    state.resources.money += sold * environment.sellPrice;
  }

  const curtailed = clean(solar);
  flow('solar', 'curtailed', curtailed);
  state.battery.level = clean(Math.min(state.battery.capacity, Math.max(0, state.battery.level)));
  state.ev.level = clean(Math.min(state.ev.capacity, Math.max(0, state.ev.level)));
  state.resources.money = clean(Math.max(0, state.resources.money));
  return { state, flows, unmetHome, curtailed, bought, sold, solarDirectUse };
}
