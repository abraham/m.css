import { defineConfig, devices } from "@playwright/test";

const port = 8181;

export default defineConfig({
  testDir: "tests",
  // Baselines come only from the Linux Playwright container (npm run test:visual), so no platform suffix.
  snapshotPathTemplate: "{testDir}/__screenshots__/{projectName}/{arg}{ext}",
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: `http://localhost:${port}`,
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "firefox", use: { ...devices["Desktop Firefox"] } },
    { name: "webkit", use: { ...devices["Desktop Safari"] } },
  ],
  webServer: {
    command: "node scripts/dev.js",
    url: `http://localhost:${port}/demo/`,
    reuseExistingServer: !process.env.CI,
    env: { PORT: String(port) },
  },
});
