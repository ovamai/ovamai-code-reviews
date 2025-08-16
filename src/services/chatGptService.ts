import OpenAI from 'openai';
import { ChatCompletionMessageParam } from 'openai/resources/chat';
import logger from '../utils/logger';
import fs from 'fs';
import path from 'path';
import { OPENAI_API_KEY, OPENAI_MODEL } from '../config';

const openai = new OpenAI({ apiKey: OPENAI_API_KEY });

const prompts = JSON.parse(
  fs.readFileSync(
    path.resolve(__dirname, '../config/prompts.private.json'),
    'utf-8',
  ),
);

export async function getCodeReview(diff: string): Promise<string> {
  if (!diff?.trim()) {
    logger.info(`Diff parameter is missing`);
    throw new Error('Diff parameter is required');
  }
  const messages: ChatCompletionMessageParam[] = [
    {
      role: 'system',
      content: prompts.reviewSystemPrompt,
    },
    {
      role: 'user',
      content: `
  Please review the following Git diff (_in triple-backticks_) and give me feedback under the prescribed headings:
  
  \`\`\`diff
  ${diff}
  \`\`\`
  `,
    },
  ];
  const resp = await openai.chat.completions.create({
    model: OPENAI_MODEL,
    messages: messages,
  });
  logger.info(`got chat gpt response`);
  const choice = resp.choices?.[0];
  const msg = choice?.message;
  if (!msg?.content) {
    throw new Error('No reply from ChatGPT');
  }
  return msg.content.trim();
}

export async function getCodeSuggestion(diff: string): Promise<string> {
  if (!diff?.trim()) {
    logger.info(`Diff parameter is missing`);
    throw new Error('Diff parameter is required');
  }
  const messages: ChatCompletionMessageParam[] = [
    {
      role: 'system',
      content: prompts.suggestionSystemPrompt,
    },
    {
      role: 'user',
      content: diff
    }
  ];

  const resp = await openai.chat.completions.create({
    model: OPENAI_MODEL,
    messages: messages,
  });
  logger.info(`got chat gpt response`);
  const choice = resp.choices?.[0];
  const msg = choice?.message;
  if (!msg?.content) {
    throw new Error('No reply from ChatGPT');
  }
  return msg.content.trim();
}

export async function getCodeReplySuggestion(diff: string): Promise<string> {
  if (!diff?.trim()) {
    logger.info(`Diff parameter is missing`);
    throw new Error('Diff parameter is required');
  }
  const messages: ChatCompletionMessageParam[] = [
    {
      role: 'system',
      content: prompts.suggestionMasterPrompt,
    },
    {
      role: 'user',
      content: diff
    }
  ];

  const resp = await openai.chat.completions.create({
    model: OPENAI_MODEL,
    messages: messages,
  });

  const choice = resp.choices?.[0];
  const msg = choice?.message;
  if (!msg?.content) {
    throw new Error('No reply from ChatGPT');
  }

  return msg.content.trim();
}

export async function reviewWithAI(prompt: string): Promise<string> {
  const resp = await openai.chat.completions.create({
    model: OPENAI_MODEL,
    messages: [
      { role: 'system', content: 'You are Ovamai, a code review assistant.' },
      { role: 'user', content: prompt },
    ],
    temperature: 0.7,
    max_tokens: 1500,
  });
  const choice = resp.choices?.[0];
  const msg = choice?.message;
  if (!msg?.content) {
    throw new Error('No reply from ChatGPT');
  }
  return msg.content.trim();
}
