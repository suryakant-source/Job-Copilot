import express from 'express';
import { getDatabase } from '../db/client.js';

export function startApiServer(port = 3847): void {
  const app = express();
  app.use(express.json());

  app.get('/api/jobs', async (req, res) => {
    try {
      const db = await getDatabase();
      const result = db.exec(`SELECT id, title, company, location, seniority, status, created_at FROM jobs ORDER BY created_at DESC`);
      const jobs = result.length > 0 ? result[0].values.map((row) => ({
        id: row[0],
        title: row[1],
        company: row[2],
        location: row[3],
        seniority: row[4],
        status: row[5],
        created_at: row[6],
      })) : [];
      res.json({ success: true, count: jobs.length, data: jobs });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  app.get('/api/pipeline', async (req, res) => {
    try {
      const db = await getDatabase();
      const result = db.exec(`
        SELECT j.id, j.title, j.company, j.status, s.score, s.tier
        FROM jobs j
        LEFT JOIN score_cache s ON j.dedupe_hash = s.job_hash
        ORDER BY s.score DESC
      `);
      const pipeline = result.length > 0 ? result[0].values.map((row) => ({
        id: row[0],
        title: row[1],
        company: row[2],
        status: row[3],
        score: row[4] || 0,
        tier: row[5] || 'C',
      })) : [];
      res.json({ success: true, data: pipeline });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  app.post('/api/notes', async (req, res) => {
    try {
      const { jobId, content } = req.body;
      const db = await getDatabase();
      db.run(`INSERT INTO notes (job_id, content) VALUES (?, ?)`, [jobId, content]);
      res.json({ success: true, message: 'Note added' });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  app.listen(port, () => {
    console.log(`[JobCopilot API Server] Running on http://localhost:${port}`);
  });
}
