# ============================================================================
# SAVIESS Vision Entrepreneur Platform - One Command Setup & Run
# Usage: npm run setup   (or directly: powershell -ExecutionPolicy Bypass -File setup.ps1)
# ============================================================================

# Don't stop on stderr output (Node.js writes warnings to stderr)
$ErrorActionPreference = "Continue"

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  SAVIESS VEP - Setup & Launch Script" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# --- Step 1: Database Setup ---
Write-Host "[1/4] Setting up database..." -ForegroundColor Yellow

$sqlFiles = @(
    @{ File = "database/schema.sql";                   DB = $null },
    @{ File = "database/migration_add_states.sql";     DB = "saviess_vep" },
    @{ File = "database/migration_v2.sql";             DB = "saviess_vep" },
    @{ File = "database/migration_fm_teams.sql";       DB = "saviess_vep" },
    @{ File = "database/migration_pd_module.sql";      DB = "saviess_vep" },
    @{ File = "database/migration_rhp_registration.sql"; DB = "saviess_vep" },
    @{ File = "database/migration_rhp_cloud.sql";      DB = "saviess_vep" }
)

foreach ($entry in $sqlFiles) {
    $file = $entry.File
    if (-Not (Test-Path $file)) {
        Write-Host "  [SKIP] $file not found" -ForegroundColor DarkGray
        continue
    }

    if ($entry.DB) {
        $result = Get-Content $file | mysql -u root $entry.DB 2>&1
    } else {
        $result = Get-Content $file | mysql -u root 2>&1
    }

    if ($LASTEXITCODE -eq 0) {
        Write-Host "  [OK]   $file" -ForegroundColor Green
    } else {
        # Check if it's just a duplicate column/table error (safe to ignore on re-runs)
        $msg = "$result"
        if ($msg -match "Duplicate|already exists") {
            Write-Host "  [OK]   $file (already applied)" -ForegroundColor DarkGreen
        } else {
            Write-Host "  [WARN] $file - $msg" -ForegroundColor Yellow
        }
    }
}

Write-Host ""

# --- Step 2: Install Dependencies ---
Write-Host "[2/4] Installing dependencies..." -ForegroundColor Yellow
npm install --prefix backend 2>$null | Out-Null
Write-Host "  [OK]   backend dependencies" -ForegroundColor Green
npm install --prefix frontend 2>$null | Out-Null
Write-Host "  [OK]   frontend dependencies" -ForegroundColor Green
npm install 2>$null | Out-Null
Write-Host "  [OK]   root dependencies" -ForegroundColor Green
Write-Host ""

# --- Step 3: Seed Database ---
Write-Host "[3/4] Seeding database with mock data..." -ForegroundColor Yellow
# Use cmd /c to prevent PowerShell from treating Node.js stderr warnings as errors
cmd /c "node backend/src/config/seed.js 2>&1"
if ($LASTEXITCODE -eq 0) {
    Write-Host "  [OK]   Database seeded" -ForegroundColor Green
} else {
    Write-Host "  [WARN] Seeding had issues (exit code: $LASTEXITCODE)" -ForegroundColor Yellow
}
Write-Host ""

# --- Step 4: Start the App ---
Write-Host "[4/4] Starting the application..." -ForegroundColor Yellow

# Kill any existing processes on ports 5000 and 5173 to prevent EADDRINUSE
foreach ($port in @(5000, 5173, 5174)) {
    $conn = Get-NetTCPConnection -LocalPort $port -ErrorAction SilentlyContinue
    if ($conn) {
        $conn | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }
        Write-Host "  [OK]   Freed port $port" -ForegroundColor DarkGreen
    }
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Backend:  http://localhost:5000" -ForegroundColor Blue
Write-Host "  Frontend: http://localhost:5173" -ForegroundColor Green
Write-Host "  Press Ctrl+C to stop" -ForegroundColor DarkGray
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

npx concurrently -n BACKEND,FRONTEND -c blue,green "npm run dev --prefix backend" "npm run dev --prefix frontend"
