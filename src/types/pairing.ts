export interface PairingCode {
  code: string;
  sessionId: string;
  createdAt: Date;
  expiresAt: Date;
  deviceName?: string;
  ipAddress?: string;
}

export interface Session {
  id: string;
  token: string;
  deviceName: string;
  createdAt: Date;
  lastUsedAt: Date;
  expiresAt: Date;
  ipAddress?: string;
  userAgent?: string;
}

export interface PairingInitiateRequest {
  deviceName?: string;
}

export interface PairingInitiateResponse {
  success: boolean;
  sessionId: string;
  expiresIn: number;
  timestamp: string;
}

export interface PairingCompleteRequest {
  code: string;
  sessionId: string;
}

export interface PairingCompleteResponse {
  success: boolean;
  token: string;
  session: {
    id: string;
    deviceName: string;
    createdAt: string;
    expiresAt: string;
  };
  timestamp: string;
}

export interface SessionListResponse {
  success: boolean;
  sessions: Array<{
    id: string;
    deviceName: string;
    createdAt: string;
    lastUsedAt: string;
    expiresAt: string;
    current: boolean;
  }>;
  timestamp: string;
}

export interface ErrorResponse {
  success: false;
  error: string;
  code: string;
  timestamp: string;
}

export const ERROR_CODES = {
  PAIRING_CODE_INVALID: 'PAIRING_CODE_INVALID',
  PAIRING_CODE_EXPIRED: 'PAIRING_CODE_EXPIRED',
  PAIRING_RATE_LIMITED: 'PAIRING_RATE_LIMITED',
  SESSION_INVALID: 'SESSION_INVALID',
  SESSION_EXPIRED: 'SESSION_EXPIRED',
  SESSION_LIMIT_REACHED: 'SESSION_LIMIT_REACHED',
  UNAUTHORIZED: 'UNAUTHORIZED'
} as const;

export type ErrorCode = typeof ERROR_CODES[keyof typeof ERROR_CODES];