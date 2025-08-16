import { Router } from 'express';
import { fetchPRDiffController } from '../controllers/githubController';

const router = Router();

router.post('/fetchPRDiff', fetchPRDiffController);

export default router;
