import { defineConfig, devices } from '@playwright/test';
const selected = (process.env.BROWSERS ?? 'chromium,firefox,webkit').split(',');
export default defineConfig({
  testDir: './tests/browser', timeout: 30000, fullyParallel: true,
  workers: process.env.CI ? 2 : 4, retries: 0,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: { baseURL: 'http://127.0.0.1:4173/siftbar/', trace: 'retain-on-failure' },
  projects: selected.map(name => ({ name, use: { ...devices[name === 'chromium' ? 'Desktop Chrome' : name === 'firefox' ? 'Desktop Firefox' : 'Desktop Safari'] } })),
  webServer: { command: 'node scripts/serve.mjs', url: 'http://127.0.0.1:4173/siftbar/', reuseExistingServer: !process.env.CI },
});
