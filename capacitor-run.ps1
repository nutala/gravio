param(
  [string]$ServerUrl = "http://192.168.100.14:3000"
)

$env:ANDROID_HOME = "$env:LOCALAPPDATA\Android\Sdk"
$env:JAVA_HOME = "C:\Program Files\Android\Android Studio\jbr"
$env:Path += ";$env:JAVA_HOME\bin"

Write-Host "=== GraviO - Build Android ===" -ForegroundColor Cyan
Write-Host "Serveur : $ServerUrl" -ForegroundColor Yellow
Write-Host ""

$env:CAP_SERVER_URL = $ServerUrl

npm run build
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

npx cap sync android
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

npx cap run android
