import React from 'react';
import { X } from 'lucide-react';
import { BusinessProfile } from '../../types';
import { SettingsView } from '../settings/SettingsView';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  businessProfile?: BusinessProfile | null;
  onProfileUpdated?: (updated: BusinessProfile) => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  businessProfile = null,
  onProfileUpdated,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-2 sm:p-4 animate-in fade-in duration-100">
      <div className="w-full max-w-5xl h-[92vh] bg-white rounded-xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col animate-in zoom-in-95 duration-150 relative">
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-5 z-20 p-1.5 rounded-lg text-slate-400 hover:text-slate-800 hover:bg-slate-100 transition-colors cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>
        <div className="flex-1 overflow-hidden">
          <SettingsView
            businessProfile={businessProfile}
            onProfileUpdated={onProfileUpdated}
          />
        </div>
      </div>
    </div>
  );
};
