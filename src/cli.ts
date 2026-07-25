#!/usr/bin/env node

import { Command } from 'commander';
import { handleAdd } from './commands/add.js';
import { handleScore } from './commands/score.js';
import { handleTailor } from './commands/tailor.js';
import { handleWatch } from './commands/watch.js';
import { handleRender, handleExport, handleCosts } from './commands/render.js';
import { startApiServer } from './server/api.js';

const program = new Command();

program
  .name('job-copilot')
  .description('AI-Powered Local-First Job Search Co-Pilot')
  .version('1.0.0');

program
  .command('add <urlOrText>')
  .description('Ingest and parse job posting from URL or raw text')
  .option('--stdin', 'Read posting content from stdin')
  .option('--file', 'Read posting content from local file')
  .option('--json', 'Output result in JSON format')
  .action(async (urlOrText, options) => {
    await handleAdd(urlOrText, options);
  });

program
  .command('score <jobId>')
  .description('Score job fit against resume.md')
  .option('--json', 'Output report in JSON format')
  .action(async (jobId, options) => {
    await handleScore(jobId, options);
  });

program
  .command('tailor <jobId>')
  .description('Generate tailored resume PDF + changes diff for Tier A/B job')
  .option('--cover-letter', 'Include drafted cover letter')
  .option('--auto', 'Auto-tailor without prompting')
  .option('--json', 'Output result in JSON format')
  .action(async (jobId, options) => {
    await handleTailor(jobId, options);
  });

program
  .command('watch')
  .description('Run automated watchlist discovery daemon')
  .option('--once', 'Run single scan iteration')
  .action(async (options) => {
    await handleWatch(options);
  });

program
  .command('render [targetPath]')
  .description('Regenerate PDF from tailored resume.md')
  .action(async (targetPath) => {
    await handleRender(targetPath);
  });

program
  .command('export')
  .description('Export pipeline data to CSV or JSON')
  .option('--csv', 'Export as CSV (default)')
  .option('--json', 'Export as JSON')
  .action(async (options) => {
    await handleExport(options);
  });

program
  .command('costs')
  .description('Show LLM token consumption and cost report')
  .option('--json', 'Output in JSON format')
  .action(async (options) => {
    await handleCosts(options);
  });

program
  .command('server')
  .description('Start local HTTP JSON-RPC API server on port 3847')
  .option('--port <number>', 'Port number', '3847')
  .action(async (options) => {
    startApiServer(parseInt(options.port, 10));
  });

program.parse(process.argv);
