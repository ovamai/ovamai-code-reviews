import OpenAI from 'openai';
import { ChatCompletionMessageParam } from 'openai/resources/chat';
import logger from '../utils/logger';
import fs from 'fs';
import path from 'path';
import { OPENAI_API_KEY, OPENAI_MODEL } from '../config';
import { toTitleCase } from '../utils/diffUtils';

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

export async function getPrSummary(diff: String) {
  try {
    const resp = await openai.chat.completions.create({
      model: OPENAI_MODEL,
      messages: [
        {
          role: 'system',
          content: prompts.CR_PRSummaryPrompt_chatGPT,
        },
        {
          role: 'user',
          content: `Here is the PR diff:\n\n${diff}`, 
        },
      ],
      temperature: 0,
      max_tokens: 3000,
    });
    const choice = resp.choices?.[0];
    const msg = choice?.message;
    if (!msg?.content) {
      throw new Error('No reply from ChatGPT');
    }
    return msg.content.trim();
  } catch (error) {
    logger.error('Error generating PR summary:', error);
    throw new Error('Failed to generate PR summary');
  }
}


export async function getPrWalkthrough(diff: String) {
  try {
    const resp = await openai.chat.completions.create({
      model: OPENAI_MODEL,
      messages: [
        {
          role: 'system',
          content: prompts.CR_PRWalkthroughPrompt_Claude,
        },
        {
          role: 'user',
          content: `Here is the PR diff:\n\n${diff}`,
        },
      ],
      temperature: 0,
      max_tokens: 3000,
    });
    const choice = resp.choices?.[0];
    const msg = choice?.message;
    if (!msg?.content) {
      throw new Error('No reply from ChatGPT');
    }
    return msg.content.trim();
  } catch (error) {
    logger.error('Error generating walk through:', error);
    throw new Error('Failed to generate walk through');
  }
}


export async function getOverAllPrSummary(comments: any) {
  try {
    const resp = await openai.chat.completions.create({
      model: OPENAI_MODEL,
      messages: [
        {
          role: 'system',
          content: prompts.CR_PRSummaryConsolidationPrompt_chatGPT,
        },
        {
          role: 'user',
          content: `Here is the PR diff:\n\n${comments}`,
        },
      ],
      temperature: 0,
      max_tokens: 3000,
    });
    const choice = resp.choices?.[0];
    const msg = choice?.message;
    if (!msg?.content) {
      console.error('No reply from ChatGPT');
      return 'error while generating summary';
    }
    return msg.content.trim();
  } catch (error) {
    console.error('Error generating Review comments:', error);
    return 'error while generating summary';
  }
}

export function generateSummaryFromDynamicJson(
  data: Record<string, string[]>,
): string {
  let summary = `## Summary by OvamAI\n\n`;

  for (const key in data) {
    const items = data[key];
    if (Array.isArray(items) && items.length > 0) {
      const sectionTitle = toTitleCase(key);
      summary += `#### ${sectionTitle}\n`;
      for (const item of items) {
        summary += `- ${item}\n`;
      }
      summary += `\n`;
    }
  }

  return summary.trim();
}

export async function getPrCodeReviewComments(diff: String) {
  try {
    const resp = await openai.chat.completions.create({
      model: OPENAI_MODEL,
      messages: [
        {
          role: 'system',
          content: prompts.CR_CodeReviewCommentsPrompt_ClaudeAi,
        },
        {
          role: 'user',
          content: `Here is the PR diff:\n\n${diff}`,
        },
      ],
      temperature: 0,
      max_tokens: 3000,
    });
    const choice = resp.choices?.[0];
    const msg = choice?.message;
    if (!msg?.content) {
      throw new Error('No reply from ChatGPT');
    }
    return msg.content.trim();
  } catch (error) {
    console.error('Error generating Review comments:', error);
    throw new Error('Failed to generate Review comments');
  }
}

export async function getUnifiedPRAnalysisPrompt(
  diff: String,
  chunkToken: number,
) {
  try {
    const resp = await openai.chat.completions.create({
      model: OPENAI_MODEL,
      messages: [
        {
          role: 'system',
          content: prompts.CR_UnifiedPRAnalysisPrompt,
        },
        {
          role: 'user',
          content: `Here is the PR diff:\n\n${diff}`, 
        },
      ],
      temperature: 0,
      max_tokens: 3000,
    });
    const choice = resp.choices?.[0];
    const msg = choice?.message;
    if (!msg?.content) {
      throw new Error('No reply from ChatGPT');
    }
    return {
      text: msg.content.trim(),
      usedToken: chunkToken + 1000,
    };
  } catch (error) {
    console.error('Error generating Review comments:', error);
    throw new Error('Failed to generate Review comments');
  }
}