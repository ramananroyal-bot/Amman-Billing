import React, { useState, useEffect } from 'react';
import { X, Plus, Trash2, UserPlus, PackagePlus, AlertCircle, ShoppingBag, ScanBarcode } from 'lucide-react';
import { AppSettings, BusinessProfile, Item, Party, PaymentType, Transaction, TransactionItem } from '../../types';
import { INDIAN_STATES, GST_RATES, STANDARD_UNITS } from '../../types/indianStates';
import { getItems, getParties, saveTransaction, getAppSettings } from '../../db/indexedDB';
import { calculateTax, formatINR, getTodayISO } from '../../utils/formatters';
import {
  isWeightUnit,
  getCompatibleUnits,
  convertWeightQty,
  calculateConvertedUnitPrice,
} from '../../utils/unitConversion';
import { ConfirmDiscardModal } from '../common/ConfirmDiscardModal';
import { QuickAddPartyModal } from './QuickAddPartyModal';
import { QuickAddItemModal } from './QuickAddItemModal';

interface AddPurchaseModalProps {
  isOpen: boolean;
  onClose: () => void;
  businessProfile: BusinessProfile;
  onSaved: (tx: Transaction) => void;
  transactionToEdit?: Transaction | null;
  initialPartyId?: string;
}

export const AddPurchaseModal: React.FC<AddPurchaseModalProps> = ({
  isOpen,
  onClose,
  businessProfile,
  onSaved,
  transactionToEdit,
  initialPartyId,
}) => {
  const [parties, setParties] = useState<Party[]>([]);
  const [itemsList, setItemsList] = useState<Item[]>([]);
  const [appSettings, setAppSettings] = useState<AppSettings | null>(null);
  const [barcodeInput, setBarcodeInput] = useState('');
  const [barcodeFeedback, setBarcodeFeedback] = useState<{ text: string; ok: boolean } | null>(null);

  // Bill headers
  const [paymentType, setPaymentType] = useState<PaymentType>('credit');
  const [selectedPartyId, setSelectedPartyId] = useState('');
  const [partyName, setPartyName] = useState('Cash Purchase');
  const [partyGstin, setPartyGstin] = useState('');
  const [partyPhone, setPartyPhone] = useState('');
  const [partyState, setPartyState] = useState(businessProfile.state);
  const [partyStateCode, setPartyStateCode] = useState(businessProfile.stateCode);
  const [billingAddress, setBillingAddress] = useState('');
  const [stateOfSupply, setStateOfSupply] = useState(businessProfile.state);

  const [billNo, setBillNo] = useState(
    `${businessProfile.purchasePrefix || 'PUR-'}${String(businessProfile.nextPurchaseNumber || 1).padStart(4, '0')}`
  );
  const [billDate, setBillDate] = useState(getTodayISO());
  const [dueDate, setDueDate] = useState('');
  const [godown, setGodown] = useState('Main Godown');
  const [documentUrl, setDocumentUrl] = useState('');
  const [terms, setTerms] = useState('');
  const [notes, setNotes] = useState('');

  // Line items
  const [rows, setRows] = useState<TransactionItem[]>([
    {
      id: 'row_1',
      itemId: '',
      name: '',
      hsn: '',
      qty: 1,
      freeQty: 0,
      unit: 'PCS',
      priceUnit: 0,
      taxRate: 18,
      taxAmount: 0,
      discountAmount: 0,
      totalAmount: 0,
    },
  ]);

  // Bottom fields
  const [paidAmount, setPaidAmount] = useState('0');

  // Custom Payment Types list
  const [customPaymentModes, setCustomPaymentModes] = useState<string[]>([]);
  const [showAddPaymentMode, setShowAddPaymentMode] = useState(false);
  const [newPaymentModeName, setNewPaymentModeName] = useState('');

  // Dirty check & Discard modal
  const [isDirty, setIsDirty] = useState(false);
  const [showDiscardConfirm, setShowDiscardConfirm] = useState(false);

  // Quick modals
  const [showQuickParty, setShowQuickParty] = useState(false);
  const [showQuickItem, setShowQuickItem] = useState(false);

  const [errors, setErrors] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (isOpen) {
      loadDependencies();
      if (transactionToEdit) {
        setPaymentType(transactionToEdit.paymentType || 'credit');
        setSelectedPartyId(transactionToEdit.partyId);
        setPartyName(transactionToEdit.partyName);
        setPartyGstin(transactionToEdit.partyGstin || '');
        setPartyPhone(transactionToEdit.partyPhone || '');
        setPartyState(transactionToEdit.partyState);
        setPartyStateCode(transactionToEdit.partyStateCode);
        setBillingAddress(transactionToEdit.billingAddress);
        setStateOfSupply(transactionToEdit.stateOfSupply);
        setBillNo(transactionToEdit.invoiceNo);
        setBillDate(transactionToEdit.date);
        setDueDate(transactionToEdit.dueDate || '');
        setGodown(transactionToEdit.godown || 'Main Godown');
        setDocumentUrl(transactionToEdit.documentUrl || '');
        setTerms(transactionToEdit.terms || '');
        setNotes(transactionToEdit.description || '');
        setPaidAmount(String(transactionToEdit.receivedAmount || 0));
        setRows(
          transactionToEdit.items && transactionToEdit.items.length > 0
            ? transactionToEdit.items
            : [
                {
                  id: 'row_1',
                  itemId: '',
                  name: '',
                  hsn: '',
                  qty: 1,
                  freeQty: 0,
                  unit: 'PCS',
                  priceUnit: 0,
                  taxRate: 18,
                  taxAmount: 0,
                  discountAmount: 0,
                  totalAmount: 0,
                },
              ]
        );
      } else {
        setBillNo(
          `${businessProfile.purchasePrefix || 'PUR-'}${String(businessProfile.nextPurchaseNumber || 1).padStart(4, '0')}`
        );
      }
      getAppSettings().then(setAppSettings);
      setBarcodeInput('');
      setBarcodeFeedback(null);
      setIsDirty(false);
    }
  }, [isOpen, businessProfile, transactionToEdit]);

  const loadDependencies = async () => {
    const p = await getParties();
    p.sort((a, b) => a.name.localeCompare(b.name));
    setParties(p);

    const it = await getItems();
    it.sort((a, b) => a.name.localeCompare(b.name));
    setItemsList(it);

    if (initialPartyId) {
      const match = p.find((pt) => pt.id === initialPartyId);
      if (match) {
        setSelectedPartyId(match.id);
        setPartyName(match.name);
        setPartyGstin(match.gstin || '');
        setPartyPhone(match.phone || '');
        setPartyState(match.state);
        setPartyStateCode(match.stateCode);
        setBillingAddress(match.billingAddress || '');
        setStateOfSupply(match.state);
      }
    }
  };

  const handlePartySelect = (partyId: string) => {
    setIsDirty(true);
    setSelectedPartyId(partyId);
    if (!partyId) {
      setPartyName('Cash Purchase');
      setPartyGstin('');
      setPartyPhone('');
      setPartyState(businessProfile.state);
      setPartyStateCode(businessProfile.stateCode);
      setBillingAddress('');
      setStateOfSupply(businessProfile.state);
      return;
    }

    const party = parties.find((p) => p.id === partyId);
    if (party) {
      setPartyName(party.name);
      setPartyGstin(party.gstin || '');
      setPartyPhone(party.phone || '');
      setPartyState(party.state);
      setPartyStateCode(party.stateCode);
      setBillingAddress(party.billingAddress || '');
      setStateOfSupply(party.state);
    }
  };

  const isInterState = stateOfSupply !== businessProfile.state;

  const handleItemSelect = (index: number, itemId: string) => {
    setIsDirty(true);
    const item = itemsList.find((i) => i.id === itemId);
    const updated = [...rows];
    if (item) {
      updated[index] = {
        ...updated[index],
        itemId: item.id,
        name: item.name,
        hsn: item.hsn,
        unit: item.unit,
        priceUnit: item.purchasePrice || item.salePrice,
        taxRate: item.taxRate,
        batchNumber: item.batchNumber || updated[index].batchNumber || '',
        serialNumber: item.serialNumber || updated[index].serialNumber || '',
        expiryDate: item.expiryDate || updated[index].expiryDate || '',
      };
    } else {
      updated[index] = {
        ...updated[index],
        itemId: '',
        name: '',
        hsn: '',
        priceUnit: 0,
        taxRate: 18,
      };
    }
    recalculateRow(updated, index);
  };

  // Barcode / Item Code quick lookup handler for Purchases
  const handleBarcodeLookup = () => {
    const code = barcodeInput.trim().toLowerCase();
    if (!code) return;
    const match = itemsList.find(
      (i) =>
        (i.barcode && i.barcode.toLowerCase() === code) ||
        (i.itemCode && i.itemCode.toLowerCase() === code)
    );
    if (!match) {
      setBarcodeFeedback({ text: `No item found for barcode "${barcodeInput.trim()}"`, ok: false });
      return;
    }

    setIsDirty(true);
    const updated = [...rows];
    const existingIdx = updated.findIndex(
      (r) => String(r.itemId) === String(match.id) && r.unit === match.unit
    );

    if (existingIdx >= 0) {
      updated[existingIdx] = {
        ...updated[existingIdx],
        qty: (Number(updated[existingIdx].qty) || 0) + 1,
      };
      recalculateRow(updated, existingIdx);
      setBarcodeFeedback({ text: `+1 Qty added for ${match.name}`, ok: true });
    } else {
      const emptyIdx = updated.findIndex((r) => !r.itemId && !r.name.trim());
      if (emptyIdx >= 0) {
        updated[emptyIdx] = {
          ...updated[emptyIdx],
          itemId: match.id,
          name: match.name,
          hsn: match.hsn,
          unit: match.unit,
          priceUnit: match.purchasePrice || match.salePrice,
          taxRate: match.taxRate,
          batchNumber: match.batchNumber || '',
          serialNumber: match.serialNumber || '',
          expiryDate: match.expiryDate || '',
        };
        recalculateRow(updated, emptyIdx);
      } else {
        const newRow: TransactionItem = {
          id: `row_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
          itemId: match.id,
          name: match.name,
          hsn: match.hsn,
          qty: 1,
          freeQty: 0,
          unit: match.unit,
          priceUnit: match.purchasePrice || match.salePrice,
          taxRate: match.taxRate,
          taxAmount: 0,
          discountAmount: 0,
          totalAmount: 0,
          batchNumber: match.batchNumber || '',
          serialNumber: match.serialNumber || '',
          expiryDate: match.expiryDate || '',
        };
        updated.push(newRow);
        recalculateRow(updated, updated.length - 1);
      }
      setBarcodeFeedback({ text: `Added ${match.name}`, ok: true });
    }
    setBarcodeInput('');
  };

  const handleRowChange = (index: number, field: keyof TransactionItem, value: unknown) => {
    setIsDirty(true);
    const updated = [...rows];
    const prevRow = updated[index];
    updated[index] = {
      ...prevRow,
      [field]: value,
    };

    if (field === 'unit' && appSettings?.enableWeightUnits && prevRow.itemId) {
      const baseItem = itemsList.find((i) => String(i.id) === String(prevRow.itemId));
      if (baseItem && isWeightUnit(baseItem.unit) && isWeightUnit(String(value))) {
        const basePrice = baseItem.purchasePrice || baseItem.salePrice;
        updated[index].priceUnit = calculateConvertedUnitPrice(basePrice, baseItem.unit, String(value));
      }
    }

    recalculateRow(updated, index);
  };

  const recalculateRow = (updatedRows: TransactionItem[], index: number) => {
    const row = updatedRows[index];
    const qty = Number(row.qty) || 0;
    const rate = Number(row.priceUnit) || 0;
    const disc = Number(row.discountAmount) || 0;

    const baseAmount = Math.max(0, qty * rate - disc);
    const tax = calculateTax(baseAmount, row.taxRate, isInterState);

    row.taxAmount = tax.totalTax;
    row.totalAmount = Math.round((baseAmount + tax.totalTax) * 100) / 100;

    setRows([...updatedRows]);
  };

  const addRow = () => {
    setIsDirty(true);
    setRows((prev) => [
      ...prev,
      {
        id: `row_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
        itemId: '',
        name: '',
        hsn: '',
        qty: 1,
        freeQty: 0,
        unit: 'PCS',
        priceUnit: 0,
        taxRate: 18,
        taxAmount: 0,
        discountAmount: 0,
        totalAmount: 0,
      },
    ]);
  };

  const removeRow = (index: number) => {
    if (rows.length === 1) return;
    setIsDirty(true);
    setRows((prev) => prev.filter((_, i) => i !== index));
  };

  // Grand totals
  let subtotal = 0;
  let totalTax = 0;
  rows.forEach((r) => {
    const qty = Number(r.qty) || 0;
    const rate = Number(r.priceUnit) || 0;
    const disc = Number(r.discountAmount) || 0;
    subtotal += Math.max(0, qty * rate - disc);
    totalTax += r.taxAmount || 0;
  });

  const rawTotal = subtotal + totalTax;
  const roundedTotal = Math.round(rawTotal);
  const roundOff = Math.round((roundedTotal - rawTotal) * 100) / 100;
  const totalAmount = roundedTotal;

  useEffect(() => {
    if (paymentType === 'cash') {
      setPaidAmount(totalAmount.toString());
    }
  }, [paymentType, totalAmount]);

  const paid = parseFloat(paidAmount) || 0;
  const balanceDue = Math.max(0, Math.round((totalAmount - paid) * 100) / 100);

  const cgst = isInterState ? 0 : Math.round((totalTax / 2) * 100) / 100;
  const sgst = isInterState ? 0 : Math.round((totalTax / 2) * 100) / 100;
  const igst = isInterState ? totalTax : 0;

  const handleAttemptClose = () => {
    if (isDirty) {
      setShowDiscardConfirm(true);
    } else {
      onClose();
    }
  };

  const handleSave = async () => {
    if (!billNo.trim()) {
      setErrors('Bill number is required');
      return;
    }
    const validItems = rows.filter((r) => r.name.trim() || r.itemId);
    if (validItems.length === 0) {
      setErrors('Please add at least one valid item');
      return;
    }

    // Check quantity and price
    for (const item of validItems) {
      if (Number(item.qty) <= 0) {
        setErrors(`Item "${item.name || 'Row'}" must have a quantity greater than 0.`);
        return;
      }
      if (Number(item.priceUnit) < 0) {
        setErrors(`Purchase price for "${item.name || 'Row'}" cannot be negative.`);
        return;
      }
    }

    setIsSaving(true);
    setErrors(null);

    try {
      const tx = await saveTransaction({
        id: transactionToEdit ? transactionToEdit.id : undefined,
        type: 'purchase_bill',
        invoiceNo: billNo.trim(),
        date: billDate,
        dueDate,
        godown,
        partyId: selectedPartyId,
        partyName: partyName.trim(),
        partyGstin: partyGstin.trim(),
        partyPhone: partyPhone.trim(),
        partyState,
        partyStateCode,
        billingAddress,
        shippingAddress: billingAddress,
        stateOfSupply,
        paymentType,
        items: validItems,
        subtotal: Math.round(subtotal * 100) / 100,
        cgst,
        sgst,
        igst,
        totalTax: Math.round(totalTax * 100) / 100,
        roundOff,
        totalAmount,
        receivedAmount: paid,
        balanceDue,
        description: notes,
        terms,
        documentUrl,
        status: 'active',
      });

      setIsDirty(false);
      onSaved(tx);
      onClose();
    } catch {
      setErrors('Failed to save purchase bill.');
    } finally {
      setIsSaving(false);
    }
  };

  // In-modal Keyboard shortcuts (Ctrl+Enter or Ctrl+S to Save, Alt+A to Add Row, Esc to Close)
  useEffect(() => {
    if (!isOpen) return;
    const handleModalKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && (e.key === 'Enter' || e.key === 's' || e.key === 'S')) {
        e.preventDefault();
        handleSave();
      } else if (e.altKey && (e.key === 'a' || e.key === 'A')) {
        e.preventDefault();
        addRow();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        handleAttemptClose();
      }
    };
    window.addEventListener('keydown', handleModalKeyDown);
    return () => window.removeEventListener('keydown', handleModalKeyDown);
  }, [isOpen, billNo, rows, paymentType, selectedPartyId, paid, balanceDue, isDirty]);

  if (!isOpen) return null;

  return (
    <>
      <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-2 sm:p-4 overflow-y-auto">
        <div className="w-full max-w-5xl bg-white rounded-xl shadow-2xl border border-slate-200 overflow-hidden my-4 flex flex-col max-h-[95vh]">
          {/* Header */}
          <div className="bg-slate-900 text-white shrink-0">
            <div className="flex items-center justify-between px-6 py-3.5 border-b border-slate-800">
              <div className="flex items-center gap-3">
                <ShoppingBag className="w-4 h-4 text-blue-500" />
                <h2 className="text-sm font-bold tracking-tight">
                  {transactionToEdit ? `Edit Purchase Bill (${transactionToEdit.invoiceNo})` : 'Create Purchase Bill'}
                </h2>

                {/* Credit / Cash Toggle */}
                <div className="ml-4 flex items-center bg-slate-800 p-0.5 rounded-md border border-slate-700 text-xs">
                  <button
                    type="button"
                    onClick={() => {
                      setIsDirty(true);
                      setPaymentType('credit');
                    }}
                    className={`px-3 py-1 rounded font-medium transition-colors cursor-pointer ${
                      paymentType === 'credit' ? 'bg-blue-600 text-white shadow-xs' : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    Credit
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setIsDirty(true);
                      setPaymentType('cash');
                    }}
                    className={`px-3 py-1 rounded font-medium transition-colors cursor-pointer ${
                      paymentType === 'cash' ? 'bg-blue-600 text-white shadow-xs' : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    Cash
                  </button>
                </div>
              </div>

              <button
                type="button"
                onClick={handleAttemptClose}
                className="text-slate-400 hover:text-white transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex items-center px-4 pt-1 bg-slate-950/80 gap-1 overflow-x-auto text-xs">
              <div className="px-4 py-2 bg-white text-slate-900 font-semibold rounded-t-lg border-t-2 border-blue-500 flex items-center gap-2">
                <span>{billNo || 'New Purchase'}</span>
                <span className="text-[10px] text-slate-500 font-normal">({paymentType.toUpperCase()})</span>
              </div>
            </div>
          </div>

          {/* Content */}
          <div className="p-6 overflow-y-auto flex-1 space-y-5">
            {errors && (
              <div className="p-3 text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded-lg flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{errors}</span>
              </div>
            )}

            {/* Top Details */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-200">
              {/* Supplier Selection */}
              <div className="md:col-span-2">
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-semibold text-slate-700">Supplier / Vendor *</label>
                  <button
                    type="button"
                    onClick={() => setShowQuickParty(true)}
                    className="text-[11px] text-blue-600 hover:text-blue-700 font-semibold flex items-center gap-1 cursor-pointer"
                  >
                    <UserPlus className="w-3 h-3" />
                    <span>+ New Supplier</span>
                  </button>
                </div>
                <select
                  value={selectedPartyId}
                  onChange={(e) => handlePartySelect(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-slate-900 cursor-pointer"
                >
                  <option value="">Cash Purchase (Unregistered Vendor)</option>
                  {parties.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} {p.phone ? `(${p.phone})` : ''}
                    </option>
                  ))}
                </select>
                {partyPhone && (
                  <p className="mt-1 text-[11px] text-slate-500 font-mono">
                    Phone: {partyPhone} {partyGstin ? `· GSTIN: ${partyGstin}` : ''}
                  </p>
                )}
              </div>

              {/* Bill No */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Purchase Bill # *</label>
                <input
                  type="text"
                  value={billNo}
                  onChange={(e) => {
                    setIsDirty(true);
                    setBillNo(e.target.value);
                  }}
                  className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg font-mono"
                />
              </div>

              {/* Bill Date */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Bill Date *</label>
                <input
                  type="date"
                  value={billDate}
                  onChange={(e) => {
                    setIsDirty(true);
                    setBillDate(e.target.value);
                  }}
                  className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg font-mono"
                />
              </div>

              {/* Payment Type selection */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-semibold text-slate-700">Payment Mode</label>
                  <button
                    type="button"
                    onClick={() => setShowAddPaymentMode(true)}
                    className="text-[11px] text-blue-600 hover:text-blue-700 font-semibold cursor-pointer"
                  >
                    + Add Payment Type
                  </button>
                </div>
                <select
                  value={paymentType}
                  onChange={(e) => {
                    setIsDirty(true);
                    setPaymentType(e.target.value as PaymentType);
                  }}
                  className="w-full px-3 py-1.5 text-xs bg-white border border-slate-300 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-slate-900 cursor-pointer"
                >
                  <option value="credit">Credit / Unpaid</option>
                  <option value="cash">Cash</option>
                  <option value="bank_transfer">Bank Transfer / NEFT</option>
                  <option value="upi">UPI</option>
                  <option value="cheque">Cheque</option>
                  {customPaymentModes.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
              </div>

              {/* Godown */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Stock Receiving Godown</label>
                <select
                  value={godown}
                  onChange={(e) => {
                    setIsDirty(true);
                    setGodown(e.target.value);
                  }}
                  className="w-full px-3 py-1.5 text-xs bg-white border border-slate-300 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-slate-900 cursor-pointer"
                >
                  <option value="Main Godown">Main Godown</option>
                  <option value="Central Warehouse">Central Warehouse</option>
                  <option value="Store Front">Store Front</option>
                </select>
              </div>

              {/* State of Supply */}
              <div className="md:col-span-2">
                <label className="block text-xs font-semibold text-slate-700 mb-1">State of Supply</label>
                <select
                  value={stateOfSupply}
                  onChange={(e) => {
                    setIsDirty(true);
                    setStateOfSupply(e.target.value);
                  }}
                  className="w-full px-3 py-1.5 text-xs bg-white border border-slate-300 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-slate-900 cursor-pointer"
                >
                  {INDIAN_STATES.map((s) => (
                    <option key={s.code} value={s.name}>
                      {s.code} - {s.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Line Items Grid */}
            <div className="border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
              <div className="bg-slate-100 px-4 py-2.5 flex flex-wrap items-center justify-between gap-2 border-b border-slate-200">
                <span className="text-xs font-bold text-slate-800 uppercase tracking-wider">Purchased Items</span>

                {appSettings?.enableBarcode && (
                  <div className="flex items-center gap-1.5 flex-1 max-w-sm">
                    <div className="relative flex-1">
                      <ScanBarcode className="w-3.5 h-3.5 text-blue-600 absolute left-2.5 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        value={barcodeInput}
                        onChange={(e) => setBarcodeInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            handleBarcodeLookup();
                          }
                        }}
                        placeholder="Scan or type barcode / SKU + Enter..."
                        className="w-full pl-8 pr-2.5 py-1 text-xs bg-white border border-blue-300 rounded-md font-mono focus:outline-hidden focus:ring-1 focus:ring-blue-500"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={handleBarcodeLookup}
                      className="px-2.5 py-1 text-[11px] font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded-md cursor-pointer"
                    >
                      Add
                    </button>
                    {barcodeFeedback && (
                      <span
                        className={`text-[10px] font-semibold whitespace-nowrap ${
                          barcodeFeedback.ok ? 'text-emerald-700' : 'text-rose-600'
                        }`}
                      >
                        {barcodeFeedback.text}
                      </span>
                    )}
                  </div>
                )}

                <button
                  type="button"
                  onClick={() => setShowQuickItem(true)}
                  className="text-xs text-blue-600 hover:text-blue-700 font-semibold flex items-center gap-1 cursor-pointer"
                >
                  <PackagePlus className="w-3.5 h-3.5" />
                  <span>+ New Item</span>
                </button>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200 uppercase text-[11px]">
                      <th className="py-2.5 px-3 w-8 text-center">#</th>
                      <th className="py-2.5 px-3 min-w-[200px]">Item / Description</th>
                      <th className="py-2.5 px-3 w-20">HSN</th>
                      <th className="py-2.5 px-3 w-16">Qty</th>
                      <th className="py-2.5 px-3 w-16">Free Qty</th>
                      <th className="py-2.5 px-3 w-20">Unit</th>
                      <th className="py-2.5 px-3 w-28 text-right">Purchase Rate (₹)</th>
                      <th className="py-2.5 px-3 w-24">Tax %</th>
                      <th className="py-2.5 px-3 w-24 text-right">Tax (₹)</th>
                      <th className="py-2.5 px-3 w-28 text-right">Total (₹)</th>
                      <th className="py-2.5 px-2 w-10 text-center"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {rows.map((row, idx) => (
                      <tr key={row.id} className="hover:bg-slate-50/50">
                        <td className="py-2 px-3 text-center text-slate-400 font-mono text-[11px]">{idx + 1}</td>
                        <td className="py-2 px-3">
                          <select
                            value={row.itemId}
                            onChange={(e) => handleItemSelect(idx, e.target.value)}
                            className="w-full px-2 py-1.5 text-xs bg-white border border-slate-300 rounded-md focus:outline-hidden focus:ring-1 focus:ring-slate-900 cursor-pointer"
                          >
                            <option value="">Select or Type Item</option>
                            {itemsList.map((item) => (
                              <option key={item.id} value={item.id}>
                                {item.name} {item.currentStock !== undefined ? `(Stock: ${item.currentStock})` : ''}
                              </option>
                            ))}
                          </select>
                          {!row.itemId && (
                            <input
                              type="text"
                              value={row.name}
                              onChange={(e) => handleRowChange(idx, 'name', e.target.value)}
                              placeholder="Or enter custom item name"
                              className="mt-1 w-full px-2 py-1 text-[11px] bg-slate-50 border border-slate-200 rounded-md"
                            />
                          )}
                          {(appSettings?.enableBatchSerial || appSettings?.enableBatchExpiry) && (
                            <div className="mt-1 grid grid-cols-2 gap-1">
                              <input
                                type="text"
                                value={row.batchNumber || ''}
                                onChange={(e) => handleRowChange(idx, 'batchNumber', e.target.value)}
                                placeholder="Batch No."
                                className="px-1.5 py-0.5 text-[10px] bg-slate-50 border border-slate-200 rounded font-mono"
                              />
                              <input
                                type="text"
                                value={row.serialNumber || ''}
                                onChange={(e) => handleRowChange(idx, 'serialNumber', e.target.value)}
                                placeholder="Serial No."
                                className="px-1.5 py-0.5 text-[10px] bg-slate-50 border border-slate-200 rounded font-mono"
                              />
                            </div>
                          )}
                        </td>
                        <td className="py-2 px-3">
                          <input
                            type="text"
                            value={row.hsn}
                            onChange={(e) => handleRowChange(idx, 'hsn', e.target.value)}
                            className="w-full px-2 py-1.5 text-xs bg-white border border-slate-300 rounded-md font-mono"
                          />
                        </td>
                        <td className="py-2 px-2.5">
                          <input
                            type="number"
                            min="0.01"
                            step="any"
                            value={row.qty}
                            onChange={(e) => handleRowChange(idx, 'qty', parseFloat(e.target.value) || 0)}
                            className="w-full px-2 py-1.5 text-xs bg-white border border-slate-300 rounded-md font-mono"
                          />
                          {(() => {
                            if (!appSettings?.enableWeightUnits || !row.itemId) return null;
                            const baseItem = itemsList.find((i) => String(i.id) === String(row.itemId));
                            if (!baseItem || baseItem.unit === row.unit || !isWeightUnit(baseItem.unit) || !isWeightUnit(row.unit)) {
                              return null;
                            }
                            const eqQty = convertWeightQty(Number(row.qty) || 0, row.unit, baseItem.unit);
                            return (
                              <div className="text-[9px] text-teal-700 font-mono mt-0.5 whitespace-nowrap">
                                = {eqQty} {baseItem.unit}
                              </div>
                            );
                          })()}
                        </td>
                        <td className="py-2 px-2.5">
                          <input
                            type="number"
                            min="0"
                            step="any"
                            value={row.freeQty || 0}
                            onChange={(e) => handleRowChange(idx, 'freeQty', parseFloat(e.target.value) || 0)}
                            placeholder="0"
                            className="w-full px-2 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded-md font-mono text-slate-700"
                          />
                        </td>
                        <td className="py-2 px-3">
                          {(() => {
                            const baseItem = row.itemId
                              ? itemsList.find((i) => String(i.id) === String(row.itemId))
                              : undefined;
                            const unitOptions =
                              appSettings?.enableWeightUnits && baseItem && isWeightUnit(baseItem.unit)
                                ? getCompatibleUnits(baseItem.unit)
                                : STANDARD_UNITS;
                            return (
                              <select
                                value={row.unit}
                                onChange={(e) => handleRowChange(idx, 'unit', e.target.value)}
                                className="w-full px-1.5 py-1.5 text-xs bg-white border border-slate-300 rounded-md"
                              >
                                {unitOptions.map((u) => (
                                  <option key={u} value={u}>
                                    {u}
                                  </option>
                                ))}
                              </select>
                            );
                          })()}
                        </td>
                        <td className="py-2 px-3 text-right">
                          <input
                            type="number"
                            step="0.01"
                            value={row.priceUnit}
                            onChange={(e) => handleRowChange(idx, 'priceUnit', parseFloat(e.target.value) || 0)}
                            className="w-full px-2 py-1.5 text-xs bg-white border border-slate-300 rounded-md text-right font-mono"
                          />
                        </td>
                        <td className="py-2 px-3">
                          <select
                            value={row.taxRate}
                            onChange={(e) => handleRowChange(idx, 'taxRate', Number(e.target.value))}
                            className="w-full px-1 py-1.5 text-xs bg-white border border-slate-300 rounded-md"
                          >
                            {GST_RATES.map((g) => (
                              <option key={g.rate} value={g.rate}>
                                {g.rate}%
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="py-2 px-3 text-right font-mono tabular-nums text-slate-700">
                          {formatINR(row.taxAmount, false)}
                        </td>
                        <td className="py-2 px-3 text-right font-mono font-bold text-slate-900 tabular-nums">
                          {formatINR(row.totalAmount, false)}
                        </td>
                        <td className="py-2 px-2 text-center">
                          <button
                            type="button"
                            onClick={() => removeRow(idx)}
                            disabled={rows.length === 1}
                            className="text-slate-400 hover:text-rose-600 disabled:opacity-30 transition-colors cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="p-3 bg-slate-50 border-t border-slate-200">
                <button
                  type="button"
                  onClick={addRow}
                  className="px-3 py-1.5 text-xs font-semibold text-blue-600 bg-white border border-blue-300 hover:bg-blue-50 rounded-lg flex items-center gap-1 shadow-2xs transition-colors cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Row</span>
                </button>
              </div>
            </div>

            {/* Bottom Summary: Paid + Unpaid = Total, Upload Bill, Notes */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
              <div className="space-y-3">
                {/* Upload Bill photo / document */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Upload Supplier Bill / Invoice Document
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="file"
                      accept="image/*,application/pdf"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          const reader = new FileReader();
                          reader.onload = () => {
                            setDocumentUrl(reader.result as string);
                            setIsDirty(true);
                          };
                          reader.readAsDataURL(file);
                        }
                      }}
                      className="w-full text-xs text-slate-500 file:mr-2 file:py-1 file:px-2.5 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 cursor-pointer"
                    />
                  </div>
                  {documentUrl && (
                    <span className="text-[10px] text-emerald-600 mt-1 block">Bill attachment loaded</span>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Purchase Notes</label>
                  <textarea
                    rows={2}
                    value={notes}
                    onChange={(e) => {
                      setIsDirty(true);
                      setNotes(e.target.value);
                    }}
                    placeholder="Batch information, transporter, PO reference..."
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg"
                  />
                </div>
              </div>

              {/* Paid + Unpaid = Total summary card */}
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-2 text-xs">
                <div className="flex items-center justify-between text-slate-600">
                  <span>Purchases Subtotal:</span>
                  <span className="font-mono tabular-nums">{formatINR(subtotal)}</span>
                </div>
                <div className="flex items-center justify-between text-slate-600">
                  <span>Input Tax Credit ({isInterState ? 'IGST' : 'CGST+SGST'}):</span>
                  <span className="font-mono tabular-nums">{formatINR(totalTax)}</span>
                </div>
                {roundOff !== 0 && (
                  <div className="flex items-center justify-between text-slate-500 text-[11px]">
                    <span>Round Off:</span>
                    <span className="font-mono tabular-nums">{formatINR(roundOff)}</span>
                  </div>
                )}
                <div className="border-t border-slate-300 pt-2 flex items-center justify-between text-base font-bold text-slate-900">
                  <span>Total Bill Amount:</span>
                  <span className="font-mono text-lg text-blue-600 tabular-nums">{formatINR(totalAmount)}</span>
                </div>

                {/* Paid + Unpaid = Total display */}
                <div className="pt-2 border-t border-slate-200 grid grid-cols-2 gap-3 items-center">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1">Paid Amount (₹)</label>
                    <input
                      type="number"
                      step="0.01"
                      value={paidAmount}
                      onChange={(e) => {
                        setIsDirty(true);
                        setPaidAmount(e.target.value);
                      }}
                      className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded-md font-mono"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1">Unpaid Balance (₹)</label>
                    <div className="px-2.5 py-1.5 text-xs bg-white border border-slate-200 rounded-md font-mono font-bold text-rose-600">
                      {formatINR(balanceDue)}
                    </div>
                  </div>
                </div>

                <div className="bg-blue-50 p-2 rounded text-[11px] text-blue-800 font-mono flex items-center justify-between mt-2">
                  <span>Paid: {formatINR(paid)}</span>
                  <span>+</span>
                  <span>Unpaid: {formatINR(balanceDue)}</span>
                  <span>=</span>
                  <span className="font-bold">Total: {formatINR(totalAmount)}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Footer Actions */}
          <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3 shrink-0">
            <div className="flex items-center gap-3">
              <span className="text-[11px] text-slate-500">
                {isDirty ? 'Unsaved changes pending' : 'All changes saved'}
              </span>
              <div className="hidden md:flex items-center gap-2 text-[10px] text-slate-400">
                <span>
                  <kbd className="px-1.5 py-0.5 bg-slate-200 text-slate-700 font-mono font-bold rounded">Ctrl</kbd>+<kbd className="px-1.5 py-0.5 bg-slate-200 text-slate-700 font-mono font-bold rounded">Enter</kbd> Save
                </span>
                <span>
                  <kbd className="px-1.5 py-0.5 bg-slate-200 text-slate-700 font-mono font-bold rounded">Alt</kbd>+<kbd className="px-1.5 py-0.5 bg-slate-200 text-slate-700 font-mono font-bold rounded">A</kbd> Add Row
                </span>
                <span>
                  <kbd className="px-1.5 py-0.5 bg-slate-200 text-slate-700 font-mono font-bold rounded">Esc</kbd> Discard
                </span>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={handleAttemptClose}
                className="px-4 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={isSaving}
                className="px-5 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-lg shadow-sm transition-colors cursor-pointer flex items-center gap-1.5"
              >
                <span>{isSaving ? 'Saving...' : 'Save Purchase Bill'}</span>
                <span className="text-[10px] opacity-75 font-mono hidden sm:inline">(Ctrl+↵)</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Discard Confirmation Modal */}
      <ConfirmDiscardModal
        isOpen={showDiscardConfirm}
        onConfirm={() => {
          setShowDiscardConfirm(false);
          setIsDirty(false);
          onClose();
        }}
        onCancel={() => setShowDiscardConfirm(false)}
      />

      {/* Quick Add Party Modal */}
      <QuickAddPartyModal
        isOpen={showQuickParty}
        defaultType="Supplier"
        onClose={() => setShowQuickParty(false)}
        onSaved={(newParty) => {
          setParties((prev) => [...prev, newParty]);
          handlePartySelect(newParty.id);
        }}
      />

      {/* Quick Add Item Modal */}
      <QuickAddItemModal
        isOpen={showQuickItem}
        onClose={() => setShowQuickItem(false)}
        onSaved={(newItem) => {
          setItemsList((prev) => [...prev, newItem]);
          const lastIdx = rows.length - 1;
          handleItemSelect(lastIdx, newItem.id);
        }}
      />

      {/* Add Payment Type Modal */}
      {showAddPaymentMode && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="w-full max-w-sm bg-white rounded-xl shadow-xl p-5 border border-slate-200 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-xs font-bold text-slate-900 uppercase">Add Payment Type</h3>
              <button
                type="button"
                onClick={() => setShowAddPaymentMode(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Payment Mode Name</label>
              <input
                type="text"
                value={newPaymentModeName}
                onChange={(e) => setNewPaymentModeName(e.target.value)}
                placeholder="e.g. Card POS, RTGS, Credit Voucher"
                className="w-full px-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowAddPaymentMode(false)}
                className="px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-100 rounded-md cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  if (newPaymentModeName.trim()) {
                    setCustomPaymentModes((prev) => [...prev, newPaymentModeName.trim()]);
                    setPaymentType(newPaymentModeName.trim() as any);
                    setNewPaymentModeName('');
                    setShowAddPaymentMode(false);
                  }
                }}
                className="px-3 py-1.5 text-xs bg-blue-600 text-white rounded-md cursor-pointer"
              >
                Add
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
