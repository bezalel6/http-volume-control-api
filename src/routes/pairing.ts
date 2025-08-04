import { Router, Request, Response, NextFunction } from 'express';
import { pairingService } from '../services/pairing-service-instance';
import { sessionAuth } from '../middleware/session-auth';
import { 
  PairingInitiateRequest, 
  PairingInitiateResponse, 
  PairingCompleteRequest, 
  PairingCompleteResponse,
  SessionListResponse,
  ERROR_CODES 
} from '../types/pairing';

const router = Router();

// GET /api/pairing/status - Check if pairing is available (no auth required)
router.get('/status', (_req: Request, res: Response) => {
  res.json({
    success: true,
    pairingEnabled: true,
    codeLength: parseInt(process.env.PAIRING_CODE_LENGTH || '6'),
    codeExpiry: parseInt(process.env.PAIRING_CODE_EXPIRY || '300'),
    timestamp: new Date().toISOString()
  });
});

// POST /api/pairing/initiate - Start pairing process (no auth required)
router.post('/initiate', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { deviceName } = req.body as PairingInitiateRequest;
    const ipAddress = req.ip || req.socket.remoteAddress;

    const result = await pairingService.initiatePairing(deviceName, ipAddress);

    const response: PairingInitiateResponse = {
      success: true,
      sessionId: result.sessionId,
      expiresIn: result.expiresIn,
      timestamp: new Date().toISOString()
    };

    res.json(response);
  } catch (error: any) {
    if (error.message === ERROR_CODES.PAIRING_RATE_LIMITED) {
      res.status(429).json({
        success: false,
        error: 'Too many pairing attempts. Please try again later.',
        code: ERROR_CODES.PAIRING_RATE_LIMITED,
        timestamp: new Date().toISOString()
      });
      return;
    }
    next(error);
  }
});

// POST /api/pairing/complete - Complete pairing with code (no auth required)
router.post('/complete', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { code, sessionId } = req.body as PairingCompleteRequest;
    const ipAddress = req.ip || req.socket.remoteAddress;
    const userAgent = req.headers['user-agent'];

    if (!code || !sessionId) {
      res.status(400).json({
        success: false,
        error: 'Missing code or sessionId',
        timestamp: new Date().toISOString()
      });
      return;
    }

    const session = await pairingService.completePairing(code, sessionId, ipAddress);
    
    // Store user agent if provided
    if (userAgent && process.env.SESSION_USER_AGENT_CHECK === 'true') {
      session.userAgent = userAgent;
    }

    const response: PairingCompleteResponse = {
      success: true,
      token: session.token,
      session: {
        id: session.id,
        deviceName: session.deviceName,
        createdAt: session.createdAt.toISOString(),
        expiresAt: session.expiresAt.toISOString()
      },
      timestamp: new Date().toISOString()
    };

    res.json(response);
  } catch (error: any) {
    if (error.message === ERROR_CODES.PAIRING_CODE_INVALID) {
      res.status(400).json({
        success: false,
        error: 'Invalid pairing code',
        code: ERROR_CODES.PAIRING_CODE_INVALID,
        timestamp: new Date().toISOString()
      });
      return;
    }
    if (error.message === ERROR_CODES.PAIRING_CODE_EXPIRED) {
      res.status(400).json({
        success: false,
        error: 'Pairing code has expired',
        code: ERROR_CODES.PAIRING_CODE_EXPIRED,
        timestamp: new Date().toISOString()
      });
      return;
    }
    if (error.message === ERROR_CODES.SESSION_LIMIT_REACHED) {
      res.status(400).json({
        success: false,
        error: 'Maximum number of sessions reached',
        code: ERROR_CODES.SESSION_LIMIT_REACHED,
        timestamp: new Date().toISOString()
      });
      return;
    }
    next(error);
  }
});

// Session management routes (require auth)

// GET /api/sessions - List all sessions
router.get('/sessions', sessionAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const sessions = await pairingService.getSessions();
    const currentSessionId = req.session?.id;

    const response: SessionListResponse = {
      success: true,
      sessions: sessions.map(session => ({
        id: session.id,
        deviceName: session.deviceName,
        createdAt: session.createdAt.toISOString(),
        lastUsedAt: session.lastUsedAt.toISOString(),
        expiresAt: session.expiresAt.toISOString(),
        current: session.id === currentSessionId
      })),
      timestamp: new Date().toISOString()
    };

    res.json(response);
  } catch (error) {
    next(error);
  }
});

// GET /api/sessions/current - Get current session info
router.get('/sessions/current', sessionAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const sessionId = req.session?.id;
    if (!sessionId) {
      res.status(404).json({
        success: false,
        error: 'Session not found',
        timestamp: new Date().toISOString()
      });
      return;
    }

    const session = await pairingService.getSession(sessionId);
    if (!session) {
      res.status(404).json({
        success: false,
        error: 'Session not found',
        timestamp: new Date().toISOString()
      });
      return;
    }

    res.json({
      success: true,
      session: {
        id: session.id,
        deviceName: session.deviceName,
        createdAt: session.createdAt.toISOString(),
        lastUsedAt: session.lastUsedAt.toISOString(),
        expiresAt: session.expiresAt.toISOString()
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    next(error);
  }
});

// DELETE /api/sessions/:id - Revoke a specific session
router.delete('/sessions/:id', sessionAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const sessionId = req.params.id;
    const currentSessionId = req.session?.id;

    // Prevent revoking current session
    if (sessionId === currentSessionId) {
      res.status(400).json({
        success: false,
        error: 'Cannot revoke current session. Use logout instead.',
        timestamp: new Date().toISOString()
      });
      return;
    }

    const revoked = await pairingService.revokeSession(sessionId);
    
    if (!revoked) {
      res.status(404).json({
        success: false,
        error: 'Session not found',
        timestamp: new Date().toISOString()
      });
      return;
    }

    res.json({
      success: true,
      message: 'Session revoked successfully',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/sessions/logout - Logout current session
router.post('/sessions/logout', sessionAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const sessionId = req.session?.id;
    if (!sessionId) {
      res.status(400).json({
        success: false,
        error: 'No active session',
        timestamp: new Date().toISOString()
      });
      return;
    }

    await pairingService.revokeSession(sessionId);

    res.json({
      success: true,
      message: 'Logged out successfully',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    next(error);
  }
});

export default router;