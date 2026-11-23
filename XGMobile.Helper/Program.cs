using System.Management;
using Windows.ApplicationModel;
using Windows.ApplicationModel.AppService;
using Windows.Foundation.Collections;

namespace XGMobile.Helper;

internal static class Program
{
    private const string MutexName = "Global\\XGMobile_RTX5070Ti_GameBar_Helper_SingleInstance";
    private const string AppServiceName = "XGMobile.AppService";

    private static readonly GpuEjector Ejector = new();
    private static readonly ProfileManager Profiles = new();
    private static readonly ManualResetEventSlim ExitEvent = new(false);
    private static readonly object StateLock = new();

    private static AppServiceConnection? _connection;
    private static ManagementEventWatcher? _deviceWatcher;
    private static Timer? _debounceTimer;
    private static bool _lastKnownEgpuConnected;

    [STAThread]
    private static void Main()
    {
        using Mutex singleInstance = new(true, MutexName, out bool createdNew);
        if (!createdNew)
        {
            return;
        }

        EgpuHardwareStatus initialStatus = Ejector.DetectHardwareStatus();
        _lastKnownEgpuConnected = initialStatus.IsEgpuConnected;

        StartWmiDeviceWatcher();
        ConnectToWidgetAppServiceAsync().GetAwaiter().GetResult();

        ExitEvent.Wait();

        _debounceTimer?.Dispose();
        if (_deviceWatcher != null)
        {
            try { _deviceWatcher.Stop(); } catch { }
            _deviceWatcher.Dispose();
        }
        _connection?.Dispose();
    }

    private static async Task ConnectToWidgetAppServiceAsync()
    {
        string familyName;
        try
        {
            familyName = Package.Current.Id.FamilyName;
        }
        catch
        {
            // Ejecución fuera de paquete MSIX (depuración directa de consola): mantener watcher WMI activo
            return;
        }

        AppServiceConnection connection = new()
        {
            AppServiceName = AppServiceName,
            PackageFamilyName = familyName
        };

        connection.RequestReceived += OnWidgetRequestReceived;
        connection.ServiceClosed += (_, _) => ExitEvent.Set();

        AppServiceConnectionStatus status = await connection.OpenAsync();
        if (status != AppServiceConnectionStatus.Success)
        {
            connection.Dispose();
            ExitEvent.Set();
            return;
        }

        _connection = connection;

        // Enviar estado inicial inmediatamente al Widget UWP
        await PushHardwareUpdateToWidgetAsync(
            Ejector.DetectHardwareStatus(),
            "Servicio Win32 conectado (AppServiceConnection activo).");
    }

    private static void StartWmiDeviceWatcher()
    {
        try
        {
            // EventType = 2 (Device Arrival / Conexión) | EventType = 3 (Device Removal / Desconexión)
            WqlEventQuery query = new("SELECT * FROM Win32_DeviceChangeEvent WHERE EventType = 2 OR EventType = 3");
            _deviceWatcher = new ManagementEventWatcher(query);
            _deviceWatcher.EventArrived += (_, _) =>
            {
                // Debounce de 1200ms para agrupar ráfagas de enumeración PCIe/USB4 + audio HDMI + hub USB
                lock (StateLock)
                {
                    _debounceTimer?.Dispose();
                    _debounceTimer = new Timer(_ => _ = HandleHardwareChangeAsync(), null, 1200, Timeout.Infinite);
                }
            };
            _deviceWatcher.Start();
        }
        catch
        {
            // Si WMI no estuviera disponible, las peticiones manuales vía AppService siguen funcionando
        }
    }

    private static async Task HandleHardwareChangeAsync()
    {
        EgpuHardwareStatus current = Ejector.DetectHardwareStatus();
        bool changed;
        lock (StateLock)
        {
            changed = current.IsEgpuConnected != _lastKnownEgpuConnected;
            _lastKnownEgpuConnected = current.IsEgpuConnected;
        }

        if (!changed)
        {
            return;
        }

        HardwareProfileMode nextMode = current.IsEgpuConnected
            ? HardwareProfileMode.Egpu
            : HardwareProfileMode.Handheld;

        ProfileSyncResult syncResult = Profiles.SyncAllForMode(nextMode);
        string banner = current.IsEgpuConnected
            ? "RTX 5070 Ti detectada por WMI. " + syncResult.Summary
            : "XG Mobile desconectada por WMI. " + syncResult.Summary;

        await PushHardwareUpdateToWidgetAsync(current, banner);
    }

    private static async void OnWidgetRequestReceived(AppServiceConnection sender, AppServiceRequestReceivedEventArgs args)
    {
        AppServiceDeferral deferral = args.GetDeferral();
        try
        {
            ValueSet message = args.Request.Message;
            string command = message.TryGetValue("Command", out object? cmdObj)
                ? cmdObj?.ToString() ?? string.Empty
                : string.Empty;

            ValueSet response = command switch
            {
                "GetStatus" => HandleGetStatus(),
                "EjectEgpu" => HandleEjectEgpu(),
                "ForceSync" => HandleForceSync(message),
                _ => new ValueSet
                {
                    { "Success", false },
                    { "Message", $"Comando desconocido: {command}" }
                }
            };

            await args.Request.SendResponseAsync(response);
        }
        catch (Exception ex)
        {
            await args.Request.SendResponseAsync(new ValueSet
            {
                { "Success", false },
                { "Message", ex.Message }
            });
        }
        finally
        {
            deferral.Complete();
        }
    }

    private static ValueSet HandleGetStatus()
    {
        EgpuHardwareStatus status = Ejector.DetectHardwareStatus();
        lock (StateLock)
        {
            _lastKnownEgpuConnected = status.IsEgpuConnected;
        }

        return BuildStatusPayload(status, status.Summary);
    }

    private static ValueSet HandleEjectEgpu()
    {
        EjectOperationResult eject = Ejector.SafeEjectNvidiaEgpu(ignoreActiveProcessCheck: false);
        string extraSyncInfo = string.Empty;

        if (eject.Success)
        {
            ProfileSyncResult sync = Profiles.SyncAllForMode(HardwareProfileMode.Handheld);
            extraSyncInfo = " " + sync.Summary;
            lock (StateLock)
            {
                _lastKnownEgpuConnected = false;
            }
        }

        EgpuHardwareStatus updatedStatus = Ejector.DetectHardwareStatus();
        ValueSet payload = BuildStatusPayload(updatedStatus, eject.Message + extraSyncInfo);
        payload["Success"] = eject.Success;
        payload["Message"] = eject.Message + extraSyncInfo;
        payload["VetoType"] = eject.VetoType.ToString();
        payload["VetoName"] = eject.VetoName;
        payload["BlockingProcesses"] = string.Join(
            ", ",
            eject.BlockingProcesses.Select(p => $"{p.ProcessName}.exe (PID {p.Pid})"));

        return payload;
    }

    private static ValueSet HandleForceSync(ValueSet request)
    {
        string requestedMode = request.TryGetValue("TargetMode", out object? m)
            ? m?.ToString() ?? string.Empty
            : string.Empty;

        EgpuHardwareStatus hw = Ejector.DetectHardwareStatus();
        HardwareProfileMode targetMode = requestedMode.Equals("eGPU", StringComparison.OrdinalIgnoreCase)
            ? HardwareProfileMode.Egpu
            : requestedMode.Equals("Handheld", StringComparison.OrdinalIgnoreCase)
                ? HardwareProfileMode.Handheld
                : (hw.IsEgpuConnected ? HardwareProfileMode.Egpu : HardwareProfileMode.Handheld);

        ProfileSyncResult sync = Profiles.SyncAllForMode(targetMode);
        ValueSet payload = BuildStatusPayload(hw, sync.Summary);
        payload["Success"] = sync.Success;
        payload["Message"] = sync.Summary;
        payload["SkippedRunningGames"] = sync.SkippedRunningGames.Count > 0;
        return payload;
    }

    private static async Task PushHardwareUpdateToWidgetAsync(EgpuHardwareStatus status, string summary)
    {
        if (_connection == null)
        {
            return;
        }

        try
        {
            ValueSet payload = BuildStatusPayload(status, summary);
            await _connection.SendMessageAsync(payload);
        }
        catch
        {
            // El widget puede haberse cerrado temporalmente
        }
    }

    private static ValueSet BuildStatusPayload(EgpuHardwareStatus status, string profileSummary)
    {
        return new ValueSet
        {
            { "IsEgpuActive", status.IsEgpuConnected },
            { "NvidiaDeviceId", status.NvidiaDeviceId ?? string.Empty },
            { "EjectableNodeId", status.EjectableParentDeviceId ?? "Ninguno" },
            { "StatusMessage", status.Summary },
            { "LastSyncedGame", Profiles.LastSyncedGame },
            { "LastSyncedMode", Profiles.LastSyncedMode },
            { "LastSyncTime", Profiles.LastSyncTime },
            { "ProfileSummary", profileSummary }
        };
    }
}
