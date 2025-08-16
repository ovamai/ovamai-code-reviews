import { fetchPRDiff, postReview } from './githubService';
import { getCodeReview, reviewWithAI } from './chatGptService';
import { chunkDiff } from '../utils/diffUtils';
import fs from 'fs';
import path from 'path';

const prompts = JSON.parse(
  fs.readFileSync(
    path.resolve(__dirname, '../config/prompts.private.json'),
    'utf-8',
  ),
);

interface PRContext {
  owner: string;
  repo: string;
  prNumber: number;
  diff: string;
}

export async function getCodeReviewFromCode(
  owner: string,
  repo: string,
  prNumber: number,
): Promise<string> {
  try {
    const diff = await fetchPRDiff(owner, repo, prNumber);
    return await getCodeReview(diff);
  } catch (error) {
    throw error;
  }
}

export async function handlePullRequest(ctx: PRContext) {
  const chunks = chunkDiff(ctx.diff);

  const reviews = await Promise.all(
    chunks.map(async (chunk, idx) => {
      const prompt = `
You are Ovamai, an expert code reviewer.
Review the following diff hunk (#${idx + 1}/${chunks.length}):

\`\`\`diff
${chunk}
\`\`\`

Give me actionable comments in markdown.
`;
      return reviewWithAI(prompt);
    }),
  );

  const fullReviewBody = reviews
    .map((r, i) => `### Review chunk ${i + 1}\n${r}`)
    .join('\n\n---\n\n');

  await postReview({
    owner: ctx.owner,
    repo: ctx.repo,
    prNumber: ctx.prNumber,
    body: fullReviewBody,
  });
}