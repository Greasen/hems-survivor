import { describe, expect, it } from 'vitest';
import { nextFloat, normalizeSeed } from './random';

describe('seeded random', () => {
  it('replays the same sequence for the same seed', () => {
    const first = nextFloat(12345);
    const second = nextFloat(first.state);
    const replayFirst = nextFloat(12345);
    const replaySecond = nextFloat(replayFirst.state);
    expect([first.value, second.value]).toEqual([replayFirst.value, replaySecond.value]);
  });

  it('normalizes invalid seeds to an unsigned integer fallback', () => {
    expect(normalizeSeed('42', 9)).toBe(42);
    expect(normalizeSeed('-1', 9)).toBe(9);
    expect(normalizeSeed('not-a-number', 9)).toBe(9);
  });
});
