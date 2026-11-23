import slnRaw from '../../XGMobileGameBar.sln?raw';
import wapprojRaw from '../../XGMobile.Package/XGMobile.Package.wapproj?raw';
import manifestRaw from '../../XGMobile.Package/Package.appxmanifest?raw';
import publicInfoRaw from '../../XGMobile.Package/Public/info.txt?raw';
import widgetCsprojRaw from '../../XGMobile.Widget/XGMobile.Widget.csproj?raw';
import widgetInternalManifestRaw from '../../XGMobile.Widget/Package.appxmanifest?raw';
import widgetAssemblyRaw from '../../XGMobile.Widget/Properties/AssemblyInfo.cs?raw';
import appXamlRaw from '../../XGMobile.Widget/App.xaml?raw';
import appCsRaw from '../../XGMobile.Widget/App.xaml.cs?raw';
import mainPageXamlRaw from '../../XGMobile.Widget/MainPage.xaml?raw';
import mainPageCsRaw from '../../XGMobile.Widget/MainPage.xaml.cs?raw';
import helperCsprojRaw from '../../XGMobile.Helper/XGMobile.Helper.csproj?raw';
import helperPubxmlRaw from '../../XGMobile.Helper/Properties/PublishProfiles/win-x64.pubxml?raw';
import programCsRaw from '../../XGMobile.Helper/Program.cs?raw';
import gpuEjectorCsRaw from '../../XGMobile.Helper/GpuEjector.cs?raw';
import profileManagerCsRaw from '../../XGMobile.Helper/ProfileManager.cs?raw';
import gamesProfilesJsonRaw from '../../XGMobile.Helper/games_profiles.json?raw';
import workflowYmlRaw from '../../.github/workflows/release-beta-0.0.1.yml?raw';
import batInstallerRaw from '../../Instalar-DobleClick.bat?raw';
import psInstallerRaw from '../../Install-XGMobileWidget.ps1?raw';
import readmeRaw from '../../README.md?raw';

export interface SolutionFileEntry {
  id: string;
  group: 'Empaquetado WAP' | 'Widget UWP' | 'Helper Win32 (.NET 8)' | 'GitHub Beta 0.0.1';
  path: string;
  summary: string;
  content: string;
}

export const SOLUTION_FILES: SolutionFileEntry[] = [
  {
    id: 'manifest',
    group: 'Empaquetado WAP',
    path: 'XGMobile.Package/Package.appxmanifest',
    summary: 'Declara microsoft.gameBarUIExtension, windows.appService y windows.fullTrustProcess.',
    content: manifestRaw,
  },
  {
    id: 'wapproj',
    group: 'Empaquetado WAP',
    path: 'XGMobile.Package/XGMobile.Package.wapproj',
    summary: 'Windows Application Packaging Project que agrupa el Widget UWP y el Helper Win32.',
    content: wapprojRaw,
  },
  {
    id: 'sln',
    group: 'Empaquetado WAP',
    path: 'XGMobileGameBar.sln',
    summary: 'Solución Visual Studio 2022 x64 con los 3 proyectos.',
    content: slnRaw,
  },
  {
    id: 'public-info',
    group: 'Empaquetado WAP',
    path: 'XGMobile.Package/Public/info.txt',
    summary: 'Carpeta Public requerida por la extensión Game Bar.',
    content: publicInfoRaw,
  },
  {
    id: 'mainpage-xaml',
    group: 'Widget UWP',
    path: 'XGMobile.Widget/MainPage.xaml',
    summary: 'Interfaz compacta Game Bar para mando/táctil (RTX 5070 Ti vs Radeon Z2E).',
    content: mainPageXamlRaw,
  },
  {
    id: 'mainpage-cs',
    group: 'Widget UWP',
    path: 'XGMobile.Widget/MainPage.xaml.cs',
    summary: 'Mensajería AppServiceConnection, atajos mando X/Y, alertas PNP_VETO_TYPE y sync.',
    content: mainPageCsRaw,
  },
  {
    id: 'app-cs',
    group: 'Widget UWP',
    path: 'XGMobile.Widget/App.xaml.cs',
    summary: 'Activación ms-gamebarwidget + servidor in-process OnBackgroundActivated AppService.',
    content: appCsRaw,
  },
  {
    id: 'app-xaml',
    group: 'Widget UWP',
    path: 'XGMobile.Widget/App.xaml',
    summary: 'Raíz de la aplicación UWP.',
    content: appXamlRaw,
  },
  {
    id: 'widget-csproj',
    group: 'Widget UWP',
    path: 'XGMobile.Widget/XGMobile.Widget.csproj',
    summary: 'Referencias Microsoft.Gaming.XboxGameBar y WindowsDesktop SDK.',
    content: widgetCsprojRaw,
  },
  {
    id: 'widget-manifest',
    group: 'Widget UWP',
    path: 'XGMobile.Widget/Package.appxmanifest',
    summary: 'Manifiesto interno mínimo requerido para compilar el proyecto UWP.',
    content: widgetInternalManifestRaw,
  },
  {
    id: 'widget-assembly',
    group: 'Widget UWP',
    path: 'XGMobile.Widget/Properties/AssemblyInfo.cs',
    summary: 'Metadatos de ensamblado del widget UWP.',
    content: widgetAssemblyRaw,
  },
  {
    id: 'gpu-ejector',
    group: 'Helper Win32 (.NET 8)',
    path: 'XGMobile.Helper/GpuEjector.cs',
    summary: 'P/Invoke cfgmgr32.dll (CM_Request_Device_EjectW), árbol PnP VEN_10DE y NVML/PDH.',
    content: gpuEjectorCsRaw,
  },
  {
    id: 'profile-manager',
    group: 'Helper Win32 (.NET 8)',
    path: 'XGMobile.Helper/ProfileManager.cs',
    summary: 'Dual Profile Swapper con backup bidireccional y guardia de procesos en ejecución.',
    content: profileManagerCsRaw,
  },
  {
    id: 'program-cs',
    group: 'Helper Win32 (.NET 8)',
    path: 'XGMobile.Helper/Program.cs',
    summary: 'Cliente AppServiceConnection + WMI ManagementEventWatcher (Win32_DeviceChangeEvent).',
    content: programCsRaw,
  },
  {
    id: 'games-json',
    group: 'Helper Win32 (.NET 8)',
    path: 'XGMobile.Helper/games_profiles.json',
    summary: 'Configuración de juegos con rutas %LOCALAPPDATA% y C:\\eGPU_Profiles\\.',
    content: gamesProfilesJsonRaw,
  },
  {
    id: 'helper-csproj',
    group: 'Helper Win32 (.NET 8)',
    path: 'XGMobile.Helper/XGMobile.Helper.csproj',
    summary: 'Proyecto .NET 8 Win32 con System.Management y System.Diagnostics.PerformanceCounter.',
    content: helperCsprojRaw,
  },
  {
    id: 'helper-pubxml',
    group: 'Helper Win32 (.NET 8)',
    path: 'XGMobile.Helper/Properties/PublishProfiles/win-x64.pubxml',
    summary: 'Perfil self-contained win-x64 para no requerir .NET 8 preinstalado en la consola.',
    content: helperPubxmlRaw,
  },
  {
    id: 'workflow',
    group: 'GitHub Beta 0.0.1',
    path: '.github/workflows/release-beta-0.0.1.yml',
    summary: 'GitHub Actions: compila MSIX en windows-2022 y publica Release beta-0.0.1.',
    content: workflowYmlRaw,
  },
  {
    id: 'bat-installer',
    group: 'GitHub Beta 0.0.1',
    path: 'Instalar-DobleClick.bat',
    summary: 'Lanzador de doble clic para instalar el widget en la consola.',
    content: batInstallerRaw,
  },
  {
    id: 'ps-installer',
    group: 'GitHub Beta 0.0.1',
    path: 'Install-XGMobileWidget.ps1',
    summary: 'Crea C:\\eGPU_Profiles, instala certificado Beta y ejecuta Add-AppxPackage.',
    content: psInstallerRaw,
  },
  {
    id: 'readme',
    group: 'GitHub Beta 0.0.1',
    path: 'README.md',
    summary: 'Guía completa del repositorio, Beta 0.0.1 y depuración Win + G.',
    content: readmeRaw,
  },
];
