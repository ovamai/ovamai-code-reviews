import app from './app';
import { PORT } from './config';

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
