# XG Mobile RTX 5070 Ti — Xbox Game Bar Widget (Beta 0.0.1)

Solución nativa de **Visual Studio 2022** para consolas handheld Windows 11 con APU **AMD Ryzen Z2 Extreme (`VEN_1002`)** y eGPU **ASUS XG Mobile NVIDIA RTX 5070 Ti (`VEN_10DE`)** por PCIe / USB4.

Incluye:
- **Widget UWP para Xbox Game Bar** (`Microsoft.Gaming.XboxGameBar`) con control por mando (`X` expulsar, `Y` sincronizar) y táctil.
- **Proceso auxiliar Win32 .NET 8 (`runFullTrust`)** comunicado bidireccionalmente mediante **`AppServiceConnection`** (`XGMobile.AppService`).
- **Expulsión segura PnP por kernel** vía P/Invoke a `cfgmgr32.dll` (`CM_Request_Device_EjectW`), recorriendo el árbol PnP desde `VEN_10DE` hasta el nodo padre del puente PCIe/USB4 expulsable, comprobando procesos activos (NVML + PDH `GPU Engine`) y devolviendo `PNP_VETO_TYPE` al widget sin ventanas emergentes intrusivas.
- **Dual Profile Swapper automático**: escucha `Win32_DeviceChangeEvent` vía WMI y sincroniza archivos de configuración por juego definidos en `C:\eGPU_Profiles\games_profiles.json`.

---

## Instalación rápida en tu consola (GitHub Release `beta-0.0.1`)

Cada vez que haces push a `main`, **GitHub Actions** compila la solución en `windows-2022`, firma el paquete `.msix` y publica automáticamente la release **`beta-0.0.1`**:

1. En tu consola Windows 11 activa el **Modo para programadores**:  
   `Configuración → Sistema → Para programadores → Modo para programadores`.
2. Ve a la pestaña **Releases** de este repositorio y descarga **`XGMobile-GameBar-Beta-0.0.1.zip`** de la release **`beta-0.0.1`**.
3. Descomprime el ZIP y haz **doble clic en `Instalar-DobleClick.bat`** (instala el certificado temporal, crea `C:\eGPU_Profiles\games_profiles.json` y registra el paquete `.msix`).
4. Pulsa el **botón Xbox** o **`Win + G`**, abre el menú de **Widgets** y selecciona **`XG Mobile RTX 5070 Ti`**.

---

## Estructura de la solución Visual Studio 2022

```text
XGMobileGameBar.sln
├── XGMobile.Package/                  # Windows Application Packaging Project (.wapproj)
│   ├── XGMobile.Package.wapproj
│   ├── Package.appxmanifest           # microsoft.gameBarUIExtension + windows.appService + runFullTrust
│   └── Public/info.txt
├── XGMobile.Widget/                   # Widget UWP (Xbox Game Bar SDK)
│   ├── XGMobile.Widget.csproj
│   ├── App.xaml / App.xaml.cs         # OnActivated (ms-gamebarwidget) + OnBackgroundActivated (AppService)
│   └── MainPage.xaml / MainPage.xaml.cs
├── XGMobile.Helper/                   # Proceso Win32 .NET 8 FullTrust
│   ├── XGMobile.Helper.csproj         # System.Management + System.Diagnostics.PerformanceCounter
│   ├── Program.cs                     # AppServiceConnection + WMI Win32_DeviceChangeEvent
│   ├── GpuEjector.cs                  # P/Invoke cfgmgr32.dll (CM_Request_Device_EjectW) + NVML/PDH
│   ├── ProfileManager.cs              # Dual Profile Swapper (C:\eGPU_Profiles)
│   └── games_profiles.json
├── .github/workflows/release-beta-0.0.1.yml
├── Instalar-DobleClick.bat
└── Install-XGMobileWidget.ps1
```

### Paquetes NuGet utilizados
- **`XGMobile.Widget`**:
  - `Microsoft.Gaming.XboxGameBar` (`5.3.2006.1001`)
  - `Microsoft.NETCore.UniversalWindowsPlatform` (`6.2.14`)
  - Extensión SDK: `Windows Desktop Extensions for the UWP` (`WindowsDesktop`)
- **`XGMobile.Helper`**:
  - `System.Management` (`8.0.0`)
  - `System.Diagnostics.PerformanceCounter` (`8.0.0`)

---

## Registro y depuración en Visual Studio 2022 (`Win + G`)

1. Abre `XGMobileGameBar.sln` en **Visual Studio 2022** con las cargas de trabajo *Desarrollo de escritorio de .NET* y *Desarrollo de la Plataforma universal de Windows*.
2. Establece **`XGMobile.Package`** como **Proyecto de inicio** (`Set as Startup Project`) y selecciona plataforma **`x64`**.
3. En `Propiedades de XGMobile.Package → Depurar`, marca **"No iniciar, pero depurar el código cuando se inicie"** (*Do not launch, but debug my code when it starts*).
4. Compila e implementa (`Compilar → Implementar solución` / `Deploy Solution`).
5. Inicia la depuración con `F5`, pulsa **`Win + G`** y abre **`XG Mobile RTX 5070 Ti`** en el menú de Widgets de Xbox Game Bar: Visual Studio se adjuntará automáticamente tanto al widget UWP como al helper Win32.
