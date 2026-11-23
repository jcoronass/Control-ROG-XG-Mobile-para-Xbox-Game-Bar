import React from 'react';
import {
  AlertTriangle,
  Cable,
  CheckCircle2,
  Cpu,
  Fan,
  HardDrive,
  Maximize2,
  Minimize2,
  Monitor,
  Power,
  RefreshCw,
  ShieldCheck,
  Thermometer,
  Unplug,
  X,
  Zap,
} from 'lucide-react';
import {
  GameHardwareMode,
  GameProfileEntry,
  GpuProcess,
  PowerProfile,
  TelemetrySnapshot,
  UndockPhase,
  WidgetSizeMode,
  XGMobileSpec,
} from '../types/xgmobile';

interface GameBarWidgetProps {
  model: XGMobileSpec;
  telemetry: TelemetrySnapshot;
  processes: GpuProcess[];
  powerProfile: PowerProfile;
  onChangePowerProfile: (profile: PowerProfile) => void;
  sizeMode: WidgetSizeMode;
  onToggleSizeMode: () => void;
  phase: UndockPhase;
  onStartUndock: () => void;
  onConfirmUndock: () => void;
  onCancelUndock: () => void;
  onCloseProcess: (pid: number) => void;
  onSimulateReconnect: () => void;
  onSimulatePhysicalUnplug: () => void;
  activeGame: GameProfileEntry;
  onApplyGameMode: (gameId: string, mode: GameHardwareMode) => void;
}

const POWER_PROFILES: PowerProfile[] = ['Silencioso', 'Rendimiento', 'Turbo'];

export const GameBarWidget: React.FC<GameBarWidgetProps> = ({
  model,
  telemetry,
  processes,
  powerProfile,
  onChangePowerProfile,
  sizeMode,
  onToggleSizeMode,
  phase,
  onStartUndock,
  onConfirmUndock,
  onCancelUndock,
  onCloseProcess,
  onSimulateReconnect,
  onSimulatePhysicalUnplug,
  activeGame,
  onApplyGameMode,
}) => {
  const activeSettings = activeGame[activeGame.lastAppliedMode];
  const isCompact = sizeMode === 'compact';
  const isConnected =
    phase === 'connected' || phase === 'preflight' || phase === 'confirm_processes';
  const isTransitioning =
    phase === 'suspending_queue' || phase === 'releasing_io' || phase === 'ejecting_pcie';

  const vramPercent =
    model.vramTotalGb > 0
      ? Math.min(100, Math.round((telemetry.vramUsedGb / model.vramTotalGb) * 100))
      : 0;

  const tempWarning = telemetry.gpuTempC >= 80;
  const blockersCount = processes.filter((p) => p.canSafeClose).length;

  return (
    <section
      aria-label="Widget de Xbox Game Bar para ROG XG Mobile"
      className={`mx-auto w-full rounded-xl border border-white/[0.1] bg-[#12161D]/95 shadow-2xl transition-[max-width] duration-200 ${
        isCompact ? 'max-w-[460px]' : 'max-w-[660px]'
      }`}
    >
      {/* Game Bar Widget Title Strip */}
      <div className="flex items-center justify-between gap-3 border-b border-white/[0.08] px-4 py-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h2 className="truncate font-display text-base font-semibold tracking-tight text-white">
              {model.shortName}
            </h2>
          </div>
          <p className="truncate text-xs text-slate-400">
            {phase === 'safe_to_unplug'
              ? 'Expulsión completada · Seguro para desconectar cable'
              : phase === 'unplugged'
                ? 'eGPU desacoplada · iGPU Radeon 890M activa'
                : `${model.interfaceType} · PD ${telemetry.pdChargingWatts}W · ${model.vramTotalGb} GB ${model.vramType}`}
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={onToggleSizeMode}
            title={isCompact ? 'Expandir vista completa (LB/M)' : 'Modo compacto Ally X (LB/M)'}
            className="inline-flex h-9 items-center gap-1.5 rounded-md border border-white/[0.08] bg-[#1A202B] px-2.5 text-xs font-medium text-slate-200 transition-colors hover:bg-[#232B39] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#16A34A] whitespace-nowrap shrink-0"
          >
            {isCompact ? <Maximize2 className="h-3.5 w-3.5" /> : <Minimize2 className="h-3.5 w-3.5" />}
            <span>{isCompact ? 'Expandir' : 'Compacto'}</span>
          </button>
        </div>
      </div>

      {/* Power Profile Segmented Bar (when connected) */}
      {isConnected && (
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/[0.06] bg-[#0F1319] px-4 py-2.5">
          <span className="text-xs font-medium text-slate-400">
            Perfil Armoury SE (Y)
          </span>
          <div
            role="group"
            aria-label="Perfil de energía XG Mobile"
            className="inline-flex items-center gap-1 rounded-lg bg-[#171D26] p-1"
          >
            {POWER_PROFILES.map((prof) => {
              const active = powerProfile === prof;
              return (
                <button
                  key={prof}
                  type="button"
                  onClick={() => onChangePowerProfile(prof)}
                  className={`rounded-md px-3 py-1 text-xs font-medium transition-colors whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[#16A34A] ${
                    active
                      ? 'bg-[#16A34A] text-white'
                      : 'text-slate-300 hover:bg-white/[0.05] hover:text-white'
                  }`}
                >
                  {prof}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <div className="p-4 space-y-4">
        {/* Safe-to-Unplug or Unplugged State */}
        {phase === 'safe_to_unplug' && (
          <div className="rounded-lg border border-[#16A34A]/40 bg-[#16A34A]/10 p-4">
            <div className="flex items-start gap-3">
              <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-[#4ADE80]" />
              <div className="min-w-0 flex-1 space-y-2">
                <h3 className="font-display text-sm font-semibold text-white">
                  Seguro para desconectar la XG Mobile
                </h3>
                <p className="text-xs leading-relaxed text-slate-200">
                  El bus {model.interfaceType} y el hub de puertos han sido detenidos limpiamente.
                  La ASUS ROG Xbox Ally X ha transferido la sesión al adaptador integrado AMD Radeon 890M.
                  {activeGame.autoSwitchOnUndock && (
                    <>
                      {' '}
                      Además, <strong className="text-white">{activeGame.title}</strong> cambió a su
                      perfil Handheld ({activeGame.handheld.resolution} · {activeGame.handheld.preset} ·{' '}
                      {activeGame.handheld.fpsCap} FPS).
                    </>
                  )}
                </p>
                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <button
                    type="button"
                    onClick={onSimulatePhysicalUnplug}
                    className="inline-flex min-h-[38px] items-center gap-2 rounded-md bg-[#16A34A] px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-[#15803D] whitespace-nowrap shrink-0"
                  >
                    <Unplug className="h-3.5 w-3.5" />
                    <span>Confirmar desconexión física</span>
                  </button>
                  <button
                    type="button"
                    onClick={onSimulateReconnect}
                    className="inline-flex min-h-[38px] items-center gap-2 rounded-md border border-white/[0.12] bg-[#1A202B] px-3.5 py-2 text-xs font-medium text-slate-200 transition-colors hover:bg-[#232B39] whitespace-nowrap shrink-0"
                  >
                    <RefreshCw className="h-3.5 w-3.5" />
                    <span>Reactivar eGPU</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {phase === 'unplugged' && (
          <div className="rounded-lg border border-white/[0.08] bg-[#161B23] p-5 text-center space-y-3">
            <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-lg bg-[#1E2530] text-slate-300">
              <Cable className="h-5 w-5" />
            </div>
            <div className="space-y-1">
              <h3 className="font-display text-sm font-semibold text-white">
                Ninguna XG Mobile acoplada
              </h3>
              <p className="mx-auto max-w-sm text-xs leading-relaxed text-slate-400">
                Modo portátil activo en la ROG Xbox Ally X ({telemetry.allyBatteryPercent}% de batería).{' '}
                <span className="text-slate-200">{activeGame.title}</span> usa el perfil{' '}
                <span className="text-slate-200">
                  {activeGame.lastAppliedMode === 'handheld' ? 'Handheld' : 'eGPU'}
                </span>{' '}
                ({activeSettings.resolution} · {activeSettings.preset} · {activeSettings.allyTdpWatts}W TDP).
              </p>
            </div>
            <div className="pt-1">
              <button
                type="button"
                onClick={onSimulateReconnect}
                className="inline-flex min-h-[40px] items-center gap-2 rounded-md bg-[#16A34A] px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-[#15803D] whitespace-nowrap shrink-0"
              >
                <Zap className="h-3.5 w-3.5" />
                <span>Simular conexión XG Mobile</span>
              </button>
            </div>
          </div>
        )}

        {/* Transitioning Undock Progress */}
        {isTransitioning && (
          <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-4 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <span className="font-display text-sm font-semibold text-amber-200">
                Ejecutando desacoplamiento seguro
              </span>
              <span className="font-mono text-xs tabular-nums text-amber-300">
                {phase === 'suspending_queue'
                  ? 'Paso 1 / 3'
                  : phase === 'releasing_io'
                    ? 'Paso 2 / 3'
                    : 'Paso 3 / 3'}
              </span>
            </div>

            <div className="space-y-2 text-xs">
              <div className="flex items-center gap-2 text-slate-200">
                <CheckCircle2
                  className={`h-4 w-4 shrink-0 ${
                    phase === 'suspending_queue' ? 'text-amber-400' : 'text-[#4ADE80]'
                  }`}
                />
                <span>
                  {phase === 'suspending_queue'
                    ? 'Cerrando procesos de juego y vaciando cola DirectX/Vulkan...'
                    : 'Procesos en dGPU liberados'}
                </span>
              </div>

              <div className="flex items-center gap-2 text-slate-200">
                <CheckCircle2
                  className={`h-4 w-4 shrink-0 ${
                    phase === 'releasing_io'
                      ? 'text-amber-400'
                      : phase === 'ejecting_pcie'
                        ? 'text-[#4ADE80]'
                        : 'text-slate-600'
                  }`}
                />
                <span>
                  {phase === 'releasing_io'
                    ? 'Desmontando hub USB, Ethernet y migrando salida de pantalla...'
                    : phase === 'ejecting_pcie'
                      ? 'Periféricos I/O y pantalla migrados a Ally X'
                      : 'Desmontar hub I/O y pantalla externa'}
                </span>
              </div>

              <div className="flex items-center gap-2 text-slate-200">
                <CheckCircle2
                  className={`h-4 w-4 shrink-0 ${
                    phase === 'ejecting_pcie' ? 'text-amber-400' : 'text-slate-600'
                  }`}
                />
                <span>
                  {phase === 'ejecting_pcie'
                    ? `Expulsando nodo ${model.interfaceType} (${model.pnpHardwareId})...`
                    : `Expulsar adaptador ${model.interfaceType}`}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Confirmation Dialog inside Widget when active processes block undocking */}
        {phase === 'confirm_processes' && (
          <div className="rounded-lg border border-amber-500/40 bg-[#1B1812] p-4 space-y-3">
            <div className="flex items-start gap-3">
              <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-400" />
              <div className="min-w-0 flex-1 space-y-1">
                <h3 className="font-display text-sm font-semibold text-white">
                  Hay {blockersCount} {blockersCount === 1 ? 'aplicación usando' : 'aplicaciones usando'} la XG Mobile
                </h3>
                <p className="text-xs leading-relaxed text-slate-300">
                  Desacoplar con un juego o captura activa puede congelar el sistema. Puedes cerrar
                  limpiamente estos procesos ahora sin salir del Modo Juego Xbox.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={onCancelUndock}
                className="inline-flex min-h-[38px] items-center gap-1.5 rounded-md border border-white/[0.12] bg-[#1A202B] px-3.5 py-2 text-xs font-medium text-slate-200 transition-colors hover:bg-[#232B39] whitespace-nowrap shrink-0"
              >
                <span>Cancelar (B)</span>
              </button>
              <button
                type="button"
                onClick={onConfirmUndock}
                className="inline-flex min-h-[38px] items-center gap-1.5 rounded-md bg-[#16A34A] px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-[#15803D] whitespace-nowrap shrink-0"
              >
                <Power className="h-3.5 w-3.5" />
                <span>Cerrar procesos y desacoplar</span>
              </button>
            </div>
          </div>
        )}

        {/* Core Telemetry Grid (shown whenever connected) */}
        {isConnected && (
          <>
            <div
              className={`grid gap-2.5 ${
                isCompact ? 'grid-cols-2' : 'grid-cols-2 sm:grid-cols-3'
              }`}
            >
              <div className="rounded-lg border border-white/[0.07] bg-[#171C24] px-3 py-2.5">
                <div className="flex items-center justify-between text-[11px] text-slate-400">
                  <span>Uso eGPU</span>
                  <Cpu className="h-3.5 w-3.5 text-slate-500" />
                </div>
                <div className="mt-1 font-mono text-xl font-semibold tabular-nums text-white">
                  {telemetry.gpuLoad}%
                </div>
                <div className="mt-0.5 text-[11px] font-mono tabular-nums text-slate-400">
                  iGPU Ally: {telemetry.igpuLoad}%
                </div>
              </div>

              <div className="rounded-lg border border-white/[0.07] bg-[#171C24] px-3 py-2.5">
                <div className="flex items-center justify-between text-[11px] text-slate-400">
                  <span>Temperatura</span>
                  <Thermometer
                    className={`h-3.5 w-3.5 ${tempWarning ? 'text-rose-400' : 'text-slate-500'}`}
                  />
                </div>
                <div
                  className={`mt-1 font-mono text-xl font-semibold tabular-nums ${
                    tempWarning ? 'text-rose-400' : 'text-white'
                  }`}
                >
                  {telemetry.gpuTempC}°C
                </div>
                <div className="mt-0.5 text-[11px] font-mono tabular-nums text-slate-400">
                  Hotspot: {telemetry.hotspotTempC}°C
                </div>
              </div>

              <div className="rounded-lg border border-white/[0.07] bg-[#171C24] px-3 py-2.5">
                <div className="flex items-center justify-between text-[11px] text-slate-400">
                  <span>Consumo TGP</span>
                  <Zap className="h-3.5 w-3.5 text-slate-500" />
                </div>
                <div className="mt-1 font-mono text-xl font-semibold tabular-nums text-white">
                  {telemetry.tgpWatts} W
                </div>
                <div className="mt-0.5 text-[11px] font-mono tabular-nums text-slate-400">
                  Máx: {model.maxTgpWatts} W
                </div>
              </div>

              <div className="rounded-lg border border-white/[0.07] bg-[#171C24] px-3 py-2.5">
                <div className="flex items-center justify-between text-[11px] text-slate-400">
                  <span>VRAM {model.vramType}</span>
                  <HardDrive className="h-3.5 w-3.5 text-slate-500" />
                </div>
                <div className="mt-1 font-mono text-xl font-semibold tabular-nums text-white">
                  {telemetry.vramUsedGb.toFixed(1)} GB
                </div>
                <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-white/[0.08]">
                  <div
                    className="h-full bg-[#16A34A] transition-transform duration-200 origin-left"
                    style={{ transform: `scaleX(${vramPercent / 100})` }}
                  />
                </div>
              </div>

              {!isCompact && (
                <>
                  <div className="rounded-lg border border-white/[0.07] bg-[#171C24] px-3 py-2.5">
                    <div className="flex items-center justify-between text-[11px] text-slate-400">
                      <span>Frecuencia Núcleo</span>
                    </div>
                    <div className="mt-1 font-mono text-xl font-semibold tabular-nums text-white">
                      {telemetry.coreClockMhz} MHz
                    </div>
                    <div className="mt-0.5 text-[11px] font-mono tabular-nums text-slate-400">
                      Mem: {telemetry.memoryClockMhz} MHz
                    </div>
                  </div>

                  <div className="rounded-lg border border-white/[0.07] bg-[#171C24] px-3 py-2.5">
                    <div className="flex items-center justify-between text-[11px] text-slate-400">
                      <span>Ventilación</span>
                      <Fan className="h-3.5 w-3.5 text-slate-500" />
                    </div>
                    <div className="mt-1 font-mono text-xl font-semibold tabular-nums text-white">
                      {telemetry.fanRpm} RPM
                    </div>
                    <div className="mt-0.5 text-[11px] font-mono tabular-nums text-slate-400">
                      Curva al {telemetry.fanPercent}%
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* Game Graphics Profile Strip (Handheld vs eGPU) */}
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-white/[0.07] bg-[#0F1319] px-3 py-2.5 text-xs">
              <div className="min-w-0">
                <div className="font-medium text-white truncate">
                  {activeGame.title} · Ajustes {activeGame.lastAppliedMode === 'egpu' ? 'eGPU' : 'Handheld'}
                </div>
                <div className="mt-0.5 font-mono text-[11px] tabular-nums text-slate-400 truncate">
                  {activeSettings.resolution} · {activeSettings.preset} · {activeSettings.upscaler} ·{' '}
                  {activeSettings.fpsCap} FPS · {activeSettings.allyTdpWatts}W
                </div>
              </div>

              <div className="inline-flex items-center gap-1 rounded-md bg-[#171D26] p-0.5 shrink-0">
                <button
                  type="button"
                  onClick={() => onApplyGameMode(activeGame.id, 'handheld')}
                  className={`rounded px-2.5 py-1 text-[11px] font-medium transition-colors whitespace-nowrap shrink-0 ${
                    activeGame.lastAppliedMode === 'handheld'
                      ? 'bg-[#1D2430] text-white'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Handheld
                </button>
                <button
                  type="button"
                  onClick={() => onApplyGameMode(activeGame.id, 'egpu')}
                  className={`rounded px-2.5 py-1 text-[11px] font-medium transition-colors whitespace-nowrap shrink-0 ${
                    activeGame.lastAppliedMode === 'egpu'
                      ? 'bg-[#16A34A] text-white'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  eGPU
                </button>
              </div>
            </div>

            {/* Expanded Details: Display / Dock I/O + Active Processes */}
            {!isCompact && (
              <div className="space-y-3 border-t border-white/[0.08] pt-3">
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-300">
                  <div className="flex items-center gap-2">
                    <Monitor className="h-3.5 w-3.5 text-slate-400" />
                    <span>
                      Salida:{' '}
                      <strong className="font-medium text-white">
                        {telemetry.externalDisplayConnected
                          ? `Monitor externo (${telemetry.externalDisplayRes})`
                          : 'Pantalla integrada Ally X'}
                      </strong>
                    </span>
                  </div>
                  <div className="font-mono text-xs tabular-nums text-slate-400">
                    LAN {telemetry.ethernetLinkMbps} Mbps · {telemetry.usbDevicesCount} USB activos
                  </div>
                </div>

                {/* Processes Table */}
                <div>
                  <div className="mb-1.5 flex items-center justify-between">
                    <span className="text-xs font-medium text-slate-300">
                      Procesos activos en la eGPU
                    </span>
                    <span className="font-mono text-[11px] tabular-nums text-slate-400">
                      {processes.length} en cola
                    </span>
                  </div>

                  {processes.length === 0 ? (
                    <div className="rounded-md border border-white/[0.06] bg-[#0F1319] px-3 py-2.5 text-xs text-slate-400">
                      Sin procesos bloqueantes. Listo para desacoplar inmediatamente.
                    </div>
                  ) : (
                    <div className="divide-y divide-white/[0.06] rounded-md border border-white/[0.08] bg-[#0F1319]">
                      {processes.map((proc) => (
                        <div
                          key={proc.pid}
                          className="flex h-10 items-center justify-between gap-3 px-3 text-xs hover:bg-white/[0.02]"
                        >
                          <div className="min-w-0 flex-1 truncate">
                            <span className="font-medium text-slate-200">{proc.displayName}</span>
                            <span className="ml-2 font-mono text-[11px] text-slate-500">
                              {proc.name} · PID {proc.pid}
                            </span>
                          </div>
                          <div className="flex items-center gap-3 shrink-0">
                            <span className="font-mono text-[11px] tabular-nums text-slate-300">
                              {proc.gpuPercent}% · {proc.vramMb} MB
                            </span>
                            {proc.canSafeClose ? (
                              <button
                                type="button"
                                onClick={() => onCloseProcess(proc.pid)}
                                title={`Liberar ${proc.name}`}
                                className="inline-flex h-7 items-center gap-1 rounded border border-white/[0.1] bg-[#1A202B] px-2 text-[11px] font-medium text-slate-200 transition-colors hover:border-rose-500/40 hover:bg-rose-500/10 hover:text-rose-200 whitespace-nowrap shrink-0"
                              >
                                <X className="h-3 w-3" />
                                <span>Liberar</span>
                              </button>
                            ) : (
                              <span className="font-mono text-[11px] text-slate-500">
                                Sistema
                              </span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Footer Action Bar */}
      {isConnected && (
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/[0.08] bg-[#0F1319] px-4 py-3 rounded-b-xl">
          <div className="text-xs text-slate-400">
            {blockersCount > 0
              ? `${blockersCount} ${blockersCount === 1 ? 'proceso bloqueante' : 'procesos bloqueantes'} · Pulsa X para desacoplar`
              : 'Cola limpia · Pulsa X para desacoplar al instante'}
          </div>

          <button
            type="button"
            onClick={onStartUndock}
            disabled={phase === 'confirm_processes'}
            className="inline-flex min-h-[40px] items-center gap-2 rounded-md bg-[#16A34A] px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-[#15803D] disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#16A34A] whitespace-nowrap shrink-0"
          >
            <Unplug className="h-4 w-4" />
            <span>Desacoplar eGPU (X)</span>
          </button>
        </div>
      )}
    </section>
  );
};
