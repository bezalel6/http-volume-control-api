import { Request, Response, NextFunction } from 'express';

export function apiKeyAuth(req: Request, res: Response, next: NextFunction): void {
  // Skip auth if not enabled
  if (process.env.API_KEY_ENABLED !== 'true') {
    return next();
  }

  const apiKey = req.headers['x-api-key'] as string;
  const expectedKey = process.env.API_KEY;

  if (!apiKey || apiKey !== expectedKey) {
    res.status(401).json({
      success: false,
      error: 'Unauthorized - Invalid or missing API key',
      timestamp: new Date().toISOString()
    });
    return;
  }

  next();
}