import { Request, Response } from 'express';
import { botReview, getCodeReviewFromCode } from '../services/reviewService';
import logger from '../utils/logger';

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

export async function getReviewResponseBigFile(req: Request, res: Response) {
  const { owner, repo, prNumber } = req.body;
  if (!owner || !repo || !prNumber) {
    return res
      .status(400)
      .json({ error: 'owner, repo, prNumber are required' });
  }
  try {
    const response = await botReview(owner, repo, Number(prNumber))

    return res.status(200).json({ status: true, response }); 
  } catch (err: any) {
    logger.error(`Failed to post review ${err.message || err}`)
    res.status(500).json({ error: "Failed to post review response" });
  }
}
