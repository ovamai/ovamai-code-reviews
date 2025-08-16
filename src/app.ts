import express, { Request, Response } from 'express';
import cors from 'cors';
import morgan from 'morgan';
import dotenv from 'dotenv';

import reviewRoutes from './routes/reviewRoutes';
import githubRoutes from './routes/githubRoutes';
import logger from './utils/logger';

dotenv.config();

const app = express();

app.use(cors({ origin: true, credentials: true }));
app.use(express.json());

app.use(
  morgan('combined', {
    stream: {
      write: (message) => logger.http(message.trim()),
    },
  }),
);

app.use('/api/v1/review', reviewRoutes);
app.use('/api/v1/github', githubRoutes);

app.get('/', (_req: Request, res: Response) => {
  res.send('Server is running just fine!!');
});

export default app;
