import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import pino from 'pino';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config();

// Import routes
import devicesRouter from './routes/devices';
import applicationsRouter from './routes/applications';
import processesRouter from './routes/processes';
import settingsRouter from './routes/settings';
import debugRouter from './routes/debug';

// Import middleware
import { apiKeyAuth } from './middleware/auth';
import { errorHandler } from './middleware/error-handler';

// Create Express app
const app = express();
const port = process.env.PORT || 3001;

// Logger setup
const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  transport: {
    target: 'pino-pretty',
    options: {
      colorize: true,
      translateTime: 'HH:MM:ss Z',
      ignore: 'pid,hostname'
    }
  }
});

// Middleware
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" } // Allow icon serving
}));

// CORS configuration
const corsOptions = {
  origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
    const allowedOrigins = process.env.CORS_ORIGIN?.split(',') || ['http://localhost:5173'];
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  optionsSuccessStatus: 200
};
app.use(cors(corsOptions));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.'
});
app.use('/api', limiter);

// Request logging (simple middleware)
app.use((req, res, next) => {
  logger.info({ method: req.method, url: req.url }, 'Request');
  next();
});

// Body parsing
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Static file serving for icons
app.use('/icons', express.static(path.join(process.cwd(), 'icons')));

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// API routes
app.use('/api/devices', apiKeyAuth, devicesRouter);
app.use('/api/applications', apiKeyAuth, applicationsRouter);
app.use('/api/processes', apiKeyAuth, processesRouter);
app.use('/api/settings', apiKeyAuth, settingsRouter);

// Debug routes (only in development)
if (process.env.NODE_ENV !== 'production') {
  app.use('/api/debug', debugRouter);
}

// Error handling
app.use(errorHandler);

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: 'Endpoint not found',
    timestamp: new Date().toISOString()
  });
});

// Start server
app.listen(port, () => {
  logger.info(`🎵 HTTP Volume Control API listening on port ${port}`);
  logger.info(`📍 Health check: http://localhost:${port}/health`);
  logger.info(`🔐 API Key Auth: ${process.env.API_KEY_ENABLED === 'true' ? 'Enabled' : 'Disabled'}`);
  logger.info(`🌐 CORS Origins: ${process.env.CORS_ORIGIN || 'http://localhost:5173'}`);
});