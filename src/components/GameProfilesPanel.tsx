import React, { useState } from 'react';
import {
  Check,
  FolderCog,
  Gamepad2,
  Monitor,
  Plus,
  RotateCcw,
  Trash2,
} from 'lucide-react';
import {
  GameGraphicsSettings,
  GameHardwareMode,
  GameProfileEntry,
  UndockPhase,
} from '../types/xgmobile';

interface GameProfilesPanelProps {
  profiles: GameProfileEntry[];
  selectedGameId: string;
  onSelectGame: (id: string) => void;
  onUpdateGame: (updated: GameProfileEntry) => void;
  onAddGame: (entry: GameProfileEntry) => void;
  onDeleteGame: (id: string) => void;
  onApplyModeToGame: (gameId: string, mode: GameHardwareMode) => void;
  onResetDefaults: () => void;
  phase: UndockPhase;
  lastSyncMessage: string | null;
}

const RESOLUTIONS = [
  '1280 × 720',
  '1600 × 900',
  '1920 × 1080',
  '2560 × 1440',
  '3840 × 2160',
];

const PRESETS: GameGraphicsSettings['preset'][] = ['Bajo', 'Medio', 'Alto', 'Ultra'];

export const GameProfilesPanel: React.FC<GameProfilesPanelProps> = ({
  profiles,
  selectedGameId,
  onSelectGame,
  onUpdateGame,
  onAddGame,
  onDeleteGame,
  onApplyModeToGame,
  onResetDefaults,
  phase,
  lastSyncMessage,
}) => {
  const [showAddForm, setShowAddForm] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newExe, setNewExe] = useState('');
  const [newPath, setNewPath] = useState('');

  const activeGame = profiles.find((g) => g.id === selectedGameId) ?? profiles[0];
  const isEgpuAvailable = phase === 'connected';

  const handleFieldChange = (
    mode: GameHardwareMode,
    patch: Partial<GameGraphicsSettings>,
  ) => {
    if (!activeGame) return;
    onUpdateGame({
      ...activeGame,
      [mode]: {
        ...activeGame[mode],
        ...patch,
      },
    });
  };

  const handleCreateGame = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanTitle = newTitle.trim();
    if (!cleanTitle) return;

    const slug = cleanTitle
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');

    const created: GameProfileEntry = {
      id: `${slug || 'juego'}-${Date.now().toString().slice(-4)}`,
      title: cleanTitle,
      executableName: newExe.trim() || `${cleanTitle.replace(/\s+/g, '')}.exe`,
      configPath:
        newPath.trim() ||
        `%LOCALAPPDATA%\\${cleanTitle.replace(/\s+/g, '')}\\Saved\\Config\\Windows\\GameUserSettings.ini`,
      autoSwitchOnUndock: true,
      lastAppliedMode: isEgpuAvailable ? 'egpu' : 'handheld',
      handheld: {
        resolution: '1600 × 900',
        preset: 'Medio',
        upscaler: 'FSR 3 Equilibrado',
        fpsCap: 45,
        allyTdpWatts: 17,
        hdrEnabled: false,
      },
      egpu: {
        resolution: '3840 × 2160',
        preset: 'Ultra',
        upscaler: 'DLSS Calidad',
        fpsCap: 120,
        allyTdpWatts: 25,
        hdrEnabled: true,
      },
    };

    onAddGame(created);
    onSelectGame(created.id);
    setNewTitle('');
    setNewExe('');
    setNewPath('');
    setShowAddForm(false);
  };

  if (!activeGame) return null;

  return (
    <section
      aria-label="Perfiles de ajustes por juego Handheld y eGPU"
      className="rounded-xl border border-white/[0.08] bg-[#14181F] p-5 sm:p-6 space-y-5"
    >
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-white/[0.08] pb-4">
        <div className="space-y-1">
          <h2 className="font-display text-lg font-semibold text-white">
            Ajustes de juego separados: Handheld vs eGPU XG Mobile
          </h2>
          <p className="text-xs leading-relaxed text-slate-400 max-w-2xl">
            Al acoplar o desacoplar la XG Mobile desde la Game Bar, el puente PowerShell
            respalda el archivo de configuración actual e intercambia automáticamente entre tu
            copia <span className="font-mono text-slate-200">.handheld.bak</span> y{' '}
            <span className="font-mono text-slate-200">.egpu.bak</span> antes de abrir el juego.
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => setShowAddForm((v) => !v)}
            className="inline-flex h-9 items-center gap-1.5 rounded-md border border-white/[0.12] bg-[#1A202B] px-3 text-xs font-medium text-slate-200 transition-colors hover:bg-[#232B39] whitespace-nowrap shrink-0"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>{showAddForm ? 'Cerrar' : 'Añadir juego'}</span>
          </button>
          <button
            type="button"
            onClick={onResetDefaults}
            title="Restaurar juegos de ejemplo"
            className="inline-flex h-9 items-center gap-1.5 rounded-md border border-white/[0.08] bg-[#0F1319] px-3 text-xs font-medium text-slate-400 transition-colors hover:text-slate-200 whitespace-nowrap shrink-0"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            <span>Restaurar</span>
          </button>
        </div>
      </div>

      {/* Add Custom Game Form */}
      {showAddForm && (
        <form
          onSubmit={handleCreateGame}
          className="grid grid-cols-1 gap-3 rounded-lg border border-white/[0.08] bg-[#0F1319] p-4 md:grid-cols-4 items-end"
        >
          <div className="space-y-1">
            <label htmlFor="new-game-title" className="block text-[11px] font-medium text-slate-400">
              Nombre del juego
            </label>
            <input
              id="new-game-title"
              type="text"
              required
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              placeholder="Ej. Elden Ring"
              className="h-9 w-full rounded-md border border-white/[0.1] bg-[#14181F] px-3 text-xs text-white placeholder:text-slate-500 focus:border-[#16A34A] focus:outline-none"
            />
          </div>
          <div className="space-y-1">
            <label htmlFor="new-game-exe" className="block text-[11px] font-medium text-slate-400">
              Ejecutable (.exe)
            </label>
            <input
              id="new-game-exe"
              type="text"
              value={newExe}
              onChange={(e) => setNewExe(e.target.value)}
              placeholder="eldenring.exe"
              className="h-9 w-full rounded-md border border-white/[0.1] bg-[#14181F] px-3 font-mono text-xs text-white placeholder:text-slate-500 focus:border-[#16A34A] focus:outline-none"
            />
          </div>
          <div className="space-y-1">
            <label htmlFor="new-game-path" className="block text-[11px] font-medium text-slate-400">
              Archivo de config Windows
            </label>
            <input
              id="new-game-path"
              type="text"
              value={newPath}
              onChange={(e) => setNewPath(e.target.value)}
              placeholder="%APPDATA%\EldenRing\GraphicsConfig.xml"
              className="h-9 w-full rounded-md border border-white/[0.1] bg-[#14181F] px-3 font-mono text-xs text-white placeholder:text-slate-500 focus:border-[#16A34A] focus:outline-none"
            />
          </div>
          <button
            type="submit"
            className="h-9 rounded-md bg-[#16A34A] px-4 text-xs font-semibold text-white transition-colors hover:bg-[#15803D] whitespace-nowrap shrink-0"
          >
            Guardar juego
          </button>
        </form>
      )}

      {/* Game Selector Tabs + Auto-Swap Status */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-1.5 rounded-lg bg-[#0F1319] p-1 border border-white/[0.08]">
          {profiles.map((game) => {
            const active = game.id === activeGame.id;
            return (
              <button
                key={game.id}
                type="button"
                onClick={() => onSelectGame(game.id)}
                className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                  active
                    ? 'bg-[#1D2430] text-white'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {game.title}
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-4">
          <label className="inline-flex cursor-pointer items-center gap-2 text-xs text-slate-300">
            <input
              type="checkbox"
              checked={activeGame.autoSwitchOnUndock}
              onChange={(e) =>
                onUpdateGame({ ...activeGame, autoSwitchOnUndock: e.target.checked })
              }
              className="h-4 w-4 rounded border-white/20 bg-[#0C0E12] accent-[#16A34A]"
            />
            <span>Intercambiar archivo automáticamente al desacoplar</span>
          </label>

          {profiles.length > 1 && (
            <button
              type="button"
              onClick={() => onDeleteGame(activeGame.id)}
              title={`Eliminar ${activeGame.title}`}
              className="inline-flex h-8 items-center gap-1 rounded border border-white/[0.08] bg-[#0F1319] px-2.5 text-xs text-slate-400 transition-colors hover:border-rose-500/40 hover:text-rose-300 whitespace-nowrap shrink-0"
            >
              <Trash2 className="h-3.5 w-3.5" />
              <span>Quitar</span>
            </button>
          )}
        </div>
      </div>

      {/* Config Path & Live Sync Banner */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-white/[0.07] bg-[#0F1319] px-3.5 py-2.5 text-xs">
        <div className="flex min-w-0 items-center gap-2 text-slate-300">
          <FolderCog className="h-4 w-4 shrink-0 text-slate-400" />
          <span className="truncate font-mono text-[11px] text-slate-300">
            {activeGame.configPath}
          </span>
        </div>

        <div className="font-mono text-[11px] text-slate-400 shrink-0">
          Perfil activo en disco:{' '}
          <span className="font-semibold text-white">
            {activeGame.lastAppliedMode === 'egpu'
              ? 'eGPU (.egpu.bak)'
              : 'Handheld (.handheld.bak)'}
          </span>
        </div>
      </div>

      {lastSyncMessage && (
        <div className="flex items-center gap-2 rounded-md border border-[#16A34A]/35 bg-[#16A34A]/10 px-3.5 py-2 text-xs text-[#86EFAC]">
          <Check className="h-4 w-4 shrink-0" />
          <span>{lastSyncMessage}</span>
        </div>
      )}

      {/* Side-by-side Handheld vs eGPU Editors */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Modo Handheld */}
        <div
          className={`rounded-lg border p-4 space-y-4 transition-colors ${
            activeGame.lastAppliedMode === 'handheld'
              ? 'border-[#16A34A]/60 bg-[#0F1319]'
              : 'border-white/[0.08] bg-[#0F1319]'
          }`}
        >
          <div className="flex items-center justify-between gap-2 border-b border-white/[0.06] pb-3">
            <div className="flex items-center gap-2">
              <Gamepad2 className="h-4 w-4 text-slate-300" />
              <div>
                <h3 className="font-display text-sm font-semibold text-white">
                  Modo Handheld (Sin eGPU)
                </h3>
                <p className="text-[11px] text-slate-400">
                  iGPU Radeon 890M · Pantalla 7&quot; portátil
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => onApplyModeToGame(activeGame.id, 'handheld')}
              className={`inline-flex h-8 items-center gap-1.5 rounded px-3 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                activeGame.lastAppliedMode === 'handheld'
                  ? 'bg-[#16A34A] text-white'
                  : 'border border-white/[0.12] bg-[#1A202B] text-slate-200 hover:bg-[#232B39]'
              }`}
            >
              {activeGame.lastAppliedMode === 'handheld' ? 'Activo en disco' : 'Aplicar Handheld'}
            </button>
          </div>

          <div className="grid grid-cols-2 gap-3 text-xs">
            <div className="space-y-1">
              <label className="block text-[11px] text-slate-400">Resolución</label>
              <select
                value={activeGame.handheld.resolution}
                onChange={(e) =>
                  handleFieldChange('handheld', { resolution: e.target.value })
                }
                className="h-9 w-full rounded border border-white/[0.1] bg-[#14181F] px-2.5 font-mono text-xs text-white focus:border-[#16A34A] focus:outline-none"
              >
                {RESOLUTIONS.map((res) => (
                  <option key={res} value={res}>
                    {res}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <label className="block text-[11px] text-slate-400">Calidad gráfica</label>
              <select
                value={activeGame.handheld.preset}
                onChange={(e) =>
                  handleFieldChange('handheld', {
                    preset: e.target.value as GameGraphicsSettings['preset'],
                  })
                }
                className="h-9 w-full rounded border border-white/[0.1] bg-[#14181F] px-2.5 text-xs text-white focus:border-[#16A34A] focus:outline-none"
              >
                {PRESETS.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <label className="block text-[11px] text-slate-400">Escalado</label>
              <input
                type="text"
                value={activeGame.handheld.upscaler}
                onChange={(e) =>
                  handleFieldChange('handheld', { upscaler: e.target.value })
                }
                className="h-9 w-full rounded border border-white/[0.1] bg-[#14181F] px-2.5 text-xs text-white focus:border-[#16A34A] focus:outline-none"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <label className="block text-[11px] text-slate-400">Límite FPS</label>
                <input
                  type="number"
                  min={24}
                  max={120}
                  value={activeGame.handheld.fpsCap}
                  onChange={(e) =>
                    handleFieldChange('handheld', {
                      fpsCap: Number(e.target.value) || 45,
                    })
                  }
                  className="h-9 w-full rounded border border-white/[0.1] bg-[#14181F] px-2.5 font-mono tabular-nums text-xs text-white focus:border-[#16A34A] focus:outline-none"
                />
              </div>

              <div className="space-y-1">
                <label className="block text-[11px] text-slate-400">TDP (W)</label>
                <input
                  type="number"
                  min={10}
                  max={30}
                  value={activeGame.handheld.allyTdpWatts}
                  onChange={(e) =>
                    handleFieldChange('handheld', {
                      allyTdpWatts: Number(e.target.value) || 17,
                    })
                  }
                  className="h-9 w-full rounded border border-white/[0.1] bg-[#14181F] px-2.5 font-mono tabular-nums text-xs text-white focus:border-[#16A34A] focus:outline-none"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Modo eGPU XG Mobile */}
        <div
          className={`rounded-lg border p-4 space-y-4 transition-colors ${
            activeGame.lastAppliedMode === 'egpu'
              ? 'border-[#16A34A]/60 bg-[#0F1319]'
              : 'border-white/[0.08] bg-[#0F1319]'
          }`}
        >
          <div className="flex items-center justify-between gap-2 border-b border-white/[0.06] pb-3">
            <div className="flex items-center gap-2">
              <Monitor className="h-4 w-4 text-slate-300" />
              <div>
                <h3 className="font-display text-sm font-semibold text-white">
                  Modo eGPU (XG Mobile acoplada)
                </h3>
                <p className="text-[11px] text-slate-400">
                  Renderizado en GPU dedicada · Monitor externo / 120Hz+
                </p>
              </div>
            </div>

            <button
              type="button"
              disabled={!isEgpuAvailable}
              onClick={() => onApplyModeToGame(activeGame.id, 'egpu')}
              className={`inline-flex h-8 items-center gap-1.5 rounded px-3 text-xs font-medium transition-colors whitespace-nowrap shrink-0 disabled:cursor-not-allowed disabled:opacity-45 ${
                activeGame.lastAppliedMode === 'egpu'
                  ? 'bg-[#16A34A] text-white'
                  : 'border border-white/[0.12] bg-[#1A202B] text-slate-200 hover:bg-[#232B39]'
              }`}
            >
              {activeGame.lastAppliedMode === 'egpu' ? 'Activo en disco' : 'Aplicar eGPU'}
            </button>
          </div>

          <div className="grid grid-cols-2 gap-3 text-xs">
            <div className="space-y-1">
              <label className="block text-[11px] text-slate-400">Resolución</label>
              <select
                value={activeGame.egpu.resolution}
                onChange={(e) =>
                  handleFieldChange('egpu', { resolution: e.target.value })
                }
                className="h-9 w-full rounded border border-white/[0.1] bg-[#14181F] px-2.5 font-mono text-xs text-white focus:border-[#16A34A] focus:outline-none"
              >
                {RESOLUTIONS.map((res) => (
                  <option key={res} value={res}>
                    {res}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <label className="block text-[11px] text-slate-400">Calidad gráfica</label>
              <select
                value={activeGame.egpu.preset}
                onChange={(e) =>
                  handleFieldChange('egpu', {
                    preset: e.target.value as GameGraphicsSettings['preset'],
                  })
                }
                className="h-9 w-full rounded border border-white/[0.1] bg-[#14181F] px-2.5 text-xs text-white focus:border-[#16A34A] focus:outline-none"
              >
                {PRESETS.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <label className="block text-[11px] text-slate-400">Escalado</label>
              <input
                type="text"
                value={activeGame.egpu.upscaler}
                onChange={(e) =>
                  handleFieldChange('egpu', { upscaler: e.target.value })
                }
                className="h-9 w-full rounded border border-white/[0.1] bg-[#14181F] px-2.5 text-xs text-white focus:border-[#16A34A] focus:outline-none"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <label className="block text-[11px] text-slate-400">Límite FPS</label>
                <input
                  type="number"
                  min={30}
                  max={240}
                  value={activeGame.egpu.fpsCap}
                  onChange={(e) =>
                    handleFieldChange('egpu', {
                      fpsCap: Number(e.target.value) || 120,
                    })
                  }
                  className="h-9 w-full rounded border border-white/[0.1] bg-[#14181F] px-2.5 font-mono tabular-nums text-xs text-white focus:border-[#16A34A] focus:outline-none"
                />
              </div>

              <div className="space-y-1">
                <label className="block text-[11px] text-slate-400">TDP (W)</label>
                <input
                  type="number"
                  min={15}
                  max={35}
                  value={activeGame.egpu.allyTdpWatts}
                  onChange={(e) =>
                    handleFieldChange('egpu', {
                      allyTdpWatts: Number(e.target.value) || 25,
                    })
                  }
                  className="h-9 w-full rounded border border-white/[0.1] bg-[#14181F] px-2.5 font-mono tabular-nums text-xs text-white focus:border-[#16A34A] focus:outline-none"
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
