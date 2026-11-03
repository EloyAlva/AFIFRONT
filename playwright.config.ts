import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  use: {
    baseURL: "http://localhost:3100",
    headless: true,
    trace: "retain-on-failure",
  },
  webServer: {
    command: "node node_modules/next/dist/bin/next dev --port 3100",
    url: "http://localhost:3100",
    reuseExistingServer: false,
    timeout: 60000,
    env: {
      NEXT_PUBLIC_SUPABASE_URL: "https://afi-test.supabase.co",
      NEXT_PUBLIC_SUPABASE_ANON_KEY: "test-public-key",
      NEXT_PUBLIC_API_URL: "http://localhost:4000/api/v1",
    },
  },
});
