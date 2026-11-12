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
} from 'lucide-react';
import { BusinessProfile } from '../../types';

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
  businessProfile: BusinessProfile | null;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentView,
  onNavigate,
  onOpenAddSale,
  onOpenAddPurchase,
  onOpenBusinessProfile,
  businessProfile,
  isCollapsed,
  onToggleCollapse,
}) => {
  const [partiesOpen, setPartiesOpen] = useState(
    currentView === 'parties' || currentView === 'whatsapp_connect'
  );
  const [saleOpen, setSaleOpen] = useState(
    currentView === 'sales' ||
      currentView === 'estimates' ||
      currentView === 'payments_in' ||
      currentView === 'sale_returns' ||
      currentView === 'delivery_challans'
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
                {businessProfile?.gstin ? `GST: ${businessProfile.gstin.substring(0, 8)}...` : 'GST Billing'}
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
          {!isCollapsed && <span className="whitespace-nowrap">Add Sale</span>}
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
          {!isCollapsed && <span className="whitespace-nowrap">Add Purchase</span>}
        </button>
      </div>

      {/* Navigation Links */}
      <nav className="flex-1 overflow-y-auto p-2 space-y-1">
        {/* Home */}
        <button
          type="button"
          onClick={() => onNavigate('home')}
          title="Home Dashboard"
          className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
            currentView === 'home'
              ? 'bg-rose-600/15 text-rose-400 font-semibold'
              : 'text-slate-300 hover:bg-[#1f293a] hover:text-white'
          }`}
        >
          <Home className="w-4 h-4 shrink-0" />
          {!isCollapsed && <span>Home</span>}
        </button>

        {/* Parties (with sub-items: Party Details, WhatsApp Connect) */}
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
            title="Parties & Contacts"
            className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
              currentView === 'parties' || currentView === 'whatsapp_connect'
                ? 'bg-rose-600/15 text-rose-400 font-semibold'
                : 'text-slate-300 hover:bg-[#1f293a] hover:text-white'
            }`}
          >
            <div className="flex items-center gap-3">
              <Users className="w-4 h-4 shrink-0" />
              {!isCollapsed && <span>Parties</span>}
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
                Party Details
              </button>
              <button
                type="button"
                onClick={() => onNavigate('whatsapp_connect')}
                className={`w-full text-left px-2.5 py-1.5 rounded-md text-[11px] flex items-center gap-1.5 transition-colors cursor-pointer ${
                  currentView === 'whatsapp_connect' ? 'text-rose-400 font-semibold' : 'text-slate-400 hover:text-white'
                }`}
              >
                <MessageSquare className="w-3 h-3 text-emerald-500" />
                <span>WhatsApp Connect</span>
              </button>
            </div>
          )}
        </div>

        {/* Items */}
        <button
          type="button"
          onClick={() => onNavigate('items')}
          title="Items & Inventory"
          className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
            currentView === 'items'
              ? 'bg-rose-600/15 text-rose-400 font-semibold'
              : 'text-slate-300 hover:bg-[#1f293a] hover:text-white'
          }`}
        >
          <Package className="w-4 h-4 shrink-0" />
          {!isCollapsed && <span>Items</span>}
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
            title="Sales"
            className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
              currentView === 'sales' ||
              currentView === 'estimates' ||
              currentView === 'payments_in' ||
              currentView === 'sale_returns' ||
              currentView === 'delivery_challans'
                ? 'bg-rose-600/15 text-rose-400 font-semibold'
                : 'text-slate-300 hover:bg-[#1f293a] hover:text-white'
            }`}
          >
            <div className="flex items-center gap-3">
              <TrendingUp className="w-4 h-4 shrink-0" />
              {!isCollapsed && <span>Sale</span>}
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
                <FileText className="w-3 h-3 text-rose-400" />
                <span>Sale Invoice</span>
              </button>
              <button
                type="button"
                onClick={() => onNavigate('estimates')}
                className={`w-full text-left px-2.5 py-1.5 rounded-md text-[11px] flex items-center gap-1.5 transition-colors cursor-pointer ${
                  currentView === 'estimates' ? 'text-rose-400 font-semibold bg-rose-500/10' : 'text-slate-400 hover:text-white'
                }`}
              >
                <Receipt className="w-3 h-3 text-amber-400" />
                <span>Estimate/Quotation</span>
              </button>
              <button
                type="button"
                onClick={() => onNavigate('payments_in')}
                className={`w-full text-left px-2.5 py-1.5 rounded-md text-[11px] flex items-center gap-1.5 transition-colors cursor-pointer ${
                  currentView === 'payments_in' ? 'text-rose-400 font-semibold bg-rose-500/10' : 'text-slate-400 hover:text-white'
                }`}
              >
                <ArrowDownLeft className="w-3 h-3 text-emerald-400" />
                <span>Payment-In</span>
              </button>
              <button
                type="button"
                onClick={() => onNavigate('sale_returns')}
                className={`w-full text-left px-2.5 py-1.5 rounded-md text-[11px] flex items-center gap-1.5 transition-colors cursor-pointer ${
                  currentView === 'sale_returns' ? 'text-rose-400 font-semibold bg-rose-500/10' : 'text-slate-400 hover:text-white'
                }`}
              >
                <RotateCcw className="w-3 h-3 text-amber-500" />
                <span>Sale Return / Cr Note</span>
              </button>
              <button
                type="button"
                onClick={() => onNavigate('delivery_challans')}
                className={`w-full text-left px-2.5 py-1.5 rounded-md text-[11px] flex items-center gap-1.5 transition-colors cursor-pointer ${
                  currentView === 'delivery_challans' ? 'text-rose-400 font-semibold bg-rose-500/10' : 'text-slate-400 hover:text-white'
                }`}
              >
                <Truck className="w-3 h-3 text-slate-400" />
                <span>Delivery Challan</span>
              </button>
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
            title="Purchases"
            className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
              currentView === 'purchases' ||
              currentView === 'payments_out' ||
              currentView === 'expenses' ||
              currentView === 'purchase_returns'
                ? 'bg-blue-600/15 text-blue-400 font-semibold'
                : 'text-slate-300 hover:bg-[#1f293a] hover:text-white'
            }`}
          >
            <div className="flex items-center gap-3">
              <ShoppingBag className="w-4 h-4 shrink-0" />
              {!isCollapsed && <span>Purchase</span>}
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
                <FileText className="w-3 h-3 text-blue-400" />
                <span>Purchase Bill</span>
              </button>
              <button
                type="button"
                onClick={() => onNavigate('payments_out')}
                className={`w-full text-left px-2.5 py-1.5 rounded-md text-[11px] flex items-center gap-1.5 transition-colors cursor-pointer ${
                  currentView === 'payments_out' ? 'text-blue-400 font-semibold bg-blue-500/10' : 'text-slate-400 hover:text-white'
                }`}
              >
                <ArrowUpRight className="w-3 h-3 text-rose-400" />
                <span>Payment-Out</span>
              </button>
              <button
                type="button"
                onClick={() => onNavigate('expenses')}
                className={`w-full text-left px-2.5 py-1.5 rounded-md text-[11px] flex items-center gap-1.5 transition-colors cursor-pointer ${
                  currentView === 'expenses' ? 'text-blue-400 font-semibold bg-blue-500/10' : 'text-slate-400 hover:text-white'
                }`}
              >
                <Calculator className="w-3 h-3 text-amber-400" />
                <span>Expenses</span>
              </button>
              <button
                type="button"
                onClick={() => onNavigate('purchase_returns')}
                className={`w-full text-left px-2.5 py-1.5 rounded-md text-[11px] flex items-center gap-1.5 transition-colors cursor-pointer ${
                  currentView === 'purchase_returns' ? 'text-blue-400 font-semibold bg-blue-500/10' : 'text-slate-400 hover:text-white'
                }`}
              >
                <RotateCcw className="w-3 h-3 text-indigo-400" />
                <span>Purchase Return / Dr Note</span>
              </button>
            </div>
          )}
        </div>

        {/* Reports */}
        <button
          type="button"
          onClick={() => onNavigate('reports')}
          title="Financial Reports"
          className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
            currentView === 'reports'
              ? 'bg-rose-600/15 text-rose-400 font-semibold'
              : 'text-slate-300 hover:bg-[#1f293a] hover:text-white'
          }`}
        >
          <BarChart3 className="w-4 h-4 shrink-0" />
          {!isCollapsed && <span>Reports</span>}
        </button>

        {/* Sync, Share & Backup */}
        <button
          type="button"
          onClick={() => onNavigate('sync_backup')}
          title="Backup and Sync"
          className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
            currentView === 'sync_backup'
              ? 'bg-rose-600/15 text-rose-400 font-semibold'
              : 'text-slate-300 hover:bg-[#1f293a] hover:text-white'
          }`}
        >
          <Cloud className="w-4 h-4 shrink-0" />
          {!isCollapsed && <span>Sync, Share & Backup</span>}
        </button>

        {/* Settings */}
        <button
          type="button"
          onClick={() => onNavigate('settings')}
          title="Settings"
          className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
            currentView === 'settings'
              ? 'bg-rose-600/15 text-rose-400 font-semibold'
              : 'text-slate-300 hover:bg-[#1f293a] hover:text-white'
          }`}
        >
          <Settings className="w-4 h-4 shrink-0" />
          {!isCollapsed && <span>Settings</span>}
        </button>
      </nav>

      {/* Offline Status Badge */}
      <div className="p-3 border-t border-[#222c3d] text-[11px] text-slate-400 flex items-center gap-2">
        <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
        {!isCollapsed && (
          <span className="truncate">IndexedDB Offline Ready</span>
        )}
      </div>
    </aside>
  );
};
