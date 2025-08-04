import { Request, Response, NextFunction } from 'express';
import { pairingService } from '../services/pairing-service-instance';
import { ERROR_CODES } from '../types/pairing';
import pino from 'pino';

const logger = pino({
  level: process.env.LOG_LEVEL || 'debug',
  transport: {
    target: 'pino-pretty',
    options: {
      colorize: true,
      translateTime: 'HH:MM:ss',
      ignore: 'pid,hostname'
    }
  }
});

// Extend Express Request type to include session
declare global {
  namespace Express {
    interface Request {
      session?: {
        id: string;
        deviceName: string;
      };
    }
  }
}

export function sessionAuth(req: Request, res: Response, next: NextFunction): void {
  // Extract token from Authorization header
  const authHeader = req.headers.authorization;
  
  logger.debug({ 
    path: req.path,
    method: req.method,
    hasAuth: !!authHeader,
    authType: authHeader ? authHeader.substring(0, 10) : null
  }, 'Session auth check');
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    logger.warn({ path: req.path }, 'Missing or invalid authorization header');
    res.status(401).json({
      success: false,
      error: 'Missing or invalid authorization header',
      code: ERROR_CODES.UNAUTHORIZED,
      timestamp: new Date().toISOString()
    });
    return;
  }

  const token = authHeader.substring(7); // Remove 'Bearer ' prefix

  // Validate session
  pairingService.validateSession(token)
    .then(session => {
      if (!session) {
        logger.warn({ token: token.substring(0, 10) + '...' }, 'Invalid or expired session token');
        res.status(401).json({
          success: false,
          error: 'Invalid or expired session token',
          code: ERROR_CODES.SESSION_INVALID,
          timestamp: new Date().toISOString()
        });
        return;
      }

      // Check IP binding if enabled
      if (process.env.SESSION_IP_BINDING === 'true' && session.ipAddress) {
        const clientIp = req.ip || req.socket.remoteAddress;
        if (clientIp !== session.ipAddress) {
          res.status(401).json({
            success: false,
            error: 'Session IP mismatch',
            code: ERROR_CODES.SESSION_INVALID,
            timestamp: new Date().toISOString()
          });
          return;
        }
      }

      // Check user agent if enabled
      if (process.env.SESSION_USER_AGENT_CHECK === 'true' && session.userAgent) {
        const clientUserAgent = req.headers['user-agent'];
        if (clientUserAgent !== session.userAgent) {
          res.status(401).json({
            success: false,
            error: 'Session user agent mismatch',
            code: ERROR_CODES.SESSION_INVALID,
            timestamp: new Date().toISOString()
          });
          return;
        }
      }

      // Attach session info to request
      req.session = {
        id: session.id,
        deviceName: session.deviceName
      };

      logger.debug({ 
        sessionId: session.id,
        deviceName: session.deviceName,
        path: req.path 
      }, 'Session authenticated successfully');

      next();
    })
    .catch((error) => {
      logger.error({ error, path: req.path }, 'Failed to validate session');
      res.status(500).json({
        success: false,
        error: 'Failed to validate session',
        timestamp: new Date().toISOString()
      });
    });
}

// Optional middleware for endpoints that don't require auth
export function optionalSessionAuth(req: Request, _res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    // No auth provided, continue without session
    next();
    return;
  }

  const token = authHeader.substring(7);

  pairingService.validateSession(token)
    .then(session => {
      if (session) {
        req.session = {
          id: session.id,
          deviceName: session.deviceName
        };
      }
      next();
    })
    .catch(() => {
      // Ignore validation errors for optional auth
      next();
    });
}