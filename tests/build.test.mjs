import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
test('rebuilding preserves the committed single-file userscript', () => {
  const before = readFileSync('browser-environment-guard.user.js','utf8');
  execFileSync(process.execPath,['scripts/build.mjs']);
  const after = readFileSync('browser-environment-guard.user.js','utf8');
  assert.equal(after,before);
  assert.match(after,/^\/\/ ==UserScript==/);
  assert.match(after,/@run-at\s+document-start/);
  assert.doesNotMatch(after,/@require\s/);
  assert.match(after,/function runRtcCheck\(/);
  assert.match(after,/function createWidget\(/);
});
