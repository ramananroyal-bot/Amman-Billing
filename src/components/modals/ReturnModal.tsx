import React, { useState, useEffect } from 'react';
import { X, RotateCcw, Plus, Trash2, Check, AlertCircle, FileText } from 'lucide-react';
import { Transaction, Party, Item, TransactionItem, BusinessProfile } from '../../types';
import {
  getParties,
  getItems,
  getBusinessProfile,
  saveTransaction,
} from '../../db/indexedDB';
import { formatINR, getTodayISO } from '../../utils/formatters';

interface ReturnLineItem extends TransactionItem {
  maxQty?: number; // Original sold or bought qty (if converted)
}

interface ReturnModalProps {
  isOpen: boolean;
  onClose: () => void;
  mode: 'sale_return' | 'purchase_return';
  sourceTransaction?: Transaction | null; // If converted from an existing invoice/bill
  returnToEdit?: Transaction | null;
  businessProfile: BusinessProfile | null;
  onSaved: () => void;
}

export const ReturnModal: React.FC<ReturnModalProps> = ({
  isOpen,
  onClose,
  mode,
  sourceTransaction,
  returnToEdit,
  businessProfile,
  onSaved,
}) => {
  const [parties, setParties] = useState<Party[]>([]);
  const [items, setItems] = useState<Item[]>([]);

  const [partyId, setPartyId] = useState('');
  const [returnNo, setReturnNo] = useState('');
  const [date, setDate] = useState(getTodayISO());
  const [returnReason, setReturnReason] = useState('Damaged / Defective Goods');
  const [notes, setNotes] = useState('');
  const [lines, setLines] = useState<ReturnLineItem[]>([]);

  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const isSaleReturn = mode === 'sale_return';
  const title = isSaleReturn ? 'Sale Return / Credit Note' : 'Purchase Return / Debit Note';

  // Load parties and items
  useEffect(() => {
    if (!isOpen) return;

    let active = true;
    async function loadResources() {
      try {
        const [partyList, itemList] = await Promise.all([getParties(), getItems()]);
        if (!active) return;
        setParties(partyList);
        setItems(itemList);

        if (returnToEdit) {
          setPartyId(returnToEdit.partyId);
          setReturnNo(returnToEdit.invoiceNo);
          setDate(returnToEdit.date || getTodayISO());
          setReturnReason(returnToEdit.returnReason || 'Damaged / Defective Goods');
          setNotes(returnToEdit.description || '');
          setLines(returnToEdit.items || []);
        } else if (sourceTransaction) {
          setPartyId(sourceTransaction.partyId);
          setDate(getTodayISO());
          setReturnReason('Damaged / Defective Goods');
          setNotes(`Return against ${sourceTransaction.invoiceNo}`);

          // Suggest next return #
          const prefix = isSaleReturn ? (businessProfile?.creditNotePrefix || 'CR-') : (businessProfile?.debitNotePrefix || 'DB-');
          const nextNum = isSaleReturn ? (businessProfile?.nextCreditNoteNumber || 1) : (businessProfile?.nextDebitNoteNumber || 1);
          setReturnNo(`${prefix}${String(nextNum).padStart(4, '0')}`);

          // Copy lines from source transaction with maxQty set to original qty
          const initialLines: ReturnLineItem[] = sourceTransaction.items.map((it) => ({
            ...it,
            id: `line_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
            maxQty: it.qty, // Store original qty as cap
          }));
          setLines(initialLines);
        } else {
          setPartyId('');
          setDate(getTodayISO());
          setReturnReason('Damaged / Defective Goods');
          setNotes('');
          const prefix = isSaleReturn ? (businessProfile?.creditNotePrefix || 'CR-') : (businessProfile?.debitNotePrefix || 'DB-');
          const nextNum = isSaleReturn ? (businessProfile?.nextCreditNoteNumber || 1) : (businessProfile?.nextDebitNoteNumber || 1);
          setReturnNo(`${prefix}${String(nextNum).padStart(4, '0')}`);
          setLines([]);
        }
      } catch (e) {
        console.error('Failed to load resources for Return modal', e);
      }
    }

    loadResources();
    setError(null);

    return () => {
      active = false;
    };
  }, [isOpen, mode, sourceTransaction, returnToEdit, businessProfile, isSaleReturn]);

  if (!isOpen) return null;

  const selectedParty = parties.find((p) => p.id === partyId);

  // Add line item from scratch
  const handleAddItem = (itemId: string) => {
    const item = items.find((i) => i.id === itemId);
    if (!item) return;

    const unitPrice = isSaleReturn ? item.salePrice : item.purchasePrice;
    const taxRate = item.taxRate || 0;
    const lineTotalBeforeTax = Math.round(unitPrice * 1 * 100) / 100;
    const lineTax = Math.round(lineTotalBeforeTax * (taxRate / 100) * 100) / 100;

    const newLine: ReturnLineItem = {
      id: `line_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
      itemId: item.id,
      name: item.name,
      hsn: item.hsn || '',
      qty: 1,
      freeQty: 0,
      unit: item.unit || 'PCS',
      priceUnit: unitPrice,
      taxRate,
      taxAmount: lineTax,
      discountAmount: 0,
      totalAmount: lineTotalBeforeTax + lineTax,
    };

    setLines([...lines, newLine]);
  };

  // Update line quantity with strict cap validation
  const handleQuantityChange = (lineId: string, val: string) => {
    const newQty = parseFloat(val) || 0;
    setLines((prev) =>
      prev.map((line) => {
        if (line.id !== lineId) return line;

        const unitPrice = line.priceUnit;
        const taxRate = line.taxRate || 0;
        const lineTotalBeforeTax = Math.round(unitPrice * newQty * 100) / 100;
        const lineTax = Math.round(lineTotalBeforeTax * (taxRate / 100) * 100) / 100;

        return {
          ...line,
          qty: newQty,
          taxAmount: lineTax,
          totalAmount: lineTotalBeforeTax + lineTax,
        };
      })
    );
  };

  // Remove line item
  const handleRemoveLine = (lineId: string) => {
    setLines((prev) => prev.filter((l) => l.id !== lineId));
  };

  // Totals & taxes
  const subtotal = lines.reduce((sum, l) => sum + (l.priceUnit * l.qty), 0);
  const totalTax = lines.reduce((sum, l) => sum + (l.taxAmount || 0), 0);
  const totalAmount = Math.round((subtotal + totalTax) * 100) / 100;

  const isInterState = selectedParty && businessProfile ? selectedParty.stateCode !== businessProfile.stateCode : false;
  const cgst = isInterState ? 0 : Math.round((totalTax / 2) * 100) / 100;
  const sgst = isInterState ? 0 : Math.round((totalTax / 2) * 100) / 100;
  const igst = isInterState ? Math.round(totalTax * 100) / 100 : 0;

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!partyId) {
      setError('Please select a party');
      return;
    }

    if (lines.length === 0) {
      setError('Please add at least one item to return');
      return;
    }

    // Strict validation: block returning more than original sold or bought qty!
    for (const line of lines) {
      if (line.qty <= 0) {
        setError(`Return quantity for "${line.name}" must be greater than 0`);
        return;
      }
      if (line.maxQty !== undefined && line.qty > line.maxQty) {
        setError(
          `Return quantity for "${line.name}" cannot exceed originally ${isSaleReturn ? 'sold' : 'bought'} quantity of ${line.maxQty}`
        );
        return;
      }
    }

    setIsSaving(true);
    try {
      await saveTransaction({
        id: returnToEdit?.id,
        type: mode,
        invoiceNo: returnNo.trim() || undefined,
        receiptNo: returnNo.trim() || undefined,
        date,
        partyId,
        partyName: selectedParty?.name || 'Party',
        partyGstin: selectedParty?.gstin || '',
        partyPhone: selectedParty?.phone || '',
        partyState: selectedParty?.state || businessProfile?.state || 'Tamil Nadu',
        partyStateCode: selectedParty?.stateCode || businessProfile?.stateCode || '33',
        billingAddress: selectedParty?.billingAddress || '',
        shippingAddress: selectedParty?.shippingAddresses?.[0] || '',
        stateOfSupply: selectedParty?.state || businessProfile?.state || 'Tamil Nadu',
        paymentType: 'credit',
        items: lines,
        subtotal: Math.round(subtotal * 100) / 100,
        cgst,
        sgst,
        igst,
        totalTax: Math.round(totalTax * 100) / 100,
        roundOff: 0,
        totalAmount,
        receivedAmount: 0,
        balanceDue: totalAmount,
        originalInvoiceId: sourceTransaction?.id || returnToEdit?.originalInvoiceId,
        originalInvoiceNo: sourceTransaction?.invoiceNo || returnToEdit?.originalInvoiceNo,
        returnReason,
        description: notes || `${title} against ${sourceTransaction?.invoiceNo || 'invoice'}. Reason: ${returnReason}`,
        status: 'active',
      });

      onSaved();
      onClose();
    } catch (err: any) {
      console.error('Error saving return', err);
      setError(err?.message || 'Failed to save return transaction');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="w-full max-w-2xl bg-white rounded-xl shadow-2xl border border-slate-200 overflow-hidden my-8 animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 bg-slate-900 text-white">
          <div className="flex items-center gap-2.5">
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${isSaleReturn ? 'bg-amber-500/20 text-amber-400' : 'bg-blue-500/20 text-blue-400'}`}>
              <RotateCcw className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold">{title}</h3>
              <p className="text-[11px] text-slate-400">
                {isSaleReturn
                  ? 'Credit Note: Goods returned by customer (restores stock & reduces receivable)'
                  : 'Debit Note: Goods returned to vendor (deducts stock & reduces payable)'}
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

          {/* Banner if converting from an existing invoice/bill */}
          {sourceTransaction && (
            <div className="p-3 bg-amber-50/80 border border-amber-200 rounded-lg flex items-center justify-between text-[11px]">
              <div>
                <span className="font-bold text-amber-900">
                  Converting from {isSaleReturn ? 'Sale Invoice' : 'Purchase Bill'}:
                </span>{' '}
                <span className="font-mono font-semibold text-amber-800">{sourceTransaction.invoiceNo}</span>
                <span className="text-amber-700 ml-2">dated {sourceTransaction.date}</span>
              </div>
              <span className="font-mono font-bold text-amber-900">
                Original Total: {formatINR(sourceTransaction.totalAmount)}
              </span>
            </div>
          )}

          {/* Party, Return #, Date */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                {isSaleReturn ? 'Customer' : 'Vendor / Supplier'} <span className="text-rose-500">*</span>
              </label>
              <select
                value={partyId}
                onChange={(e) => setPartyId(e.target.value)}
                disabled={Boolean(sourceTransaction || returnToEdit)}
                required
                className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-rose-500"
              >
                <option value="">-- Select Party --</option>
                {parties.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                {isSaleReturn ? 'Credit Note #' : 'Debit Note #'} <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                value={returnNo}
                onChange={(e) => setReturnNo(e.target.value)}
                placeholder={isSaleReturn ? 'CR-0001' : 'DB-0001'}
                className="w-full px-3 py-2 text-xs font-mono font-semibold bg-white border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-rose-500"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Return Date</label>
              <input
                type="date"
                required
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-rose-500"
              />
            </div>
          </div>

          {/* Reason for Return & Notes */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Reason for Return</label>
              <select
                value={returnReason}
                onChange={(e) => setReturnReason(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-rose-500"
              >
                <option value="Damaged / Defective Goods">Damaged / Defective Goods</option>
                <option value="Quality Disapproved">Quality Disapproved</option>
                <option value="Incorrect Item Sent">Incorrect Item Sent</option>
                <option value="Customer Rejected">Customer Rejected</option>
                <option value="Over-Supplied Quantity">Over-Supplied Quantity</option>
                <option value="Price Difference / Dispute">Price Difference / Dispute</option>
                <option value="Order Cancelled">Order Cancelled</option>
                <option value="Other">Other</option>
              </select>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Notes / Remarks</label>
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Optional explanation for audit records"
                className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg"
              />
            </div>
          </div>

          {/* Items Return Table */}
          <div className="pt-2">
            <div className="flex items-center justify-between mb-2">
              <span className="font-bold text-slate-800">
                Returned Items & Quantities <span className="text-rose-500">*</span>
              </span>
              {!sourceTransaction && (
                <div className="flex items-center gap-2">
                  <select
                    onChange={(e) => {
                      if (e.target.value) {
                        handleAddItem(e.target.value);
                        e.target.value = '';
                      }
                    }}
                    className="px-2.5 py-1 text-xs bg-white border border-slate-300 rounded-md"
                  >
                    <option value="">+ Add Item to Return</option>
                    {items.map((it) => (
                      <option key={it.id} value={it.id}>
                        {it.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            {lines.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-400 bg-slate-50 border border-dashed border-slate-300 rounded-lg">
                No items added. Select items above to return.
              </div>
            ) : (
              <div className="border border-slate-200 rounded-lg overflow-hidden">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-slate-100 text-slate-600 font-semibold border-b border-slate-200 text-[11px]">
                    <tr>
                      <th className="py-2 px-3">Item Description</th>
                      <th className="py-2 px-3 text-right">Unit Price (₹)</th>
                      <th className="py-2 px-3 text-center">GST Rate</th>
                      <th className="py-2 px-3 text-right w-28">Return Qty</th>
                      <th className="py-2 px-3 text-right">Tax (₹)</th>
                      <th className="py-2 px-3 text-right">Total (₹)</th>
                      <th className="py-2 px-2 text-center w-10"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-[11px]">
                    {lines.map((l) => (
                      <tr key={l.id} className="hover:bg-slate-50">
                        <td className="py-2 px-3">
                          <div className="font-semibold text-slate-900">{l.name}</div>
                          {l.maxQty !== undefined && (
                            <div className="text-[10px] text-slate-500">
                              Max allowed: <span className="font-bold text-slate-700">{l.maxQty} {l.unit}</span>
                            </div>
                          )}
                        </td>
                        <td className="py-2 px-3 text-right font-mono">{formatINR(l.priceUnit)}</td>
                        <td className="py-2 px-3 text-center">{l.taxRate}%</td>
                        <td className="py-2 px-3 text-right">
                          <input
                            type="number"
                            step="any"
                            min="0.01"
                            max={l.maxQty}
                            value={l.qty}
                            onChange={(e) => handleQuantityChange(l.id, e.target.value)}
                            className="w-full text-right px-2 py-1 font-mono font-bold text-slate-900 bg-white border border-slate-300 rounded-md focus:ring-1 focus:ring-rose-500"
                          />
                        </td>
                        <td className="py-2 px-3 text-right font-mono">{formatINR(l.taxAmount || 0)}</td>
                        <td className="py-2 px-3 text-right font-mono font-bold text-slate-900">
                          {formatINR(l.totalAmount)}
                        </td>
                        <td className="py-2 px-2 text-center">
                          <button
                            type="button"
                            onClick={() => handleRemoveLine(l.id)}
                            className="text-slate-400 hover:text-rose-600 p-1 rounded-sm cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                {/* Summary footer */}
                <div className="p-3 bg-slate-50 border-t border-slate-200 flex flex-col items-end gap-1 text-xs">
                  <div className="flex justify-between w-64 text-slate-600">
                    <span>Subtotal:</span>
                    <span className="font-mono">{formatINR(subtotal)}</span>
                  </div>
                  <div className="flex justify-between w-64 text-slate-600">
                    <span>GST ({isInterState ? 'IGST' : 'CGST + SGST'}):</span>
                    <span className="font-mono">{formatINR(totalTax)}</span>
                  </div>
                  <div className="flex justify-between w-64 text-sm font-bold text-slate-900 pt-1 border-t border-slate-200">
                    <span>Total Return Amount:</span>
                    <span className="font-mono text-rose-700">{formatINR(totalAmount)}</span>
                  </div>
                </div>
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
              <span>{isSaving ? 'Saving...' : `Save ${isSaleReturn ? 'Credit Note' : 'Debit Note'}`}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
