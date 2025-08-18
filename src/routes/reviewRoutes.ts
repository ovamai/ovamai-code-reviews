import { Router } from 'express';
import { getReviewResponse, getReviewResponseBigFile } from '../controllers/reviewController';

const router = Router();

router.post('/prreview', getReviewResponse);

router.post('/post-review', getReviewResponseBigFile)

export default router;
