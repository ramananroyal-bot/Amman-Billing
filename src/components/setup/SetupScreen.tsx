import React, { useState } from 'react';
import { Building2, Upload, CheckCircle2, ChevronRight } from 'lucide-react';
import { INDIAN_STATES, getStateFromGSTIN, validateGSTIN } from '../../types/indianStates';
import { saveBusinessProfile } from '../../db/indexedDB';
import { BusinessProfile } from '../../types';

interface SetupScreenProps {
  onComplete: (profile: BusinessProfile) => void;
}

export const SetupScreen: React.FC<SetupScreenProps> = ({ onComplete }) => {
  const [businessName, setBusinessName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [gstin, setGstin] = useState('');
  const [state, setState] = useState('Maharashtra');
  const [stateCode, setStateCode] = useState('27');
  const [address, setAddress] = useState('');
  const [logo, setLogo] = useState('');

  // Bank details
  const [bankName, setBankName] = useState('');
  const [accountNo, setAccountNo] = useState('');
  const [ifsc, setIfsc] = useState('');
  const [branch, setBranch] = useState('');
  const [upiId, setUpiId] = useState('');
  const [showBankAccordion, setShowBankAccordion] = useState(false);

  // Errors
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSaving, setIsSaving] = useState(false);

  // Handle GSTIN change with auto-state detection
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

  // Handle State dropdown change
  const handleStateChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const selectedCode = e.target.value;
    const found = INDIAN_STATES.find((s) => s.code === selectedCode);
    if (found) {
      setState(found.name);
      setStateCode(found.code);
    }
  };

  // Logo file upload handler
  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) {
        setErrors((prev) => ({ ...prev, logo: 'Logo image must be under 2MB' }));
        return;
      }
      const reader = new FileReader();
      reader.onload = (event) => {
        setLogo(event.target?.result as string);
        setErrors((prev) => {
          const next = { ...prev };
          delete next.logo;
          return next;
        });
      };
      reader.readAsDataURL(file);
    }
  };

  const validate = () => {
    const errs: Record<string, string> = {};
    if (!businessName.trim()) {
      errs.businessName = 'Business name is required';
    }
    if (!phone.trim()) {
      errs.phone = 'Phone number is required';
    } else if (!/^[0-9]{10}$/.test(phone.trim().replace(/\D/g, ''))) {
      errs.phone = 'Enter a valid 10-digit phone number';
    }
    if (email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      errs.email = 'Enter a valid email address';
    }
    if (gstin.trim() && !validateGSTIN(gstin.trim())) {
      errs.gstin = 'Invalid GSTIN format (e.g. 27AAAAA0000A1Z5)';
    }
    if (!address.trim()) {
      errs.address = 'Full business address is required for invoices';
    }
    if (!state.trim()) {
      errs.state = 'Please select a state';
    }

    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    setIsSaving(true);
    try {
      const saved = await saveBusinessProfile({
        businessName: businessName.trim(),
        phone: phone.trim(),
        email: email.trim(),
        gstin: gstin.trim().toUpperCase(),
        state,
        stateCode,
        address: address.trim(),
        logo,
        bankDetails: {
          bankName: bankName.trim(),
          accountNo: accountNo.trim(),
          ifsc: ifsc.trim().toUpperCase(),
          branch: branch.trim(),
          upiId: upiId.trim(),
        },
      });

      onComplete(saved);
    } catch (err) {
      setErrors({ form: 'Failed to save business profile. Please try again.' });
      setIsSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4 sm:p-6 lg:p-8">
      <div className="w-full max-w-2xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden">
        {/* Header */}
        <div className="bg-slate-950 px-8 py-6 text-white border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-rose-600 flex items-center justify-center text-white font-bold text-lg shadow-md">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight">Business Setup</h1>
              <p className="text-xs text-slate-400 mt-0.5">
                Configure your business details once. These will appear on all your GST invoices.
              </p>
            </div>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSave} className="p-8 space-y-6">
          {errors.form && (
            <div className="p-3 text-sm text-rose-700 bg-rose-50 border border-rose-200 rounded-lg">
              {errors.form}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Business Name */}
            <div className="md:col-span-2">
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                Business / Firm Name <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                value={businessName}
                onChange={(e) => setBusinessName(e.target.value)}
                placeholder="e.g. Royal Enterprise or Sharma Trading Co."
                className={`w-full px-3.5 py-2.5 text-sm bg-slate-50 border rounded-lg focus:outline-hidden focus:ring-2 focus:ring-slate-900 transition-colors ${
                  errors.businessName ? 'border-rose-400 bg-rose-50/50' : 'border-slate-300'
                }`}
              />
              {errors.businessName && (
                <p className="mt-1 text-xs text-rose-600">{errors.businessName}</p>
              )}
            </div>

            {/* Phone */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                Phone / Mobile <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <span className="absolute left-3.5 top-2.5 text-sm text-slate-400 font-medium">+91</span>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="9876543210"
                  maxLength={10}
                  className={`w-full pl-12 pr-3.5 py-2.5 text-sm bg-slate-50 border rounded-lg focus:outline-hidden focus:ring-2 focus:ring-slate-900 font-mono transition-colors ${
                    errors.phone ? 'border-rose-400 bg-rose-50/50' : 'border-slate-300'
                  }`}
                />
              </div>
              {errors.phone && <p className="mt-1 text-xs text-rose-600">{errors.phone}</p>}
            </div>

            {/* Email */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                Email Address
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="billing@yourfirm.com"
                className={`w-full px-3.5 py-2.5 text-sm bg-slate-50 border rounded-lg focus:outline-hidden focus:ring-2 focus:ring-slate-900 transition-colors ${
                  errors.email ? 'border-rose-400 bg-rose-50/50' : 'border-slate-300'
                }`}
              />
              {errors.email && <p className="mt-1 text-xs text-rose-600">{errors.email}</p>}
            </div>

            {/* GSTIN */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                GSTIN (Optional for Unregistered)
              </label>
              <input
                type="text"
                value={gstin}
                onChange={handleGstinChange}
                placeholder="27AAAAA0000A1Z5"
                maxLength={15}
                className={`w-full px-3.5 py-2.5 text-sm bg-slate-50 border rounded-lg focus:outline-hidden focus:ring-2 focus:ring-slate-900 uppercase font-mono tracking-wider transition-colors ${
                  errors.gstin ? 'border-rose-400 bg-rose-50/50' : 'border-slate-300'
                }`}
              />
              {errors.gstin && <p className="mt-1 text-xs text-rose-600">{errors.gstin}</p>}
            </div>

            {/* State */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                State & GST Code <span className="text-rose-500">*</span>
              </label>
              <select
                value={stateCode}
                onChange={handleStateChange}
                className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-slate-900 transition-colors cursor-pointer"
              >
                {INDIAN_STATES.map((s) => (
                  <option key={s.code} value={s.code}>
                    {s.code} - {s.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Address */}
            <div className="md:col-span-2">
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                Business Address <span className="text-rose-500">*</span>
              </label>
              <textarea
                rows={2}
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="Shop No. 4, Commercial Complex, M.G. Road, Pune - 411001"
                className={`w-full px-3.5 py-2 text-sm bg-slate-50 border rounded-lg focus:outline-hidden focus:ring-2 focus:ring-slate-900 transition-colors ${
                  errors.address ? 'border-rose-400 bg-rose-50/50' : 'border-slate-300'
                }`}
              />
              {errors.address && <p className="mt-1 text-xs text-rose-600">{errors.address}</p>}
            </div>

            {/* Logo Upload */}
            <div className="md:col-span-2">
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                Business Logo (Appears on Invoices)
              </label>
              <div className="flex items-center gap-4">
                <div className="w-20 h-20 rounded-lg border-2 border-dashed border-slate-300 flex items-center justify-center overflow-hidden bg-slate-50">
                  {logo ? (
                    <img src={logo} alt="Logo" className="w-full h-full object-contain" />
                  ) : (
                    <Upload className="w-6 h-6 text-slate-400" />
                  )}
                </div>
                <div>
                  <input
                    type="file"
                    id="logo-upload"
                    accept="image/png, image/jpeg, image/webp"
                    onChange={handleLogoUpload}
                    className="hidden"
                  />
                  <label
                    htmlFor="logo-upload"
                    className="px-3.5 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 cursor-pointer inline-flex items-center gap-1.5 shadow-2xs"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    {logo ? 'Change Logo' : 'Upload Logo'}
                  </label>
                  {logo && (
                    <button
                      type="button"
                      onClick={() => setLogo('')}
                      className="ml-2 text-xs text-rose-600 hover:underline"
                    >
                      Remove
                    </button>
                  )}
                  <p className="text-[11px] text-slate-500 mt-1">PNG, JPG or WEBP under 2MB</p>
                </div>
              </div>
              {errors.logo && <p className="mt-1 text-xs text-rose-600">{errors.logo}</p>}
            </div>
          </div>

          {/* Optional Bank Details Accordion */}
          <div className="border-t border-slate-200 pt-4">
            <button
              type="button"
              onClick={() => setShowBankAccordion(!showBankAccordion)}
              className="flex items-center justify-between w-full text-left text-xs font-semibold text-slate-700 uppercase tracking-wider hover:text-slate-900 cursor-pointer"
            >
              <span>Bank & Payment Details (Optional for UPI QR on Invoices)</span>
              <ChevronRight
                className={`w-4 h-4 text-slate-400 transition-transform ${
                  showBankAccordion ? 'rotate-90' : ''
                }`}
              />
            </button>

            {showBankAccordion && (
              <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-200">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Bank Name</label>
                  <input
                    type="text"
                    value={bankName}
                    onChange={(e) => setBankName(e.target.value)}
                    placeholder="e.g. State Bank of India"
                    className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-slate-900"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Account Number</label>
                  <input
                    type="text"
                    value={accountNo}
                    onChange={(e) => setAccountNo(e.target.value)}
                    placeholder="e.g. 123456789012"
                    className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-slate-900 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">IFSC Code</label>
                  <input
                    type="text"
                    value={ifsc}
                    onChange={(e) => setIfsc(e.target.value.toUpperCase())}
                    placeholder="e.g. SBIN0001234"
                    maxLength={11}
                    className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-slate-900 uppercase font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">UPI ID (for QR Code)</label>
                  <input
                    type="text"
                    value={upiId}
                    onChange={(e) => setUpiId(e.target.value)}
                    placeholder="business@upi or phone@paytm"
                    className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-slate-900"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Submit */}
          <div className="pt-4 border-t border-slate-200 flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-xs text-slate-500">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <span>Offline-first data stored on your device</span>
            </div>
            <button
              type="submit"
              disabled={isSaving}
              className="px-6 py-2.5 text-sm font-semibold text-white bg-rose-600 hover:bg-rose-700 disabled:opacity-50 rounded-lg shadow-sm transition-colors cursor-pointer flex items-center gap-2"
            >
              {isSaving ? 'Saving...' : 'Save & Start Billing'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
