import React, { useState, useEffect } from 'react';
import { X, IndianRupee, Link as LinkIcon, Check, AlertCircle } from 'lucide-react';
import { Party, Transaction, BusinessProfile } from '../../types';
import {
  getParties,
  getBusinessProfile,
  getUnpaidInvoicesForParty,
  recordPartyPayment,
  calculatePartyBalance,
} from '../../db/indexedDB';
import { formatINR, getTodayISO, formatDate } from '../../utils/formatters';

interface PaymentRecordModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultType?: 'payment_in' | 'payment_out';
  initialParty?: Party | null;
  targetTransaction?: Transaction | null;
  paymentToEdit?: Transaction | null;
  onSaved: () => void;
}

export const PaymentRecordModal: React.FC<PaymentRecordModalProps> = ({
  isOpen,
  onClose,
  defaultType = 'payment_in',
  initialParty,
  targetTransaction,
  paymentToEdit,
  onSaved,
}) => {
  const [parties, setParties] = useState<Party[]>([]);
  const [selectedPartyId, setSelectedPartyId] = useState<string>('');
  const [selectedPartyBalance, setSelectedPartyBalance] = useState<{ balance: number; type: 'to_receive' | 'to_pay' } | null>(null);

  const [type, setType] = useState<'payment_in' | 'payment_out'>(defaultType);
  const [amount, setAmount] = useState('');
  const [paymentType, setPaymentType] = useState<'cash' | 'upi' | 'bank_transfer' | 'cheque'>('cash');
  const [receiptNo, setReceiptNo] = useState('');
  const [referenceNo, setReferenceNo] = useState('');
  const [date, setDate] = useState(getTodayISO());
  const [notes, setNotes] = useState('');

  // Unpaid invoices / bills for linking
  const [unpaidInvoices, setUnpaidInvoices] = useState<Transaction[]>([]);
  const [allocations, setAllocations] = useState<Record<string, number>>({});
  const [showLinkSection, setShowLinkSection] = useState(false);

  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Load parties on open
  useEffect(() => {
    if (!isOpen) return;

    let active = true;
    async function loadData() {
      try {
        const partyList = await getParties();
        if (!active) return;
        setParties(partyList);

        const profile = await getBusinessProfile();
        if (!active) return;

        if (paymentToEdit) {
          setType(paymentToEdit.type === 'payment_out' ? 'payment_out' : 'payment_in');
          setSelectedPartyId(paymentToEdit.partyId);
          setAmount(String(paymentToEdit.totalAmount || ''));
          const pMode = paymentToEdit.paymentType;
          if (pMode === 'upi' || pMode === 'bank_transfer' || pMode === 'cheque') {
            setPaymentType(pMode);
          } else {
            setPaymentType('cash');
          }
          setReceiptNo(paymentToEdit.invoiceNo || paymentToEdit.receiptNo || '');
          setReferenceNo(paymentToEdit.referenceNo || '');
          setDate(paymentToEdit.date || getTodayISO());
          setNotes(paymentToEdit.description || '');

          const allocMap: Record<string, number> = {};
          if (paymentToEdit.invoiceLinks) {
            for (const link of paymentToEdit.invoiceLinks) {
              allocMap[link.invoiceId] = link.amountAllocated;
            }
          }
          setAllocations(allocMap);
          setShowLinkSection(Boolean(paymentToEdit.invoiceLinks && paymentToEdit.invoiceLinks.length > 0));
        } else if (targetTransaction) {
          const isSale = targetTransaction.type === 'sale_invoice';
          const pType: 'payment_in' | 'payment_out' = isSale ? 'payment_in' : 'payment_out';
          setType(pType);
          setSelectedPartyId(targetTransaction.partyId);
          const bal = targetTransaction.balanceDue !== undefined ? targetTransaction.balanceDue : targetTransaction.totalAmount;
          setAmount(String(bal > 0 ? bal : targetTransaction.totalAmount));
          setPaymentType('cash');
          setReferenceNo('');
          setDate(getTodayISO());
          setNotes(`Payment against ${targetTransaction.invoiceNo}`);

          // Suggest next receipt #
          const prefix = isSale ? (profile?.paymentInPrefix || 'REC-') : (profile?.paymentOutPrefix || 'PAY-');
          const nextNum = isSale ? (profile?.nextPaymentInNumber || 1) : (profile?.nextPaymentOutNumber || 1);
          setReceiptNo(`${prefix}${String(nextNum).padStart(4, '0')}`);

          setAllocations({ [targetTransaction.id]: bal > 0 ? bal : targetTransaction.totalAmount });
          setShowLinkSection(true);
        } else {
          setType(defaultType);
          setSelectedPartyId(initialParty ? initialParty.id : '');
          setAmount('');
          setPaymentType('cash');
          setReferenceNo('');
          setDate(getTodayISO());
          setNotes('');
          setAllocations({});
          setShowLinkSection(false);

          // Suggest next receipt #
          const isSale = defaultType === 'payment_in';
          const prefix = isSale ? (profile?.paymentInPrefix || 'REC-') : (profile?.paymentOutPrefix || 'PAY-');
          const nextNum = isSale ? (profile?.nextPaymentInNumber || 1) : (profile?.nextPaymentOutNumber || 1);
          setReceiptNo(`${prefix}${String(nextNum).padStart(4, '0')}`);
        }
      } catch (e) {
        console.error('Failed to load data for payment modal', e);
      }
    }

    loadData();
    setError(null);

    return () => {
      active = false;
    };
  }, [isOpen, defaultType, initialParty, targetTransaction, paymentToEdit]);

  // Load selected party balance & unpaid invoices when party or type changes
  useEffect(() => {
    if (!selectedPartyId) {
      setSelectedPartyBalance(null);
      setUnpaidInvoices([]);
      return;
    }

    let active = true;
    async function loadPartyDetails() {
      try {
        const party = parties.find((p) => p.id === selectedPartyId);
        if (party) {
          const bal = await calculatePartyBalance(party);
          if (active) setSelectedPartyBalance(bal);
        }

        const invType = type === 'payment_in' ? 'sale_invoice' : 'purchase_bill';
        const unpaids = await getUnpaidInvoicesForParty(selectedPartyId, invType);
        if (active) {
          // If editing or targetTx present, include targetTx in list if not already there
          if (targetTransaction && !unpaids.some((u) => u.id === targetTransaction.id)) {
            unpaids.unshift(targetTransaction);
          }
          setUnpaidInvoices(unpaids);
        }
      } catch (err) {
        console.error('Failed to load unpaid invoices for party', err);
      }
    }

    loadPartyDetails();

    return () => {
      active = false;
    };
  }, [selectedPartyId, type, parties, targetTransaction]);

  if (!isOpen) return null;

  // Auto allocate payment amount to unpaid invoices from oldest to newest
  const handleAutoAllocate = () => {
    const totalPay = parseFloat(amount) || 0;
    if (totalPay <= 0) return;

    let remaining = totalPay;
    const newAlloc: Record<string, number> = {};

    for (const inv of unpaidInvoices) {
      if (remaining <= 0) break;
      const due = inv.balanceDue !== undefined ? inv.balanceDue : inv.totalAmount;
      if (due <= 0) continue;
      const allocated = Math.min(remaining, due);
      newAlloc[inv.id] = Math.round(allocated * 100) / 100;
      remaining = Math.round((remaining - allocated) * 100) / 100;
    }

    setAllocations(newAlloc);
    setShowLinkSection(true);
  };

  const totalAllocated = Object.values(allocations).reduce((sum, v) => sum + (v || 0), 0);
  const parsedAmount = parseFloat(amount) || 0;
  const unallocatedAmount = Math.max(0, Math.round((parsedAmount - totalAllocated) * 100) / 100);

  const handleAllocationChange = (invId: string, val: string) => {
    const num = parseFloat(val);
    const updated = { ...allocations };
    if (isNaN(num) || num <= 0) {
      delete updated[invId];
    } else {
      updated[invId] = num;
    }
    setAllocations(updated);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!selectedPartyId) {
      setError('Please select a party');
      return;
    }

    if (!parsedAmount || parsedAmount <= 0) {
      setError('Please enter a valid amount greater than 0');
      return;
    }

    if (totalAllocated > parsedAmount) {
      setError(`Allocated amount (₹${totalAllocated}) cannot exceed payment amount (₹${parsedAmount})`);
      return;
    }

    const party = parties.find((p) => p.id === selectedPartyId);
    if (!party) {
      setError('Selected party not found');
      return;
    }

    // Build invoiceLinks array
    const invoiceLinks = Object.entries(allocations)
      .filter(([_, allocVal]) => allocVal > 0)
      .map(([invId, allocVal]) => {
        const inv = unpaidInvoices.find((i) => i.id === invId);
        return {
          invoiceId: invId,
          invoiceNo: inv?.invoiceNo || 'INV',
          amountAllocated: allocVal,
        };
      });

    setIsSaving(true);
    try {
      await recordPartyPayment({
        id: paymentToEdit?.id,
        partyId: party.id,
        partyName: party.name,
        amount: parsedAmount,
        paymentType,
        type,
        date,
        receiptNo: receiptNo.trim() || undefined,
        referenceNo: referenceNo.trim() || undefined,
        notes: notes.trim() || undefined,
        invoiceLinks,
      });

      onSaved();
      onClose();
    } catch (err: any) {
      console.error('Error saving payment record', err);
      setError(err?.message || 'Failed to save payment record');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="w-full max-w-xl bg-white rounded-xl shadow-2xl border border-slate-200 overflow-hidden my-8 animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 bg-slate-900 text-white">
          <div className="flex items-center gap-2.5">
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${type === 'payment_in' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400'}`}>
              <IndianRupee className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold">
                {paymentToEdit ? 'Edit Payment' : type === 'payment_in' ? 'Payment-In (Receive Money)' : 'Payment-Out (Pay Money)'}
              </h3>
              <p className="text-[11px] text-slate-400">
                {type === 'payment_in' ? 'Record money received from customer' : 'Record money paid to vendor/supplier'}
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

          {/* Mode Switcher: Payment-In / Payment-Out */}
          {!paymentToEdit && !targetTransaction && (
            <div className="flex items-center gap-2 p-1 bg-slate-100 rounded-lg">
              <button
                type="button"
                onClick={() => setType('payment_in')}
                className={`flex-1 py-1.5 rounded-md font-semibold text-xs transition-all cursor-pointer ${
                  type === 'payment_in' ? 'bg-white text-emerald-700 shadow-2xs font-bold' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                + Payment-In (Receive)
              </button>
              <button
                type="button"
                onClick={() => setType('payment_out')}
                className={`flex-1 py-1.5 rounded-md font-semibold text-xs transition-all cursor-pointer ${
                  type === 'payment_out' ? 'bg-white text-rose-700 shadow-2xs font-bold' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                - Payment-Out (Pay)
              </button>
            </div>
          )}

          {/* Party Selection & Current Balance */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="font-semibold text-slate-700">
                Party Name <span className="text-rose-500">*</span>
              </label>
              {selectedPartyBalance && (
                <span className={`text-[11px] font-semibold ${selectedPartyBalance.type === 'to_receive' ? 'text-emerald-600' : 'text-rose-600'}`}>
                  Current Balance: {formatINR(selectedPartyBalance.balance)} ({selectedPartyBalance.type === 'to_receive' ? 'Receivable' : 'Payable'})
                </span>
              )}
            </div>
            <select
              value={selectedPartyId}
              onChange={(e) => setSelectedPartyId(e.target.value)}
              disabled={Boolean(targetTransaction || paymentToEdit)}
              required
              className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-rose-500 focus:border-rose-500"
            >
              <option value="">-- Select Party --</option>
              {parties.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} {p.phone ? `(${p.phone})` : ''}
                </option>
              ))}
            </select>
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

          {/* Row: Payment Mode & Receipt # */}
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
              <label className="block font-semibold text-slate-700 mb-1">
                {type === 'payment_in' ? 'Receipt #' : 'Payment Voucher #'}
              </label>
              <input
                type="text"
                value={receiptNo}
                onChange={(e) => setReceiptNo(e.target.value)}
                placeholder={type === 'payment_in' ? 'REC-0001' : 'PAY-0001'}
                className="w-full px-3 py-2 text-xs font-mono bg-white border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-rose-500"
              />
            </div>
          </div>

          {/* Reference No & Notes */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Reference / Cheque / UTR # (Optional)
              </label>
              <input
                type="text"
                value={referenceNo}
                onChange={(e) => setReferenceNo(e.target.value)}
                placeholder="e.g. UTR-9823412 or Chq #000123"
                className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Notes / Description (Optional)</label>
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Optional remarks"
                className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg"
              />
            </div>
          </div>

          {/* Optional: Link to Invoices / Bills */}
          <div className="pt-2 border-t border-slate-200">
            <div className="flex items-center justify-between">
              <button
                type="button"
                onClick={() => setShowLinkSection(!showLinkSection)}
                className="flex items-center gap-1.5 text-xs font-semibold text-rose-600 hover:text-rose-700 cursor-pointer"
              >
                <LinkIcon className="w-3.5 h-3.5" />
                <span>
                  {showLinkSection ? 'Hide Invoice Linking' : 'Link to Unpaid Invoices / Bills'}
                  {unpaidInvoices.length > 0 && ` (${unpaidInvoices.length} unpaid)`}
                </span>
              </button>

              {showLinkSection && unpaidInvoices.length > 0 && parsedAmount > 0 && (
                <button
                  type="button"
                  onClick={handleAutoAllocate}
                  className="px-2 py-1 text-[11px] font-semibold text-white bg-slate-800 hover:bg-slate-700 rounded-md cursor-pointer transition-colors"
                >
                  Auto-Allocate
                </button>
              )}
            </div>

            {showLinkSection && (
              <div className="mt-2 space-y-2">
                {unpaidInvoices.length === 0 ? (
                  <p className="text-[11px] text-slate-400 italic bg-slate-50 p-2.5 rounded-lg border border-slate-200">
                    No outstanding unpaid {type === 'payment_in' ? 'sale invoices' : 'purchase bills'} found for this party. This payment will be recorded as on-account advance.
                  </p>
                ) : (
                  <div className="border border-slate-200 rounded-lg overflow-hidden">
                    <table className="w-full text-left text-[11px]">
                      <thead className="bg-slate-100 text-slate-600 font-semibold border-b border-slate-200">
                        <tr>
                          <th className="py-2 px-3">Date</th>
                          <th className="py-2 px-3">{type === 'payment_in' ? 'Invoice #' : 'Bill #'}</th>
                          <th className="py-2 px-3 text-right">Total (₹)</th>
                          <th className="py-2 px-3 text-right">Balance Due (₹)</th>
                          <th className="py-2 px-3 text-right w-28">Allocate (₹)</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {unpaidInvoices.map((inv) => {
                          const due = inv.balanceDue !== undefined ? inv.balanceDue : inv.totalAmount;
                          const allocVal = allocations[inv.id] || '';
                          return (
                            <tr key={inv.id} className="hover:bg-slate-50">
                              <td className="py-1.5 px-3 font-mono text-slate-600">{formatDate(inv.date)}</td>
                              <td className="py-1.5 px-3 font-bold font-mono text-slate-900">{inv.invoiceNo}</td>
                              <td className="py-1.5 px-3 text-right font-mono">{formatINR(inv.totalAmount)}</td>
                              <td className="py-1.5 px-3 text-right font-mono font-semibold text-rose-600">{formatINR(due)}</td>
                              <td className="py-1.5 px-3 text-right">
                                <input
                                  type="number"
                                  step="0.01"
                                  min="0"
                                  max={due}
                                  value={allocVal}
                                  onChange={(e) => handleAllocationChange(inv.id, e.target.value)}
                                  placeholder="0.00"
                                  className="w-full text-right px-2 py-1 text-xs font-mono font-semibold bg-white border border-slate-300 rounded-md focus:ring-1 focus:ring-rose-500"
                                />
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>

                    {/* Allocation summary footer */}
                    <div className="flex items-center justify-between px-3 py-2 bg-slate-50 border-t border-slate-200 text-[11px]">
                      <span className="text-slate-500">
                        Total Allocated: <strong className="font-mono text-slate-900">{formatINR(totalAllocated)}</strong>
                      </span>
                      <span className="text-slate-500">
                        On-Account Advance: <strong className="font-mono text-emerald-600">{formatINR(unallocatedAmount)}</strong>
                      </span>
                    </div>
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
              <span>{isSaving ? 'Saving...' : 'Save Payment'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
