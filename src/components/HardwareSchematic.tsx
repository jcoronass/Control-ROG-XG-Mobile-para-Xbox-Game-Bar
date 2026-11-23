import React from 'react';
import { TelemetrySnapshot, UndockPhase, XGMobileSpec } from '../types/xgmobile';

interface HardwareSchematicProps {
  model: XGMobileSpec;
  telemetry: TelemetrySnapshot;
  phase: UndockPhase;
}

export const HardwareSchematic: React.FC<HardwareSchematicProps> = ({
  model,
  telemetry,
  phase,
}) => {
  const isConnected = phase === 'connected' || phase === 'preflight' || phase === 'confirm_processes';
  const isTransitioning =
    phase === 'suspending_queue' || phase === 'releasing_io' || phase === 'ejecting_pcie';
  const isSafeOrUnplugged = phase === 'safe_to_unplug' || phase === 'unplugged';

  const linkStroke = isConnected
    ? '#16A34A'
    : isTransitioning
      ? '#D97706'
      : '#334155';

  const linkText = isConnected
    ? `${telemetry.pcieLinkGbps.toFixed(1)} Gbps · ${telemetry.pdChargingWatts}W PD`
    : isTransitioning
      ? 'Desconectando enlace...'
      : 'Enlace liberado';

  return (
    <div className="rounded-lg border border-white/[0.08] bg-[#14181F] p-4">
      <div className="mb-3 flex items-center justify-between gap-4">
        <span className="text-xs font-medium text-slate-400">
          Topología de enlace en tiempo real
        </span>
        <span className="font-mono text-xs tabular-nums text-slate-300">
          {linkText}
        </span>
      </div>

      <svg
        viewBox="0 0 620 112"
        className="w-full h-auto"
        role="img"
        aria-label="Esquema de conexión entre ASUS ROG Xbox Ally X y ROG XG Mobile"
      >
        {/* Host: ROG Xbox Ally X */}
        <rect
          x="4"
          y="14"
          width="176"
          height="84"
          rx="8"
          fill="#0F1319"
          stroke={isSafeOrUnplugged ? '#16A34A' : '#2A3342'}
          strokeWidth="1.5"
        />
        <text x="18" y="38" fill="#F8FAFC" fontSize="12" fontWeight="600" fontFamily="Outfit, sans-serif">
          ROG Xbox Ally X
        </text>
        <text x="18" y="56" fill="#94A3B8" fontSize="10.5" fontFamily="Plus Jakarta Sans, sans-serif">
          iGPU Radeon 890M · {telemetry.igpuLoad}%
        </text>
        <text x="18" y="74" fill="#CBD5E1" fontSize="10.5" fontFamily="JetBrains Mono, monospace">
          Batería {telemetry.allyBatteryPercent}% {isConnected ? '· AC PD' : '· Portátil'}
        </text>

        {/* Link Bridge */}
        <line
          x1="180"
          y1="56"
          x2="256"
          y2="56"
          stroke={linkStroke}
          strokeWidth="2.5"
          strokeDasharray={isTransitioning ? '5 4' : isSafeOrUnplugged ? '2 5' : undefined}
        />
        <rect
          x="192"
          y="38"
          width="52"
          height="16"
          rx="3"
          fill="#0C0E12"
          stroke={linkStroke}
          strokeWidth="1"
        />
        <text
          x="218"
          y="49"
          textAnchor="middle"
          fill={isConnected ? '#86EFAC' : isTransitioning ? '#FCD34D' : '#64748B'}
          fontSize="9"
          fontFamily="JetBrains Mono, monospace"
        >
          {isConnected ? 'ACTIVO' : isTransitioning ? 'PAUSA' : 'LIBRE'}
        </text>

        {/* eGPU: ROG XG Mobile */}
        <rect
          x="256"
          y="14"
          width="196"
          height="84"
          rx="8"
          fill="#0F1319"
          stroke={isConnected ? '#16A34A' : isTransitioning ? '#D97706' : '#232A36'}
          strokeWidth="1.5"
          opacity={isSafeOrUnplugged ? 0.55 : 1}
        />
        <text x="270" y="38" fill="#F8FAFC" fontSize="12" fontWeight="600" fontFamily="Outfit, sans-serif">
          {model.shortName}
        </text>
        <text x="270" y="56" fill="#94A3B8" fontSize="10.5" fontFamily="Plus Jakarta Sans, sans-serif">
          {model.interfaceType}
        </text>
        <text x="270" y="74" fill="#CBD5E1" fontSize="10.5" fontFamily="JetBrains Mono, monospace">
          {isConnected
            ? `${telemetry.gpuLoad}% carga · ${telemetry.tgpWatts}W · ${telemetry.gpuTempC}°C`
            : phase === 'safe_to_unplug'
              ? 'Seguro retirar cable'
              : 'Bus PCIe desconectado'}
        </text>

        {/* External I/O Bridge */}
        <line
          x1="452"
          y1="56"
          x2="486"
          y2="56"
          stroke={isConnected && telemetry.externalDisplayConnected ? '#475569' : '#1E2530'}
          strokeWidth="1.5"
          strokeDasharray={isSafeOrUnplugged ? '3 4' : undefined}
        />

        {/* Dock Peripherals */}
        <rect
          x="486"
          y="14"
          width="130"
          height="84"
          rx="8"
          fill="#0F1319"
          stroke="#232A36"
          strokeWidth="1.25"
          opacity={isSafeOrUnplugged ? 0.45 : 1}
        />
        <text x="500" y="38" fill="#E2E8F0" fontSize="11.5" fontWeight="600" fontFamily="Outfit, sans-serif">
          Salidas Dock I/O
        </text>
        <text x="500" y="56" fill="#94A3B8" fontSize="10" fontFamily="Plus Jakarta Sans, sans-serif">
          {telemetry.externalDisplayConnected && isConnected ? 'Monitor DP/HDMI' : 'Pantalla interna'}
        </text>
        <text x="500" y="74" fill="#94A3B8" fontSize="10" fontFamily="JetBrains Mono, monospace">
          {isConnected
            ? `${telemetry.ethernetLinkMbps > 0 ? '2.5G LAN' : 'Sin LAN'} · ${telemetry.usbDevicesCount} USB`
            : 'I/O liberado'}
        </text>
      </svg>
    </div>
  );
};
