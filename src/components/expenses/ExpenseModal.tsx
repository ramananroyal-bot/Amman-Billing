import React, { useState, useEffect } from 'react';
import { X, Receipt, Check, AlertCircle, Plus, IndianRupee } from 'lucide-react';
import { Expense, ExpenseCategory, Party, PaymentType } from '../../types';
import {
  getExpenseCategories,
  saveExpenseCategory,
  saveExpense,
  getParties,
  getBusinessProfile,
} from '../../db/indexedDB';
import { getTodayISO, formatINR } from '../../utils/formatters';

interface ExpenseModalProps {
  isOpen: boolean;
  onClose: () => void;
  expenseToEdit?: Expense | null;
  onSaved: () => void;
}

export const ExpenseModal: React.FC<ExpenseModalProps> = ({
  isOpen,
  onClose,
  expenseToEdit,
  onSaved,
}) => {
  const [categories, setCategories] = useState<ExpenseCategory[]>([]);
  const [parties, setParties] = useState<Party[]>([]);

  const [category, setCategory] = useState('');
  const [newCategoryName, setNewCategoryName] = useState('');
  const [showAddCategoryInput, setShowAddCategoryInput] = useState(false);

  const [date, setDate] = useState(getTodayISO());
  const [amount, setAmount] = useState('');
  const [paymentType, setPaymentType] = useState<PaymentType>('cash');
  const [partyId, setPartyId] = useState('');
  const [notes, setNotes] = useState('');
  const [expenseNo, setExpenseNo] = useState('');

  // Optional GST / ITC
  const [hasGST, setHasGST] = useState(false);
  const [gstin, setGstin] = useState('');
  const [taxRate, setTaxRate] = useState<number>(18);

  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!isOpen) return;

    let active = true;
    async function loadData() {
      try {
        const [catList, partyList, profile] = await Promise.all([
          getExpenseCategories(),
          getParties(),
          getBusinessProfile(),
        ]);
        if (!active) return;
        setCategories(catList);
        setParties(partyList);

        if (expenseToEdit) {
          setCategory(expenseToEdit.category);
          setDate(expenseToEdit.date || getTodayISO());
          setAmount(String(expenseToEdit.amount || ''));
          setPaymentType(expenseToEdit.paymentType || 'cash');
          setPartyId(expenseToEdit.partyId || '');
          setNotes(expenseToEdit.notes || '');
          setExpenseNo(expenseToEdit.expenseNo || '');
          if (expenseToEdit.gstAmount || expenseToEdit.gstin) {
            setHasGST(true);
            setGstin(expenseToEdit.gstin || '');
            setTaxRate(expenseToEdit.taxRate || 18);
          } else {
            setHasGST(false);
            setGstin('');
            setTaxRate(18);
          }
        } else {
          setCategory(catList[0]?.name || 'Miscellaneous');
          setDate(getTodayISO());
          setAmount('');
          setPaymentType('cash');
          setPartyId('');
          setNotes('');
          setHasGST(false);
          setGstin('');
          setTaxRate(18);

          // Suggest next expense #
          const prefix = profile?.expensePrefix || 'EXP-';
          const nextNum = profile?.nextExpenseNumber || 1;
          setExpenseNo(`${prefix}${String(nextNum).padStart(4, '0')}`);
        }
      } catch (e) {
        console.error('Failed to load expense modal data', e);
      }
    }

    loadData();
    setError(null);
    setShowAddCategoryInput(false);

    return () => {
      active = false;
    };
  }, [isOpen, expenseToEdit]);

  if (!isOpen) return null;

  const handleAddNewCategory = async () => {
    if (!newCategoryName.trim()) return;
    try {
      const created = await saveExpenseCategory({ name: newCategoryName.trim() });
      setCategories([...categories, created]);
      setCategory(created.name);
      setNewCategoryName('');
      setShowAddCategoryInput(false);
    } catch (e) {
      console.error('Failed to create category', e);
    }
  };

  const parsedAmount = parseFloat(amount) || 0;
  const calculatedGST = hasGST
    ? Math.round(((parsedAmount * (taxRate / 100)) / (1 + taxRate / 100)) * 100) / 100
    : undefined;

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!category.trim()) {
      setError('Please select or add an expense category');
      return;
    }

    if (!parsedAmount || parsedAmount <= 0) {
      setError('Please enter a valid expense amount greater than 0');
      return;
    }

    const selectedParty = parties.find((p) => p.id === partyId);

    setIsSaving(true);
    try {
      await saveExpense({
        id: expenseToEdit?.id,
        expenseNo: expenseNo.trim() || undefined,
        category: category.trim(),
        date,
        amount: parsedAmount,
        paymentType,
        partyId: partyId || undefined,
        partyName: selectedParty?.name || undefined,
        notes: notes.trim() || undefined,
        gstAmount: calculatedGST,
        taxRate: hasGST ? taxRate : undefined,
        gstin: hasGST && gstin.trim() ? gstin.trim().toUpperCase() : undefined,
      });

      onSaved();
      onClose();
    } catch (err: any) {
      console.error('Failed to save expense', err);
      setError(err?.message || 'Failed to save expense');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="w-full max-w-lg bg-white rounded-xl shadow-2xl border border-slate-200 overflow-hidden my-8 animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 bg-slate-900 text-white">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-rose-500/20 text-rose-400 flex items-center justify-center">
              <Receipt className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold">
                {expenseToEdit ? 'Edit Business Expense' : 'Record Business Expense'}
              </h3>
              <p className="text-[11px] text-slate-400">
                Track overheads, rent, salaries, and operational costs
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-md hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSave} className="p-5 space-y-4 text-xs">
          {error && (
            <div className="flex items-center gap-2 p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-lg">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
              <span>{error}</span>
            </div>
          )}

          {/* Category with Inline Add */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="font-semibold text-slate-700">
                Expense Category <span className="text-rose-500">*</span>
              </label>
              {!showAddCategoryInput && (
                <button
                  type="button"
                  onClick={() => setShowAddCategoryInput(true)}
                  className="text-[11px] text-rose-600 font-semibold hover:text-rose-700 cursor-pointer flex items-center gap-1"
                >
                  <Plus className="w-3 h-3" />
                  <span>New Category</span>
                </button>
              )}
            </div>

            {showAddCategoryInput ? (
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={newCategoryName}
                  onChange={(e) => setNewCategoryName(e.target.value)}
                  placeholder="Enter category name (e.g. Courier & Freight)"
                  className="flex-1 px-3 py-1.5 text-xs bg-white border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-rose-500"
                />
                <button
                  type="button"
                  onClick={handleAddNewCategory}
                  className="px-3 py-1.5 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-lg cursor-pointer"
                >
                  Add
                </button>
                <button
                  type="button"
                  onClick={() => setShowAddCategoryInput(false)}
                  className="px-2.5 py-1.5 text-xs text-slate-500 hover:bg-slate-100 rounded-lg cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                required
                className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-rose-500"
              >
                {categories.map((c) => (
                  <option key={c.id} value={c.name}>
                    {c.name}
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Row: Amount & Date */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Amount (₹) <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <span className="absolute left-3 top-2 text-slate-400 font-bold">₹</span>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  required
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="0.00"
                  className="w-full pl-7 pr-3 py-2 text-xs font-mono font-bold text-slate-900 bg-white border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-rose-500"
                />
              </div>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Date <span className="text-rose-500">*</span>
              </label>
              <input
                type="date"
                required
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-rose-500"
              />
            </div>
          </div>

          {/* Row: Payment Mode & Expense # */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Payment Mode</label>
              <select
                value={paymentType}
                onChange={(e) => setPaymentType(e.target.value as any)}
                className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-rose-500"
              >
                <option value="cash">Cash</option>
                <option value="upi">UPI (GPay / PhonePe / Paytm)</option>
                <option value="bank_transfer">Bank Transfer (IMPS / NEFT)</option>
                <option value="cheque">Cheque</option>
              </select>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Expense Voucher #</label>
              <input
                type="text"
                value={expenseNo}
                onChange={(e) => setExpenseNo(e.target.value)}
                placeholder="EXP-0001"
                className="w-full px-3 py-2 text-xs font-mono bg-white border border-slate-300 rounded-lg"
              />
            </div>
          </div>

          {/* Paid To / Party (Optional) & Notes */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Paid To (Optional Party)
              </label>
              <select
                value={partyId}
                onChange={(e) => setPartyId(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg"
              >
                <option value="">-- None / Direct Expense --</option>
                {parties.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Notes / Description</label>
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="e.g. Office electricity bill for June"
                className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg"
              />
            </div>
          </div>

          {/* Optional GST Claim Section */}
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-2">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={hasGST}
                onChange={(e) => setHasGST(e.target.checked)}
                className="w-4 h-4 text-rose-600 rounded-sm border-slate-300 focus:ring-rose-500"
              />
              <span className="font-semibold text-slate-800">
                Claim GST Input Tax Credit (ITC) for this Expense
              </span>
            </label>

            {hasGST && (
              <div className="grid grid-cols-2 gap-3 pt-2">
                <div>
                  <label className="block font-medium text-slate-600 mb-1">Vendor GSTIN</label>
                  <input
                    type="text"
                    maxLength={15}
                    value={gstin}
                    onChange={(e) => setGstin(e.target.value.toUpperCase())}
                    placeholder="27AAAAA0000A1Z5"
                    className="w-full px-2.5 py-1.5 text-xs font-mono uppercase bg-white border border-slate-300 rounded-md"
                  />
                </div>
                <div>
                  <label className="block font-medium text-slate-600 mb-1">GST Rate</label>
                  <select
                    value={taxRate}
                    onChange={(e) => setTaxRate(Number(e.target.value))}
                    className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded-md"
                  >
                    <option value={5}>5%</option>
                    <option value={12}>12%</option>
                    <option value={18}>18%</option>
                    <option value={28}>28%</option>
                  </select>
                </div>
                {calculatedGST !== undefined && (
                  <div className="col-span-2 text-[11px] text-slate-600 font-medium">
                    Calculated Tax Included: <strong className="font-mono text-emerald-700">{formatINR(calculatedGST)}</strong>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Action buttons */}
          <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              disabled={isSaving}
              className="px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="flex items-center gap-1.5 px-5 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 disabled:opacity-50 rounded-lg shadow-sm transition-all cursor-pointer"
            >
              <Check className="w-3.5 h-3.5" />
              <span>{isSaving ? 'Saving...' : 'Save Expense'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
