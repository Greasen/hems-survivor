import { nextFloat } from './random';
import type { GameConfig, GameState, UpgradeId } from './types';

export const upgradeIds: readonly UpgradeId[] = [
  'battery_capacity',
  'battery_power',
  'solar_optimizer',
  'home_efficiency',
  'ev_fast_charge',
  'grid_contract',
];

export const upgradeText: Record<UpgradeId, { name: string; description: string }> = {
  battery_capacity: { name: '扩容电芯', description: 'Battery 容量 +25，当前电量 +10' },
  battery_power: { name: '高功率逆变器', description: 'Battery 充放电功率各 +0.35' },
  solar_optimizer: { name: '光伏优化', description: 'Solar 输出永久 +25%' },
  home_efficiency: { name: '家庭节能', description: 'Home 负载永久 -15%' },
  ev_fast_charge: { name: 'EV 快充', description: 'EV 充电功率 +0.25' },
  grid_contract: { name: '电网合约', description: '买价 -15%，卖价 +15%' },
};

function formatUpgradeNumber(value: number): string {
  return Number.isInteger(value) ? String(value) : String(Number(value.toFixed(2)));
}

/** Render an upgrade's actual configured effect for the live status board. */
export function upgradeEffectText(upgrade: UpgradeId, config: GameConfig): string {
  switch (upgrade) {
    case 'battery_capacity':
      return `Battery 容量 +${formatUpgradeNumber(config.upgrades.batteryCapacity)}，当前电量 +${formatUpgradeNumber(config.upgrades.batteryInitialBonus)}`;
    case 'battery_power':
      return `Battery 充放电功率各 +${formatUpgradeNumber(config.upgrades.batteryPower)}`;
    case 'solar_optimizer':
      return `Solar 输出永久 +${formatUpgradeNumber((config.upgrades.solarMultiplier - 1) * 100)}%`;
    case 'home_efficiency':
      return `Home 负载永久 -${formatUpgradeNumber((1 - config.upgrades.homeMultiplier) * 100)}%`;
    case 'ev_fast_charge':
      return `EV 充电功率 +${formatUpgradeNumber(config.upgrades.evPower)}`;
    case 'grid_contract':
      return `买价 -${formatUpgradeNumber((1 - config.upgrades.gridBuyMultiplier) * 100)}%，卖价 +${formatUpgradeNumber((config.upgrades.gridSellMultiplier - 1) * 100)}%`;
  }
}

export function hasUpgrade(state: GameState, upgrade: UpgradeId): boolean {
  return state.selectedUpgrades.includes(upgrade);
}

export function drawUpgradeChoices(state: GameState): { choices: UpgradeId[]; randomState: number } {
  const available = upgradeIds.filter((upgrade) => !hasUpgrade(state, upgrade));
  let randomState = state.randomState;

  for (let index = available.length - 1; index > 0; index -= 1) {
    const random = nextFloat(randomState);
    randomState = random.state;
    const swapIndex = Math.floor(random.value * (index + 1));
    [available[index], available[swapIndex]] = [available[swapIndex], available[index]];
  }

  return { choices: available.slice(0, 3), randomState };
}

export function applyUpgrade(state: GameState, upgrade: UpgradeId, config: GameConfig): GameState {
  if (hasUpgrade(state, upgrade)) throw new Error('Upgrade already selected');

  const next: GameState = {
    ...state,
    battery: { ...state.battery },
    ev: { ...state.ev },
    grid: { ...state.grid },
    resources: { ...state.resources },
    selectedUpgrades: [...state.selectedUpgrades, upgrade],
    pendingUpgrades: [...state.pendingUpgrades],
    triggeredUpgradeTicks: [...state.triggeredUpgradeTicks],
    keyMoments: [...state.keyMoments],
  };

  switch (upgrade) {
    case 'battery_capacity':
      next.battery.capacity += config.upgrades.batteryCapacity;
      next.battery.level = Math.min(next.battery.capacity, next.battery.level + config.upgrades.batteryInitialBonus);
      break;
    case 'battery_power':
      next.battery.chargePower += config.upgrades.batteryPower;
      next.battery.dischargePower += config.upgrades.batteryPower;
      break;
    case 'ev_fast_charge':
      next.ev.chargePower += config.upgrades.evPower;
      break;
    case 'solar_optimizer':
    case 'home_efficiency':
    case 'grid_contract':
      break;
  }

  return next;
}
