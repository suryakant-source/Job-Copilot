import test from 'node:test';
import assert from 'node:assert/strict';
import { LLMAdapter } from '../llm/adapter.js';

test('LLMAdapter supports gemini and groq providers', async () => {
  const geminiAdapter = new LLMAdapter({ provider: 'gemini', model: 'gemini-1.5-flash' });
  const geminiRes = await geminiAdapter.complete('Extract job details');
  assert.ok(geminiRes.content.length > 0);

  const groqAdapter = new LLMAdapter({ provider: 'groq', model: 'llama-3.3-70b-versatile' });
  const groqRes = await groqAdapter.complete('Extract job details');
  assert.ok(groqRes.content.length > 0);
});
