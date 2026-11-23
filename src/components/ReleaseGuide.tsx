import React from 'react';
import { FolderArchive, GitBranch, PackageCheck, Terminal } from 'lucide-react';

interface ReleaseGuideProps {
  onDownloadZip: () => void;
}

export const ReleaseGuide: React.FC<ReleaseGuideProps> = ({ onDownloadZip }) => {
  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-white/[0.08] pb-5">
        <div className="space-y-1.5">
          <h2 className="font-display text-2xl font-semibold text-white">
            Release automática Beta 0.0.1 y depuración con Win + G
          </h2>
          <p className="text-sm text-slate-400">
            Cómo publicar el MSIX desde GitHub, instalarlo con doble clic en tu consola Ryzen Z2
            Extreme y depurarlo en Visual Studio 2022.
          </p>
        </div>

        <button
          type="button"
          onClick={onDownloadZip}
          className="inline-flex min-h-[40px] items-center gap-2 rounded-md bg-[#16A34A] px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-[#15803D] whitespace-nowrap shrink-0"
        >
          <FolderArchive className="h-4 w-4" />
          <span>Descargar solución (.zip)</span>
        </button>
      </div>

      <div className="rounded-lg border border-white/[0.08] bg-[#14181F] p-5 space-y-3">
        <div className="flex items-center gap-2.5">
          <GitBranch className="h-4 w-4 text-[#4ADE80]" />
          <h3 className="font-display text-base font-semibold text-white">
            01. Generar la Release Beta 0.0.1 vía Share → GitHub → Push
          </h3>
        </div>
        <ol className="list-decimal list-inside space-y-2 text-sm text-slate-300 leading-relaxed">
          <li>
            Pulsa <strong className="text-white">Share → GitHub</strong> y haz push a tu rama{' '}
            <span className="font-mono text-xs text-slate-200">main</span>.
          </li>
          <li>
            El workflow{' '}
            <span className="font-mono text-xs text-slate-200">
              .github/workflows/release-beta-0.0.1.yml
            </span>{' '}
            se ejecutará automáticamente en{' '}
            <span className="font-mono text-xs text-slate-200">windows-2022</span>: compilará{' '}
            <span className="font-mono text-xs text-slate-200">XGMobile.Package.wapproj</span> en{' '}
            <span className="font-mono text-xs text-slate-200">Release | x64</span>, firmará el
            paquete con un certificado beta y publicará la release{' '}
            <strong className="text-white">beta-0.0.1</strong> en la pestaña{' '}
            <strong className="text-white">Releases</strong> de GitHub.
          </li>
          <li>
            Desde tu consola Windows 11, abre la release <strong className="text-white">beta-0.0.1</strong>,
            descarga <span className="font-mono text-xs text-slate-200">XGMobile-GameBar-Beta-0.0.1.zip</span>,
            descomprímelo y haz <strong className="text-white">doble clic en Instalar-DobleClick.bat</strong>.
          </li>
        </ol>
      </div>

      <div className="rounded-lg border border-white/[0.08] bg-[#14181F] p-5 space-y-3">
        <div className="flex items-center gap-2.5">
          <PackageCheck className="h-4 w-4 text-[#4ADE80]" />
          <h3 className="font-display text-base font-semibold text-white">
            02. Paquetes NuGet y estructura de la solución
          </h3>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 text-xs">
          <div className="rounded-md border border-white/[0.06] bg-[#0F1319] p-3.5 space-y-1.5">
            <div className="font-mono font-semibold text-white">XGMobile.Widget (UWP)</div>
            <ul className="space-y-1 font-mono text-[11px] text-slate-300">
              <li>Microsoft.Gaming.XboxGameBar (5.3.2006.1001)</li>
              <li>Microsoft.NETCore.UniversalWindowsPlatform (6.2.14)</li>
              <li>SDKReference: WindowsDesktop (10.0.22621.0)</li>
            </ul>
          </div>
          <div className="rounded-md border border-white/[0.06] bg-[#0F1319] p-3.5 space-y-1.5">
            <div className="font-mono font-semibold text-white">XGMobile.Helper (.NET 8 Win32)</div>
            <ul className="space-y-1 font-mono text-[11px] text-slate-300">
              <li>System.Management (8.0.0) — WMI DeviceChange</li>
              <li>System.Diagnostics.PerformanceCounter (8.0.0) — PDH</li>
              <li>P/Invoke nativo: cfgmgr32.dll + nvml.dll</li>
            </ul>
          </div>
        </div>
      </div>

      <div className="rounded-lg border border-white/[0.08] bg-[#14181F] p-5 space-y-3">
        <div className="flex items-center gap-2.5">
          <Terminal className="h-4 w-4 text-[#4ADE80]" />
          <h3 className="font-display text-base font-semibold text-white">
            03. Registrar en Modo Desarrollador y depurar con Win + G
          </h3>
        </div>
        <ol className="list-decimal list-inside space-y-2 text-sm text-slate-300 leading-relaxed">
          <li>
            Activa <strong className="text-white">Modo para programadores</strong> en Windows 11
            (<em>Configuración → Sistema → Para programadores</em>).
          </li>
          <li>
            Abre <span className="font-mono text-xs text-slate-200">XGMobileGameBar.sln</span> en
            Visual Studio 2022 y establece{' '}
            <span className="font-mono text-xs text-slate-200">XGMobile.Package</span> como proyecto
            de inicio en arquitectura <span className="font-mono text-xs text-slate-200">x64</span>.
          </li>
          <li>
            En <em>Propiedades de XGMobile.Package → Depurar</em>, activa{' '}
            <strong className="text-white">
              No iniciar, pero depurar el código cuando se inicie
            </strong>
            .
          </li>
          <li>
            Ejecuta <strong className="text-white">Implementar solución</strong> (Deploy), pulsa{' '}
            <span className="font-mono text-xs text-slate-200">F5</span> y abre Xbox Game Bar con{' '}
            <span className="font-mono text-xs text-slate-200">Win + G</span> para lanzar{' '}
            <strong className="text-white">XG Mobile RTX 5070 Ti</strong> desde el menú de Widgets.
          </li>
        </ol>
      </div>
    </div>
  );
};
