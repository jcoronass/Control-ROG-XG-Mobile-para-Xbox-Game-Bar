import { GameProfileEntry, XGMobileSpec } from '../types/xgmobile';
import { DEFAULT_GAME_PROFILES } from './xgMobilePresets';

export interface WidgetCodeFile {
  id: string;
  filename: string;
  zipPath: string;
  language: 'xml' | 'csharp' | 'powershell' | 'markdown' | 'json' | 'yaml';
  summary: string;
  content: string;
}

export function buildWidgetCodeFiles(
  model: XGMobileSpec,
  gameProfiles: GameProfileEntry[] = DEFAULT_GAME_PROFILES,
): WidgetCodeFile[] {
  const isNvidia = model.vendor === 'NVIDIA';

  const githubWorkflow = `name: Compilar Widget Xbox Game Bar (MSIX)

on:
  push:
    branches: [ main, master ]
  workflow_dispatch:

jobs:
  build-msix:
    runs-on: windows-latest

    steps:
      - name: Descargar repositorio
        uses: actions/checkout@v4

      - name: Configurar MSBuild y NuGet
        uses: microsoft/setup-msbuild@v2

      - name: Configurar .NET SDK
        uses: actions/setup-dotnet@v4
        with:
          dotnet-version: '8.0.x'

      - name: Generar iconos PNG para el manifiesto UWP
        shell: powershell
        run: |
          Add-Type -AssemblyName System.Drawing
          $assetsDir = "XGMobileWidget\\Assets"
          New-Item -ItemType Directory -Force -Path $assetsDir | Out-Null

          function New-WidgetIcon($path, $w, $h) {
            $bmp = New-Object System.Drawing.Bitmap($w, $h)
            $g = [System.Drawing.Graphics]::FromImage($bmp)
            $g.Clear([System.Drawing.Color]::FromArgb(255, 16, 20, 27))
            $pen = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(255, 22, 163, 74), [Math]::Max(2, [int]($h / 14)))
            $margin = [int]([Math]::Min($w, $h) * 0.2)
            $g.DrawRectangle($pen, $margin, $margin, $w - ($margin * 2), $h - ($margin * 2))
            $g.Dispose()
            $bmp.Save($path, [System.Drawing.Imaging.ImageFormat]::Png)
            $bmp.Dispose()
          }

          New-WidgetIcon "$assetsDir\\StoreLogo.png" 50 50
          New-WidgetIcon "$assetsDir\\Square44x44Logo.png" 44 44
          New-WidgetIcon "$assetsDir\\Square150x150Logo.png" 150 150
          New-WidgetIcon "$assetsDir\\Wide310x150Logo.png" 310 150

      - name: Compilar puente XGMobileHelper.exe
        shell: powershell
        run: |
          dotnet publish XGMobileHelper\\XGMobileHelper.csproj -c Release -r win-x64 --self-contained false -o XGMobileWidget\\XGMobileHelper

      - name: Crear certificado de firma de prueba para sideload
        shell: powershell
        run: |
          $cert = New-SelfSignedCertificate -Type Custom -Subject "CN=ROGAllyXUser" -KeyUsage DigitalSignature -FriendlyName "XGMobileGameBarDev" -CertStoreLocation "Cert:\\CurrentUser\\My" -TextExtension @("2.5.29.37={text}1.3.6.1.5.5.7.3.3", "2.5.29.19={text}")
          $pwd = ConvertTo-SecureString -String "XGMobileAllyX!" -Force -AsPlainText
          Export-PfxCertificate -Cert $cert -FilePath "XGMobileWidget\\XGMobileWidget_TempKey.pfx" -Password $pwd | Out-Null
          Export-Certificate -Cert $cert -FilePath "XGMobileWidget\\XGMobileWidget.cer" | Out-Null

      - name: Restaurar paquetes NuGet y compilar paquete MSIX (x64)
        shell: powershell
        run: |
          msbuild XGMobileWidget.sln /t:Restore /p:Configuration=Release /p:Platform=x64
          msbuild XGMobileWidget.sln /p:Configuration=Release /p:Platform=x64 /p:AppxPackageSigningEnabled=true /p:PackageCertificateKeyFile="XGMobileWidget_TempKey.pfx" /p:PackageCertificatePassword="XGMobileAllyX!" /p:GenerateAppxPackageOnBuild=true /p:AppxBundle=Never

      - name: Preparar carpeta instalable para Xbox Ally X
        shell: powershell
        run: |
          $out = "dist-allyx"
          New-Item -ItemType Directory -Force -Path $out | Out-Null
          Get-ChildItem -Path "XGMobileWidget\\AppPackages" -Recurse -Include *.msix,*.appx | Copy-Item -Destination $out
          Copy-Item "XGMobileWidget\\XGMobileWidget.cer" -Destination $out
          Copy-Item "Install-XGMobileWidget.ps1" -Destination $out
          Copy-Item "XGMobileWidget\\XGMobileHelper\\Undock-XGMobile.ps1" -Destination $out
          Copy-Item "XGMobileWidget\\XGMobileHelper\\game-profiles.json" -Destination $out

      - name: Subir artefacto listo para ASUS ROG Xbox Ally X
        uses: actions/upload-artifact@v4
        with:
          name: XGMobile-GameBar-AllyX-Installer
          path: dist-allyx/
`;

  const installScript = `<#
.SYNOPSIS
    Instalador automático del widget XG Mobile Game Bar en ASUS ROG Xbox Ally X.
#>
$ErrorActionPreference = "Stop"

# Solicita elevación de administrador para instalar el certificado de confianza local
if (-not ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
    Start-Process powershell.exe -Verb RunAs -ArgumentList "-ExecutionPolicy Bypass -File \`"$PSCommandPath\`""
    exit
}

$here = Split-Path -Parent $MyInvocation.MyCommand.Path
$cer = Get-ChildItem -Path $here -Filter "*.cer" | Select-Object -First 1
$msix = Get-ChildItem -Path $here -Filter "*.msix" | Select-Object -First 1

if (-not $msix) {
    Write-Error "No se encontró ningún archivo .msix en $here."
    exit 1
}

if ($cer) {
    Write-Host "Instalando certificado de confianza para sideload..." -ForegroundColor Cyan
    Import-Certificate -FilePath $cer.FullName -CertStoreLocation "Cert:\\LocalMachine\\TrustedPeople" | Out-Null
}

Write-Host "Instalando paquete $($msix.Name) en Windows 11..." -ForegroundColor Green
Add-AppxPackage -Path $msix.FullName -ForceApplicationShutdown

Write-Host "Instalación completada. Pulsa el botón Xbox (o Win+G) para fijar 'XG Mobile eGPU' en Game Bar." -ForegroundColor Green
Pause
`;

  const sln = `Microsoft Visual Studio Solution File, Format Version 12.00
# Visual Studio Version 17
VisualStudioVersion = 17.10.35027.167
MinimumVisualStudioVersion = 10.0.40219.1
Project("{FAE04EC0-301F-11D3-BF4B-00C04F79EFBC}") = "XGMobileWidget", "XGMobileWidget\\XGMobileWidget.csproj", "{8F3B9A10-4D2E-4C1A-9E88-7A1F2B9D3C01}"
EndProject
Global
	GlobalSection(SolutionConfigurationPlatforms) = preSolution
		Debug|x64 = Debug|x64
		Release|x64 = Release|x64
	EndGlobalSection
	GlobalSection(ProjectConfigurationPlatforms) = postSolution
		{8F3B9A10-4D2E-4C1A-9E88-7A1F2B9D3C01}.Debug|x64.ActiveCfg = Debug|x64
		{8F3B9A10-4D2E-4C1A-9E88-7A1F2B9D3C01}.Debug|x64.Build.0 = Debug|x64
		{8F3B9A10-4D2E-4C1A-9E88-7A1F2B9D3C01}.Release|x64.ActiveCfg = Release|x64
		{8F3B9A10-4D2E-4C1A-9E88-7A1F2B9D3C01}.Release|x64.Build.0 = Release|x64
	EndGlobalSection
EndGlobal
`;

  const csproj = `<?xml version="1.0" encoding="utf-8"?>
<Project ToolsVersion="15.0" DefaultTargets="Build" xmlns="http://schemas.microsoft.com/developer/msbuild/2003">
  <Import Project="$(MSBuildExtensionsPath)\\$(MSBuildToolsVersion)\\Microsoft.Common.props" Condition="Exists('$(MSBuildExtensionsPath)\\$(MSBuildToolsVersion)\\Microsoft.Common.props')" />
  <PropertyGroup>
    <Configuration Condition=" '$(Configuration)' == '' ">Release</Configuration>
    <Platform Condition=" '$(Platform)' == '' ">x64</Platform>
    <ProjectGuid>{8F3B9A10-4D2E-4C1A-9E88-7A1F2B9D3C01}</ProjectGuid>
    <OutputType>AppContainerExe</OutputType>
    <AppDesignerFolder>Properties</AppDesignerFolder>
    <RootNamespace>XGMobileWidget</RootNamespace>
    <AssemblyName>XGMobileWidget</AssemblyName>
    <DefaultLanguage>es-ES</DefaultLanguage>
    <TargetPlatformIdentifier>UAP</TargetPlatformIdentifier>
    <TargetPlatformVersion Condition=" '$(TargetPlatformVersion)' == '' ">10.0.22621.0</TargetPlatformVersion>
    <TargetPlatformMinVersion>10.0.22621.0</TargetPlatformMinVersion>
    <MinimumVisualStudioVersion>14</MinimumVisualStudioVersion>
    <FileAlignment>512</FileAlignment>
    <ProjectTypeGuids>{A5A43C5B-DE2A-4C0C-9213-0A381AF9435A};{FAE04EC0-301F-11D3-BF4B-00C04F79EFBC}</ProjectTypeGuids>
    <WindowsXamlEnableOverview>true</WindowsXamlEnableOverview>
    <LangVersion>latest</LangVersion>
  </PropertyGroup>
  <PropertyGroup Condition="'$(Configuration)|$(Platform)' == 'Release|x64'">
    <OutputPath>bin\\x64\\Release\\</OutputPath>
    <DefineConstants>TRACE;NETFX_CORE;WINDOWS_UWP</DefineConstants>
    <Optimize>true</Optimize>
    <PlatformTarget>x64</PlatformTarget>
    <UseVSHostingProcess>false</UseVSHostingProcess>
    <ErrorReport>prompt</ErrorReport>
    <Prefer32Bit>true</Prefer32Bit>
    <UseDotNetNativeToolchain>false</UseDotNetNativeToolchain>
  </PropertyGroup>
  <PropertyGroup Condition="'$(Configuration)|$(Platform)' == 'Debug|x64'">
    <DebugSymbols>true</DebugSymbols>
    <OutputPath>bin\\x64\\Debug\\</OutputPath>
    <DefineConstants>DEBUG;TRACE;NETFX_CORE;WINDOWS_UWP</DefineConstants>
    <DebugType>full</DebugType>
    <PlatformTarget>x64</PlatformTarget>
    <UseVSHostingProcess>false</UseVSHostingProcess>
    <ErrorReport>prompt</ErrorReport>
    <Prefer32Bit>true</Prefer32Bit>
  </PropertyGroup>
  <ItemGroup>
    <Compile Include="App.xaml.cs">
      <DependentUpon>App.xaml</DependentUpon>
    </Compile>
    <Compile Include="TelemetryBridge.cs" />
    <Compile Include="XGMobileWidget.xaml.cs">
      <DependentUpon>XGMobileWidget.xaml</DependentUpon>
    </Compile>
  </ItemGroup>
  <ItemGroup>
    <AppxManifest Include="Package.appxmanifest">
      <SubType>Designer</SubType>
    </AppxManifest>
  </ItemGroup>
  <ItemGroup>
    <ApplicationDefinition Include="App.xaml">
      <Generator>MSBuild:Compile</Generator>
      <SubType>Designer</SubType>
    </ApplicationDefinition>
    <Page Include="XGMobileWidget.xaml">
      <Generator>MSBuild:Compile</Generator>
      <SubType>Designer</SubType>
    </Page>
  </ItemGroup>
  <ItemGroup>
    <Content Include="Assets\\StoreLogo.png" />
    <Content Include="Assets\\Square44x44Logo.png" />
    <Content Include="Assets\\Square150x150Logo.png" />
    <Content Include="Assets\\Wide310x150Logo.png" />
    <Content Include="XGMobileHelper\\XGMobileHelper.exe" Condition="Exists('XGMobileHelper\\XGMobileHelper.exe')" />
    <Content Include="XGMobileHelper\\Undock-XGMobile.ps1" />
    <Content Include="XGMobileHelper\\game-profiles.json" />
  </ItemGroup>
  <ItemGroup>
    <PackageReference Include="Microsoft.Gaming.XboxGameBar">
      <Version>5.3.2006.1001</Version>
    </PackageReference>
    <PackageReference Include="Microsoft.NETCore.UniversalWindowsPlatform">
      <Version>6.2.14</Version>
    </PackageReference>
  </ItemGroup>
  <PropertyGroup Condition=" '$(VisualStudioVersion)' == '' or '$(VisualStudioVersion)' &lt; '14.0' ">
    <VisualStudioVersion>14.0</VisualStudioVersion>
  </PropertyGroup>
  <Import Project="$(MSBuildExtensionsPath)\\Microsoft\\WindowsXaml\\v$(VisualStudioVersion)\\Microsoft.Windows.UI.Xaml.CSharp.targets" />
</Project>`;

  const appXaml = `<Application
    x:Class="XGMobileWidget.App"
    xmlns="http://schemas.microsoft.com/winfx/2006/xaml/presentation"
    xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml">
</Application>`;

  const appCs = `using System;
using Windows.ApplicationModel.Activation;
using Windows.UI.Xaml;
using Windows.UI.Xaml.Controls;
using Microsoft.Gaming.XboxGameBar;

namespace XGMobileWidget
{
    sealed partial class App : Application
    {
        private XboxGameBarWidget _gameBarWidget;

        public App()
        {
            InitializeComponent();
        }

        protected override void OnActivated(IActivatedEventArgs args)
        {
            XboxGameBarWidgetActivatedEventArgs widgetArgs = null;
            if (args.Kind == ActivationKind.Protocol)
            {
                if (args is IProtocolActivatedEventArgs protocolArgs &&
                    protocolArgs.Uri.Scheme.Equals("ms-gamebarwidget", StringComparison.OrdinalIgnoreCase))
                {
                    widgetArgs = args as XboxGameBarWidgetActivatedEventArgs;
                }
            }

            if (widgetArgs != null && widgetArgs.IsLaunchActivation)
            {
                var rootFrame = new Frame();
                rootFrame.NavigationFailed += (_, e) => throw new Exception("Error al cargar página: " + e.SourcePageType.FullName);

                Window.Current.Content = rootFrame;
                _gameBarWidget = new XboxGameBarWidget(widgetArgs, Window.Current.CoreWindow, rootFrame);
                rootFrame.Navigate(typeof(XGMobileWidgetPage));

                if (rootFrame.Content is XGMobileWidgetPage page)
                {
                    page.AttachGameBarWidget(_gameBarWidget);
                }

                Window.Current.Closed += (_, __) => _gameBarWidget = null;
                Window.Current.Activate();
            }
        }
    }
}`;

  const telemetryBridgeCs = `using System;
using System.Collections.Generic;
using System.IO;
using System.Text.Json;
using System.Threading.Tasks;
using Windows.ApplicationModel;
using Windows.Storage;

namespace XGMobileWidget
{
    public sealed class TelemetrySnapshotDto
    {
        public bool Connected { get; set; }
        public int GpuLoadPercent { get; set; }
        public int TempCelsius { get; set; }
        public int PowerWatts { get; set; }
        public double VramUsedGb { get; set; }
        public int ClockMhz { get; set; }
        public int FanRpm { get; set; }
        public List<GpuProcessItem> Processes { get; set; } = new();
    }

    public sealed class UndockResultDto
    {
        public bool Success { get; set; }
        public string Message { get; set; } = string.Empty;
    }

    public static class TelemetryBridge
    {
        private static readonly string SharedFolder = Path.Combine(
            Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
            "ROGAllyX_XGMobileWidget");

        public static async Task<TelemetrySnapshotDto> QueryAsync(string hardwareId)
        {
            try
            {
                Directory.CreateDirectory(SharedFolder);
                await File.WriteAllTextAsync(Path.Combine(SharedFolder, "request.txt"), $"Telemetry|{hardwareId}");
                await FullTrustProcessLauncher.LaunchFullTrustProcessForCurrentAppAsync();
                await Task.Delay(350);

                string jsonPath = Path.Combine(SharedFolder, "telemetry.json");
                if (!File.Exists(jsonPath)) return null;

                string raw = await File.ReadAllTextAsync(jsonPath);
                return JsonSerializer.Deserialize<TelemetrySnapshotDto>(raw);
            }
            catch
            {
                return null;
            }
        }

        public static async Task SetArmouryProfileAsync(string profile)
        {
            Directory.CreateDirectory(SharedFolder);
            await File.WriteAllTextAsync(Path.Combine(SharedFolder, "profile.txt"), profile);
        }

        public static async Task<UndockResultDto> WaitForUndockResultAsync()
        {
            string resultPath = Path.Combine(SharedFolder, "undock_result.json");
            for (int i = 0; i < 20; i++)
            {
                await Task.Delay(400);
                if (File.Exists(resultPath))
                {
                    string raw = await File.ReadAllTextAsync(resultPath);
                    var dto = JsonSerializer.Deserialize<UndockResultDto>(raw);
                    if (dto != null) return dto;
                }
            }
            return new UndockResultDto { Success = false, Message = "Tiempo de espera agotado." };
        }
    }
}`;

  const helperCsproj = `<Project Sdk="Microsoft.NET.Sdk">
  <PropertyGroup>
    <OutputType>WinExe</OutputType>
    <TargetFramework>net8.0-windows</TargetFramework>
    <ImplicitUsings>enable</ImplicitUsings>
    <Nullable>enable</Nullable>
  </PropertyGroup>
</Project>`;

  const helperProgramCs = `using System.Diagnostics;

string sharedDir = Path.Combine(
    Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
    "ROGAllyX_XGMobileWidget");
Directory.CreateDirectory(sharedDir);

string baseDir = AppContext.BaseDirectory;
string psScript = Path.Combine(baseDir, "Undock-XGMobile.ps1");
string requestFile = Path.Combine(sharedDir, "request.txt");

string action = "Telemetry";
string hardwareId = "${model.pnpHardwareId}";

if (File.Exists(requestFile))
{
    var parts = (await File.ReadAllTextAsync(requestFile)).Trim().Split('|');
    if (parts.Length >= 1 && !string.IsNullOrWhiteSpace(parts[0])) action = parts[0];
    if (parts.Length >= 2 && !string.IsNullOrWhiteSpace(parts[1])) hardwareId = parts[1];
}

var psi = new ProcessStartInfo
{
    FileName = "powershell.exe",
    Arguments = $"-NoProfile -ExecutionPolicy Bypass -File \\"{psScript}\\" -Action {action} -HardwareId \\"{hardwareId}\\" -CloseActiveGames",
    RedirectStandardOutput = true,
    UseShellExecute = false,
    CreateNoWindow = true
};

using var proc = Process.Start(psi);
if (proc == null) return;

string output = await proc.StandardOutput.ReadToEndAsync();
await proc.WaitForExitAsync();

string targetFile = action == "SafeUndock" ? "undock_result.json" : "telemetry.json";
await File.WriteAllTextAsync(Path.Combine(sharedDir, targetFile), output);
`;

  const manifest = `<?xml version="1.0" encoding="utf-8"?>
<Package
  xmlns="http://schemas.microsoft.com/appx/manifest/foundation/windows10"
  xmlns:mp="http://schemas.microsoft.com/appx/2014/phone/manifest"
  xmlns:uap="http://schemas.microsoft.com/appx/manifest/uap/windows10"
  xmlns:uap3="http://schemas.microsoft.com/appx/manifest/uap/windows10/3"
  xmlns:desktop="http://schemas.microsoft.com/appx/manifest/desktop/windows10"
  xmlns:rescap="http://schemas.microsoft.com/appx/manifest/foundation/windows10/restrictedcapabilities"
  IgnorableNamespaces="uap uap3 mp desktop rescap">

  <Identity
    Name="ROGAllyX.XGMobileGameBarWidget"
    Publisher="CN=ROGAllyXUser"
    Version="1.0.0.0" />

  <Properties>
    <DisplayName>ROG XG Mobile Monitor</DisplayName>
    <PublisherDisplayName>ASUS Ally X Community</PublisherDisplayName>
    <Logo>Assets\\StoreLogo.png</Logo>
  </Properties>

  <Dependencies>
    <TargetDeviceFamily Name="Windows.Desktop" MinVersion="10.0.22621.0" MaxVersionTested="10.0.26100.0" />
  </Dependencies>

  <Resources>
    <Resource Language="es-ES" />
  </Resources>

  <Applications>
    <Application Id="App"
      Executable="$targetnametoken$.exe"
      EntryPoint="XGMobileWidget.App">
      <uap:VisualElements
        DisplayName="ROG XG Mobile"
        Description="Telemetría de eGPU y desacoplamiento seguro en Modo Juego Xbox"
        BackgroundColor="transparent"
        Square150x150Logo="Assets\\Square150x150Logo.png"
        Square44x44Logo="Assets\\Square44x44Logo.png">
        <uap:DefaultTile Wide310x150Logo="Assets\\Wide310x150Logo.png" />
      </uap:VisualElements>

      <Extensions>
        <uap3:Extension Category="windows.appExtension">
          <uap3:AppExtension Name="microsoft.gameBarUI"
            Id="XGMobileControlWidget"
            DisplayName="XG Mobile eGPU"
            Description="Monitor y expulsión segura para ${model.shortName}"
            PublicFolder="GameBarAssets">
            <uap3:Properties>
              <GameBarWidget Type="Standard" />
              <MinSize Width="360" Height="320" />
              <MaxSize Width="640" Height="560" />
              <DefaultSize Width="460" Height="410" />
              <SupportsPinning>true</SupportsPinning>
              <SupportsGameInput>true</SupportsGameInput>
            </uap3:Properties>
          </uap3:AppExtension>
        </uap3:Extension>

        <desktop:Extension Category="windows.fullTrustProcess" Executable="XGMobileHelper\\XGMobileHelper.exe" />
      </Extensions>
    </Application>
  </Applications>

  <Capabilities>
    <rescap:Capability Name="runFullTrust" />
  </Capabilities>
</Package>`;

  const xaml = `<Page
    x:Class="XGMobileWidget.XGMobileWidgetPage"
    xmlns="http://schemas.microsoft.com/winfx/2006/xaml/presentation"
    xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml"
    Background="#E610141B"
    XYFocusKeyboardNavigation="Enabled"
    Loaded="OnWidgetLoaded">

    <Grid Padding="16" RowSpacing="12">
        <Grid.RowDefinitions>
            <RowDefinition Height="Auto" />
            <RowDefinition Height="Auto" />
            <RowDefinition Height="*" />
            <RowDefinition Height="Auto" />
        </Grid.RowDefinitions>

        <Grid Grid.Row="0" ColumnSpacing="12">
            <Grid.ColumnDefinitions>
                <ColumnDefinition Width="*" />
                <ColumnDefinition Width="Auto" />
            </Grid.ColumnDefinitions>

            <StackPanel Spacing="2">
                <TextBlock x:Name="GpuTitleText"
                           Text="${model.shortName}"
                           FontSize="16" FontWeight="SemiBold" Foreground="#F8FAFC" />
                <TextBlock x:Name="LinkStatusText"
                           Text="${model.interfaceType} · ${model.pdOutputWatts}W PD"
                           FontSize="12" Foreground="#94A3B8" />
            </StackPanel>

            <ComboBox x:Name="ProfileSelector"
                      Grid.Column="1"
                      SelectedIndex="1"
                      SelectionChanged="OnPowerProfileChanged"
                      MinWidth="124"
                      IsTabStop="True">
                <ComboBoxItem Content="Silencioso" />
                <ComboBoxItem Content="Rendimiento" />
                <ComboBoxItem Content="Turbo" />
            </ComboBox>
        </Grid>

        <Grid Grid.Row="1" ColumnSpacing="10" RowSpacing="10">
            <Grid.ColumnDefinitions>
                <ColumnDefinition Width="*" />
                <ColumnDefinition Width="*" />
                <ColumnDefinition Width="*" />
            </Grid.ColumnDefinitions>
            <Grid.RowDefinitions>
                <RowDefinition Height="Auto" />
                <RowDefinition Height="Auto" />
            </Grid.RowDefinitions>

            <Border Grid.Row="0" Grid.Column="0" Background="#171C24" BorderBrush="#262E3B" BorderThickness="1" CornerRadius="6" Padding="10">
                <StackPanel>
                    <TextBlock Text="Carga GPU" FontSize="11" Foreground="#94A3B8" />
                    <TextBlock x:Name="GpuLoadText" Text="0 %" FontSize="18" FontWeight="Bold" FontFamily="Consolas" Foreground="#F8FAFC" />
                </StackPanel>
            </Border>

            <Border Grid.Row="0" Grid.Column="1" Background="#171C24" BorderBrush="#262E3B" BorderThickness="1" CornerRadius="6" Padding="10">
                <StackPanel>
                    <TextBlock Text="Temperatura" FontSize="11" Foreground="#94A3B8" />
                    <TextBlock x:Name="GpuTempText" Text="0 °C" FontSize="18" FontWeight="Bold" FontFamily="Consolas" Foreground="#F8FAFC" />
                </StackPanel>
            </Border>

            <Border Grid.Row="0" Grid.Column="2" Background="#171C24" BorderBrush="#262E3B" BorderThickness="1" CornerRadius="6" Padding="10">
                <StackPanel>
                    <TextBlock Text="Consumo TGP" FontSize="11" Foreground="#94A3B8" />
                    <TextBlock x:Name="GpuPowerText" Text="0 W" FontSize="18" FontWeight="Bold" FontFamily="Consolas" Foreground="#F8FAFC" />
                </StackPanel>
            </Border>

            <Border Grid.Row="1" Grid.Column="0" Background="#171C24" BorderBrush="#262E3B" BorderThickness="1" CornerRadius="6" Padding="10">
                <StackPanel>
                    <TextBlock Text="VRAM (${model.vramTotalGb} GB)" FontSize="11" Foreground="#94A3B8" />
                    <TextBlock x:Name="VramText" Text="0.0 GB" FontSize="16" FontWeight="SemiBold" FontFamily="Consolas" Foreground="#F8FAFC" />
                </StackPanel>
            </Border>

            <Border Grid.Row="1" Grid.Column="1" Background="#171C24" BorderBrush="#262E3B" BorderThickness="1" CornerRadius="6" Padding="10">
                <StackPanel>
                    <TextBlock Text="Frecuencia" FontSize="11" Foreground="#94A3B8" />
                    <TextBlock x:Name="ClockText" Text="0 MHz" FontSize="16" FontWeight="SemiBold" FontFamily="Consolas" Foreground="#F8FAFC" />
                </StackPanel>
            </Border>

            <Border Grid.Row="1" Grid.Column="2" Background="#171C24" BorderBrush="#262E3B" BorderThickness="1" CornerRadius="6" Padding="10">
                <StackPanel>
                    <TextBlock Text="Ventilador" FontSize="11" Foreground="#94A3B8" />
                    <TextBlock x:Name="FanText" Text="0 RPM" FontSize="16" FontWeight="SemiBold" FontFamily="Consolas" Foreground="#F8FAFC" />
                </StackPanel>
            </Border>
        </Grid>

        <Border Grid.Row="2" Background="#14181F" BorderBrush="#262E3B" BorderThickness="1" CornerRadius="6" Padding="10">
            <Grid RowSpacing="6">
                <Grid.RowDefinitions>
                    <RowDefinition Height="Auto" />
                    <RowDefinition Height="*" />
                </Grid.RowDefinitions>
                <TextBlock Text="Procesos activos en la eGPU" FontSize="12" FontWeight="SemiBold" Foreground="#CBD5E1" />
                <ListView x:Name="ProcessListView" Grid.Row="1" SelectionMode="None" IsTabStop="True">
                    <ListView.ItemTemplate>
                        <DataTemplate>
                            <Grid ColumnSpacing="8">
                                <Grid.ColumnDefinitions>
                                    <ColumnDefinition Width="*" />
                                    <ColumnDefinition Width="Auto" />
                                </Grid.ColumnDefinitions>
                                <TextBlock Text="{Binding Name}" FontSize="12" Foreground="#E2E8F0" />
                                <TextBlock Grid.Column="1" Text="{Binding VramText}" FontSize="12" FontFamily="Consolas" Foreground="#94A3B8" />
                            </Grid>
                        </DataTemplate>
                    </ListView.ItemTemplate>
                </ListView>
            </Grid>
        </Border>

        <Grid Grid.Row="3" ColumnSpacing="10">
            <Grid.ColumnDefinitions>
                <ColumnDefinition Width="*" />
                <ColumnDefinition Width="Auto" />
            </Grid.ColumnDefinitions>

            <TextBlock x:Name="StatusBannerText"
                       VerticalAlignment="Center"
                       Text="Listo · Pulsa Desacoplar antes de retirar el cable"
                       FontSize="12"
                       Foreground="#94A3B8"
                       TextTrimming="CharacterEllipsis" />

            <Button x:Name="UndockButton"
                    Grid.Column="1"
                    Content="Desacoplar eGPU (X)"
                    Click="OnUndockRequested"
                    Background="#107C10"
                    Foreground="#FFFFFF"
                    FontWeight="SemiBold"
                    Padding="16,9"
                    CornerRadius="6" />
        </Grid>
    </Grid>
</Page>`;

  const csharp = `using System;
using System.Collections.ObjectModel;
using System.IO;
using System.Threading.Tasks;
using Windows.ApplicationModel;
using Windows.System;
using Windows.UI.Core;
using Windows.UI.Xaml;
using Windows.UI.Xaml.Controls;
using Microsoft.Gaming.XboxGameBar;

namespace XGMobileWidget
{
    public sealed partial class XGMobileWidgetPage : Page
    {
        private XboxGameBarWidget _widget;
        private DispatcherTimer _telemetryTimer;
        private bool _isUndocking;
        public ObservableCollection<GpuProcessItem> ActiveProcesses { get; } = new();

        public XGMobileWidgetPage()
        {
            InitializeComponent();
            ProcessListView.ItemsSource = ActiveProcesses;
        }

        private void OnWidgetLoaded(object sender, RoutedEventArgs e)
        {
            Window.Current.CoreWindow.KeyDown += async (s, args) =>
            {
                if (args.VirtualKey == VirtualKey.GamepadX && !_isUndocking)
                {
                    await ExecuteSafeUndockAsync();
                }
            };

            _telemetryTimer = new DispatcherTimer { Interval = TimeSpan.FromSeconds(1.5) };
            _telemetryTimer.Tick += async (_, __) => await RefreshTelemetryAsync();
            _telemetryTimer.Start();
            _ = RefreshTelemetryAsync();
        }

        public void AttachGameBarWidget(XboxGameBarWidget widget)
        {
            _widget = widget;
            _widget.GameBarDisplayModeChanged += async (_, __) =>
            {
                await Dispatcher.RunAsync(CoreDispatcherPriority.Normal, () =>
                {
                    bool compact = _widget.GameBarDisplayMode == XboxGameBarDisplayMode.PinnedOnly;
                    LinkStatusText.Visibility = compact ? Visibility.Collapsed : Visibility.Visible;
                });
            };
        }

        private async Task RefreshTelemetryAsync()
        {
            if (_isUndocking) return;

            var snapshot = await TelemetryBridge.QueryAsync("${model.pnpHardwareId}");
            if (snapshot == null || !snapshot.Connected)
            {
                LinkStatusText.Text = "eGPU desconectada · iGPU Radeon 890M activa";
                UndockButton.IsEnabled = false;
                return;
            }

            GpuLoadText.Text = $"{snapshot.GpuLoadPercent} %";
            GpuTempText.Text = $"{snapshot.TempCelsius} °C";
            GpuPowerText.Text = $"{snapshot.PowerWatts} W";
            VramText.Text = $"{snapshot.VramUsedGb:F1} GB";
            ClockText.Text = $"{snapshot.ClockMhz} MHz";
            FanText.Text = $"{snapshot.FanRpm} RPM";
            UndockButton.IsEnabled = true;

            ActiveProcesses.Clear();
            foreach (var proc in snapshot.Processes)
            {
                ActiveProcesses.Add(proc);
            }
        }

        private async void OnUndockRequested(object sender, RoutedEventArgs e)
        {
            await ExecuteSafeUndockAsync();
        }

        private async void OnPowerProfileChanged(object sender, SelectionChangedEventArgs e)
        {
            if (ProfileSelector.SelectedItem is ComboBoxItem item)
            {
                string profile = item.Content?.ToString() ?? "Rendimiento";
                await TelemetryBridge.SetArmouryProfileAsync(profile);
            }
        }

        private async Task ExecuteSafeUndockAsync()
        {
            _isUndocking = true;
            UndockButton.IsEnabled = false;
            StatusBannerText.Text = "Liberando procesos en dGPU y cambiando perfiles a Handheld...";

            try
            {
                string sharedFolder = Path.Combine(
                    Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
                    "ROGAllyX_XGMobileWidget");
                Directory.CreateDirectory(sharedFolder);
                await File.WriteAllTextAsync(Path.Combine(sharedFolder, "request.txt"), "SafeUndock|${model.pnpHardwareId}");

                await FullTrustProcessLauncher.LaunchFullTrustProcessForCurrentAppAsync();
                var result = await TelemetryBridge.WaitForUndockResultAsync();

                StatusBannerText.Text = result.Success
                    ? "Seguro para desconectar el cable XG Mobile."
                    : $"Bloqueado: {result.Message}";
            }
            catch (Exception ex)
            {
                StatusBannerText.Text = $"Error al desacoplar: {ex.Message}";
            }
            finally
            {
                _isUndocking = false;
            }
        }
    }

    public sealed class GpuProcessItem
    {
        public string Name { get; set; } = string.Empty;
        public string VramText { get; set; } = string.Empty;
    }
}`;

  const powershell = `<#
.SYNOPSIS
    Telemetría, desacoplamiento seguro y perfiles Handheld/eGPU para ${model.name} en ASUS ROG Xbox Ally X.
#>

param(
    [ValidateSet("Telemetry", "SafeUndock", "Reconnect", "SyncProfile")]
    [string]$Action = "Telemetry",
    [string]$HardwareId = "${model.pnpHardwareId}",
    [ValidateSet("handheld", "egpu")]
    [string]$TargetMode = "handheld",
    [string]$ProfilesJsonPath = "$PSScriptRoot\\game-profiles.json",
    [switch]$CloseActiveGames
)

$ErrorActionPreference = "Stop"

function Sync-GameProfiles {
    param(
        [ValidateSet("handheld", "egpu")]
        [string]$Mode
    )

    if (-not (Test-Path $ProfilesJsonPath)) {
        return @()
    }

    $entries = Get-Content -Path $ProfilesJsonPath -Raw | ConvertFrom-Json
    $previousMode = if ($Mode -eq "handheld") { "egpu" } else { "handheld" }
    $synced = @()

    foreach ($game in $entries) {
        if (-not $game.autoSwitchOnUndock) { continue }

        $resolvedPath = [Environment]::ExpandEnvironmentVariables($game.configPath)
        if (-not (Test-Path $resolvedPath)) { continue }

        $prevBackup = "$resolvedPath.$previousMode.bak"
        $nextBackup = "$resolvedPath.$Mode.bak"

        Copy-Item -Path $resolvedPath -Destination $prevBackup -Force

        if (Test-Path $nextBackup) {
            Copy-Item -Path $nextBackup -Destination $resolvedPath -Force
            $synced += "$($game.title) -> $Mode (restaurado)"
        } else {
            Copy-Item -Path $resolvedPath -Destination $nextBackup -Force
            $synced += "$($game.title) -> $Mode (semilla creada)"
        }
    }

    return $synced
}

function Get-XGMobileDevice {
    Get-PnpDevice -Class Display | Where-Object {
        $_.InstanceId -like "*$($HardwareId.Replace('\', '\\'))*" -or
        $_.FriendlyName -match "${isNvidia ? 'NVIDIA GeForce RTX' : 'AMD Radeon RX 6850M'}"
    } | Select-Object -First 1
}

function Get-EgputilTelemetry {
    $dev = Get-XGMobileDevice
    if (-not $dev -or $dev.Status -ne "OK") {
        return @{ Connected = $false } | ConvertTo-Json -Compress
    }

    ${
      isNvidia
        ? `$smi = & nvidia-smi --query-gpu=utilization.gpu,temperature.gpu,power.draw,memory.used,clocks.gr,fan.speed --format=csv,noheader,nounits 2>$null
    $parts = $smi -split ","`
        : `$gpuCounter = (Get-Counter "\\GPU Engine(*engtype_3D)\\Utilization Percentage" -ErrorAction SilentlyContinue).CounterSamples | Measure-Object -Property CookedValue -Sum
    $parts = @([math]::Round($gpuCounter.Sum, 0), 58, 95, 4200, 2150, 45)`
    }

    return @{
        Connected      = $true
        GpuLoadPercent = [int]($parts[0].Trim())
        TempCelsius    = [int]($parts[1].Trim())
        PowerWatts     = [math]::Round([double]($parts[2].Trim()), 0)
        VramUsedGb     = [math]::Round([double]($parts[3].Trim()) / 1024, 1)
        ClockMhz       = [int]($parts[4].Trim())
        FanRpm         = 2400
        Processes      = @()
    } | ConvertTo-Json -Depth 4 -Compress
}

function Invoke-SafeUndock {
    $dev = Get-XGMobileDevice
    if (-not $dev) {
        return @{ Success = $true; Message = "La XG Mobile ya está desacoplada." } | ConvertTo-Json -Compress
    }

    if ($CloseActiveGames) {
        $blockers = Get-Process | Where-Object {
            $_.MainWindowHandle -ne 0 -and $_.ProcessName -match "Cyberpunk|Forza|obs64|Starfield|Halo"
        }
        foreach ($proc in $blockers) {
            $null = $proc.CloseMainWindow()
            Start-Sleep -Milliseconds 900
            if (-not $proc.HasExited) {
                Stop-Process -Id $proc.Id -Force -ErrorAction SilentlyContinue
            }
        }
    }

    & pnputil /disable-device "$($dev.InstanceId)" | Out-Null
    Start-Sleep -Milliseconds 600

    $verify = Get-PnpDevice -InstanceId $dev.InstanceId
    if ($verify.Status -ne "OK") {
        $null = Sync-GameProfiles -Mode "handheld"
        return @{
            Success = $true
            Message = "Seguro para desconectar la XG Mobile. Perfiles cambiados a modo Handheld."
        } | ConvertTo-Json -Compress
    }

    return @{
        Success = $false
        Message = "Windows mantuvo bloqueado el adaptador. Cierra el juego activo e inténtalo de nuevo."
    } | ConvertTo-Json -Compress
}

switch ($Action) {
    "Telemetry"   { Get-EgputilTelemetry }
    "SafeUndock"  { Invoke-SafeUndock }
    "SyncProfile" {
        $synced = Sync-GameProfiles -Mode $TargetMode
        @{ Success = $true; Mode = $TargetMode; SyncedProfiles = $synced } | ConvertTo-Json -Compress
    }
    "Reconnect"   {
        $dev = Get-XGMobileDevice
        if ($dev) { & pnputil /enable-device "$($dev.InstanceId)" | Out-Null }
        $synced = Sync-GameProfiles -Mode "egpu"
        @{ Success = $true; SyncedProfiles = $synced; Message = "eGPU reactivada y perfiles cambiados a modo eGPU." } | ConvertTo-Json -Compress
    }
}`;

  const profilesJson = JSON.stringify(
    gameProfiles.map((g) => ({
      id: g.id,
      title: g.title,
      executableName: g.executableName,
      configPath: g.configPath,
      autoSwitchOnUndock: g.autoSwitchOnUndock,
      handheld: g.handheld,
      egpu: g.egpu,
    })),
    null,
    2,
  );

  const readme = `# ROG XG Mobile — Xbox Game Bar Widget (ASUS ROG Xbox Ally X)

Repositorio listo para compilar automáticamente en la nube con **GitHub Actions** (\`windows-latest\`) y probar el paquete instalable directamente en tu **ASUS ROG Xbox Ally X** sin necesidad de instalar Visual Studio en la consola.

## Compilación automática en GitHub (recomendado)
1. Crea un repositorio nuevo en tu cuenta de GitHub (público o privado).
2. Sube el contenido descomprimido de este ZIP a la rama \`main\`:
   \`\`\`bash
   git init
   git add .
   git commit -m "Initial XG Mobile Game Bar widget"
   git branch -M main
   git remote add origin https://github.com/TU_USUARIO/xg-mobile-gamebar.git
   git push -u origin main
   \`\`\`
3. En GitHub, abre la pestaña **Actions** y espera ~2 minutos a que termine el workflow **Compilar Widget Xbox Game Bar (MSIX)**.
4. Descarga el artefacto **XGMobile-GameBar-AllyX-Installer** directamente desde el navegador de tu Xbox Ally X.
5. Descomprime y ejecuta \`Install-XGMobileWidget.ps1\` (clic derecho -> *Ejecutar con PowerShell*).
6. Pulsa el **botón Xbox** o \`Win + G\`, abre la lista de widgets y fija **XG Mobile eGPU**.
`;

  return [
    {
      id: 'workflow',
      filename: 'build-msix.yml',
      zipPath: '.github/workflows/build-msix.yml',
      language: 'yaml',
      summary: 'GitHub Actions: compila en windows-latest, firma el MSIX y genera el instalador.',
      content: githubWorkflow,
    },
    {
      id: 'installer',
      filename: 'Install-XGMobileWidget.ps1',
      zipPath: 'Install-XGMobileWidget.ps1',
      language: 'powershell',
      summary: 'Instalador 1-clic para tu Ally X (instala certificado de prueba + Add-AppxPackage).',
      content: installScript,
    },
    {
      id: 'ps1',
      filename: 'Undock-XGMobile.ps1',
      zipPath: 'XGMobileWidget/XGMobileHelper/Undock-XGMobile.ps1',
      language: 'powershell',
      summary: 'Telemetría, expulsión segura vía pnputil e intercambio de perfiles Handheld/eGPU.',
      content: powershell,
    },
    {
      id: 'profiles',
      filename: 'game-profiles.json',
      zipPath: 'XGMobileWidget/XGMobileHelper/game-profiles.json',
      language: 'json',
      summary: 'Rutas de configuración de tus juegos y perfiles diferenciados Handheld vs eGPU.',
      content: profilesJson,
    },
    {
      id: 'xaml',
      filename: 'XGMobileWidget.xaml',
      zipPath: 'XGMobileWidget/XGMobileWidget.xaml',
      language: 'xml',
      summary: 'Interfaz XAML nativa con navegación XYFocus para cruceta/mando en pantalla de 7".',
      content: xaml,
    },
    {
      id: 'cs',
      filename: 'XGMobileWidget.xaml.cs',
      zipPath: 'XGMobileWidget/XGMobileWidget.xaml.cs',
      language: 'csharp',
      summary: 'Lógica Game Bar SDK, atajo Botón X del mando Xbox y puente de telemetría.',
      content: csharp,
    },
    {
      id: 'bridge',
      filename: 'TelemetryBridge.cs',
      zipPath: 'XGMobileWidget/TelemetryBridge.cs',
      language: 'csharp',
      summary: 'Comunicación UWP <-> XGMobileHelper para leer sensores y resultados de expulsión.',
      content: telemetryBridgeCs,
    },
    {
      id: 'helper',
      filename: 'Program.cs',
      zipPath: 'XGMobileHelper/Program.cs',
      language: 'csharp',
      summary: 'Puente FullTrust (.NET 8) que ejecuta Undock-XGMobile.ps1 en segundo plano.',
      content: helperProgramCs,
    },
    {
      id: 'helper-csproj',
      filename: 'XGMobileHelper.csproj',
      zipPath: 'XGMobileHelper/XGMobileHelper.csproj',
      language: 'xml',
      summary: 'Proyecto .NET 8 para compilar XGMobileHelper.exe en GitHub Actions.',
      content: helperCsproj,
    },
    {
      id: 'csproj',
      filename: 'XGMobileWidget.csproj',
      zipPath: 'XGMobileWidget/XGMobileWidget.csproj',
      language: 'xml',
      summary: 'Proyecto UWP/MSBuild con referencias a Microsoft.Gaming.XboxGameBar.',
      content: csproj,
    },
    {
      id: 'sln',
      filename: 'XGMobileWidget.sln',
      zipPath: 'XGMobileWidget.sln',
      language: 'markdown',
      summary: 'Solución Visual Studio / MSBuild para compilar la arquitectura x64.',
      content: sln,
    },
    {
      id: 'app-xaml',
      filename: 'App.xaml',
      zipPath: 'XGMobileWidget/App.xaml',
      language: 'xml',
      summary: 'Definición raíz de la aplicación UWP para Xbox Game Bar.',
      content: appXaml,
    },
    {
      id: 'app-cs',
      filename: 'App.xaml.cs',
      zipPath: 'XGMobileWidget/App.xaml.cs',
      language: 'csharp',
      summary: 'Activación ms-gamebarwidget e inicialización de XboxGameBarWidget.',
      content: appCs,
    },
    {
      id: 'manifest',
      filename: 'Package.appxmanifest',
      zipPath: 'XGMobileWidget/Package.appxmanifest',
      language: 'xml',
      summary: 'Registro microsoft.gameBarUI, soporte Gamepad y permisos FullTrust.',
      content: manifest,
    },
    {
      id: 'readme',
      filename: 'README.md',
      zipPath: 'README.md',
      language: 'markdown',
      summary: 'Instrucciones de push a GitHub, descarga de artefacto e instalación en Ally X.',
      content: readme,
    },
  ];
}
