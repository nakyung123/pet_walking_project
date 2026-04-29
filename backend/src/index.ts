import http from 'http';
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import router from './routes';
import { errorHandler } from './middlewares/errorHandler';
import { runMigrations } from './db/migrate';
import { startDecayJob } from './jobs/decayJob';
import { initSocketIO } from './socket';
import logger from './utils/logger';
import { env } from './config/env';
import { globalLimiter } from './middlewares/rateLimiter';

dotenv.config();

// 환경 변수 검증 (테스트 환경에서는 건너뜀)
void env;

const app = express();

const ALLOWED_ORIGINS = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',').map((o) => o.trim())
  : ['http://localhost:3001', 'http://localhost:3000'];

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || ALLOWED_ORIGINS.includes(origin)) return callback(null, true);
    callback(new Error(`CORS: origin ${origin} 차단`));
  },
  credentials: true,
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));
app.use(globalLimiter);

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
  const httpServer = http.createServer(app);

  initSocketIO(httpServer);

  runMigrations()
    .then(() => {
      httpServer.listen(PORT, () => {
        logger.info(`Pet Territory 서버 실행 중: http://localhost:${PORT}`);
        startDecayJob();
      });
    })
    .catch((err) => {
      logger.error(`[Migration] 실패: ${err.message}`);
      process.exit(1);
    });
}

export default app;
