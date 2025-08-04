import { Router, Request, Response, NextFunction } from 'express';
import { AudioService } from '../services/audio-service';

const router = Router();
const audioService = new AudioService();

// GET /api/applications
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const applications = await audioService.getApplications();
    
    res.json({
      success: true,
      applications,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    next(error);
  }
});

// PUT /api/applications/volume
router.put('/volume', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { processPath, volume } = req.body;
    
    if (!processPath || typeof processPath !== 'string') {
      res.status(400).json({
        success: false,
        error: 'Process path is required',
        timestamp: new Date().toISOString(),
      });
      return;
    }
    
    if (typeof volume !== 'number' || volume < 0 || volume > 100) {
      res.status(400).json({
        success: false,
        error: 'Volume must be a number between 0 and 100',
        timestamp: new Date().toISOString(),
      });
      return;
    }
    
    await audioService.setApplicationVolume(processPath, volume);
    
    res.json({
      success: true,
      processPath,
      volume,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    next(error);
  }
});

export default router;