import fetch from 'node-fetch';
import { GITHUB_TOKEN } from '../config';

interface PostReviewOpts {
  owner: string;
  repo: string;
  prNumber: number;
  body: string;
}
// export interface ReviewComment {
//   file: string;
//   start_line: number;
//   end_line: number;
//   line: number;
//   side: string;
//   start_side: string;
//   severity: string;
//   category: string;
//   title: string;
//   comment: string;
//   suggestion: string;
//   code_diff: string;
// }

export async function fetchPRDiff(
  owner: string,
  repo: string,
  pull_number: number,
): Promise<string> {
  const url = `https://api.github.com/repos/${owner}/${repo}/pulls/${pull_number}`;
  try {
    const response = await fetch(url, {
      headers: {
        Authorization: `token ${GITHUB_TOKEN}`,
        Accept: 'application/vnd.github.v3.diff',
      },
    });
  
    if (!response.ok) {
      throw new Error(
        `Failed to fetch PR diff: ${response.status} - ${response.statusText}`,
      );
    }
  
    return response.text();
  } catch (error) {
    throw error
  }
}

export async function postReview(opts: PostReviewOpts) {
  const url = `https://api.github.com/repos/${opts.owner}/${opts.repo}/pulls/${opts.prNumber}/reviews`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `token ${GITHUB_TOKEN}`,
      Accept: 'application/vnd.github.v3+json',
    },
    body: JSON.stringify({ body: opts.body, event: 'COMMENT' }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`GitHub review failed: ${res.status} ${err}`);
  }
}

interface DiffHunk {
  file: string;
  startLine: number;
  endLine: number;
  hunkContent: string;
}
interface Chunk {
  file: string;
  startLine: number;
  endLine: number;
  chunkContent: string;
}

export function parseAndSplitDiff(
  fullDiff: string,
  maxTokenLimit: number,
): Chunk[] {
  const chunks: Chunk[] = [];
  const lines = fullDiff.split('\n');
  let currentFile = '';
  let currentHunk: DiffHunk | null = null;
  let fileContentLines: string[] = [];

  const fileHeaderRegex = /^(---|\+\+\+) (a|b)\/(.+)$/;
  const hunkHeaderRegex = /^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@.*$/;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (line.startsWith('--- a/') || line.startsWith('+++ b/')) {
      const match = line.match(fileHeaderRegex);
      if (match) {
        if (currentFile && fileContentLines.length > 0) {
          addFileOrHunkChunks(
            currentFile,
            fileContentLines.join('\n'),
            chunks,
            maxTokenLimit,
          );
        }
        currentFile = match[3]; 
        fileContentLines = []; 
        currentHunk = null; 
        continue; 
      }
    }

    const hunkMatch = line.match(hunkHeaderRegex);
    if (hunkMatch) {
      if (currentHunk && currentHunk.hunkContent) {
        addFileOrHunkChunks(
          currentHunk.file,
          currentHunk.hunkContent,
          chunks,
          maxTokenLimit,
        );
      }
      const newStartLine = parseInt(hunkMatch[3], 10);
      const newLines = parseInt(hunkMatch[4] || '1', 10);
      currentHunk = {
        file: currentFile,
        startLine: newStartLine,
        endLine: newStartLine + newLines - 1,
        hunkContent: line + '\n',
      };
      fileContentLines.push(line);
    } else if (currentHunk) {
      currentHunk.hunkContent += line + '\n';
      fileContentLines.push(line);
    } else if (currentFile) {
      fileContentLines.push(line);
    }
  }

  if (currentFile && fileContentLines.length > 0) {
    addFileOrHunkChunks(
      currentFile,
      fileContentLines.join('\n'),
      chunks,
      maxTokenLimit,
    );
  } else if (currentHunk && currentHunk.hunkContent) {
    addFileOrHunkChunks(
      currentHunk.file,
      currentHunk.hunkContent,
      chunks,
      maxTokenLimit,
    );
  } else if (fullDiff.trim().length > 0 && chunks.length === 0) {
    addFileOrHunkChunks('unknown_file', fullDiff, chunks, maxTokenLimit);
  }

  return chunks;
}

function addFileOrHunkChunks(
  file: string,
  content: string,
  chunks: Chunk[],
  maxTokenLimit: number,
) {
  const estimatedTokens = content.length / 4;

  if (estimatedTokens <= maxTokenLimit) {
    chunks.push({
      file,
      startLine: 1,
      endLine: content.split('\n').length,
      chunkContent: `FILE: ${file}\n${content}`,
    });
  } else {
    const lines = content.split('\n');
    let currentChunkLines: string[] = [];
    let currentChunkBytes = 0;
    let chunkStartLine = 1; 

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const lineBytes = line.length + 1;
      if (
        currentChunkBytes + lineBytes > maxTokenLimit * 4 &&
        currentChunkLines.length > 0
      ) {
        chunks.push({
          file,
          startLine: chunkStartLine,
          endLine: chunkStartLine + currentChunkLines.length - 1,
          chunkContent: `FILE: ${file}\n${currentChunkLines.join('\n')}`,
        });
        currentChunkLines = [];
        currentChunkBytes = 0;
        chunkStartLine = i + 1;
      }

      currentChunkLines.push(line);
      currentChunkBytes += lineBytes;
    }

    if (currentChunkLines.length > 0) {
      chunks.push({
        file,
        startLine: chunkStartLine,
        endLine: chunkStartLine + currentChunkLines.length - 1,
        chunkContent: `FILE: ${file}\n${currentChunkLines.join('\n')}`,
      });
    }
  }
}

export async function hierarchicalMerge(
  summaries: string[],
  mergeFn: (mergedText: string) => Promise<string>,
  maxPerBatch: number = 10,
): Promise<string> {
  const ERROR_MESSAGES = [
    'error while generating summary',
    'error while generating walkthrough',
  ];

  summaries = summaries.filter(s => !ERROR_MESSAGES.includes(s));

  if (summaries.length <= maxPerBatch) {
    return await mergeFn(summaries.join('\n\n'));
  }

  const batchPromises: Promise<string>[] = [];
  for (let i = 0; i < summaries.length; i += maxPerBatch) {
    const batch = summaries.slice(i, i + maxPerBatch);
    batchPromises.push(mergeFn(batch.join('\n\n')));
  }

  const mergedBatchesResults = await Promise.all(batchPromises);

  const nextLevelSummaries = mergedBatchesResults.filter(
    result => !ERROR_MESSAGES.includes(result),
  );

  return await hierarchicalMerge(nextLevelSummaries, mergeFn, maxPerBatch);
}