# Fix: "Cannot find module './8948.js'" (webpack chunk error)
# Run this when dev server has chunk loading errors.

Write-Host "Stopping any running Node/Next processes..."
Get-Process -Name "node" -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue

Write-Host "Cleaning .next and node_modules cache..."
Remove-Item -Recurse -Force .next -ErrorAction SilentlyContinue
Remove-Item -Recurse -Force node_modules\.cache -ErrorAction SilentlyContinue

Write-Host "Done. Run: npm run dev"
Write-Host ""
Write-Host "If error persists, try full reinstall:"
Write-Host "  1. Close all terminals/IDE using this project"
Write-Host "  2. Remove-Item -Recurse -Force node_modules, .next"
Write-Host "  3. npm install"
Write-Host "  4. npm run dev"
