import React, { useState, useEffect } from 'react';
import { X, Monitor, Download, ShieldCheck, HardDrive, CheckCircle2, Terminal, ExternalLink, Laptop } from 'lucide-react';

interface DesktopAppModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const DesktopAppModal: React.FC<DesktopAppModalProps> = ({ isOpen, onClose }) => {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [activeTab, setActiveTab] = useState<'pwa' | 'electron'>('pwa');

  const isDesktopElectron = typeof window !== 'undefined' && Boolean(window.electronAPI?.isDesktop);

  useEffect(() => {
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };

    const handleAppInstalled = () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    if (window.matchMedia('(display-mode: standalone)').matches) {
      setIsInstalled(true);
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const handleInstallPWA = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const choiceResult = await deferredPrompt.userChoice;
      if (choiceResult.outcome === 'accepted') {
        setIsInstalled(true);
      }
      setDeferredPrompt(null);
    } else {
      alert(
        'To install this app on your Windows desktop:\n\n1. In Chrome / Edge, click the Install icon (computer with down arrow) in the address bar.\n2. Or click the 3 dots menu -> "Cast, save, and share" -> "Install Amman Billing & Accounting".'
      );
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[10000] flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-in fade-in duration-100"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden animate-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-slate-900 text-white">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-rose-600/30 text-rose-400 flex items-center justify-center border border-rose-500/20">
              <Monitor className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold flex items-center gap-2">
                <span>Desktop App & Offline Setup</span>
                {isDesktopElectron && (
                  <span className="px-2 py-0.5 rounded text-[10px] bg-emerald-500/20 text-emerald-300 font-mono">
                    Native Desktop Active
                  </span>
                )}
              </h3>
              <p className="text-[11px] text-slate-400">
                Run Amman Billing offline on Windows without internet connection
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-md text-slate-400 hover:text-white transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Switcher */}
        <div className="flex border-b border-slate-200 bg-slate-50 px-6 pt-3 gap-4 text-xs font-semibold">
          <button
            type="button"
            onClick={() => setActiveTab('pwa')}
            className={`pb-2.5 border-b-2 transition-colors cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'pwa'
                ? 'border-rose-600 text-rose-600'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <Laptop className="w-4 h-4" />
            <span>Option 1: One-Click Desktop App (PWA)</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('electron')}
            className={`pb-2.5 border-b-2 transition-colors cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'electron'
                ? 'border-rose-600 text-rose-600'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <Terminal className="w-4 h-4" />
            <span>Option 2: Standalone Windows .EXE (Electron)</span>
          </button>
        </div>

        {/* Tab Content */}
        <div className="p-6 max-h-[70vh] overflow-y-auto space-y-5">
          {activeTab === 'pwa' ? (
            <div className="space-y-4">
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h4 className="text-xs font-bold text-slate-900">Instant Desktop Installation</h4>
                    <p className="text-[11px] text-slate-600 mt-0.5">
                      Installs a native standalone desktop app icon on your Windows Desktop and Start Menu. No coding or command prompt required.
                    </p>
                  </div>
                  {isInstalled ? (
                    <span className="shrink-0 flex items-center gap-1 px-3 py-1 bg-emerald-100 text-emerald-800 rounded-md text-xs font-semibold">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      Installed
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={handleInstallPWA}
                      className="shrink-0 px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold rounded-lg shadow-sm transition-colors cursor-pointer flex items-center gap-1.5"
                    >
                      <Download className="w-3.5 h-3.5" />
                      Install to Desktop
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-2">
                  <div className="p-2.5 bg-white rounded-lg border border-slate-200 text-slate-700 text-[11px] space-y-1">
                    <span className="font-bold flex items-center gap-1 text-slate-900">
                      <HardDrive className="w-3.5 h-3.5 text-blue-600" /> 100% Offline
                    </span>
                    <p className="text-slate-500 text-[10px]">
                      Opens directly from desktop and works without Wi-Fi or internet.
                    </p>
                  </div>
                  <div className="p-2.5 bg-white rounded-lg border border-slate-200 text-slate-700 text-[11px] space-y-1">
                    <span className="font-bold flex items-center gap-1 text-slate-900">
                      <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" /> Private Data
                    </span>
                    <p className="text-slate-500 text-[10px]">
                      Stored strictly on your computer in persistent IndexedDB.
                    </p>
                  </div>
                  <div className="p-2.5 bg-white rounded-lg border border-slate-200 text-slate-700 text-[11px] space-y-1">
                    <span className="font-bold flex items-center gap-1 text-slate-900">
                      <Monitor className="w-3.5 h-3.5 text-purple-600" /> Full Screen
                    </span>
                    <p className="text-slate-500 text-[10px]">
                      Clean desktop window with no browser address bar or tabs.
                    </p>
                  </div>
                </div>
              </div>

              {/* Instructions if button not available */}
              <div className="p-4 bg-blue-50/60 rounded-xl border border-blue-100 text-xs text-blue-900 space-y-2">
                <span className="font-bold">Manual Install Steps (Google Chrome or Microsoft Edge):</span>
                <ol className="list-decimal list-inside space-y-1 text-[11px] text-blue-800">
                  <li>Click the <strong>Install Amman Billing & Accounting</strong> icon in the address bar.</li>
                  <li>Or open the browser menu (<strong>⋮</strong> or <strong>…</strong>) &rarr; <strong>Install Amman Billing</strong>.</li>
                  <li>Check &quot;Create Desktop Shortcut&quot; and click <strong>Install</strong>.</li>
                </ol>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="p-4 bg-slate-900 text-slate-100 rounded-xl space-y-3 font-mono text-xs">
                <div className="flex items-center justify-between pb-2 border-b border-slate-800 text-[11px] text-slate-400">
                  <span>Windows .EXE Packaging Configuration</span>
                  <span className="text-emerald-400">electron-builder v24+</span>
                </div>
                <p className="text-slate-300 font-sans text-xs">
                  The application includes complete configuration files (<code>electron/main.cjs</code>, <code>electron/preload.cjs</code>, and <code>electron-builder.json</code>).
                </p>
                <div className="bg-slate-950 p-3 rounded-lg border border-slate-800 space-y-1.5 text-[11px]">
                  <p className="text-slate-500"># 1. Build the production web bundle</p>
                  <p className="text-emerald-400">npm run build</p>
                  <p className="text-slate-500 pt-1"># 2. Package standalone Windows installer (.exe)</p>
                  <p className="text-emerald-400">npx electron-builder --win nsis</p>
                </div>
              </div>

              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-2 text-xs">
                <span className="font-bold text-slate-900">Generated Installer Output:</span>
                <ul className="space-y-1.5 text-[11px] text-slate-600">
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                    <span><strong>release/Amman-Billing-Setup-1.0.0.exe</strong>: Standard Windows NSIS installer with desktop & start menu shortcuts.</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                    <span><strong>release/Amman-Billing-1.0.0-portable.exe</strong>: Zero-install portable edition that runs directly from any USB flash drive.</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                    <span><strong>Zero Cloud Dependence</strong>: Operates 100% locally with high-performance persistent database.</span>
                  </li>
                </ul>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs">
          <span className="text-slate-500 text-[11px]">Amman Billing & Accounting · Release v1.0.0</span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 font-semibold text-slate-700 bg-white border border-slate-300 hover:bg-slate-100 rounded-lg cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
