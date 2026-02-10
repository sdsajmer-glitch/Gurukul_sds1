# ==============================================================================
# QUICK FIX SCRIPT FOR ENROLLMENT STATUS ISSUE (PowerShell)
# ==============================================================================
# This script applies the complete fix to your Supabase database
# Run this in PowerShell if you have PostgreSQL command-line access
# ==============================================================================

Write-Host "🔧 Enrollment Status Fix - Starting..." -ForegroundColor Cyan
Write-Host ""

# Check if psql is available
$psqlPath = Get-Command psql -ErrorAction SilentlyContinue

if (-not $psqlPath) {
    Write-Host "❌ ERROR: PostgreSQL client (psql) is not installed" -ForegroundColor Red
    Write-Host "Please install it or run the SQL script manually in Supabase Dashboard" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "You can download PostgreSQL from: https://www.postgresql.org/download/windows/" -ForegroundColor White
    exit 1
}

# Ask for database connection details
Write-Host "📝 Please provide your Supabase database connection details:" -ForegroundColor Cyan
Write-Host "(You can find these in your Supabase Dashboard → Settings → Database)" -ForegroundColor Gray
Write-Host ""

$dbHost = Read-Host "Database Host (e.g., db.xxx.supabase.co)"
$dbName = Read-Host "Database Name (usually 'postgres')"
$dbUser = Read-Host "Database User (usually 'postgres')"
$dbPasswordSecure = Read-Host "Database Password" -AsSecureString
$dbPassword = [Runtime.InteropServices.Marshal]::PtrToStringAuto(
    [Runtime.InteropServices.Marshal]::SecureStringToBSTR($dbPasswordSecure)
)

Write-Host ""

# Set environment variable for password (PostgreSQL uses this)
$env:PGPASSWORD = $dbPassword

# Construct connection details
$connectionString = "host=$dbHost port=5432 dbname=$dbName user=$dbUser"

Write-Host "🔌 Testing database connection..." -ForegroundColor Cyan

# Test connection
$testResult = & psql $connectionString -c "SELECT version();" 2>&1

if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ Connection successful!" -ForegroundColor Green
} else {
    Write-Host "❌ Connection failed. Please check your credentials." -ForegroundColor Red
    Write-Host "Error: $testResult" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "🚀 Applying fix script..." -ForegroundColor Cyan
Write-Host ""

# Get the script directory
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$sqlFile = Join-Path $scriptDir "FIX_ENROLLMENT_STATUS_COMPLETE.sql"

# Check if SQL file exists
if (-not (Test-Path $sqlFile)) {
    Write-Host "❌ ERROR: Cannot find FIX_ENROLLMENT_STATUS_COMPLETE.sql" -ForegroundColor Red
    Write-Host "Expected location: $sqlFile" -ForegroundColor Yellow
    exit 1
}

# Run the SQL fix script
& psql $connectionString -f $sqlFile

if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "==========================================" -ForegroundColor Green
    Write-Host "✅ FIX APPLIED SUCCESSFULLY!" -ForegroundColor Green
    Write-Host "==========================================" -ForegroundColor Green
    Write-Host ""
    Write-Host "Next steps:" -ForegroundColor Cyan
    Write-Host "1. Refresh your web application (Ctrl+F5)" -ForegroundColor White
    Write-Host "2. Try changing a student's enrollment status" -ForegroundColor White
    Write-Host "3. Try assigning a student to a class" -ForegroundColor White
    Write-Host ""
    Write-Host "If you encounter any issues:" -ForegroundColor Yellow
    Write-Host "- Check browser console (F12) for errors" -ForegroundColor White
    Write-Host "- Review ENROLLMENT_FIX_README.md for troubleshooting" -ForegroundColor White
    Write-Host "- Run verification queries (see README)" -ForegroundColor White
    Write-Host ""
} else {
    Write-Host ""
    Write-Host "❌ Fix script failed. Please review errors above." -ForegroundColor Red
    Write-Host "You can also run the SQL manually in Supabase Dashboard." -ForegroundColor Yellow
    Write-Host ""
    exit 1
}

# Clear password from environment
$env:PGPASSWORD = $null
