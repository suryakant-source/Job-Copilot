import { parseJobPosting } from '../parsers/index.js';
import { scoreJob } from '../scoring/engine.js';
import { loadConfig } from '../config.js';
import { getDatabase, saveDatabase } from '../db/client.js';

export async function handleAdd(urlOrText: string, options: { stdin?: boolean; file?: boolean; json?: boolean } = {}) {
  try {
    const job = await parseJobPosting(urlOrText, options);
    const config = loadConfig();
    const scorecard = await scoreJob(job, config);

    const db = await getDatabase();
    db.run(
      `INSERT OR REPLACE INTO jobs (id, title, company, location, remote_policy, salary_min, salary_max, currency, seniority, required_skills, posted_date, source, dedupe_hash, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        job.id,
        job.title,
        job.company,
        job.location,
        job.remote_policy,
        job.salary_range.min,
        job.salary_range.max,
        job.salary_range.currency,
        job.seniority,
        JSON.stringify(job.required_skills),
        job.posted_date,
        job.source,
        job.dedupe_hash,
        'Discovered',
      ]
    );
    db.run(
      `INSERT OR REPLACE INTO job_sources (job_id, url, source_name) VALUES (?, ?, ?)`,
      [job.id, job.url, job.source]
    );
    saveDatabase();

    if (options.json) {
      console.log(JSON.stringify({ job, scorecard }, null, 2));
      return;
    }

    console.log(`\n======================================================`);
    console.log(`[Job Ingested] ${job.company} — ${job.title}`);
    console.log(`Location: ${job.location} | Remote: ${job.remote_policy}`);
    console.log(`Source: ${job.source} | ID: ${job.id}`);
    console.log(`Fit Score: ${scorecard.score}/100 (Tier ${scorecard.tier})`);
    console.log(`Report Generated: ${scorecard.reportMarkdownPath}`);
    console.log(`======================================================\n`);
  } catch (err: any) {
    console.error(`[Error Adding Job]: ${err.message}`);
    process.exit(1);
  }
}
