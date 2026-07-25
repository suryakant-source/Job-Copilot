import test from 'node:test';
import assert from 'node:assert/strict';
import { parseGreenhouse, parseLever, parseAshby, computeDedupeHash } from '../parsers/index.js';

test('Greenhouse Parser extracts normalized job details', async () => {
  const job = await parseGreenhouse('https://boards-api.greenhouse.io/v1/boards/stripe/jobs/12345');
  assert.equal(job.source, 'Greenhouse');
  assert.ok(job.dedupe_hash.length > 0);
  assert.ok(job.required_skills.includes('Kotlin'));
});

test('Lever Parser extracts normalized job details', async () => {
  const job = await parseLever('https://jobs.lever.co/cred/09022710-e79a-4cf0-8060-df0e1cd64263');
  assert.equal(job.source, 'Lever');
  assert.ok(job.id.startsWith('lever_'));
});

test('Ashby Parser computes dedupe hash accurately', async () => {
  const job = await parseAshby('https://jobs.ashbyhq.com/phonepe/7799494003');
  assert.equal(job.source, 'Ashby');
  const expectedHash = computeDedupeHash('phonepe', 'android engineer', 'remote');
  assert.equal(job.dedupe_hash, expectedHash);
});
