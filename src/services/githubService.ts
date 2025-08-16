import fetch from 'node-fetch';
import { GITHUB_TOKEN } from '../config';

interface PostReviewOpts {
  owner: string;
  repo: string;
  prNumber: number;
  body: string;
}

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
