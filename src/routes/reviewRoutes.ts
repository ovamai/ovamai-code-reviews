import { Router } from 'express';
import { getReviewResponse } from '../controllers/reviewController';

const router = Router();

router.post('/prreview', getReviewResponse);

export default router;
