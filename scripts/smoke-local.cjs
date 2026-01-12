#!/usr/bin/env node
/**
 * Self-contained smoke test runner.
 * Starts local AJV dev server, waits for it to be ready, runs smoke tests, then stops the server.
 */

const { spawn } = require('child_process');
const http = require('http');
const path = require('path');

const SERVER_PORT = 8888;
const SERVER_SCRIPT = path.join(__dirname, 'dev-server.cjs');
const HEALTH_CHECK_URL = `http://127.0.0.1:${SERVER_PORT}/api/v0/scan`;
const TIMEOUT_MS = 15000;
const POLL_INTERVAL_MS = 500;

let serverProcess = null;

function cleanup() {
  if (serverProcess) {
    console.log('[smoke-local] Stopping server...');
    serverProcess.kill('SIGTERM');
    serverProcess = null;
  }
}

// Ensure cleanup on exit
process.on('SIGINT', () => {
  cleanup();
  process.exit(1);
});
process.on('SIGTERM', () => {
  cleanup();
  process.exit(1);
});
process.on('exit', cleanup);

/**
 * Wait for server to be ready by polling a lightweight endpoint.
 */
function waitForServer() {
  return new Promise((resolve, reject) => {
    const startTime = Date.now();

    function check() {
      const req = http.request(
        {
          hostname: '127.0.0.1',
          port: SERVER_PORT,
          path: '/api/v0/scan',
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          timeout: 2000,
        },
        (res) => {
          // Any response (even 400) means server is up
          resolve();
        }
      );

      req.on('error', () => {
        const elapsed = Date.now() - startTime;
        if (elapsed >= TIMEOUT_MS) {
          reject(new Error(`Server did not start within ${TIMEOUT_MS}ms`));
        } else {
          setTimeout(check, POLL_INTERVAL_MS);
        }
      });

      req.on('timeout', () => {
        req.destroy();
        const elapsed = Date.now() - startTime;
        if (elapsed >= TIMEOUT_MS) {
          reject(new Error(`Server did not start within ${TIMEOUT_MS}ms`));
        } else {
          setTimeout(check, POLL_INTERVAL_MS);
        }
      });

      req.end(JSON.stringify({ rawTransaction: 'AQAAAAAAAAAAAAAA' }));
    }

    check();
  });
}

/**
 * Start the dev server.
 */
function startServer() {
  return new Promise((resolve, reject) => {
    console.log(`[smoke-local] Starting server on port ${SERVER_PORT}...`);

    serverProcess = spawn('node', [SERVER_SCRIPT], {
      env: { ...process.env, PORT: String(SERVER_PORT) },
      stdio: 'inherit',
      shell: false,
    });

    serverProcess.on('error', (err) => {
      reject(new Error(`Failed to start server: ${err.message}`));
    });

    // Wait a bit for server to initialize
    setTimeout(() => {
      waitForServer()
        .then(() => {
          console.log(`[smoke-local] Server is ready on port ${SERVER_PORT}`);
          resolve();
        })
        .catch(reject);
    }, 1000);
  });
}

/**
 * Run smoke tests.
 */
function runSmoke() {
  return new Promise((resolve) => {
    console.log('[smoke-local] Running smoke tests...');
    console.log('');

    const smokeRunner = spawn(
      'node',
      [path.join(__dirname, 'smoke-runner.js')],
      {
        env: {
          ...process.env,
          SMOKE_BASE_URL: `http://127.0.0.1:${SERVER_PORT}`,
          SMOKE_STRICT: '1',
        },
        stdio: 'inherit',
        shell: false,
      }
    );

    smokeRunner.on('exit', (code) => {
      resolve(code || 0);
    });

    smokeRunner.on('error', (err) => {
      console.error(`[smoke-local] Failed to run smoke tests: ${err.message}`);
      resolve(1);
    });
  });
}

/**
 * Main execution.
 */
async function main() {
  try {
    await startServer();
    const exitCode = await runSmoke();
    cleanup();
    process.exit(exitCode);
  } catch (error) {
    console.error(`[smoke-local] Error: ${error.message}`);
    cleanup();
    process.exit(1);
  }
}

main();
