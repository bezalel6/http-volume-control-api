import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
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
import pairingRouter from './routes/pairing';
import debugRouter from './routes/debug';

// Import middleware
import { sessionAuth } from './middleware/session-auth';
import { errorHandler } from './middleware/error-handler';
import { apiLimiter, strictApiLimiter, healthCheckLimiter, authLimiter } from './middleware/rate-limiter';

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

// CORS configuration - Allow all origins since we have pairing-based authentication
const corsOptions = {
  origin: true, // Allow all origins
  credentials: true, // Allow cookies for session management
  optionsSuccessStatus: 200
};
app.use(cors(corsOptions));

// Request logging (simple middleware)
app.use((req, _res, next) => {
  logger.info({ method: req.method, url: req.url }, 'Request');
  next();
});

// Body parsing
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Static file serving for icons
app.use('/icons', express.static(path.join(process.cwd(), 'icons')));

// Health check with its own rate limiter
app.get('/health', healthCheckLimiter, (_req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// Pairing routes with auth rate limiter
app.use('/api/pairing', authLimiter, pairingRouter);

// Protected API routes with rate limiting
app.use('/api/devices', sessionAuth, apiLimiter, devicesRouter);
app.use('/api/applications', sessionAuth, strictApiLimiter, applicationsRouter);
app.use('/api/processes', sessionAuth, apiLimiter, processesRouter);
app.use('/api/settings', sessionAuth, apiLimiter, settingsRouter);
app.use('/api', apiLimiter, pairingRouter); // Session management routes

// Debug routes (only in development)
if (process.env.NODE_ENV !== 'production') {
  app.use('/api/debug', debugRouter);
}

// Error handling
app.use(errorHandler);

// 404 handler
app.use((_req, res) => {
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
  logger.info(`🔐 Pairing-based authentication enabled`);
  logger.info(`🔢 Pairing code length: ${process.env.PAIRING_CODE_LENGTH || '6'} characters`);
  logger.info(`⏱️  Pairing code expiry: ${process.env.PAIRING_CODE_EXPIRY || '300'} seconds`);
  logger.info(`🌐 CORS: Accepting all origins (secured via pairing authentication)`);
  logger.info(`\n📱 To pair a device, use POST /api/pairing/initiate`);
});