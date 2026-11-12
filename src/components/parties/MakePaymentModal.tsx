import React, { useState, useEffect } from 'react';
import { X, IndianRupee } from 'lucide-react';
import { Party, Transaction } from '../../types';
import { recordPartyPayment } from '../../db/indexedDB';
import { formatINR, getTodayISO } from '../../utils/formatters';

interface MakePaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  party: Party | null;
  targetTransaction?: Transaction | null;
  defaultType?: 'payment_in' | 'payment_out';
  onSaved: () => void;
}

export const MakePaymentModal: React.FC<MakePaymentModalProps> = ({
  isOpen,
  onClose,
  party,
  targetTransaction,
  defaultType = 'payment_in',
  onSaved,
}) => {
  const [amount, setAmount] = useState('');
  const [paymentType, setPaymentType] = useState<'cash' | 'upi' | 'bank_transfer' | 'cheque'>('cash');
  const [type, setType] = useState<'payment_in' | 'payment_out'>(defaultType);
  const [date, setDate] = useState(getTodayISO());
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (isOpen) {
      if (targetTransaction) {
        setAmount(String(targetTransaction.balanceDue || ''));
        setType(targetTransaction.type === 'purchase_bill' ? 'payment_out' : 'payment_in');
        setNotes(`Payment against ${targetTransaction.invoiceNo}`);
      } else {
        setAmount('');
        setType(defaultType);
        setNotes('');
      }
      setDate(getTodayISO());
      setError(null);
    }
  }, [isOpen, targetTransaction, defaultType]);

  if (!isOpen || !party) return null;

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsedAmount = parseFloat(amount);
    if (!parsedAmount || parsedAmount <= 0) {
      setError('Please enter a valid amount greater than 0');
      return;
    }

    if (targetTransaction && targetTransaction.balanceDue !== undefined) {
      if (parsedAmount > targetTransaction.balanceDue) {
        setError(`Amount cannot exceed the balance due of ${formatINR(targetTransaction.balanceDue)}`);
        return;
      }
    }

    setIsSaving(true);
    setError(null);
    try {
      await recordPartyPayment({
        partyId: party.id,
        partyName: party.name,
        amount: parsedAmount,
        paymentType,
        type,
        date,
        notes,
        targetTransactionId: targetTransaction?.id,
      });

      onSaved();
      onClose();
    } catch {
      setError('Failed to record payment');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
      <div className="w-full max-w-md bg-white rounded-xl shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-100">
        <div className="flex items-center justify-between px-5 py-3.5 bg-slate-900 text-white">
          <div className="flex items-center gap-2">
            <IndianRupee className="w-4 h-4 text-emerald-400" />
            <h3 className="text-sm font-bold">
              {type === 'payment_in' ? 'Receive Payment (Payment In)' : 'Make Payment (Payment Out)'}
            </h3>
          </div>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-white cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSave} className="p-5 space-y-4 text-xs">
          {error && (
            <div className="p-2.5 bg-rose-50 border border-rose-200 text-rose-700 rounded-lg">
              {error}
            </div>
          )}

          <div>
            <span className="text-slate-500">Party:</span>
            <div className="text-sm font-bold text-slate-900 mt-0.5">{party.name}</div>
          </div>

          <div className="flex items-center gap-2 p-1 bg-slate-100 rounded-lg">
            <button
              type="button"
              onClick={() => setType('payment_in')}
              className={`flex-1 py-1.5 rounded-md font-semibold transition-colors cursor-pointer ${
                type === 'payment_in' ? 'bg-white text-emerald-700 shadow-2xs' : 'text-slate-600'
              }`}
            >
              Receive Payment (+ In)
            </button>
            <button
              type="button"
              onClick={() => setType('payment_out')}
              className={`flex-1 py-1.5 rounded-md font-semibold transition-colors cursor-pointer ${
                type === 'payment_out' ? 'bg-white text-rose-700 shadow-2xs' : 'text-slate-600'
              }`}
            >
              Make Payment (- Out)
            </button>
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">Amount (₹) *</label>
            <input
              type="number"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
              className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-300 rounded-lg font-mono font-bold"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Payment Mode</label>
              <select
                value={paymentType}
                onChange={(e) => setPaymentType(e.target.value as 'cash' | 'upi' | 'bank_transfer' | 'cheque')}
                className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-300 rounded-lg cursor-pointer uppercase font-mono"
              >
                <option value="cash">Cash</option>
                <option value="upi">UPI / QR</option>
                <option value="bank_transfer">Bank Transfer</option>
                <option value="cheque">Cheque</option>
              </select>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Date</label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-300 rounded-lg font-mono"
              />
            </div>
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">Notes / Reference No</label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Received via GPay, Chq #123456"
              className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-300 rounded-lg"
            />
          </div>

          <div className="pt-2 border-t border-slate-200 flex justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-1.5 text-xs text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="px-4 py-1.5 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 disabled:opacity-50 rounded-lg shadow-2xs cursor-pointer"
            >
              {isSaving ? 'Recording...' : 'Save Payment'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
