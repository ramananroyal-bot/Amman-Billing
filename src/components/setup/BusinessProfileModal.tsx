import React, { useState } from 'react';
import { X, Building2, Upload, CheckCircle2 } from 'lucide-react';
import { INDIAN_STATES, getStateFromGSTIN, validateGSTIN } from '../../types/indianStates';
import { saveBusinessProfile } from '../../db/indexedDB';
import { BusinessProfile } from '../../types';

interface BusinessProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  profile: BusinessProfile;
  onUpdate: (updated: BusinessProfile) => void;
}

export const BusinessProfileModal: React.FC<BusinessProfileModalProps> = ({
  isOpen,
  onClose,
  profile,
  onUpdate,
}) => {
  const [businessName, setBusinessName] = useState(profile.businessName);
  const [phone, setPhone] = useState(profile.phone);
  const [email, setEmail] = useState(profile.email || '');
  const [gstin, setGstin] = useState(profile.gstin || '');
  const [state, setState] = useState(profile.state || 'Maharashtra');
  const [stateCode, setStateCode] = useState(profile.stateCode || '27');
  const [address, setAddress] = useState(profile.address);
  const [logo, setLogo] = useState(profile.logo || '');

  const [bankName, setBankName] = useState(profile.bankDetails?.bankName || '');
  const [accountNo, setAccountNo] = useState(profile.bankDetails?.accountNo || '');
  const [ifsc, setIfsc] = useState(profile.bankDetails?.ifsc || '');
  const [branch, setBranch] = useState(profile.bankDetails?.branch || '');
  const [upiId, setUpiId] = useState(profile.bankDetails?.upiId || '');

  const [invoicePrefix, setInvoicePrefix] = useState(profile.invoicePrefix || 'INV-');
  const [terms, setTerms] = useState(profile.terms || '');
  const [signatoryText, setSignatoryText] = useState(profile.signatoryText || 'Authorized Signatory');

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSaving, setIsSaving] = useState(false);

  if (!isOpen) return null;

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
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!businessName.trim()) {
      setErrors({ businessName: 'Business name is required' });
      return;
    }
    if (gstin.trim() && !validateGSTIN(gstin.trim())) {
      setErrors({ gstin: 'Invalid GSTIN format' });
      return;
    }

    setIsSaving(true);
    try {
      const updated = await saveBusinessProfile({
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
        terms,
        signatoryText,
        invoicePrefix,
      });

      onUpdate(updated);
      onClose();
    } catch {
      setErrors({ form: 'Failed to update business profile' });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="w-full max-w-2xl bg-white rounded-xl shadow-2xl border border-slate-200 overflow-hidden my-8">
        <div className="flex items-center justify-between px-6 py-4 bg-slate-900 text-white">
          <div className="flex items-center gap-2.5">
            <Building2 className="w-5 h-5 text-rose-500" />
            <h2 className="text-base font-bold">Edit Business Profile</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-white transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSave} className="p-6 space-y-5 max-h-[80vh] overflow-y-auto">
          {errors.form && (
            <div className="p-3 text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded-lg">
              {errors.form}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label className="block text-xs font-semibold text-slate-700 mb-1">Business Name *</label>
              <input
                type="text"
                value={businessName}
                onChange={(e) => setBusinessName(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-300 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-slate-900"
              />
              {errors.businessName && <p className="mt-1 text-xs text-rose-600">{errors.businessName}</p>}
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Phone Number *</label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-300 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-slate-900 font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-300 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-slate-900"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">GSTIN</label>
              <input
                type="text"
                value={gstin}
                onChange={handleGstinChange}
                maxLength={15}
                className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-300 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-slate-900 uppercase font-mono"
              />
              {errors.gstin && <p className="mt-1 text-xs text-rose-600">{errors.gstin}</p>}
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">State</label>
              <select
                value={stateCode}
                onChange={(e) => {
                  const s = INDIAN_STATES.find((st) => st.code === e.target.value);
                  if (s) {
                    setState(s.name);
                    setStateCode(s.code);
                  }
                }}
                className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-300 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-slate-900 cursor-pointer"
              >
                {INDIAN_STATES.map((s) => (
                  <option key={s.code} value={s.code}>
                    {s.code} - {s.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="md:col-span-2">
              <label className="block text-xs font-semibold text-slate-700 mb-1">Address *</label>
              <textarea
                rows={2}
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-300 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-slate-900"
              />
            </div>

            {/* Logo */}
            <div className="md:col-span-2 flex items-center gap-4">
              <div className="w-16 h-16 rounded-lg border border-slate-300 bg-slate-50 flex items-center justify-center overflow-hidden shrink-0">
                {logo ? (
                  <img src={logo} alt="Logo" className="w-full h-full object-contain" />
                ) : (
                  <Upload className="w-5 h-5 text-slate-400" />
                )}
              </div>
              <div>
                <input
                  type="file"
                  id="profile-logo"
                  accept="image/*"
                  onChange={handleLogoUpload}
                  className="hidden"
                />
                <label
                  htmlFor="profile-logo"
                  className="px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 cursor-pointer inline-flex items-center gap-1.5 shadow-2xs"
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
              </div>
            </div>

            {/* Bank details */}
            <div className="md:col-span-2 border-t border-slate-200 pt-3">
              <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-2">
                Bank & UPI Details (For Invoice Printing)
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 bg-slate-50 p-3 rounded-lg border border-slate-200">
                <div>
                  <label className="block text-[11px] text-slate-600 mb-1">Bank Name</label>
                  <input
                    type="text"
                    value={bankName}
                    onChange={(e) => setBankName(e.target.value)}
                    className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded-md"
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-slate-600 mb-1">Account No.</label>
                  <input
                    type="text"
                    value={accountNo}
                    onChange={(e) => setAccountNo(e.target.value)}
                    className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded-md font-mono"
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-slate-600 mb-1">IFSC Code</label>
                  <input
                    type="text"
                    value={ifsc}
                    onChange={(e) => setIfsc(e.target.value.toUpperCase())}
                    className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded-md font-mono uppercase"
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-slate-600 mb-1">UPI ID (e.g. name@okhdfcbank)</label>
                  <input
                    type="text"
                    value={upiId}
                    onChange={(e) => setUpiId(e.target.value)}
                    className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded-md"
                  />
                </div>
              </div>
            </div>

            {/* Invoice defaults */}
            <div className="md:col-span-2 border-t border-slate-200 pt-3">
              <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-2">
                Invoice Terms & Customization
              </h4>
              <div className="space-y-3">
                <div>
                  <label className="block text-[11px] text-slate-600 mb-1">Invoice Prefix</label>
                  <input
                    type="text"
                    value={invoicePrefix}
                    onChange={(e) => setInvoicePrefix(e.target.value)}
                    className="w-48 px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded-md uppercase font-mono"
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-slate-600 mb-1">Terms & Conditions</label>
                  <textarea
                    rows={2}
                    value={terms}
                    onChange={(e) => setTerms(e.target.value)}
                    className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded-md"
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-slate-600 mb-1">Signatory Title</label>
                  <input
                    type="text"
                    value={signatoryText}
                    onChange={(e) => setSignatoryText(e.target.value)}
                    className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded-md"
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="pt-4 border-t border-slate-200 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-slate-600 hover:text-slate-800 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="px-5 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg shadow-2xs transition-colors cursor-pointer"
            >
              {isSaving ? 'Updating...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
