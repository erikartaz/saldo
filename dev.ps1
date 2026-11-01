[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $MyInvocation.MyCommand.Path

if (-not (Get-Command uv -ErrorAction SilentlyContinue)) {
    throw 'uv non trovato. Installa uv da https://docs.astral.sh/uv/ e riprova.'
}
if (-not (Get-Command npm -ErrorAction SilentlyContinue)) {
    throw 'npm non trovato. Installa Node.js 20+ e riprova.'
}

$backend = Join-Path $root 'backend'
$frontend = Join-Path $root 'frontend'
$tempDir = Join-Path $root '.tmp'
New-Item -ItemType Directory -Force -Path $tempDir | Out-Null

Write-Host 'Avvio backend su http://127.0.0.1:8000 ...' -ForegroundColor Cyan
Start-Process pwsh -ArgumentList @(
    '-NoExit',
    '-Command',
    "Set-Location '$backend'; `$env:UV_CACHE_DIR='$root\.uv-cache'; uv sync; uv run uvicorn app.main:app --reload --port 8000"
)

Start-Sleep -Seconds 2

Write-Host 'Avvio frontend Vite su http://127.0.0.1:5173 ...' -ForegroundColor Cyan
Start-Process pwsh -ArgumentList @(
    '-NoExit',
    '-Command',
    "`$env:TMP='$tempDir'; `$env:TEMP='$tempDir'; Set-Location '$frontend'; if (-not (Test-Path node_modules)) { npm install --no-audit --no-fund }; npm run dev"
)

Start-Sleep -Seconds 2
Start-Process 'http://127.0.0.1:5173'
Write-Host 'Fatto: due finestre aperte (API e Vite).' -ForegroundColor Green
