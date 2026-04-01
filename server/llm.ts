// server/llm.ts
// LLM abstraction — supports Anthropic and OpenAI interchangeably
// Usage: const response = await llm.complete({ system, messages, maxTokens })

import Anthropic from '@anthropic-ai/sdk';
import OpenAI from 'openai';
import { logger } from './logger';

const provider = process.env.LLM_PROVIDER || 'anthropic';
const defaultMaxTokens = parseInt(process.env.LLM_MAX_TOKENS || '4096');
const defaultTemperature = parseFloat(process.env.LLM_TEMPERATURE || '0.7');

const anthropic = provider === 'anthropic' ? new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
}) : null;

const openai = provider === 'openai' ? new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
}) : null;

export interface LLMMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface LLMRequest {
  system: string;
  messages: LLMMessage[];
  maxTokens?: number;
  temperature?: number;
}

export interface LLMResponse {
  content: string;
  inputTokens: number;
  outputTokens: number;
  model: string;
}

export async function complete(req: LLMRequest): Promise<LLMResponse> {
  const model = process.env.LLM_MODEL || (provider === 'openai' ? 'gpt-4o' : 'claude-opus-4-20250514');

  if (provider === 'anthropic' && anthropic) {
    try {
      const response = await anthropic.messages.create({
        model,
        max_tokens: req.maxTokens || defaultMaxTokens,
        temperature: req.temperature || defaultTemperature,
        system: req.system,
        messages: req.messages,
      });
      const result: LLMResponse = {
        content: response.content[0].type === 'text' ? response.content[0].text : '',
        inputTokens: response.usage.input_tokens,
        outputTokens: response.usage.output_tokens,
        model: response.model,
      };
      logger.info({ model: response.model, inputTokens: result.inputTokens, outputTokens: result.outputTokens }, 'LLM call completed');
      return result;
    } catch (error: any) {
      logger.error({ error: error.message, provider: 'anthropic' }, 'LLM call failed');
      throw new Error(`Anthropic API error: ${error.message}`);
    }
  }

  if (provider === 'openai' && openai) {
    try {
      const response = await openai.chat.completions.create({
        model,
        max_tokens: req.maxTokens || defaultMaxTokens,
        temperature: req.temperature || defaultTemperature,
        messages: [
          { role: 'system', content: req.system },
          ...req.messages,
        ],
      });
      const result: LLMResponse = {
        content: response.choices[0].message.content || '',
        inputTokens: response.usage?.prompt_tokens || 0,
        outputTokens: response.usage?.completion_tokens || 0,
        model: response.model,
      };
      logger.info({ model: response.model, inputTokens: result.inputTokens, outputTokens: result.outputTokens }, 'LLM call completed');
      return result;
    } catch (error: any) {
      logger.error({ error: error.message, provider: 'openai' }, 'LLM call failed');
      throw new Error(`OpenAI API error: ${error.message}`);
    }
  }

  throw new Error(`LLM provider '${provider}' not configured. Set LLM_PROVIDER and corresponding API key.`);
}

export function isLLMConfigured(): boolean {
  if (provider === 'anthropic' && process.env.ANTHROPIC_API_KEY) return true;
  if (provider === 'openai' && process.env.OPENAI_API_KEY) return true;
  return false;
}

export default { complete, isLLMConfigured };
