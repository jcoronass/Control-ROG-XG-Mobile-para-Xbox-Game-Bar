import React, { useState } from 'react';
import { Check, Copy, Download, FileCode2, FolderArchive } from 'lucide-react';
import { SOLUTION_FILES, SolutionFileEntry } from '../data/solutionFiles';

interface SolutionExplorerProps {
  onDownloadZip: () => void;
}

const GROUPS: SolutionFileEntry['group'][] = [
  'Empaquetado WAP',
  'Widget UWP',
  'Helper Win32 (.NET 8)',
  'GitHub Beta 0.0.1',
];

export const SolutionExplorer: React.FC<SolutionExplorerProps> = ({ onDownloadZip }) => {
  const [selectedId, setSelectedId] = useState<string>(SOLUTION_FILES[0].id);
  const [activeGroup, setActiveGroup] = useState<SolutionFileEntry['group'] | 'Todos'>('Todos');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const visibleFiles =
    activeGroup === 'Todos'
      ? SOLUTION_FILES
      : SOLUTION_FILES.filter((f) => f.group === activeGroup);

  const activeFile =
    visibleFiles.find((f) => f.id === selectedId) ?? visibleFiles[0] ?? SOLUTION_FILES[0];

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(activeFile.content);
      setCopiedId(activeFile.id);
      window.setTimeout(() => {
        setCopiedId((prev) => (prev === activeFile.id ? null : prev));
      }, 1800);
    } catch {
      // Clipboard blocked
    }
  };

  const handleDownloadSingle = () => {
    const filename = activeFile.path.split('/').pop() ?? 'archivo.txt';
    const blob = new Blob([activeFile.content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-white/[0.08] pb-5">
        <div className="space-y-1">
          <h2 className="font-display text-xl font-semibold text-white">
            Solución completa Visual Studio 2022 ({SOLUTION_FILES.length} archivos reales)
          </h2>
          <p className="text-sm text-slate-400">
            Todos estos archivos ya existen en la raíz del repositorio para compilarse al hacer
            Share → GitHub → Push.
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

      {/* Group filter segmented bar */}
      <div className="flex flex-wrap items-center gap-1.5 rounded-lg border border-white/[0.08] bg-[#14181F] p-1">
        {(['Todos', ...GROUPS] as const).map((group) => {
          const active = activeGroup === group;
          return (
            <button
              key={group}
              type="button"
              onClick={() => {
                setActiveGroup(group);
                const first =
                  group === 'Todos'
                    ? SOLUTION_FILES[0]
                    : SOLUTION_FILES.find((f) => f.group === group);
                if (first) setSelectedId(first.id);
              }}
              className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                active ? 'bg-[#1D2430] text-white' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {group}
            </button>
          );
        })}
      </div>

      {/* Sidebar + code panel */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[310px_1fr]">
        <aside
          aria-label="Archivos de la solución"
          className="max-h-[620px] space-y-1.5 overflow-y-auto pr-1"
        >
          {visibleFiles.map((file) => {
            const active = file.id === activeFile.id;
            return (
              <button
                key={file.id}
                type="button"
                onClick={() => setSelectedId(file.id)}
                className={`flex w-full items-start gap-2.5 rounded-lg border px-3 py-2.5 text-left transition-colors ${
                  active
                    ? 'border-[#16A34A]/60 bg-[#16A34A]/10 text-white'
                    : 'border-white/[0.06] bg-[#14181F] text-slate-300 hover:border-white/[0.14] hover:text-white'
                }`}
              >
                <FileCode2 className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
                <div className="min-w-0 flex-1">
                  <div className="truncate font-mono text-xs font-medium">{file.path}</div>
                  <div className="mt-0.5 line-clamp-2 text-[11px] leading-snug text-slate-400">
                    {file.summary}
                  </div>
                </div>
              </button>
            );
          })}
        </aside>

        <div className="min-w-0 overflow-hidden rounded-lg border border-white/[0.08] bg-[#10141B]">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/[0.08] bg-[#151A22] px-4 py-2.5">
            <div className="min-w-0">
              <span className="font-mono text-xs font-medium text-white">{activeFile.path}</span>
              <span className="ml-2 text-xs text-slate-400">· {activeFile.group}</span>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={handleCopy}
                className="inline-flex h-8 items-center gap-1.5 rounded border border-white/[0.1] bg-[#1B222D] px-2.5 text-xs font-medium text-slate-200 transition-colors hover:bg-[#242D3B] whitespace-nowrap shrink-0"
              >
                {copiedId === activeFile.id ? (
                  <>
                    <Check className="h-3.5 w-3.5 text-[#4ADE80]" />
                    <span>Copiado</span>
                  </>
                ) : (
                  <>
                    <Copy className="h-3.5 w-3.5" />
                    <span>Copiar</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={handleDownloadSingle}
                className="inline-flex h-8 items-center gap-1.5 rounded border border-white/[0.1] bg-[#1B222D] px-2.5 text-xs font-medium text-slate-200 transition-colors hover:bg-[#242D3B] whitespace-nowrap shrink-0"
              >
                <Download className="h-3.5 w-3.5" />
                <span>Guardar</span>
              </button>
            </div>
          </div>

          <pre className="max-h-[560px] overflow-auto p-4 font-mono text-xs leading-relaxed text-slate-200">
            <code>{activeFile.content}</code>
          </pre>
        </div>
      </div>
    </div>
  );
};
