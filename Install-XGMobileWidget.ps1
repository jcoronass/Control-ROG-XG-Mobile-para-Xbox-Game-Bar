<#
.SYNOPSIS
    Instalador automático Beta 0.0.1 del Widget Xbox Game Bar (XG Mobile RTX 5070 Ti + Ryzen Z2 Extreme).
#>
$ErrorActionPreference = "Stop"

if (-not ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
    Write-Host "Solicitando permisos de administrador para instalar el certificado de prueba y el paquete MSIX..." -ForegroundColor Yellow
    Start-Process powershell.exe -Verb RunAs -ArgumentList "-NoProfile -ExecutionPolicy Bypass -File `"$PSCommandPath`""
    exit
}

$here = Split-Path -Parent $MyInvocation.MyCommand.Path
$cer = Get-ChildItem -Path $here -Filter "*.cer" | Select-Object -First 1
$msix = Get-ChildItem -Path $here -Filter "*.msix" | Select-Object -First 1
if (-not $msix) {
    $msix = Get-ChildItem -Path $here -Filter "*.appx" | Select-Object -First 1
}

if (-not $msix) {
    Write-Host "ERROR: No se encontró ningún archivo .msix en $here" -ForegroundColor Red
    Read-Host "Pulsa Enter para salir"
    exit 1
}

# 1. Inicializar carpeta C:\eGPU_Profiles con games_profiles.json si no existe
$profilesRoot = "C:\eGPU_Profiles"
New-Item -ItemType Directory -Force -Path "$profilesRoot\eGPU" | Out-Null
New-Item -ItemType Directory -Force -Path "$profilesRoot\Handheld" | Out-Null

$bundledProfiles = Join-Path $here "games_profiles.json"
$targetProfiles = Join-Path $profilesRoot "games_profiles.json"
if ((Test-Path $bundledProfiles) -and -not (Test-Path $targetProfiles)) {
    Copy-Item -Path $bundledProfiles -Destination $targetProfiles -Force
    Write-Host "Archivo inicial copiado en $targetProfiles" -ForegroundColor Cyan
}

# 2. Instalar certificado temporal en TrustedPeople y Root para sideload sin Store
if ($cer) {
    Write-Host "Instalando certificado de firma Beta ($($cer.Name))..." -ForegroundColor Cyan
    Import-Certificate -FilePath $cer.FullName -CertStoreLocation "Cert:\LocalMachine\TrustedPeople" | Out-Null
    Import-Certificate -FilePath $cer.FullName -CertStoreLocation "Cert:\LocalMachine\Root" | Out-Null
}

# 3. Registrar paquete MSIX en Windows 11
Write-Host "Instalando paquete $($msix.Name)..." -ForegroundColor Green
Add-AppxPackage -Path $msix.FullName -ForceApplicationShutdown

Write-Host ""
Write-Host "===============================================================" -ForegroundColor Green
Write-Host "  INSTALACION COMPLETADA (Beta 0.0.1)" -ForegroundColor Green
Write-Host "===============================================================" -ForegroundColor Green
Write-Host "1. Pulsa el boton Xbox o Win + G para abrir Xbox Game Bar."
Write-Host "2. Abre el menu de Widgets y selecciona 'XG Mobile RTX 5070 Ti'."
Write-Host "3. Edita tus juegos en: C:\eGPU_Profiles\games_profiles.json"
Write-Host ""
Read-Host "Pulsa Enter para cerrar"
