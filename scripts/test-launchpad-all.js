#!/usr/bin/env node
/**
 * Run all Launchpad tests
 * Executes schema, SSRF, and manifest hash tests
 */

const { spawn } = require("child_process");
const path = require("path");

const tests = [
  { name: "Schema Validation", script: "test-launchpad-schemas.js" },
  { name: "Anti-SSRF", script: "test-launchpad-ssrf.js" },
  { name: "Manifest Hash", script: "test-launchpad-manifest-hash.js" },
];

let passed = 0;
let failed = 0;

function runTest(test) {
  return new Promise((resolve) => {
    const scriptPath = path.join(__dirname, test.script);
    console.log(`\n[${test.name}] Running ${test.script}...\n`);

    const proc = spawn("node", [scriptPath], {
      stdio: "inherit",
      cwd: __dirname,
    });

    proc.on("close", (code) => {
      if (code === 0) {
        passed++;
        console.log(`\n✓ ${test.name} passed\n`);
      } else {
        failed++;
        console.log(`\n✗ ${test.name} failed\n`);
      }
      resolve(code === 0);
    });

    proc.on("error", (err) => {
      console.error(`Failed to run ${test.name}:`, err);
      failed++;
      resolve(false);
    });
  });
}

async function runAllTests() {
  console.log("========================================");
  console.log("Launchpad Test Suite");
  console.log("========================================\n");

  for (const test of tests) {
    await runTest(test);
  }

  console.log("\n========================================");
  console.log("Summary");
  console.log("========================================");
  console.log(`Passed: ${passed}/${tests.length}`);
  console.log(`Failed: ${failed}/${tests.length}\n`);

  if (failed > 0) {
    process.exit(1);
  }
}

runAllTests().catch((err) => {
  console.error("Test runner failed:", err);
  process.exit(1);
});
