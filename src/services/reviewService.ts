import {
  fetchPRDiff,
  hierarchicalMerge,
  parseAndSplitDiff,
  postReview,
} from './githubService';
import {
  generateSummaryFromDynamicJson,
  getCodeReview,
  getOverAllPrSummary,
  getPrCodeReviewComments,
  getPrSummary,
  getPrWalkthrough,
  getUnifiedPRAnalysisPrompt,
  reviewWithAI,
} from './chatGptService';
import {
  chunkDiff,
  cleanJsonResponse,
  getTokenCount,
} from '../utils/diffUtils';
import fs from 'fs';
import path from 'path';
import logger from '../utils/logger';

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

export interface ReviewComment {
  path: string;
  body: string;
  line?: number;
  start_line?: number;
  side?: 'LEFT' | 'RIGHT';
}

export interface BotReviewResult {
  status: 'ok' | 'error';
  summary?: string;
  walkthrough?: unknown;
  comments?: ReviewComment[];
  tokensUsed?: number;
  meta?: {
    chunked: boolean;
    chunkCount: number;
    diffLength: number;
  };
  error?: string;
}

export async function botReview(
  owner: string,
  repo: string,
  prNumber: number,
): Promise<BotReviewResult> {
  try {
    const diff = await fetchPRDiff(owner, repo, prNumber);

    if (!diff || diff.length === 0) {
      return {
        status: 'error',
        error: 'No diff found for this PR.',
        meta: { chunked: false, chunkCount: 0, diffLength: diff?.length ?? 0 },
      };
    }

    const diffLength = diff.length;
    let initialTokens = getTokenCount(diff + prompts.CR_UnifiedPRAnalysisPrompt);
    logger.info(
      `Token count for PR diff length ${diffLength} #${prNumber} in ${repo}: ${initialTokens}`,
    );

    if (diffLength > 20000) {
      const chunks = parseAndSplitDiff(diff, 20000);

      const prSummaries: string[] = [];
      const prWalkthroughs: unknown[] = [];
      const allReviewComments: ReviewComment[] = [];
      let totalTokensUsed = 0;

      const results = await Promise.all(
        chunks.map(async (chunk, idx) => {
          try {
            const tokens = getTokenCount(
              chunk.chunkContent + prompts.CR_UnifiedPRAnalysisPrompt,
            );
            logger.info(
              `Chunk ${idx + 1}/${chunks.length} token count: ${tokens} (lines ${chunk.startLine}-${chunk.endLine})`,
            );

            const combined = await getUnifiedPRAnalysisPrompt(
              chunk.chunkContent,
              tokens,
            );

            totalTokensUsed += combined?.usedToken || 0;
            const refined = cleanJsonResponse(combined?.text);
            const parsed = JSON.parse(refined!);

            return { ok: true as const, parsed };
          } catch (e: any) {
            logger.error(
              `❌ Error processing chunk ${idx + 1}: ${e?.message || e}`,
            );
            return { ok: false as const, error: e?.message || String(e) };
          }
        }),
      );

      for (const r of results) {
        if (!r.ok) continue;
        const result = r.parsed;

        if (result?.summary) prSummaries.push(JSON.stringify(result.summary));
        if (result?.walkthrough) prWalkthroughs.push(result.walkthrough);

        if (Array.isArray(result?.codeReviewComments)) {
          allReviewComments.push(...result.codeReviewComments);
        } else {
          logger.warn(
            '⚠️ codeReviewComments missing or not an array in a chunk result.',
          );
        }
      }

      let finalSummary = '';
      if (prSummaries.length > 0) {
        try {
          const mergedRaw = await hierarchicalMerge(
            prSummaries,
            getOverAllPrSummary,
          );
          finalSummary = generateSummaryFromDynamicJson(JSON.parse(mergedRaw));
        } catch (e) {
          logger.warn(
            `Summary merge failed, falling back to concatenation: ${
              (e as Error)?.message || e
            }`,
          );
          finalSummary = prSummaries
            .map(s => {
              try {
                return generateSummaryFromDynamicJson(JSON.parse(s));
              } catch {
                return s;
              }
            })
            .join('\n\n');
        }
      }

      const finalWalkthrough =
        prWalkthroughs.length <= 1 ? prWalkthroughs[0] : prWalkthroughs;

      return {
        status: 'ok',
        summary: finalSummary,
        walkthrough: finalWalkthrough,
        comments: allReviewComments,
        tokensUsed: totalTokensUsed,
        meta: {
          chunked: true,
          chunkCount: chunks.length,
          diffLength,
        },
      };
    }

    const [prSummaryRaw, prWalkthroughRaw, prCodeReviewComments] =
      await Promise.all([
        getPrSummary(`FILE: FullPR\n${diff}`),
        getPrWalkthrough(`FILE: FullPR\n${diff}`),
        getPrCodeReviewComments(`FILE: FullPR\n${diff}`),
      ]);

    let cleanPrSummary = '';
    try {
      cleanPrSummary = generateSummaryFromDynamicJson(
        JSON.parse(prSummaryRaw),
      );
    } catch (e) {
      logger.warn(`Summary parse failed, returning raw string. ${e}`);
      cleanPrSummary = String(prSummaryRaw);
    }

    let prWalkthrough: unknown = prWalkthroughRaw;
    try {
      prWalkthrough = JSON.parse(prWalkthroughRaw);
    } catch(e) {
      logger.warn(`WalkThrough JSON parse failed: ${e}`)
    }

    let parsedComments: ReviewComment[] = [];
    try {
      parsedComments = JSON.parse(prCodeReviewComments);
      if (!Array.isArray(parsedComments)) parsedComments = [];
    } catch (e) {
      logger.warn(`Comments JSON parse failed: ${e}`);
    }

    return {
      status: 'ok',
      summary: cleanPrSummary,
      walkthrough: prWalkthrough,
      comments: parsedComments,
      meta: {
        chunked: false,
        chunkCount: 1,
        diffLength,
      },
    };
  } catch (error: any) {
    logger.error('botReview failed', error);
    return {
      status: 'error',
      error: error?.message || String(error),
    };
  }
}

