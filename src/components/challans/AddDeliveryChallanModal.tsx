import React, { useState, useEffect } from 'react';
import { X, Plus, Trash2, UserPlus, PackagePlus, AlertCircle, Truck } from 'lucide-react';
import { BusinessProfile, Item, Party, Transaction, TransactionItem } from '../../types';
import { INDIAN_STATES, GST_RATES, STANDARD_UNITS } from '../../types/indianStates';
import { getItems, getParties, saveTransaction } from '../../db/indexedDB';
import { calculateTax, formatINR, getTodayISO } from '../../utils/formatters';
import { ConfirmDiscardModal } from '../common/ConfirmDiscardModal';
import { QuickAddPartyModal } from '../modals/QuickAddPartyModal';
import { QuickAddItemModal } from '../modals/QuickAddItemModal';

interface AddDeliveryChallanModalProps {
  isOpen: boolean;
  onClose: () => void;
  businessProfile: BusinessProfile;
  onSaved: (tx: Transaction) => void;
  initialPartyId?: string;
  transactionToEdit?: Transaction | null;
}

export const AddDeliveryChallanModal: React.FC<AddDeliveryChallanModalProps> = ({
  isOpen,
  onClose,
  businessProfile,
  onSaved,
  initialPartyId,
  transactionToEdit,
}) => {
  const [parties, setParties] = useState<Party[]>([]);
  const [itemsList, setItemsList] = useState<Item[]>([]);

  // Challan headers
  const [selectedPartyId, setSelectedPartyId] = useState('');
  const [partyName, setPartyName] = useState('');
  const [partyGstin, setPartyGstin] = useState('');
  const [partyPhone, setPartyPhone] = useState('');
  const [partyState, setPartyState] = useState(businessProfile.state);
  const [partyStateCode, setPartyStateCode] = useState(businessProfile.stateCode);
  const [billingAddress, setBillingAddress] = useState('');
  const [shippingAddress, setShippingAddress] = useState('');
  const [stateOfSupply, setStateOfSupply] = useState(businessProfile.state);

  const [challanNo, setChallanNo] = useState(
    `${businessProfile.challanPrefix || 'DC-'}${String(businessProfile.nextChallanNumber || 1).padStart(4, '0')}`
  );
  const [challanDate, setChallanDate] = useState(getTodayISO());
  const [dueDate, setDueDate] = useState('');
  const [deliveryDate, setDeliveryDate] = useState('');
  const [vehicleNo, setVehicleNo] = useState('');
  const [godown, setGodown] = useState('Main Godown');
  const [terms, setTerms] = useState(businessProfile.terms || '');
  const [notes, setNotes] = useState('');
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

  // Dirty check & Discard modal
  const [isDirty, setIsDirty] = useState(false);
  const [showDiscardConfirm, setShowDiscardConfirm] = useState(false);

  // Quick modals
  const [showQuickParty, setShowQuickParty] = useState(false);
  const [showQuickItem, setShowQuickItem] = useState(false);
  const [activeItemRowIndex, setActiveItemRowIndex] = useState<number | null>(null);

  const [errors, setErrors] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (isOpen) {
      loadDependencies();
      if (transactionToEdit) {
        setSelectedPartyId(transactionToEdit.partyId);
        setPartyName(transactionToEdit.partyName);
        setPartyGstin(transactionToEdit.partyGstin || '');
        setPartyPhone(transactionToEdit.partyPhone || '');
        setPartyState(transactionToEdit.partyState);
        setPartyStateCode(transactionToEdit.partyStateCode);
        setBillingAddress(transactionToEdit.billingAddress);
        setShippingAddress(transactionToEdit.shippingAddress);
        setStateOfSupply(transactionToEdit.stateOfSupply);
        setChallanNo(transactionToEdit.invoiceNo);
        setChallanDate(transactionToEdit.date);
        setDueDate(transactionToEdit.dueDate || '');
        setDeliveryDate(transactionToEdit.deliveryDate || '');
        setVehicleNo(transactionToEdit.vehicleNo || '');
        setGodown(transactionToEdit.godown || 'Main Godown');
        setTerms(transactionToEdit.terms || businessProfile.terms || '');
        setNotes(transactionToEdit.description || '');
        setDocumentUrl(transactionToEdit.documentUrl || '');
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
        setChallanNo(
          `${businessProfile.challanPrefix || 'DC-'}${String(businessProfile.nextChallanNumber || 1).padStart(4, '0')}`
        );
      }
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
        setShippingAddress(match.shippingAddresses?.[0] || match.billingAddress || '');
        setStateOfSupply(match.state);
      }
    }
  };

  const handlePartySelect = (partyId: string) => {
    setIsDirty(true);
    setSelectedPartyId(partyId);
    if (!partyId) {
      setPartyName('');
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
    if (!partyName.trim()) {
      setErrors('Please select or specify a Customer / Party');
      return;
    }
    if (!challanNo.trim()) {
      setErrors('Challan number is required');
      return;
    }
    if (rows.length === 0 || !rows.some((r) => r.name.trim() || r.itemId)) {
      setErrors('Please add at least one valid item');
      return;
    }

    setIsSaving(true);
    setErrors(null);

    try {
      const validItems = rows.filter((r) => r.name.trim() || r.itemId);

      const tx = await saveTransaction({
        id: transactionToEdit ? transactionToEdit.id : undefined,
        type: 'delivery_challan',
        invoiceNo: challanNo.trim(),
        date: challanDate,
        dueDate,
        deliveryDate,
        vehicleNo,
        godown,
        partyId: selectedPartyId,
        partyName: partyName.trim(),
        partyGstin: partyGstin.trim(),
        partyPhone: partyPhone.trim(),
        partyState,
        partyStateCode,
        billingAddress,
        shippingAddress,
        stateOfSupply,
        paymentType: 'credit',
        items: validItems,
        subtotal: Math.round(subtotal * 100) / 100,
        cgst,
        sgst,
        igst,
        totalTax: Math.round(totalTax * 100) / 100,
        roundOff,
        totalAmount,
        receivedAmount: 0,
        balanceDue: totalAmount,
        description: notes,
        terms,
        documentUrl,
        challanStatus: transactionToEdit?.challanStatus || 'open',
        status: 'active',
      });

      setIsDirty(false);
      onSaved(tx);
      onClose();
    } catch {
      setErrors('Failed to save delivery challan.');
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <>
      <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-2 sm:p-4 overflow-y-auto">
        <div className="w-full max-w-5xl bg-white rounded-xl shadow-2xl border border-slate-200 overflow-hidden my-4 flex flex-col max-h-[95vh]">
          {/* Header */}
          <div className="bg-slate-900 text-white shrink-0">
            <div className="flex items-center justify-between px-6 py-3 border-b border-slate-800">
              <div className="flex items-center gap-2.5">
                <Truck className="w-4 h-4 text-rose-500" />
                <h2 className="text-sm font-bold tracking-tight">
                  {transactionToEdit ? `Edit Delivery Challan (${transactionToEdit.invoiceNo})` : 'Create Delivery Challan'}
                </h2>
                <span className="text-[10px] px-2 py-0.5 bg-slate-800 text-slate-300 rounded font-mono">
                  Inventory will only deduct upon Sale Conversion
                </span>
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
              <div className="px-4 py-2 bg-white text-slate-900 font-semibold rounded-t-lg border-t-2 border-rose-500 flex items-center gap-2">
                <span>{challanNo || 'New Challan'}</span>
                <span className="text-[10px] text-slate-500 font-normal">(DELIVERY CHALLAN)</span>
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

            {/* Top Row: Party Selection, Challan Details, Dates */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-200">
              {/* Party selection */}
              <div className="md:col-span-2">
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-semibold text-slate-700">Customer / Consignee *</label>
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
                  <option value="">Select Customer / Party</option>
                  {parties.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} {p.phone ? `(${p.phone})` : ''}
                    </option>
                  ))}
                </select>

                {!selectedPartyId && (
                  <input
                    type="text"
                    value={partyName}
                    onChange={(e) => {
                      setIsDirty(true);
                      setPartyName(e.target.value);
                    }}
                    placeholder="Or enter party / consignee name"
                    className="mt-1 w-full px-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg"
                  />
                )}
              </div>

              {/* Challan Number */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Challan Number *</label>
                <input
                  type="text"
                  value={challanNo}
                  onChange={(e) => {
                    setIsDirty(true);
                    setChallanNo(e.target.value);
                  }}
                  className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-slate-900 font-mono"
                />
              </div>

              {/* Challan Date */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Challan Date *</label>
                <input
                  type="date"
                  value={challanDate}
                  onChange={(e) => {
                    setIsDirty(true);
                    setChallanDate(e.target.value);
                  }}
                  className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-slate-900 font-mono"
                />
              </div>

              {/* Due Date */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Return / Due Date</label>
                <input
                  type="date"
                  value={dueDate}
                  onChange={(e) => {
                    setIsDirty(true);
                    setDueDate(e.target.value);
                  }}
                  className="w-full px-3 py-1.5 text-xs bg-white border border-slate-300 rounded-lg font-mono"
                />
              </div>

              {/* Dispatch / Delivery Date */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Delivery / Dispatch Date</label>
                <input
                  type="date"
                  value={deliveryDate}
                  onChange={(e) => {
                    setIsDirty(true);
                    setDeliveryDate(e.target.value);
                  }}
                  className="w-full px-3 py-1.5 text-xs bg-white border border-slate-300 rounded-lg font-mono"
                />
              </div>

              {/* Vehicle Number */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Vehicle No</label>
                <input
                  type="text"
                  value={vehicleNo}
                  onChange={(e) => {
                    setIsDirty(true);
                    setVehicleNo(e.target.value.toUpperCase());
                  }}
                  placeholder="e.g. MH12AB1234"
                  className="w-full px-3 py-1.5 text-xs bg-white border border-slate-300 rounded-lg uppercase font-mono"
                />
              </div>

              {/* Godown */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Dispatch Godown</label>
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
                  placeholder="Auto-filled or custom address"
                  className="w-full px-3 py-1.5 text-xs bg-white border border-slate-300 rounded-lg"
                />
              </div>

              {/* Shipping Address */}
              <div className="md:col-span-2">
                <label className="block text-xs font-semibold text-slate-700 mb-1">Delivery Destination Address</label>
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
                <span className="text-xs font-bold text-slate-800 uppercase tracking-wider">Dispatched Items</span>
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
                      <th className="py-2.5 px-3 w-28 text-right">Rate (₹)</th>
                      <th className="py-2.5 px-3 w-24">Tax %</th>
                      <th className="py-2.5 px-3 w-28 text-right">Est. Amount (₹)</th>
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
                  className="px-3 py-1.5 text-xs font-semibold text-rose-600 bg-white border border-rose-300 hover:bg-rose-50 rounded-lg flex items-center gap-1 shadow-2xs transition-colors cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Row</span>
                </button>
              </div>
            </div>

            {/* Terms and Bottom Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Add Terms & Delivery Conditions</label>
                  <textarea
                    rows={2}
                    value={terms}
                    onChange={(e) => {
                      setIsDirty(true);
                      setTerms(e.target.value);
                    }}
                    placeholder="Challan valid for 30 days. Dispatched in good condition..."
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Dispatch Remarks</label>
                  <textarea
                    rows={2}
                    value={notes}
                    onChange={(e) => {
                      setIsDirty(true);
                      setNotes(e.target.value);
                    }}
                    placeholder="Driver name, courier tracking number..."
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg"
                  />
                </div>
              </div>

              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-2 text-xs self-start">
                <div className="flex items-center justify-between text-slate-600">
                  <span>Goods Subtotal:</span>
                  <span className="font-mono tabular-nums">{formatINR(subtotal)}</span>
                </div>
                <div className="flex items-center justify-between text-slate-600">
                  <span>Est. GST ({isInterState ? 'IGST' : 'CGST+SGST'}):</span>
                  <span className="font-mono tabular-nums">{formatINR(totalTax)}</span>
                </div>
                <div className="border-t border-slate-300 pt-2 flex items-center justify-between text-base font-bold text-slate-900">
                  <span>Total Estimated Value:</span>
                  <span className="font-mono text-lg text-slate-900 tabular-nums">{formatINR(totalAmount)}</span>
                </div>
                <p className="text-[11px] text-slate-500 pt-1">
                  Note: Delivery Challan is for transport/approval. Converting to a Sale Invoice will book the sale and deduct stock.
                </p>
              </div>
            </div>
          </div>

          {/* Footer Actions */}
          <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between shrink-0">
            <span className="text-[11px] text-slate-500">
              {isDirty ? 'Unsaved changes pending' : 'All changes saved'}
            </span>
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
                className="px-5 py-2 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 disabled:opacity-50 rounded-lg shadow-sm transition-colors cursor-pointer"
              >
                {isSaving ? 'Saving...' : 'Save Delivery Challan'}
              </button>
            </div>
          </div>
        </div>
      </div>

      <ConfirmDiscardModal
        isOpen={showDiscardConfirm}
        onConfirm={() => {
          setShowDiscardConfirm(false);
          setIsDirty(false);
          onClose();
        }}
        onCancel={() => setShowDiscardConfirm(false)}
      />

      <QuickAddPartyModal
        isOpen={showQuickParty}
        defaultType="Customer"
        onClose={() => setShowQuickParty(false)}
        onSaved={(newParty) => {
          setParties((prev) => [...prev, newParty]);
          handlePartySelect(newParty.id);
        }}
      />

      <QuickAddItemModal
        isOpen={showQuickItem}
        onClose={() => setShowQuickItem(false)}
        onSaved={(newItem) => {
          setItemsList((prev) => [...prev, newItem]);
          const lastIdx = rows.length - 1;
          handleItemSelect(lastIdx, newItem.id);
        }}
      />
    </>
  );
};
