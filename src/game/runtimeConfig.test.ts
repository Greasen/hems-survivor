import { describe, expect, it } from 'vitest';
import { standardConfig } from './config';
import { selectRuntimeConfig } from './runtimeConfig';

describe('selectRuntimeConfig', () => {
  it('always returns production rules outside development', () => {
    expect(selectRuntimeConfig('?testMode=1&scenario=family', false)).toBe(standardConfig);
  });

  it.each([
    ['victory', 10_000, 100],
    ['family', 120, 2],
    ['outage', 120, 100],
  ] as const)('selects the %s acceptance scenario', (scenario, money, family) => {
    const config = selectRuntimeConfig(`?testMode=1&scenario=${scenario}`, true);
    expect(config.tickMs).toBe(10);
    expect(config.resources.money).toBe(money);
    expect(config.resources.family).toBe(family);
  });

  it('uses only accelerated timing for an unknown scenario', () => {
    const config = selectRuntimeConfig('?testMode=1&scenario=unknown', true);
    expect(config.tickMs).toBe(10);
    expect(config.resources).toEqual(standardConfig.resources);
  });
});
