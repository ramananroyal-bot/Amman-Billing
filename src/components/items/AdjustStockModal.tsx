import React, { useState } from 'react';
import { X, SlidersHorizontal, Plus, Minus } from 'lucide-react';
import { Item } from '../../types';
import { adjustItemStock } from '../../db/indexedDB';
import { getTodayISO } from '../../utils/formatters';

interface AdjustStockModalProps {
  isOpen: boolean;
  onClose: () => void;
  item: Item | null;
  onAdjusted: () => void;
}

export const AdjustStockModal: React.FC<AdjustStockModalProps> = ({
  isOpen,
  onClose,
  item,
  onAdjusted,
}) => {
  const [adjustType, setAdjustType] = useState<'add' | 'reduce'>('add');
  const [qty, setQty] = useState('');
  const [date, setDate] = useState(getTodayISO());
  const [reason, setReason] = useState('Physical Stock Count Mismatch');
  const [customReason, setCustomReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  if (!isOpen || !item) return null;

  const standardReasons = [
    'Physical Stock Count Mismatch',
    'Damaged / Expired Goods',
    'Internal Consumption / Sample',
    'Opening Stock Correction',
    'Theft or Loss',
    'Other Reason',
  ];

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsedQty = parseFloat(qty);
    if (!parsedQty || parsedQty <= 0) {
      setError('Please enter a valid quantity greater than 0');
      return;
    }

    if (adjustType === 'reduce' && item.currentStock - parsedQty < 0) {
      // Optional warning if reducing below zero
      if (!confirm(`This adjustment will result in negative stock (${item.currentStock - parsedQty}). Do you want to continue?`)) {
        return;
      }
    }

    setIsSaving(true);
    setError(null);
    try {
      const finalReason = reason === 'Other Reason' ? customReason.trim() || 'Other' : reason;
      await adjustItemStock({
        itemId: item.id,
        itemName: item.name,
        date,
        type: adjustType,
        qty: parsedQty,
        reason: finalReason,
      });

      onAdjusted();
      onClose();
    } catch {
      setError('Failed to adjust stock');
    } finally {
      setIsSaving(false);
    }
  };

  const delta = parseFloat(qty) || 0;
  const projectedStock = adjustType === 'add' ? item.currentStock + delta : item.currentStock - delta;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
      <div className="w-full max-w-md bg-white rounded-xl shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-100">
        <div className="flex items-center justify-between px-5 py-3.5 bg-slate-900 text-white">
          <div className="flex items-center gap-2">
            <SlidersHorizontal className="w-4 h-4 text-rose-500" />
            <h3 className="text-sm font-bold">Adjust Item Stock</h3>
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
            <span className="text-slate-500">Item:</span>
            <div className="text-sm font-bold text-slate-900 mt-0.5">{item.name}</div>
            <div className="mt-1 flex items-center gap-3 font-mono text-[11px] text-slate-600">
              <span>Current Stock: <strong className="text-slate-900">{item.currentStock} {item.unit}</strong></span>
              <span>·</span>
              <span>New Stock: <strong className="text-rose-600">{projectedStock} {item.unit}</strong></span>
            </div>
          </div>

          {/* Add vs Reduce Segmented Control */}
          <div className="flex items-center gap-2 p-1 bg-slate-100 rounded-lg">
            <button
              type="button"
              onClick={() => setAdjustType('add')}
              className={`flex-1 py-1.5 rounded-md font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer ${
                adjustType === 'add' ? 'bg-white text-emerald-700 shadow-2xs' : 'text-slate-600'
              }`}
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Stock (+)</span>
            </button>
            <button
              type="button"
              onClick={() => setAdjustType('reduce')}
              className={`flex-1 py-1.5 rounded-md font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer ${
                adjustType === 'reduce' ? 'bg-white text-rose-700 shadow-2xs' : 'text-slate-600'
              }`}
            >
              <Minus className="w-3.5 h-3.5" />
              <span>Reduce Stock (-)</span>
            </button>
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">
              Quantity to {adjustType === 'add' ? 'Add' : 'Reduce'} ({item.unit}) *
            </label>
            <input
              type="number"
              step="any"
              min="0.01"
              value={qty}
              onChange={(e) => setQty(e.target.value)}
              placeholder="e.g. 5"
              className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-300 rounded-lg font-mono font-bold"
            />
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">Adjustment Date</label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-300 rounded-lg font-mono"
            />
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">Reason for Adjustment</label>
            <select
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-300 rounded-lg cursor-pointer"
            >
              {standardReasons.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </div>

          {reason === 'Other Reason' && (
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Specify Reason</label>
              <input
                type="text"
                value={customReason}
                onChange={(e) => setCustomReason(e.target.value)}
                placeholder="Enter details..."
                className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-300 rounded-lg"
              />
            </div>
          )}

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
              {isSaving ? 'Updating...' : 'Save Stock Adjustment'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
