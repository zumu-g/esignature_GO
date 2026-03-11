import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import dotenv from 'dotenv';

import healthRouter from './routes/health';
import authRouter from './routes/auth';
import documentsRouter from './routes/documents';
import signingRouter from './routes/signing';
import signaturesRouter from './routes/signatures';
import creditsRouter from './routes/credits';
import { errorHandler } from './middleware/error';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors({
  origin: true,
  credentials: true,
}));
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
  contentSecurityPolicy: false,
}));
app.use(morgan('dev'));
app.use(express.json({ limit: '10mb', type: 'application/json' }));
app.use(express.urlencoded({ extended: true, type: 'application/x-www-form-urlencoded' }));

// Routes
app.use('/health', healthRouter);
app.use('/api/auth', authRouter);
app.use('/api/documents', documentsRouter);
app.use('/api/sign', signingRouter);
app.use('/api/signatures', signaturesRouter);
app.use('/api/credits', creditsRouter);

// Error handler
app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`eSignatureGO API running on http://localhost:${PORT}`);
});

export default app;
