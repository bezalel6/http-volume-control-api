import { Router, Request, Response, NextFunction } from 'express';
import { SettingsService } from '../services/settings-service';

const router = Router();
const settingsService = new SettingsService();

// GET /api/settings
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const settings = await settingsService.loadSettings();
    
    res.json({
      success: true,
      settings,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    next(error);
  }
});

// PUT /api/settings
router.put('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const updates = req.body;
    
    if (!updates || typeof updates !== 'object') {
      res.status(400).json({
        success: false,
        error: 'Invalid settings data',
        timestamp: new Date().toISOString(),
      });
      return;
    }
    
    const settings = await settingsService.updateSettings(updates);
    
    res.json({
      success: true,
      settings,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    next(error);
  }
});

export default router;