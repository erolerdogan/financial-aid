#!/usr/bin/env node

/**
 * Runs every *.test.ts file under src/ with tsx, one process per file.
 * A test file exits with code 1 when one of its checks fails.
 * Arguments filter by path: `npm test -- freedom` runs the files whose path contains "freedom".
 */

const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');

function findTests(dir) {
  const found = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) found.push(...findTests(full));
    else if (entry.name.endsWith('.test.ts')) found.push(full);
  }
  return found;
}

const filters = process.argv.slice(2);
const files = findTests(path.join(root, 'src'))
  .map((file) => path.relative(root, file))
  .filter((file) => filters.length === 0 || filters.some((filter) => file.includes(filter)))
  .sort();

if (files.length === 0) {
  console.error('No test files found.');
  process.exit(1);
}

const failed = [];
for (const file of files) {
  console.log(`\n=== ${file}`);
  const result = spawnSync('npx', ['--yes', 'tsx', file], {
    cwd: root,
    stdio: 'inherit',
    shell: process.platform === 'win32',
  });
  if (result.status !== 0) failed.push(file);
}

console.log(`\n${files.length - failed.length} of ${files.length} test files passed.`);
if (failed.length > 0) {
  console.log(`Failed:\n${failed.map((file) => `  ${file}`).join('\n')}`);
  process.exit(1);
}
