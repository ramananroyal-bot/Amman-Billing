import React, { useState } from 'react';
import {
  Home,
  Users,
  Package,
  TrendingUp,
  ShoppingBag,
  BarChart3,
  Cloud,
  Settings,
  ChevronDown,
  ChevronRight,
  Plus,
  PanelLeftClose,
  PanelLeftOpen,
  Building2,
  MessageSquare,
  FileText,
  Truck,
  RotateCcw,
  ArrowDownLeft,
  ArrowUpRight,
  Receipt,
  Calculator,
  Search,
  Wrench,
  ArrowLeftRight,
  Check,
} from 'lucide-react';
import { BusinessProfile, FirmInfo } from '../../types';
import { useTranslation } from '../../i18n/LanguageContext';

export type NavView =
  | 'home'
  | 'parties'
  | 'whatsapp_connect'
  | 'items'
  | 'sales'
  | 'estimates'
  | 'payments_in'
  | 'sale_returns'
  | 'delivery_challans'
  | 'job_work'
  | 'purchases'
  | 'payments_out'
  | 'expenses'
  | 'purchase_returns'
  | 'reports'
  | 'sync_backup'
  | 'settings';

interface SidebarProps {
  currentView: NavView;
  onNavigate: (view: NavView) => void;
  onOpenAddSale: () => void;
  onOpenAddPurchase: () => void;
  onOpenBusinessProfile: () => void;
  onOpenGlobalSearch: () => void;
  businessProfile: BusinessProfile | null;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  enableJobWork?: boolean;
  enableMultipleFirms?: boolean;
  firmsList?: FirmInfo[];
  activeFirmId?: string;
  onSwitchFirm?: (firmId: string) => void;
  onOpenCreateFirm?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentView,
  onNavigate,
  onOpenAddSale,
  onOpenAddPurchase,
  onOpenBusinessProfile,
  onOpenGlobalSearch,
  businessProfile,
  isCollapsed,
  onToggleCollapse,
  enableJobWork = false,
  enableMultipleFirms = false,
  firmsList = [],
  activeFirmId,
  onSwitchFirm,
  onOpenCreateFirm,
}) => {
  const { t } = useTranslation();
  const [firmMenuOpen, setFirmMenuOpen] = useState(false);
  const [partiesOpen, setPartiesOpen] = useState(
    currentView === 'parties' || currentView === 'whatsapp_connect'
  );
  const [saleOpen, setSaleOpen] = useState(
    currentView === 'sales' ||
      currentView === 'estimates' ||
      currentView === 'payments_in' ||
      currentView === 'sale_returns' ||
      currentView === 'delivery_challans' ||
      currentView === 'job_work'
  );
  const [purchaseOpen, setPurchaseOpen] = useState(
    currentView === 'purchases' ||
      currentView === 'payments_out' ||
      currentView === 'expenses' ||
      currentView === 'purchase_returns'
  );

  return (
    <aside
      className={`bg-[#151b26] text-slate-300 flex flex-col shrink-0 border-r border-[#222c3d] select-none transition-all duration-200 z-30 ${
        isCollapsed ? 'w-16' : 'w-64'
      }`}
    >
      {/* Business Brand & Collapse Toggle */}
      <div className="h-16 flex items-center justify-between px-3.5 border-b border-[#222c3d]">
        {!isCollapsed ? (
          <button
            type="button"
            onClick={onOpenBusinessProfile}
            title="Click to view/edit business profile"
            className="flex items-center gap-2.5 min-w-0 text-left hover:bg-white/5 p-1.5 rounded-lg transition-colors group cursor-pointer"
          >
            <div className="w-8 h-8 rounded-md bg-gradient-to-tr from-rose-600 to-rose-500 text-white flex items-center justify-center font-bold text-sm shrink-0 shadow-sm overflow-hidden">
              {businessProfile?.logo ? (
                <img src={businessProfile.logo} alt="Logo" className="w-full h-full object-cover" />
              ) : (
                <Building2 className="w-4 h-4" />
              )}
            </div>
            <div className="min-w-0">
              <div className="text-xs font-bold text-white truncate group-hover:text-rose-400 transition-colors">
                {businessProfile?.businessName || 'My Business'}
              </div>
              <div className="text-[10px] text-slate-400 truncate">
                {businessProfile?.gstin ? `GST: ${businessProfile.gstin.substring(0, 8)}...` : t('app.name')}
              </div>
            </div>
          </button>
        ) : (
          <button
            type="button"
            onClick={onOpenBusinessProfile}
            title={businessProfile?.businessName || 'Business Profile'}
            className="w-9 h-9 mx-auto rounded-md bg-rose-600 text-white flex items-center justify-center font-bold text-xs shadow-sm overflow-hidden cursor-pointer"
          >
            {businessProfile?.logo ? (
              <img src={businessProfile.logo} alt="Logo" className="w-full h-full object-cover" />
            ) : (
              <Building2 className="w-4 h-4" />
            )}
          </button>
        )}

        <button
          type="button"
          onClick={onToggleCollapse}
          title={isCollapsed ? 'Expand Sidebar' : 'Collapse Sidebar'}
          className="text-slate-400 hover:text-white p-1 rounded-md hover:bg-slate-850 transition-colors cursor-pointer"
        >
          {isCollapsed ? <PanelLeftOpen className="w-4 h-4" /> : <PanelLeftClose className="w-4 h-4" />}
        </button>
      </div>

      {/* Open Anything (Ctrl+F) Quick Search Box */}
      <div className={`px-3 pt-3 pb-1 ${isCollapsed ? 'px-2' : ''}`}>
        <button
          type="button"
          onClick={onOpenGlobalSearch}
          title={`${t('nav.openAnything')} (Ctrl+F)`}
          className={`w-full flex items-center justify-between gap-2 px-2.5 py-2 bg-[#1c2433] hover:bg-[#232d40] border border-[#2b374d] text-slate-300 hover:text-white rounded-lg text-xs transition-colors cursor-pointer ${
            isCollapsed ? 'justify-center px-0 h-9' : ''
          }`}
        >
          <div className="flex items-center gap-2 min-w-0">
            <Search className="w-3.5 h-3.5 text-rose-400 shrink-0" />
            {!isCollapsed && (
              <span className="truncate text-[11px] text-slate-400">
                {t('nav.openAnything')}...
              </span>
            )}
          </div>
          {!isCollapsed && (
            <kbd className="px-1.5 py-0.5 text-[9px] font-mono bg-[#151b26] border border-[#2d3a50] rounded text-slate-400 shrink-0">
              Ctrl+F
            </kbd>
          )}
        </button>
      </div>

      {/* Quick Action Buttons (Red Add Sale & Blue Add Purchase) */}
      <div className={`p-3 space-y-2 border-b border-[#222c3d] ${isCollapsed ? 'px-2' : ''}`}>
        <button
          type="button"
          onClick={onOpenAddSale}
          title="Create Sale Invoice (Alt + S)"
          className={`w-full flex items-center justify-center gap-2 py-2 px-3 bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold rounded-lg shadow-sm transition-all transform active:scale-[0.98] cursor-pointer ${
            isCollapsed ? 'px-0 h-9' : ''
          }`}
        >
          <Plus className="w-4 h-4 shrink-0" />
          {!isCollapsed && <span className="whitespace-nowrap">{t('nav.addSale')}</span>}
        </button>

        <button
          type="button"
          onClick={onOpenAddPurchase}
          title="Create Purchase Bill (Alt + P)"
          className={`w-full flex items-center justify-center gap-2 py-2 px-3 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg shadow-sm transition-all transform active:scale-[0.98] cursor-pointer ${
            isCollapsed ? 'px-0 h-9' : ''
          }`}
        >
          <Plus className="w-4 h-4 shrink-0" />
          {!isCollapsed && <span className="whitespace-nowrap">{t('nav.addPurchase')}</span>}
        </button>
      </div>

      {/* Navigation Links */}
      <nav className="flex-1 overflow-y-auto p-2 space-y-1">
        {/* Home */}
        <button
          type="button"
          onClick={() => onNavigate('home')}
          title={t('nav.home')}
          className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
            currentView === 'home'
              ? 'bg-rose-600/15 text-rose-400 font-semibold'
              : 'text-slate-300 hover:bg-[#1f293a] hover:text-white'
          }`}
        >
          <Home className="w-4 h-4 shrink-0" />
          {!isCollapsed && <span className="truncate">{t('nav.home')}</span>}
        </button>

        {/* Parties */}
        <div>
          <button
            type="button"
            onClick={() => {
              if (isCollapsed) {
                onNavigate('parties');
              } else {
                setPartiesOpen(!partiesOpen);
              }
            }}
            title={t('nav.parties')}
            className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
              currentView === 'parties' || currentView === 'whatsapp_connect'
                ? 'bg-rose-600/15 text-rose-400 font-semibold'
                : 'text-slate-300 hover:bg-[#1f293a] hover:text-white'
            }`}
          >
            <div className="flex items-center gap-3 min-w-0">
              <Users className="w-4 h-4 shrink-0" />
              {!isCollapsed && <span className="truncate">{t('nav.parties')}</span>}
            </div>
            {!isCollapsed && (
              <span className="text-slate-500">
                {partiesOpen ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
              </span>
            )}
          </button>

          {!isCollapsed && partiesOpen && (
            <div className="ml-7 pl-2 border-l border-[#263345] my-1 space-y-1">
              <button
                type="button"
                onClick={() => onNavigate('parties')}
                className={`w-full text-left px-2.5 py-1.5 rounded-md text-[11px] transition-colors cursor-pointer ${
                  currentView === 'parties' ? 'text-rose-400 font-semibold' : 'text-slate-400 hover:text-white'
                }`}
              >
                {t('nav.partyDetails')}
              </button>
              <button
                type="button"
                onClick={() => onNavigate('whatsapp_connect')}
                className={`w-full text-left px-2.5 py-1.5 rounded-md text-[11px] flex items-center gap-1.5 transition-colors cursor-pointer ${
                  currentView === 'whatsapp_connect' ? 'text-rose-400 font-semibold' : 'text-slate-400 hover:text-white'
                }`}
              >
                <MessageSquare className="w-3 h-3 text-emerald-500" />
                <span>{t('nav.whatsappConnect')}</span>
              </button>
            </div>
          )}
        </div>

        {/* Items */}
        <button
          type="button"
          onClick={() => onNavigate('items')}
          title={t('nav.items')}
          className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
            currentView === 'items'
              ? 'bg-rose-600/15 text-rose-400 font-semibold'
              : 'text-slate-300 hover:bg-[#1f293a] hover:text-white'
          }`}
        >
          <Package className="w-4 h-4 shrink-0" />
          {!isCollapsed && <span className="truncate">{t('nav.items')}</span>}
        </button>

        {/* Sale (Sale Invoice, Estimate/Quotation, Payment-In, Sale Return/Credit Note, Delivery Challan) */}
        <div>
          <button
            type="button"
            onClick={() => {
              if (isCollapsed) {
                onNavigate('sales');
              } else {
                setSaleOpen(!saleOpen);
              }
            }}
            title={t('nav.sale')}
            className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
              currentView === 'sales' ||
              currentView === 'estimates' ||
              currentView === 'payments_in' ||
              currentView === 'sale_returns' ||
              currentView === 'delivery_challans' ||
              currentView === 'job_work'
                ? 'bg-rose-600/15 text-rose-400 font-semibold'
                : 'text-slate-300 hover:bg-[#1f293a] hover:text-white'
            }`}
          >
            <div className="flex items-center gap-3 min-w-0">
              <TrendingUp className="w-4 h-4 shrink-0" />
              {!isCollapsed && <span className="truncate">{t('nav.sale')}</span>}
            </div>
            {!isCollapsed && (
              <span className="text-slate-500">
                {saleOpen ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
              </span>
            )}
          </button>

          {!isCollapsed && saleOpen && (
            <div className="ml-7 pl-2 border-l border-[#263345] my-1 space-y-1">
              <button
                type="button"
                onClick={() => onNavigate('sales')}
                className={`w-full text-left px-2.5 py-1.5 rounded-md text-[11px] flex items-center gap-1.5 transition-colors cursor-pointer ${
                  currentView === 'sales' ? 'text-rose-400 font-semibold bg-rose-500/10' : 'text-slate-400 hover:text-white'
                }`}
              >
                <FileText className="w-3 h-3 text-rose-400 shrink-0" />
                <span className="truncate">{t('nav.saleInvoice')}</span>
              </button>
              <button
                type="button"
                onClick={() => onNavigate('estimates')}
                className={`w-full text-left px-2.5 py-1.5 rounded-md text-[11px] flex items-center gap-1.5 transition-colors cursor-pointer ${
                  currentView === 'estimates' ? 'text-rose-400 font-semibold bg-rose-500/10' : 'text-slate-400 hover:text-white'
                }`}
              >
                <Receipt className="w-3 h-3 text-amber-400 shrink-0" />
                <span className="truncate">{t('nav.estimateQuotation')}</span>
              </button>
              <button
                type="button"
                onClick={() => onNavigate('payments_in')}
                className={`w-full text-left px-2.5 py-1.5 rounded-md text-[11px] flex items-center gap-1.5 transition-colors cursor-pointer ${
                  currentView === 'payments_in' ? 'text-rose-400 font-semibold bg-rose-500/10' : 'text-slate-400 hover:text-white'
                }`}
              >
                <ArrowDownLeft className="w-3 h-3 text-emerald-400 shrink-0" />
                <span className="truncate">{t('nav.paymentIn')}</span>
              </button>
              <button
                type="button"
                onClick={() => onNavigate('sale_returns')}
                className={`w-full text-left px-2.5 py-1.5 rounded-md text-[11px] flex items-center gap-1.5 transition-colors cursor-pointer ${
                  currentView === 'sale_returns' ? 'text-rose-400 font-semibold bg-rose-500/10' : 'text-slate-400 hover:text-white'
                }`}
              >
                <RotateCcw className="w-3 h-3 text-amber-500 shrink-0" />
                <span className="truncate">{t('nav.saleReturn')}</span>
              </button>
              <button
                type="button"
                onClick={() => onNavigate('delivery_challans')}
                className={`w-full text-left px-2.5 py-1.5 rounded-md text-[11px] flex items-center gap-1.5 transition-colors cursor-pointer ${
                  currentView === 'delivery_challans' ? 'text-rose-400 font-semibold bg-rose-500/10' : 'text-slate-400 hover:text-white'
                }`}
              >
                <Truck className="w-3 h-3 text-slate-400 shrink-0" />
                <span className="truncate">{t('nav.deliveryChallan')}</span>
              </button>
              {enableJobWork && (
                <button
                  type="button"
                  onClick={() => onNavigate('job_work')}
                  className={`w-full text-left px-2.5 py-1.5 rounded-md text-[11px] flex items-center gap-1.5 transition-colors cursor-pointer ${
                    currentView === 'job_work' ? 'text-rose-400 font-semibold bg-rose-500/10' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <Wrench className="w-3 h-3 text-indigo-400 shrink-0" />
                  <span className="truncate">{t('nav.jobWork')}</span>
                </button>
              )}
            </div>
          )}
        </div>

        {/* Purchase (Purchase Bill, Payment-Out, Expenses, Purchase Return/Debit Note) */}
        <div>
          <button
            type="button"
            onClick={() => {
              if (isCollapsed) {
                onNavigate('purchases');
              } else {
                setPurchaseOpen(!purchaseOpen);
              }
            }}
            title={t('nav.purchase')}
            className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
              currentView === 'purchases' ||
              currentView === 'payments_out' ||
              currentView === 'expenses' ||
              currentView === 'purchase_returns'
                ? 'bg-blue-600/15 text-blue-400 font-semibold'
                : 'text-slate-300 hover:bg-[#1f293a] hover:text-white'
            }`}
          >
            <div className="flex items-center gap-3 min-w-0">
              <ShoppingBag className="w-4 h-4 shrink-0" />
              {!isCollapsed && <span className="truncate">{t('nav.purchase')}</span>}
            </div>
            {!isCollapsed && (
              <span className="text-slate-500">
                {purchaseOpen ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
              </span>
            )}
          </button>

          {!isCollapsed && purchaseOpen && (
            <div className="ml-7 pl-2 border-l border-[#263345] my-1 space-y-1">
              <button
                type="button"
                onClick={() => onNavigate('purchases')}
                className={`w-full text-left px-2.5 py-1.5 rounded-md text-[11px] flex items-center gap-1.5 transition-colors cursor-pointer ${
                  currentView === 'purchases' ? 'text-blue-400 font-semibold bg-blue-500/10' : 'text-slate-400 hover:text-white'
                }`}
              >
                <FileText className="w-3 h-3 text-blue-400 shrink-0" />
                <span className="truncate">{t('nav.purchaseBill')}</span>
              </button>
              <button
                type="button"
                onClick={() => onNavigate('payments_out')}
                className={`w-full text-left px-2.5 py-1.5 rounded-md text-[11px] flex items-center gap-1.5 transition-colors cursor-pointer ${
                  currentView === 'payments_out' ? 'text-blue-400 font-semibold bg-blue-500/10' : 'text-slate-400 hover:text-white'
                }`}
              >
                <ArrowUpRight className="w-3 h-3 text-rose-400 shrink-0" />
                <span className="truncate">{t('nav.paymentOut')}</span>
              </button>
              <button
                type="button"
                onClick={() => onNavigate('expenses')}
                className={`w-full text-left px-2.5 py-1.5 rounded-md text-[11px] flex items-center gap-1.5 transition-colors cursor-pointer ${
                  currentView === 'expenses' ? 'text-blue-400 font-semibold bg-blue-500/10' : 'text-slate-400 hover:text-white'
                }`}
              >
                <Calculator className="w-3 h-3 text-amber-400 shrink-0" />
                <span className="truncate">{t('nav.expenses')}</span>
              </button>
              <button
                type="button"
                onClick={() => onNavigate('purchase_returns')}
                className={`w-full text-left px-2.5 py-1.5 rounded-md text-[11px] flex items-center gap-1.5 transition-colors cursor-pointer ${
                  currentView === 'purchase_returns' ? 'text-blue-400 font-semibold bg-blue-500/10' : 'text-slate-400 hover:text-white'
                }`}
              >
                <RotateCcw className="w-3 h-3 text-indigo-400 shrink-0" />
                <span className="truncate">{t('nav.purchaseReturn')}</span>
              </button>
            </div>
          )}
        </div>

        {/* Reports */}
        <button
          type="button"
          onClick={() => onNavigate('reports')}
          title={t('nav.reports')}
          className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
            currentView === 'reports'
              ? 'bg-rose-600/15 text-rose-400 font-semibold'
              : 'text-slate-300 hover:bg-[#1f293a] hover:text-white'
          }`}
        >
          <BarChart3 className="w-4 h-4 shrink-0" />
          {!isCollapsed && <span className="truncate">{t('nav.reports')}</span>}
        </button>

        {/* Sync, Share & Backup */}
        <button
          type="button"
          onClick={() => onNavigate('sync_backup')}
          title={t('nav.syncBackup')}
          className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
            currentView === 'sync_backup'
              ? 'bg-rose-600/15 text-rose-400 font-semibold'
              : 'text-slate-300 hover:bg-[#1f293a] hover:text-white'
          }`}
        >
          <Cloud className="w-4 h-4 shrink-0" />
          {!isCollapsed && <span className="truncate">{t('nav.syncBackup')}</span>}
        </button>

        {/* Settings */}
        <button
          type="button"
          onClick={() => onNavigate('settings')}
          title={t('nav.settings')}
          className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
            currentView === 'settings'
              ? 'bg-rose-600/15 text-rose-400 font-semibold'
              : 'text-slate-300 hover:bg-[#1f293a] hover:text-white'
          }`}
        >
          <Settings className="w-4 h-4 shrink-0" />
          {!isCollapsed && <span className="truncate">{t('nav.settings')}</span>}
        </button>
      </nav>

      {/* Multiple Firms Switcher + Offline Status Badge */}
      <div className="border-t border-[#222c3d] relative">
        {enableMultipleFirms && !isCollapsed && (
          <div className="p-2.5 border-b border-[#222c3d]">
            <button
              type="button"
              onClick={() => setFirmMenuOpen((prev) => !prev)}
              className="w-full flex items-center justify-between gap-2 px-2.5 py-2 rounded-lg bg-[#1c2433] hover:bg-[#232d40] border border-[#2b374d] text-left cursor-pointer transition-colors"
            >
              <div className="min-w-0">
                <div className="text-[9px] uppercase tracking-wider text-slate-400 font-semibold">Active Firm</div>
                <div className="text-xs font-bold text-white truncate">
                  {businessProfile?.businessName || 'Primary Firm'}
                </div>
              </div>
              <ArrowLeftRight className="w-3.5 h-3.5 text-rose-400 shrink-0" />
            </button>

            {firmMenuOpen && (
              <div className="absolute left-2.5 right-2.5 bottom-full mb-1.5 bg-[#1b2230] border border-[#2d394e] rounded-xl shadow-2xl p-1.5 z-50 space-y-1">
                <div className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Switch Business Firm
                </div>
                <div className="max-h-40 overflow-y-auto space-y-0.5">
                  {firmsList.map((f) => {
                    const isCurrent = f.id === activeFirmId;
                    return (
                      <button
                        key={f.id}
                        type="button"
                        onClick={() => {
                          setFirmMenuOpen(false);
                          if (!isCurrent && onSwitchFirm) onSwitchFirm(f.id);
                        }}
                        className={`w-full flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg text-xs text-left cursor-pointer transition-colors ${
                          isCurrent ? 'bg-rose-600/20 text-rose-300 font-bold' : 'text-slate-300 hover:bg-white/5'
                        }`}
                      >
                        <span className="truncate">{f.name}</span>
                        {isCurrent && <Check className="w-3.5 h-3.5 text-rose-400 shrink-0" />}
                      </button>
                    );
                  })}
                </div>
                {onOpenCreateFirm && (
                  <button
                    type="button"
                    onClick={() => {
                      setFirmMenuOpen(false);
                      onOpenCreateFirm();
                    }}
                    className="w-full flex items-center gap-1.5 px-2.5 py-1.5 mt-1 border-t border-[#2d394e] text-xs font-semibold text-emerald-400 hover:bg-white/5 rounded-lg cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add New Firm</span>
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        <div className="p-3 text-[11px] text-slate-400 flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
          {!isCollapsed && (
            <span className="truncate">{t('app.offlineReady')}</span>
          )}
        </div>
      </div>
    </aside>
  );
};
