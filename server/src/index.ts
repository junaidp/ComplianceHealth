import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import path from 'path';
import { PrismaClient } from '@prisma/client';
import authRoutes from './routes/auth';
import organizationRoutes from './routes/organizations';
import controlRoutes from './routes/controls';
import assessmentRoutes from './routes/assessments';
import remediationRoutes from './routes/remediation';
import evidenceRoutes from './routes/evidence';
import trainingRoutes from './routes/training';
import dashboardRoutes from './routes/dashboard';
import auditLogRoutes from './routes/auditLog';
import aiRoutes from './routes/ai';

export const prisma = new PrismaClient();

const app = express();
const PORT = process.env.PORT || 3001;

app.use(helmet({
  contentSecurityPolicy: process.env.NODE_ENV === 'production' ? false : undefined,
}));
app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
  credentials: true,
}));
app.use(compression());
app.use(morgan('dev'));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Health check
app.get('/api/v1/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Routes
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/organizations', organizationRoutes);
app.use('/api/v1/controls', controlRoutes);
app.use('/api/v1/assessments', assessmentRoutes);
app.use('/api/v1/remediation', remediationRoutes);
app.use('/api/v1/evidence', evidenceRoutes);
app.use('/api/v1/training', trainingRoutes);
app.use('/api/v1/dashboard', dashboardRoutes);
app.use('/api/v1/audit-log', auditLogRoutes);
app.use('/api/v1/ai', aiRoutes);

// Serve frontend static files in production
if (process.env.NODE_ENV === 'production') {
  const clientPath = path.join(__dirname, '../../dist');
  app.use(express.static(clientPath));
  app.get('/*', (_req, res) => {
    res.sendFile(path.join(clientPath, 'index.html'));
  });
}

// Global error handler
app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('Unhandled error:', err);
  res.status(err.status || 500).json({
    error: err.message || 'Internal server error',
    code: err.code || 'INTERNAL_ERROR',
    details: process.env.NODE_ENV === 'development' ? err.stack : null,
  });
});

async function main() {
  try {
    await prisma.$connect();
    console.log('Database connected');
    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

main();

export default app;
