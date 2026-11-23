import React, { useState } from 'react';
import {
  AlertTriangle,
  ArrowLeftRight,
  CheckCircle2,
  Cpu,
  HardDrive,
  RefreshCw,
  ShieldCheck,
  Unplug,
  X,
} from 'lucide-react';

interface SimulatedProcess {
  pid: number;
  name: string;
  source: 'NVML' | 'PDH';
  metric: string;
}

interface SimulatedGameProfile {
  gameName: string;
  executableName: string;
  targetConfigPath: string;
  egpuBackupPath: string;
  handheldBackupPath: string;
  activeSlot: 'eGPU' | 'Handheld';
}

interface IpcMessageLog {
  id: number;
  direction: 'UWP → Win32' | 'Win32 → UWP' | 'WMI Event';
  payload: string;
  timestamp: string;
}

const INITIAL_GAMES: SimulatedGameProfile[] = [
  {
    gameName: 'Cyberpunk 2077',
    executableName: 'Cyberpunk2077.exe',
    targetConfigPath: '%LOCALAPPDATA%\\CD Projekt Red\\Cyberpunk 2077\\UserSettings.json',
    egpuBackupPath: 'C:\\eGPU_Profiles\\eGPU\\Cyberpunk2077\\UserSettings.json',
    handheldBackupPath: 'C:\\eGPU_Profiles\\Handheld\\Cyberpunk2077\\UserSettings.json',
    activeSlot: 'eGPU',
  },
  {
    gameName: 'Forza Horizon 5',
    executableName: 'ForzaHorizon5.exe',
    targetConfigPath: '%LOCALAPPDATA%\\ForzaHorizon5\\User_Config.xml',
    egpuBackupPath: 'C:\\eGPU_Profiles\\eGPU\\ForzaHorizon5\\User_Config.xml',
    handheldBackupPath: 'C:\\eGPU_Profiles\\Handheld\\ForzaHorizon5\\User_Config.xml',
    activeSlot: 'eGPU',
  },
  {
    gameName: 'Starfield',
    executableName: 'Starfield.exe',
    targetConfigPath: '%USERPROFILE%\\Documents\\My Games\\Starfield\\StarfieldPrefs.ini',
    egpuBackupPath: 'C:\\eGPU_Profiles\\eGPU\\Starfield\\StarfieldPrefs.ini',
    handheldBackupPath: 'C:\\eGPU_Profiles\\Handheld\\Starfield\\StarfieldPrefs.ini',
    activeSlot: 'eGPU',
  },
  {
    gameName: 'Black Myth: Wukong',
    executableName: 'b1-Win64-Shipping.exe',
    targetConfigPath: '%LOCALAPPDATA%\\b1\\Saved\\Config\\Windows\\GameUserSettings.ini',
    egpuBackupPath: 'C:\\eGPU_Profiles\\eGPU\\BlackMythWukong\\GameUserSettings.ini',
    handheldBackupPath: 'C:\\eGPU_Profiles\\Handheld\\BlackMythWukong\\GameUserSettings.ini',
    activeSlot: 'eGPU',
  },
];

const INITIAL_PROCESSES: SimulatedProcess[] = [
  { pid: 18420, name: 'Cyberpunk2077.exe', source: 'NVML', metric: '9.2 GB VRAM' },
  { pid: 9344, name: 'obs64.exe', source: 'PDH', metric: '4.8% 3D Engine' },
];

function nowClock(): string {
  return new Date().toLocaleTimeString('es-ES', { hour12: false });
}

export const WidgetSimulator: React.FC = () => {
  const [isEgpuActive, setIsEgpuActive] = useState(true);
  const [isBusy, setIsBusy] = useState(false);
  const [simulateVetoDriver, setSimulateVetoDriver] = useState(false);
  const [activeProcs, setActiveProcs] = useState<SimulatedProcess[]>(INITIAL_PROCESSES);
  const [games, setGames] = useState<SimulatedGameProfile[]>(INITIAL_GAMES);
  const [statusMessage, setStatusMessage] = useState(
    'AppServiceConnection conectado · PCI\\VEN_10DE detectada bajo puente USB4/PCIe expulsable.',
  );
  const [warning, setWarning] = useState<{ title: string; detail: string } | null>(null);
  const [lastSyncedText, setLastSyncedText] = useState('Ninguno todavía');
  const [logs, setLogs] = useState<IpcMessageLog[]>([
    {
      id: 1,
      direction: 'Win32 → UWP',
      payload: 'Command=Status · IsEgpuActive=true · EjectNode=PCI\\VEN_8086&DEV_5780\\USB4_ROOT',
      timestamp: nowClock(),
    },
  ]);

  const appendLog = (direction: IpcMessageLog['direction'], payload: string) => {
    setLogs((prev) => [
      { id: Date.now() + Math.random(), direction, payload, timestamp: nowClock() },
      ...prev.slice(0, 7),
    ]);
  };

  const syncProfiles = (targetMode: 'eGPU' | 'Handheld', origin: string) => {
    const runningSet = new Set(activeProcs.map((p) => p.name.toLowerCase()));
    const swappedNames: string[] = [];
    const skippedNames: string[] = [];

    setGames((prev) =>
      prev.map((g) => {
        if (runningSet.has(g.executableName.toLowerCase())) {
          skippedNames.push(g.gameName);
          return g;
        }
        swappedNames.push(g.gameName);
        return { ...g, activeSlot: targetMode };
      }),
    );

    const time = nowClock();
    if (swappedNames.length > 0) {
      setLastSyncedText(`${swappedNames[swappedNames.length - 1]} (${targetMode} · ${time})`);
    }

    const summary =
      skippedNames.length > 0
        ? `${origin}: ${swappedNames.length} perfil(es) movidos a ${targetMode}. Omitido por estar en ejecución: ${skippedNames.join(', ')}.`
        : `${origin}: ${swappedNames.length} perfil(es) sincronizados en modo ${targetMode} (respaldo bidireccional completado).`;

    return { summary, skippedNames };
  };

  const handleSafeEject = () => {
    if (isBusy || !isEgpuActive) return;
    setWarning(null);
    setIsBusy(true);
    setStatusMessage('Comprobando NVML + PDH GPU Engine y recorriendo árbol PnP de VEN_10DE...');
    appendLog('UWP → Win32', 'Command=EjectEgpu (AppServiceConnection)');

    window.setTimeout(() => {
      if (activeProcs.length > 0) {
        const list = activeProcs.map((p) => `${p.name} (PID ${p.pid})`).join(', ');
        setWarning({
          title: 'Expulsión detenida · Procesos activos en RTX 5070 Ti (PNP_VetoWindowsApp)',
          detail: `Cierra primero: ${list}. Así se evita un TDR o pantalla negra antes de llamar a CM_Request_Device_EjectW.`,
        });
        setStatusMessage('Expulsión cancelada por el guardrail NVML/PDH.');
        appendLog('Win32 → UWP', `Success=false · VetoType=PNP_VetoWindowsApp · Blocking=[${list}]`);
        setIsBusy(false);
        return;
      }

      if (simulateVetoDriver) {
        setWarning({
          title: 'Veto PnP del kernel (PNP_VetoDriver)',
          detail:
            'CM_Request_Device_EjectW devolvió CR_REMOVE_VETOED (0x00000017) sin abrir diálogos de Windows · VetoName: PCI\\VEN_10DE&DEV_2D18.',
        });
        setStatusMessage('El driver NVIDIA retuvo un handle abierto en el puente PCIe.');
        appendLog('Win32 → UWP', 'Success=false · VetoType=PNP_VetoDriver · CR_REMOVE_VETOED');
        setIsBusy(false);
        return;
      }

      setIsEgpuActive(false);
      const { summary } = syncProfiles('Handheld', 'CM_Request_Device_EjectW OK');
      setStatusMessage(
        'Expulsión segura completada en puente PCIe/USB4. Ya puedes desconectar la XG Mobile.',
      );
      appendLog('Win32 → UWP', `Success=true · CR_SUCCESS · ${summary}`);
      setIsBusy(false);
    }, 850);
  };

  const handleForceSync = () => {
    if (isBusy) return;
    setWarning(null);
    const targetMode = isEgpuActive ? 'eGPU' : 'Handheld';
    appendLog('UWP → Win32', `Command=ForceSync · TargetMode=${targetMode}`);
    const { summary, skippedNames } = syncProfiles(targetMode, 'Sincronización manual');
    setStatusMessage(summary);
    if (skippedNames.length > 0) {
      setWarning({
        title: 'Juego en ejecución omitido',
        detail: `${skippedNames.join(', ')} está abierto. ProfileManager no sobrescribe archivos mientras el ejecutable corre.`,
      });
    }
    appendLog('Win32 → UWP', `ForceSync OK · Mode=${targetMode}`);
  };

  const handleSimulateWmiHotplug = () => {
    if (isBusy) return;
    setWarning(null);
    const nextConnected = !isEgpuActive;
    setIsEgpuActive(nextConnected);
    if (!nextConnected) {
      setActiveProcs([]);
    }
    const eventType = nextConnected ? 'EventType=2 (Arrival)' : 'EventType=3 (Removal)';
    appendLog('WMI Event', `Win32_DeviceChangeEvent · ${eventType} · VEN_10DE`);

    const { summary } = syncProfiles(
      nextConnected ? 'eGPU' : 'Handheld',
      nextConnected ? 'WMI Conexión RTX 5070 Ti' : 'WMI Desconexión XG Mobile',
    );
    setStatusMessage(summary);
    appendLog('Win32 → UWP', `PushHardwareUpdate · IsEgpuActive=${nextConnected}`);
  };

  const handleCloseProcess = (pid: number) => {
    setActiveProcs((prev) => prev.filter((p) => p.pid !== pid));
    setWarning(null);
  };

  const handleRestoreTestProcesses = () => {
    setActiveProcs(INITIAL_PROCESSES);
    setWarning(null);
  };

  return (
    <div className="space-y-8">
      {/* Main 2-column split: Game Bar Widget preview + Hardware/Profile Controls */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12 items-start">
        {/* Left: Authentic Xbox Game Bar Widget (MainPage.xaml replica) */}
        <div className="lg:col-span-6 space-y-4">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>Vista previa interactiva de MainPage.xaml (Xbox Game Bar)</span>
            <span className="font-mono">460 × 440 px · Gamepad X / Y</span>
          </div>

          <section
            aria-label="Simulador de Widget Xbox Game Bar"
            className="rounded-xl border border-white/[0.1] bg-[#0E1218] p-5 shadow-2xl space-y-4"
          >
            {/* Mode Status Border */}
            <div
              className={`rounded-lg border bg-[#141A22] p-3.5 transition-colors ${
                isEgpuActive ? 'border-[#16A34A]' : 'border-blue-500/80'
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 space-y-1">
                  <h2 className="font-display text-base font-bold text-white">
                    {isEgpuActive
                      ? 'MODO eGPU: RTX 5070 Ti Activa'
                      : 'MODO HANDHELD: Radeon Z2E'}
                  </h2>
                  <p className="text-xs text-slate-400">
                    {isEgpuActive
                      ? 'VEN_10DE detectada · Nodo expulsable: PCI\\VEN_8086&DEV_5780\\USB4'
                      : 'iGPU AMD Ryzen Z2 Extreme (VEN_1002) activa · Seguro para uso portátil'}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={handleSimulateWmiHotplug}
                  className="inline-flex h-8 items-center gap-1.5 rounded-md border border-white/[0.1] bg-[#1E2632] px-2.5 text-xs font-medium text-slate-200 transition-colors hover:bg-[#273142] whitespace-nowrap shrink-0"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                  <span>{isEgpuActive ? 'Simular WMI Quitar' : 'Simular WMI Conectar'}</span>
                </button>
              </div>
            </div>

            {/* Primary CTA: Safe Eject */}
            <div className="space-y-2.5">
              <button
                type="button"
                disabled={isBusy || !isEgpuActive}
                onClick={handleSafeEject}
                className="flex min-h-[46px] w-full items-center justify-center gap-2 rounded-lg bg-[#107C10] px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#15803D] disabled:cursor-not-allowed disabled:opacity-45"
              >
                <Unplug className="h-4 w-4" />
                <span>Desacoplar XG Mobile de forma segura (X)</span>
              </button>

              {isBusy && (
                <div className="h-1 w-full overflow-hidden rounded bg-[#1E2530]">
                  <div className="h-full w-2/3 animate-pulse bg-[#22C55E]" />
                </div>
              )}

              <p className="text-xs leading-relaxed text-slate-300">{statusMessage}</p>
            </div>

            {/* Warning Banner (Blocking Process or PNP_VETO_TYPE) */}
            {warning && (
              <div className="rounded-lg border border-amber-500/50 bg-[#261B12] p-3.5 space-y-1">
                <div className="flex items-center gap-2 text-xs font-semibold text-amber-300">
                  <AlertTriangle className="h-4 w-4 shrink-0" />
                  <span>{warning.title}</span>
                </div>
                <p className="text-xs leading-relaxed text-amber-100/90">{warning.detail}</p>
              </div>
            )}

            {/* Profile Manager Card */}
            <div className="rounded-lg border border-white/[0.08] bg-[#131820] p-3.5 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-semibold text-slate-200">
                  Gestor Automático de Perfiles (C:\eGPU_Profiles)
                </span>
                <span className="font-mono text-[11px] text-slate-400">
                  {games.length} juegos
                </span>
              </div>

              <div className="font-mono text-xs text-[#86EFAC]">
                Último juego sincronizado: {lastSyncedText}
              </div>

              <div className="divide-y divide-white/[0.06] pt-1">
                {games.map((g) => (
                  <div
                    key={g.gameName}
                    className="flex items-center justify-between gap-2 py-1.5 text-xs"
                  >
                    <span className="truncate text-slate-300">{g.gameName}</span>
                    <span className="font-mono text-[11px] tabular-nums text-slate-400 shrink-0">
                      {g.activeSlot === 'eGPU'
                        ? 'eGPU (RTX 5070 Ti)'
                        : 'Handheld (Radeon Z2E)'}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Secondary Action Footer */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
              <span className="font-mono text-[11px] text-slate-500">
                AppService: XGMobile.AppService
              </span>
              <button
                type="button"
                disabled={isBusy}
                onClick={handleForceSync}
                className="inline-flex min-h-[38px] items-center gap-2 rounded-md border border-white/[0.12] bg-[#1D2532] px-3.5 py-2 text-xs font-medium text-white transition-colors hover:bg-[#273142] disabled:opacity-50 whitespace-nowrap shrink-0"
              >
                <ArrowLeftRight className="h-3.5 w-3.5" />
                <span>Sincronizar perfiles ahora (Y)</span>
              </button>
            </div>
          </section>
        </div>

        {/* Right: Kernel PnP / NVML Guardrail & AppServiceConnection Diagnostics */}
        <div className="lg:col-span-6 space-y-5">
          {/* Active GPU Processes & Veto Test Bench */}
          <div className="rounded-lg border border-white/[0.08] bg-[#14181F] p-5 space-y-4">
            <div className="flex items-center justify-between gap-3 border-b border-white/[0.08] pb-3">
              <div className="flex items-center gap-2">
                <Cpu className="h-4 w-4 text-slate-300" />
                <h3 className="font-display text-sm font-semibold text-white">
                  Banco de pruebas: Procesos NVIDIA (NVML / PDH) y Veto PnP
                </h3>
              </div>
              {activeProcs.length === 0 && isEgpuActive && (
                <button
                  type="button"
                  onClick={handleRestoreTestProcesses}
                  className="text-xs font-medium text-[#4ADE80] hover:underline whitespace-nowrap shrink-0"
                >
                  Simular juego abierto
                </button>
              )}
            </div>

            {activeProcs.length === 0 ? (
              <div className="flex items-center gap-2 rounded-md border border-white/[0.06] bg-[#0F1319] px-3 py-2.5 text-xs text-slate-300">
                <CheckCircle2 className="h-4 w-4 shrink-0 text-[#4ADE80]" />
                <span>
                  Sin procesos bloqueando VEN_10DE. `CM_Request_Device_EjectW` puede expulsar el
                  nodo padre PCIe/USB4.
                </span>
              </div>
            ) : (
              <div className="divide-y divide-white/[0.06] rounded-md border border-white/[0.08] bg-[#0F1319]">
                {activeProcs.map((proc) => (
                  <div
                    key={proc.pid}
                    className="flex items-center justify-between gap-3 px-3 py-2.5 text-xs"
                  >
                    <div className="min-w-0">
                      <span className="font-mono font-medium text-white">{proc.name}</span>
                      <span className="ml-2 font-mono text-[11px] text-slate-400">
                        PID {proc.pid} · {proc.source} · {proc.metric}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleCloseProcess(proc.pid)}
                      className="inline-flex h-7 items-center gap-1 rounded border border-white/[0.1] bg-[#1A202B] px-2 text-[11px] text-slate-200 transition-colors hover:border-rose-500/40 hover:text-rose-200 whitespace-nowrap shrink-0"
                    >
                      <X className="h-3 w-3" />
                      <span>Cerrar</span>
                    </button>
                  </div>
                ))}
              </div>
            )}

            <label className="flex cursor-pointer items-center gap-2.5 text-xs text-slate-300">
              <input
                type="checkbox"
                checked={simulateVetoDriver}
                onChange={(e) => setSimulateVetoDriver(e.target.checked)}
                className="h-4 w-4 rounded border-white/20 bg-[#0C0E12] accent-[#16A34A]"
              />
              <span>
                Simular rechazo del kernel (<span className="font-mono text-slate-200">PNP_VetoDriver</span>) al invocar <span className="font-mono text-slate-200">CM_Request_Device_EjectW</span>
              </span>
            </label>
          </div>

          {/* Bidirectional AppServiceConnection & WMI Event Log */}
          <div className="rounded-lg border border-white/[0.08] bg-[#14181F] p-5 space-y-3">
            <div className="flex items-center justify-between gap-2 border-b border-white/[0.08] pb-3">
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-slate-300" />
                <h3 className="font-display text-sm font-semibold text-white">
                  Traza IPC (`AppServiceConnection` + WMI)
                </h3>
              </div>
              <span className="font-mono text-[11px] text-slate-400">runFullTrust</span>
            </div>

            <div className="max-h-[210px] space-y-2 overflow-y-auto pr-1 font-mono text-[11px]">
              {logs.map((entry) => (
                <div
                  key={entry.id}
                  className="rounded border border-white/[0.06] bg-[#0F1319] px-3 py-2 space-y-0.5"
                >
                  <div className="flex items-center justify-between text-slate-400">
                    <span className="font-semibold text-slate-200">{entry.direction}</span>
                    <span className="tabular-nums">{entry.timestamp}</span>
                  </div>
                  <div className="text-slate-300 break-all">{entry.payload}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Dual Profile Paths */}
          <div className="rounded-lg border border-white/[0.08] bg-[#14181F] p-4">
            <div className="flex items-center gap-2 text-xs font-semibold text-white mb-2">
              <HardDrive className="h-3.5 w-3.5 text-slate-400" />
              <span>Flujo Dual Profile Swapper (`ProfileManager.cs`)</span>
            </div>
            <p className="text-xs leading-relaxed text-slate-400">
              <strong className="text-slate-200">Al conectar RTX 5070 Ti:</strong> guarda{' '}
              <span className="font-mono text-slate-300">TargetConfigPath</span> →{' '}
              <span className="font-mono text-slate-300">HandheldBackupPath</span> y restaura{' '}
              <span className="font-mono text-slate-300">EgpuBackupPath</span>.{' '}
              <strong className="text-slate-200">Al desacoplar:</strong> guarda{' '}
              <span className="font-mono text-slate-300">TargetConfigPath</span> →{' '}
              <span className="font-mono text-slate-300">EgpuBackupPath</span> y restaura{' '}
              <span className="font-mono text-slate-300">HandheldBackupPath</span>.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
