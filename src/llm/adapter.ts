import { JobCopilotConfig } from '../config.js';
import { getDatabase, saveDatabase } from '../db/client.js';

export interface LLMResponse {
  content: string;
  promptTokens: number;
  completionTokens: number;
  costUsd: number;
}

export class LLMAdapter {
  private config: JobCopilotConfig['llm'];

  constructor(config: JobCopilotConfig['llm']) {
    this.config = config;
  }

  async complete(prompt: string, runId = 'run_default'): Promise<LLMResponse> {
    const provider = this.config.provider || 'mock';

    let content = '';
    let promptTokens = Math.ceil(prompt.length / 4);
    let completionTokens = 200;
    let costUsd = 0;

    if (provider === 'openai' && process.env.OPENAI_API_KEY) {
      try {
        const response = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
          },
          body: JSON.stringify({
            model: this.config.model || 'gpt-4o',
            messages: [{ role: 'user', content: prompt }],
            temperature: 0.2,
          }),
        });

        const data = (await response.json()) as any;
        if (data.choices && data.choices[0]) {
          content = data.choices[0].message.content;
          promptTokens = data.usage?.prompt_tokens || promptTokens;
          completionTokens = data.usage?.completion_tokens || completionTokens;
          costUsd = (promptTokens * 0.000005) + (completionTokens * 0.000015);
        } else {
          content = this.getMockResponse(prompt);
        }
      } catch {
        content = this.getMockResponse(prompt);
      }
    } else {
      content = this.getMockResponse(prompt);
    }

    try {
      const db = await getDatabase();
      db.run(
        `INSERT INTO llm_costs (run_id, provider, model, prompt_tokens, completion_tokens, total_cost_usd)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [runId, provider, this.config.model, promptTokens, completionTokens, costUsd]
      );
      saveDatabase();
    } catch {
      // Ignore DB error during standalone testing
    }

    return { content, promptTokens, completionTokens, costUsd };
  }

  private getMockResponse(prompt: string): string {
    if (prompt.includes('STRUCTURING_PROMPT') || prompt.includes('Extract structured job info')) {
      return JSON.stringify({
        title: 'Android Engineer',
        company: 'TechCorp',
        location: 'Remote',
        remote_policy: 'Remote',
        salary_range: { min: 100000, max: 150000, currency: 'USD' },
        seniority: 'Mid-Senior',
        required_skills: ['Kotlin', 'Android SDK', 'Jetpack Compose', 'MVVM', 'Coroutines'],
        nice_to_have_skills: ['Firebase', 'AWS', 'RAG'],
        years_experience: 2,
        visa_sponsorship: false,
        posted_date: new Date().toISOString(),
      });
    }

    return 'Analysis and structuring complete.';
  }
}
