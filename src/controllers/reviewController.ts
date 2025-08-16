import { Request, Response } from 'express';
import { getCodeReviewFromCode } from '../services/reviewService';

export async function getReviewResponse(req: Request, res: Response) {
  const { owner, repo, prNumber } = req.body;
  if (!owner || !repo || !prNumber) {
    return res
      .status(400)
      .json({ error: 'owner, repo, prNumber are required' });
  }
  try {
    const review = await getCodeReviewFromCode(owner, repo, Number(prNumber));
    res.json({ review });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
}
