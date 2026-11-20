# Arranca la web en local: http://localhost:8080  (se para con Ctrl+C)
#   .\servir.ps1 [puerto]
# Se ocupa de lo que PHP en Windows trae sin hacer: activa las extensiones (mbstring, pdo_sqlite, sqlite3, openssl)
# con un php.ini temporal y crea api/config.php (SQLite) si no existe. No toca la instalación de PHP.
param([int]$Puerto = 8080)
$ErrorActionPreference = 'Stop'
Set-Location $PSScriptRoot

$cmd = Get-Command php -ErrorAction SilentlyContinue
if (-not $cmd) { Write-Host 'No encuentro PHP. Instálalo con:  winget install PHP.PHP.8.3  (y abre una terminal nueva).' -ForegroundColor Red; exit 1 }
$php = $cmd.Source

$necesarias = 'mbstring', 'pdo_sqlite', 'sqlite3', 'openssl'
$cargadas = (& $php -m) | ForEach-Object { $_.Trim().ToLower() }
$faltan = $necesarias | Where-Object { $cargadas -notcontains $_ }
$phpArgs = @()
if ($faltan) {
    $ext = Join-Path (Split-Path $php) 'ext'
    $ini = Join-Path ([IO.Path]::GetTempPath()) 'europa-mitica-php.ini'
    $lineas = @("extension_dir=`"$ext`"") + ($necesarias | ForEach-Object { "extension=$_" })
    Set-Content -Path $ini -Value $lineas -Encoding ascii
    $phpArgs += '-c', $ini
    $aun = (& $php @phpArgs -m) | ForEach-Object { $_.Trim().ToLower() }
    $sin = $necesarias | Where-Object { $aun -notcontains $_ }
    if ($sin) { Write-Host ("A este PHP le faltan las extensiones: " + ($sin -join ', ') + " (carpeta $ext).") -ForegroundColor Red; exit 1 }
    Write-Host ("Activadas con un php.ini temporal: " + ($faltan -join ', '))
}

if (-not (Test-Path 'api\config.php')) {
    Set-Content -Path 'api\config.php' -Encoding utf8 -Value @'
<?php
return [
    'driver' => 'sqlite',
    'file' => __DIR__ . '/../datos/europa.sqlite',
    'correo' => ['modo' => 'archivo', 'archivo' => __DIR__ . '/../datos/correo.log'],
];
'@
    Write-Host 'Creado api\config.php (SQLite).'
}

Write-Host "Europa Mítica en http://localhost:$Puerto  (Ctrl+C para parar)"
& $php @phpArgs -S "localhost:$Puerto" -t $PSScriptRoot
