const { defineConfig } = require('@playwright/test');
module.exports = defineConfig({
  testDir: './tests',
  fullyParallel: true,
  workers: 2,
  use: { screenshot: 'only-on-failure', trace: 'retain-on-failure', browserName: 'chromium', channel: process.env.CI ? undefined : 'chrome', viewport: {width: 1200, height: 1000} },
  reporter: 'list'
});
