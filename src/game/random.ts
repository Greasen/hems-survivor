export interface RandomResult { value: number; state: number }

export function normalizeSeed(raw: string | null, fallback: number): number {
  if (raw === null || !/^\d+$/.test(raw)) return fallback >>> 0;
  const parsed = Number(raw);
  return Number.isSafeInteger(parsed) && parsed >= 0 ? parsed >>> 0 : fallback >>> 0;
}

export function nextFloat(state: number): RandomResult {
  let value = state >>> 0;
  value += 0x6d2b79f5;
  let mixed = value;
  mixed = Math.imul(mixed ^ (mixed >>> 15), mixed | 1);
  mixed ^= mixed + Math.imul(mixed ^ (mixed >>> 7), mixed | 61);
  return { value: ((mixed ^ (mixed >>> 14)) >>> 0) / 4294967296, state: value >>> 0 };
}

export function randomBetween(state: number, min: number, max: number): RandomResult {
  const next = nextFloat(state);
  return { value: min + (max - min) * next.value, state: next.state };
}
