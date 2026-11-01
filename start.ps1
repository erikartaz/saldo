[CmdletBinding()]
param(
    [int]$Port = 8000,
    [switch]$SkipBuild,
    [switch]$ForceBuild
)

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $root

if ($SkipBuild -and $ForceBuild) {
    throw 'Usa -SkipBuild oppure -ForceBuild, non entrambi.'
}

# esbuild (usato da Vite) a volte non riesce a cancellare i file nella cartella
# temporanea di sistema. Usiamo una temp locale al progetto, sempre scrivibile.
$tempDir = Join-Path $root '.tmp'
New-Item -ItemType Directory -Force -Path $tempDir | Out-Null
$env:TMP = $tempDir
$env:TEMP = $tempDir
$env:npm_config_cache = Join-Path $root '.npm-cache'
$env:UV_CACHE_DIR = Join-Path $root '.uv-cache'

if (-not (Get-Command uv -ErrorAction SilentlyContinue)) {
    throw 'uv non trovato. Installa uv da https://docs.astral.sh/uv/ e riprova.'
}
if (-not (Get-Command npm -ErrorAction SilentlyContinue)) {
    throw 'npm non trovato. Installa Node.js 20+ e riprova.'
}

if (-not (Test-Path (Join-Path $root 'frontend\node_modules'))) {
    Write-Host 'Installazione dipendenze frontend...' -ForegroundColor Cyan
    Push-Location (Join-Path $root 'frontend')
    try {
        npm install --no-audit --no-fund
        if ($LASTEXITCODE -ne 0) { throw 'Installazione delle dipendenze frontend non riuscita.' }
    }
    finally {
        Pop-Location
    }
}

$indexFile = Join-Path $root 'frontend\dist\index.html'
$frontendDir = Join-Path $root 'frontend'

function Test-FrontendNeedsBuild {
    if (-not (Test-Path $indexFile)) { return $true }

    $builtAt = (Get-Item -LiteralPath $indexFile).LastWriteTimeUtc
    $candidates = @(
        (Join-Path $frontendDir 'src'),
        (Join-Path $frontendDir 'public'),
        (Join-Path $frontendDir 'index.html'),
        (Join-Path $frontendDir 'package.json'),
        (Join-Path $frontendDir 'package-lock.json'),
        (Join-Path $frontendDir 'vite.config.ts'),
        (Join-Path $frontendDir 'tsconfig.json')
    )

    foreach ($candidate in $candidates) {
        if (-not (Test-Path -LiteralPath $candidate)) { continue }
        $item = Get-Item -LiteralPath $candidate
        if ($item.PSIsContainer) {
            $newest = Get-ChildItem -LiteralPath $candidate -Recurse -File -ErrorAction SilentlyContinue |
                Sort-Object LastWriteTimeUtc -Descending |
                Select-Object -First 1
            if ($newest -and $newest.LastWriteTimeUtc -gt $builtAt) { return $true }
        }
        elseif ($item.LastWriteTimeUtc -gt $builtAt) {
            return $true
        }
    }

    return $false
}

if ($SkipBuild) {
    if (-not (Test-Path $indexFile)) {
        throw 'Non esiste una build del frontend. Esegui .\start.ps1 senza -SkipBuild.'
    }
    Write-Host 'Build del frontend saltata (-SkipBuild).' -ForegroundColor DarkGray
}
elseif ($ForceBuild -or (Test-FrontendNeedsBuild)) {
    Write-Host 'Build del frontend...' -ForegroundColor Cyan
    Push-Location $frontendDir
    try {
        npm run build
        if ($LASTEXITCODE -ne 0) {
            throw 'Build del frontend non riuscita: il server non verrà avviato. Controlla l''errore sopra.'
        }
    }
    finally {
        Pop-Location
    }
}
else {
    Write-Host 'Frontend già aggiornato: salto la build. Usa -ForceBuild per ricompilare.' -ForegroundColor DarkGray
}

if (-not (Test-Path $indexFile)) {
    throw 'frontend/dist/index.html non trovato. Esegui .\start.ps1 senza -SkipBuild per compilare il frontend.'
}

Write-Host 'Sincronizzazione dipendenze backend...' -ForegroundColor Cyan
Push-Location (Join-Path $root 'backend')
try {
    uv sync
    if ($LASTEXITCODE -ne 0) { throw 'Sincronizzazione delle dipendenze backend non riuscita.' }
    Write-Host ''
    Write-Host "Saldo è pronto su http://127.0.0.1:$Port" -ForegroundColor Green
    Write-Host 'Premi CTRL+C per fermare il server.' -ForegroundColor DarkGray
    Write-Host ''
    uv run uvicorn app.main:app --host 127.0.0.1 --port $Port
}
finally {
    Pop-Location
}
