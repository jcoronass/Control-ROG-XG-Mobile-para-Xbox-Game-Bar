export type XGMobileModelId =
  | 'rtx-5090-tb5'
  | 'rtx-4090-gc33y'
  | 'rx-6850m-gc32l'
  | 'rtx-3080-gc31s';

export type PowerProfile = 'Silencioso' | 'Rendimiento' | 'Turbo';

export type UndockPhase =
  | 'connected'
  | 'preflight'
  | 'confirm_processes'
  | 'suspending_queue'
  | 'releasing_io'
  | 'ejecting_pcie'
  | 'safe_to_unplug'
  | 'unplugged';

export type WidgetSizeMode = 'compact' | 'expanded';

export type ActiveWorkspaceTab = 'widget' | 'code' | 'guide';

export type ScenarioId = 'gaming_aaa' | 'xbox_idle' | 'external_display' | 'undocked';

export type GameHardwareMode = 'egpu' | 'handheld';

export interface GameGraphicsSettings {
  resolution: string;
  preset: 'Bajo' | 'Medio' | 'Alto' | 'Ultra';
  upscaler: string;
  fpsCap: number;
  allyTdpWatts: number;
  hdrEnabled: boolean;
}

export interface GameProfileEntry {
  id: string;
  title: string;
  executableName: string;
  configPath: string;
  autoSwitchOnUndock: boolean;
  lastAppliedMode: GameHardwareMode;
  handheld: GameGraphicsSettings;
  egpu: GameGraphicsSettings;
}

export interface XGMobileSpec {
  id: XGMobileModelId;
  name: string;
  shortName: string;
  gpuChip: string;
  vendor: 'NVIDIA' | 'AMD';
  vramTotalGb: number;
  vramType: string;
  maxTgpWatts: number;
  adapterWatts: number;
  pdOutputWatts: number;
  interfaceType: string;
  bandwidthLabel: string;
  ports: string[];
  pnpHardwareId: string;
}

export interface GpuProcess {
  pid: number;
  name: string;
  displayName: string;
  category: 'Juego' | 'Sistema' | 'Captura' | 'Utilidad';
  vramMb: number;
  gpuPercent: number;
  canSafeClose: boolean;
  requiresForceWarning?: boolean;
}

export interface TelemetrySnapshot {
  gpuLoad: number;
  gpuTempC: number;
  hotspotTempC: number;
  coreClockMhz: number;
  memoryClockMhz: number;
  tgpWatts: number;
  vramUsedGb: number;
  fanRpm: number;
  fanPercent: number;
  pcieLinkGbps: number;
  pdChargingWatts: number;
  igpuLoad: number;
  allyBatteryPercent: number;
  externalDisplayConnected: boolean;
  externalDisplayRes: string;
  ethernetLinkMbps: number;
  usbDevicesCount: number;
}
