import React, { useState, useEffect, useCallback } from 'react';
import {
  SlidersHorizontal,
  FileText,
  Printer,
  Receipt,
  Users,
  Package,
  MessageSquare,
  CheckCircle2,
  AlertTriangle,
  Building2,
  Palette,
  Hash,
  ShieldCheck,
  QrCode,
  DollarSign,
  Calendar,
  Layers,
  Sparkles,
  Info,
  Check,
  RotateCcw,
  Languages,
  Lock,
  ScanBarcode,
  Moon,
  Scale,
  Wrench,
  Activity,
  Keyboard,
} from 'lucide-react';
import { AppSettings, BusinessProfile, PaymentType } from '../../types';
import { getAppSettings, saveAppSettings, getBusinessProfile, saveBusinessProfile } from '../../db/indexedDB';
import { useToast } from '../common/Toast';
import { formatINR } from '../../utils/formatters';
import { useTranslation, AppLanguage, InvoicePrintLanguage } from '../../i18n/LanguageContext';
import {
  applyDarkModeClass,
  getFirmsList,
  getPasscodeConfig,
  hashPin,
  savePasscodeConfig,
  verifyPasscode,
} from '../../utils/security';

export type SettingsTab =
  | 'general'
  | 'transaction'
  | 'print'
  | 'taxes'
  | 'party_whatsapp'
  | 'item_inventory'
  | 'addons_security';

interface SettingsViewProps {
  businessProfile: BusinessProfile | null;
  onProfileUpdated?: (updated: BusinessProfile) => void;
  onSettingsUpdated?: (updated: AppSettings) => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  businessProfile,
  onProfileUpdated,
  onSettingsUpdated,
}) => {
  const { showToast } = useToast();
  const { setLanguage, setInvoicePrintLanguage } = useTranslation();
  const [activeTab, setActiveTab] = useState<SettingsTab>('general');
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [profile, setProfile] = useState<BusinessProfile | null>(businessProfile);
  const [isSaving, setIsSaving] = useState(false);
  const [lastSavedTime, setLastSavedTime] = useState<string | null>(null);

  // Form states for business prefixes & UPI ID
  const [invoicePrefix, setInvoicePrefix] = useState(businessProfile?.invoicePrefix || 'INV-');
  const [nextInvoiceNo, setNextInvoiceNo] = useState(businessProfile?.nextInvoiceNumber || 1);
  const [purchasePrefix, setPurchasePrefix] = useState(businessProfile?.purchasePrefix || 'BILL-');
  const [nextPurchaseNo, setNextPurchaseNo] = useState(businessProfile?.nextPurchaseNumber || 1);
  const [challanPrefix, setChallanPrefix] = useState(businessProfile?.challanPrefix || 'CH-');
  const [nextChallanNo, setNextChallanNo] = useState(businessProfile?.nextChallanNumber || 1);
  const [estimatePrefix, setEstimatePrefix] = useState(businessProfile?.estimatePrefix || 'EST-');
  const [nextEstimateNo, setNextEstimateNo] = useState(businessProfile?.nextEstimateNumber || 1);
  const [jobWorkOutPrefix, setJobWorkOutPrefix] = useState(businessProfile?.jobWorkOutPrefix || 'JWO-');
  const [nextJobWorkOutNo, setNextJobWorkOutNo] = useState(businessProfile?.nextJobWorkOutNumber || 1);
  const [jobWorkInPrefix, setJobWorkInPrefix] = useState(businessProfile?.jobWorkInPrefix || 'JWI-');
  const [nextJobWorkInNo, setNextJobWorkInNo] = useState(businessProfile?.nextJobWorkInNumber || 1);
  const [upiId, setUpiId] = useState(businessProfile?.bankDetails?.upiId || '');
  const [invoiceTerms, setInvoiceTerms] = useState(businessProfile?.terms || '');
  const [signatoryText, setSignatoryText] = useState(businessProfile?.signatoryText || '');

  // Passcode PIN configuration form state
  const [hasExistingPin, setHasExistingPin] = useState(() => Boolean(getPasscodeConfig().pinHash));
  const [currentPinInput, setCurrentPinInput] = useState('');
  const [newPinInput, setNewPinInput] = useState('');
  const [confirmPinInput, setConfirmPinInput] = useState('');
  const [pinError, setPinError] = useState<string | null>(null);

  // Load settings and profile
  const loadData = useCallback(async () => {
    try {
      const s = await getAppSettings();
      setSettings(s);
      const p = await getBusinessProfile();
      if (p) {
        setProfile(p);
        setInvoicePrefix(p.invoicePrefix || 'INV-');
        setNextInvoiceNo(p.nextInvoiceNumber || 1);
        setPurchasePrefix(p.purchasePrefix || 'BILL-');
        setNextPurchaseNo(p.nextPurchaseNumber || 1);
        setChallanPrefix(p.challanPrefix || 'CH-');
        setNextChallanNo(p.nextChallanNumber || 1);
        setEstimatePrefix(p.estimatePrefix || 'EST-');
        setNextEstimateNo(p.nextEstimateNumber || 1);
        setJobWorkOutPrefix(p.jobWorkOutPrefix || 'JWO-');
        setNextJobWorkOutNo(p.nextJobWorkOutNumber || 1);
        setJobWorkInPrefix(p.jobWorkInPrefix || 'JWI-');
        setNextJobWorkInNo(p.nextJobWorkInNumber || 1);
        setUpiId(p.bankDetails?.upiId || '');
        setInvoiceTerms(p.terms || '');
        setSignatoryText(p.signatoryText || '');
      }
      setHasExistingPin(Boolean(getPasscodeConfig().pinHash));
    } catch (err) {
      console.error('Failed to load settings', err);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Update a single app setting with immediate auto-persist
  const handleUpdateSetting = async <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => {
    if (!settings) return;
    try {
      setIsSaving(true);
      const updated = await saveAppSettings({ [key]: value });
      setSettings(updated);
      if (onSettingsUpdated) onSettingsUpdated(updated);

      if (key === 'language') {
        await setLanguage(value as AppLanguage);
      } else if (key === 'invoicePrintLanguage') {
        await setInvoicePrintLanguage(value as InvoicePrintLanguage);
      } else if (key === 'darkMode') {
        applyDarkModeClass(Boolean(value));
      } else if (key === 'enablePasscodeLock') {
        const currentCfg = getPasscodeConfig();
        savePasscodeConfig({ ...currentCfg, enabled: Boolean(value) });
      } else if (key === 'requirePinForEditDelete') {
        const currentCfg = getPasscodeConfig();
        savePasscodeConfig({ ...currentCfg, requireForEditDelete: Boolean(value) });
      }

      setLastSavedTime(new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
      showToast('Setting updated', 'info');
    } catch (err: any) {
      showToast(err?.message || 'Failed to update setting', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  // Save Prefix & Numbering configuration into Business Profile
  const handleSavePrefixes = async () => {
    if (!profile) return;
    try {
      setIsSaving(true);
      const updated = await saveBusinessProfile({
        invoicePrefix: invoicePrefix.trim().toUpperCase(),
        nextInvoiceNumber: Number(nextInvoiceNo) || 1,
        purchasePrefix: purchasePrefix.trim().toUpperCase(),
        nextPurchaseNumber: Number(nextPurchaseNo) || 1,
        challanPrefix: challanPrefix.trim().toUpperCase(),
        nextChallanNumber: Number(nextChallanNo) || 1,
        estimatePrefix: estimatePrefix.trim().toUpperCase(),
        nextEstimateNumber: Number(nextEstimateNo) || 1,
        jobWorkOutPrefix: jobWorkOutPrefix.trim().toUpperCase(),
        nextJobWorkOutNumber: Number(nextJobWorkOutNo) || 1,
        jobWorkInPrefix: jobWorkInPrefix.trim().toUpperCase(),
        nextJobWorkInNumber: Number(nextJobWorkInNo) || 1,
        terms: invoiceTerms.trim(),
        signatoryText: signatoryText.trim(),
      });
      setProfile(updated);
      if (onProfileUpdated) onProfileUpdated(updated);
      showToast('Invoice prefixes and terms saved', 'success');
      setLastSavedTime(new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
    } catch (err: any) {
      showToast(err?.message || 'Failed to update prefixes', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  // Persist UPI ID directly inside Business Profile bank details
  const handleSaveUpiId = async () => {
    if (!profile) return;
    const trimmed = upiId.trim();
    if (trimmed && !trimmed.includes('@')) {
      showToast('Enter a valid UPI ID (example: myshop@upi or 9876543210@ybl)', 'error');
      return;
    }
    try {
      setIsSaving(true);
      const updated = await saveBusinessProfile({
        bankDetails: {
          bankName: profile.bankDetails?.bankName || '',
          accountNo: profile.bankDetails?.accountNo || '',
          ifsc: profile.bankDetails?.ifsc || '',
          branch: profile.bankDetails?.branch || '',
          upiId: trimmed,
        },
      });
      setProfile(updated);
      if (onProfileUpdated) onProfileUpdated(updated);
      showToast(trimmed ? 'UPI ID saved for invoice QR codes' : 'UPI ID cleared', 'success');
    } catch (err: any) {
      showToast(err?.message || 'Failed to save UPI ID', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  // Save or update security PIN (4-8 digits hashed in localStorage)
  const handleSaveSecurityPin = async (e: React.FormEvent) => {
    e.preventDefault();
    setPinError(null);

    if (hasExistingPin) {
      const ok = await verifyPasscode(currentPinInput);
      if (!ok) {
        setPinError('Current PIN is incorrect.');
        return;
      }
    }

    if (!/^\d{4,8}$/.test(newPinInput)) {
      setPinError('New PIN must be 4 to 8 digits.');
      return;
    }
    if (newPinInput !== confirmPinInput) {
      setPinError('New PIN and confirmation do not match.');
      return;
    }

    const hashed = await hashPin(newPinInput);
    const currentCfg = getPasscodeConfig();
    savePasscodeConfig({
      ...currentCfg,
      pinHash: hashed,
      enabled: Boolean(settings?.enablePasscodeLock ?? true),
      requireForEditDelete: Boolean(settings?.requirePinForEditDelete),
    });

    if (settings && !settings.enablePasscodeLock) {
      await handleUpdateSetting('enablePasscodeLock', true);
    }

    setHasExistingPin(true);
    setCurrentPinInput('');
    setNewPinInput('');
    setConfirmPinInput('');
    showToast('Security PIN saved successfully', 'success');
  };

  const handleRemovePin = async () => {
    if (hasExistingPin) {
      if (!currentPinInput.trim()) {
        setPinError('Enter your current PIN to remove passcode protection.');
        return;
      }
      const ok = await verifyPasscode(currentPinInput);
      if (!ok) {
        setPinError('Current PIN is incorrect.');
        return;
      }
    }
    savePasscodeConfig({ enabled: false, requireForEditDelete: false, pinHash: '' });
    setHasExistingPin(false);
    setCurrentPinInput('');
    setNewPinInput('');
    setConfirmPinInput('');
    setPinError(null);
    if (settings) {
      const updated = await saveAppSettings({ enablePasscodeLock: false, requirePinForEditDelete: false });
      setSettings(updated);
      if (onSettingsUpdated) onSettingsUpdated(updated);
    }
    showToast('Passcode PIN removed', 'info');
  };

  // WhatsApp variable chip inserter
  const handleInsertWhatsAppTag = (tag: string) => {
    if (!settings) return;
    const current = settings.whatsappMessageTemplate || '';
    const updated = current + (current.endsWith(' ') ? '' : ' ') + tag + ' ';
    handleUpdateSetting('whatsappMessageTemplate', updated);
  };

  if (!settings) {
    return (
      <div className="h-full flex items-center justify-center bg-slate-50">
        <div className="w-8 h-8 border-2 border-rose-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const tabs: { id: SettingsTab; label: string; icon: React.ReactNode; desc: string }[] = [
    {
      id: 'general',
      label: 'General & Regional',
      icon: <SlidersHorizontal className="w-4 h-4" />,
      desc: 'Decimals, Currency, Date formats, Warehouses',
    },
    {
      id: 'transaction',
      label: 'Transactions & Prefixes',
      icon: <FileText className="w-4 h-4" />,
      desc: 'Invoice series numbers, Round-off, Stock controls',
    },
    {
      id: 'print',
      label: 'Print & Invoice Themes',
      icon: <Printer className="w-4 h-4" />,
      desc: 'A4 templates, Accent colors, Logo & QR controls',
    },
    {
      id: 'taxes',
      label: 'Taxes & GST',
      icon: <Receipt className="w-4 h-4" />,
      desc: 'Composition scheme, RCM, Rates, E-Way Bill',
    },
    {
      id: 'party_whatsapp',
      label: 'Parties & WhatsApp',
      icon: <MessageSquare className="w-4 h-4" />,
      desc: 'Credit limits, WhatsApp message template',
    },
    {
      id: 'item_inventory',
      label: 'Items & Inventory',
      icon: <Package className="w-4 h-4" />,
      desc: 'Units, Free qty, Batch & Expiry tracking',
    },
    {
      id: 'addons_security',
      label: 'Optional Features & Security',
      icon: <Sparkles className="w-4 h-4" />,
      desc: 'UPI QR, Multi-Firm, PIN, Audit, Barcode, Dark, Job Work',
    },
  ];

  const colorOptions = [
    { name: 'Ruby Rose', value: '#e11d48', bg: 'bg-rose-600' },
    { name: 'Royal Blue', value: '#2563eb', bg: 'bg-blue-600' },
    { name: 'Emerald Green', value: '#059669', bg: 'bg-emerald-600' },
    { name: 'Dark Slate', value: '#0f172a', bg: 'bg-slate-900' },
    { name: 'Purple Violet', value: '#7c3aed', bg: 'bg-violet-600' },
    { name: 'Amber Bronze', value: '#d97706', bg: 'bg-amber-600' },
  ];

  return (
    <div className="h-full flex flex-col bg-slate-50 overflow-hidden font-sans">
      {/* Top Header */}
      <div className="bg-white border-b border-slate-200 px-6 py-4 shrink-0 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-slate-900 text-white flex items-center justify-center shadow-xs">
            <SlidersHorizontal className="w-5 h-5 text-rose-500" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base font-bold text-slate-900">Application Settings</h1>
              <span className="px-2 py-0.5 text-[10px] font-semibold bg-slate-100 text-slate-700 rounded-full font-mono">
                v2.0 Desktop
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Customize billing numbering, invoice printing layouts, tax behaviors, and party communication
            </p>
          </div>
        </div>

        {/* Live Auto-save indicator */}
        <div className="flex items-center gap-3 text-xs">
          {lastSavedTime && (
            <span className="text-[11px] text-slate-400 font-mono flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
              <span>Saved at {lastSavedTime}</span>
            </span>
          )}
        </div>
      </div>

      {/* Main Settings Layout (Sidebar Tabs + Content Viewport) */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Settings Sidebar */}
        <div className="w-64 bg-white border-r border-slate-200 p-3 space-y-1 shrink-0 overflow-y-auto">
          {tabs.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`w-full text-left p-3 rounded-xl transition-all cursor-pointer flex items-start gap-3 ${
                  isActive
                    ? 'bg-rose-50 text-rose-900 border border-rose-200/80 shadow-2xs'
                    : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900 border border-transparent'
                }`}
              >
                <div
                  className={`mt-0.5 shrink-0 ${
                    isActive ? 'text-rose-600' : 'text-slate-400'
                  }`}
                >
                  {tab.icon}
                </div>
                <div className="min-w-0 flex-1">
                  <div className={`text-xs font-bold leading-tight ${isActive ? 'text-rose-950' : 'text-slate-900'}`}>
                    {tab.label}
                  </div>
                  <div className="text-[11px] text-slate-400 truncate mt-0.5">{tab.desc}</div>
                </div>
              </button>
            );
          })}
        </div>

        {/* Right Settings Content */}
        <div className="flex-1 overflow-y-auto p-6">
          <div className="max-w-4xl mx-auto space-y-6">
            {/* ========================================================================= */}
            {/* TAB 1: GENERAL & REGIONAL */}
            {/* ========================================================================= */}
            {activeTab === 'general' && (
              <div className="space-y-5">
                {/* Language Switch & Invoice Heading Language */}
                <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-2xs space-y-4">
                  <h3 className="text-sm font-bold text-slate-900 pb-3 border-b border-slate-100 flex items-center gap-2">
                    <Languages className="w-4 h-4 text-rose-600" />
                    <span>Application Language &amp; Invoice Print Language</span>
                  </h3>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* App UI Language */}
                    <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 flex flex-col justify-between">
                      <div>
                        <h4 className="text-xs font-bold text-slate-900">Display Language / மொழி</h4>
                        <p className="text-[11px] text-slate-500 mt-0.5">
                          Switch menus, buttons, and labels between English and Tamil (தமிழ்).
                        </p>
                      </div>
                      <select
                        value={settings.language || 'en'}
                        onChange={(e) => handleUpdateSetting('language', e.target.value as 'en' | 'ta')}
                        className="mt-3 px-3 py-1.5 text-xs font-semibold bg-white border border-slate-300 rounded-lg text-slate-800 cursor-pointer focus:outline-hidden focus:ring-1 focus:ring-slate-900"
                      >
                        <option value="en">English (Standard)</option>
                        <option value="ta">தமிழ் (Tamil)</option>
                      </select>
                    </div>

                    {/* Invoice Print Language */}
                    <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 flex flex-col justify-between">
                      <div>
                        <h4 className="text-xs font-bold text-slate-900">Invoice / PDF Print Headings</h4>
                        <p className="text-[11px] text-slate-500 mt-0.5">
                          Print invoices with English, Tamil, or Bilingual headings. Tamil item names always print cleanly.
                        </p>
                      </div>
                      <select
                        value={settings.invoicePrintLanguage || 'en'}
                        onChange={(e) =>
                          handleUpdateSetting('invoicePrintLanguage', e.target.value as 'en' | 'ta' | 'bilingual')
                        }
                        className="mt-3 px-3 py-1.5 text-xs font-semibold bg-white border border-slate-300 rounded-lg text-slate-800 cursor-pointer focus:outline-hidden focus:ring-1 focus:ring-slate-900"
                      >
                        <option value="en">English Only</option>
                        <option value="ta">Tamil Only (தமிழ்)</option>
                        <option value="bilingual">Bilingual (English / தமிழ்)</option>
                      </select>
                    </div>
                  </div>
                </div>

                <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-2xs space-y-4">
                  <h3 className="text-sm font-bold text-slate-900 pb-3 border-b border-slate-100 flex items-center gap-2">
                    <DollarSign className="w-4 h-4 text-rose-600" />
                    <span>Currency & Decimal Precision</span>
                  </h3>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* Decimal Places */}
                    <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 flex flex-col justify-between">
                      <div>
                        <h4 className="text-xs font-bold text-slate-900">Decimal Places for Amounts</h4>
                        <p className="text-[11px] text-slate-500 mt-0.5">
                          Controls whether paise or exact rounded amounts are stored and displayed.
                        </p>
                      </div>
                      <select
                        value={settings.decimalPlaces}
                        onChange={(e) => handleUpdateSetting('decimalPlaces', Number(e.target.value))}
                        className="mt-3 px-3 py-1.5 text-xs font-semibold bg-white border border-slate-300 rounded-lg text-slate-800 cursor-pointer focus:outline-hidden focus:ring-1 focus:ring-slate-900"
                      >
                        <option value={2}>2 Decimals (Standard: ₹ 1,250.50)</option>
                        <option value={0}>0 Decimals (Whole: ₹ 1,251)</option>
                      </select>
                    </div>

                    {/* Currency Symbol */}
                    <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 flex flex-col justify-between">
                      <div>
                        <h4 className="text-xs font-bold text-slate-900">Currency Symbol</h4>
                        <p className="text-[11px] text-slate-500 mt-0.5">
                          Currency prefix applied across receipts, invoices, and reports.
                        </p>
                      </div>
                      <select
                        value={settings.currencySymbol || '₹'}
                        onChange={(e) => handleUpdateSetting('currencySymbol', e.target.value)}
                        className="mt-3 px-3 py-1.5 text-xs font-semibold bg-white border border-slate-300 rounded-lg text-slate-800 cursor-pointer focus:outline-hidden focus:ring-1 focus:ring-slate-900"
                      >
                        <option value="₹">₹ - Indian Rupee (INR)</option>
                        <option value="$">$ - US Dollar (USD)</option>
                        <option value="€">€ - Euro (EUR)</option>
                        <option value="£">£ - British Pound (GBP)</option>
                        <option value="AED">AED - UAE Dirham</option>
                      </select>
                    </div>
                  </div>

                  {/* Date Format & Financial Year */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                    {/* Date Format */}
                    <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 flex flex-col justify-between">
                      <div>
                        <h4 className="text-xs font-bold text-slate-900">Date Display Format</h4>
                        <p className="text-[11px] text-slate-500 mt-0.5">
                          Universal date presentation in tables, PDFs, and invoices.
                        </p>
                      </div>
                      <select
                        value={settings.dateFormat || 'DD/MM/YYYY'}
                        onChange={(e) => handleUpdateSetting('dateFormat', e.target.value as any)}
                        className="mt-3 px-3 py-1.5 text-xs font-semibold bg-white border border-slate-300 rounded-lg text-slate-800 cursor-pointer font-mono"
                      >
                        <option value="DD/MM/YYYY">DD/MM/YYYY (e.g. 06/11/2026)</option>
                        <option value="YYYY-MM-DD">YYYY-MM-DD (e.g. 2026-11-06)</option>
                        <option value="MM/DD/YYYY">MM/DD/YYYY (e.g. 11/06/2026)</option>
                      </select>
                    </div>

                    {/* Financial Year Start */}
                    <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 flex flex-col justify-between">
                      <div>
                        <h4 className="text-xs font-bold text-slate-900">Fiscal Year Cycle</h4>
                        <p className="text-[11px] text-slate-500 mt-0.5">
                          Determines &ldquo;This FY&rdquo; date period range across all GST registers.
                        </p>
                      </div>
                      <select
                        value={settings.fiscalYearStart || 'april'}
                        onChange={(e) => handleUpdateSetting('fiscalYearStart', e.target.value as any)}
                        className="mt-3 px-3 py-1.5 text-xs font-semibold bg-white border border-slate-300 rounded-lg text-slate-800 cursor-pointer"
                      >
                        <option value="april">April 1 – March 31 (Indian Financial Year)</option>
                        <option value="january">January 1 – December 31 (Calendar Year)</option>
                      </select>
                    </div>
                  </div>
                </div>

                {/* Godowns & Backup Prompt */}
                <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-2xs space-y-4">
                  <h3 className="text-sm font-bold text-slate-900 pb-3 border-b border-slate-100 flex items-center gap-2">
                    <Layers className="w-4 h-4 text-indigo-600" />
                    <span>Warehouse & Application Preferences</span>
                  </h3>

                  <div className="space-y-3">
                    <div className="flex items-center justify-between p-3.5 bg-slate-50 rounded-xl border border-slate-200">
                      <div>
                        <h4 className="text-xs font-bold text-slate-900">Enable Multiple Godowns / Warehouses</h4>
                        <p className="text-[11px] text-slate-500 mt-0.5">
                          Show godown selector on Sale Invoices and Delivery Challans.
                        </p>
                      </div>
                      <input
                        type="checkbox"
                        checked={settings.enableGodowns}
                        onChange={(e) => handleUpdateSetting('enableGodowns', e.target.checked)}
                        className="w-4 h-4 rounded text-rose-600 focus:ring-rose-500 cursor-pointer"
                      />
                    </div>

                    <div className="flex items-center justify-between p-3.5 bg-slate-50 rounded-xl border border-slate-200">
                      <div>
                        <h4 className="text-xs font-bold text-slate-900">Auto-Backup Prompt on Application Exit</h4>
                        <p className="text-[11px] text-slate-500 mt-0.5">
                          Remind to download a .json backup file when closing the application.
                        </p>
                      </div>
                      <input
                        type="checkbox"
                        checked={settings.autoBackupPrompt}
                        onChange={(e) => handleUpdateSetting('autoBackupPrompt', e.target.checked)}
                        className="w-4 h-4 rounded text-rose-600 focus:ring-rose-500 cursor-pointer"
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ========================================================================= */}
            {/* TAB 2: TRANSACTIONS & PREFIXES */}
            {/* ========================================================================= */}
            {activeTab === 'transaction' && (
              <div className="space-y-5">
                {/* Prefix & Sequential Numbering Card */}
                <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-2xs space-y-4">
                  <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                    <div>
                      <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                        <Hash className="w-4 h-4 text-rose-600" />
                        <span>Document Numbering & Custom Prefixes</span>
                      </h3>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Customize prefixes and next sequence numbers for your business invoices
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={handleSavePrefixes}
                      disabled={isSaving}
                      className="px-3.5 py-1.5 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 rounded-lg shadow-2xs transition-colors cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
                    >
                      <Check className="w-3.5 h-3.5" />
                      <span>Save Numbering</span>
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    {/* 1. Sale Invoice */}
                    <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                      <div className="flex items-center justify-between">
                        <h4 className="text-xs font-bold text-slate-900">Sale Invoices</h4>
                        <span className="text-[10px] font-mono text-rose-600 font-semibold">
                          Sample: {invoicePrefix}
                          {nextInvoiceNo}
                        </span>
                      </div>
                      <div>
                        <label className="text-[11px] text-slate-500 block mb-1">Prefix</label>
                        <input
                          type="text"
                          value={invoicePrefix}
                          onChange={(e) => setInvoicePrefix(e.target.value)}
                          placeholder="INV-"
                          className="w-full px-2.5 py-1.5 text-xs font-mono font-bold bg-white border border-slate-300 rounded-lg"
                        />
                      </div>
                      <div>
                        <label className="text-[11px] text-slate-500 block mb-1">Next Number</label>
                        <input
                          type="number"
                          min="1"
                          value={nextInvoiceNo}
                          onChange={(e) => setNextInvoiceNo(Number(e.target.value))}
                          className="w-full px-2.5 py-1.5 text-xs font-mono bg-white border border-slate-300 rounded-lg"
                        />
                      </div>
                    </div>

                    {/* 2. Purchase Bill */}
                    <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                      <div className="flex items-center justify-between">
                        <h4 className="text-xs font-bold text-slate-900">Purchase Bills</h4>
                        <span className="text-[10px] font-mono text-blue-600 font-semibold">
                          Sample: {purchasePrefix}
                          {nextPurchaseNo}
                        </span>
                      </div>
                      <div>
                        <label className="text-[11px] text-slate-500 block mb-1">Prefix</label>
                        <input
                          type="text"
                          value={purchasePrefix}
                          onChange={(e) => setPurchasePrefix(e.target.value)}
                          placeholder="BILL-"
                          className="w-full px-2.5 py-1.5 text-xs font-mono font-bold bg-white border border-slate-300 rounded-lg"
                        />
                      </div>
                      <div>
                        <label className="text-[11px] text-slate-500 block mb-1">Next Number</label>
                        <input
                          type="number"
                          min="1"
                          value={nextPurchaseNo}
                          onChange={(e) => setNextPurchaseNo(Number(e.target.value))}
                          className="w-full px-2.5 py-1.5 text-xs font-mono bg-white border border-slate-300 rounded-lg"
                        />
                      </div>
                    </div>

                    {/* 3. Delivery Challan */}
                    <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                      <div className="flex items-center justify-between">
                        <h4 className="text-xs font-bold text-slate-900">Delivery Challans</h4>
                        <span className="text-[10px] font-mono text-emerald-600 font-semibold">
                          Sample: {challanPrefix}
                          {nextChallanNo}
                        </span>
                      </div>
                      <div>
                        <label className="text-[11px] text-slate-500 block mb-1">Prefix</label>
                        <input
                          type="text"
                          value={challanPrefix}
                          onChange={(e) => setChallanPrefix(e.target.value)}
                          placeholder="CH-"
                          className="w-full px-2.5 py-1.5 text-xs font-mono font-bold bg-white border border-slate-300 rounded-lg"
                        />
                      </div>
                      <div>
                        <label className="text-[11px] text-slate-500 block mb-1">Next Number</label>
                        <input
                          type="number"
                          min="1"
                          value={nextChallanNo}
                          onChange={(e) => setNextChallanNo(Number(e.target.value))}
                          className="w-full px-2.5 py-1.5 text-xs font-mono bg-white border border-slate-300 rounded-lg"
                        />
                      </div>
                    </div>

                    {/* 4. Estimate / Quotation */}
                    <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                      <div className="flex items-center justify-between">
                        <h4 className="text-xs font-bold text-slate-900">Estimates / Quotes</h4>
                        <span className="text-[10px] font-mono text-amber-600 font-semibold">
                          Sample: {estimatePrefix}
                          {nextEstimateNo}
                        </span>
                      </div>
                      <div>
                        <label className="text-[11px] text-slate-500 block mb-1">Prefix</label>
                        <input
                          type="text"
                          value={estimatePrefix}
                          onChange={(e) => setEstimatePrefix(e.target.value)}
                          placeholder="EST-"
                          className="w-full px-2.5 py-1.5 text-xs font-mono font-bold bg-white border border-slate-300 rounded-lg"
                        />
                      </div>
                      <div>
                        <label className="text-[11px] text-slate-500 block mb-1">Next Number</label>
                        <input
                          type="number"
                          min="1"
                          value={nextEstimateNo}
                          onChange={(e) => setNextEstimateNo(Number(e.target.value))}
                          className="w-full px-2.5 py-1.5 text-xs font-mono bg-white border border-slate-300 rounded-lg"
                        />
                      </div>
                    </div>

                    {/* 5. Job Work Out */}
                    <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                      <div className="flex items-center justify-between">
                        <h4 className="text-xs font-bold text-slate-900">Job Work Out</h4>
                        <span className="text-[10px] font-mono text-indigo-600 font-semibold">
                          Sample: {jobWorkOutPrefix}
                          {nextJobWorkOutNo}
                        </span>
                      </div>
                      <div>
                        <label className="text-[11px] text-slate-500 block mb-1">Prefix</label>
                        <input
                          type="text"
                          value={jobWorkOutPrefix}
                          onChange={(e) => setJobWorkOutPrefix(e.target.value)}
                          placeholder="JWO-"
                          className="w-full px-2.5 py-1.5 text-xs font-mono font-bold bg-white border border-slate-300 rounded-lg"
                        />
                      </div>
                      <div>
                        <label className="text-[11px] text-slate-500 block mb-1">Next Number</label>
                        <input
                          type="number"
                          min="1"
                          value={nextJobWorkOutNo}
                          onChange={(e) => setNextJobWorkOutNo(Number(e.target.value))}
                          className="w-full px-2.5 py-1.5 text-xs font-mono bg-white border border-slate-300 rounded-lg"
                        />
                      </div>
                    </div>

                    {/* 6. Job Work In */}
                    <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                      <div className="flex items-center justify-between">
                        <h4 className="text-xs font-bold text-slate-900">Job Work In</h4>
                        <span className="text-[10px] font-mono text-teal-600 font-semibold">
                          Sample: {jobWorkInPrefix}
                          {nextJobWorkInNo}
                        </span>
                      </div>
                      <div>
                        <label className="text-[11px] text-slate-500 block mb-1">Prefix</label>
                        <input
                          type="text"
                          value={jobWorkInPrefix}
                          onChange={(e) => setJobWorkInPrefix(e.target.value)}
                          placeholder="JWI-"
                          className="w-full px-2.5 py-1.5 text-xs font-mono font-bold bg-white border border-slate-300 rounded-lg"
                        />
                      </div>
                      <div>
                        <label className="text-[11px] text-slate-500 block mb-1">Next Number</label>
                        <input
                          type="number"
                          min="1"
                          value={nextJobWorkInNo}
                          onChange={(e) => setNextJobWorkInNo(Number(e.target.value))}
                          className="w-full px-2.5 py-1.5 text-xs font-mono bg-white border border-slate-300 rounded-lg"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Calculation Controls & Negative Stock */}
                <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-2xs space-y-4">
                  <h3 className="text-sm font-bold text-slate-900 pb-3 border-b border-slate-100 flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-emerald-600" />
                    <span>Calculation & Inventory Controls</span>
                  </h3>

                  <div className="space-y-3">
                    {/* Auto Round Off */}
                    <div className="flex items-center justify-between p-3.5 bg-slate-50 rounded-xl border border-slate-200">
                      <div>
                        <h4 className="text-xs font-bold text-slate-900">Automatic Round-Off to Nearest Rupee</h4>
                        <p className="text-[11px] text-slate-500 mt-0.5">
                          Calculates an exact round-off amount on invoice totals (e.g. ₹ 1,420.40 → ₹ 1,420.00).
                        </p>
                      </div>
                      <input
                        type="checkbox"
                        checked={settings.autoRoundOff}
                        onChange={(e) => handleUpdateSetting('autoRoundOff', e.target.checked)}
                        className="w-4 h-4 rounded text-rose-600 focus:ring-rose-500 cursor-pointer"
                      />
                    </div>

                    {/* Block on Negative Stock */}
                    <div className="flex items-center justify-between p-3.5 bg-slate-50 rounded-xl border border-slate-200">
                      <div>
                        <h4 className="text-xs font-bold text-slate-900">Block Sale on Negative Stock</h4>
                        <p className="text-[11px] text-slate-500 mt-0.5">
                          Disallow saving sale invoices when selected item inventory is insufficient.
                        </p>
                      </div>
                      <input
                        type="checkbox"
                        checked={settings.blockNegativeStock}
                        onChange={(e) => handleUpdateSetting('blockNegativeStock', e.target.checked)}
                        className="w-4 h-4 rounded text-rose-600 focus:ring-rose-500 cursor-pointer"
                      />
                    </div>

                    {/* Default Payment Mode */}
                    <div className="flex items-center justify-between p-3.5 bg-slate-50 rounded-xl border border-slate-200">
                      <div>
                        <h4 className="text-xs font-bold text-slate-900">Default Transaction Payment Mode</h4>
                        <p className="text-[11px] text-slate-500 mt-0.5">
                          Pre-selected payment mode when opening the Add Sale or Add Purchase modal.
                        </p>
                      </div>
                      <select
                        value={settings.defaultPaymentMode || 'cash'}
                        onChange={(e) => handleUpdateSetting('defaultPaymentMode', e.target.value as PaymentType)}
                        className="px-3 py-1.5 text-xs font-semibold bg-white border border-slate-300 rounded-lg text-slate-800 cursor-pointer"
                      >
                        <option value="cash">Cash</option>
                        <option value="upi">UPI / QR</option>
                        <option value="bank_transfer">Bank Transfer / NEFT</option>
                        <option value="credit">Credit (Unpaid)</option>
                        <option value="cheque">Cheque</option>
                      </select>
                    </div>
                  </div>
                </div>

                {/* Terms and Signatory Text */}
                <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-2xs space-y-4">
                  <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                    <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                      <FileText className="w-4 h-4 text-slate-700" />
                      <span>Default Invoice Terms & Conditions</span>
                    </h3>
                    <button
                      type="button"
                      onClick={handleSavePrefixes}
                      disabled={isSaving}
                      className="px-3 py-1 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer"
                    >
                      Update Terms
                    </button>
                  </div>

                  <div className="space-y-3">
                    <div>
                      <label className="text-xs font-semibold text-slate-700 block mb-1">
                        Terms & Conditions (Printed at the bottom of tax invoices)
                      </label>
                      <textarea
                        rows={3}
                        value={invoiceTerms}
                        onChange={(e) => setInvoiceTerms(e.target.value)}
                        placeholder="1. Goods once sold will not be taken back.&#10;2. Interest @ 18% p.a. will be charged if payment is delayed."
                        className="w-full p-2.5 text-xs bg-slate-50 border border-slate-300 rounded-lg font-sans"
                      />
                    </div>

                    <div>
                      <label className="text-xs font-semibold text-slate-700 block mb-1">
                        Authorized Signatory Label
                      </label>
                      <input
                        type="text"
                        value={signatoryText}
                        onChange={(e) => setSignatoryText(e.target.value)}
                        placeholder="Authorized Signatory / For Business"
                        className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg"
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ========================================================================= */}
            {/* TAB 3: PRINT & INVOICE THEMES */}
            {/* ========================================================================= */}
            {activeTab === 'print' && (
              <div className="space-y-5">
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                  {/* Left Column: Theme Controls */}
                  <div className="lg:col-span-7 space-y-5">
                    <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-2xs space-y-4">
                      <h3 className="text-sm font-bold text-slate-900 pb-3 border-b border-slate-100 flex items-center gap-2">
                        <Palette className="w-4 h-4 text-rose-600" />
                        <span>Invoice Template & Styling</span>
                      </h3>

                      {/* Theme Card Selector */}
                      <div className="space-y-2">
                        <label className="text-xs font-bold text-slate-800 block">Print Template Layout</label>
                        <div className="grid grid-cols-3 gap-3">
                          {[
                            {
                              id: 'classic',
                              title: 'Classic GST',
                              desc: 'Standard government compliant grid',
                            },
                            {
                              id: 'modern',
                              title: 'Modern Clean',
                              desc: 'Sleek banner with bold accents',
                            },
                            {
                              id: 'simple',
                              title: 'Simple Compact',
                              desc: 'Minimalist high-density format',
                            },
                          ].map((t) => (
                            <button
                              key={t.id}
                              type="button"
                              onClick={() => handleUpdateSetting('printTheme', t.id as any)}
                              className={`p-3 rounded-xl border text-left cursor-pointer transition-all ${
                                settings.printTheme === t.id
                                  ? 'border-rose-600 bg-rose-50/60 ring-1 ring-rose-600'
                                  : 'border-slate-200 bg-white hover:bg-slate-50'
                              }`}
                            >
                              <div className="text-xs font-bold text-slate-900">{t.title}</div>
                              <div className="text-[10px] text-slate-500 mt-0.5 leading-tight">{t.desc}</div>
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Color Accent Picker */}
                      <div className="space-y-2 pt-2">
                        <label className="text-xs font-bold text-slate-800 block">Brand Accent Color</label>
                        <div className="flex flex-wrap items-center gap-3">
                          {colorOptions.map((c) => (
                            <button
                              key={c.value}
                              type="button"
                              onClick={() => handleUpdateSetting('invoiceColor', c.value)}
                              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-medium cursor-pointer transition-all ${
                                (settings.invoiceColor || '#e11d48') === c.value
                                  ? 'border-slate-900 bg-slate-900 text-white shadow-2xs'
                                  : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100'
                              }`}
                            >
                              <span className={`w-3 h-3 rounded-full ${c.bg} shrink-0`} />
                              <span>{c.name}</span>
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Default Copies */}
                      <div className="pt-2">
                        <label className="text-xs font-bold text-slate-800 block">Default Print Copies</label>
                        <select
                          value={settings.printCopies}
                          onChange={(e) => handleUpdateSetting('printCopies', Number(e.target.value))}
                          className="mt-1 px-3 py-1.5 text-xs font-semibold bg-slate-50 border border-slate-300 rounded-lg text-slate-800 cursor-pointer"
                        >
                          <option value={1}>1 Copy (Original for Recipient)</option>
                          <option value={2}>2 Copies (Original + Duplicate for Transporter)</option>
                          <option value={3}>3 Copies (Original + Duplicate + Triplicate for Supplier)</option>
                        </select>
                      </div>
                    </div>

                    {/* Section Visibility Toggles */}
                    <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-2xs space-y-3">
                      <h3 className="text-sm font-bold text-slate-900 pb-2 border-b border-slate-100">
                        Invoice Section Visibility
                      </h3>

                      {[
                        { key: 'printShowLogo', label: 'Company Logo in Header', desc: 'Display uploaded business logo' },
                        {
                          key: 'printShowBankDetails',
                          label: 'Bank Account & IFSC',
                          desc: 'Print company bank details in payment section',
                        },
                        {
                          key: 'printShowUPIQR',
                          label: 'UPI Dynamic QR Code',
                          desc: 'Display UPI QR for instant phone scanning & payment',
                        },
                        {
                          key: 'printShowTerms',
                          label: 'Terms & Conditions',
                          desc: 'Print business sales agreement notes',
                        },
                        {
                          key: 'printShowSignatory',
                          label: 'Authorized Signatory Line',
                          desc: 'Signature line and authorization notice',
                        },
                      ].map((item) => (
                        <div
                          key={item.key}
                          className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-200"
                        >
                          <div>
                            <div className="text-xs font-bold text-slate-900">{item.label}</div>
                            <div className="text-[11px] text-slate-500 mt-0.5">{item.desc}</div>
                          </div>
                          <input
                            type="checkbox"
                            checked={Boolean((settings as any)[item.key])}
                            onChange={(e) => handleUpdateSetting(item.key as any, e.target.checked)}
                            className="w-4 h-4 rounded text-rose-600 focus:ring-rose-500 cursor-pointer"
                          />
                        </div>
                      ))}

                      {/* UPI ID / VPA Configuration */}
                      <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="text-xs font-bold text-slate-900">Merchant UPI ID (VPA) for Dynamic QR</div>
                            <div className="text-[11px] text-slate-500">
                              Generates an offline scannable QR on invoices pre-filled with the exact invoice total.
                            </div>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <input
                            type="text"
                            value={upiId}
                            onChange={(e) => setUpiId(e.target.value)}
                            placeholder="e.g. mybusiness@okicici or 9876543210@ybl"
                            className="flex-1 px-3 py-1.5 text-xs bg-white border border-slate-300 rounded-lg font-mono"
                          />
                          <button
                            type="button"
                            onClick={handleSaveUpiId}
                            disabled={isSaving}
                            className="px-3 py-1.5 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 rounded-lg cursor-pointer disabled:opacity-50"
                          >
                            Save UPI
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Right Column: Live A4 Invoice Interactive Preview */}
                  <div className="lg:col-span-5">
                    <div className="sticky top-6 bg-white rounded-xl border border-slate-200 p-4 shadow-sm space-y-3">
                      <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                        <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                          <Printer className="w-3.5 h-3.5 text-rose-600" />
                          <span>Live Invoice Preview</span>
                        </span>
                        <span className="text-[10px] text-slate-400 font-mono">A4 Format</span>
                      </div>

                      {/* Mini Invoice Preview Mockup */}
                      <div
                        className="bg-white border rounded-lg p-3.5 shadow-2xs text-[10px] space-y-2 font-sans"
                        style={{ borderColor: settings.invoiceColor || '#e11d48' }}
                      >
                        {/* Header Banner */}
                        <div
                          className="p-2.5 rounded text-white flex items-center justify-between"
                          style={{ backgroundColor: settings.invoiceColor || '#e11d48' }}
                        >
                          <div>
                            <div className="font-bold text-xs uppercase tracking-wide">
                              {profile?.businessName || 'Business Firm Name'}
                            </div>
                            <div className="text-[9px] opacity-90">GSTIN: {profile?.gstin || '27AADCB2230M1Z2'}</div>
                          </div>
                          <div className="text-right">
                            <div className="font-bold uppercase text-[9px]">TAX INVOICE</div>
                            <div className="font-mono text-[9px] opacity-90">INV-1024</div>
                          </div>
                        </div>

                        {/* Customer Info */}
                        <div className="p-2 bg-slate-50 rounded border border-slate-100 flex justify-between">
                          <div>
                            <div className="font-bold text-slate-800">Billed To: Royal Enterprises</div>
                            <div className="text-slate-500 text-[9px]">State: Maharashtra (27)</div>
                          </div>
                          <div className="text-right text-slate-500 text-[9px]">
                            <div>Date: 06/11/2026</div>
                            <div>Place: Intra-state</div>
                          </div>
                        </div>

                        {/* Table mock */}
                        <table className="w-full text-left text-[9px] border-collapse">
                          <thead>
                            <tr className="border-b border-slate-200 font-bold text-slate-600">
                              <th className="py-1">Item</th>
                              <th className="py-1 text-center">Qty</th>
                              <th className="py-1 text-right">Rate</th>
                              <th className="py-1 text-right">Tax</th>
                              <th className="py-1 text-right">Total</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 text-slate-700">
                            <tr>
                              <td className="py-1 font-medium">Cotton Shirts Premium</td>
                              <td className="py-1 text-center font-mono">10 Pcs</td>
                              <td className="py-1 text-right font-mono">₹ 450.00</td>
                              <td className="py-1 text-right font-mono">₹ 225.00</td>
                              <td className="py-1 text-right font-mono font-bold">₹ 4,725.00</td>
                            </tr>
                          </tbody>
                        </table>

                        {/* Summary */}
                        <div className="pt-1.5 border-t border-slate-200 flex justify-between text-[9px]">
                          <div className="space-y-0.5">
                            {settings.printShowUPIQR && (
                              <div className="flex items-center gap-1 text-[8px] text-emerald-700 font-semibold">
                                <QrCode className="w-2.5 h-2.5" />
                                <span>Scan & Pay Enabled</span>
                              </div>
                            )}
                            {settings.printShowBankDetails && (
                              <div className="text-[8px] text-slate-500">
                                Bank: HDFC Bank | A/c: 50100234123
                              </div>
                            )}
                          </div>
                          <div className="text-right">
                            <div className="text-slate-500">Tax Total: ₹ 225.00</div>
                            <div
                              className="font-bold text-xs font-mono"
                              style={{ color: settings.invoiceColor || '#e11d48' }}
                            >
                              Grand Total: ₹ 4,725.00
                            </div>
                          </div>
                        </div>

                        {settings.printShowTerms && (
                          <div className="p-1.5 bg-slate-50 rounded text-[8px] text-slate-500 border border-slate-100">
                            Terms: Goods once sold will not be returned.
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ========================================================================= */}
            {/* TAB 4: TAXES & GST */}
            {/* ========================================================================= */}
            {activeTab === 'taxes' && (
              <div className="space-y-5">
                <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-2xs space-y-4">
                  <h3 className="text-sm font-bold text-slate-900 pb-3 border-b border-slate-100 flex items-center gap-2">
                    <Receipt className="w-4 h-4 text-emerald-600" />
                    <span>GST Rates & Taxation Mode</span>
                  </h3>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* Default GST Rate */}
                    <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 flex flex-col justify-between">
                      <div>
                        <h4 className="text-xs font-bold text-slate-900">Default GST Rate for New Items</h4>
                        <p className="text-[11px] text-slate-500 mt-0.5">
                          Pre-selected tax percentage when creating new products or services.
                        </p>
                      </div>
                      <select
                        value={settings.defaultTaxRate || 18}
                        onChange={(e) => handleUpdateSetting('defaultTaxRate', Number(e.target.value))}
                        className="mt-3 px-3 py-1.5 text-xs font-semibold bg-white border border-slate-300 rounded-lg text-slate-800 cursor-pointer font-mono"
                      >
                        <option value={0}>0% (Exempt)</option>
                        <option value={5}>5% GST (Essentials & Apparel)</option>
                        <option value={12}>12% GST (Processed goods)</option>
                        <option value={18}>18% GST (Standard Rate)</option>
                        <option value={28}>28% GST (Luxury items)</option>
                      </select>
                    </div>

                    {/* E-Way Bill Threshold */}
                    <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 flex flex-col justify-between">
                      <div>
                        <h4 className="text-xs font-bold text-slate-900">E-Way Bill Generation Threshold</h4>
                        <p className="text-[11px] text-slate-500 mt-0.5">
                          Mandatory invoice value threshold under Indian GST rules (Standard ₹ 50,000).
                        </p>
                      </div>
                      <input
                        type="number"
                        value={settings.eWayBillThreshold || 50000}
                        onChange={(e) => handleUpdateSetting('eWayBillThreshold', Number(e.target.value))}
                        className="mt-3 px-3 py-1.5 text-xs font-semibold bg-white border border-slate-300 rounded-lg text-slate-800 font-mono"
                      />
                    </div>
                  </div>

                  {/* Composition Scheme & RCM Toggles */}
                  <div className="space-y-3 pt-2">
                    <div className="flex items-center justify-between p-3.5 bg-slate-50 rounded-xl border border-slate-200">
                      <div>
                        <h4 className="text-xs font-bold text-slate-900">Composition Dealer Mode</h4>
                        <p className="text-[11px] text-slate-500 mt-0.5">
                          Prints &ldquo;Bill of Supply&rdquo; instead of Tax Invoice. Composition dealers cannot collect tax from
                          customers.
                        </p>
                      </div>
                      <input
                        type="checkbox"
                        checked={settings.isCompositionScheme}
                        onChange={(e) => handleUpdateSetting('isCompositionScheme', e.target.checked)}
                        className="w-4 h-4 rounded text-rose-600 focus:ring-rose-500 cursor-pointer"
                      />
                    </div>

                    <div className="flex items-center justify-between p-3.5 bg-slate-50 rounded-xl border border-slate-200">
                      <div>
                        <h4 className="text-xs font-bold text-slate-900">Enable Reverse Charge Mechanism (RCM)</h4>
                        <p className="text-[11px] text-slate-500 mt-0.5">
                          Allows flagging purchases where recipient is liable to pay tax directly to the government.
                        </p>
                      </div>
                      <input
                        type="checkbox"
                        checked={settings.enableRCM}
                        onChange={(e) => handleUpdateSetting('enableRCM', e.target.checked)}
                        className="w-4 h-4 rounded text-rose-600 focus:ring-rose-500 cursor-pointer"
                      />
                    </div>

                    <div className="flex items-center justify-between p-3.5 bg-slate-50 rounded-xl border border-slate-200">
                      <div>
                        <h4 className="text-xs font-bold text-slate-900">Enable E-Way Bill Vehicle & Transport Fields</h4>
                        <p className="text-[11px] text-slate-500 mt-0.5">
                          Shows vehicle number, transport mode, and transporter ID on invoice forms.
                        </p>
                      </div>
                      <input
                        type="checkbox"
                        checked={settings.enableEWayBill}
                        onChange={(e) => handleUpdateSetting('enableEWayBill', e.target.checked)}
                        className="w-4 h-4 rounded text-rose-600 focus:ring-rose-500 cursor-pointer"
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ========================================================================= */}
            {/* TAB 5: PARTIES & WHATSAPP */}
            {/* ========================================================================= */}
            {activeTab === 'party_whatsapp' && (
              <div className="space-y-5">
                {/* Credit Limit Alert Control & Overdue Reminder Days */}
                <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-2xs space-y-4">
                  <h3 className="text-sm font-bold text-slate-900 pb-3 border-b border-slate-100 flex items-center gap-2">
                    <Users className="w-4 h-4 text-blue-600" />
                    <span>Customer Credit Risk &amp; Overdue Payment Reminders</span>
                  </h3>

                  <div className="flex items-center justify-between p-3.5 bg-slate-50 rounded-xl border border-slate-200">
                    <div>
                      <h4 className="text-xs font-bold text-slate-900">Enforce Customer Credit Limit Warnings</h4>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        Displays an alert when generating an invoice for a customer exceeding their assigned credit limit.
                      </p>
                    </div>
                    <input
                      type="checkbox"
                      checked={settings.enableCreditLimitAlerts}
                      onChange={(e) => handleUpdateSetting('enableCreditLimitAlerts', e.target.checked)}
                      className="w-4 h-4 rounded text-rose-600 focus:ring-rose-500 cursor-pointer"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 flex flex-col justify-between">
                      <div>
                        <h4 className="text-xs font-bold text-slate-900">Default Invoice Due Days</h4>
                        <p className="text-[11px] text-slate-500 mt-0.5">
                          Fallback credit period when no explicit due date is entered on a sale invoice.
                        </p>
                      </div>
                      <input
                        type="number"
                        min={0}
                        max={365}
                        value={settings.defaultDueDays ?? 30}
                        onChange={(e) => handleUpdateSetting('defaultDueDays', Math.max(0, Number(e.target.value)))}
                        className="mt-3 px-3 py-1.5 text-xs font-semibold bg-white border border-slate-300 rounded-lg text-slate-800 font-mono"
                      />
                    </div>

                    <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 flex flex-col justify-between">
                      <div>
                        <h4 className="text-xs font-bold text-slate-900">Overdue Reminder Grace Days</h4>
                        <p className="text-[11px] text-slate-500 mt-0.5">
                          Show invoices on Home &ldquo;Overdue Payments&rdquo; card once past due date by these many days (0 = immediately).
                        </p>
                      </div>
                      <input
                        type="number"
                        min={0}
                        max={180}
                        value={settings.overdueReminderDays ?? 0}
                        onChange={(e) => handleUpdateSetting('overdueReminderDays', Math.max(0, Number(e.target.value)))}
                        className="mt-3 px-3 py-1.5 text-xs font-semibold bg-white border border-slate-300 rounded-lg text-slate-800 font-mono"
                      />
                    </div>
                  </div>
                </div>

                {/* WhatsApp Message Template Editor */}
                <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-2xs space-y-4">
                  <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                    <div>
                      <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                        <MessageSquare className="w-4 h-4 text-emerald-600" />
                        <span>WhatsApp Transaction Message Template</span>
                      </h3>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Click tags below to insert dynamic payment reminder &amp; invoice variables
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        handleUpdateSetting(
                          'whatsappMessageTemplate',
                          'Dear [Party_Name], gentle reminder from [Firm_Name]: Invoice [Invoice_Number] (Balance: [Transaction_Balance]) was due on [Due_Date]. Please arrange payment. Thank you!'
                        )
                      }
                      className="px-2.5 py-1 text-xs text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-md transition-colors cursor-pointer flex items-center gap-1"
                    >
                      <RotateCcw className="w-3 h-3" />
                      <span>Reset Default</span>
                    </button>
                  </div>

                  {/* Variable insertion chips */}
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[11px] text-slate-500 font-semibold mr-1">Insert Variable:</span>
                    {[
                      '[Firm_Name]',
                      '[Party_Name]',
                      '[Transaction_Balance]',
                      '[Due_Date]',
                      '[Invoice_Number]',
                      '[Invoice_Amount]',
                      '[Invoice_Date]',
                      '[Balance_Due]',
                    ].map((tag) => (
                      <button
                        key={tag}
                        type="button"
                        onClick={() => handleInsertWhatsAppTag(tag)}
                        className="px-2.5 py-1 bg-slate-100 hover:bg-emerald-50 hover:text-emerald-700 hover:border-emerald-300 border border-slate-200 rounded-md text-[11px] font-mono font-medium transition-colors cursor-pointer"
                      >
                        +{tag}
                      </button>
                    ))}
                  </div>

                  {/* Textarea */}
                  <textarea
                    rows={4}
                    value={settings.whatsappMessageTemplate}
                    onChange={(e) => handleUpdateSetting('whatsappMessageTemplate', e.target.value)}
                    className="w-full p-3 text-xs bg-slate-50 border border-slate-300 rounded-xl font-mono leading-relaxed focus:bg-white focus:outline-hidden focus:ring-1 focus:ring-slate-900"
                  />

                  {/* Real-time Preview Bubble */}
                  <div className="p-4 bg-emerald-50/70 border border-emerald-200 rounded-xl space-y-1.5">
                    <div className="text-[10px] font-bold text-emerald-800 uppercase tracking-wider">
                      Live Sample Output:
                    </div>
                    <div className="p-3 bg-white rounded-lg border border-emerald-100 shadow-2xs text-xs text-slate-800 whitespace-pre-wrap leading-relaxed">
                      {(settings.whatsappMessageTemplate || '')
                        .replace(/\[Firm_Name\]/g, profile?.businessName || 'ABC Traders')
                        .replace(/\[Party_Name\]/g, 'Royal Enterprises')
                        .replace(/\[Transaction_Balance\]/g, '₹ 1,500.00')
                        .replace(/\[Due_Date\]/g, '15/11/2026')
                        .replace(/\[Invoice_Number\]/g, 'INV-1024')
                        .replace(/\[Invoice_Amount\]/g, '₹ 4,725.00')
                        .replace(/\[Invoice_Date\]/g, '06/11/2026')
                        .replace(/\[Balance_Due\]/g, '₹ 1,500.00')}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ========================================================================= */}
            {/* TAB 6: ITEMS & INVENTORY */}
            {/* ========================================================================= */}
            {activeTab === 'item_inventory' && (
              <div className="space-y-5">
                <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-2xs space-y-4">
                  <h3 className="text-sm font-bold text-slate-900 pb-3 border-b border-slate-100 flex items-center gap-2">
                    <Package className="w-4 h-4 text-amber-600" />
                    <span>Product & Stock Attributes</span>
                  </h3>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* Default Unit */}
                    <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 flex flex-col justify-between">
                      <div>
                        <h4 className="text-xs font-bold text-slate-900">Default Measurement Unit</h4>
                        <p className="text-[11px] text-slate-500 mt-0.5">
                          Standard unit pre-selected when creating new inventory products.
                        </p>
                      </div>
                      <select
                        value={settings.defaultUnit || 'Pcs'}
                        onChange={(e) => handleUpdateSetting('defaultUnit', e.target.value)}
                        className="mt-3 px-3 py-1.5 text-xs font-semibold bg-white border border-slate-300 rounded-lg text-slate-800 cursor-pointer"
                      >
                        <option value="Pcs">Pcs - Pieces</option>
                        <option value="Box">Box - Boxes</option>
                        <option value="Kg">Kg - Kilograms</option>
                        <option value="Nos">Nos - Numbers</option>
                        <option value="Mtr">Mtr - Meters</option>
                        <option value="Ltr">Ltr - Litres</option>
                        <option value="Gram">Gram - Grams</option>
                        <option value="Tonne">Tonne - Tonnes</option>
                        <option value="Pack">Pack - Packets</option>
                      </select>
                    </div>

                    {/* Free Quantity Scheme */}
                    <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 flex flex-col justify-between">
                      <div>
                        <h4 className="text-xs font-bold text-slate-900">Enable Free Quantity Scheme</h4>
                        <p className="text-[11px] text-slate-500 mt-0.5">
                          Enables &ldquo;Buy 10 Get 1 Free&rdquo; columns on invoice line items without adding to bill amount.
                        </p>
                      </div>
                      <div className="mt-3 flex items-center justify-between">
                        <span className="text-xs font-medium text-slate-600">Free Qty Column:</span>
                        <input
                          type="checkbox"
                          checked={settings.enableFreeQty}
                          onChange={(e) => handleUpdateSetting('enableFreeQty', e.target.checked)}
                          className="w-4 h-4 rounded text-rose-600 focus:ring-rose-500 cursor-pointer"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Batch & Wholesale Toggles */}
                  <div className="space-y-3 pt-2">
                    <div className="flex items-center justify-between p-3.5 bg-slate-50 rounded-xl border border-slate-200">
                      <div>
                        <h4 className="text-xs font-bold text-slate-900">Batch Number & Expiry Date Tracking</h4>
                        <p className="text-[11px] text-slate-500 mt-0.5">
                          Track pharmaceutical or perishable goods with manufacture & expiry dates.
                        </p>
                      </div>
                      <input
                        type="checkbox"
                        checked={settings.enableBatchExpiry}
                        onChange={(e) => handleUpdateSetting('enableBatchExpiry', e.target.checked)}
                        className="w-4 h-4 rounded text-rose-600 focus:ring-rose-500 cursor-pointer"
                      />
                    </div>

                    <div className="flex items-center justify-between p-3.5 bg-slate-50 rounded-xl border border-slate-200">
                      <div>
                        <h4 className="text-xs font-bold text-slate-900">Wholesale Price Tier</h4>
                        <p className="text-[11px] text-slate-500 mt-0.5">
                          Enables separate wholesale selling price for distributor and bulk customer accounts.
                        </p>
                      </div>
                      <input
                        type="checkbox"
                        checked={settings.enableWholesalePrice}
                        onChange={(e) => handleUpdateSetting('enableWholesalePrice', e.target.checked)}
                        className="w-4 h-4 rounded text-rose-600 focus:ring-rose-500 cursor-pointer"
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ========================================================================= */}
            {/* TAB 7: OPTIONAL FEATURES & SECURITY (ADD-ON C) */}
            {/* ========================================================================= */}
            {activeTab === 'addons_security' && (
              <div className="space-y-5">
                {/* 1. UPI QR on Invoices */}
                <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-2xs space-y-4">
                  <h3 className="text-sm font-bold text-slate-900 pb-3 border-b border-slate-100 flex items-center gap-2">
                    <QrCode className="w-4 h-4 text-emerald-600" />
                    <span>1. UPI Payment QR Code on Invoices</span>
                  </h3>
                  <div className="flex items-center justify-between p-3.5 bg-slate-50 rounded-xl border border-slate-200">
                    <div>
                      <h4 className="text-xs font-bold text-slate-900">Show UPI Payment QR Code on Invoices</h4>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        Automatically builds an offline QR code on A4 &amp; Thermal prints with payee VPA and exact bill amount.
                      </p>
                    </div>
                    <input
                      type="checkbox"
                      checked={Boolean(settings.printShowUPIQR)}
                      onChange={(e) => handleUpdateSetting('printShowUPIQR', e.target.checked)}
                      className="w-4 h-4 rounded text-rose-600 focus:ring-rose-500 cursor-pointer"
                    />
                  </div>
                  <div className="flex flex-col sm:flex-row gap-2">
                    <input
                      type="text"
                      value={upiId}
                      onChange={(e) => setUpiId(e.target.value)}
                      placeholder="Enter Business UPI ID (e.g. storename@okhdfcbank)"
                      className="flex-1 px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg font-mono"
                    />
                    <button
                      type="button"
                      onClick={handleSaveUpiId}
                      disabled={isSaving}
                      className="px-4 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg cursor-pointer disabled:opacity-50"
                    >
                      Save UPI ID
                    </button>
                  </div>
                </div>

                {/* 2. Multiple Firms & 3. Passcode Lock & 4. Audit Trail */}
                <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-2xs space-y-4">
                  <h3 className="text-sm font-bold text-slate-900 pb-3 border-b border-slate-100 flex items-center gap-2">
                    <Lock className="w-4 h-4 text-rose-600" />
                    <span>2. Multiple Firms, Passcode Lock &amp; Audit Trail</span>
                  </h3>

                  <div className="space-y-3">
                    <div className="flex items-center justify-between p-3.5 bg-slate-50 rounded-xl border border-slate-200">
                      <div>
                        <h4 className="text-xs font-bold text-slate-900 flex items-center gap-2">
                          <Building2 className="w-3.5 h-3.5 text-indigo-600" />
                          <span>Enable Multiple Firms Switcher</span>
                        </h4>
                        <p className="text-[11px] text-slate-500 mt-0.5">
                          Adds a Firm Switcher in the sidebar footer ({getFirmsList().length} firm{getFirmsList().length === 1 ? '' : 's'} registered). Each firm keeps isolated databases &amp; numbering.
                        </p>
                      </div>
                      <input
                        type="checkbox"
                        checked={Boolean(settings.enableMultipleFirms)}
                        onChange={(e) => handleUpdateSetting('enableMultipleFirms', e.target.checked)}
                        className="w-4 h-4 rounded text-rose-600 focus:ring-rose-500 cursor-pointer"
                      />
                    </div>

                    <div className="flex items-center justify-between p-3.5 bg-slate-50 rounded-xl border border-slate-200">
                      <div>
                        <h4 className="text-xs font-bold text-slate-900 flex items-center gap-2">
                          <Activity className="w-3.5 h-3.5 text-blue-600" />
                          <span>Enable Audit Trail Activity Log</span>
                        </h4>
                        <p className="text-[11px] text-slate-500 mt-0.5">
                          Logs every create, edit, cancel, convert, delete, settings change, and backup restore with timestamps in Reports &rarr; Audit Trail.
                        </p>
                      </div>
                      <input
                        type="checkbox"
                        checked={Boolean(settings.enableAuditTrail)}
                        onChange={(e) => handleUpdateSetting('enableAuditTrail', e.target.checked)}
                        className="w-4 h-4 rounded text-rose-600 focus:ring-rose-500 cursor-pointer"
                      />
                    </div>

                    <div className="flex items-center justify-between p-3.5 bg-slate-50 rounded-xl border border-slate-200">
                      <div>
                        <h4 className="text-xs font-bold text-slate-900">Lock Application with PIN on Startup</h4>
                        <p className="text-[11px] text-slate-500 mt-0.5">
                          Requires your security PIN whenever the app opens. {hasExistingPin ? '(PIN configured)' : '(Set a PIN below first)'}
                        </p>
                      </div>
                      <input
                        type="checkbox"
                        checked={Boolean(settings.enablePasscodeLock)}
                        disabled={!hasExistingPin}
                        onChange={(e) => handleUpdateSetting('enablePasscodeLock', e.target.checked)}
                        className="w-4 h-4 rounded text-rose-600 focus:ring-rose-500 cursor-pointer disabled:opacity-40"
                      />
                    </div>

                    <div className="flex items-center justify-between p-3.5 bg-slate-50 rounded-xl border border-slate-200">
                      <div>
                        <h4 className="text-xs font-bold text-slate-900">Require PIN to Edit or Delete Transactions</h4>
                        <p className="text-[11px] text-slate-500 mt-0.5">
                          Prompts for PIN verification before opening transaction edits, cancellations, or deletions.
                        </p>
                      </div>
                      <input
                        type="checkbox"
                        checked={Boolean(settings.requirePinForEditDelete)}
                        disabled={!hasExistingPin}
                        onChange={(e) => handleUpdateSetting('requirePinForEditDelete', e.target.checked)}
                        className="w-4 h-4 rounded text-rose-600 focus:ring-rose-500 cursor-pointer disabled:opacity-40"
                      />
                    </div>
                  </div>

                  {/* PIN Configuration Form */}
                  <form onSubmit={handleSaveSecurityPin} className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-bold text-slate-900">
                        {hasExistingPin ? 'Change or Remove Security PIN' : 'Set Security PIN (4–8 digits)'}
                      </h4>
                      {hasExistingPin && (
                        <button
                          type="button"
                          onClick={handleRemovePin}
                          className="text-[11px] font-semibold text-rose-600 hover:underline cursor-pointer"
                        >
                          Remove PIN Protection
                        </button>
                      )}
                    </div>

                    {pinError && (
                      <div className="p-2 text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded-lg">
                        {pinError}
                      </div>
                    )}

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      {hasExistingPin && (
                        <div>
                          <label className="text-[11px] text-slate-600 block mb-1">Current PIN</label>
                          <input
                            type="password"
                            inputMode="numeric"
                            maxLength={8}
                            value={currentPinInput}
                            onChange={(e) => setCurrentPinInput(e.target.value.replace(/\D/g, ''))}
                            placeholder="••••"
                            className="w-full px-3 py-1.5 text-xs font-mono bg-white border border-slate-300 rounded-lg"
                          />
                        </div>
                      )}
                      <div>
                        <label className="text-[11px] text-slate-600 block mb-1">New PIN (4-8 digits)</label>
                        <input
                          type="password"
                          inputMode="numeric"
                          maxLength={8}
                          value={newPinInput}
                          onChange={(e) => setNewPinInput(e.target.value.replace(/\D/g, ''))}
                          placeholder="••••"
                          className="w-full px-3 py-1.5 text-xs font-mono bg-white border border-slate-300 rounded-lg"
                        />
                      </div>
                      <div>
                        <label className="text-[11px] text-slate-600 block mb-1">Confirm PIN</label>
                        <input
                          type="password"
                          inputMode="numeric"
                          maxLength={8}
                          value={confirmPinInput}
                          onChange={(e) => setConfirmPinInput(e.target.value.replace(/\D/g, ''))}
                          placeholder="••••"
                          className="w-full px-3 py-1.5 text-xs font-mono bg-white border border-slate-300 rounded-lg"
                        />
                      </div>
                    </div>

                    <div className="flex justify-end">
                      <button
                        type="submit"
                        className="px-4 py-1.5 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg cursor-pointer"
                      >
                        {hasExistingPin ? 'Update PIN' : 'Save & Enable PIN'}
                      </button>
                    </div>
                  </form>
                </div>

                {/* 3. Barcode & Batch/Serial Tracking */}
                <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-2xs space-y-3">
                  <h3 className="text-sm font-bold text-slate-900 pb-2 border-b border-slate-100 flex items-center gap-2">
                    <ScanBarcode className="w-4 h-4 text-amber-600" />
                    <span>3. Barcode Scanning, Batch &amp; Serial Numbers</span>
                  </h3>

                  <div className="flex items-center justify-between p-3.5 bg-slate-50 rounded-xl border border-slate-200">
                    <div>
                      <h4 className="text-xs font-bold text-slate-900">Enable Barcode Scan / Type Input on Sale &amp; Purchase</h4>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        Adds a fast barcode scanner input bar above invoice item grids to look up items by barcode or item code.
                      </p>
                    </div>
                    <input
                      type="checkbox"
                      checked={Boolean(settings.enableBarcode)}
                      onChange={(e) => handleUpdateSetting('enableBarcode', e.target.checked)}
                      className="w-4 h-4 rounded text-rose-600 focus:ring-rose-500 cursor-pointer"
                    />
                  </div>

                  <div className="flex items-center justify-between p-3.5 bg-slate-50 rounded-xl border border-slate-200">
                    <div>
                      <h4 className="text-xs font-bold text-slate-900">Enable Batch No. &amp; Serial No. Line Tracking</h4>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        Shows Batch Number and Serial Number fields on items and invoice/bill rows, printed on A4 invoices.
                      </p>
                    </div>
                    <input
                      type="checkbox"
                      checked={Boolean(settings.enableBatchSerial)}
                      onChange={(e) => handleUpdateSetting('enableBatchSerial', e.target.checked)}
                      className="w-4 h-4 rounded text-rose-600 focus:ring-rose-500 cursor-pointer"
                    />
                  </div>
                </div>

                {/* 4. Dark Mode & Keyboard Shortcuts */}
                <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-2xs space-y-3">
                  <h3 className="text-sm font-bold text-slate-900 pb-2 border-b border-slate-100 flex items-center gap-2">
                    <Moon className="w-4 h-4 text-violet-600" />
                    <span>4. Appearance (Dark Mode) &amp; Keyboard Shortcuts</span>
                  </h3>

                  <div className="flex items-center justify-between p-3.5 bg-slate-50 rounded-xl border border-slate-200">
                    <div>
                      <h4 className="text-xs font-bold text-slate-900">Dark Mode Theme</h4>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        Switches the workspace to a low-glare dark interface while keeping printable invoices crisp white.
                      </p>
                    </div>
                    <input
                      type="checkbox"
                      checked={Boolean(settings.darkMode)}
                      onChange={(e) => handleUpdateSetting('darkMode', e.target.checked)}
                      className="w-4 h-4 rounded text-rose-600 focus:ring-rose-500 cursor-pointer"
                    />
                  </div>

                  <div className="flex items-center justify-between p-3.5 bg-slate-50 rounded-xl border border-slate-200">
                    <div>
                      <h4 className="text-xs font-bold text-slate-900 flex items-center gap-2">
                        <Keyboard className="w-3.5 h-3.5 text-slate-600" />
                        <span>Enable Extended Keyboard Shortcuts (Ctrl+S, Ctrl+N, Ctrl+P, Esc)</span>
                      </h4>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        Ctrl+N opens new sale, Ctrl+S saves open invoice/bill, Ctrl+P prints open preview, Esc closes modals.
                      </p>
                    </div>
                    <input
                      type="checkbox"
                      checked={settings.enableExtendedShortcuts !== false}
                      onChange={(e) => handleUpdateSetting('enableExtendedShortcuts', e.target.checked)}
                      className="w-4 h-4 rounded text-rose-600 focus:ring-rose-500 cursor-pointer"
                    />
                  </div>
                </div>

                {/* 5. Weight Units & Job Work Challans */}
                <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-2xs space-y-3">
                  <h3 className="text-sm font-bold text-slate-900 pb-2 border-b border-slate-100 flex items-center gap-2">
                    <Scale className="w-4 h-4 text-teal-600" />
                    <span>5. Weight-Based Unit Conversion &amp; Job Work Challans</span>
                  </h3>

                  <div className="flex items-center justify-between p-3.5 bg-slate-50 rounded-xl border border-slate-200">
                    <div>
                      <h4 className="text-xs font-bold text-slate-900">Enable Weight Unit Conversion (GM / KG / QUINTAL / TONNE)</h4>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        Sell or buy a KG-tracked item in Quintals or Tonnes; line prices and stock deductions convert automatically.
                      </p>
                    </div>
                    <input
                      type="checkbox"
                      checked={Boolean(settings.enableWeightUnits)}
                      onChange={(e) => handleUpdateSetting('enableWeightUnits', e.target.checked)}
                      className="w-4 h-4 rounded text-rose-600 focus:ring-rose-500 cursor-pointer"
                    />
                  </div>

                  <div className="flex items-center justify-between p-3.5 bg-slate-50 rounded-xl border border-slate-200">
                    <div>
                      <h4 className="text-xs font-bold text-slate-900 flex items-center gap-2">
                        <Wrench className="w-3.5 h-3.5 text-indigo-600" />
                        <span>Enable Job Work Out &amp; Job Work In Challans</span>
                      </h4>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        Adds Job Work (Out / In) under Sale to send raw materials out for processing and receive finished goods back.
                      </p>
                    </div>
                    <input
                      type="checkbox"
                      checked={Boolean(settings.enableJobWork)}
                      onChange={(e) => handleUpdateSetting('enableJobWork', e.target.checked)}
                      className="w-4 h-4 rounded text-rose-600 focus:ring-rose-500 cursor-pointer"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
