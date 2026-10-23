import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir:"./tests/browser",timeout:60000,expect:{timeout:30000},fullyParallel:false,workers:1,
  reporter:"list",use:{baseURL:process.env.TEST_BASE_URL||"http://localhost:5173",channel:"chrome",headless:true,screenshot:"only-on-failure",trace:"retain-on-failure"},
  outputDir:".sites-runtime/test-results",
});
