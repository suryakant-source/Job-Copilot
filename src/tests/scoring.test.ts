import test from 'node:test';
import assert from 'node:assert/strict';
import { matchSkills } from '../scoring/skills-matcher.js';
import { loadConfig } from '../config.js';
import { scoreJob } from '../scoring/engine.js';
import { parseGreenhouse } from '../parsers/index.js';

test('Skills Matcher matches exact & synonym skills correctly', () => {
  const resume = ['Kotlin', 'Jetpack Compose', 'MVVM', 'Coroutines', 'K8s', 'React.js'];
  const required = ['Kotlin', 'Android SDK', 'Kubernetes', 'MVVM'];

  const result = matchSkills(resume, required);
  assert.ok(result.matched.includes('Kotlin'));
  assert.ok(result.matched.includes('Kubernetes')); // Synonym K8s -> Kubernetes
  assert.ok(result.matched.includes('MVVM'));
  assert.ok(result.score >= 75);
});

test('Scoring Engine generates complete scorecard report', async () => {
  const config = loadConfig();
  const job = await parseGreenhouse('https://boards-api.greenhouse.io/v1/boards/stripe/jobs/12345');
  const report = await scoreJob(job, config);

  console.log('Report score:', report.score, 'type:', typeof report.score);
  assert.ok(typeof report.score === 'number' && !isNaN(report.score));
  assert.ok(report.score >= 0 && report.score <= 100);
  assert.ok(['A', 'B', 'C', 'D'].includes(report.tier));
  assert.ok(report.strengths.length >= 3);
  assert.ok(report.talkingPoints.length >= 2);
});
