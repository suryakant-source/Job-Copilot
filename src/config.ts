import fs from 'node:fs';
import path from 'node:path';
import yaml from 'yaml';
import { z } from 'zod';
import dotenv from 'dotenv';

dotenv.config();

export const ConfigSchema = z.object({
  candidate: z.object({
    name: z.string().default('Candidate'),
    current_stage: z.string().optional(),
    location_base: z.string().optional(),
    currently_employed: z.boolean().default(false),
  }).default({ name: 'Candidate' }),
  target_roles: z.object({
    primary: z.array(z.string()).default([]),
    secondary: z.array(z.string()).default([]),
    stretch: z.array(z.string()).default([]),
  }).default({ primary: [], secondary: [], stretch: [] }),
  seniority: z.object({
    level: z.string().default('mid'),
    reject_if_min_experience_years: z.number().default(5),
    accept_types: z.array(z.string()).default(['full-time', 'internship']),
    note: z.string().optional(),
  }).default({ level: 'mid', reject_if_min_experience_years: 5 }),
  compensation: z.object({
    currency: z.string().default('USD'),
    floor: z.number().default(0),
    target: z.number().default(0),
    stipend_floor_monthly: z.number().optional(),
    stipend_target_monthly: z.number().optional(),
    unpaid_internships: z.string().default('reject'),
  }).default({ currency: 'USD', floor: 0, target: 0 }),
  location: z.object({
    preferred_remote: z.boolean().default(true),
    remote_ok: z.boolean().default(true),
    hybrid_ok: z.boolean().default(true),
    acceptable_locations: z.array(z.string()).default([]),
    onsite_ok_cities: z.array(z.string()).default([]),
    exclude_locations: z.array(z.string()).default([]),
  }).default({ preferred_remote: true }),
  scoring_weights: z.object({
    skills_match: z.number().default(0.35),
    seniority_alignment: z.number().default(0.25),
    experience_seniority_fit: z.number().optional(),
    trajectory_fit: z.number().default(0.15),
    compensation_fit: z.number().default(0.10),
    location_fit: z.number().default(0.10),
    location_remote_fit: z.number().optional(),
    company_signals: z.number().default(0.05),
  }).default({
    skills_match: 0.35,
    seniority_alignment: 0.25,
    trajectory_fit: 0.15,
    compensation_fit: 0.10,
    location_fit: 0.10,
    company_signals: 0.05,
  }),
  tiers: z.object({
    A: z.number().default(80),
    B: z.number().default(60),
    C: z.number().default(40),
  }).default({ A: 80, B: 60, C: 40 }),
  career_goals: z.string().default(''),
  llm: z.object({
    provider: z.enum(['openai', 'anthropic', 'ollama', 'mock']).default('mock'),
    model: z.string().default('gpt-4o'),
    ollama_base_url: z.string().optional(),
  }).default({ provider: 'mock', model: 'gpt-4o' }),
});

export type JobCopilotConfig = z.infer<typeof ConfigSchema>;

export function loadConfig(configPath = './config.yaml'): JobCopilotConfig {
  const resolvedPath = path.resolve(process.cwd(), configPath);
  if (!fs.existsSync(resolvedPath)) {
    throw new Error(`Config file not found at ${resolvedPath}. Please run setup or create config.yaml.`);
  }

  const fileContent = fs.readFileSync(resolvedPath, 'utf8');
  const parsedYaml = yaml.parse(fileContent);
  const result = ConfigSchema.safeParse(parsedYaml);

  if (!result.success) {
    const formattedErrors = result.error.errors
      .map((e) => `  - ${e.path.join('.')}: ${e.message}`)
      .join('\n');
    throw new Error(`Invalid configuration in ${configPath}:\n${formattedErrors}`);
  }

  return result.data;
}
