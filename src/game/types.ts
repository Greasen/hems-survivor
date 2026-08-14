export type RunStatus = 'ready' | 'running' | 'paused' | 'choosingUpgrade' | 'victory' | 'gameOver';
export type BatteryMode = 'charge' | 'auto' | 'discharge';
export type EvMode = 'paused' | 'charging';
export type EventKind = 'cloudy' | 'peakPrice' | 'familyLoad' | 'evEmergency';
export type EventStage = 'warning' | 'active';
export type UpgradeId =
  | 'battery_capacity'
  | 'battery_power'
  | 'solar_optimizer'
  | 'home_efficiency'
  | 'ev_fast_charge'
  | 'grid_contract';
export type GameOverReason = 'familyDepleted' | 'sustainedOutage';
export type FlowNode = 'solar' | 'home' | 'battery' | 'ev' | 'grid' | 'curtailed';

export interface GameConfig {
  tickMs: number;
  durationTicks: number;
  crisisStartTick: number;
  upgradeTicks: readonly number[];
  battery: { initial: number; capacity: number; chargePower: number; dischargePower: number; autoReserve: number };
  ev: { initial: number; capacity: number; chargePower: number };
  resources: { money: number; family: number; score: number };
  grid: { buyPower: number; sellPower: number; buyPrice: number; sellPrice: number };
  family: { outageLoss: number; stableRecoveryTicks: number; stableRecovery: number; sustainedOutageTicks: number };
  score: { survivalPerTick: number; solarDirectPerUnit: number; familyEvent: number; evEvent: number; evEventMiss: number; victory: number };
  random: { solarMin: number; solarMax: number; homeMin: number; homeMax: number };
  eventCooldown: { learningMin: number; learningMax: number; pressureMin: number; pressureMax: number };
  events: Record<EventKind, { warning: number; duration: number }>;
  eventEffects: {
    cloudySolarMultiplier: number;
    peakBuyPrice: number;
    peakSellPrice: number;
    familyHomeDelta: number;
    familyReward: number;
    evTargetDelta: number;
    evFamilyPenalty: number;
  };
  upgrades: {
    batteryCapacity: number;
    batteryInitialBonus: number;
    batteryPower: number;
    solarMultiplier: number;
    homeMultiplier: number;
    evPower: number;
    gridBuyMultiplier: number;
    gridSellMultiplier: number;
  };
  phase: readonly { name: string; from: number; to: number; solar: number; home: number }[];
}

export interface BatteryState { level: number; capacity: number; chargePower: number; dischargePower: number; mode: BatteryMode }
export interface EvState { level: number; capacity: number; chargePower: number; mode: EvMode }
export interface GridState { buyEnabled: boolean; sellEnabled: boolean; available: boolean }
export interface ResourceState { money: number; family: number; score: number }
export interface EventRuntime {
  kind: EventKind;
  stage: EventStage;
  startsAt: number;
  endsAt: number;
  allHomeSupplied: boolean;
  targetEvLevel: number | null;
}
export interface EventModifiers {
  solarMultiplier: number;
  homeDelta: number;
  buyPrice: number | null;
  sellPrice: number | null;
}
export interface EnergyFlow { from: FlowNode; to: FlowNode; amount: number }
export interface TickEnvironment { solar: number; home: number; buyPrice: number; sellPrice: number }
export interface EnergyResult {
  state: GameState;
  flows: EnergyFlow[];
  unmetHome: number;
  curtailed: number;
  bought: number;
  sold: number;
  solarDirectUse: number;
}
export interface ReasonEntry { code: string; amount?: number; tick: number }
export interface TickReport {
  tick: number;
  phase: string;
  solar: number;
  home: number;
  buyPrice: number;
  sellPrice: number;
  flows: EnergyFlow[];
  unmetHome: number;
  curtailed: number;
  reasons: ReasonEntry[];
}
export interface GameState {
  status: RunStatus;
  tick: number;
  seed: number;
  randomState: number;
  battery: BatteryState;
  ev: EvState;
  grid: GridState;
  resources: ResourceState;
  outageTicks: number;
  stableTicks: number;
  event: EventRuntime | null;
  nextEventWarningAt: number | null;
  lastEventKind: EventKind | null;
  selectedUpgrades: UpgradeId[];
  pendingUpgrades: UpgradeId[];
  triggeredUpgradeTicks: number[];
  gameOverReason: GameOverReason | null;
  lastReport: TickReport | null;
  keyMoments: ReasonEntry[];
}
export type PlayerAction =
  | { type: 'start' }
  | { type: 'pause' }
  | { type: 'resume' }
  | { type: 'restart'; seed: number }
  | { type: 'setBatteryMode'; mode: BatteryMode }
  | { type: 'setEvMode'; mode: EvMode }
  | { type: 'setGridBuy'; enabled: boolean }
  | { type: 'setGridSell'; enabled: boolean }
  | { type: 'chooseUpgrade'; upgrade: UpgradeId };
