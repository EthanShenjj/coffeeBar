import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  use: { baseURL: "http://127.0.0.1:3100", trace: "on-first-retry" },
  webServer: { command: "npm start -- --port 3100", url: "http://127.0.0.1:3100", reuseExistingServer: false },
  projects: [
    { name: "mobile", use: { ...devices["iPhone 13"] } },
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
  ],
});
