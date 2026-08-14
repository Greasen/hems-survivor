import type { GameConfig } from './types';

export const standardConfig: GameConfig = {
  tickMs: 1000,
  durationTicks: 360,
  crisisStartTick: 300,
  upgradeTicks: [90, 180, 270],
  battery: { initial: 60, capacity: 100, chargePower: 1, dischargePower: 1, autoReserve: 25 },
  ev: { initial: 30, capacity: 80, chargePower: 0.6 },
  resources: { money: 120, family: 100, score: 0 },
  grid: { buyPower: 2, sellPower: 1, buyPrice: 1, sellPrice: 0.6 },
  family: { outageLoss: 2, stableRecoveryTicks: 30, stableRecovery: 1, sustainedOutageTicks: 10 },
  score: { survivalPerTick: 1, solarDirectPerUnit: 2, familyEvent: 100, evEvent: 150, evEventMiss: 100, victory: 500 },
  random: { solarMin: 0.9, solarMax: 1.1, homeMin: -0.1, homeMax: 0.1 },
  eventCooldown: { learningMin: 45, learningMax: 60, pressureMin: 35, pressureMax: 50 },
  events: {
    cloudy: { warning: 5, duration: 25 },
    peakPrice: { warning: 10, duration: 30 },
    familyLoad: { warning: 5, duration: 25 },
    evEmergency: { warning: 5, duration: 45 },
  },
  eventEffects: {
    cloudySolarMultiplier: 0.4,
    peakBuyPrice: 2.2,
    peakSellPrice: 1.4,
    familyHomeDelta: 0.6,
    familyReward: 5,
    evTargetDelta: 15,
    evFamilyPenalty: 15,
  },
  upgrades: {
    batteryCapacity: 25,
    batteryInitialBonus: 10,
    batteryPower: 0.35,
    solarMultiplier: 1.25,
    homeMultiplier: 0.85,
    evPower: 0.25,
    gridBuyMultiplier: 0.85,
    gridSellMultiplier: 1.15,
  },
  phase: [
    { name: 'safe', from: 0, to: 59, solar: 1.4, home: 1 },
    { name: 'learning', from: 60, to: 179, solar: 1.2, home: 1.1 },
    { name: 'pressure', from: 180, to: 299, solar: 0.9, home: 1.2 },
    { name: 'crisis', from: 300, to: 359, solar: 0.5, home: 1.4 },
  ],
};

export const acceleratedConfig: GameConfig = {
  ...standardConfig,
  tickMs: 10,
};
