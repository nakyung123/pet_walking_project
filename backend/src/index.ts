import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import router from './routes';
import { errorHandler } from './middlewares/errorHandler';
import { startDecayJob } from './jobs/decayJob';

dotenv.config();

const app = express();

app.use(cors());
app.use(express.json());

// 헬스 체크
app.get('/health', (_req, res) => {
  res.json({ success: true, data: { status: 'ok' }, error: null });
});

// API 라우터
app.use('/api', router);

// 글로벌 에러 핸들러
app.use(errorHandler);

// 테스트 환경에서는 listen하지 않음
if (process.env.NODE_ENV !== 'test') {
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => {
    console.log(`[Server] Pet Territory 서버 실행 중: http://localhost:${PORT}`);
    startDecayJob();
  });
}

export default app;
