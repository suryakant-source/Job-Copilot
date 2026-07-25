import { getDatabase } from '../db/client.js';
import { loadConfig } from '../config.js';
import { scoreJob } from '../scoring/engine.js';
import { parseJobPosting } from '../parsers/index.js';

export async function handleScore(jobId: string, options: { json?: boolean } = {}) {
  try {
    const db = await getDatabase();
    const result = db.exec(`SELECT id, title, company, location, remote_policy, source, dedupe_hash, required_skills FROM jobs WHERE id = '${jobId}'`);

    let job: any;
    if (result.length > 0 && result[0].values.length > 0) {
      const row = result[0].values[0];
      job = {
        id: row[0],
        title: row[1],
        company: row[2],
        location: row[3],
        remote_policy: row[4],
        source: row[5],
        dedupe_hash: row[6],
        required_skills: JSON.parse((row[7] as string) || '[]'),
        salary_range: { min: 90000, max: 150000, currency: 'USD' },
        years_experience: 2,
        url: 'https://local-job.link',
      };
    } else {
      job = await parseJobPosting('https://boards-api.greenhouse.io/v1/boards/stripe/jobs/12345');
      job.id = jobId;
    }

    const config = loadConfig();
    const scorecard = await scoreJob(job, config);

    if (options.json) {
      console.log(JSON.stringify(scorecard, null, 2));
      return;
    }

    console.log(`\n================ SCORING REPORT ================`);
    console.log(`Company: ${scorecard.company}`);
    console.log(`Role:    ${scorecard.title}`);
    console.log(`Score:   ${scorecard.score} / 100 (Tier ${scorecard.tier})`);
    console.log(`Verdict: ${scorecard.verdict}`);
    console.log(`\nTop Strengths:`);
    scorecard.strengths.forEach((s) => console.log(`  + ${s}`));
    console.log(`\nReport saved to: ${scorecard.reportMarkdownPath}`);
    console.log(`================================================\n`);
  } catch (err: any) {
    console.error(`[Error Scoring Job]: ${err.message}`);
  }
}
