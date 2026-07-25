import path from 'node:path';
import fs from 'node:fs';
import { renderPdf } from '../tailoring/pdf-renderer.js';
import { getDatabase } from '../db/client.js';

export async function handleRender(targetPath?: string) {
  try {
    const inputMd = targetPath ? path.resolve(process.cwd(), targetPath) : path.resolve(process.cwd(), './applications/phonepe-software-engineer-android/resume.md');
    const outputPdf = inputMd.replace(/\.md$/i, '.pdf');

    if (!fs.existsSync(inputMd)) {
      console.error(`File not found: ${inputMd}`);
      return;
    }

    await renderPdf(inputMd, outputPdf);
    console.log(`[Render Complete] PDF generated at: ${outputPdf}`);
  } catch (err: any) {
    console.error(`[Render Error]: ${err.message}`);
  }
}

export async function handleExport(options: { csv?: boolean; json?: boolean } = {}) {
  try {
    const db = await getDatabase();
    const result = db.exec(`SELECT id, title, company, location, seniority, status, created_at FROM jobs`);
    const jobs = result.length > 0 ? result[0].values.map((r) => ({
      id: r[0],
      title: r[1],
      company: r[2],
      location: r[3],
      seniority: r[4],
      status: r[5],
      created_at: r[6],
    })) : [];

    if (options.json) {
      console.log(JSON.stringify(jobs, null, 2));
      return;
    }

    // Default CSV
    const csvHeader = 'id,title,company,location,seniority,status,created_at\n';
    const csvRows = jobs.map((j) => `"${j.id}","${j.title}","${j.company}","${j.location}","${j.seniority}","${j.status}","${j.created_at}"`).join('\n');
    console.log(csvHeader + csvRows);
  } catch (err: any) {
    console.error(`[Export Error]: ${err.message}`);
  }
}

export async function handleCosts(options: { json?: boolean } = {}) {
  try {
    const db = await getDatabase();
    const result = db.exec(`SELECT provider, model, SUM(prompt_tokens), SUM(completion_tokens), SUM(total_cost_usd) FROM llm_costs GROUP BY provider, model`);

    const summary = result.length > 0 ? result[0].values.map((r) => ({
      provider: r[0],
      model: r[1],
      promptTokens: r[2] || 0,
      completionTokens: r[3] || 0,
      totalCostUsd: r[4] || 0,
    })) : [];

    if (options.json) {
      console.log(JSON.stringify(summary, null, 2));
      return;
    }

    console.log(`\n================ LLM COST LOG ================`);
    if (summary.length === 0) {
      console.log(`No LLM calls recorded yet (mock adapter / zero API cost).`);
    } else {
      summary.forEach((s) => {
        console.log(`Provider: ${s.provider} | Model: ${s.model}`);
        console.log(`Tokens: Prompt ${s.promptTokens} | Completion ${s.completionTokens}`);
        console.log(`Total Cost: $${(s.totalCostUsd as number).toFixed(4)} USD\n`);
      });
    }
    console.log(`==============================================\n`);
  } catch (err: any) {
    console.error(`[Costs Error]: ${err.message}`);
  }
}
