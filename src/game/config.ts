import type { GameConfig } from './types';

function invalid(path: string, message: string): never {
  throw new Error(`Invalid config: ${path} ${message}`);
}

function finite(path: string, value: number): void {
  if (!Number.isFinite(value)) invalid(path, 'must be finite');
}

function nonNegative(path: string, value: number): void {
  finite(path, value);
  if (value < 0) invalid(path, 'must be non-negative');
}

function integer(path: string, value: number): void {
  finite(path, value);
  if (!Number.isInteger(value)) invalid(path, 'must be an integer');
}

function bounded(path: string, value: number, min: number, max: number): void {
  finite(path, value);
  if (value < min || value > max) invalid(path, `must be between ${min} and ${max}`);
}

function range(path: string, values: { min: number; max: number }, options: { nonNegative?: boolean } = {}): void {
  if (options.nonNegative) nonNegative(`${path}.min`, values.min);
  else finite(`${path}.min`, values.min);
  if (options.nonNegative) nonNegative(`${path}.max`, values.max);
  else finite(`${path}.max`, values.max);
  if (values.min > values.max) invalid(path, 'min must not exceed max');
}

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

/** Validate immutable game rules at a public orchestration boundary. */
export function assertValidConfig(config: GameConfig): void {
  finite('tickMs', config.tickMs);
  if (config.tickMs <= 0) invalid('tickMs', 'must be greater than 0');
  integer('durationTicks', config.durationTicks);
  if (config.durationTicks <= 0) invalid('durationTicks', 'must be greater than 0');
  integer('crisisStartTick', config.crisisStartTick);
  if (config.crisisStartTick < 0 || config.crisisStartTick >= config.durationTicks) {
    invalid('crisisStartTick', `must be between 0 and ${config.durationTicks - 1}`);
  }

  const upgradeTicks = config.upgradeTicks;
  if (upgradeTicks.length > 4) invalid('upgradeTicks', 'must contain at most 4 trigger ticks');
  if (new Set(upgradeTicks).size !== upgradeTicks.length) invalid('upgradeTicks', 'must not contain duplicates');
  upgradeTicks.forEach((tick, index) => {
    integer(`upgradeTicks[${index}]`, tick);
    if (tick <= 0 || tick >= config.durationTicks) invalid(`upgradeTicks[${index}]`, 'is outside the run');
    if (index > 0 && tick <= upgradeTicks[index - 1]) invalid(`upgradeTicks[${index}]`, 'must be strictly increasing');
  });

  finite('battery.capacity', config.battery.capacity);
  if (config.battery.capacity <= 0) invalid('battery.capacity', 'must be greater than 0');
  bounded('battery.initial', config.battery.initial, 0, config.battery.capacity);
  nonNegative('battery.chargePower', config.battery.chargePower);
  nonNegative('battery.dischargePower', config.battery.dischargePower);
  bounded('battery.autoReserve', config.battery.autoReserve, 0, config.battery.capacity);

  finite('ev.capacity', config.ev.capacity);
  if (config.ev.capacity <= 0) invalid('ev.capacity', 'must be greater than 0');
  bounded('ev.initial', config.ev.initial, 0, config.ev.capacity);
  nonNegative('ev.chargePower', config.ev.chargePower);

  nonNegative('resources.money', config.resources.money);
  bounded('resources.family', config.resources.family, 0, 100);
  nonNegative('resources.score', config.resources.score);

  nonNegative('grid.buyPower', config.grid.buyPower);
  nonNegative('grid.sellPower', config.grid.sellPower);
  nonNegative('grid.buyPrice', config.grid.buyPrice);
  nonNegative('grid.sellPrice', config.grid.sellPrice);

  bounded('family.outageLoss', config.family.outageLoss, 0, 100);
  integer('family.stableRecoveryTicks', config.family.stableRecoveryTicks);
  if (config.family.stableRecoveryTicks <= 0) invalid('family.stableRecoveryTicks', 'must be greater than 0');
  bounded('family.stableRecovery', config.family.stableRecovery, 0, 100);
  integer('family.sustainedOutageTicks', config.family.sustainedOutageTicks);
  if (config.family.sustainedOutageTicks <= 0 || config.family.sustainedOutageTicks > config.durationTicks) {
    invalid('family.sustainedOutageTicks', 'is outside the run bounds');
  }

  const scoreEntries: Array<[string, number]> = Object.entries(config.score) as Array<[string, number]>;
  for (const [path, value] of scoreEntries) nonNegative(`score.${path}`, value);

  range('random.solar', { min: config.random.solarMin, max: config.random.solarMax }, { nonNegative: true });
  range('random.home', { min: config.random.homeMin, max: config.random.homeMax });
  range('eventCooldown.learning', { min: config.eventCooldown.learningMin, max: config.eventCooldown.learningMax }, { nonNegative: true });
  range('eventCooldown.pressure', { min: config.eventCooldown.pressureMin, max: config.eventCooldown.pressureMax }, { nonNegative: true });

  for (const kind of ['cloudy', 'peakPrice', 'familyLoad', 'evEmergency'] as const) {
    integer(`events.${kind}.warning`, config.events[kind].warning);
    nonNegative(`events.${kind}.warning`, config.events[kind].warning);
    integer(`events.${kind}.duration`, config.events[kind].duration);
    if (config.events[kind].duration <= 0) invalid(`events.${kind}.duration`, 'must be greater than 0');
  }
  if (config.crisisStartTick > 55 && !(['cloudy', 'peakPrice', 'familyLoad', 'evEmergency'] as const).some((kind) => config.events[kind].warning === 5)) {
    invalid('events', 'at least one event warning must equal 5 for the first event pool');
  }

  const effectEntries: Array<[string, number]> = Object.entries(config.eventEffects) as Array<[string, number]>;
  for (const [path, value] of effectEntries) nonNegative(`eventEffects.${path}`, value);
  const upgradeEntries: Array<[string, number]> = Object.entries(config.upgrades) as Array<[string, number]>;
  for (const [path, value] of upgradeEntries) nonNegative(`upgrades.${path}`, value);

  if (!Array.isArray(config.phase) || config.phase.length === 0) invalid('phase', 'must not be empty');
  let expectedFrom = 0;
  config.phase.forEach((phase, index) => {
    const path = `phase[${index}]`;
    if (typeof phase.name !== 'string' || phase.name.trim() === '') invalid(`${path}.name`, 'must not be empty');
    integer(`${path}.from`, phase.from);
    integer(`${path}.to`, phase.to);
    if (phase.from !== expectedFrom) invalid(`${path}.from`, `must be ${expectedFrom} for a contiguous timeline`);
    if (phase.to < phase.from) invalid(`${path}.to`, 'must not precede from');
    nonNegative(`${path}.solar`, phase.solar);
    nonNegative(`${path}.home`, phase.home);
    expectedFrom = phase.to + 1;
  });
  if (expectedFrom !== config.durationTicks) invalid('phase', `must cover exactly ticks 0..${config.durationTicks - 1}`);
}
