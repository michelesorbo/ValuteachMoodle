import { randomBytes } from "node:crypto";
import path from "node:path";
import { defineConfig } from "@playwright/test";

/**
 * End-to-end tests run against a production build (`pnpm e2e:server`) on its own port,
 * database and storage directory, so they never touch the development data.
 * Requirements: the development PostgreSQL (`pnpm db:up`) and Google Chrome — the
 * Chromium bundled with Playwright cannot play H.264 video, which the video test needs.
 */
const PORT = 3100;
const baseURL = `http://localhost:${PORT}`;

// One random password per run, shared with the server process that seeds the test users.
process.env.E2E_PASSWORD ??= randomBytes(12).toString("hex");
process.env.E2E_SCORM_ORIGIN = `http://scorm.localhost:${PORT}`;

export default defineConfig({
  testDir: "tests/e2e",
  testMatch: "**/*.spec.ts",
  // The specs build on each other's data (courses, enrollments), so they run in order.
  fullyParallel: false,
  workers: 1,
  timeout: 60_000,
  reporter: [["list"]],
  use: {
    baseURL,
    channel: process.env.E2E_BROWSER_CHANNEL ?? "chrome",
    locale: "it-IT",
    trace: "retain-on-failure",
  },
  webServer: {
    command: "pnpm e2e:server",
    url: `${baseURL}/login`,
    timeout: 300_000,
    reuseExistingServer: false,
    stdout: "pipe",
    env: {
      PORT: String(PORT),
      HOSTNAME: "0.0.0.0",
      DATABASE_URL: "postgres://newlms:newlms@localhost:5433/newlms_e2e",
      BETTER_AUTH_SECRET: randomBytes(32).toString("hex"),
      BETTER_AUTH_URL: baseURL,
      SCORM_ORIGIN: process.env.E2E_SCORM_ORIGIN,
      FILES_DIR: path.resolve("data/e2e-files"),
      E2E_PASSWORD: process.env.E2E_PASSWORD,
    },
  },
});
