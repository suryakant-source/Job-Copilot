import test from 'node:test';
import assert from 'node:assert/strict';
import { parseJobPosting } from '../parsers/index.js';
import { scoreJob } from '../scoring/engine.js';
import { tailorResume } from '../tailoring/engine.js';
import { loadConfig } from '../config.js';

test('Full Integration Flow: add -> score -> tailor', async () => {
  // 1. Ingest
  const url = 'https://boards-api.greenhouse.io/v1/boards/stripe/jobs/12345';
  const job = await parseJobPosting(url);
  assert.equal(job.source, 'Greenhouse');

  // 2. Score
  const config = loadConfig();
  const report = await scoreJob(job, config);
  assert.ok(report.score >= 0);

  // 3. Tailor
  const pkg = await tailorResume(job, { coverLetter: true });
  assert.ok(pkg.resumeMdPath.includes('resume.md'));
  assert.ok(pkg.changesMdPath.includes('changes.md'));
  assert.ok(pkg.coverLetterPath?.includes('cover-letter.md'));
});
