import React, { useState } from 'react';
import { X, Cloud, Download, Upload, CheckCircle2, AlertTriangle } from 'lucide-react';
import { exportBackupJSON, importBackupJSON } from '../../db/indexedDB';

interface SyncBackupModalProps {
  isOpen: boolean;
  onClose: () => void;
  onDataRestored: () => void;
}

export const SyncBackupModal: React.FC<SyncBackupModalProps> = ({
  isOpen,
  onClose,
  onDataRestored,
}) => {
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [isError, setIsError] = useState(false);

  if (!isOpen) return null;

  const handleDownloadBackup = async () => {
    try {
      const json = await exportBackupJSON();
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      const today = new Date().toISOString().split('T')[0];
      link.download = `VyaparGST_Backup_${today}.json`;
      link.click();
      URL.revokeObjectURL(url);

      setIsError(false);
      setStatusMessage('Backup file downloaded successfully.');
    } catch {
      setIsError(true);
      setStatusMessage('Failed to generate backup.');
    }
  };

  const handleUploadBackup = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = async (event) => {
        const text = event.target?.result as string;
        const res = await importBackupJSON(text);
        if (res.success) {
          setIsError(false);
          setStatusMessage('Backup restored successfully into IndexedDB.');
          onDataRestored();
        } else {
          setIsError(true);
          setStatusMessage(res.message);
        }
      };
      reader.readAsText(file);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
      <div className="w-full max-w-lg bg-white rounded-xl shadow-2xl border border-slate-200 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-slate-900 text-white">
          <div className="flex items-center gap-2.5">
            <Cloud className="w-5 h-5 text-rose-500" />
            <h2 className="text-base font-bold">Sync, Share & Backup</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-white cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {statusMessage && (
            <div
              className={`p-3 text-xs rounded-lg flex items-center gap-2 ${
                isError
                  ? 'bg-rose-50 text-rose-700 border border-rose-200'
                  : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
              }`}
            >
              {isError ? <AlertTriangle className="w-4 h-4 shrink-0" /> : <CheckCircle2 className="w-4 h-4 shrink-0" />}
              <span>{statusMessage}</span>
            </div>
          )}

          <div className="space-y-4">
            {/* Backup */}
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl flex items-start justify-between gap-4">
              <div>
                <h3 className="text-xs font-bold text-slate-900">Backup To Computer</h3>
                <p className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">
                  Export all your business profile, parties, items, and GST transactions to a portable JSON backup file.
                </p>
              </div>
              <button
                type="button"
                onClick={handleDownloadBackup}
                className="px-3.5 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg flex items-center gap-1.5 shrink-0 shadow-2xs cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Backup Now</span>
              </button>
            </div>

            {/* Restore */}
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl flex items-start justify-between gap-4">
              <div>
                <h3 className="text-xs font-bold text-slate-900">Restore Backup</h3>
                <p className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">
                  Restore your records from a previous JSON backup file. Existing records with the same IDs will be updated.
                </p>
              </div>
              <label className="px-3.5 py-2 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-100 border border-slate-300 rounded-lg flex items-center gap-1.5 shrink-0 cursor-pointer shadow-2xs">
                <Upload className="w-3.5 h-3.5" />
                <span>Restore File</span>
                <input
                  type="file"
                  accept=".json,application/json"
                  onChange={handleUploadBackup}
                  className="hidden"
                />
              </label>
            </div>
          </div>

          <div className="text-[11px] text-slate-400 bg-slate-100 p-3 rounded-lg flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>All your data resides 100% locally in your browser&apos;s IndexedDB database.</span>
          </div>
        </div>
      </div>
    </div>
  );
};
