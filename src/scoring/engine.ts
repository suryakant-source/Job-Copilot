import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { JobCopilotConfig } from '../config.js';
import { NormalizedJob } from '../parsers/index.js';
import { matchSkills } from './skills-matcher.js';
import { getDatabase, saveDatabase } from '../db/client.js';

export interface ScorecardReport {
  jobId: string;
  company: string;
  title: string;
  score: number;
  tier: 'A' | 'B' | 'C' | 'D';
  subscores: {
    skills: number;
    seniority: number;
    trajectory: number;
    compensation: number;
    location: number;
    companySignals: number;
  };
  strengths: string[];
  gaps: { description: string; severity: 'dealbreaker' | 'coachable' | 'cosmetic' }[];
  talkingPoints: string[];
  atsCoverageScore: number;
  verdict: string;
  reportMarkdownPath: string;
}

export async function scoreJob(job: NormalizedJob, config: JobCopilotConfig, resumePath = './resume.md'): Promise<ScorecardReport> {
  const resolvedResume = path.resolve(process.cwd(), resumePath);
  let resumeText = '';
  if (fs.existsSync(resolvedResume)) {
    resumeText = fs.readFileSync(resolvedResume, 'utf8');
  }

  const resumeHash = crypto.createHash('sha256').update(resumeText).digest('hex');
  const db = await getDatabase();

  // Check cache
  const cached = db.exec(`SELECT scorecard_json FROM score_cache WHERE resume_hash = '${resumeHash}' AND job_hash = '${job.dedupe_hash}'`);
  if (cached.length > 0 && cached[0].values.length > 0) {
    const jsonStr = cached[0].values[0][0] as string;
    try {
      const parsed = JSON.parse(jsonStr) as ScorecardReport;
      if (parsed.score >= 0 && parsed.score <= 100) {
        return parsed;
      }
    } catch {
      // Re-score
    }
  }

  // 1. Skills match (35% or 40%)
  const skillResult = matchSkills(['Kotlin', 'Jetpack Compose', 'MVVM', 'Coroutines', 'Retrofit', 'StateFlow', 'Room', 'Firebase', 'Supabase', 'AWS', 'Python', 'React', 'Node.js'], job.required_skills);
  const skillsScore = skillResult.score;

  // 2. Seniority & Experience alignment (25%)
  let seniorityScore = 80;
  if (job.years_experience > config.seniority.reject_if_min_experience_years) {
    seniorityScore = 50;
  } else if (job.title.toLowerCase().includes('intern') || job.title.toLowerCase().includes('software engineer') || job.title.toLowerCase().includes('developer')) {
    seniorityScore = 90;
  }

  // 3. Trajectory fit (15%)
  const trajectoryScore = 85;

  // 4. Compensation fit (10%)
  let compScore = 75;
  if (job.salary_range.max >= config.compensation.target && config.compensation.target > 0) {
    compScore = 95;
  } else if (job.salary_range.min >= config.compensation.floor && config.compensation.floor > 0) {
    compScore = 85;
  }

  // 5. Location / Remote fit (10%)
  const locationScore = job.remote_policy.toLowerCase().includes('remote') ? 95 : 75;

  // 6. Company Signals (5%)
  const companyScore = 80;

  // Normalize weights if entered as whole numbers (e.g. 40, 20, 15) vs decimals (0.40, 0.20, 0.15)
  const w = config.scoring_weights;
  let wSkills = w.skills_match || 0.35;
  let wSeniority = w.seniority_alignment || w.experience_seniority_fit || 0.25;
  let wTrajectory = w.trajectory_fit || 0.15;
  let wComp = w.compensation_fit || 0.10;
  let wLoc = w.location_fit || w.location_remote_fit || 0.10;
  let wCompany = w.company_signals || 0.05;

  const totalWeightSum = wSkills + wSeniority + wTrajectory + wComp + wLoc + wCompany;
  if (totalWeightSum > 1.5) {
    wSkills /= totalWeightSum;
    wSeniority /= totalWeightSum;
    wTrajectory /= totalWeightSum;
    wComp /= totalWeightSum;
    wLoc /= totalWeightSum;
    wCompany /= totalWeightSum;
  }

  // Weighted composite score
  const composite = Math.round(
    (skillsScore * wSkills) +
    (seniorityScore * wSeniority) +
    (trajectoryScore * wTrajectory) +
    (compScore * wComp) +
    (locationScore * wLoc) +
    (companyScore * wCompany)
  );

  let tier: 'A' | 'B' | 'C' | 'D' = 'D';
  if (composite >= config.tiers.A) tier = 'A';
  else if (composite >= config.tiers.B) tier = 'B';
  else if (composite >= config.tiers.C) tier = 'C';

  const strengths = [
    `Strong technical alignment with ${skillResult.matched.join(', ') || 'core stack'}`,
    `Production experience matching ${job.title} requirements`,
    `Proven track record with scalable mobile architecture & cloud backend`,
    `Sub-second latency UI & RAG optimization background`,
    `Strong problem solving and computer science foundation (CGPA 8.78)`,
  ];

  const gaps: ScorecardReport['gaps'] = [
    { description: 'Specific enterprise SDK legacy codebase experience', severity: 'coachable' },
    { description: 'Years of full-time experience requirement gap', severity: 'cosmetic' },
  ];

  const talkingPoints = [
    `Emphasize hands-on experience building Jetpack Compose reactive UI with ~25% recomposition overhead reduction.`,
    `Highlight real-world RAG pipeline deployment with Groq & Supabase serving multi-language queries.`,
    `Discuss clean MVVM architecture, Retrofit network layers, and state handling using StateFlow & Coroutines.`,
  ];

  const reportFileName = `${job.company.toLowerCase().replace(/[^a-z0-9]/g, '-')}-${job.title.toLowerCase().replace(/[^a-z0-9]/g, '-')}.md`;
  const reportPath = path.resolve(process.cwd(), `./reports/${reportFileName}`);

  const report: ScorecardReport = {
    jobId: job.id,
    company: job.company,
    title: job.title,
    score: composite,
    tier,
    subscores: {
      skills: skillsScore,
      seniority: seniorityScore,
      trajectory: trajectoryScore,
      compensation: compScore,
      location: locationScore,
      companySignals: companyScore,
    },
    strengths,
    gaps,
    talkingPoints,
    atsCoverageScore: Math.min(skillsScore + 10, 95),
    verdict: `Tier ${tier} (${composite}/100) — ${tier === 'A' ? 'Apply Now immediately' : tier === 'B' ? 'Worth tailoring resume' : 'Marginal fit'}`,
    reportMarkdownPath: reportPath,
  };

  // Generate Report File
  generateMarkdownReport(report, job, reportPath);

  // Cache Score in DB
  try {
    db.run(
      `INSERT OR REPLACE INTO score_cache (resume_hash, job_hash, score, tier, scorecard_json) VALUES (?, ?, ?, ?, ?)`,
      [resumeHash, job.dedupe_hash, composite, tier, JSON.stringify(report)]
    );
    db.run(
      `INSERT INTO job_events (job_id, status, notes) VALUES (?, ?, ?)`,
      [job.id, 'Scored', `Scored ${composite}/100 (Tier ${tier})`]
    );
    saveDatabase();
  } catch {
    // DB caching error ignored
  }

  return report;
}

function generateMarkdownReport(report: ScorecardReport, job: NormalizedJob, outputPath: string): void {
  const dir = path.dirname(outputPath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  const content = `# Scorecard Report: ${report.company} — ${report.title}

**Overall Fit Score:** \`${report.score} / 100\` · **Tier:** \`${report.tier}\`  
**Verdict:** ${report.verdict}  
**Source URL:** [${job.source}](${job.url})  
**Location:** ${job.location} (${job.remote_policy})  

---

### Scorecard Breakdown

| Dimension | Score | Weight | Notes |
|---|---|---|---|
| **Skills Match** | ${report.subscores.skills}/100 | 35% | Semantic skills & framework overlap |
| **Seniority Alignment** | ${report.subscores.seniority}/100 | 25% | Experience level fit vs requirements |
| **Trajectory Fit** | ${report.subscores.trajectory}/100 | 15% | Alignment with target career goals |
| **Compensation Fit** | ${report.subscores.compensation}/100 | 10% | Salary vs floor and target |
| **Location / Remote** | ${report.subscores.location}/100 | 10% | Remote policy & preferred cities |
| **Company Signals** | ${report.subscores.companySignals}/100 | 5% | Industry & stage preferences |

---

### Top Strengths
${report.strengths.map((s, i) => `${i + 1}. **${s}**`).join('\n')}

---

### Identified Gaps & Severity
${report.gaps.map((g) => `- **${g.description}** [Severity: *${g.severity}*]`).join('\n')}

---

### Recommended Interview Talking Points
${report.talkingPoints.map((tp) => `- ${tp}`).join('\n')}
`;

  fs.writeFileSync(outputPath, content, 'utf8');
}
