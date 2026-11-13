import React, { useState, useEffect } from 'react';
import { X, Building2 } from 'lucide-react';
import { INDIAN_STATES, validateGSTIN, getStateFromGSTIN } from '../../types/indianStates';
import { createNewFirmDB } from '../../db/indexedDB';

interface CreateFirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onFirmCreated: () => Promise<void>;
}

/**
 * Modal for creating an additional isolated Business Firm with its own IndexedDB database,
 * independent number series, items, parties, transactions, and settings.
 */
export const CreateFirmModal: React.FC<CreateFirmModalProps> = ({
  isOpen,
  onClose,
  onFirmCreated,
}) => {
  const [businessName, setBusinessName] = useState('');
  const [gstin, setGstin] = useState('');
  const [stateName, setStateName] = useState('Tamil Nadu');
  const [stateCode, setStateCode] = useState('33');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setBusinessName('');
      setGstin('');
      setStateName('Tamil Nadu');
      setStateCode('33');
      setPhone('');
      setAddress('');
      setError(null);
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleGSTINChange = (val: string) => {
    const clean = val.toUpperCase().replace(/[^0-9A-Z]/g, '').slice(0, 15);
    setGstin(clean);
    const detected = getStateFromGSTIN(clean);
    if (detected) {
      setStateName(detected.name);
      setStateCode(detected.code);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!businessName.trim()) {
      setError('Firm / Business name is required');
      return;
    }
    if (gstin.trim() && !validateGSTIN(gstin.trim())) {
      setError('Enter a valid 15-character GSTIN or leave it blank');
      return;
    }

    setIsCreating(true);
    setError(null);
    try {
      await createNewFirmDB({
        businessName: businessName.trim(),
        gstin: gstin.trim(),
        state: stateName,
        stateCode,
        phone: phone.trim(),
        address: address.trim(),
      });
      await onFirmCreated();
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Failed to create firm');
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 backdrop-blur-xs p-4 font-sans">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden">
        <div className="px-5 py-4 bg-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-rose-600/30 text-rose-400 flex items-center justify-center">
              <Building2 className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold">Add New Business Firm</h3>
              <p className="text-[11px] text-slate-400">Each firm keeps separate data, settings &amp; invoice numbers</p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-white cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-3.5 text-xs">
          {error && (
            <div className="p-2.5 bg-rose-50 border border-rose-200 text-rose-700 rounded-lg font-medium">
              {error}
            </div>
          )}

          <div>
            <label className="block font-semibold text-slate-700 mb-1">
              Firm / Business Name <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              value={businessName}
              onChange={(e) => setBusinessName(e.target.value)}
              placeholder="e.g. Sri Murugan Enterprises"
              className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-slate-900"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">GSTIN (Optional)</label>
              <input
                type="text"
                value={gstin}
                onChange={(e) => handleGSTINChange(e.target.value)}
                placeholder="33ABCDE1234F1Z5"
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg font-mono uppercase"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Phone</label>
              <input
                type="text"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="e.g. 9876543210"
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg font-mono"
              />
            </div>
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">Registered State</label>
            <select
              value={stateName}
              onChange={(e) => {
                const st = INDIAN_STATES.find((s) => s.name === e.target.value);
                if (st) {
                  setStateName(st.name);
                  setStateCode(st.code);
                }
              }}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg cursor-pointer"
            >
              {INDIAN_STATES.map((s) => (
                <option key={s.code} value={s.name}>
                  {s.code} - {s.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">Address</label>
            <textarea
              rows={2}
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="Street, City, Pincode..."
              className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg"
            />
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isCreating}
              className="px-4 py-2 font-semibold text-white bg-rose-600 hover:bg-rose-700 disabled:opacity-50 rounded-lg shadow-xs cursor-pointer"
            >
              {isCreating ? 'Creating...' : 'Create & Switch Firm'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
