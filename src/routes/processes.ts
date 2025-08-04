import { Router, Request, Response, NextFunction } from 'express';
import { AudioService } from '../services/audio-service';

const router = Router();
const audioService = new AudioService();

// GET /api/processes
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const processes = await audioService.getAllProcesses();
    
    res.json({
      success: true,
      processes,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    next(error);
  }
});

export default router;