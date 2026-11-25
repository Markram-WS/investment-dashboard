import { defineConfig, devices } from 'playwright/test';

/**
 * Browser acceptance for the mapped-portfolio hybrid option flow.
 *
 * The spec intercepts every `/api/**` call, so no backend or bot database is
 * required. It runs against the Vite dev server.
 */
export default defineConfig({
  testDir: './e2e',
  // Build output is already gitignored, so failure artifacts stay out of git.
  outputDir: './dist/playwright',
  fullyParallel: false,
  timeout: 30_000,
  expect: { timeout: 5_000 },
  reporter: [['list']],
  use: {
    baseURL: 'http://127.0.0.1:4173',
    trace: 'retain-on-failure',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
  webServer: {
    command: 'bun run dev -- --port 4173 --strictPort',
    url: 'http://127.0.0.1:4173',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
