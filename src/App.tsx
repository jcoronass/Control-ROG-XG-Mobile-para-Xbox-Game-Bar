import { useCallback, useState } from 'react';
import { FolderArchive } from 'lucide-react';
import { ReleaseGuide } from './components/ReleaseGuide';
import { SolutionExplorer } from './components/SolutionExplorer';
import { WidgetSimulator } from './components/WidgetSimulator';
import { SOLUTION_FILES } from './data/solutionFiles';
import { createZipBlob } from './utils/zipBuilder';

type WorkspaceTab = 'simulator' | 'code' | 'release';

export default function App() {
  const [activeTab, setActiveTab] = useState<WorkspaceTab>('simulator');

  const handleDownloadZip = useCallback(() => {
    const entries = SOLUTION_FILES.map((file) => ({
      path: file.path,
      content: file.content,
    }));
    const blob = createZipBlob(entries);
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'XGMobile-RTX5070Ti-GameBar-VS2022-Beta-0.0.1.zip';
    a.click();
    URL.revokeObjectURL(url);
  }, []);

  return (
    <div className="min-h-screen bg-[#0C0E12] text-[#F1F5F9]">
      {/* Strict 3-Zone Top Bar Contract */}
      <header className="border-b border-white/[0.08] bg-[#0C0E12]">
        <div className="mx-auto flex max-w-[1200px] items-center justify-between gap-8 px-6 py-4">
          <button
            type="button"
            onClick={() => setActiveTab('simulator')}
            className="font-display text-lg font-bold tracking-tight text-white whitespace-nowrap shrink-0 text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#16A34A]"
          >
            XG Mobile Bar
          </button>

          <nav
            aria-label="Secciones principales"
            className="flex items-center gap-6 overflow-x-auto text-sm font-medium"
          >
            <button
              type="button"
              onClick={() => setActiveTab('simulator')}
              className={`border-b-2 py-1 transition-colors whitespace-nowrap shrink-0 ${
                activeTab === 'simulator'
                  ? 'border-[#16A34A] text-white'
                  : 'border-transparent text-slate-400 hover:text-white'
              }`}
            >
              Simulador Widget
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
              Solución VS 2022
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('release')}
              className={`border-b-2 py-1 transition-colors whitespace-nowrap shrink-0 ${
                activeTab === 'release'
                  ? 'border-[#16A34A] text-white'
                  : 'border-transparent text-slate-400 hover:text-white'
              }`}
            >
              Beta 0.0.1 y Win + G
            </button>
          </nav>

          <div className="shrink-0">
            <button
              type="button"
              onClick={handleDownloadZip}
              className="inline-flex min-h-[38px] items-center gap-2 rounded-md bg-[#16A34A] px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-[#15803D] whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#16A34A]"
            >
              <FolderArchive className="h-3.5 w-3.5" />
              <span>Descargar ZIP</span>
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1200px] px-6 py-8">
        {activeTab === 'simulator' && (
          <div className="space-y-8">
            <div className="flex flex-wrap items-end justify-between gap-4 border-b border-white/[0.08] pb-6">
              <div className="max-w-3xl space-y-2">
                <h1 className="font-display text-3xl font-semibold tracking-tight text-white">
                  XG Mobile RTX 5070 Ti + Ryzen Z2 Extreme
                </h1>
                <p className="text-sm leading-relaxed text-slate-400">
                  Arquitectura nativa UWP (<span className="font-mono text-slate-200">Microsoft.Gaming.XboxGameBar</span>) +
                  Win32 <span className="font-mono text-slate-200">runFullTrust</span> (.NET 8) mediante{' '}
                  <span className="font-mono text-slate-200">AppServiceConnection</span>, expulsión PnP con{' '}
                  <span className="font-mono text-slate-200">CM_Request_Device_EjectW</span> y Dual Profile Swapper
                  listo para publicarse en GitHub Release <span className="text-white font-medium">beta-0.0.1</span>.
                </p>
              </div>
              <div className="text-xs font-mono text-slate-400">
                VEN_10DE · VEN_1002 · beta-0.0.1
              </div>
            </div>

            <WidgetSimulator />
          </div>
        )}

        {activeTab === 'code' && <SolutionExplorer onDownloadZip={handleDownloadZip} />}

        {activeTab === 'release' && <ReleaseGuide onDownloadZip={handleDownloadZip} />}
      </main>
    </div>
  );
}
