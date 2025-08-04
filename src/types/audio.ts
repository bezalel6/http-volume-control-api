export interface AudioDevice {
  name: string;
  id: string;
  type: string;
  state: string;
  default: boolean;
  volume: number;
  muted: boolean;
}

export interface AudioApplication {
  processPath: string;
  processId: number;
  mainWindowTitle: string;
  displayName: string;
  iconPath: string | null;
  volume: number;
  muted: boolean;
  instanceId?: string;
}

export interface AudioProcess {
  processPath: string;
  processId: number;
  mainWindowTitle: string;
  displayName: string;
  iconPath: string | null;
}

export class AudioError extends Error {
  constructor(
    message: string,
    public code?: string,
    public details?: any
  ) {
    super(message);
    this.name = 'AudioError';
  }
}

export interface VolumeInfo {
  volume: number;
  muted: boolean;
}

export interface DeviceListResponse {
  devices: AudioDevice[];
  defaultDevice: string;
}