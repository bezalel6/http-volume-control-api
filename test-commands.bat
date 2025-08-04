@echo off
echo === Testing svcl.exe commands ===
echo.

echo 1. Raw output from svcl.exe:
echo -----------------------------
binaries\svcl.exe /scomma ""
echo.

echo 2. Testing device filter (Default=Render):
echo ------------------------------------------
binaries\svcl.exe /scomma "" ^| binaries\GetNir.exe "Device Name,Name,Volume Percent,Default" "Default=Render"
echo.

echo 3. Testing application filter:
echo ------------------------------
binaries\svcl.exe /scomma "" ^| binaries\GetNir.exe "Name,Process Path,Volume Percent,Type" "Type=Application"
echo.

echo 4. Get volume for default device:
echo ---------------------------------
binaries\svcl.exe /GetPercent "DefaultRenderDevice" /Stdout
echo.

pause