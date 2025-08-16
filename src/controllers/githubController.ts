import { Request, Response } from 'express';
import { fetchPRDiff } from '../services/githubService';
import logger from '../utils/logger';

export const fetchPRDiffController = async (req: Request, res: Response) => {
  try {
    const { owner, repo, prNumber } = req.body;

    if (!owner || !repo || !prNumber) {
      return res
        .status(400)
        .json({ status: false, message: 'Required param missing' });
    }

    const diff = await fetchPRDiff(owner, repo,prNumber);
    return res.status(200).json({ status: true, data: diff });
  } catch (error) {
    logger.error('Error fetching PR diff:', error);
    return res.status(500).json({ status: false, message: 'Internal server error' });
  }
};