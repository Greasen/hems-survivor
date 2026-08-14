import { describe, expect, it } from 'vitest';
import config from './playwright.config';

describe('Playwright web server configuration', () => {
  it('always starts its own development server', () => {
    const webServer = Array.isArray(config.webServer) ? config.webServer[0] : config.webServer;
    expect(webServer && typeof webServer === 'object' ? webServer.reuseExistingServer : undefined).toBe(false);
  });
});
