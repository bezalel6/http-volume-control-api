import { randomBytes } from 'crypto';
import { promises as fs } from 'fs';
import path from 'path';
import pino from 'pino';
import { PairingCode, Session, ERROR_CODES } from '../types/pairing';

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

export class PairingService {
  private dataDir: string;
  private sessionsFile: string;
  private pairingCodes: Map<string, PairingCode> = new Map();
  private sessions: Map<string, Session> = new Map();
  private rateLimitMap: Map<string, { attempts: number; resetAt: Date }> = new Map();

  constructor() {
    this.dataDir = path.join(process.cwd(), 'data');
    this.sessionsFile = path.join(this.dataDir, 'sessions.json');
    this.initializeStorage();
    this.startCleanupInterval();
  }

  private async initializeStorage(): Promise<void> {
    try {
      // Create data directory if it doesn't exist
      await fs.mkdir(this.dataDir, { recursive: true });

      // Load existing sessions
      try {
        const sessionsData = await fs.readFile(this.sessionsFile, 'utf-8');
        const sessions = JSON.parse(sessionsData);
        for (const session of sessions) {
          this.sessions.set(session.id, {
            ...session,
            createdAt: new Date(session.createdAt),
            lastUsedAt: new Date(session.lastUsedAt),
            expiresAt: new Date(session.expiresAt)
          });
        }
        logger.info(`Loaded ${this.sessions.size} existing sessions`);
      } catch (error) {
        // File doesn't exist yet, that's okay
        logger.info('No existing sessions found, starting fresh');
      }

      // Clean up any expired sessions on startup
      this.cleanupExpiredSessions();
    } catch (error) {
      logger.error('Failed to initialize storage:', error);
    }
  }

  private startCleanupInterval(): void {
    // Clean up expired codes and sessions every minute
    setInterval(() => {
      this.cleanupExpiredCodes();
      this.cleanupExpiredSessions();
      this.cleanupRateLimits();
    }, 60000);
  }

  private generatePairingCode(): string {
    // Generate a 6-character code without ambiguous characters
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < (parseInt(process.env.PAIRING_CODE_LENGTH || '6')); i++) {
      code += chars[Math.floor(Math.random() * chars.length)];
    }
    return code;
  }

  private generateToken(): string {
    return randomBytes(parseInt(process.env.SESSION_TOKEN_LENGTH || '32')).toString('hex');
  }

  private generateSessionId(): string {
    return randomBytes(16).toString('hex');
  }

  private async saveSessions(): Promise<void> {
    const sessions = Array.from(this.sessions.values()).map(session => ({
      ...session,
      createdAt: session.createdAt.toISOString(),
      lastUsedAt: session.lastUsedAt.toISOString(),
      expiresAt: session.expiresAt.toISOString()
    }));
    await fs.writeFile(this.sessionsFile, JSON.stringify(sessions, null, 2));
  }

  private cleanupExpiredCodes(): void {
    const now = new Date();
    for (const [code, pairingCode] of this.pairingCodes.entries()) {
      if (pairingCode.expiresAt < now) {
        this.pairingCodes.delete(code);
        logger.info(`Cleaned up expired pairing code: ${code}`);
      }
    }
  }

  private cleanupExpiredSessions(): void {
    const now = new Date();
    let cleaned = 0;
    for (const [id, session] of this.sessions.entries()) {
      if (session.expiresAt < now) {
        this.sessions.delete(id);
        cleaned++;
      }
    }
    if (cleaned > 0) {
      logger.info(`Cleaned up ${cleaned} expired sessions`);
      this.saveSessions().catch(err => logger.error('Failed to save sessions after cleanup:', err));
    }
  }

  private cleanupRateLimits(): void {
    const now = new Date();
    for (const [ip, limit] of this.rateLimitMap.entries()) {
      if (limit.resetAt < now) {
        this.rateLimitMap.delete(ip);
      }
    }
  }

  private checkRateLimit(ipAddress: string): boolean {
    const now = new Date();
    const limit = this.rateLimitMap.get(ipAddress);
    
    if (!limit || limit.resetAt < now) {
      // Reset or create new limit
      this.rateLimitMap.set(ipAddress, {
        attempts: 1,
        resetAt: new Date(now.getTime() + 60000) // 1 minute
      });
      return true;
    }

    const maxAttempts = parseInt(process.env.PAIRING_MAX_ATTEMPTS || '3');
    if (limit.attempts >= maxAttempts) {
      return false;
    }

    limit.attempts++;
    return true;
  }

  public async initiatePairing(deviceName?: string, ipAddress?: string): Promise<{ code: string; sessionId: string; expiresIn: number }> {
    logger.debug({ deviceName, ipAddress }, 'Initiating pairing request');
    
    if (ipAddress && !this.checkRateLimit(ipAddress)) {
      logger.warn({ ipAddress }, 'Rate limit exceeded for pairing');
      throw new Error(ERROR_CODES.PAIRING_RATE_LIMITED);
    }

    const code = this.generatePairingCode();
    const sessionId = this.generateSessionId();
    const now = new Date();
    const expirySeconds = parseInt(process.env.PAIRING_CODE_EXPIRY || '300');
    const expiresAt = new Date(now.getTime() + expirySeconds * 1000);

    const pairingCode: PairingCode = {
      code,
      sessionId,
      createdAt: now,
      expiresAt,
      deviceName,
      ipAddress
    };

    this.pairingCodes.set(code, pairingCode);
    
    logger.info({ code, sessionId, deviceName, expiresIn: expirySeconds }, 'Pairing code generated');
    
    // Display the pairing code in console
    console.log('\n🔐 Pairing Code: ' + code);
    console.log(`⏱️  Expires in: ${expirySeconds} seconds\n`);

    return {
      code,
      sessionId,
      expiresIn: expirySeconds
    };
  }

  public async completePairing(code: string, sessionId: string, ipAddress?: string): Promise<Session> {
    logger.debug({ code: code.substring(0, 3) + '***', sessionId, ipAddress }, 'Attempting to complete pairing');
    
    const pairingCode = this.pairingCodes.get(code.toUpperCase());
    
    if (!pairingCode) {
      logger.warn({ code: code.substring(0, 3) + '***' }, 'Invalid pairing code');
      throw new Error(ERROR_CODES.PAIRING_CODE_INVALID);
    }

    if (pairingCode.sessionId !== sessionId) {
      throw new Error(ERROR_CODES.PAIRING_CODE_INVALID);
    }

    const now = new Date();
    if (pairingCode.expiresAt < now) {
      this.pairingCodes.delete(code);
      throw new Error(ERROR_CODES.PAIRING_CODE_EXPIRED);
    }

    // Check session limit
    const maxSessions = parseInt(process.env.SESSION_MAX_PER_USER || '10');
    if (this.sessions.size >= maxSessions) {
      throw new Error(ERROR_CODES.SESSION_LIMIT_REACHED);
    }

    // Create new session
    const token = this.generateToken();
    const sessionExpirySeconds = parseInt(process.env.SESSION_TOKEN_EXPIRY || '2592000'); // 30 days
    const expiresAt = new Date(now.getTime() + sessionExpirySeconds * 1000);

    const session: Session = {
      id: sessionId,
      token,
      deviceName: pairingCode.deviceName || 'Unknown Device',
      createdAt: now,
      lastUsedAt: now,
      expiresAt,
      ipAddress: ipAddress || pairingCode.ipAddress
    };

    this.sessions.set(sessionId, session);
    this.pairingCodes.delete(code);

    // Save sessions to disk
    await this.saveSessions();

    logger.info({
      sessionId,
      deviceName: session.deviceName,
      token: token.substring(0, 10) + '...',
      expiresAt: session.expiresAt
    }, 'New session created successfully');

    return session;
  }

  public async validateSession(token: string): Promise<Session | null> {
    logger.debug({ token: token.substring(0, 10) + '...' }, 'Validating session token');
    
    for (const [id, session] of this.sessions.entries()) {
      if (session.token === token) {
        const now = new Date();
        
        // Check if expired
        if (session.expiresAt < now) {
          logger.info({ sessionId: id }, 'Session expired, removing');
          this.sessions.delete(id);
          await this.saveSessions();
          return null;
        }

        // Update last used time and optionally extend expiry
        session.lastUsedAt = now;
        
        if (process.env.SESSION_SLIDING_EXPIRY === 'true') {
          const sessionExpirySeconds = parseInt(process.env.SESSION_TOKEN_EXPIRY || '2592000');
          session.expiresAt = new Date(now.getTime() + sessionExpirySeconds * 1000);
        }

        await this.saveSessions();
        logger.debug({ sessionId: id, deviceName: session.deviceName }, 'Session validated successfully');
        return session;
      }
    }
    
    logger.debug('No matching session found for token');
    return null;
  }

  public async getSessions(): Promise<Session[]> {
    this.cleanupExpiredSessions();
    return Array.from(this.sessions.values());
  }

  public async getSession(sessionId: string): Promise<Session | null> {
    return this.sessions.get(sessionId) || null;
  }

  public async revokeSession(sessionId: string): Promise<boolean> {
    const deleted = this.sessions.delete(sessionId);
    if (deleted) {
      await this.saveSessions();
      logger.info(`Session revoked: ${sessionId}`);
    }
    return deleted;
  }

  public async revokeAllSessions(): Promise<number> {
    const count = this.sessions.size;
    this.sessions.clear();
    await this.saveSessions();
    logger.info(`All ${count} sessions revoked`);
    return count;
  }
}