import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests",
  timeout: 30_000,
  retries: 0,
  use: {
    baseURL: "http://localhost:5173/mortgage-viz/",
    trace: "off",
  },
  reporter: [["list"]],
});
