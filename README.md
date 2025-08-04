# HTTP Volume Control API

A lightweight REST API server for controlling Windows audio devices and application volumes using `svcl.exe`.

## Features

- Control system audio device volumes
- Control individual application volumes
- List all audio devices and applications
- Mute/unmute devices
- Extract and serve application icons
- Optional API key authentication
- CORS support for web clients

## Requirements

- Windows OS (required for svcl.exe)
- Node.js 18+ 
- Required binaries in `binaries/` folder:
  - `svcl.exe` - Windows audio control utility
  - `GetNir.exe` - CSV filtering utility
  - `extracticon.exe` - Icon extraction utility

## Installation

```bash
# Install dependencies
npm install

# Copy .env.example to .env and configure
cp .env.example .env
```

## Configuration

Edit `.env` file:

```bash
# Server
PORT=3001
NODE_ENV=production

# CORS (comma-separated origins)
CORS_ORIGIN=http://localhost:5173,http://localhost:3000

# Optional API Key Authentication
API_KEY_ENABLED=false
API_KEY=your-secret-api-key-here

# Logging
LOG_LEVEL=info
AUDIO_DEBUG=false
```

## Running the Server

```bash
# Development (with auto-reload)
npm run dev

# Production
npm run build
npm start

# Type checking
npm run typecheck

# Linting
npm run lint
```

## API Endpoints

### Devices

- `GET /api/devices` - List all audio devices
- `GET /api/devices/:device/volume` - Get device volume and mute state
- `PUT /api/devices/:device/volume` - Set device volume (0-100)
- `PUT /api/devices/:device/mute` - Set device mute state

### Applications

- `GET /api/applications` - List all applications with audio
- `PUT /api/applications/volume` - Set application volume

### Processes

- `GET /api/processes` - List all processes that have had audio sessions

### Settings

- `GET /api/settings` - Get current settings
- `PUT /api/settings` - Update settings

### Health

- `GET /health` - Server health check

## API Authentication

When `API_KEY_ENABLED=true`, include the API key in requests:

```bash
curl -H "X-API-Key: your-secret-api-key-here" http://localhost:3001/api/devices
```

## Response Format

All endpoints return JSON responses:

```json
{
  "success": true,
  "data": {...},
  "timestamp": "2025-08-03T07:30:00.000Z"
}
```

Error responses:

```json
{
  "success": false,
  "error": "Error message",
  "code": "ERROR_CODE",
  "timestamp": "2025-08-03T07:30:00.000Z"
}
```

## Building for Production

```bash
# Build TypeScript
npm run build

# Optional: Create standalone executable
# (requires pkg or nexe - not included)
```

## License

MIT