import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: false,
  retries: 0,
  timeout: 60000,
  use: {
    permissions: ["microphone"],
    launchOptions: {
      args: [
        "--use-fake-ui-for-media-stream",
        "--use-fake-device-for-media-stream",
        "--use-file-for-fake-audio-capture=tests/fixtures/synthetic_voice_input.wav",
      ],
    },
  },
  webServer: [
    {
      command: "npx tsx src/index.ts",
      cwd: "apps/server",
      port: 3001,
      reuseExistingServer: true,
    },
    {
      command: "npx vite --port 3002",
      cwd: "apps/desktop",
      port: 3002,
      reuseExistingServer: true,
    },
  ],
});
