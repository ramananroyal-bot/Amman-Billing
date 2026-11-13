import React, { useEffect } from 'react';
import { X, Command, Keyboard, Zap, CornerDownLeft, Search } from 'lucide-react';

interface ShortcutsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ShortcutsModal: React.FC<ShortcutsModalProps> = ({ isOpen, onClose }) => {
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const shortcutSections = [
    {
      title: 'Quick Document Creation',
      icon: <Zap className="w-4 h-4 text-rose-500" />,
      shortcuts: [
        { keys: ['Ctrl', 'N'], altKeys: ['Alt', 'S'], desc: 'Create New Sale Invoice' },
        { keys: ['Alt', 'P'], altKeys: ['F5'], desc: 'Create New Purchase Bill' },
        { keys: ['Alt', 'C'], desc: 'Create Delivery Challan' },
        { keys: ['Ctrl', 'F'], altKeys: ['Ctrl', 'K'], desc: 'Open Anything Global Search' },
        { keys: ['F1'], altKeys: ['?'], desc: 'Open Shortcuts Cheat Sheet' },
      ],
    },
    {
      title: 'Module Navigation',
      icon: <Command className="w-4 h-4 text-blue-500" />,
      shortcuts: [
        { keys: ['Alt', 'H'], desc: 'Go to Home Dashboard' },
        { keys: ['Alt', '1'], desc: 'Go to Parties' },
        { keys: ['Alt', '2'], desc: 'Go to Items & Stock' },
        { keys: ['Alt', '3'], desc: 'Go to Sale Invoices' },
        { keys: ['Alt', '4'], desc: 'Go to Delivery Challans' },
        { keys: ['Alt', '5'], desc: 'Go to Purchase Bills' },
        { keys: ['Alt', '6'], desc: 'Go to GST & Financial Reports' },
        { keys: ['Alt', '7'], desc: 'Go to Sync, Share & Backup' },
        { keys: ['Alt', '8'], desc: 'Go to Application Settings' },
      ],
    },
    {
      title: 'In-Form & Print Shortcuts',
      icon: <CornerDownLeft className="w-4 h-4 text-emerald-500" />,
      shortcuts: [
        { keys: ['Ctrl', 'S'], altKeys: ['Ctrl', 'Enter'], desc: 'Save Invoice / Bill / Item' },
        { keys: ['Ctrl', 'P'], desc: 'Print Open Invoice Preview' },
        { keys: ['Alt', 'A'], desc: 'Add Line Item Row' },
        { keys: ['Esc'], desc: 'Close Modal or Dialog' },
      ],
    },
  ];

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
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-rose-600/30 text-rose-400 flex items-center justify-center">
              <Keyboard className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold">Amman Billing Keyboard Shortcuts</h3>
              <p className="text-[11px] text-slate-400">Boost your billing speed with desktop keyboard hotkeys</p>
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

        {/* Shortcuts Content */}
        <div className="p-6 max-h-[75vh] overflow-y-auto space-y-6">
          {shortcutSections.map((section, idx) => (
            <div key={idx} className="space-y-3">
              <div className="flex items-center gap-2 text-xs font-bold text-slate-900 uppercase tracking-wider">
                {section.icon}
                <span>{section.title}</span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                {section.shortcuts.map((sc, scIdx) => (
                  <div
                    key={scIdx}
                    className="p-2.5 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between gap-3 text-xs"
                  >
                    <span className="text-slate-700 font-medium">{sc.desc}</span>
                    <div className="flex items-center gap-1 shrink-0">
                      {sc.keys.map((k, kIdx) => (
                        <kbd
                          key={kIdx}
                          className="px-2 py-1 text-[11px] font-mono font-bold bg-white text-slate-800 border border-slate-300 rounded shadow-2xs"
                        >
                          {k}
                        </kbd>
                      ))}
                      {sc.altKeys && (
                        <>
                          <span className="text-[10px] text-slate-400 font-sans">or</span>
                          {sc.altKeys.map((ak, akIdx) => (
                            <kbd
                              key={akIdx}
                              className="px-2 py-1 text-[11px] font-mono font-bold bg-white text-slate-800 border border-slate-300 rounded shadow-2xs"
                            >
                              {ak}
                            </kbd>
                          ))}
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500">
          <span>Tip: Press <kbd className="px-1.5 py-0.5 bg-white border border-slate-300 rounded text-[10px] font-mono">?</kbd> anywhere to show this window</span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 font-semibold text-slate-700 bg-white border border-slate-300 hover:bg-slate-100 rounded-lg cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
