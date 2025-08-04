import { Router, Request, Response, NextFunction } from 'express';
import { AudioService } from '../services/audio-service';

const router = Router();
const audioService = new AudioService();

// GET /api/devices
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await audioService.getDevices();
    
    res.json({
      success: true,
      ...result,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/devices/:device/volume
router.get('/:device/volume', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { device } = req.params;
    const volumeInfo = await audioService.getVolume(device);
    
    res.json({
      success: true,
      device,
      ...volumeInfo,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    next(error);
  }
});

// PUT /api/devices/:device/volume
router.put('/:device/volume', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { device } = req.params;
    const { volume } = req.body;
    
    if (typeof volume !== 'number' || volume < 0 || volume > 100) {
      res.status(400).json({
        success: false,
        error: 'Volume must be a number between 0 and 100',
        timestamp: new Date().toISOString(),
      });
      return;
    }
    
    await audioService.setVolume(device, volume);
    
    res.json({
      success: true,
      device,
      volume,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    next(error);
  }
});

// PUT /api/devices/:device/mute
router.put('/:device/mute', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { device } = req.params;
    const { muted } = req.body;
    
    if (typeof muted !== 'boolean') {
      res.status(400).json({
        success: false,
        error: 'Muted must be a boolean value',
        timestamp: new Date().toISOString(),
      });
      return;
    }
    
    await audioService.setMute(device, muted);
    
    res.json({
      success: true,
      device,
      muted,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    next(error);
  }
});

export default router;