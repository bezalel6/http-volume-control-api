import fs from 'fs/promises';
import path from 'path';
import { Settings, DEFAULT_SETTINGS } from '../types/settings';

export class SettingsService {
  private settingsPath: string;

  constructor() {
    // Store settings in a JSON file in the project root
    this.settingsPath = path.join(process.cwd(), 'settings.json');
  }

  async loadSettings(): Promise<Settings> {
    try {
      const data = await fs.readFile(this.settingsPath, 'utf-8');
      const settings = JSON.parse(data);
      // Merge with defaults to ensure all fields exist
      return { ...DEFAULT_SETTINGS, ...settings };
    } catch {
      // If file doesn't exist or is invalid, return defaults
      console.log('Settings file not found, using defaults');
      return DEFAULT_SETTINGS;
    }
  }

  async saveSettings(settings: Settings): Promise<void> {
    try {
      await fs.writeFile(
        this.settingsPath, 
        JSON.stringify(settings, null, 2),
        'utf-8'
      );
    } catch (error) {
      console.error('Failed to save settings:', error);
      throw new Error('Failed to save settings');
    }
  }

  async updateSettings(updates: Partial<Settings>): Promise<Settings> {
    const currentSettings = await this.loadSettings();
    const newSettings = { ...currentSettings, ...updates };
    await this.saveSettings(newSettings);
    return newSettings;
  }
}