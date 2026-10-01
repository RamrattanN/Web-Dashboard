const { defineConfig } = require('@playwright/test');
module.exports = defineConfig({
  testDir: './tests',
  fullyParallel: true,
  use: { browserName: 'chromium', channel: process.env.CI ? undefined : 'chrome', viewport: {width: 1200, height: 1000} },
  reporter: 'list'
});
