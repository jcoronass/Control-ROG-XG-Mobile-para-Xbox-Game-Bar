using System;
using System.Threading.Tasks;
using Windows.ApplicationModel.AppService;
using Windows.Foundation.Collections;
using Windows.System;
using Windows.UI;
using Windows.UI.Core;
using Windows.UI.Xaml;
using Windows.UI.Xaml.Controls;
using Windows.UI.Xaml.Media;
using Windows.UI.Xaml.Navigation;
using Microsoft.Gaming.XboxGameBar;

namespace XGMobile.Widget
{
    public sealed partial class MainPage : Page
    {
        private XboxGameBarWidget _widget;
        private bool _isBusy;
        private bool _isEgpuActive;

        public MainPage()
        {
            InitializeComponent();
        }

        protected override void OnNavigatedTo(NavigationEventArgs e)
        {
            base.OnNavigatedTo(e);
            XboxGameBarWidget widget = e.Parameter as XboxGameBarWidget;
            if (widget != null)
            {
                _widget = widget;
                _widget.GameBarDisplayModeChanged += OnGameBarDisplayModeChanged;
            }
        }

        private async void OnPageLoaded(object sender, RoutedEventArgs e)
        {
            App.HelperConnected += OnHelperConnected;
            App.HelperDisconnected += OnHelperDisconnected;
            App.HelperEventReceived += OnHelperEventReceived;

            Window.Current.CoreWindow.KeyDown += OnCoreWindowKeyDown;

            try
            {
                SetBusy(true, "Iniciando proceso auxiliar Win32 (runFullTrust)...");
                await App.EnsureFullTrustHelperLaunchedAsync();

                if (App.HelperConnection != null)
                {
                    await RequestStatusAsync();
                }
                else
                {
                    HelperBridgeText.Text = "Bridge Win32: Conectando AppService...";
                    SetBusy(false, "Esperando conexión bidireccional del helper Win32...");
                }
            }
            catch (Exception ex)
            {
                SetBusy(false, "No se pudo iniciar el helper Win32: " + ex.Message);
            }
        }

        private void OnPageUnloaded(object sender, RoutedEventArgs e)
        {
            App.HelperConnected -= OnHelperConnected;
            App.HelperDisconnected -= OnHelperDisconnected;
            App.HelperEventReceived -= OnHelperEventReceived;
            Window.Current.CoreWindow.KeyDown -= OnCoreWindowKeyDown;

            if (_widget != null)
            {
                _widget.GameBarDisplayModeChanged -= OnGameBarDisplayModeChanged;
            }
        }

        private async void OnCoreWindowKeyDown(CoreWindow sender, KeyEventArgs args)
        {
            if (_isBusy) return;

            if (args.VirtualKey == VirtualKey.GamepadX)
            {
                await ExecuteSafeEjectAsync();
            }
            else if (args.VirtualKey == VirtualKey.GamepadY)
            {
                await ExecuteForceSyncAsync();
            }
        }

        private async void OnGameBarDisplayModeChanged(XboxGameBarWidget sender, object args)
        {
            await Dispatcher.RunAsync(CoreDispatcherPriority.Normal, () =>
            {
                bool pinnedCompact = sender.GameBarDisplayMode == XboxGameBarDisplayMode.PinnedOnly;
                ProfileSummaryText.Visibility = pinnedCompact ? Visibility.Collapsed : Visibility.Visible;
                RefreshButton.Visibility = pinnedCompact ? Visibility.Collapsed : Visibility.Visible;
            });
        }

        private async void OnHelperConnected(object sender, EventArgs e)
        {
            await Dispatcher.RunAsync(CoreDispatcherPriority.Normal, async () =>
            {
                HelperBridgeText.Text = "Bridge Win32: AppService conectado";
                await RequestStatusAsync();
            });
        }

        private async void OnHelperDisconnected(object sender, EventArgs e)
        {
            await Dispatcher.RunAsync(CoreDispatcherPriority.Normal, () =>
            {
                HelperBridgeText.Text = "Bridge Win32: Desconectado";
                OperationStatusText.Text = "El proceso auxiliar Win32 se cerró. Pulsa Actualizar para relanzarlo.";
            });
        }

        private async void OnHelperEventReceived(object sender, ValueSet payload)
        {
            await Dispatcher.RunAsync(CoreDispatcherPriority.Normal, () =>
            {
                ApplyStatusPayload(payload);
            });
        }

        private async void OnRefreshClicked(object sender, RoutedEventArgs e)
        {
            if (App.HelperConnection == null)
            {
                await App.EnsureFullTrustHelperLaunchedAsync();
                await Task.Delay(500);
            }
            await RequestStatusAsync();
        }

        private async void OnSafeEjectClicked(object sender, RoutedEventArgs e)
        {
            await ExecuteSafeEjectAsync();
        }

        private async void OnForceSyncClicked(object sender, RoutedEventArgs e)
        {
            await ExecuteForceSyncAsync();
        }

        private async Task RequestStatusAsync()
        {
            if (App.HelperConnection == null)
            {
                OperationStatusText.Text = "Esperando conexión con XGMobile.Helper.exe...";
                return;
            }

            SetBusy(true, "Consultando árbol PnP (VEN_10DE / VEN_1002)...");
            try
            {
                ValueSet request = new ValueSet
                {
                    { "Command", "GetStatus" }
                };

                AppServiceResponse response = await App.HelperConnection.SendMessageAsync(request);
                if (response.Status == AppServiceResponseStatus.Success && response.Message != null)
                {
                    ApplyStatusPayload(response.Message);
                    SetBusy(false, GetString(response.Message, "StatusMessage", "Estado de hardware actualizado."));
                }
                else
                {
                    SetBusy(false, "Error de AppService al consultar estado: " + response.Status);
                }
            }
            catch (Exception ex)
            {
                SetBusy(false, "Error al consultar estado: " + ex.Message);
            }
        }

        private async Task ExecuteSafeEjectAsync()
        {
            if (_isBusy) return;
            if (App.HelperConnection == null)
            {
                ShowWarning("Servicio Win32 no conectado", "Pulsa Actualizar para reconectar con XGMobile.Helper.exe.");
                return;
            }

            HideWarning();
            SetBusy(true, "Comprobando procesos activos en NVIDIA RTX 5070 Ti y ejecutando CM_Request_Device_EjectW...");

            try
            {
                ValueSet request = new ValueSet
                {
                    { "Command", "EjectEgpu" }
                };

                AppServiceResponse response = await App.HelperConnection.SendMessageAsync(request);
                if (response.Status != AppServiceResponseStatus.Success || response.Message == null)
                {
                    ShowWarning("Error de comunicación", "AppService devolvió: " + response.Status);
                    SetBusy(false, "No se pudo completar la solicitud de expulsión.");
                    return;
                }

                ValueSet msg = response.Message;
                ApplyStatusPayload(msg);

                bool success = GetBool(msg, "Success", false);
                string message = GetString(msg, "Message", string.Empty);
                string vetoType = GetString(msg, "VetoType", string.Empty);
                string blockingProcs = GetString(msg, "BlockingProcesses", string.Empty);

                if (success)
                {
                    HideWarning();
                    SetBusy(false, string.IsNullOrEmpty(message)
                        ? "Expulsión segura completada. Ya puedes desconectar la XG Mobile."
                        : message);
                }
                else
                {
                    string warningTitle = !string.IsNullOrEmpty(blockingProcs)
                        ? "Juego o aplicación usando la RTX 5070 Ti"
                        : "Veto de expulsión PnP (" + (string.IsNullOrEmpty(vetoType) ? "PNP_VetoDevice" : vetoType) + ")";

                    string detail = !string.IsNullOrEmpty(blockingProcs)
                        ? "Cierra primero: " + blockingProcs + ". " + message
                        : message;

                    ShowWarning(warningTitle, detail);
                    SetBusy(false, "Expulsión cancelada para evitar bloqueo del sistema.");
                }
            }
            catch (Exception ex)
            {
                ShowWarning("Excepción al desacoplar", ex.Message);
                SetBusy(false, "Error inesperado durante la expulsión.");
            }
        }

        private async Task ExecuteForceSyncAsync()
        {
            if (_isBusy) return;
            if (App.HelperConnection == null)
            {
                ShowWarning("Servicio Win32 no conectado", "Pulsa Actualizar para reconectar con XGMobile.Helper.exe.");
                return;
            }

            HideWarning();
            SetBusy(true, "Sincronizando perfiles en C:\\eGPU_Profiles\\games_profiles.json...");

            try
            {
                ValueSet request = new ValueSet
                {
                    { "Command", "ForceSync" },
                    { "TargetMode", _isEgpuActive ? "eGPU" : "Handheld" }
                };

                AppServiceResponse response = await App.HelperConnection.SendMessageAsync(request);
                if (response.Status == AppServiceResponseStatus.Success && response.Message != null)
                {
                    ApplyStatusPayload(response.Message);
                    string summary = GetString(response.Message, "Message", "Sincronización de perfiles finalizada.");
                    bool hasRunningWarning = GetBool(response.Message, "SkippedRunningGames", false);
                    if (hasRunningWarning)
                    {
                        ShowWarning("Juegos en ejecución omitidos", summary);
                    }
                    SetBusy(false, summary);
                }
                else
                {
                    SetBusy(false, "Error al sincronizar perfiles: " + response.Status);
                }
            }
            catch (Exception ex)
            {
                SetBusy(false, "Error al sincronizar perfiles: " + ex.Message);
            }
        }

        private void ApplyStatusPayload(ValueSet payload)
        {
            if (payload == null) return;

            if (payload.ContainsKey("IsEgpuActive"))
            {
                _isEgpuActive = GetBool(payload, "IsEgpuActive", false);
                string ejectNode = GetString(payload, "EjectableNodeId", "PCIe/USB4");

                if (_isEgpuActive)
                {
                    HardwareModeTitle.Text = "MODO eGPU: RTX 5070 Ti Activa";
                    HardwareSubStatus.Text = "VEN_10DE detectada · Nodo expulsable: " + ejectNode;
                    ModeStatusBorder.BorderBrush = new SolidColorBrush(Color.FromArgb(255, 22, 163, 74));
                    SafeEjectButton.IsEnabled = !_isBusy;
                }
                else
                {
                    HardwareModeTitle.Text = "MODO HANDHELD: Radeon Z2E";
                    HardwareSubStatus.Text = "iGPU AMD Ryzen Z2 Extreme (VEN_1002) activa · Seguro para uso portátil";
                    ModeStatusBorder.BorderBrush = new SolidColorBrush(Color.FromArgb(255, 59, 130, 246));
                    SafeEjectButton.IsEnabled = false;
                }
            }

            if (payload.ContainsKey("LastSyncedGame"))
            {
                string game = GetString(payload, "LastSyncedGame", "Ninguno todavía");
                string mode = GetString(payload, "LastSyncedMode", string.Empty);
                string timestamp = GetString(payload, "LastSyncTime", string.Empty);

                LastSyncedGameText.Text = string.IsNullOrEmpty(mode)
                    ? "Último juego sincronizado: " + game
                    : "Último juego sincronizado: " + game + " (" + mode + " · " + timestamp + ")";
            }

            if (payload.ContainsKey("ProfileSummary"))
            {
                string summary = GetString(payload, "ProfileSummary", string.Empty);
                if (!string.IsNullOrEmpty(summary))
                {
                    ProfileSummaryText.Text = summary;
                }
            }
        }

        private void SetBusy(bool busy, string statusText)
        {
            _isBusy = busy;
            OperationProgressBar.Visibility = busy ? Visibility.Visible : Visibility.Collapsed;
            OperationProgressBar.IsIndeterminate = busy;
            SafeEjectButton.IsEnabled = !busy && _isEgpuActive;
            ForceSyncButton.IsEnabled = !busy;
            OperationStatusText.Text = statusText;
        }

        private void ShowWarning(string title, string detail)
        {
            WarningTitleText.Text = title;
            WarningDetailsText.Text = detail;
            WarningBanner.Visibility = Visibility.Visible;
        }

        private void HideWarning()
        {
            WarningBanner.Visibility = Visibility.Collapsed;
        }

        private static string GetString(ValueSet set, string key, string fallback)
        {
            object value;
            if (set.TryGetValue(key, out value) && value != null)
            {
                return value.ToString();
            }
            return fallback;
        }

        private static bool GetBool(ValueSet set, string key, bool fallback)
        {
            object value;
            if (set.TryGetValue(key, out value) && value is bool)
            {
                return (bool)value;
            }
            return fallback;
        }
    }
}
