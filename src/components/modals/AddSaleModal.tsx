import React, { useState, useEffect } from 'react';
import { X, Plus, Trash2, UserPlus, PackagePlus, AlertCircle } from 'lucide-react';
import { BusinessProfile, Item, Party, Transaction, TransactionItem } from '../../types';
import { INDIAN_STATES, GST_RATES, STANDARD_UNITS } from '../../types/indianStates';
import { getItems, getParties, saveTransaction, getAppSettings } from '../../db/indexedDB';
import { calculateTax, formatINR, getTodayISO } from '../../utils/formatters';
import { ConfirmDiscardModal } from '../common/ConfirmDiscardModal';
import { QuickAddPartyModal } from './QuickAddPartyModal';
import { QuickAddItemModal } from './QuickAddItemModal';

interface AddSaleModalProps {
  isOpen: boolean;
  onClose: () => void;
  businessProfile: BusinessProfile;
  onSaved: (tx: Transaction) => void;
  initialPartyId?: string;
  transactionToEdit?: Transaction | null;
  initialType?: 'sale_invoice' | 'delivery_challan';
}

export const AddSaleModal: React.FC<AddSaleModalProps> = ({
  isOpen,
  onClose,
  businessProfile,
  onSaved,
  initialPartyId,
  transactionToEdit,
  initialType = 'sale_invoice',
}) => {
  const [parties, setParties] = useState<Party[]>([]);
  const [itemsList, setItemsList] = useState<Item[]>([]);

  const isChallan = transactionToEdit ? transactionToEdit.type === 'delivery_challan' : initialType === 'delivery_challan';

  // Invoice headers
  const [paymentType, setPaymentType] = useState<'credit' | 'cash'>('credit');
  const [selectedPartyId, setSelectedPartyId] = useState('');
  const [partyName, setPartyName] = useState('Cash Sale');
  const [partyGstin, setPartyGstin] = useState('');
  const [partyPhone, setPartyPhone] = useState('');
  const [partyState, setPartyState] = useState(businessProfile.state);
  const [partyStateCode, setPartyStateCode] = useState(businessProfile.stateCode);
  const [billingAddress, setBillingAddress] = useState('');
  const [shippingAddress, setShippingAddress] = useState('');
  const [stateOfSupply, setStateOfSupply] = useState(businessProfile.state);

  const [invoiceNo, setInvoiceNo] = useState(
    isChallan
      ? `CH-${String(businessProfile.nextChallanNumber || 1).padStart(4, '0')}`
      : `${businessProfile.invoicePrefix || 'INV-'}${String(businessProfile.nextInvoiceNumber || 1).padStart(4, '0')}`
  );
  const [invoiceDate, setInvoiceDate] = useState(getTodayISO());
  const [godown, setGodown] = useState('Main Godown');
  const [copiesCount, setCopiesCount] = useState(2);
  const [terms, setTerms] = useState(businessProfile.terms || '');
  const [documentUrl, setDocumentUrl] = useState('');

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
  const [receivedAmount, setReceivedAmount] = useState('0');
  const [notes, setNotes] = useState('');
  const [vehicleNo, setVehicleNo] = useState('');
  const [deliveryDate, setDeliveryDate] = useState('');

  // Share dropdown state
  const [showShareDropdown, setShowShareDropdown] = useState(false);

  // Dirty check & Discard modal
  const [isDirty, setIsDirty] = useState(false);
  const [showDiscardConfirm, setShowDiscardConfirm] = useState(false);

  // Quick modals
  const [showQuickParty, setShowQuickParty] = useState(false);
  const [showQuickItem, setShowQuickItem] = useState(false);
  const [activeItemRowIndex, setActiveItemRowIndex] = useState<number | null>(null);

  const [errors, setErrors] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Load parties and items or populate edit
  useEffect(() => {
    if (isOpen) {
      loadDependencies();
      if (transactionToEdit) {
        setPaymentType(transactionToEdit.paymentType === 'cash' ? 'cash' : 'credit');
        setSelectedPartyId(transactionToEdit.partyId);
        setPartyName(transactionToEdit.partyName);
        setPartyGstin(transactionToEdit.partyGstin || '');
        setPartyPhone(transactionToEdit.partyPhone || '');
        setPartyState(transactionToEdit.partyState);
        setPartyStateCode(transactionToEdit.partyStateCode);
        setBillingAddress(transactionToEdit.billingAddress);
        setShippingAddress(transactionToEdit.shippingAddress);
        setStateOfSupply(transactionToEdit.stateOfSupply);
        setInvoiceNo(transactionToEdit.invoiceNo);
        setInvoiceDate(transactionToEdit.date);
        setRows(transactionToEdit.items && transactionToEdit.items.length > 0 ? transactionToEdit.items : [
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
        setReceivedAmount(String(transactionToEdit.receivedAmount || 0));
        setNotes(transactionToEdit.description || '');
        setVehicleNo(transactionToEdit.vehicleNo || '');
        setDeliveryDate(transactionToEdit.deliveryDate || '');
        setGodown(transactionToEdit.godown || 'Main Godown');
        setCopiesCount(transactionToEdit.copiesCount || 2);
        setTerms(transactionToEdit.terms || businessProfile.terms || '');
        setDocumentUrl(transactionToEdit.documentUrl || '');
      } else {
        setInvoiceNo(
          `${businessProfile.invoicePrefix || 'INV-'}${String(businessProfile.nextInvoiceNumber || 1).padStart(4, '0')}`
        );
      }
      setIsDirty(false);
    }
  }, [isOpen, businessProfile, transactionToEdit]);

  const loadDependencies = async () => {
    const p = await getParties();
    // Sort A-Z
    p.sort((a, b) => a.name.localeCompare(b.name));
    setParties(p);

    const it = await getItems();
    it.sort((a, b) => a.name.localeCompare(b.name));
    setItemsList(it);

    if (initialPartyId) {
      const matchParty = p.find((pt) => pt.id === initialPartyId);
      if (matchParty) {
        setSelectedPartyId(matchParty.id);
        setPartyName(matchParty.name);
        setPartyGstin(matchParty.gstin || '');
        setPartyPhone(matchParty.phone || '');
        setPartyState(matchParty.state);
        setPartyStateCode(matchParty.stateCode);
        setBillingAddress(matchParty.billingAddress || '');
        setShippingAddress(matchParty.shippingAddresses?.[0] || matchParty.billingAddress || '');
        setStateOfSupply(matchParty.state);
      }
    }
  };

  // Handle party change & auto-fill address
  const handlePartySelect = (partyId: string) => {
    setIsDirty(true);
    setSelectedPartyId(partyId);
    if (!partyId) {
      setPartyName('Cash Sale');
      setPartyGstin('');
      setPartyPhone('');
      setPartyState(businessProfile.state);
      setPartyStateCode(businessProfile.stateCode);
      setBillingAddress('');
      setShippingAddress('');
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
      setShippingAddress(party.shippingAddresses?.[0] || party.billingAddress || '');
      setStateOfSupply(party.state);
    }
  };

  // Row item changes
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
        priceUnit: item.salePrice,
        taxRate: item.taxRate,
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

  const handleRowChange = (index: number, field: keyof TransactionItem, value: unknown) => {
    setIsDirty(true);
    const updated = [...rows];
    updated[index] = {
      ...updated[index],
      [field]: value,
    };
    recalculateRow(updated, index);
  };

  const isInterState = stateOfSupply !== businessProfile.state;

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

  // Auto set received amount if Cash sale
  useEffect(() => {
    if (paymentType === 'cash') {
      setReceivedAmount(totalAmount.toString());
    }
  }, [paymentType, totalAmount]);

  const received = parseFloat(receivedAmount) || 0;
  const balanceDue = Math.max(0, Math.round((totalAmount - received) * 100) / 100);

  // Taxes breakdown
  const taxBreakdown = calculateTax(subtotal, rows[0]?.taxRate || 18, isInterState);
  const cgst = isInterState ? 0 : Math.round((totalTax / 2) * 100) / 100;
  const sgst = isInterState ? 0 : Math.round((totalTax / 2) * 100) / 100;
  const igst = isInterState ? totalTax : 0;

  // Attempt close with unsaved check
  const handleAttemptClose = () => {
    if (isDirty) {
      setShowDiscardConfirm(true);
    } else {
      onClose();
    }
  };

  // Save handler
  const handleSave = async () => {
    if (!invoiceNo.trim()) {
      setErrors('Invoice number is required');
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
        setErrors(`Price per unit for "${item.name || 'Row'}" cannot be negative.`);
        return;
      }
    }

    setIsSaving(true);
    setErrors(null);

    try {
      // AppSettings validations (negative stock & credit limit)
      const settings = await getAppSettings();

      // Check negative stock
      for (const item of validItems) {
        if (item.itemId) {
          const dbItem = itemsList.find((i) => String(i.id) === String(item.itemId));
          if (dbItem) {
            const reqQty = (Number(item.qty) || 0) + (Number(item.freeQty) || 0);
            const currentStock = Number(dbItem.currentStock) || 0;
            if (currentStock < reqQty) {
              const shortBy = reqQty - currentStock;
              if (settings.blockNegativeStock) {
                setErrors(
                  `Blocked: Insufficient stock for "${dbItem.name}". Available: ${currentStock} ${dbItem.unit || 'units'}, Requested: ${reqQty} (Short by ${shortBy}). Stock restriction is enabled in Application Settings.`
                );
                setIsSaving(false);
                return;
              }
            }
          }
        }
      }

      // Check credit limit for customer
      if (paymentType === 'credit' && selectedPartyId && settings.enableCreditLimitAlerts) {
        const party = parties.find((p) => String(p.id) === String(selectedPartyId));
        if (party && party.creditLimit && party.creditLimit > 0) {
          const currentBalance = Number(party.currentBalance ?? party.openingBalance) || 0;
          const projectedBalance = currentBalance + balanceDue;
          if (projectedBalance > party.creditLimit) {
            const exceededBy = projectedBalance - party.creditLimit;
            setErrors(
              `Credit Limit Alert for ${party.name}: Credit limit is ${formatINR(party.creditLimit)}, but total outstanding will become ${formatINR(projectedBalance)} (Exceeded by ${formatINR(exceededBy)}).`
            );
            setIsSaving(false);
            return;
          }
        }
      }

      const tx = await saveTransaction({
        id: transactionToEdit ? transactionToEdit.id : undefined,
        type: isChallan ? 'delivery_challan' : 'sale_invoice',
        challanStatus: isChallan ? (transactionToEdit?.challanStatus || 'open') : undefined,
        invoiceNo: invoiceNo.trim(),
        date: invoiceDate,
        partyId: selectedPartyId,
        partyName: partyName.trim(),
        partyGstin: partyGstin.trim(),
        partyPhone: partyPhone.trim(),
        partyState,
        partyStateCode,
        billingAddress,
        shippingAddress,
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
        receivedAmount: received,
        balanceDue,
        description: notes,
        terms,
        vehicleNo,
        deliveryDate,
        godown,
        copiesCount,
        documentUrl,
        status: 'active',
      });

      setIsDirty(false);
      onSaved(tx);
      onClose();
    } catch {
      setErrors('Failed to save sale invoice.');
    } finally {
      setIsSaving(false);
    }
  };

  // In-modal Keyboard shortcuts (Ctrl+Enter to Save, Alt+A to Add Row, Esc to Close)
  useEffect(() => {
    if (!isOpen) return;
    const handleModalKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.key === 'Enter') {
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
  }, [isOpen, invoiceNo, rows, paymentType, selectedPartyId, received, balanceDue, isDirty]);

  // Quick WhatsApp Share
  const handleShareWhatsApp = () => {
    const cleanPhone = (partyPhone || '').replace(/\D/g, '');
    const phone = cleanPhone.length === 10 ? `91${cleanPhone}` : cleanPhone;
    const msg = encodeURIComponent(
      `Dear ${partyName}, your invoice ${invoiceNo} of ${formatINR(totalAmount)} dated ${invoiceDate} from ${
        businessProfile.businessName
      } is generated. Balance due: ${formatINR(balanceDue)}. Thank you!`
    );
    window.open(`https://wa.me/${phone}?text=${msg}`, '_blank');
  };

  if (!isOpen) return null;

  return (
    <>
      <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-2 sm:p-4 overflow-y-auto">
        <div className="w-full max-w-5xl bg-white rounded-xl shadow-2xl border border-slate-200 overflow-hidden my-4 flex flex-col max-h-[95vh]">
          {/* Header & Tabs */}
          <div className="bg-slate-900 text-white shrink-0">
            {/* Top row with tab indicator and close */}
            <div className="flex items-center justify-between px-6 py-3 border-b border-slate-800">
              <div className="flex items-center gap-3">
                <span className="w-2.5 h-2.5 rounded-full bg-rose-500" />
                <h2 className="text-sm font-bold tracking-tight">
                  {transactionToEdit ? `Edit Sale Invoice (${transactionToEdit.invoiceNo})` : 'Create Sale Invoice'}
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
                      paymentType === 'credit' ? 'bg-rose-600 text-white shadow-xs' : 'text-slate-400 hover:text-white'
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
                      paymentType === 'cash' ? 'bg-rose-600 text-white shadow-xs' : 'text-slate-400 hover:text-white'
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

            {/* Multiple Invoice Tabs Bar (Vyapar style) */}
            <div className="flex items-center px-4 pt-1 bg-slate-950/80 gap-1 overflow-x-auto text-xs">
              <div className="px-4 py-2 bg-white text-slate-900 font-semibold rounded-t-lg border-t-2 border-rose-500 flex items-center gap-2">
                <span>{invoiceNo || 'New Invoice'}</span>
                <span className="text-[10px] text-slate-500 font-normal">({paymentType.toUpperCase()})</span>
              </div>
            </div>
          </div>

          {/* Form Content */}
          <div className="p-6 overflow-y-auto flex-1 space-y-5">
            {errors && (
              <div className="p-3 text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded-lg flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{errors}</span>
              </div>
            )}

            {/* Top Row: Party Selection, Invoice Details, Godown */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-200">
              {/* Party selection */}
              <div className="md:col-span-2">
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-semibold text-slate-700">Customer / Party *</label>
                  <button
                    type="button"
                    onClick={() => setShowQuickParty(true)}
                    className="text-[11px] text-rose-600 hover:text-rose-700 font-semibold flex items-center gap-1 cursor-pointer"
                  >
                    <UserPlus className="w-3 h-3" />
                    <span>+ New Party</span>
                  </button>
                </div>
                <select
                  value={selectedPartyId}
                  onChange={(e) => handlePartySelect(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-slate-900 cursor-pointer"
                >
                  <option value="">Cash Sale (Walk-in Customer)</option>
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

              {/* Invoice Number */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Invoice Number *</label>
                <input
                  type="text"
                  value={invoiceNo}
                  onChange={(e) => {
                    setIsDirty(true);
                    setInvoiceNo(e.target.value);
                  }}
                  className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-slate-900 font-mono"
                />
              </div>

              {/* Invoice Date */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Invoice Date *</label>
                <input
                  type="date"
                  value={invoiceDate}
                  onChange={(e) => {
                    setIsDirty(true);
                    setInvoiceDate(e.target.value);
                  }}
                  className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-slate-900 font-mono"
                />
              </div>

              {/* State of Supply */}
              <div className="md:col-span-2">
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  State of Supply (Determines CGST+SGST vs IGST)
                </label>
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
                <span className="text-[11px] text-slate-500 mt-1 block">
                  {isInterState ? 'Inter-state Sale: IGST applied' : 'Intra-state Sale: CGST + SGST applied'}
                </span>
              </div>

              {/* Godown / Warehouse */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Godown / Location</label>
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

              {/* Number of Copies */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Print Copies</label>
                <select
                  value={copiesCount}
                  onChange={(e) => {
                    setIsDirty(true);
                    setCopiesCount(Number(e.target.value));
                  }}
                  className="w-full px-3 py-1.5 text-xs bg-white border border-slate-300 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-slate-900 cursor-pointer"
                >
                  <option value={1}>1 - Original</option>
                  <option value={2}>2 - Original + Duplicate</option>
                  <option value={3}>3 - Triplicate</option>
                </select>
              </div>

              {/* Billing Address */}
              <div className="md:col-span-2">
                <label className="block text-xs font-semibold text-slate-700 mb-1">Billing Address</label>
                <input
                  type="text"
                  value={billingAddress}
                  onChange={(e) => {
                    setIsDirty(true);
                    setBillingAddress(e.target.value);
                  }}
                  placeholder="Auto-filled from party or enter address"
                  className="w-full px-3 py-1.5 text-xs bg-white border border-slate-300 rounded-lg"
                />
              </div>

              {/* Shipping Address */}
              <div className="md:col-span-2">
                <label className="block text-xs font-semibold text-slate-700 mb-1">Shipping Address</label>
                <input
                  type="text"
                  value={shippingAddress}
                  onChange={(e) => {
                    setIsDirty(true);
                    setShippingAddress(e.target.value);
                  }}
                  placeholder="Shipping destination (auto-filled from party)"
                  className="w-full px-3 py-1.5 text-xs bg-white border border-slate-300 rounded-lg"
                />
              </div>
            </div>

            {/* Line Items Grid */}
            <div className="border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
              <div className="bg-slate-100 px-4 py-2.5 flex items-center justify-between border-b border-slate-200">
                <span className="text-xs font-bold text-slate-800 uppercase tracking-wider">Item Details</span>
                <button
                  type="button"
                  onClick={() => setShowQuickItem(true)}
                  className="text-xs text-rose-600 hover:text-rose-700 font-semibold flex items-center gap-1 cursor-pointer"
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
                      <th className="py-2.5 px-3 w-28 text-right">Price / Unit (₹)</th>
                      <th className="py-2.5 px-3 w-24">Tax %</th>
                      <th className="py-2.5 px-3 w-24 text-right">Tax (₹)</th>
                      <th className="py-2.5 px-3 w-28 text-right">Amount (₹)</th>
                      <th className="py-2.5 px-2 w-10 text-center"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {rows.map((row, idx) => (
                      <tr key={row.id} className="hover:bg-slate-50/50">
                        <td className="py-2 px-3 text-center text-slate-400 font-mono text-[11px]">
                          {idx + 1}
                        </td>

                        {/* Item selector or input */}
                        <td className="py-2 px-3">
                          <div className="flex items-center gap-1.5">
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
                          </div>
                          {!row.itemId && (
                            <input
                              type="text"
                              value={row.name}
                              onChange={(e) => handleRowChange(idx, 'name', e.target.value)}
                              placeholder="Or enter custom item name"
                              className="mt-1 w-full px-2 py-1 text-[11px] bg-slate-50 border border-slate-200 rounded-md"
                            />
                          )}
                        </td>

                        {/* HSN */}
                        <td className="py-2 px-3">
                          <input
                            type="text"
                            value={row.hsn}
                            onChange={(e) => handleRowChange(idx, 'hsn', e.target.value)}
                            className="w-full px-2 py-1.5 text-xs bg-white border border-slate-300 rounded-md font-mono"
                          />
                        </td>

                        {/* Qty */}
                        <td className="py-2 px-2.5">
                          <input
                            type="number"
                            min="0.01"
                            step="any"
                            value={row.qty}
                            onChange={(e) => handleRowChange(idx, 'qty', parseFloat(e.target.value) || 0)}
                            className="w-full px-2 py-1.5 text-xs bg-white border border-slate-300 rounded-md font-mono"
                          />
                        </td>

                        {/* Free Qty */}
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

                        {/* Unit */}
                        <td className="py-2 px-3">
                          <select
                            value={row.unit}
                            onChange={(e) => handleRowChange(idx, 'unit', e.target.value)}
                            className="w-full px-1.5 py-1.5 text-xs bg-white border border-slate-300 rounded-md"
                          >
                            {STANDARD_UNITS.map((u) => (
                              <option key={u} value={u}>
                                {u}
                              </option>
                            ))}
                          </select>
                        </td>

                        {/* Price Unit */}
                        <td className="py-2 px-3 text-right">
                          <input
                            type="number"
                            step="0.01"
                            value={row.priceUnit}
                            onChange={(e) => handleRowChange(idx, 'priceUnit', parseFloat(e.target.value) || 0)}
                            className="w-full px-2 py-1.5 text-xs bg-white border border-slate-300 rounded-md text-right font-mono"
                          />
                        </td>

                        {/* Tax Rate % */}
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

                        {/* Tax Amount */}
                        <td className="py-2 px-3 text-right font-mono tabular-nums text-slate-700">
                          {formatINR(row.taxAmount, false)}
                        </td>

                        {/* Total Amount */}
                        <td className="py-2 px-3 text-right font-mono font-bold text-slate-900 tabular-nums">
                          {formatINR(row.totalAmount, false)}
                        </td>

                        {/* Delete row */}
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
                  className="px-3 py-1.5 text-xs font-semibold text-rose-600 bg-white border border-rose-300 hover:bg-rose-50 rounded-lg flex items-center gap-1 shadow-2xs transition-colors cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Row</span>
                </button>
              </div>
            </div>

            {/* Bottom Summary: Notes, Terms, GST Breakdown, Round-off, Total, Received */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Invoice Notes / Description</label>
                  <textarea
                    rows={2}
                    value={notes}
                    onChange={(e) => {
                      setIsDirty(true);
                      setNotes(e.target.value);
                    }}
                    placeholder="Remarks or internal notes..."
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Terms & Conditions</label>
                  <textarea
                    rows={2}
                    value={terms}
                    onChange={(e) => {
                      setIsDirty(true);
                      setTerms(e.target.value);
                    }}
                    placeholder="Goods once sold will not be taken back..."
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Vehicle No (Optional)</label>
                    <input
                      type="text"
                      value={vehicleNo}
                      onChange={(e) => {
                        setIsDirty(true);
                        setVehicleNo(e.target.value.toUpperCase());
                      }}
                      placeholder="e.g. MH12AB1234"
                      className="w-full px-3 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded-lg uppercase font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Delivery Date</label>
                    <input
                      type="date"
                      value={deliveryDate}
                      onChange={(e) => {
                        setIsDirty(true);
                        setDeliveryDate(e.target.value);
                      }}
                      className="w-full px-3 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded-lg font-mono"
                    />
                  </div>
                </div>

                {/* Document / Image Attachment */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Attach Document / Photo</label>
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
                    className="w-full text-xs text-slate-500 file:mr-2 file:py-1 file:px-2.5 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-slate-100 file:text-slate-700 hover:file:bg-slate-200 cursor-pointer"
                  />
                  {documentUrl && (
                    <span className="text-[10px] text-emerald-600 mt-1 block">File attached successfully</span>
                  )}
                </div>
              </div>

              {/* Totals Card */}
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-2 text-xs">
                <div className="flex items-center justify-between text-slate-600">
                  <span>Taxable Subtotal:</span>
                  <span className="font-mono tabular-nums">{formatINR(subtotal)}</span>
                </div>

                {isInterState ? (
                  <div className="flex items-center justify-between text-slate-600">
                    <span>IGST:</span>
                    <span className="font-mono tabular-nums">{formatINR(igst)}</span>
                  </div>
                ) : (
                  <>
                    <div className="flex items-center justify-between text-slate-600">
                      <span>CGST:</span>
                      <span className="font-mono tabular-nums">{formatINR(cgst)}</span>
                    </div>
                    <div className="flex items-center justify-between text-slate-600">
                      <span>SGST:</span>
                      <span className="font-mono tabular-nums">{formatINR(sgst)}</span>
                    </div>
                  </>
                )}

                {roundOff !== 0 && (
                  <div className="flex items-center justify-between text-slate-500 text-[11px]">
                    <span>Round Off:</span>
                    <span className="font-mono tabular-nums">{formatINR(roundOff)}</span>
                  </div>
                )}

                <div className="border-t border-slate-300 pt-2 flex items-center justify-between text-base font-bold text-slate-900">
                  <span>Total Amount:</span>
                  <span className="font-mono text-lg text-rose-600 tabular-nums">{formatINR(totalAmount)}</span>
                </div>

                <div className="pt-2 border-t border-slate-200 grid grid-cols-2 gap-3 items-center">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                      Received Amount (₹)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={receivedAmount}
                      onChange={(e) => {
                        setIsDirty(true);
                        setReceivedAmount(e.target.value);
                      }}
                      className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded-md font-mono"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                      Balance Due (₹)
                    </label>
                    <div className="px-2.5 py-1.5 text-xs bg-white border border-slate-200 rounded-md font-mono font-bold text-amber-700">
                      {formatINR(balanceDue)}
                    </div>
                  </div>
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

              {/* Share Dropdown Button */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setShowShareDropdown(!showShareDropdown)}
                  className="px-3.5 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer flex items-center gap-1.5"
                >
                  <span>Share</span>
                  <span className="text-[10px]">▼</span>
                </button>

                {showShareDropdown && (
                  <div className="absolute right-0 bottom-full mb-1 w-44 bg-white rounded-lg shadow-xl border border-slate-200 py-1 z-30 text-xs">
                    <button
                      type="button"
                      onClick={() => {
                        setShowShareDropdown(false);
                        handleShareWhatsApp();
                      }}
                      className="w-full text-left px-3 py-2 text-slate-700 hover:bg-slate-50 cursor-pointer"
                    >
                      Share via WhatsApp
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setShowShareDropdown(false);
                        handleSave();
                      }}
                      className="w-full text-left px-3 py-2 text-slate-700 hover:bg-slate-50 cursor-pointer"
                    >
                      Save & Print A4
                    </button>
                  </div>
                )}
              </div>

              <button
                type="button"
                onClick={handleSave}
                disabled={isSaving}
                className="px-5 py-2 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 disabled:opacity-50 rounded-lg shadow-sm transition-colors cursor-pointer flex items-center gap-1.5"
              >
                <span>{isSaving ? 'Saving...' : 'Save'}</span>
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
        defaultType="Customer"
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
          if (activeItemRowIndex !== null && activeItemRowIndex < rows.length) {
            handleItemSelect(activeItemRowIndex, newItem.id);
          } else {
            // Pick first empty or last
            const lastIdx = rows.length - 1;
            handleItemSelect(lastIdx, newItem.id);
          }
        }}
      />
    </>
  );
};
