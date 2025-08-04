# Required Binaries

Place these executables in this folder:

## Required Files
- `svcl.exe` - Sound Volume Command Line utility
- `GetNir.exe` - CSV filtering utility (required for svcl.exe output parsing)
- `extracticon.exe` - High-quality icon extraction from process executables

## Download Instructions

### Option 1: Download Pre-packaged
Download `http-volume-control-binaries.zip` from the releases page and extract all files here.

### Option 2: Manual Download
1. **svcl.exe**: Download from [NirSoft SoundVolumeCommandLine](https://www.nirsoft.net/utils/sound_volume_command_line.html)
   - Note: Also download GetNir.exe (below) as it's required for parsing svcl.exe output
2. **GetNir.exe**: Download from [NirSoft GetNir](https://www.nirsoft.net/utils/getnir.html)
   - This is an additional tool required by svcl.exe for CSV output filtering
3. **extracticon.exe**: Build from source at [ExtractIcon](https://github.com/bezalel6/ExtractIcon) or download pre-built binary from releases

## Verification
After placing files, this folder should contain:
```
binaries/
├── README.md (this file)
├── svcl.exe
├── GetNir.exe
└── extracticon.exe
```