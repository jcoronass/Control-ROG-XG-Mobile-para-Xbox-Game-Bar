import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FolderArchive, Gamepad2 } from 'lucide-react';
import { CodeExportView } from './components/CodeExportView';
import { GameBarWidget } from './components/GameBarWidget';
import { GameProfilesPanel } from './components/GameProfilesPanel';
import { HardwareSchematic } from './components/HardwareSchematic';
import { SetupGuideView } from './components/SetupGuideView';
import { buildWidgetCodeFiles } from './data/widgetCodeTemplates';
import {
  DEFAULT_GAME_PROFILES,
  POWER_PROFILE_MODIFIERS,
  SCENARIO_PRESETS,
  XGMOBILE_MODELS,
} from './data/xgMobilePresets';
import { useXboxInput } from './hooks/useXboxInput';
import {
  ActiveWorkspaceTab,
  GameHardwareMode,
  GameProfileEntry,
  GpuProcess,
  PowerProfile,
  ScenarioId,
  TelemetrySnapshot,
  UndockPhase,
  WidgetSizeMode,
  XGMobileModelId,
} from './types/xgmobile';
import { createZipBlob } from './utils/zipBuilder';

const POWER_CYCLE: PowerProfile[] = ['Silencioso', 'Rendimiento', 'Turbo'];
const STORAGE_KEY = 'xgmobile_game_profiles_v1';

function loadSavedProfiles(): GameProfileEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_GAME_PROFILES;
    const parsed = JSON.parse(raw) as GameProfileEntry[];
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : DEFAULT_GAME_PROFILES;
  } catch {
    return DEFAULT_GAME_PROFILES;
  }
}

export default function App() {
  const [activeTab, setActiveTab] = useState<ActiveWorkspaceTab>('widget');
  const [modelId, setModelId] = useState<XGMobileModelId>('rtx-5090-tb5');
  const [scenarioId, setScenarioId] = useState<ScenarioId>('gaming_aaa');
  const [powerProfile, setPowerProfile] = useState<PowerProfile>('Rendimiento');
  const [sizeMode, setSizeMode] = useState<WidgetSizeMode>('expanded');

  const [phase, setPhase] = useState<UndockPhase>('connected');
  const [processes, setProcesses] = useState<GpuProcess[]>(
    SCENARIO_PRESETS.gaming_aaa.processes,
  );
  const [jitterTick, setJitterTick] = useState(0);

  const [gameProfiles, setGameProfiles] = useState<GameProfileEntry[]>(loadSavedProfiles);
  const [selectedGameId, setSelectedGameId] = useState<string>(
    () => loadSavedProfiles()[0]?.id ?? 'cyberpunk-2077',
  );
  const [lastSyncMessage, setLastSyncMessage] = useState<string | null>(null);

  const timersRef = useRef<number[]>([]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(gameProfiles));
    } catch {
      // Ignore storage quota errors
    }
  }, [gameProfiles]);

  const activeGame = useMemo(
    () => gameProfiles.find((g) => g.id === selectedGameId) ?? gameProfiles[0],
    [gameProfiles, selectedGameId],
  );

  const clearScheduledTimers = useCallback(() => {
    for (const id of timersRef.current) {
      window.clearTimeout(id);
    }
    timersRef.current = [];
  }, []);

  useEffect(() => {
    return () => clearScheduledTimers();
  }, [clearScheduledTimers]);

  const model = XGMOBILE_MODELS[modelId];
  const scenario = SCENARIO_PRESETS[scenarioId];

  // Live telemetry loop (real-time jitter only when connected)
  useEffect(() => {
    if (phase === 'unplugged' || phase === 'safe_to_unplug') return;
    const interval = window.setInterval(() => {
      setJitterTick((t) => (t + 1) % 1000);
    }, 1400);
    return () => window.clearInterval(interval);
  }, [phase]);

  const applyProfilesForHardwareMode = useCallback(
    (mode: GameHardwareMode, reasonLabel: string) => {
      let swappedCount = 0;
      setGameProfiles((prev) =>
        prev.map((g) => {
          if (!g.autoSwitchOnUndock) return g;
          swappedCount += 1;
          return { ...g, lastAppliedMode: mode };
        }),
      );
      setLastSyncMessage(
        `${reasonLabel}: ${swappedCount} ${swappedCount === 1 ? 'juego actualizado' : 'juegos actualizados'} al perfil ${
          mode === 'handheld' ? 'Handheld (.handheld.bak)' : 'eGPU (.egpu.bak)'
        }.`,
      );
    },
    [],
  );

  // Apply scenario preset cleanly
  const handleSelectScenario = (nextId: ScenarioId) => {
    clearScheduledTimers();
    setScenarioId(nextId);
    const preset = SCENARIO_PRESETS[nextId];
    setProcesses(preset.processes);
    const isUndocked = nextId === 'undocked';
    setPhase(isUndocked ? 'unplugged' : 'connected');

    if (nextId === 'external_display') {
      const fh5 = gameProfiles.find((g) => g.id === 'forza-horizon-5');
      if (fh5) setSelectedGameId(fh5.id);
    } else if (nextId === 'gaming_aaa') {
      const cp = gameProfiles.find((g) => g.id === 'cyberpunk-2077');
      if (cp) setSelectedGameId(cp.id);
    }

    applyProfilesForHardwareMode(
      isUndocked ? 'handheld' : 'egpu',
      isUndocked ? 'Cambio a escenario portátil' : 'Escenario eGPU activo',
    );
  };

  // Compute current telemetry snapshot from model + scenario + power profile + active processes
  const telemetry: TelemetrySnapshot = useMemo(() => {
    const base = scenario.baseTelemetry;
    if (phase === 'unplugged' || phase === 'safe_to_unplug') {
      return {
        ...base,
        gpuLoad: 0,
        gpuTempC: 0,
        hotspotTempC: 0,
        coreClockMhz: 0,
        memoryClockMhz: 0,
        tgpWatts: 0,
        vramUsedGb: 0,
        fanRpm: 0,
        fanPercent: 0,
        pcieLinkGbps: 0,
        pdChargingWatts: 0,
        igpuLoad: scenarioId === 'gaming_aaa' ? 42 : 24,
        externalDisplayConnected: false,
        ethernetLinkMbps: 0,
        usbDevicesCount: 0,
      };
    }

    const mod = POWER_PROFILE_MODIFIERS[powerProfile];
    const hasHeavyGame = processes.some((p) => p.category === 'Juego');
    const processGpuSum = processes.reduce((acc, p) => acc + p.gpuPercent, 0);
    const processVramGb =
      processes.reduce((acc, p) => acc + p.vramMb, 0) / 1024;

    // Pseudo-deterministic subtle sensor variation
    const wave = Math.sin(jitterTick * 0.85);
    const loadBase =
      processes.length === 0
        ? 2
        : Math.min(99, Math.max(4, processGpuSum + (hasHeavyGame ? 4 : 1)));
    const gpuLoad = Math.min(100, Math.max(1, Math.round(loadBase + wave * 2)));

    const rawTgp =
      processes.length === 0
        ? 14
        : Math.round(
            Math.min(model.maxTgpWatts, (gpuLoad / 100) * model.maxTgpWatts * mod.tgpScale + 12),
          );

    const vramUsedGb = Math.min(
      model.vramTotalGb - 0.3,
      Math.max(0.4, Number((processVramGb + 0.35).toFixed(1))),
    );

    const tempBase =
      processes.length === 0
        ? 41
        : Math.round(44 + (rawTgp / model.maxTgpWatts) * 34 + wave * 1.4);

    const coreClockMhz =
      processes.length === 0
        ? 420
        : Math.max(
            480,
            Math.round(base.coreClockMhz + mod.clockOffsetMhz + wave * 30),
          );

    const fanPercent =
      processes.length === 0
        ? 20
        : Math.min(100, Math.max(22, Math.round((tempBase - 30) * 1.35 * mod.fanScale)));
    const fanRpm = Math.round(fanPercent * 52 + wave * 45);

    return {
      ...base,
      gpuLoad,
      gpuTempC: tempBase,
      hotspotTempC: tempBase + 10,
      coreClockMhz,
      tgpWatts: rawTgp,
      vramUsedGb,
      fanPercent,
      fanRpm,
      pdChargingWatts: model.pdOutputWatts,
    };
  }, [jitterTick, model, phase, powerProfile, processes, scenario.baseTelemetry, scenarioId]);

  // Sequential Safe Undock Pipeline
  const runUndockSequence = useCallback(() => {
    clearScheduledTimers();
    setPhase('suspending_queue');

    const t1 = window.setTimeout(() => {
      setProcesses((prev) => prev.filter((p) => !p.canSafeClose));
      setPhase('releasing_io');
    }, 850);

    const t2 = window.setTimeout(() => {
      setProcesses([]);
      setPhase('ejecting_pcie');
    }, 1700);

    const t3 = window.setTimeout(() => {
      setPhase('safe_to_unplug');
      applyProfilesForHardwareMode('handheld', 'Desacoplamiento seguro completado');
    }, 2600);

    timersRef.current = [t1, t2, t3];
  }, [applyProfilesForHardwareMode, clearScheduledTimers]);

  const handleStartUndock = useCallback(() => {
    if (phase !== 'connected') return;
    const hasBlockingProcesses = processes.some((p) => p.canSafeClose);
    if (hasBlockingProcesses) {
      setPhase('confirm_processes');
    } else {
      runUndockSequence();
    }
  }, [phase, processes, runUndockSequence]);

  const handleConfirmUndock = useCallback(() => {
    if (phase !== 'confirm_processes') return;
    runUndockSequence();
  }, [phase, runUndockSequence]);

  const handleCancelUndock = useCallback(() => {
    if (phase === 'confirm_processes') {
      setPhase('connected');
    }
  }, [phase]);

  const handleCloseProcess = (pid: number) => {
    setProcesses((prev) => prev.filter((p) => p.pid !== pid));
  };

  const handleSimulatePhysicalUnplug = () => {
    clearScheduledTimers();
    setPhase('unplugged');
  };

  const handleSimulateReconnect = () => {
    clearScheduledTimers();
    const fallbackScenario: ScenarioId =
      scenarioId === 'undocked' ? 'xbox_idle' : scenarioId;
    if (scenarioId === 'undocked') {
      setScenarioId(fallbackScenario);
    }
    setProcesses(SCENARIO_PRESETS[fallbackScenario].processes);
    setPhase('connected');
    applyProfilesForHardwareMode('egpu', 'XG Mobile acoplada');
  };

  const handleApplyGameMode = (gameId: string, mode: GameHardwareMode) => {
    const target = gameProfiles.find((g) => g.id === gameId);
    setGameProfiles((prev) =>
      prev.map((g) => (g.id === gameId ? { ...g, lastAppliedMode: mode } : g)),
    );
    if (target) {
      setLastSyncMessage(
        `${target.title}: archivo de configuración cambiado a ${
          mode === 'handheld' ? 'Handheld (.handheld.bak)' : 'eGPU (.egpu.bak)'
        }.`,
      );
    }
  };

  const handleUpdateGame = (updated: GameProfileEntry) => {
    setGameProfiles((prev) => prev.map((g) => (g.id === updated.id ? updated : g)));
  };

  const handleAddGame = (entry: GameProfileEntry) => {
    setGameProfiles((prev) => [...prev, entry]);
    setLastSyncMessage(`Juego añadido: ${entry.title} con perfiles Handheld y eGPU.`);
  };

  const handleDeleteGame = (id: string) => {
    setGameProfiles((prev) => {
      const next = prev.filter((g) => g.id !== id);
      if (selectedGameId === id && next[0]) {
        setSelectedGameId(next[0].id);
      }
      return next;
    });
  };

  const handleResetGameProfiles = () => {
    setGameProfiles(DEFAULT_GAME_PROFILES);
    setSelectedGameId(DEFAULT_GAME_PROFILES[0].id);
    setLastSyncMessage('Perfiles por juego restaurados a los valores predeterminados.');
  };

  const handleCyclePowerProfile = useCallback(() => {
    setPowerProfile((prev) => {
      const idx = POWER_CYCLE.indexOf(prev);
      return POWER_CYCLE[(idx + 1) % POWER_CYCLE.length];
    });
  }, []);

  const handleToggleSizeMode = useCallback(() => {
    setSizeMode((prev) => (prev === 'compact' ? 'expanded' : 'compact'));
  }, []);

  // Xbox Ally X / Gamepad + Keyboard controls active on Widget view
  const { connectedControllerName } = useXboxInput({
    enabled: activeTab === 'widget',
    onButtonX: handleStartUndock,
    onButtonY: handleCyclePowerProfile,
    onButtonB: handleCancelUndock,
    onToggleCompact: handleToggleSizeMode,
  });

  // Download complete MSIX/C#/PowerShell + GitHub Actions project as .zip
  const handleDownloadZip = useCallback(() => {
    const files = buildWidgetCodeFiles(model, gameProfiles);
    const entries = files.map((f) => ({
      path: f.zipPath,
      content: f.content,
    }));

    const blob = createZipBlob(entries);
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `XGMobile-GameBar-${model.id}.zip`;
    a.click();
    URL.revokeObjectURL(url);
  }, [gameProfiles, model]);

  return (
    <div className="min-h-screen bg-[#0C0E12] text-[#F1F5F9]">
      {/* Strict 3-Zone Top Bar Contract */}
      <header className="border-b border-white/[0.08] bg-[#0C0E12]">
        <div className="mx-auto flex max-w-[1200px] items-center justify-between gap-8 px-6 py-4">
          {/* Zone 1: Single text element wordmark */}
          <button
            type="button"
            onClick={() => setActiveTab('widget')}
            className="font-display text-lg font-bold tracking-tight text-white whitespace-nowrap shrink-0 text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#16A34A]"
          >
            XG Mobile Bar
          </button>

          {/* Zone 2: Clean single-line navigation links */}
          <nav
            aria-label="Secciones principales"
            className="flex items-center gap-6 overflow-x-auto text-sm font-medium"
          >
            <button
              type="button"
              onClick={() => setActiveTab('widget')}
              className={`border-b-2 py-1 transition-colors whitespace-nowrap shrink-0 ${
                activeTab === 'widget'
                  ? 'border-[#16A34A] text-white'
                  : 'border-transparent text-slate-400 hover:text-white'
              }`}
            >
              Widget en Vivo
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('code')}
              className={`border-b-2 py-1 transition-colors whitespace-nowrap shrink-0 ${
                activeTab === 'code'
                  ? 'border-[#16A34A] text-white'
                  : 'border-transparent text-slate-400 hover:text-white'
              }`}
            >
              Código del Widget
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('guide')}
              className={`border-b-2 py-1 transition-colors whitespace-nowrap shrink-0 ${
                activeTab === 'guide'
                  ? 'border-[#16A34A] text-white'
                  : 'border-transparent text-slate-400 hover:text-white'
              }`}
            >
              Guía Ally X
            </button>
          </nav>

          {/* Zone 3: 1 primary action */}
          <div className="shrink-0">
            <button
              type="button"
              onClick={handleDownloadZip}
              className="inline-flex min-h-[38px] items-center gap-2 rounded-md bg-[#16A34A] px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-[#15803D] whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#16A34A]"
            >
              <FolderArchive className="h-3.5 w-3.5" />
              <span>Descargar paquete</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Container */}
      <main className="mx-auto max-w-[1200px] px-6 py-8">
        {activeTab === 'widget' && (
          <div className="space-y-8">
            {/* Hero / Context Row */}
            <div className="flex flex-wrap items-end justify-between gap-6 border-b border-white/[0.08] pb-6">
              <div className="max-w-2xl space-y-2">
                <h1 className="font-display text-3xl font-semibold tracking-tight text-white">
                  Control ROG XG Mobile para Xbox Game Bar
                </h1>
                <p className="text-sm leading-relaxed text-slate-400">
                  Simula y personaliza tu widget nativo para{' '}
                  <span className="text-slate-200">ASUS ROG Xbox Ally X</span>. Supervisa carga,
                  temperaturas, TGP y procesos en la eGPU, y desacopla el enlace de forma segura
                  sin abandonar el Modo Juego Xbox.
                </p>
              </div>

              {/* Live Gamepad Hardware Detection Status */}
              <div className="flex items-center gap-2 text-xs text-slate-400">
                <Gamepad2 className="h-4 w-4 text-slate-400" />
                <span>
                  {connectedControllerName
                    ? `Mando detectado: ${connectedControllerName}`
                    : 'Atajos activos: Tecla X (Desacoplar) · Y (Perfil) · M (Compacto)'}
                </span>
              </div>
            </div>

            {/* Workspace Toolbar: Model & Scenario Selectors */}
            <div className="grid grid-cols-1 gap-4 rounded-lg border border-white/[0.08] bg-[#14181F] p-4 md:grid-cols-2">
              <div className="space-y-1.5">
                <label
                  htmlFor="xg-model-select"
                  className="block text-xs font-medium text-slate-400"
                >
                  Modelo de eGPU ASUS ROG XG Mobile
                </label>
                <select
                  id="xg-model-select"
                  value={modelId}
                  onChange={(e) => setModelId(e.target.value as XGMobileModelId)}
                  className="h-10 w-full rounded-md border border-white/[0.1] bg-[#0C0E12] px-3 text-sm text-white focus:border-[#16A34A] focus:outline-none"
                >
                  {Object.values(XGMOBILE_MODELS).map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name} — {m.vramTotalGb} GB {m.vramType} ({m.interfaceType})
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <span className="block text-xs font-medium text-slate-400">
                  Escenario de simulación en Modo Juego Xbox
                </span>
                <div className="flex flex-wrap items-center gap-1.5 rounded-md bg-[#0C0E12] p-1 border border-white/[0.08]">
                  {(Object.keys(SCENARIO_PRESETS) as ScenarioId[]).map((id) => {
                    const preset = SCENARIO_PRESETS[id];
                    const active = scenarioId === id;
                    return (
                      <button
                        key={id}
                        type="button"
                        onClick={() => handleSelectScenario(id)}
                        className={`flex-1 rounded px-2.5 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                          active
                            ? 'bg-[#1D2430] text-white'
                            : 'text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        {preset.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Interactive Game Bar Overlay Canvas (Focal Anchor) */}
            <div className="rounded-xl border border-white/[0.08] bg-[#090B0E] p-6 sm:p-8 space-y-6">
              <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-slate-400">
                <span>
                  Vista previa de superposición Xbox Game Bar ({sizeMode === 'compact' ? 'Modo Compacto 7"' : 'Panel Completo'})
                </span>
                <span>{scenario.description}</span>
              </div>

              <GameBarWidget
                model={model}
                telemetry={telemetry}
                processes={processes}
                powerProfile={powerProfile}
                onChangePowerProfile={setPowerProfile}
                sizeMode={sizeMode}
                onToggleSizeMode={handleToggleSizeMode}
                phase={phase}
                onStartUndock={handleStartUndock}
                onConfirmUndock={handleConfirmUndock}
                onCancelUndock={handleCancelUndock}
                onCloseProcess={handleCloseProcess}
                onSimulateReconnect={handleSimulateReconnect}
                onSimulatePhysicalUnplug={handleSimulatePhysicalUnplug}
                activeGame={activeGame}
                onApplyGameMode={handleApplyGameMode}
              />
            </div>

            {/* Dual Handheld vs eGPU Game Settings Manager */}
            <GameProfilesPanel
              profiles={gameProfiles}
              selectedGameId={selectedGameId}
              onSelectGame={setSelectedGameId}
              onUpdateGame={handleUpdateGame}
              onAddGame={handleAddGame}
              onDeleteGame={handleDeleteGame}
              onApplyModeToGame={handleApplyGameMode}
              onResetDefaults={handleResetGameProfiles}
              phase={phase}
              lastSyncMessage={lastSyncMessage}
            />

            {/* Hardware Topology & Port Specs */}
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-12 items-start">
              <div className="lg:col-span-8">
                <HardwareSchematic model={model} telemetry={telemetry} phase={phase} />
              </div>

              <div className="rounded-lg border border-white/[0.08] bg-[#14181F] p-4 space-y-3 lg:col-span-4">
                <h3 className="font-display text-sm font-semibold text-white">
                  Especificaciones del dock activo
                </h3>
                <dl className="space-y-2 text-xs">
                  <div className="flex items-center justify-between gap-2 border-b border-white/[0.06] pb-2">
                    <dt className="text-slate-400">GPU</dt>
                    <dd className="font-medium text-slate-200 text-right">{model.gpuChip}</dd>
                  </div>
                  <div className="flex items-center justify-between gap-2 border-b border-white/[0.06] pb-2">
                    <dt className="text-slate-400">Ancho de banda</dt>
                    <dd className="font-mono tabular-nums text-slate-200">{model.bandwidthLabel}</dd>
                  </div>
                  <div className="flex items-center justify-between gap-2 border-b border-white/[0.06] pb-2">
                    <dt className="text-slate-400">Fuente / Carga PD</dt>
                    <dd className="font-mono tabular-nums text-slate-200">
                      {model.adapterWatts}W · {model.pdOutputWatts}W hacia Ally X
                    </dd>
                  </div>
                  <div className="pt-1">
                    <dt className="mb-1 text-slate-400">Puertos integrados</dt>
                    <dd className="text-slate-300 leading-relaxed">
                      {model.ports.join(' · ')}
                    </dd>
                  </div>
                </dl>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'code' && (
          <CodeExportView
            model={model}
            gameProfiles={gameProfiles}
            onDownloadZip={handleDownloadZip}
          />
        )}

        {activeTab === 'guide' && (
          <SetupGuideView model={model} onDownloadZip={handleDownloadZip} />
        )}
      </main>
    </div>
  );
}
