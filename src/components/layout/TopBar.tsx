import React, { useState, useEffect } from 'react';
import { Search, Plus, Building2, SlidersHorizontal, Keyboard, Wifi, WifiOff, Monitor } from 'lucide-react';
import { BusinessProfile } from '../../types';

interface TopBarProps {
  businessProfile: BusinessProfile | null;
  onOpenAddSale: () => void;
  onOpenAddPurchase: () => void;
  onOpenBusinessProfile: () => void;
  onOpenSettings: () => void;
  onOpenShortcuts: () => void;
  onOpenDesktopApp?: () => void;
  onSearchClick: () => void;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  activeViewTitle: string;
}

export const TopBar: React.FC<TopBarProps> = ({
  businessProfile,
  onOpenAddSale,
  onOpenAddPurchase,
  onOpenBusinessProfile,
  onOpenSettings,
  onOpenShortcuts,
  onOpenDesktopApp,
  onSearchClick,
  searchQuery,
  onSearchChange,
  activeViewTitle,
}) => {
  const [isFocused, setIsFocused] = useState(false);
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return (
    <header className="h-16 bg-white border-b border-slate-200 px-4 sm:px-6 flex items-center justify-between gap-4 shrink-0 select-none">
      {/* Zone 1: View Breadcrumb & Business Tag */}
      <div className="flex items-center gap-3 min-w-0">
        <h1 className="text-base font-bold text-slate-900 tracking-tight whitespace-nowrap">
          {activeViewTitle}
        </h1>
        {businessProfile && (
          <div className="hidden sm:flex items-center gap-1.5 text-xs text-slate-500">
            <span>·</span>
            <span className="font-medium text-slate-700 truncate max-w-[200px]">
              {businessProfile.businessName}
            </span>
            <span className="text-[11px] text-slate-400">({businessProfile.state})</span>
          </div>
        )}
      </div>

      {/* Zone 2: Transaction Search Bar */}
      <div className="flex-1 max-w-md mx-2">
        <div
          onClick={onSearchClick}
          className={`relative flex items-center w-full px-3 py-1.5 text-xs bg-slate-100/80 hover:bg-slate-100 rounded-lg border transition-all cursor-pointer ${
            isFocused ? 'border-slate-900 bg-white ring-2 ring-slate-900/10' : 'border-slate-200'
          }`}
        >
          <Search className="w-3.5 h-3.5 text-slate-400 mr-2 shrink-0" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
            placeholder="Search transactions (Invoice #, party, phone, amount)..."
            className="w-full bg-transparent border-none text-xs text-slate-800 placeholder-slate-400 focus:outline-hidden"
          />
          <kbd className="hidden md:inline-flex items-center px-1.5 py-0.5 text-[10px] font-mono text-slate-400 bg-white border border-slate-200 rounded-xs shadow-2xs">
            /
          </kbd>
        </div>
      </div>

      {/* Zone 3: Quick Action Buttons, Offline Badge & Shortcuts */}
      <div className="flex items-center gap-2.5 shrink-0">
        {/* Offline-First / Desktop Badge */}
        <button
          type="button"
          onClick={onOpenDesktopApp}
          title={
            window.electronAPI?.isDesktop
              ? 'Desktop Native Mode: Running via Windows Electron'
              : 'Offline-first: Data stored in local IndexedDB. Click for Desktop App options.'
          }
          className={`hidden lg:flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-medium border transition-colors cursor-pointer ${
            window.electronAPI?.isDesktop
              ? 'bg-purple-50 text-purple-700 border-purple-200 hover:bg-purple-100'
              : isOnline
              ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
              : 'bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100'
          }`}
        >
          {window.electronAPI?.isDesktop ? (
            <Monitor className="w-3.5 h-3.5 text-purple-600" />
          ) : (
            <span className={`w-1.5 h-1.5 rounded-full ${isOnline ? 'bg-emerald-500' : 'bg-amber-500'}`} />
          )}
          <span>
            {window.electronAPI?.isDesktop
              ? 'Desktop Native'
              : isOnline
              ? 'IndexedDB Local'
              : 'Offline Mode'}
          </span>
        </button>

        {/* Add Sale Button */}
        <button
          type="button"
          onClick={onOpenAddSale}
          className="hidden md:flex items-center gap-1.5 px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold rounded-lg shadow-2xs transition-colors cursor-pointer"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Add Sale</span>
        </button>

        {/* Add Purchase Button */}
        <button
          type="button"
          onClick={onOpenAddPurchase}
          className="hidden md:flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg shadow-2xs transition-colors cursor-pointer"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Add Purchase</span>
        </button>

        {/* Shortcuts Icon */}
        <button
          type="button"
          onClick={onOpenShortcuts}
          title="Keyboard Shortcuts (F1 or ?)"
          className="p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
        >
          <Keyboard className="w-4 h-4" />
        </button>

        {/* Quick Settings Icon */}
        <button
          type="button"
          onClick={onOpenSettings}
          title="Settings (Alt + 8)"
          className="p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
        >
          <SlidersHorizontal className="w-4 h-4" />
        </button>

        {/* Business Profile Button */}
        <button
          type="button"
          onClick={onOpenBusinessProfile}
          title="Edit Business Details"
          className="flex items-center gap-2 p-1.5 hover:bg-slate-100 rounded-lg transition-colors border border-slate-200 cursor-pointer"
        >
          <div className="w-7 h-7 rounded-md bg-slate-900 text-white flex items-center justify-center font-bold text-xs overflow-hidden">
            {businessProfile?.logo ? (
              <img src={businessProfile.logo} alt="Logo" className="w-full h-full object-cover" />
            ) : (
              <Building2 className="w-3.5 h-3.5" />
            )}
          </div>
        </button>
      </div>
    </header>
  );
};
