export interface ProcessSettings {
  whitelist: string[];
  mode: 'whitelist' | 'all';
}

export interface Settings {
  processes: ProcessSettings;
}

export const DEFAULT_SETTINGS: Settings = {
  processes: {
    mode: 'all',
    whitelist: []
  }
};