import { Router, Request, Response, NextFunction } from 'express';
import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';

const router = Router();
const execAsync = promisify(exec);

// GET /api/debug/raw
router.get('/raw', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const svclPath = path.join(process.cwd(), 'binaries', 'svcl.exe');
    const command = `"${svclPath}" /scomma ""`;
    
    const { stdout, stderr } = await execAsync(command);
    
    // Parse lines for easier viewing
    const lines = stdout.split('\n').filter(line => line.trim());
    const parsed = lines.map(line => {
      const parts = parseCSVLine(line);
      return parts;
    });
    
    res.json({
      success: true,
      command,
      raw: stdout,
      stderr,
      lines: lines,
      parsed: parsed,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/debug/devices
router.get('/devices', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const svclPath = path.join(process.cwd(), 'binaries', 'svcl.exe');
    const command = `"${svclPath}" /scomma ""`;
    
    const { stdout } = await execAsync(command);
    
    // Parse and filter for devices
    const lines = stdout.split('\n').filter(line => line.trim());
    const devices = [];
    let defaultRenderDevice = '';
    
    for (const line of lines) {
      const parts = parseCSVLine(line);
      if (parts.length >= 7) {
        const [name, type, deviceName, , , , defaultColumn] = parts;
        
        // Check for DefaultRenderDevice
        if (name === 'DefaultRenderDevice' && deviceName) {
          defaultRenderDevice = deviceName;
        }
        
        // Check for render devices
        if (type === 'Device' && defaultColumn === 'Render' && deviceName) {
          devices.push({
            name,
            type,
            deviceName,
            default: defaultColumn,
            isDefaultDevice: name === 'DefaultRenderDevice'
          });
        }
      }
    }
    
    res.json({
      success: true,
      defaultRenderDevice,
      devices,
      rawLines: lines.slice(0, 10), // First 10 lines for debugging
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    next(error);
  }
});

// Helper function to parse CSV line
function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  
  if (current) {
    result.push(current.trim());
  }
  
  return result;
}

export default router;