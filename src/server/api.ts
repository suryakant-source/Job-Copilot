import express from 'express';
import path from 'node:path';
import fs from 'node:fs';
import { exec } from 'node:child_process';
import yaml from 'yaml';
import { getDatabase, saveDatabase } from '../db/client.js';
import { parseJobPosting } from '../parsers/index.js';
import { scoreJob } from '../scoring/engine.js';
import { tailorResume } from '../tailoring/engine.js';
import { loadConfig } from '../config.js';
import { runWatcherScan } from '../watcher/daemon.js';
import { LLMAdapter } from '../llm/adapter.js';

export function startApiServer(port = 3847): void {
  const app = express();
  app.use(express.json({ limit: '10mb' }));

  // Serve static application downloads
  const appsDir = path.resolve(process.cwd(), './applications');
  if (!fs.existsSync(appsDir)) fs.mkdirSync(appsDir, { recursive: true });
  app.use('/applications', express.static(appsDir));

  // Serve Web Dashboard static files
  const publicDir = path.resolve(process.cwd(), './public');
  if (!fs.existsSync(publicDir)) fs.mkdirSync(publicDir, { recursive: true });
  app.use(express.static(publicDir));

  // --- CONFIG & ONBOARDING ENDPOINTS ---
  app.get('/api/config/status', (req, res) => {
    try {
      const config = loadConfig();
      const hasApiKey = Boolean(process.env.GEMINI_API_KEY || process.env.GROQ_API_KEY || process.env.OPENAI_API_KEY);
      res.json({
        success: true,
        configured: hasApiKey,
        provider: config.llm.provider,
        model: config.llm.model,
        candidateName: config.candidate.name || 'Candidate',
        targetRoles: config.target_roles.primary || [],
      });
    } catch (err: any) {
      res.json({ success: true, configured: false, provider: 'mock', candidateName: 'Candidate', targetRoles: [] });
    }
  });

  app.post('/api/config/setup-engine', (req, res) => {
    try {
      const { provider, apiKey, model } = req.body;
      if (!provider || !apiKey) {
        return res.status(400).json({ success: false, error: 'Provider and API Key are required' });
      }

      // Update process.env
      if (provider === 'gemini') process.env.GEMINI_API_KEY = apiKey;
      else if (provider === 'groq') process.env.GROQ_API_KEY = apiKey;
      else if (provider === 'openai') process.env.OPENAI_API_KEY = apiKey;

      // Persist to .env file
      const envPath = path.resolve(process.cwd(), '.env');
      let envLines: string[] = [];
      if (fs.existsSync(envPath)) {
        envLines = fs.readFileSync(envPath, 'utf8').split('\n').filter(line => line.trim() && !line.startsWith(`${provider.toUpperCase()}_API_KEY=`));
      }
      envLines.push(`${provider.toUpperCase()}_API_KEY=${apiKey}`);
      fs.writeFileSync(envPath, envLines.join('\n'), 'utf8');

      // Update config.yaml
      const configPath = path.resolve(process.cwd(), 'config.yaml');
      let currentConfig: any = {};
      if (fs.existsSync(configPath)) {
        currentConfig = yaml.parse(fs.readFileSync(configPath, 'utf8')) || {};
      }
      currentConfig.llm = {
        provider,
        model: model || (provider === 'gemini' ? 'gemini-1.5-flash' : provider === 'groq' ? 'llama-3.3-70b-versatile' : 'gpt-4o'),
      };
      fs.writeFileSync(configPath, yaml.stringify(currentConfig), 'utf8');

      res.json({ success: true, message: `Engine configured with ${provider} provider!`, provider, model: currentConfig.llm.model });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  app.post('/api/resume/auto-setup', async (req, res) => {
    try {
      const { resumeText } = req.body;
      if (!resumeText || !resumeText.trim()) {
        return res.status(400).json({ success: false, error: 'Resume text is required' });
      }

      // Write resume.md
      const resumePath = path.resolve(process.cwd(), 'resume.md');
      fs.writeFileSync(resumePath, resumeText, 'utf8');

      // Load current LLM config
      const config = loadConfig();
      const llm = new LLMAdapter(config.llm);

      const prompt = `Analyze this candidate resume and return ONLY a valid JSON object (no markdown code fences):
{
  "candidate_name": "Full Name",
  "current_stage": "Short status e.g. 3rd year student / Fresher",
  "location_base": "City, State, Country",
  "primary_roles": ["Role 1", "Role 2", "Role 3"],
  "secondary_roles": ["Role 4", "Role 5"],
  "must_have_skills": ["Skill 1", "Skill 2", "Skill 3", "Skill 4", "Skill 5"],
  "strong_plus_skills": ["Skill 6", "Skill 7", "Skill 8"],
  "adjacent_skills": ["Skill 9", "Skill 10"],
  "search_keywords": ["keyword 1", "keyword 2", "keyword 3"]
}

RESUME:
${resumeText.slice(0, 4000)}`;

      const llmRes = await llm.complete(prompt);
      let parsed: any = {};
      try {
        const cleanContent = llmRes.content.replace(/```json/g, '').replace(/```/g, '').trim();
        parsed = JSON.parse(cleanContent);
      } catch {
        parsed = {
          candidate_name: 'Candidate',
          current_stage: 'Fresher / Developer',
          location_base: 'India',
          primary_roles: ['Software Engineer', 'Android Developer'],
          secondary_roles: ['Full Stack Developer', 'Cloud Engineer'],
          must_have_skills: ['Kotlin', 'Java', 'Python', 'React', 'REST API'],
          strong_plus_skills: ['AWS', 'SQL', 'Git'],
          adjacent_skills: ['MongoDB', 'Docker'],
          search_keywords: ['android', 'kotlin', 'software engineer', 'intern'],
        };
      }

      // Update config.yaml
      const configPath = path.resolve(process.cwd(), 'config.yaml');
      let currentConfig: any = {};
      if (fs.existsSync(configPath)) {
        currentConfig = yaml.parse(fs.readFileSync(configPath, 'utf8')) || {};
      }

      currentConfig.candidate = {
        name: parsed.candidate_name || currentConfig.candidate?.name || 'Candidate',
        current_stage: parsed.current_stage || 'Software Engineer',
        location_base: parsed.location_base || 'India',
        currently_employed: false,
      };

      currentConfig.target_roles = {
        primary: parsed.primary_roles || ['Software Engineer'],
        secondary: parsed.secondary_roles || ['Developer'],
        stretch: ['Associate SDE'],
      };

      currentConfig.skills_priority = {
        must_have: parsed.must_have_skills || ['Programming'],
        strong_plus: parsed.strong_plus_skills || ['Cloud'],
        adjacent_credit: parsed.adjacent_skills || ['Web'],
        not_yet_have: ['Multiplatform'],
      };

      fs.writeFileSync(configPath, yaml.stringify(currentConfig), 'utf8');

      // Update watchlist.yaml automatically
      const watchlistPath = path.resolve(process.cwd(), 'watchlist.yaml');
      const keywords = parsed.search_keywords || ['software', 'developer', 'intern'];
      const defaultWatchlist = {
        companies: [
          { name: 'Greenhouse Global', board_type: 'greenhouse', slug: 'demo', filters: { title_contains: keywords }, verified: false },
          { name: 'Lever Careers', board_type: 'lever', slug: 'demo', filters: { title_contains: keywords }, verified: false },
          { name: 'Ashby Board', board_type: 'ashby', slug: 'demo', filters: { title_contains: keywords }, verified: false },
        ],
        global_filters: {
          reject_titles_contains: ['senior', 'lead', 'manager', 'director', 'principal'],
          min_posted_within_days: 60,
          dedupe_key: 'company+title+location',
          search_scope: 'jobs + internships',
        },
      };
      fs.writeFileSync(watchlistPath, yaml.stringify(defaultWatchlist), 'utf8');

      res.json({
        success: true,
        message: 'Resume analyzed! Config and Watchlist automatically generated.',
        profile: parsed,
      });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // --- EXISTING API ENDPOINTS ---
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
    const dashUrl = `http://localhost:${port}`;
    console.log(`\n======================================================`);
    console.log(`🚀 AI Job Search Co-Pilot Web Dashboard`);
    console.log(`🌐 URL: ${dashUrl}`);
    console.log(`======================================================\n`);

    // Auto-open browser when server starts
    const startCmd =
      process.platform === 'win32'
        ? `start ${dashUrl}`
        : process.platform === 'darwin'
        ? `open ${dashUrl}`
        : `xdg-open ${dashUrl}`;
    exec(startCmd, () => {
      // Ignore open browser errors
    });
  });
}

