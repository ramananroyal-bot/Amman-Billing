import React, { useState, useEffect } from 'react';
import { X, Plus, Trash2, Users, MapPin, CreditCard, FileText } from 'lucide-react';
import { Party, GSTType } from '../../types';
import { INDIAN_STATES, getStateFromGSTIN, validateGSTIN } from '../../types/indianStates';
import { saveParty } from '../../db/indexedDB';
import { ConfirmDiscardModal } from '../common/ConfirmDiscardModal';

interface AddPartyModalProps {
  isOpen: boolean;
  onClose: () => void;
  partyToEdit?: Party | null;
  onSaved: (party: Party, isSaveAndNew?: boolean) => void;
  defaultGroup?: 'Customer' | 'Supplier';
}

type PartyTab = 'gst_address' | 'credit_balance' | 'additional';

export const AddPartyModal: React.FC<AddPartyModalProps> = ({
  isOpen,
  onClose,
  partyToEdit,
  onSaved,
  defaultGroup = 'Customer',
}) => {
  const [activeTab, setActiveTab] = useState<PartyTab>('gst_address');

  // Form states
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [gstin, setGstin] = useState('');
  const [group, setGroup] = useState<'Customer' | 'Supplier'>(defaultGroup);
  const [gstType, setGstType] = useState<GSTType>('Unregistered');
  const [state, setState] = useState('Maharashtra');
  const [stateCode, setStateCode] = useState('27');
  const [billingAddress, setBillingAddress] = useState('');
  const [shippingAddresses, setShippingAddresses] = useState<string[]>([]);
  const [newShippingAddressInput, setNewShippingAddressInput] = useState('');
  const [showAddShippingBox, setShowAddShippingBox] = useState(false);

  // Credit & Balance
  const [openingBalance, setOpeningBalance] = useState('0');
  const [openingBalanceType, setOpeningBalanceType] = useState<'to_receive' | 'to_pay'>('to_receive');
  const [openingBalanceDate, setOpeningBalanceDate] = useState(new Date().toISOString().split('T')[0]);
  const [creditLimit, setCreditLimit] = useState('0');

  // Additional Fields
  const [panNumber, setPanNumber] = useState('');
  const [notes, setNotes] = useState('');

  // Dirty check & modal
  const [isDirty, setIsDirty] = useState(false);
  const [showDiscardConfirm, setShowDiscardConfirm] = useState(false);

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSaving, setIsSaving] = useState(false);

  // Populate when editing
  useEffect(() => {
    if (isOpen) {
      if (partyToEdit) {
        setName(partyToEdit.name);
        setPhone(partyToEdit.phone || '');
        setEmail(partyToEdit.email || '');
        setGstin(partyToEdit.gstin || '');
        setGroup((partyToEdit.group as 'Customer' | 'Supplier') || 'Customer');
        setGstType(partyToEdit.gstType || 'Unregistered');
        setState(partyToEdit.state || 'Maharashtra');
        setStateCode(partyToEdit.stateCode || '27');
        setBillingAddress(partyToEdit.billingAddress || '');
        setShippingAddresses(partyToEdit.shippingAddresses || []);
        setOpeningBalance(String(partyToEdit.openingBalance || 0));
        setOpeningBalanceType(partyToEdit.openingBalanceType || 'to_receive');
        setOpeningBalanceDate(partyToEdit.openingBalanceDate || new Date().toISOString().split('T')[0]);
        setCreditLimit(String(partyToEdit.creditLimit || 0));
        setPanNumber(partyToEdit.panNumber || '');
        setNotes(partyToEdit.notes || '');
      } else {
        resetForm();
      }
      setIsDirty(false);
      setActiveTab('gst_address');
    }
  }, [isOpen, partyToEdit, defaultGroup]);

  const resetForm = () => {
    setName('');
    setPhone('');
    setEmail('');
    setGstin('');
    setGroup(defaultGroup);
    setGstType('Unregistered');
    setState('Maharashtra');
    setStateCode('27');
    setBillingAddress('');
    setShippingAddresses([]);
    setOpeningBalance('0');
    setOpeningBalanceType(defaultGroup === 'Customer' ? 'to_receive' : 'to_pay');
    setOpeningBalanceDate(new Date().toISOString().split('T')[0]);
    setCreditLimit('0');
    setPanNumber('');
    setNotes('');
    setShowAddShippingBox(false);
    setNewShippingAddressInput('');
    setErrors({});
    setIsDirty(false);
  };

  const handleGstinChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setIsDirty(true);
    const val = e.target.value.toUpperCase().trim();
    setGstin(val);

    if (val.length >= 2) {
      const detected = getStateFromGSTIN(val);
      if (detected) {
        setState(detected.name);
        setStateCode(detected.code);
      }
    }
    if (val.length >= 12) {
      setPanNumber(val.substring(2, 12));
    }
    if (val.length > 0) {
      setGstType('Registered');
    }
  };

  const handleAddShippingAddress = () => {
    if (!newShippingAddressInput.trim()) return;
    setIsDirty(true);
    setShippingAddresses((prev) => [...prev, newShippingAddressInput.trim()]);
    setNewShippingAddressInput('');
    setShowAddShippingBox(false);
  };

  const handleRemoveShippingAddress = (index: number) => {
    setIsDirty(true);
    setShippingAddresses((prev) => prev.filter((_, i) => i !== index));
  };

  const validate = () => {
    const errs: Record<string, string> = {};
    if (!name.trim()) errs.name = 'Party name is required';
    if (!phone.trim()) {
      errs.phone = 'Phone number is required';
    } else {
      const cleanPhone = phone.trim().replace(/\D/g, '');
      if (cleanPhone.length !== 10 || !/^[6-9]\d{9}$/.test(cleanPhone)) {
        errs.phone = 'Enter a valid 10-digit Indian mobile number (e.g. 9876543210)';
      }
    }
    if (gstin.trim() && !validateGSTIN(gstin.trim())) {
      errs.gstin = 'Invalid 15-character GSTIN format';
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSave = async (saveAndNew: boolean = false) => {
    if (!validate()) {
      setActiveTab('gst_address');
      return;
    }

    setIsSaving(true);
    try {
      const saved = await saveParty({
        id: partyToEdit?.id,
        name: name.trim(),
        phone: phone.trim(),
        email: email.trim(),
        gstin: gstin.trim().toUpperCase(),
        group,
        gstType,
        state,
        stateCode,
        billingAddress: billingAddress.trim(),
        shippingAddresses: shippingAddresses.length > 0 ? shippingAddresses : (billingAddress.trim() ? [billingAddress.trim()] : []),
        openingBalance: parseFloat(openingBalance) || 0,
        openingBalanceType,
        openingBalanceDate,
        creditLimit: parseFloat(creditLimit) || 0,
        panNumber: panNumber.trim().toUpperCase(),
        notes: notes.trim(),
      });

      setIsDirty(false);
      onSaved(saved, saveAndNew);

      if (saveAndNew) {
        resetForm();
        setActiveTab('gst_address');
      } else {
        onClose();
      }
    } catch {
      setErrors({ form: 'Failed to save party. Please try again.' });
    } finally {
      setIsSaving(false);
    }
  };

  // In-modal Keyboard shortcuts (Ctrl+Enter to Save, Esc to Close)
  useEffect(() => {
    if (!isOpen) return;
    const handleModalKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.key === 'Enter') {
        e.preventDefault();
        handleSave(false);
      } else if (e.key === 'Escape') {
        e.preventDefault();
        handleAttemptClose();
      }
    };
    window.addEventListener('keydown', handleModalKeyDown);
    return () => window.removeEventListener('keydown', handleModalKeyDown);
  }, [isOpen, name, phone, gstin, billingAddress, openingBalance, creditLimit, isDirty]);

  const handleAttemptClose = () => {
    if (isDirty) {
      setShowDiscardConfirm(true);
    } else {
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <>
      <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-3 sm:p-5 overflow-y-auto">
        <div className="w-full max-w-2xl bg-white rounded-xl shadow-2xl border border-slate-200 overflow-hidden my-4 flex flex-col max-h-[92vh]">
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 bg-slate-900 text-white shrink-0">
            <div className="flex items-center gap-2.5">
              <Users className="w-5 h-5 text-rose-500" />
              <h2 className="text-sm font-bold tracking-tight">
                {partyToEdit ? `Edit Party - ${partyToEdit.name}` : `Add Party (${group})`}
              </h2>
            </div>
            <button
              type="button"
              onClick={handleAttemptClose}
              className="text-slate-400 hover:text-white transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Tab Strip */}
          <div className="flex items-center gap-1 px-6 pt-3 border-b border-slate-200 bg-slate-50 shrink-0">
            <button
              type="button"
              onClick={() => setActiveTab('gst_address')}
              className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold border-b-2 transition-colors cursor-pointer ${
                activeTab === 'gst_address'
                  ? 'border-rose-600 text-rose-600 bg-white rounded-t-md shadow-2xs'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <MapPin className="w-3.5 h-3.5" />
              <span>GST & Address</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('credit_balance')}
              className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold border-b-2 transition-colors cursor-pointer ${
                activeTab === 'credit_balance'
                  ? 'border-rose-600 text-rose-600 bg-white rounded-t-md shadow-2xs'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <CreditCard className="w-3.5 h-3.5" />
              <span>Credit & Balance</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('additional')}
              className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold border-b-2 transition-colors cursor-pointer ${
                activeTab === 'additional'
                  ? 'border-rose-600 text-rose-600 bg-white rounded-t-md shadow-2xs'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <FileText className="w-3.5 h-3.5" />
              <span>Additional Fields</span>
            </button>
          </div>

          {/* Form Tab Content */}
          <div className="p-6 overflow-y-auto flex-1 space-y-4">
            {errors.form && (
              <div className="p-3 text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded-lg">
                {errors.form}
              </div>
            )}

            {/* TAB 1: GST & Address */}
            {activeTab === 'gst_address' && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Name */}
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Party Name <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => {
                        setIsDirty(true);
                        setName(e.target.value);
                      }}
                      placeholder="e.g. Ramesh Trading Co. or John Doe"
                      className={`w-full px-3 py-2 text-xs bg-slate-50 border rounded-lg focus:outline-hidden focus:ring-1 focus:ring-slate-900 ${
                        errors.name ? 'border-rose-400 bg-rose-50/50' : 'border-slate-300'
                      }`}
                    />
                    {errors.name && <p className="mt-1 text-[11px] text-rose-600">{errors.name}</p>}
                  </div>

                  {/* Phone */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Phone Number <span className="text-rose-500">*</span>
                    </label>
                    <div className="relative">
                      <span className="absolute left-3 top-2 text-xs text-slate-400 font-mono">+91</span>
                      <input
                        type="tel"
                        value={phone}
                        onChange={(e) => {
                          setIsDirty(true);
                          setPhone(e.target.value);
                        }}
                        placeholder="9876543210"
                        maxLength={10}
                        className={`w-full pl-10 pr-3 py-2 text-xs bg-slate-50 border rounded-lg focus:outline-hidden focus:ring-1 focus:ring-slate-900 font-mono ${
                          errors.phone ? 'border-rose-400 bg-rose-50/50' : 'border-slate-300'
                        }`}
                      />
                    </div>
                    {errors.phone && <p className="mt-1 text-[11px] text-rose-600">{errors.phone}</p>}
                  </div>

                  {/* GSTIN */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      GSTIN (Optional)
                    </label>
                    <input
                      type="text"
                      value={gstin}
                      onChange={handleGstinChange}
                      placeholder="27AAAAA0000A1Z5"
                      maxLength={15}
                      className={`w-full px-3 py-2 text-xs bg-slate-50 border rounded-lg focus:outline-hidden focus:ring-1 focus:ring-slate-900 uppercase font-mono ${
                        errors.gstin ? 'border-rose-400 bg-rose-50/50' : 'border-slate-300'
                      }`}
                    />
                    {errors.gstin && <p className="mt-1 text-[11px] text-rose-600">{errors.gstin}</p>}
                  </div>

                  {/* Group: Customer vs Supplier */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Party Group</label>
                    <select
                      value={group}
                      onChange={(e) => {
                        setIsDirty(true);
                        setGroup(e.target.value as 'Customer' | 'Supplier');
                      }}
                      className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-slate-900 cursor-pointer"
                    >
                      <option value="Customer">Customer (Debtor)</option>
                      <option value="Supplier">Supplier (Creditor)</option>
                    </select>
                  </div>

                  {/* GST Type */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">GST Type</label>
                    <select
                      value={gstType}
                      onChange={(e) => {
                        setIsDirty(true);
                        setGstType(e.target.value as GSTType);
                      }}
                      className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-slate-900 cursor-pointer"
                    >
                      <option value="Unregistered">Unregistered / Consumer</option>
                      <option value="Registered">Registered Business - Regular</option>
                      <option value="Composition">Composition Scheme</option>
                      <option value="Consumer">Consumer</option>
                    </select>
                  </div>

                  {/* State */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      State & GST Code <span className="text-rose-500">*</span>
                    </label>
                    <select
                      value={stateCode}
                      onChange={(e) => {
                        setIsDirty(true);
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

                  {/* Email */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Email Address</label>
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => {
                        setIsDirty(true);
                        setEmail(e.target.value);
                      }}
                      placeholder="account@party.com"
                      className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg"
                    />
                  </div>

                  {/* Billing Address */}
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Billing Address</label>
                    <textarea
                      rows={2}
                      value={billingAddress}
                      onChange={(e) => {
                        setIsDirty(true);
                        setBillingAddress(e.target.value);
                      }}
                      placeholder="Shop/Office No, Street, Landmark, City, Pincode"
                      className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg"
                    />
                  </div>

                  {/* Shipping Addresses (+ Add New Address) */}
                  <div className="sm:col-span-2 space-y-2 border-t border-slate-200 pt-3">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-semibold text-slate-700">Shipping / Delivery Addresses</label>
                      <button
                        type="button"
                        onClick={() => setShowAddShippingBox(true)}
                        className="text-xs text-rose-600 hover:text-rose-700 font-semibold flex items-center gap-1 cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Add New Address</span>
                      </button>
                    </div>

                    {shippingAddresses.length > 0 ? (
                      <div className="space-y-2">
                        {shippingAddresses.map((addr, idx) => (
                          <div
                            key={idx}
                            className="p-2.5 bg-slate-50 border border-slate-200 rounded-lg flex items-start justify-between gap-3 text-xs"
                          >
                            <span className="text-slate-700 whitespace-pre-line leading-relaxed">{addr}</span>
                            <button
                              type="button"
                              onClick={() => handleRemoveShippingAddress(idx)}
                              className="text-slate-400 hover:text-rose-600 p-1 cursor-pointer shrink-0"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-[11px] text-slate-400 italic">
                        No separate shipping address added. Billing address will be used by default.
                      </p>
                    )}

                    {showAddShippingBox && (
                      <div className="p-3 bg-slate-100 rounded-lg border border-slate-300 space-y-2">
                        <textarea
                          rows={2}
                          value={newShippingAddressInput}
                          onChange={(e) => setNewShippingAddressInput(e.target.value)}
                          placeholder="Warehouse/Branch address, City, Pincode"
                          className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded-md"
                        />
                        <div className="flex justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => setShowAddShippingBox(false)}
                            className="px-2.5 py-1 text-xs text-slate-600 hover:text-slate-800"
                          >
                            Cancel
                          </button>
                          <button
                            type="button"
                            onClick={handleAddShippingAddress}
                            className="px-3 py-1 text-xs font-semibold text-white bg-rose-600 rounded-md shadow-2xs"
                          >
                            Save Address
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* TAB 2: Credit & Balance */}
            {activeTab === 'credit_balance' && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Opening Balance */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Opening Balance (₹)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={openingBalance}
                      onChange={(e) => {
                        setIsDirty(true);
                        setOpeningBalance(e.target.value);
                      }}
                      className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg font-mono"
                    />
                  </div>

                  {/* Balance Type: To Receive vs To Pay */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Balance Type
                    </label>
                    <select
                      value={openingBalanceType}
                      onChange={(e) => {
                        setIsDirty(true);
                        setOpeningBalanceType(e.target.value as 'to_receive' | 'to_pay');
                      }}
                      className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg cursor-pointer"
                    >
                      <option value="to_receive">To Receive (Debit / Receivable)</option>
                      <option value="to_pay">To Pay (Credit / Payable)</option>
                    </select>
                  </div>

                  {/* As of Date */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      As Of Date
                    </label>
                    <input
                      type="date"
                      value={openingBalanceDate}
                      onChange={(e) => {
                        setIsDirty(true);
                        setOpeningBalanceDate(e.target.value);
                      }}
                      className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg font-mono"
                    />
                  </div>

                  {/* Credit Limit */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Credit Limit (₹) (0 for no limit)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={creditLimit}
                      onChange={(e) => {
                        setIsDirty(true);
                        setCreditLimit(e.target.value);
                      }}
                      className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg font-mono"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* TAB 3: Additional Fields */}
            {activeTab === 'additional' && (
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">PAN Number</label>
                  <input
                    type="text"
                    value={panNumber}
                    onChange={(e) => {
                      setIsDirty(true);
                      setPanNumber(e.target.value.toUpperCase());
                    }}
                    maxLength={10}
                    placeholder="ABCDE1234F"
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg uppercase font-mono"
                  />
                  <p className="text-[11px] text-slate-400 mt-1">Auto-extracted from GSTIN characters 3-12</p>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Remarks / Party Notes</label>
                  <textarea
                    rows={3}
                    value={notes}
                    onChange={(e) => {
                      setIsDirty(true);
                      setNotes(e.target.value);
                    }}
                    placeholder="Internal party remarks, preferred courier, credit terms..."
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Footer with Save and Save & New buttons */}
          <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3 shrink-0">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={handleAttemptClose}
                className="px-4 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <div className="hidden sm:flex items-center gap-2 text-[10px] text-slate-400">
                <span>
                  <kbd className="px-1.5 py-0.5 bg-slate-200 text-slate-700 font-mono font-bold rounded">Ctrl</kbd>+<kbd className="px-1.5 py-0.5 bg-slate-200 text-slate-700 font-mono font-bold rounded">Enter</kbd> Save
                </span>
                <span>
                  <kbd className="px-1.5 py-0.5 bg-slate-200 text-slate-700 font-mono font-bold rounded">Esc</kbd> Discard
                </span>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => handleSave(true)}
                disabled={isSaving}
                className="px-4 py-2 text-xs font-semibold text-rose-700 bg-rose-50 border border-rose-200 hover:bg-rose-100 rounded-lg shadow-2xs transition-colors cursor-pointer"
              >
                Save & New
              </button>

              <button
                type="button"
                onClick={() => handleSave(false)}
                disabled={isSaving}
                className="px-5 py-2 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 disabled:opacity-50 rounded-lg shadow-sm transition-colors cursor-pointer flex items-center gap-1.5"
              >
                <span>{isSaving ? 'Saving...' : 'Save Party'}</span>
                <span className="text-[10px] opacity-75 font-mono hidden sm:inline">(Ctrl+↵)</span>
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
    </>
  );
};
