#!/usr/bin/env node
/**
 * Wrapper: run a CDP suite and exit non-zero if console reports FAILED,
 * even when the suite itself exits 0. Does not change product behavior.
 *
 * Usage: node run-suite.js test-customer.js
 */
const { spawn } = require('child_process');
const path = require('path');

const target = process.argv[2];
if (!target) {
  console.error('Usage: node run-suite.js <suite.js>');
  process.exit(2);
}

const child = spawn(process.execPath, [path.resolve(__dirname, target)], {
  cwd: __dirname,
  stdio: ['ignore', 'pipe', 'pipe'],
});

let out = '';
child.stdout.on('data', (d) => {
  const s = d.toString();
  out += s;
  process.stdout.write(s);
});
child.stderr.on('data', (d) => {
  const s = d.toString();
  out += s;
  process.stderr.write(s);
});

child.on('close', (code) => {
  const failed =
    /\bFAILED\b/.test(out) ||
    /\bfailed\b/.test(out) && /\d+\s+failed\b/i.test(out);
  const passed = /\bALL PASSED\b/.test(out) || /\b0 failed\b/i.test(out);
  if (failed && !passed) {
    console.error(`[run-suite] console reported failure; forcing exit 1 (child exit was ${code})`);
    process.exit(1);
  }
  process.exit(code === null ? 1 : code);
});
