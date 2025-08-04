import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import fs from 'fs/promises';
import crypto from 'crypto';
import { AudioError, AudioDevice, AudioApplication, AudioProcess } from '../types/audio';
import { SettingsService } from './settings-service';

const execAsync = promisify(exec);

export class AudioService {
  private svclPath: string;
  private getNirPath: string;
  private extractIconPath: string;
  private iconsDir: string;
  private settingsService: SettingsService;
  private debug: boolean;

  constructor() {
    // Path to svcl.exe, GetNir.exe, and extracticon.exe in binaries folder
    this.svclPath = process.env.SVCL_PATH || path.join(process.cwd(), 'binaries', 'svcl.exe');
    this.getNirPath = process.env.GETNIR_PATH || path.join(process.cwd(), 'binaries', 'GetNir.exe');
    this.extractIconPath = process.env.EXTRACTICON_PATH || path.join(process.cwd(), 'binaries', 'extracticon.exe');
    this.iconsDir = path.join(process.cwd(), 'icons', 'apps');
    this.settingsService = new SettingsService();
    // Debug logging is disabled by default
    this.debug = process.env.AUDIO_DEBUG === 'true';
    
    // Check if binaries exist on initialization
    this.checkBinaries();
  }
  
  private async checkBinaries(): Promise<void> {
    try {
      await fs.access(this.svclPath);
      await fs.access(this.getNirPath);
      await fs.access(this.extractIconPath);
    } catch (error) {
      console.error('\n⚠️  Required binaries not found!');
      console.error('\nPlease ensure the following binaries are in the binaries/ folder:');
      console.error('- svcl.exe');
      console.error('- GetNir.exe');
      console.error('- extracticon.exe\n');
    }
  }

  private async execWithLogging(command: string): Promise<{ stdout: string; stderr: string }> {
    if (this.debug) {
      console.log('[AudioService] Executing command:', command);
    }
    try {
      const result = await execAsync(command);
      if (this.debug) {
        console.log('[AudioService] Command output:', result.stdout.substring(0, 200) + (result.stdout.length > 200 ? '...' : ''));
      }
      return result;
    } catch (error) {
      if (this.debug) {
        console.error('[AudioService] Command failed:', error);
      }
      throw error;
    }
  }

  private sanitizeDevice(device: string): string {
    // Remove any potentially dangerous characters but keep parentheses for device names
    return device.replace(/[^a-zA-Z0-9\s\-_()]/g, '');
  }

  private validateVolume(volume: number): number {
    return Math.max(0, Math.min(100, Math.round(volume)));
  }

  private async executeCommand(args: string[]): Promise<string> {
    const command = `"${this.svclPath}" ${args.join(' ')}`;
    
    try {
      const { stdout, stderr } = await this.execWithLogging(command);
      if (stderr && !stdout) {
        throw new Error(stderr);
      }
      return stdout.trim();
    } catch (error) {
      if (this.debug) {
        console.error('AudioService command error:', error);
      }
      // Check if error is due to missing executable
      if (error instanceof Error && error.message.includes('is not recognized')) {
        throw new AudioError('Required binaries not found. Please check the binaries folder.', 'BINARY_NOT_FOUND');
      }
      throw this.createError(error);
    }
  }

  private createError(error: unknown): AudioError {
    const message = error instanceof Error ? error.message : 'Unknown error occurred';
    
    let code: string = 'UNKNOWN_ERROR';
    if (message.includes('not found') || message.includes('cannot find')) {
      code = 'DEVICE_NOT_FOUND';
    } else if (message.includes('volume')) {
      code = 'INVALID_VOLUME';
    } else if (message.includes('command')) {
      code = 'COMMAND_FAILED';
    }
    
    return new AudioError(message, code);
  }

  async setVolume(device: string, volume: number): Promise<void> {
    const sanitizedDevice = this.sanitizeDevice(device);
    const validVolume = this.validateVolume(volume);
    
    await this.executeCommand([
      '/SetVolume',
      `"${sanitizedDevice}"`,
      validVolume.toString()
    ]);
  }

  async getVolume(device: string): Promise<{ volume: number; muted: boolean }> {
    const sanitizedDevice = this.sanitizeDevice(device);
    
    // Get volume percentage
    const volumeOutput = await this.executeCommand([
      '/GetPercent',
      `"${sanitizedDevice}"`,
      '/Stdout'
    ]);
    
    // Get mute state
    const muteOutput = await this.executeCommand([
      '/GetMute',
      `"${sanitizedDevice}"`,
      '/Stdout'
    ]);
    
    // Parse volume (should be a number)
    const volume = parseInt(volumeOutput) || 0;
    
    // Parse mute state (should be "1" for muted, "0" for unmuted)
    const muted = muteOutput.trim() === '1';
    
    return { volume, muted };
  }

  async mute(device: string): Promise<void> {
    const sanitizedDevice = this.sanitizeDevice(device);
    
    await this.executeCommand([
      '/Mute',
      `"${sanitizedDevice}"`
    ]);
  }

  async unmute(device: string): Promise<void> {
    const sanitizedDevice = this.sanitizeDevice(device);
    
    await this.executeCommand([
      '/Unmute',
      `"${sanitizedDevice}"`
    ]);
  }

  async setMute(device: string, mute: boolean): Promise<void> {
    if (mute) {
      await this.mute(device);
    } else {
      await this.unmute(device);
    }
  }

  async getDevices(): Promise<{ devices: AudioDevice[]; defaultDevice: string }> {
    try {
      // Use piped command to get device info - this is CORRECT!
      // It filters for devices where Default column = "Render" (output devices)
      const command = `"${this.svclPath}" /scomma "" /Columns "Name,Default,Device Name,Command-Line Friendly ID,Volume Percent" | "${this.getNirPath}" "Device Name,Name,Volume Percent,Default" "Default=Render"`;
      const { stdout } = await this.execWithLogging(command);
      
      // Parse TSV content (GetNir outputs tab-separated)
      const lines = stdout.split('\n').filter(line => line.trim());
      const devices: AudioDevice[] = [];
      let defaultDevice = '';
      
      for (const line of lines) {
        // Parse TSV line - GetNir outputs tab-separated values
        const parts = this.parseTSVLine(line);
        
        if (parts.length >= 4) {
          const [deviceName, name, volumeStr, defaultStatus] = parts;
          const volume = parseFloat(volumeStr) || 0;
          
          // Check if this is the default device
          // The "Name" column will be "DefaultRenderDevice" for the default
          const isDefault = name === 'DefaultRenderDevice';
          
          // Get mute state for each device
          let muted = false;
          try {
            const muteResult = await this.getVolume(deviceName);
            muted = muteResult.muted;
          } catch (error) {
            // If we can't get mute state, default to false
            if (this.debug) {
              console.error(`Failed to get mute state for ${deviceName}:`, error);
            }
          }
          
          devices.push({
            name: deviceName.trim(),
            id: deviceName.trim(),
            type: 'render',
            state: 'active',
            default: isDefault,
            volume,
            muted
          });
          
          if (isDefault) {
            defaultDevice = deviceName.trim();
          }
        }
      }
      
      // If no default device was found, use the first device
      if (!defaultDevice && devices.length > 0) {
        defaultDevice = devices[0].name;
        devices[0].default = true;
      }
      
      return { devices, defaultDevice };
    } catch (error) {
      if (this.debug) {
        console.error('Failed to get devices:', error);
      }
      throw this.createError(error);
    }
  }

  private parseTSVLine(line: string): string[] {
    // GetNir outputs tab-separated values
    return line.split('\t').map(field => field.trim());
  }

  async getApplications(): Promise<AudioApplication[]> {
    try {
      // First, get the name of the default audio device
      const { defaultDevice } = await this.getDevices();
      
      // Load settings to get whitelist
      const settings = await this.settingsService.loadSettings();
      const whitelist = settings.processes.whitelist || [];
      const mode = settings.processes.mode || 'all';
      
      // Get ALL applications first, then filter in code
      // This is more reliable than trying to build complex GetNir filters
      const filterExpression = `Type=Application && 'Process Path' EndsWith .exe && Direction=Render`;
      
      // Use piped command to get application info
      const command = `"${this.svclPath}" /scomma "" /Columns "Name,Type,Process Path,Process ID,Main Window Title,Volume Percent,Direction,Device Name" | "${this.getNirPath}" "Name,Volume Percent,Process Path,Process ID,Main Window Title,Device Name" "${filterExpression}"`;
      
      if (this.debug) {
        console.log('[AudioService] Getting applications with command:', command);
      }
      
      const { stdout } = await this.execWithLogging(command);
      
      // Parse TSV content
      const lines = stdout.split('\n').filter(line => line.trim());
      const applications: AudioApplication[] = [];
      const appMap = new Map<string, number>(); // Track instances per process path
      
      for (const line of lines) {
        // Parse TSV line - GetNir outputs tab-separated values
        const parts = this.parseTSVLine(line);
        
        if (this.debug) {
          console.log(`[AudioService] Parsed line parts: ${JSON.stringify(parts)}`);
        }
        
        // Handle cases where Main Window Title might be empty
        // Expected: Name, Volume%, ProcessPath, ProcessID, MainWindowTitle, DeviceName
        if (parts.length >= 5) {
          const name = parts[0];
          const volumeStr = parts[1];
          const processPath = parts[2];
          const processIdStr = parts[3];
          let mainWindowTitle = '';
          let deviceName = '';
          
          // If we have 5 parts, the last one is device name (main window title is empty)
          if (parts.length === 5) {
            deviceName = parts[4];
          } 
          // If we have 6 parts, we have both main window title and device name
          else if (parts.length >= 6) {
            mainWindowTitle = parts[4];
            deviceName = parts[5];
          }
          
          if (this.debug) {
            console.log(`[AudioService] Parsed app: ${name}, device: ${deviceName}, path: ${processPath}`);
          }
          
          // Skip if not on the default device
          // COMMENTED OUT: Show applications from all devices, not just default
          // if (deviceName !== defaultDevice) {
          //   if (this.debug) {
          //     console.log(`[AudioService] Skipping app on device ${deviceName} (default is ${defaultDevice})`);
          //   }
          //   continue;
          // }
          
          // Apply whitelist filter in code
          if (mode === 'whitelist' && whitelist.length > 0) {
            // Check if this process path is in the whitelist
            const isWhitelisted = whitelist.some(whitelistedPath => {
              // Support both exact path match and just process name match
              return processPath === whitelistedPath || 
                     path.basename(processPath) === path.basename(whitelistedPath);
            });
            
            if (!isWhitelisted) {
              if (this.debug) {
                console.log(`[AudioService] Skipping non-whitelisted app: ${processPath}`);
              }
              continue;
            }
          }
          
          const volume = parseFloat(volumeStr) || 0;
          const processId = parseInt(processIdStr) || 0;
          
          // Handle multiple instances
          const instanceCount = appMap.get(processPath) || 0;
          appMap.set(processPath, instanceCount + 1);
          
          // Extract icon for this application
          const iconPath = await this.extractApplicationIcon(processPath.trim());
          
          // Get display name (use window title if available, otherwise process name)
          const displayName = mainWindowTitle.trim() || name.trim();
          
          applications.push({
            processPath: processPath.trim(),
            processId,
            mainWindowTitle: mainWindowTitle.trim(),
            displayName,
            iconPath,
            volume,
            muted: false, // svcl doesn't provide mute state for applications
            instanceId: instanceCount > 0 ? `instance-${instanceCount}` : undefined
          });
        }
      }
      
      if (this.debug) {
        console.log(`[AudioService] Found ${applications.length} applications after filtering`);
      }
      
      return applications;
    } catch (error) {
      if (this.debug) {
        console.error('Failed to get applications:', error);
      }
      return [];
    }
  }

  async setApplicationVolume(processPath: string, volume: number): Promise<void> {
    const validVolume = this.validateVolume(volume);
    
    // For applications, we use the process name (filename) as the identifier
    const processName = path.basename(processPath);
    
    try {
      await this.executeCommand([
        '/SetVolume',
        `"${processName}"`,
        validVolume.toString()
      ]);
    } catch (error) {
      // If the error is about not finding the app, throw a specific error
      const audioError = this.createError(error);
      if (audioError.message.includes('not found')) {
        throw new AudioError(`Application ${processName} not found`, 'APPLICATION_NOT_FOUND');
      }
      throw audioError;
    }
  }

  private async extractApplicationIcon(processPath: string): Promise<string | null> {
    try {
      // Generate a unique filename based on the process path
      const processName = path.basename(processPath, path.extname(processPath));
      const hash = crypto.createHash('md5').update(processPath).digest('hex').substring(0, 8);
      const iconFileName = `${processName}-${hash}.png`;
      const iconPath = path.join(this.iconsDir, iconFileName);
      
      // Check if icon already exists
      try {
        await fs.access(iconPath);
        // Icon exists, return the path relative to static serving
        return `/icons/apps/${iconFileName}`;
      } catch {
        // Icon doesn't exist, extract it
      }
      
      // Ensure icons directory exists
      await fs.mkdir(this.iconsDir, { recursive: true });
      
      // Extract icon using extracticon.exe
      const command = `"${this.extractIconPath}" "${processPath}" "${iconPath}"`;
      await this.execWithLogging(command);
      
      // Verify the icon was created
      try {
        await fs.access(iconPath);
        return `/icons/apps/${iconFileName}`;
      } catch {
        if (this.debug) {
          console.error(`Failed to extract icon for ${processPath}`);
        }
        return null;
      }
    } catch (error) {
      if (this.debug) {
        console.error('Error extracting application icon:', error);
      }
      return null;
    }
  }

  async getAllProcesses(): Promise<AudioProcess[]> {
    try {
      // Get all applications that have audio sessions
      const filterExpression = "Type=Application && 'Process Path' EndsWith .exe";
      const command = `"${this.svclPath}" /scomma "" /Columns "Name,Type,Process Path,Process ID,Main Window Title,Direction" | "${this.getNirPath}" "Name,Process Path,Process ID,Main Window Title,Direction" "${filterExpression}"`;
      
      if (this.debug) {
        console.log('[AudioService] Getting all processes with command:', command);
      }
      
      const { stdout } = await this.execWithLogging(command);
      
      // Parse TSV content
      const lines = stdout.split('\n').filter(line => line.trim());
      const processMap = new Map<string, AudioProcess>();
      
      for (const line of lines) {
        // Parse TSV line - GetNir outputs tab-separated values
        const parts = this.parseTSVLine(line);
        
        if (this.debug) {
          console.log(`[AudioService] Process line parts: ${JSON.stringify(parts)}`);
        }
        
        // Handle cases where Main Window Title might be empty
        // Expected: Name, ProcessPath, ProcessID, MainWindowTitle, Direction
        if (parts.length >= 4) {
          const name = parts[0];
          const processPath = parts[1];
          const processIdStr = parts[2];
          let mainWindowTitle = '';
          let direction = '';
          
          // If we have 4 parts, the last one is direction (main window title is empty)
          if (parts.length === 4) {
            direction = parts[3];
          } 
          // If we have 5 parts, we have both main window title and direction
          else if (parts.length >= 5) {
            mainWindowTitle = parts[3];
            direction = parts[4];
          }
          
          const processId = parseInt(processIdStr) || 0;
          
          if (!processMap.has(processPath)) {
            // Extract icon for this application
            const iconPath = await this.extractApplicationIcon(processPath.trim());
            
            // Get display name (use window title if available, otherwise process name)
            const displayName = mainWindowTitle.trim() || name.trim();
            
            processMap.set(processPath, {
              processPath: processPath.trim(),
              processId,
              mainWindowTitle: mainWindowTitle.trim(),
              displayName,
              iconPath
            });
          }
        }
      }
      
      // Convert to array and sort by display name
      const processes = Array.from(processMap.values());
      processes.sort((a, b) => a.displayName.localeCompare(b.displayName));
      
      if (this.debug) {
        console.log(`[AudioService] Found ${processes.length} total processes`);
      }
      
      return processes;
    } catch (error) {
      if (this.debug) {
        console.error('Failed to get all processes:', error);
      }
      return [];
    }
  }
}