param(
  [ValidateSet('Debug', 'Release')]
  [string]$Configuration = 'Debug'
)

$ErrorActionPreference = 'Stop'

$projectRoot = Split-Path -Parent $PSScriptRoot
$androidRoot = Join-Path $projectRoot 'android'
$packageVersion = (Get-Content -LiteralPath (Join-Path $projectRoot 'package.json') -Raw | ConvertFrom-Json).version

function Test-Java21([string]$candidate) {
  if (-not $candidate) { return $false }
  $java = Join-Path $candidate 'bin\java.exe'
  if (-not (Test-Path -LiteralPath $java)) { return $false }
  $releaseFile = Join-Path $candidate 'release'
  if (-not (Test-Path -LiteralPath $releaseFile)) { return $false }
  return (Get-Content -LiteralPath $releaseFile -Raw) -match 'JAVA_VERSION="21\.'
}

$javaCandidates = @($env:JAVA_HOME)
$javaCandidates += Get-ChildItem 'C:\Program Files\Java' -Directory -Filter 'jdk-21*' -ErrorAction SilentlyContinue | Select-Object -ExpandProperty FullName
$javaCandidates += Get-ChildItem (Join-Path $env:LOCALAPPDATA 'Microsoft\JDK') -Directory -Filter 'jdk-21*' -ErrorAction SilentlyContinue | Select-Object -ExpandProperty FullName
$javaCandidates += 'C:\Program Files\Android\Android Studio\jbr'
$javaHome = $javaCandidates | Where-Object { Test-Java21 $_ } | Select-Object -First 1
if (-not $javaHome) {
  throw 'Java 21 was not found. Install Android Studio or Microsoft OpenJDK 21.'
}

$sdkCandidates = @(
  $env:ANDROID_HOME,
  $env:ANDROID_SDK_ROOT,
  (Join-Path $env:LOCALAPPDATA 'Android\Sdk')
)
$sdkRoot = $sdkCandidates | Where-Object {
  $_ -and (Test-Path -LiteralPath (Join-Path $_ 'platforms\android-36'))
} | Select-Object -First 1
if (-not $sdkRoot) {
  throw 'Android SDK API 36 was not found. Install it with Android Studio SDK Manager.'
}

$env:JAVA_HOME = $javaHome
$env:ANDROID_HOME = $sdkRoot
$env:ANDROID_SDK_ROOT = $sdkRoot
$env:PATH = "$(Join-Path $javaHome 'bin');$(Join-Path $sdkRoot 'platform-tools');$env:PATH"

$signingProperties = Join-Path $env:USERPROFILE '.android\kejian-release-signing.properties'
if ($Configuration -eq 'Release' -and -not (Test-Path -LiteralPath $signingProperties)) {
  throw 'Release signing configuration was not found in the current user profile.'
}

$localProperties = Join-Path $androidRoot 'local.properties'
$escapedSdkRoot = $sdkRoot.Replace('\', '\\').Replace(':', '\:')
[System.IO.File]::WriteAllText($localProperties, "sdk.dir=$escapedSdkRoot`r`n")

Push-Location $projectRoot
try {
  & npm.cmd run build
  if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
  & npx.cmd cap sync android
  if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
  & node.exe scripts/generate-android-assets.mjs
  if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

  $localGradle = Join-Path $env:LOCALAPPDATA 'Gradle\gradle-8.14.3\bin\gradle.bat'
  $gradle = if (Test-Path -LiteralPath $localGradle) {
    $localGradle
  } else {
    Join-Path $androidRoot 'gradlew.bat'
  }

  Push-Location $androidRoot
  try {
    $gradleTask = if ($Configuration -eq 'Release') { 'assembleRelease' } else { 'assembleDebug' }
    & $gradle $gradleTask
    if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
  } finally {
    Pop-Location
  }

  $sourceApk = if ($Configuration -eq 'Release') {
    Join-Path $androidRoot 'app\build\outputs\apk\release\app-release.apk'
  } else {
    Join-Path $androidRoot 'app\build\outputs\apk\debug\app-debug.apk'
  }
  $artifactDirectory = Join-Path $projectRoot 'artifacts'
  $artifactName = if ($Configuration -eq 'Release') { "kejian-v$packageVersion.apk" } else { "kejian-v$packageVersion-test.apk" }
  $artifactApk = Join-Path $artifactDirectory $artifactName
  New-Item -ItemType Directory -Force -Path $artifactDirectory | Out-Null
  Copy-Item -LiteralPath $sourceApk -Destination $artifactApk -Force
  Write-Output "APK_READY=$artifactApk"
} finally {
  Pop-Location
}
