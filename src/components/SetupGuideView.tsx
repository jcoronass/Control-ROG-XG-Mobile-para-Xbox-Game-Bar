import React from 'react';
import { FolderArchive, Gamepad2, GitBranch, ShieldAlert, Terminal } from 'lucide-react';
import { XGMobileSpec } from '../types/xgmobile';

interface SetupGuideViewProps {
  model: XGMobileSpec;
  onDownloadZip: () => void;
}

export const SetupGuideView: React.FC<SetupGuideViewProps> = ({ model, onDownloadZip }) => {
  return (
    <div className="mx-auto max-w-4xl space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-white/[0.08] pb-5">
        <div className="space-y-1.5">
          <h2 className="font-display text-2xl font-semibold text-white">
            Compilar en GitHub y probar en ASUS ROG Xbox Ally X
          </h2>
          <p className="text-sm text-slate-400">
            Flujo automático con GitHub Actions para generar el instalador{' '}
            <span className="font-mono text-xs text-slate-200">.msix</span> en la nube e instalarlo
            en tu consola sin instalar Visual Studio.
          </p>
        </div>

        <button
          type="button"
          onClick={onDownloadZip}
          className="inline-flex min-h-[40px] items-center gap-2 rounded-md bg-[#16A34A] px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-[#15803D] whitespace-nowrap shrink-0"
        >
          <FolderArchive className="h-4 w-4" />
          <span>Descargar repo (.zip)</span>
        </button>
      </div>

      <div className="space-y-6">
        <div className="rounded-lg border border-white/[0.08] bg-[#14181F] p-5 space-y-4">
          <div className="flex items-center gap-2.5">
            <GitBranch className="h-4 w-4 text-[#4ADE80]" />
            <h3 className="font-display text-base font-semibold text-white">
              01. Subir a tu repositorio de GitHub y compilar el ejecutable MSIX
            </h3>
          </div>
          <ol className="space-y-2.5 text-sm text-slate-300 list-decimal list-inside leading-relaxed">
            <li>
              Pulsa <strong className="text-white">Descargar paquete</strong> y descomprime el ZIP.
              Ya incluye <span className="font-mono text-xs text-slate-200">.github/workflows/build-msix.yml</span>,{' '}
              la solución <span className="font-mono text-xs text-slate-200">XGMobileWidget.sln</span> y tus
              perfiles <span className="font-mono text-xs text-slate-200">game-profiles.json</span>.
            </li>
            <li>
              Crea un repositorio vacío en GitHub y sube la carpeta (arrastrando los archivos desde
              la web de GitHub o con Git):
            </li>
          </ol>
          <pre className="overflow-x-auto rounded-md border border-white/[0.08] bg-[#0B0D11] p-3.5 font-mono text-xs text-slate-200">
            <code>{`git init
git add .
git commit -m "Widget XG Mobile para Xbox Ally X"
git branch -M main
git remote add origin https://github.com/TU_USUARIO/xg-mobile-gamebar.git
git push -u origin main`}</code>
          </pre>
          <ol start={3} className="space-y-2.5 text-sm text-slate-300 list-decimal list-inside leading-relaxed">
            <li>
              Abre la pestaña <strong className="text-white">Actions</strong> en tu repositorio:
              el runner <span className="font-mono text-xs text-slate-200">windows-latest</span>{' '}
              compilará automáticamente <span className="font-mono text-xs text-slate-200">XGMobileHelper.exe</span>{' '}
              y el paquete firmado <span className="font-mono text-xs text-slate-200">.msix</span> en unos 2 minutos.
            </li>
            <li>
              Descarga el artefacto <strong className="text-white">XGMobile-GameBar-AllyX-Installer</strong>{' '}
              directamente en tu Ally X, descomprímelo y haz clic derecho en{' '}
              <span className="font-mono text-xs text-slate-200">Install-XGMobileWidget.ps1</span> &gt;{' '}
              <em>Ejecutar con PowerShell</em> (instala el certificado temporal y registra el widget).
            </li>
          </ol>
        </div>

        <div className="rounded-lg border border-white/[0.08] bg-[#14181F] p-5 space-y-4">
          <div className="flex items-center gap-2.5">
            <Gamepad2 className="h-4 w-4 text-[#4ADE80]" />
            <h3 className="font-display text-base font-semibold text-white">
              02. Fijar y controlar con el mando en Modo Juego Xbox
            </h3>
          </div>
          <p className="text-sm leading-relaxed text-slate-300">
            En tu ROG Xbox Ally X activa el <strong className="text-white">Modo de desarrollador</strong>{' '}
            (<em>Configuración &gt; Sistema &gt; Para programadores</em>) para permitir paquetes
            firmados localmente. Luego entra al <strong className="text-white">Modo Juego Xbox</strong>,
            pulsa el botón <strong className="text-white">Xbox</strong> (o{' '}
            <span className="font-mono text-xs text-slate-200">Win + G</span>), abre el menú de
            widgets, elige <strong className="text-white">XG Mobile eGPU</strong> y fíjalo (Pin).
          </p>

          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 pt-1 text-xs">
            <div className="flex items-center justify-between rounded-md border border-white/[0.06] bg-[#0F1319] px-3 py-2.5">
              <span className="text-slate-300">Desacoplar eGPU + perfil Handheld</span>
              <span className="font-mono font-semibold text-white">Botón X / Tecla X</span>
            </div>
            <div className="flex items-center justify-between rounded-md border border-white/[0.06] bg-[#0F1319] px-3 py-2.5">
              <span className="text-slate-300">Cambiar perfil Armoury SE</span>
              <span className="font-mono font-semibold text-white">Botón Y / Tecla Y</span>
            </div>
            <div className="flex items-center justify-between rounded-md border border-white/[0.06] bg-[#0F1319] px-3 py-2.5">
              <span className="text-slate-300">Alternar vista compacta 7&quot;</span>
              <span className="font-mono font-semibold text-white">LB o RB / Tecla M</span>
            </div>
            <div className="flex items-center justify-between rounded-md border border-white/[0.06] bg-[#0F1319] px-3 py-2.5">
              <span className="text-slate-300">Cancelar confirmación</span>
              <span className="font-mono font-semibold text-white">Botón B / Esc</span>
            </div>
          </div>
        </div>

        <div className="rounded-lg border border-white/[0.08] bg-[#14181F] p-5 space-y-4">
          <div className="flex items-center gap-2.5">
            <Terminal className="h-4 w-4 text-[#4ADE80]" />
            <h3 className="font-display text-base font-semibold text-white">
              03. Prueba rápida sin instalar el widget (solo PowerShell)
            </h3>
          </div>
          <p className="text-sm leading-relaxed text-slate-300">
            También puedes probar el desacoplamiento seguro y el intercambio de perfiles{' '}
            <span className="font-mono text-xs text-slate-200">Handheld / eGPU</span> al instante en
            tu Ally X ({model.shortName}) ejecutando el script incluido:
          </p>
          <pre className="overflow-x-auto rounded-md border border-white/[0.08] bg-[#0B0D11] p-3.5 font-mono text-xs text-slate-200">
            <code>{`powershell.exe -ExecutionPolicy Bypass -File .\\Undock-XGMobile.ps1 -Action SafeUndock -CloseActiveGames`}</code>
          </pre>
        </div>

        <div className="rounded-lg border border-amber-500/25 bg-amber-500/5 p-4">
          <div className="flex items-start gap-3">
            <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
            <p className="text-xs leading-relaxed text-slate-300">
              <strong className="text-white">Nota de transparencia:</strong> Desde esta aplicación
              web no podemos iniciar sesión ni hacer push automático a tu cuenta personal de GitHub,
              por eso el botón <strong className="text-white">Descargar paquete</strong> empaqueta el
              repositorio completo listo para subir y compilar con GitHub Actions en{' '}
              <span className="font-mono text-slate-200">windows-latest</span>.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
