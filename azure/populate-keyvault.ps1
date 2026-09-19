#Requires -Version 5.1
<#
.SYNOPSIS
  Populate HanFlix Key Vault with production secrets from a .env file.

.DESCRIPTION
  Reads KEY=VALUE pairs from a dotenv file and pushes them to Azure Key Vault.
  Skips empty values. Validates JWT secrets are >= 32 chars, MongoDB URI
  starts with mongodb:// or mongodb+srv://.

.PARAMETER EnvFile
  Path to the dotenv file with secrets. Default: secrets.production.template

.PARAMETER ResourcePrefix
  Azure resource prefix (must match deployed infrastructure). Default: hanflix

.EXAMPLE
  # Copy template, fill in secrets, then:
  .\populate-keyvault.ps1 -EnvFile secrets.local -ResourcePrefix hanflix
#>

param(
  [string] $EnvFile = "secrets.production.template",
  [string] $ResourcePrefix = "hanflix"
)

$ErrorActionPreference = "Stop"
$ProgressPreference = "Continue"

function Write-Success($msg) { Write-Host "[OK] $msg" -ForegroundColor Green }
function Write-Info($msg) { Write-Host "[INFO] $msg" -ForegroundColor Cyan }
function Write-Warn($msg) { Write-Host "[WARN] $msg" -ForegroundColor Yellow }
function Write-Fail($msg) { Write-Host "[FAIL] $msg" -ForegroundColor Red }

$rgName = "rg-$ResourcePrefix"

# ---- Resolve Key Vault name from latest deployment ----
$jmesQuery = 'sort_by(@, &properties.timestamp)[-1].name'
$latestDeploy = az deployment group list -g $rgName --query $jmesQuery -o tsv
if (-not $latestDeploy) {
  Write-Fail "No deployment found in $rgName. Run deploy.ps1 first."
  exit 1
}

$kvName = az deployment group show -g $rgName -n $latestDeploy --query "properties.outputs.keyVaultName.value" -o tsv
if (-not $kvName) {
  Write-Fail "Cannot resolve keyVaultName from deployment $latestDeploy"
  exit 1
}
Write-Success "Key Vault: $kvName"

# ---- Read dotenv file ----
if (-not (Test-Path $EnvFile)) {
  Write-Fail "Env file not found: $EnvFile"
  Write-Info "  1. Copy secrets.production.template to a new file (e.g. secrets.local)"
  Write-Info "  2. Fill in values"
  Write-Info "  3. Re-run this script with -EnvFile secrets.local"
  exit 1
}

Write-Host ""
Write-Host "Reading secrets from: $EnvFile" -ForegroundColor Cyan
Write-Host ""

# ---- Parse dotenv ----
$secrets = @{}
foreach ($line in Get-Content $EnvFile) {
  $trimmed = $line.Trim()
  if (-not $trimmed -or $trimmed.StartsWith("#")) { continue }
  $eqIdx = $trimmed.IndexOf("=")
  if ($eqIdx -lt 1) { continue }
  $key = $trimmed.Substring(0, $eqIdx).Trim()
  $value = $trimmed.Substring($eqIdx + 1).Trim()
  # strip inline comments and surrounding quotes
  $value = $value -replace '\s+#.*$', ''
  $value = $value.Trim('"').Trim("'")
  $secrets[$key] = $value
}

# ---- Validations ----
$failures = @()
if (-not $secrets["MONGODB_URI"] -or -not ($secrets["MONGODB_URI"] -match "^mongodb(\+srv)?://")) {
  $failures += "MONGODB_URI missing or invalid (must start with mongodb:// or mongodb+srv://)"
}
if (-not $secrets["JWT_ACCESS_SECRET"] -or $secrets["JWT_ACCESS_SECRET"].Length -lt 32) {
  $failures += "JWT_ACCESS_SECRET missing or shorter than 32 chars"
}
if (-not $secrets["JWT_REFRESH_SECRET"] -or $secrets["JWT_REFRESH_SECRET"].Length -lt 32) {
  $failures += "JWT_REFRESH_SECRET missing or shorter than 32 chars"
}
if ($secrets["JWT_ACCESS_SECRET"] -and $secrets["JWT_ACCESS_SECRET"] -eq $secrets["JWT_REFRESH_SECRET"]) {
  $failures += "JWT_ACCESS_SECRET and JWT_REFRESH_SECRET must differ"
}
if (-not $secrets["SEED_ADMIN_PASSWORD"] -or $secrets["SEED_ADMIN_PASSWORD"] -eq "ChangeMe123!" -or $secrets["SEED_ADMIN_PASSWORD"].Length -lt 10) {
  $failures += "SEED_ADMIN_PASSWORD missing, default, or shorter than 10 chars"
}

# Required in production (these env validations are enforced)
foreach ($required in @("R2_ACCOUNT_ID","R2_ACCESS_KEY_ID","R2_SECRET_ACCESS_KEY","R2_BUCKET_NAME",
                        "SMTP_HOST","SMTP_FROM","METRICS_TOKEN",
                        "AZURE_TRANSLATOR_KEY","AZURE_TRANSLATOR_REGION",
                        "AZURE_SPEECH_KEY","AZURE_SPEECH_REGION")) {
  if (-not $secrets[$required]) {
    $failures += "$required missing (required by backend env validation in production)"
  }
}

# REDIS_URL is OPTIONAL — middleware falls back to in-memory when unset.
# We still push it to Key Vault (even as empty) so the bicep secretRef resolves.
# No validation error here.

if ($secrets["METRICS_TOKEN"] -and $secrets["METRICS_TOKEN"].Length -lt 32) {
  $failures += "METRICS_TOKEN shorter than 32 chars"
}

if ($failures.Count -gt 0) {
  Write-Fail "Validation errors:"
  foreach ($f in $failures) { Write-Host "  - $f" -ForegroundColor Red }
  exit 1
}

Write-Success "All required secrets present"

# ---- Push to Key Vault ----
Write-Host ""
Write-Host "Pushing secrets to Key Vault..." -ForegroundColor Cyan
Write-Host ""

$success = 0
$skipped = 0
$failed = 0

foreach ($key in $secrets.Keys) {
  $value = $secrets[$key]
  if (-not $value) {
    Write-Warn "  SKIP $key (empty)"
    $skipped++
    continue
  }

  # Map env var name to Key Vault secret name (UPPERCASE, hyphens for spaces)
  $secretName = $key.ToUpper() -replace "_", "-"

  try {
    az keyvault secret set --vault-name $kvName --name $secretName --value $value --output none 2>&1 | Out-Null
    if ($LASTEXITCODE -eq 0) {
      Write-Success "  SET $secretName"
      $success++
    } else {
      Write-Fail "  FAILED $secretName"
      $failed++
    }
  } catch {
    Write-Fail "  ERROR $secretName $_"
    $failed++
  }
}

Write-Host ""
Write-Host "Summary: $success set, $skipped skipped, $failed failed" -ForegroundColor Cyan

if ($failed -gt 0) {
  exit 1
}

Write-Success "All secrets deployed to Key Vault"
Write-Host ""
Write-Host "NEXT STEPS:" -ForegroundColor Yellow
Write-Host "  1. Verify backend reads these secrets by deploying with -BindKeyVaultSecrets" -ForegroundColor Yellow
Write-Host "  2. Delete the source .env file to avoid leaking secrets" -ForegroundColor Yellow
Write-Host ""
