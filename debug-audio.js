const { exec } = require('child_process');
const path = require('path');

const svclPath = path.join(__dirname, 'binaries', 'svcl.exe');
const getNirPath = path.join(__dirname, 'binaries', 'GetNir.exe');

console.log('=== Audio Service Debug Tool ===\n');

// Function to execute command and log output
function runCommand(description, command) {
  console.log(`\n--- ${description} ---`);
  console.log(`Command: ${command}`);
  console.log('Output:');
  
  exec(command, (error, stdout, stderr) => {
    if (error) {
      console.error('Error:', error.message);
      return;
    }
    if (stderr) {
      console.error('Stderr:', stderr);
    }
    
    // Show raw output
    console.log('\nRaw output:');
    console.log(stdout);
    
    // Show parsed lines
    console.log('\nParsed lines:');
    const lines = stdout.split('\n').filter(line => line.trim());
    lines.forEach((line, index) => {
      console.log(`Line ${index}: ${line}`);
    });
    
    // Parse as CSV
    console.log('\nParsed as CSV:');
    lines.forEach((line, index) => {
      const parts = parseCSV(line);
      console.log(`Line ${index}: [${parts.map(p => `"${p}"`).join(', ')}]`);
    });
  });
}

// Simple CSV parser
function parseCSV(line) {
  const result = [];
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

// Run various commands
console.log('Running diagnostics...\n');

// 1. Get all data
runCommand('Get all audio data', `"${svclPath}" /scomma ""`);

// 2. Get specific columns
setTimeout(() => {
  runCommand('Get specific columns', `"${svclPath}" /scomma "" /Columns "Name,Type,Device Name,Default,Volume Percent,Process Path"`);
}, 2000);

// 3. Test GetNir filtering for devices
setTimeout(() => {
  runCommand('Filter for default render device', `"${svclPath}" /scomma "" | "${getNirPath}" "Name,Device Name,Default" "Default=Render"`);
}, 4000);

// 4. Test GetNir filtering for applications
setTimeout(() => {
  runCommand('Filter for applications', `"${svclPath}" /scomma "" | "${getNirPath}" "Name,Type,Process Path,Volume Percent" "Type=Application"`);
}, 6000);

console.log('\nNote: If you see no output, it might mean no audio devices or applications are currently active.');
console.log('Try playing some audio in an application and run this script again.');