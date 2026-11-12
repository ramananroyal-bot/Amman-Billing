import React, { useState } from 'react';
import { X, Users } from 'lucide-react';
import { INDIAN_STATES, getStateFromGSTIN, validateGSTIN } from '../../types/indianStates';
import { saveParty } from '../../db/indexedDB';
import { Party } from '../../types';

interface QuickAddPartyModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved: (party: Party) => void;
  defaultType?: 'Customer' | 'Supplier';
}

export const QuickAddPartyModal: React.FC<QuickAddPartyModalProps> = ({
  isOpen,
  onClose,
  onSaved,
  defaultType = 'Customer',
}) => {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [gstin, setGstin] = useState('');
  const [email, setEmail] = useState('');
  const [state, setState] = useState('Maharashtra');
  const [stateCode, setStateCode] = useState('27');
  const [billingAddress, setBillingAddress] = useState('');
  const [openingBalance, setOpeningBalance] = useState('0');
  const [balanceType, setBalanceType] = useState<'to_receive' | 'to_pay'>(
    defaultType === 'Customer' ? 'to_receive' : 'to_pay'
  );
  const [creditLimit, setCreditLimit] = useState('0');

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSaving, setIsSaving] = useState(false);

  if (!isOpen) return null;

  const handleGstinChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.toUpperCase().trim();
    setGstin(val);
    if (val.length >= 2) {
      const detected = getStateFromGSTIN(val);
      if (detected) {
        setState(detected.name);
        setStateCode(detected.code);
      }
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const errs: Record<string, string> = {};
    if (!name.trim()) errs.name = 'Party name is required';
    if (!phone.trim()) errs.phone = 'Phone number is required';
    if (gstin.trim() && !validateGSTIN(gstin.trim())) {
      errs.gstin = 'Invalid GSTIN format';
    }

    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      return;
    }

    setIsSaving(true);
    try {
      const saved = await saveParty({
        name: name.trim(),
        phone: phone.trim(),
        gstin: gstin.trim().toUpperCase(),
        email: email.trim(),
        group: defaultType,
        gstType: gstin.trim() ? 'Registered' : 'Unregistered',
        state,
        stateCode,
        billingAddress: billingAddress.trim(),
        shippingAddresses: billingAddress.trim() ? [billingAddress.trim()] : [],
        openingBalance: parseFloat(openingBalance) || 0,
        openingBalanceType: balanceType,
        creditLimit: parseFloat(creditLimit) || 0,
      });

      onSaved(saved);
      onClose();
    } catch {
      setErrors({ form: 'Failed to create party. Please try again.' });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="w-full max-w-lg bg-white rounded-xl shadow-2xl border border-slate-200 overflow-hidden my-6">
        <div className="flex items-center justify-between px-5 py-3.5 bg-slate-900 text-white">
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-rose-500" />
            <h3 className="text-sm font-bold">Add New Party ({defaultType})</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-white cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSave} className="p-5 space-y-4 max-h-[80vh] overflow-y-auto">
          {errors.form && (
            <div className="p-2.5 text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded-lg">
              {errors.form}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-slate-700 mb-1">Party / Business Name *</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Acme Corp or Rajesh Kumar"
                className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-slate-900"
              />
              {errors.name && <p className="mt-1 text-[11px] text-rose-600">{errors.name}</p>}
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Phone Number *</label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="10-digit mobile"
                maxLength={10}
                className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-slate-900 font-mono"
              />
              {errors.phone && <p className="mt-1 text-[11px] text-rose-600">{errors.phone}</p>}
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">GSTIN (Optional)</label>
              <input
                type="text"
                value={gstin}
                onChange={handleGstinChange}
                placeholder="15-character GSTIN"
                maxLength={15}
                className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-slate-900 uppercase font-mono"
              />
              {errors.gstin && <p className="mt-1 text-[11px] text-rose-600">{errors.gstin}</p>}
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">State *</label>
              <select
                value={stateCode}
                onChange={(e) => {
                  const s = INDIAN_STATES.find((st) => st.code === e.target.value);
                  if (s) {
                    setState(s.name);
                    setStateCode(s.code);
                  }
                }}
                className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-slate-900 cursor-pointer"
              >
                {INDIAN_STATES.map((s) => (
                  <option key={s.code} value={s.code}>
                    {s.code} - {s.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="party@email.com"
                className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-slate-900"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-slate-700 mb-1">Billing Address</label>
              <textarea
                rows={2}
                value={billingAddress}
                onChange={(e) => setBillingAddress(e.target.value)}
                placeholder="Street address, city, pincode"
                className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-slate-900"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Opening Balance (₹)</label>
              <input
                type="number"
                step="0.01"
                value={openingBalance}
                onChange={(e) => setOpeningBalance(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-slate-900 font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Balance Type</label>
              <select
                value={balanceType}
                onChange={(e) => setBalanceType(e.target.value as 'to_receive' | 'to_pay')}
                className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-slate-900 cursor-pointer"
              >
                <option value="to_receive">To Receive (Receivable)</option>
                <option value="to_pay">To Pay (Payable)</option>
              </select>
            </div>
          </div>

          <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="px-4 py-1.5 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 rounded-lg shadow-2xs transition-colors cursor-pointer"
            >
              {isSaving ? 'Saving...' : 'Save Party'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
