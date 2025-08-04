# HTTP Volume Control API

A lightweight REST API server for controlling Windows audio devices and application volumes using `svcl.exe`.

## Features

- Control system audio device volumes
- Control individual application volumes
- List all audio devices and applications
- Mute/unmute devices
- Extract and serve application icons
- Secure pairing-based authentication
- Session management for multiple devices
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

# Pairing Configuration
PAIRING_CODE_LENGTH=6              # Length of pairing codes
PAIRING_CODE_EXPIRY=300           # Pairing code expiry in seconds
PAIRING_MAX_ATTEMPTS=3            # Max pairing attempts per minute
PAIRING_COOLDOWN=900              # Cooldown period after max attempts

# Session Configuration
SESSION_TOKEN_LENGTH=32           # Token length in bytes
SESSION_TOKEN_EXPIRY=2592000      # Session expiry in seconds (30 days)
SESSION_MAX_PER_USER=10           # Max concurrent sessions
SESSION_SLIDING_EXPIRY=true       # Extend expiry on use

# Security
SESSION_IP_BINDING=false          # Bind sessions to IP addresses
SESSION_USER_AGENT_CHECK=true     # Validate user agents

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

## Authentication

This API uses a secure pairing-based authentication system. To use the API:

1. **Initiate Pairing**: Call `POST /api/pairing/initiate` to start the pairing process
2. **Get Pairing Code**: The API will display a 6-character pairing code in the console
3. **Complete Pairing**: Send the pairing code to `POST /api/pairing/complete` to receive a session token
4. **Use Token**: Include the session token in all subsequent requests as `Authorization: Bearer <token>`

### Pairing Flow Example

```bash
# 1. Initiate pairing
curl -X POST http://localhost:3001/api/pairing/initiate \
  -H "Content-Type: application/json" \
  -d '{"deviceName": "My Web App"}'

# Response: {"success": true, "sessionId": "abc123", "expiresIn": 300}
# Console shows: 🔐 Pairing Code: A7K9M2

# 2. Complete pairing with the code
curl -X POST http://localhost:3001/api/pairing/complete \
  -H "Content-Type: application/json" \
  -d '{"code": "A7K9M2", "sessionId": "abc123"}'

# Response: {"success": true, "token": "your-session-token", ...}

# 3. Use the token for API requests
curl http://localhost:3001/api/devices \
  -H "Authorization: Bearer your-session-token"
```

## API Endpoints

### Pairing & Sessions

- `GET /api/pairing/status` - Check pairing availability
- `POST /api/pairing/initiate` - Start pairing process
- `POST /api/pairing/complete` - Complete pairing with code
- `GET /api/sessions` - List all active sessions
- `GET /api/sessions/current` - Get current session info
- `DELETE /api/sessions/:id` - Revoke a specific session
- `POST /api/sessions/logout` - Logout current session

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

## Session Management

- Sessions expire after 30 days by default (configurable)
- Sessions can be extended automatically on use with `SESSION_SLIDING_EXPIRY=true`
- List and manage all active sessions through the session endpoints
- Each device/app can have its own named session

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

## Error Codes

The API returns specific error codes for different scenarios:

- `PAIRING_CODE_INVALID` - Wrong or expired pairing code
- `PAIRING_CODE_EXPIRED` - Pairing code has expired
- `PAIRING_RATE_LIMITED` - Too many pairing attempts
- `SESSION_INVALID` - Invalid or expired session token
- `SESSION_EXPIRED` - Session token has expired
- `SESSION_LIMIT_REACHED` - Maximum number of sessions reached
- `UNAUTHORIZED` - Missing or invalid authorization

## License

MIT