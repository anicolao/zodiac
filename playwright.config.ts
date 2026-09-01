import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  workers: 1,
  forbidOnly: true,
  retries: 0,
  reporter: [['html', { open: 'never' }]],
  use: {
    baseURL: 'http://127.0.0.1:4191',
    trace: 'retain-on-failure',
    serviceWorkers: 'block',
    deviceScaleFactor: 1,
    timezoneId: 'America/Toronto',
    locale: 'en-CA',
    reducedMotion: 'reduce',
    actionTimeout: 30000,
    launchOptions: {
      args: [
        '--font-render-hinting=none',
        '--disable-font-subpixel-positioning',
        '--disable-lcd-text',
        '--force-device-scale-factor=1',
        '--disable-gpu',
        '--use-gl=swiftshader'
      ]
    }
  },
  snapshotPathTemplate: '{testDir}/{testFileDir}/screenshots/{arg}{ext}',
  projects: [
    {
      name: 'phone',
      use: { browserName: 'chromium', viewport: { width: 393, height: 852 } }
    },
    {
      name: 'desktop',
      testMatch: '**/002-responsive-pwa/*.spec.ts',
      use: { browserName: 'chromium', viewport: { width: 1280, height: 1000 } }
    }
  ],
  webServer: {
    command: 'npm run build && npm run preview',
    url: 'http://127.0.0.1:4191',
    reuseExistingServer: false,
    env: {
      ...process.env,
      VITE_GIT_HASH: 'e2e-test-build'
    }
  },
  timeout: 300000,
  expect: {
    timeout: 30000,
    toHaveScreenshot: {
      maxDiffPixels: 0,
      animations: 'disabled',
      caret: 'hide',
      fullPage: true,
      scale: 'css'
    }
  }
});
