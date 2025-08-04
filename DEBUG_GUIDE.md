# Audio Service Debug Guide

## Key Improvements Made

### 1. **Device Detection Fix**
The original code was filtering for `"Default=Render"` which might not match the actual data structure. The improved version:
- Parses the raw CSV output from svcl.exe directly
- Looks for entries where `Type=Device` and `Default=Render`
- Also identifies the `DefaultRenderDevice` by checking the `Name` column
- Falls back to the first render device if no default is found

### 2. **CSV vs TSV Parsing**
- svcl.exe outputs **CSV** format (comma-separated with quotes)
- GetNir.exe outputs **TSV** format (tab-separated)
- Added proper CSV parser that handles quoted fields containing commas

### 3. **Whitelist Implementation**
- Now correctly filters applications based on full process path
- Only applies filter when mode is 'whitelist' AND whitelist has entries
- Whitelist check happens after parsing the CSV data

### 4. **Application Volume**
- Gets volume for each application individually using the application's Name
- Falls back to 100% if volume can't be retrieved

## Debug Endpoints

When running in development mode, these debug endpoints are available:

### `/api/debug/raw`
Returns the raw output from svcl.exe with parsed CSV data:
```bash
curl http://localhost:3001/api/debug/raw
```

### `/api/debug/devices`
Shows device detection logic and identified devices:
```bash
curl http://localhost:3001/api/debug/devices
```

## Debug Scripts

### `debug-audio.js`
Run this to see raw svcl.exe output:
```bash
node debug-audio.js
```

## Environment Variables

Enable debug logging to see all commands and outputs:
```bash
AUDIO_DEBUG=true
```

## Common Issues

### No Devices Found
1. Check if svcl.exe is in the binaries folder
2. Ensure you're running on Windows with audio devices
3. Check the debug endpoint to see raw output

### Whitelist Not Working
1. Verify the process paths in settings match exactly
2. Check that mode is set to 'whitelist'
3. Use debug endpoints to see which applications are detected

### Wrong Default Device
1. The system identifies default by looking for `Name=DefaultRenderDevice`
2. Check `/api/debug/devices` to see what's being detected
3. If no default found, it uses the first render device

## Testing Commands

Test individual svcl.exe commands:
```bash
# List all audio sessions
binaries\svcl.exe /scomma ""

# Get volume for a device
binaries\svcl.exe /GetPercent "Speakers" /Stdout

# Set volume
binaries\svcl.exe /SetVolume "chrome.exe" 50
```