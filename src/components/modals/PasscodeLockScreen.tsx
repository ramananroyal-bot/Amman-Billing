import React, { useState, useEffect, useRef } from 'react';
import { Lock, ShieldAlert, KeyRound, X } from 'lucide-react';
import { verifyPasscode } from '../../utils/security';

interface PasscodeLockScreenProps {
  businessName?: string;
  onUnlock: () => void;
}

/**
 * Full-screen PIN lock overlay displayed on application boot when Passcode Lock is enabled.
 */
export const PasscodeLockScreen: React.FC<PasscodeLockScreenProps> = ({
  businessName,
  onUnlock,
}) => {
  const [pin, setPin] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isChecking, setIsChecking] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pin.trim()) {
      setError('Please enter your PIN');
      return;
    }
    setIsChecking(true);
    setError(null);
    const valid = await verifyPasscode(pin);
    setIsChecking(false);
    if (valid) {
      setPin('');
      onUnlock();
    } else {
      setError('Incorrect PIN. Please try again.');
      setPin('');
      inputRef.current?.focus();
    }
  };

  return (
    <div className="fixed inset-0 z-[10001] bg-slate-950/95 backdrop-blur-md flex items-center justify-center p-4 font-sans">
      <div className="w-full max-w-sm bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl p-6 text-center space-y-5">
        <div className="w-14 h-14 rounded-2xl bg-rose-600/20 border border-rose-500/30 text-rose-400 flex items-center justify-center mx-auto">
          <Lock className="w-7 h-7" />
        </div>

        <div>
          <h2 className="text-base font-bold text-white tracking-tight">
            {businessName || 'GST Billing'} Locked
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Enter your security PIN to access billing records and reports.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <input
              ref={inputRef}
              type="password"
              inputMode="numeric"
              maxLength={8}
              value={pin}
              onChange={(e) => {
                setPin(e.target.value.replace(/\D/g, ''));
                setError(null);
              }}
              placeholder="••••"
              className="w-full px-4 py-3 text-center text-xl font-mono tracking-[0.5em] bg-slate-950 border border-slate-700 rounded-xl text-white focus:outline-hidden focus:ring-2 focus:ring-rose-500"
            />
            {error && (
              <div className="mt-2 flex items-center justify-center gap-1.5 text-xs text-rose-400">
                <ShieldAlert className="w-3.5 h-3.5 shrink-0" />
                <span>{error}</span>
              </div>
            )}
          </div>

          <button
            type="submit"
            disabled={isChecking}
            className="w-full py-2.5 px-4 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 disabled:opacity-50 rounded-xl shadow-md transition-colors cursor-pointer"
          >
            {isChecking ? 'Verifying...' : 'Unlock Application'}
          </button>
        </form>
      </div>
    </div>
  );
};

interface PinVerifyModalProps {
  isOpen: boolean;
  title?: string;
  description?: string;
  onClose: () => void;
  onVerified: () => void;
}

/**
 * Action-level PIN verification modal triggered before editing or deleting transactions
 * when "Require PIN to Edit or Delete Transactions" is enabled in Settings.
 */
export const PinVerifyModal: React.FC<PinVerifyModalProps> = ({
  isOpen,
  title = 'Security PIN Required',
  description = 'Enter your PIN to edit or delete this transaction.',
  onClose,
  onVerified,
}) => {
  const [pin, setPin] = useState('');
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setPin('');
      setError(null);
      setTimeout(() => inputRef.current?.focus(), 60);
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleConfirm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pin.trim()) {
      setError('Enter PIN');
      return;
    }
    const valid = await verifyPasscode(pin);
    if (valid) {
      setPin('');
      onVerified();
    } else {
      setError('Incorrect PIN');
      setPin('');
      inputRef.current?.focus();
    }
  };

  return (
    <div className="fixed inset-0 z-[10002] bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-4 font-sans">
      <div className="w-full max-w-xs bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden">
        <div className="px-5 py-3.5 bg-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-2">
            <KeyRound className="w-4 h-4 text-rose-400" />
            <h3 className="text-xs font-bold">{title}</h3>
          </div>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-white cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleConfirm} className="p-5 space-y-4">
          <p className="text-xs text-slate-600">{description}</p>
          <div>
            <input
              ref={inputRef}
              type="password"
              inputMode="numeric"
              maxLength={8}
              value={pin}
              onChange={(e) => {
                setPin(e.target.value.replace(/\D/g, ''));
                setError(null);
              }}
              placeholder="Enter PIN"
              className="w-full px-3 py-2 text-center text-base font-mono tracking-[0.35em] bg-slate-50 border border-slate-300 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-slate-900"
            />
            {error && <p className="mt-1.5 text-[11px] text-rose-600 text-center font-medium">{error}</p>}
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-1.5 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 rounded-lg cursor-pointer"
            >
              Verify &amp; Continue
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
