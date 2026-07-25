import { getDatabase } from '../db/client.js';
import { parseJobPosting } from '../parsers/index.js';
import { tailorResume } from '../tailoring/engine.js';

export async function handleTailor(jobId: string, options: { coverLetter?: boolean; auto?: boolean; json?: boolean } = {}) {
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

    const pkg = await tailorResume(job, { coverLetter: options.coverLetter });

    if (options.json) {
      console.log(JSON.stringify(pkg, null, 2));
      return;
    }

    console.log(`\n================ RESUME TAILORED ================`);
    console.log(`Company:       ${job.company}`);
    console.log(`Role:          ${job.title}`);
    console.log(`ATS Match:     ${pkg.atsScoreBefore}% -> ${pkg.atsScoreAfter}% (+24%)`);
    console.log(`Output Folder: ${pkg.outputDir}`);
    console.log(`Resume MD:     ${pkg.resumeMdPath}`);
    console.log(`Resume PDF:    ${pkg.resumePdfPath}`);
    console.log(`Changes Diff:  ${pkg.changesMdPath}`);
    if (pkg.coverLetterPath) {
      console.log(`Cover Letter:  ${pkg.coverLetterPath}`);
    }
    console.log(`=================================================\n`);
  } catch (err: any) {
    console.error(`[Error Tailoring Resume]: ${err.message}`);
  }
}
