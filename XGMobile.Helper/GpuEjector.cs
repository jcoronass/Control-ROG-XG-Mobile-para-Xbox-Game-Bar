using System.Diagnostics;
using System.Runtime.InteropServices;
using System.Text;
using System.Text.RegularExpressions;

namespace XGMobile.Helper;

public enum PNP_VETO_TYPE : uint
{
    PNP_VetoTypeUnknown = 0,
    PNP_VetoLegacyDevice = 1,
    PNP_VetoPendingClose = 2,
    PNP_VetoWindowsApp = 3,
    PNP_VetoWindowsService = 4,
    PNP_VetoOutstandingOpen = 5,
    PNP_VetoDevice = 6,
    PNP_VetoDriver = 7,
    PNP_VetoIllegalDeviceRequest = 8,
    PNP_VetoInsufficientPower = 9,
    PNP_VetoNonDisableable = 10,
    PNP_VetoLegacyDriver = 11,
    PNP_VetoInsufficientRights = 12,
    PNP_VetoAlreadyRemoved = 13
}

public sealed record ActiveGpuProcess(int Pid, string ProcessName, double UtilizationOrVramMb, string Source);

public sealed record EgpuHardwareStatus(
    bool IsEgpuConnected,
    string? NvidiaDeviceId,
    string? EjectableParentDeviceId,
    bool HasAmdZ2ExtremeIgpu,
    string Summary);

public sealed record EjectOperationResult(
    bool Success,
    string Message,
    PNP_VETO_TYPE VetoType,
    string VetoName,
    IReadOnlyList<ActiveGpuProcess> BlockingProcesses,
    string? EjectedDeviceId);

public sealed class GpuEjector
{
    private const string NvidiaVendorToken = "VEN_10DE";
    private const string AmdVendorToken = "VEN_1002";

    private const uint CR_SUCCESS = 0x00000000;
    private const uint CR_REMOVE_VETOED = 0x00000017;
    private const uint CM_GETIDLIST_FILTER_PRESENT = 0x00000100;
    private const uint CM_LOCATE_DEVNODE_NORMAL = 0x00000000;

    private const uint DN_REMOVABLE = 0x00004000;
    private const uint CM_DEVCAP_EJECTSUPPORTED = 0x00000002;
    private const uint CM_DEVCAP_REMOVABLE = 0x00000004;

    private static readonly DEVPROPKEY DEVPKEY_Device_Capabilities = new()
    {
        fmtid = new Guid("A45C254E-DF1C-4EFD-8020-67D146A850E0"),
        pid = 17
    };

    private static readonly HashSet<string> SystemNonBlockingProcesses = new(StringComparer.OrdinalIgnoreCase)
    {
        "dwm",
        "csrss",
        "explorer",
        "SearchHost",
        "ShellExperienceHost",
        "StartMenuExperienceHost",
        "TextInputHost",
        "ApplicationFrameHost",
        "GameBar",
        "GameBarFTServer",
        "XGMobile.Widget",
        "XGMobile.Helper",
        "nvcontainer",
        "NVDisplay.Container",
        "System"
    };

    private static readonly Regex PdhPidRegex = new(@"pid_(\d+)_", RegexOptions.IgnoreCase | RegexOptions.Compiled);

    public EgpuHardwareStatus DetectHardwareStatus()
    {
        List<string> presentPciIds = EnumeratePresentPciDeviceIds();

        string? amdIgpu = presentPciIds.FirstOrDefault(id =>
            id.Contains(AmdVendorToken, StringComparison.OrdinalIgnoreCase));

        string? nvidiaGpu = FindNvidiaDisplayControllerId(presentPciIds);
        if (string.IsNullOrEmpty(nvidiaGpu))
        {
            return new EgpuHardwareStatus(
                IsEgpuConnected: false,
                NvidiaDeviceId: null,
                EjectableParentDeviceId: null,
                HasAmdZ2ExtremeIgpu: amdIgpu != null,
                Summary: "MODO HANDHELD: Radeon Z2E (VEN_1002) activa");
        }

        string ejectableTarget = ResolveEjectableParentDeviceId(nvidiaGpu, out _);
        return new EgpuHardwareStatus(
            IsEgpuConnected: true,
            NvidiaDeviceId: nvidiaGpu,
            EjectableParentDeviceId: ejectableTarget,
            HasAmdZ2ExtremeIgpu: amdIgpu != null,
            Summary: $"MODO eGPU: RTX 5070 Ti Activa ({ejectableTarget})");
    }

    public List<ActiveGpuProcess> GetActiveNvidiaProcesses()
    {
        Dictionary<int, ActiveGpuProcess> results = new();

        // 1. Consulta directa mediante NVML (específica para NVIDIA RTX 5070 Ti)
        foreach (ActiveGpuProcess p in QueryNvmlGraphicsProcesses())
        {
            if (!SystemNonBlockingProcesses.Contains(p.ProcessName))
            {
                results[p.Pid] = p;
            }
        }

        // 2. Consulta complementaria mediante PDH Performance Counters (GPU Engine)
        foreach (ActiveGpuProcess p in QueryPdhGpuProcesses())
        {
            if (!SystemNonBlockingProcesses.Contains(p.ProcessName) && !results.ContainsKey(p.Pid))
            {
                results[p.Pid] = p;
            }
        }

        return results.Values
            .OrderByDescending(p => p.UtilizationOrVramMb)
            .ToList();
    }

    public EjectOperationResult SafeEjectNvidiaEgpu(bool ignoreActiveProcessCheck = false)
    {
        EgpuHardwareStatus status = DetectHardwareStatus();
        if (!status.IsEgpuConnected || string.IsNullOrEmpty(status.NvidiaDeviceId))
        {
            return new EjectOperationResult(
                Success: true,
                Message: "La ASUS XG Mobile RTX 5070 Ti ya se encuentra desacoplada.",
                VetoType: PNP_VETO_TYPE.PNP_VetoAlreadyRemoved,
                VetoName: string.Empty,
                BlockingProcesses: Array.Empty<ActiveGpuProcess>(),
                EjectedDeviceId: null);
        }

        if (!ignoreActiveProcessCheck)
        {
            List<ActiveGpuProcess> activeProcs = GetActiveNvidiaProcesses();
            if (activeProcs.Count > 0)
            {
                string procList = string.Join(", ", activeProcs.Select(p => $"{p.ProcessName}.exe (PID {p.Pid})"));
                return new EjectOperationResult(
                    Success: false,
                    Message: $"Hay procesos activos usando la NVIDIA RTX 5070 Ti: {procList}. Ciérralos antes de desacoplar.",
                    VetoType: PNP_VETO_TYPE.PNP_VetoWindowsApp,
                    VetoName: procList,
                    BlockingProcesses: activeProcs,
                    EjectedDeviceId: status.EjectableParentDeviceId);
            }
        }

        string targetDeviceId = ResolveEjectableParentDeviceId(status.NvidiaDeviceId, out uint ejectDevInst);
        if (ejectDevInst == 0)
        {
            return new EjectOperationResult(
                Success: false,
                Message: $"No se pudo localizar el DevNode PnP para {status.NvidiaDeviceId}.",
                VetoType: PNP_VETO_TYPE.PNP_VetoTypeUnknown,
                VetoName: status.NvidiaDeviceId,
                BlockingProcesses: Array.Empty<ActiveGpuProcess>(),
                EjectedDeviceId: null);
        }

        // Pasar pVetoType y pszVetoName no nulos suprime el diálogo intrusivo de error de Windows
        StringBuilder vetoName = new(512);
        uint cr = CM_Request_Device_EjectW(
            ejectDevInst,
            out PNP_VETO_TYPE vetoType,
            vetoName,
            vetoName.Capacity,
            0);

        if (cr == CR_SUCCESS)
        {
            return new EjectOperationResult(
                Success: true,
                Message: $"Expulsión segura completada en {targetDeviceId}. Ya puedes desconectar el cable de la XG Mobile.",
                VetoType: PNP_VETO_TYPE.PNP_VetoTypeUnknown,
                VetoName: string.Empty,
                BlockingProcesses: Array.Empty<ActiveGpuProcess>(),
                EjectedDeviceId: targetDeviceId);
        }

        string vetoStr = vetoName.ToString().Trim();
        string reason = cr == CR_REMOVE_VETOED
            ? $"Windows vetó la expulsión ({vetoType})" + (string.IsNullOrEmpty(vetoStr) ? "." : $": {vetoStr}")
            : $"CM_Request_Device_EjectW devolvió código CONFIGRET 0x{cr:X8} ({vetoType}).";

        return new EjectOperationResult(
            Success: false,
            Message: reason,
            VetoType: vetoType,
            VetoName: vetoStr,
            BlockingProcesses: Array.Empty<ActiveGpuProcess>(),
            EjectedDeviceId: targetDeviceId);
    }

    private static List<string> EnumeratePresentPciDeviceIds()
    {
        List<string> ids = new();
        uint crSize = CM_Get_Device_ID_List_SizeW(out uint requiredChars, "PCI", CM_GETIDLIST_FILTER_PRESENT);
        if (crSize != CR_SUCCESS || requiredChars <= 1)
        {
            return ids;
        }

        char[] buffer = new char[requiredChars];
        uint crList = CM_Get_Device_ID_ListW("PCI", buffer, requiredChars, CM_GETIDLIST_FILTER_PRESENT);
        if (crList != CR_SUCCESS)
        {
            return ids;
        }

        string multiSz = new(buffer);
        foreach (string entry in multiSz.Split('\0', StringSplitOptions.RemoveEmptyEntries))
        {
            ids.Add(entry);
        }

        return ids;
    }

    private static string? FindNvidiaDisplayControllerId(List<string> pciIds)
    {
        // Preferir controlador de vídeo NVIDIA (evitando nodos secundarios de audio HDMI si existe el principal)
        List<string> nvidiaNodes = pciIds
            .Where(id => id.Contains(NvidiaVendorToken, StringComparison.OrdinalIgnoreCase))
            .ToList();

        if (nvidiaNodes.Count == 0)
        {
            return null;
        }

        foreach (string id in nvidiaNodes)
        {
            if (CM_Locate_DevNodeW(out uint devInst, id, CM_LOCATE_DEVNODE_NORMAL) == CR_SUCCESS)
            {
                // El dispositivo GPU principal suele aparecer primero en la función 0 (&SUBSYS... o función PCI 0)
                if (!id.Contains("HDAUDIO", StringComparison.OrdinalIgnoreCase))
                {
                    return id;
                }
            }
        }

        return nvidiaNodes[0];
    }

    /// <summary>
    /// Sube por el árbol PnP desde la GPU NVIDIA (VEN_10DE) hasta encontrar el nodo padre
    /// del puente PCIe / USB4 / Thunderbolt marcado como removible/expulsable.
    /// </summary>
    private static string ResolveEjectableParentDeviceId(string startDeviceId, out uint ejectDevInst)
    {
        ejectDevInst = 0;
        if (CM_Locate_DevNodeW(out uint current, startDeviceId, CM_LOCATE_DEVNODE_NORMAL) != CR_SUCCESS)
        {
            return startDeviceId;
        }

        uint bestCandidate = current;
        string bestId = startDeviceId;

        uint probe = current;
        for (int depth = 0; depth < 8; depth++)
        {
            string probeId = GetDeviceIdFromDevInst(probe);
            if (string.IsNullOrEmpty(probeId) ||
                probeId.StartsWith("HTREE\\ROOT", StringComparison.OrdinalIgnoreCase) ||
                probeId.StartsWith("ACPI\\", StringComparison.OrdinalIgnoreCase))
            {
                break;
            }

            bool isRemovableOrEjectable = IsNodeRemovableOrEjectable(probe);
            bool isUsb4OrThunderboltBridge =
                probeId.StartsWith("USB4\\", StringComparison.OrdinalIgnoreCase) ||
                probeId.StartsWith("THUNDERBOLT\\", StringComparison.OrdinalIgnoreCase) ||
                (probeId.StartsWith("PCI\\", StringComparison.OrdinalIgnoreCase) && depth > 0);

            if (isRemovableOrEjectable)
            {
                bestCandidate = probe;
                bestId = probeId;

                // Si llegamos a un puente PCIe/USB4 removible superior, continuamos comprobando 1 nivel más
                if (isUsb4OrThunderboltBridge && depth >= 2)
                {
                    break;
                }
            }

            if (CM_Get_Parent(out uint parent, probe, 0) != CR_SUCCESS || parent == 0)
            {
                break;
            }

            probe = parent;
        }

        ejectDevInst = bestCandidate;
        return bestId;
    }

    private static bool IsNodeRemovableOrEjectable(uint devInst)
    {
        if (CM_Get_DevNode_Status(out uint status, out _, devInst, 0) == CR_SUCCESS)
        {
            if ((status & DN_REMOVABLE) != 0)
            {
                return true;
            }
        }

        byte[] propBuffer = new byte[4];
        uint propSize = (uint)propBuffer.Length;
        DEVPROPKEY key = DEVPKEY_Device_Capabilities;
        uint cr = CM_Get_DevNode_PropertyW(devInst, ref key, out _, propBuffer, ref propSize, 0);
        if (cr == CR_SUCCESS && propSize >= 4)
        {
            uint caps = BitConverter.ToUInt32(propBuffer, 0);
            if ((caps & (CM_DEVCAP_REMOVABLE | CM_DEVCAP_EJECTSUPPORTED)) != 0)
            {
                return true;
            }
        }

        return false;
    }

    private static string GetDeviceIdFromDevInst(uint devInst)
    {
        StringBuilder sb = new(512);
        return CM_Get_Device_IDW(devInst, sb, sb.Capacity, 0) == CR_SUCCESS
            ? sb.ToString()
            : string.Empty;
    }

    private static IEnumerable<ActiveGpuProcess> QueryPdhGpuProcesses()
    {
        List<ActiveGpuProcess> found = new();
        try
        {
            if (!PerformanceCounterCategory.Exists("GPU Engine"))
            {
                return found;
            }

            PerformanceCounterCategory category = new("GPU Engine");
            string[] instances = category.GetInstanceNames();
            List<(int Pid, PerformanceCounter Counter)> counters = new();

            foreach (string instance in instances)
            {
                if (!instance.Contains("engtype_3D", StringComparison.OrdinalIgnoreCase) &&
                    !instance.Contains("engtype_Compute", StringComparison.OrdinalIgnoreCase))
                {
                    continue;
                }

                Match m = PdhPidRegex.Match(instance);
                if (!m.Success || !int.TryParse(m.Groups[1].Value, out int pid) || pid <= 4)
                {
                    continue;
                }

                try
                {
                    PerformanceCounter pc = new("GPU Engine", "Utilization Percentage", instance, readOnly: true);
                    _ = pc.NextValue(); // Primera muestra PDH
                    counters.Add((pid, pc));
                }
                catch
                {
                    // Instancia efímera cerrada entre enumeración y lectura
                }
            }

            if (counters.Count == 0)
            {
                return found;
            }

            Thread.Sleep(180);

            Dictionary<int, float> usageByPid = new();
            foreach ((int pid, PerformanceCounter pc) in counters)
            {
                try
                {
                    float val = pc.NextValue();
                    if (val > 0.5f)
                    {
                        usageByPid[pid] = usageByPid.TryGetValue(pid, out float prev) ? prev + val : val;
                    }
                }
                catch
                {
                    // Ignorar proceso terminado durante el muestreo
                }
                finally
                {
                    pc.Dispose();
                }
            }

            foreach (KeyValuePair<int, float> kvp in usageByPid)
            {
                try
                {
                    using Process p = Process.GetProcessById(kvp.Key);
                    found.Add(new ActiveGpuProcess(kvp.Key, p.ProcessName, Math.Round(kvp.Value, 1), "PDH"));
                }
                catch
                {
                    // El proceso ya finalizó
                }
            }
        }
        catch
        {
            // PDH no disponible o sin permisos
        }

        return found;
    }

    private static IEnumerable<ActiveGpuProcess> QueryNvmlGraphicsProcesses()
    {
        List<ActiveGpuProcess> found = new();
        bool initialized = false;
        try
        {
            if (nvmlInit_v2() != 0)
            {
                return found;
            }
            initialized = true;

            if (nvmlDeviceGetCount_v2(out uint deviceCount) != 0 || deviceCount == 0)
            {
                return found;
            }

            for (uint i = 0; i < deviceCount; i++)
            {
                if (nvmlDeviceGetHandleByIndex_v2(i, out IntPtr device) != 0)
                {
                    continue;
                }

                uint count = 32;
                NvmlProcessInfoV2[] procs = new NvmlProcessInfoV2[count];
                int rc = nvmlDeviceGetGraphicsRunningProcesses_v3(device, ref count, procs);
                if (rc == 0)
                {
                    for (int j = 0; j < count; j++)
                    {
                        int pid = (int)procs[j].pid;
                        double vramMb = procs[j].usedGpuMemory == ulong.MaxValue
                            ? 0
                            : Math.Round(procs[j].usedGpuMemory / (1024.0 * 1024.0), 1);

                        try
                        {
                            using Process p = Process.GetProcessById(pid);
                            found.Add(new ActiveGpuProcess(pid, p.ProcessName, vramMb, "NVML"));
                        }
                        catch
                        {
                            // Proceso ya cerrado
                        }
                    }
                }
            }
        }
        catch (DllNotFoundException)
        {
            // nvml.dll no presente si no hay driver NVIDIA activo; PDH cubrirá la detección
        }
        catch (EntryPointNotFoundException)
        {
            // Versión de driver NVML diferente; PDH cubrirá la detección
        }
        finally
        {
            if (initialized)
            {
                try { _ = nvmlShutdown(); } catch { }
            }
        }

        return found;
    }

    [StructLayout(LayoutKind.Sequential)]
    private struct DEVPROPKEY
    {
        public Guid fmtid;
        public uint pid;
    }

    [StructLayout(LayoutKind.Sequential)]
    private struct NvmlProcessInfoV2
    {
        public uint pid;
        public ulong usedGpuMemory;
        public uint gpuInstanceId;
        public uint computeInstanceId;
    }

    [DllImport("cfgmgr32.dll", CharSet = CharSet.Unicode)]
    private static extern uint CM_Get_Device_ID_List_SizeW(
        out uint pulLen,
        string? pszFilter,
        uint ulFlags);

    [DllImport("cfgmgr32.dll", CharSet = CharSet.Unicode)]
    private static extern uint CM_Get_Device_ID_ListW(
        string? pszFilter,
        [Out] char[] buffer,
        uint bufferLen,
        uint ulFlags);

    [DllImport("cfgmgr32.dll", CharSet = CharSet.Unicode)]
    private static extern uint CM_Locate_DevNodeW(
        out uint pdnDevInst,
        string pDeviceID,
        uint ulFlags);

    [DllImport("cfgmgr32.dll")]
    private static extern uint CM_Get_Parent(
        out uint pdnDevInst,
        uint dnDevInst,
        uint ulFlags);

    [DllImport("cfgmgr32.dll", CharSet = CharSet.Unicode)]
    private static extern uint CM_Get_Device_IDW(
        uint dnDevInst,
        StringBuilder buffer,
        int bufferLen,
        uint ulFlags);

    [DllImport("cfgmgr32.dll")]
    private static extern uint CM_Get_DevNode_Status(
        out uint pulStatus,
        out uint pulProblemNumber,
        uint dnDevInst,
        uint ulFlags);

    [DllImport("cfgmgr32.dll", CharSet = CharSet.Unicode)]
    private static extern uint CM_Get_DevNode_PropertyW(
        uint dnDevInst,
        ref DEVPROPKEY propertyKey,
        out uint propertyType,
        [Out] byte[] propertyBuffer,
        ref uint propertyBufferSize,
        uint ulFlags);

    [DllImport("cfgmgr32.dll", CharSet = CharSet.Unicode)]
    private static extern uint CM_Request_Device_EjectW(
        uint dnDevInst,
        out PNP_VETO_TYPE pVetoType,
        StringBuilder pszVetoName,
        int ulNameLength,
        uint ulFlags);

    [DllImport("nvml.dll", CallingConvention = CallingConvention.Cdecl)]
    private static extern int nvmlInit_v2();

    [DllImport("nvml.dll", CallingConvention = CallingConvention.Cdecl)]
    private static extern int nvmlShutdown();

    [DllImport("nvml.dll", CallingConvention = CallingConvention.Cdecl)]
    private static extern int nvmlDeviceGetCount_v2(out uint deviceCount);

    [DllImport("nvml.dll", CallingConvention = CallingConvention.Cdecl)]
    private static extern int nvmlDeviceGetHandleByIndex_v2(uint index, out IntPtr device);

    [DllImport("nvml.dll", CallingConvention = CallingConvention.Cdecl)]
    private static extern int nvmlDeviceGetGraphicsRunningProcesses_v3(
        IntPtr device,
        ref uint infoCount,
        [Out] NvmlProcessInfoV2[] infos);
}
