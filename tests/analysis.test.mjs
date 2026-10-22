// SPDX-License-Identifier: Apache-2.0
import test from 'node:test';
import assert from 'node:assert/strict';
import { DEMO } from '../data/demo.mjs';
import { validateDataset, summarize } from '../lib/analysis.mjs';
const clone = value => structuredClone(value);
test('synthetic dataset is valid and has 50 questions across three services', () => {
  assert.equal(validateDataset(DEMO), DEMO);
  assert.equal(DEMO.questions.length, 50);
  assert.equal(DEMO.observations.length, 150);
});
test('demo produces the exact stated illustrative ChatGPT counts', () => {
  const report = summarize(DEMO, 'harbor', 'ChatGPT');
  assert.deepEqual(report.schools.map(s => s.hits), [18, 27, 31, 36]);
  assert.equal(report.denominator, 50);
  assert.equal(report.target.rate, .36);
  assert.ok(report.missingStrengths.some(s => s.topic === 'Robotics & engineering'));
});
test('all-platform denominator is number of responses, not prompts', () => {
  const report = summarize(DEMO, 'harbor');
  assert.equal(report.denominator, 150);
  assert.equal(report.target.hits, 54);
});
test('rejects forged or mixed measurement provenance', () => {
  const invalid = clone(DEMO); invalid.kind = 'observed';
  assert.throws(() => validateDataset(invalid), /Synthetic and observed/);
});
test('rejects unknown school and duplicate observations', () => {
  const invalid = clone(DEMO); invalid.observations.push(clone(invalid.observations[0]));
  assert.throws(() => validateDataset(invalid), /Duplicate/);
  assert.throws(() => summarize(DEMO, 'missing'), /Unknown selected school/);
});
test('rejects executable or non-HTTPS source URLs', () => {
  const invalid = clone(DEMO); invalid.schools[0].strengths[0].sourceUrl = 'javascript:alert(1)';
  assert.throws(() => validateDataset(invalid), /HTTPS/);
});
test('rejects invalid oversized excerpts and unknown IDs', () => {
  const invalid = clone(DEMO); invalid.observations[0].responseExcerpt = 'x'.repeat(1501);
  assert.throws(() => validateDataset(invalid), /1500/);
  invalid.observations[0].responseExcerpt = 'fine'; invalid.observations[0].schoolIds = ['unknown'];
  assert.throws(() => validateDataset(invalid), /school IDs/);
});
