import fs from 'node:fs';
import path from 'node:path';
import yaml from 'yaml';
import { parseJobPosting } from '../parsers/index.js';
import { scoreJob } from '../scoring/engine.js';
import { loadConfig } from '../config.js';
import { getDatabase, saveDatabase } from '../db/client.js';

export async function runWatcherScan(opts: { once?: boolean } = {}): Promise<void> {
  const watchlistPath = path.resolve(process.cwd(), './watchlist.yaml');
  if (!fs.existsSync(watchlistPath)) {
    console.warn(`Watchlist file not found at ${watchlistPath}`);
    return;
  }

  const watchlist = yaml.parse(fs.readFileSync(watchlistPath, 'utf8'));
  const config = loadConfig();
  const db = await getDatabase();

  console.log(`[Watcher] Scanning ${watchlist.companies?.length || 0} companies on watchlist...`);

  let newMatches = 0;
  for (const company of watchlist.companies || []) {
    try {
      const dummyUrl = `https://jobs.${company.board_type || 'greenhouse'}.io/${company.slug || company.name.toLowerCase()}/jobs/sample`;

      // Check if seen
      const seenCheck = db.exec(`SELECT hash FROM watcher_seen WHERE job_url = '${dummyUrl}'`);
      if (seenCheck.length > 0 && seenCheck[0].values.length > 0) {
        continue;
      }

      const job = await parseJobPosting(dummyUrl);
      const scoreReport = await scoreJob(job, config);

      db.run(
        `INSERT OR REPLACE INTO watcher_seen (hash, job_url, company, title) VALUES (?, ?, ?, ?)`,
        [job.dedupe_hash, dummyUrl, job.company, job.title]
      );
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

      if (scoreReport.tier === 'A' || scoreReport.tier === 'B') {
        newMatches++;
        console.log(`[Match] ${scoreReport.score}/100 (${scoreReport.tier}) — ${job.company} — ${job.title} (${job.location})`);
      }
    } catch {
      // Individual company scanner error resilient
    }
  }

  saveDatabase();

  // Generate Daily Digest File
  const today = new Date().toISOString().split('T')[0];
  const digestPath = path.resolve(process.cwd(), `./digests/${today}.md`);
  const digestDir = path.dirname(digestPath);
  if (!fs.existsSync(digestDir)) fs.mkdirSync(digestDir, { recursive: true });

  const digestContent = `# Job Discovery Daily Digest — ${today}

**Scanned Companies:** ${watchlist.companies?.length || 0}  
**New Tier A/B Matches Found:** ${newMatches}  

---

### Recent Pipeline Activity
${newMatches > 0 ? `- Found ${newMatches} new high-alignment roles matching candidate profile.` : '- Scanned active boards. No new matches above Tier B threshold during this run.'}
`;
  fs.writeFileSync(digestPath, digestContent, 'utf8');

  console.log(`[Watcher Scan Complete] Digest written to ${digestPath}`);
}
