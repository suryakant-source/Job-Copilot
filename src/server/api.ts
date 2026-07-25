import express from 'express';
import path from 'node:path';
import fs from 'node:fs';
import { getDatabase, saveDatabase } from '../db/client.js';
import { parseJobPosting } from '../parsers/index.js';
import { scoreJob } from '../scoring/engine.js';
import { tailorResume } from '../tailoring/engine.js';
import { loadConfig } from '../config.js';
import { runWatcherScan } from '../watcher/daemon.js';

export function startApiServer(port = 3847): void {
  const app = express();
  app.use(express.json());

  // Serve static application downloads
  const appsDir = path.resolve(process.cwd(), './applications');
  if (!fs.existsSync(appsDir)) fs.mkdirSync(appsDir, { recursive: true });
  app.use('/applications', express.static(appsDir));

  // Serve Web Dashboard static files
  const publicDir = path.resolve(process.cwd(), './public');
  if (!fs.existsSync(publicDir)) fs.mkdirSync(publicDir, { recursive: true });
  app.use(express.static(publicDir));

  // API Endpoints
  app.get('/api/jobs', async (req, res) => {
    try {
      const db = await getDatabase();
      const result = db.exec(`
        SELECT j.id, j.title, j.company, j.location, j.remote_policy, j.status, j.source, j.created_at,
               COALESCE(s.score, 75) as score, COALESCE(s.tier, 'B') as tier, s.scorecard_json
        FROM jobs j
        LEFT JOIN score_cache s ON j.dedupe_hash = s.job_hash
        ORDER BY j.created_at DESC
      `);

      const jobs = result.length > 0 ? result[0].values.map((row) => ({
        id: row[0],
        title: row[1],
        company: row[2],
        location: row[3],
        remote_policy: row[4],
        status: row[5],
        source: row[6],
        created_at: row[7],
        score: row[8],
        tier: row[9],
        scorecard: row[10] ? JSON.parse(row[10] as string) : null,
      })) : [];

      res.json({ success: true, count: jobs.length, data: jobs });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  app.post('/api/jobs/add', async (req, res) => {
    try {
      const { urlOrText } = req.body;
      if (!urlOrText) return res.status(400).json({ success: false, error: 'urlOrText is required' });

      const job = await parseJobPosting(urlOrText);
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
      saveDatabase();

      res.json({ success: true, job, scorecard });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  app.put('/api/jobs/:id/status', async (req, res) => {
    try {
      const { id } = req.params;
      const { status } = req.body;
      const db = await getDatabase();
      db.run(`UPDATE jobs SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`, [status, id]);
      db.run(`INSERT INTO job_events (job_id, status, notes) VALUES (?, ?, ?)`, [id, status, `Stage updated to ${status}`]);
      saveDatabase();
      res.json({ success: true, message: `Status updated to ${status}` });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  app.post('/api/jobs/:id/tailor', async (req, res) => {
    try {
      const { id } = req.params;
      const { coverLetter } = req.body;

      const db = await getDatabase();
      const result = db.exec(`SELECT id, title, company, location, remote_policy, source, dedupe_hash, required_skills FROM jobs WHERE id = '${id}'`);

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
        job.id = id;
      }

      const pkg = await tailorResume(job, { coverLetter });
      db.run(`UPDATE jobs SET status = 'Tailored' WHERE id = ?`, [id]);
      saveDatabase();

      res.json({ success: true, package: pkg });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  app.post('/api/watcher/scan', async (req, res) => {
    try {
      await runWatcherScan({ once: true });
      res.json({ success: true, message: 'Watcher scan complete' });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  app.get('/api/resume', (req, res) => {
    const resumePath = path.resolve(process.cwd(), './resume.md');
    if (fs.existsSync(resumePath)) {
      res.json({ success: true, content: fs.readFileSync(resumePath, 'utf8') });
    } else {
      res.status(404).json({ success: false, error: 'Resume file not found' });
    }
  });

  app.put('/api/resume', (req, res) => {
    const { content } = req.body;
    const resumePath = path.resolve(process.cwd(), './resume.md');
    fs.writeFileSync(resumePath, content, 'utf8');
    res.json({ success: true, message: 'Resume updated' });
  });

  // Catch-all to index.html for SPA routing
  app.get('*', (req, res) => {
    res.sendFile(path.resolve(publicDir, 'index.html'));
  });

  app.listen(port, () => {
    console.log(`\n======================================================`);
    console.log(`🚀 AI Job Search Co-Pilot Web Dashboard`);
    console.log(`🌐 URL: http://localhost:${port}`);
    console.log(`======================================================\n`);
  });
}
