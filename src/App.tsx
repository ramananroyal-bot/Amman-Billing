import React, { useState, useEffect, useCallback } from 'react';
import { BusinessProfile, DashboardMetrics, FilterPeriod, Party, Transaction, Expense } from './types';
import {
  getBusinessProfile,
  getDashboardMetrics,
  getParty,
  cancelTransaction,
  deleteTransaction,
} from './db/indexedDB';
import { formatINR, formatDate } from './utils/formatters';
import { SetupScreen } from './components/setup/SetupScreen';
import { Sidebar, NavView } from './components/layout/Sidebar';
import { TopBar } from './components/layout/TopBar';
import { HomeView } from './components/home/HomeView';
import { PartiesView } from './components/parties/PartiesView';
import { ItemsView } from './components/items/ItemsView';
import { SalesView } from './components/sales/SalesView';
import { DeliveryChallansView } from './components/challans/DeliveryChallansView';
import { PurchasesView } from './components/purchases/PurchasesView';
import { PaymentsView } from './components/payments/PaymentsView';
import { PaymentRecordModal } from './components/payments/PaymentRecordModal';
import { ReturnsView } from './components/returns/ReturnsView';
import { ReturnModal } from './components/modals/ReturnModal';
import { ExpensesView } from './components/expenses/ExpensesView';
import { ExpenseModal } from './components/expenses/ExpenseModal';
import { BusinessProfileModal } from './components/setup/BusinessProfileModal';
import { AddSaleModal } from './components/modals/AddSaleModal';
import { AddPurchaseModal } from './components/modals/AddPurchaseModal';
import { InvoicePrintModal } from './components/modals/InvoicePrintModal';
import { GlobalSearchModal } from './components/modals/GlobalSearchModal';
import { ReportsView, ReportType } from './components/reports/ReportsView';
import { SyncBackupView } from './components/sync/SyncBackupView';
import { SettingsView } from './components/settings/SettingsView';
import { ConfirmDeleteModal } from './components/common/ConfirmDeleteModal';
import { useToast } from './components/common/Toast';
import { SettingsModal } from './components/modals/SettingsModal';
import { ShortcutsModal } from './components/modals/ShortcutsModal';
import { DesktopAppModal } from './components/modals/DesktopAppModal';

export default function App() {
  const [isLoading, setIsLoading] = useState(true);
  const [businessProfile, setBusinessProfile] = useState<BusinessProfile | null>(null);
  const [currentView, setCurrentView] = useState<NavView>('home');
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  // Home metrics & period filter
  const [selectedPeriod, setSelectedPeriod] = useState<FilterPeriod>('this_month');
  const [metrics, setMetrics] = useState<DashboardMetrics>({
    totalReceivable: 0,
    totalPayable: 0,
    totalSale: 0,
    totalPurchase: 0,
    totalExpenses: 0,
    netProfit: null,
    lastMonthSale: 0,
    saleChangePercent: null,
    saleCount: 0,
    period: 'this_month',
    salesByDay: [],
    recentTransactions: [],
  });

  // Modals state
  const [showAddSale, setShowAddSale] = useState(false);
  const [showAddPurchase, setShowAddPurchase] = useState(false);
  const [selectedPartyForSale, setSelectedPartyForSale] = useState<string | undefined>(undefined);
  const [selectedTxForEdit, setSelectedTxForEdit] = useState<Transaction | null>(null);
  const [selectedPurchaseForEdit, setSelectedPurchaseForEdit] = useState<Transaction | null>(null);

  // Payment In / Out Modal state
  const [showPaymentRecordModal, setShowPaymentRecordModal] = useState(false);
  const [paymentRecordMode, setPaymentRecordMode] = useState<'payment_in' | 'payment_out'>('payment_in');
  const [paymentParty, setPaymentParty] = useState<Party | null>(null);
  const [paymentTargetInvoice, setPaymentTargetInvoice] = useState<Transaction | null>(null);
  const [paymentToEdit, setPaymentToEdit] = useState<Transaction | null>(null);

  // Return Modal state (Credit Note / Debit Note)
  const [showReturnModal, setShowReturnModal] = useState(false);
  const [returnModalMode, setReturnModalMode] = useState<'sale_return' | 'purchase_return'>('sale_return');
  const [sourceTxForReturn, setSourceTxForReturn] = useState<Transaction | null>(null);
  const [returnToEdit, setReturnToEdit] = useState<Transaction | null>(null);

  // Expense Modal state
  const [showExpenseModal, setShowExpenseModal] = useState(false);
  const [expenseToEdit, setExpenseToEdit] = useState<Expense | null>(null);
  const [showBusinessProfileModal, setShowBusinessProfileModal] = useState(false);
  const [showInvoicePrint, setShowInvoicePrint] = useState(false);
  const [selectedTxForPrint, setSelectedTxForPrint] = useState<Transaction | null>(null);
  const { showToast } = useToast();
  const [showGlobalSearch, setShowGlobalSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeReportType, setActiveReportType] = useState<ReportType>('sale_report');
  const [txToDelete, setTxToDelete] = useState<Transaction | null>(null);
  const [txToCancel, setTxToCancel] = useState<Transaction | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isCanceling, setIsCanceling] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [showDesktopModal, setShowDesktopModal] = useState(false);
  const [initialSaleType, setInitialSaleType] = useState<'sale_invoice' | 'delivery_challan'>('sale_invoice');
  const [dbError, setDbError] = useState<string | null>(null);

  // Refresh metrics from IndexedDB
  const refreshMetrics = useCallback(async (period: FilterPeriod = selectedPeriod) => {
    try {
      const data = await getDashboardMetrics(period);
      setMetrics(data);
    } catch (e) {
      console.error('Error fetching dashboard metrics', e);
    }
  }, [selectedPeriod]);

  // Initial load - runs strictly once on mount with 5-second timeout safety
  useEffect(() => {
    let isMounted = true;

    async function init() {
      try {
        const timeoutPromise = new Promise<never>((_, reject) => {
          setTimeout(() => {
            reject(new Error('Database startup timed out after 5 seconds'));
          }, 5000);
        });

        const profile = await Promise.race([getBusinessProfile(), timeoutPromise]);
        if (!isMounted) return;

        setBusinessProfile(profile);
        if (profile) {
          const data = await getDashboardMetrics(selectedPeriod);
          if (isMounted) setMetrics(data);
        }
      } catch (err: any) {
        console.error('Failed to initialize database:', err);
        if (isMounted) {
          setDbError(err?.message || 'Local storage is unavailable in this preview.');
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    init();

    return () => {
      isMounted = false;
    };
  }, []); // Run profile load once on mount

  // Period change handler: refresh metrics only
  const handlePeriodChange = async (period: FilterPeriod) => {
    setSelectedPeriod(period);
    await refreshMetrics(period);
  };

  // Setup completion handler
  const handleSetupComplete = async (profile: BusinessProfile) => {
    setBusinessProfile(profile);
    await refreshMetrics(selectedPeriod);
  };

  // Transaction view & actions
  const handleViewTransaction = (tx: Transaction) => {
    setSelectedTxForPrint(tx);
    setShowInvoicePrint(true);
  };

  const handleCancelTransaction = (tx: Transaction) => {
    setTxToCancel(tx);
  };

  const handleDeleteTransaction = (tx: Transaction) => {
    setTxToDelete(tx);
  };

  const confirmCancelTransaction = async () => {
    if (!txToCancel) return;
    try {
      setIsCanceling(true);
      await cancelTransaction(txToCancel.id);
      await refreshMetrics(selectedPeriod);
      showToast(`Invoice ${txToCancel.invoiceNo} cancelled and stock restored`, 'info');
      setTxToCancel(null);
    } catch (err: any) {
      showToast(err?.message || 'Failed to cancel invoice', 'error');
    } finally {
      setIsCanceling(false);
    }
  };

  const confirmDeleteTransaction = async () => {
    if (!txToDelete) return;
    try {
      setIsDeleting(true);
      await deleteTransaction(txToDelete.id);
      await refreshMetrics(selectedPeriod);
      showToast(`Transaction ${txToDelete.invoiceNo} permanently deleted`, 'success');
      setTxToDelete(null);
    } catch (err: any) {
      showToast(err?.message || 'Failed to delete transaction', 'error');
    } finally {
      setIsDeleting(false);
    }
  };

  // Comprehensive Desktop Keyboard shortcuts
  useEffect(() => {
    // Request storage persistence for offline reliability
    if (navigator.storage && navigator.storage.persist) {
      navigator.storage.persist().catch(() => {});
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      const isInput = ['INPUT', 'TEXTAREA', 'SELECT'].includes((e.target as HTMLElement).tagName);

      // F1 or '?' -> Shortcuts Cheat Sheet
      if (e.key === 'F1' || (!isInput && e.key === '?')) {
        e.preventDefault();
        setShowShortcuts((prev) => !prev);
        return;
      }

      // Alt + S or F4 -> Add Sale Invoice
      if (e.key === 'F4' || (e.altKey && (e.key === 's' || e.key === 'S'))) {
        e.preventDefault();
        setSelectedPartyForSale(undefined);
        setSelectedTxForEdit(null);
        setInitialSaleType('sale_invoice');
        setShowAddSale(true);
        return;
      }

      // Alt + P or F5 -> Add Purchase Bill
      if (e.key === 'F5' || (e.altKey && (e.key === 'p' || e.key === 'P'))) {
        e.preventDefault();
        setSelectedPurchaseForEdit(null);
        setShowAddPurchase(true);
        return;
      }

      // Alt + C -> Add Delivery Challan
      if (e.altKey && (e.key === 'c' || e.key === 'C')) {
        e.preventDefault();
        setSelectedPartyForSale(undefined);
        setSelectedTxForEdit(null);
        setInitialSaleType('delivery_challan');
        setShowAddSale(true);
        return;
      }

      // '/' or Ctrl + K -> Search
      if ((!isInput && e.key === '/') || ((e.ctrlKey || e.metaKey) && (e.key === 'k' || e.key === 'K'))) {
        e.preventDefault();
        setShowGlobalSearch(true);
        return;
      }

      // Module navigation hotkeys (Alt + H, Alt + 1..8)
      if (e.altKey && (e.key === 'h' || e.key === 'H')) {
        e.preventDefault();
        setCurrentView('home');
      } else if (e.altKey && e.key === '1') {
        e.preventDefault();
        setCurrentView('parties');
      } else if (e.altKey && e.key === '2') {
        e.preventDefault();
        setCurrentView('items');
      } else if (e.altKey && e.key === '3') {
        e.preventDefault();
        setCurrentView('sales');
      } else if (e.altKey && e.key === '4') {
        e.preventDefault();
        setCurrentView('delivery_challans');
      } else if (e.altKey && e.key === '5') {
        e.preventDefault();
        setCurrentView('purchases');
      } else if (e.altKey && e.key === '6') {
        e.preventDefault();
        setCurrentView('reports');
      } else if (e.altKey && e.key === '7') {
        e.preventDefault();
        setCurrentView('sync_backup');
      } else if (e.altKey && e.key === '8') {
        e.preventDefault();
        setCurrentView('settings');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Electron Desktop Native Menu IPC Listeners
  useEffect(() => {
    if (!window.electronAPI) return;
    const cleanups: (() => void)[] = [];

    cleanups.push(
      window.electronAPI.onMenuNewSale(() => {
        setSelectedPartyForSale(undefined);
        setSelectedTxForEdit(null);
        setInitialSaleType('sale_invoice');
        setShowAddSale(true);
      })
    );

    cleanups.push(
      window.electronAPI.onMenuNewPurchase(() => {
        setSelectedPurchaseForEdit(null);
        setShowAddPurchase(true);
      })
    );

    cleanups.push(
      window.electronAPI.onMenuNewChallan(() => {
        setSelectedPartyForSale(undefined);
        setSelectedTxForEdit(null);
        setInitialSaleType('delivery_challan');
        setShowAddSale(true);
      })
    );

    cleanups.push(
      window.electronAPI.onMenuNavigate((view) => {
        if (view) setCurrentView(view as NavView);
      })
    );

    cleanups.push(
      window.electronAPI.onMenuSearch(() => {
        setShowGlobalSearch(true);
      })
    );

    cleanups.push(
      window.electronAPI.onMenuShortcuts(() => {
        setShowShortcuts(true);
      })
    );

    return () => {
      cleanups.forEach((cleanup) => cleanup());
    };
  }, []);

  // View titles
  const viewTitles: Record<NavView, string> = {
    home: 'Home Dashboard',
    parties: 'Parties',
    whatsapp_connect: 'Parties · WhatsApp Connect',
    items: 'Items & Inventory',
    sales: 'Sale Invoices',
    estimates: 'Estimates & Quotations',
    payments_in: 'Payment-In Receipts',
    sale_returns: 'Sale Returns · Credit Notes',
    delivery_challans: 'Delivery Challans',
    purchases: 'Purchase Bills',
    payments_out: 'Payment-Out Vouchers',
    expenses: 'Operating Expenses',
    purchase_returns: 'Purchase Returns · Debit Notes',
    reports: 'Reports',
    sync_backup: 'Sync, Share & Backup',
    settings: 'Settings',
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="text-center text-white space-y-2">
          <div className="w-8 h-8 border-2 border-rose-500 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-xs text-slate-400 font-mono">Loading GST Billing Database...</p>
        </div>
      </div>
    );
  }

  // Database error or blocked in preview iframe
  if (dbError) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
        <div className="w-full max-w-md bg-slate-800 border border-slate-700 rounded-xl p-6 text-center text-white space-y-4 shadow-2xl">
          <div className="w-12 h-12 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center mx-auto text-xl font-bold">
            !
          </div>
          <h2 className="text-base font-bold text-white">Storage Unavailable</h2>
          <p className="text-xs text-slate-300 leading-relaxed">
            Local storage is unavailable in this preview. Open the app in a new tab.
          </p>
          <div className="pt-2">
            <button
              type="button"
              onClick={() => window.open(window.location.href, '_blank')}
              className="px-5 py-2.5 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 rounded-lg shadow-sm transition-colors cursor-pointer"
            >
              Open in New Tab
            </button>
          </div>
        </div>
      </div>
    );
  }

  // First launch setup screen if no business profile exists
  if (!businessProfile) {
    return <SetupScreen onComplete={handleSetupComplete} />;
  }

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-slate-50 font-sans antialiased">
      {/* Sidebar (Collapsible, dark theme) */}
      <Sidebar
        currentView={currentView}
        onNavigate={(view) => {
          if (view === 'sync_backup') {
            setCurrentView('sync_backup');
          } else if (view === 'settings') {
            setCurrentView('settings');
          } else if (view === 'reports') {
            setCurrentView('reports');
          } else if (view === 'whatsapp_connect') {
            setCurrentView('parties');
          } else {
            setCurrentView(view);
          }
        }}
        onOpenAddSale={() => {
          setSelectedPartyForSale(undefined);
          setSelectedTxForEdit(null);
          setShowAddSale(true);
        }}
        onOpenAddPurchase={() => {
          setSelectedPurchaseForEdit(null);
          setShowAddPurchase(true);
        }}
        onOpenBusinessProfile={() => setShowBusinessProfileModal(true)}
        businessProfile={businessProfile}
        isCollapsed={isSidebarCollapsed}
        onToggleCollapse={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
      />

      {/* Main View Area */}
      <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
        {/* Top Bar */}
        <TopBar
          businessProfile={businessProfile}
          onOpenAddSale={() => {
            setSelectedPartyForSale(undefined);
            setSelectedTxForEdit(null);
            setShowAddSale(true);
          }}
          onOpenAddPurchase={() => {
            setSelectedPurchaseForEdit(null);
            setShowAddPurchase(true);
          }}
          onOpenBusinessProfile={() => setShowBusinessProfileModal(true)}
          onOpenSettings={() => setCurrentView('settings')}
          onOpenShortcuts={() => setShowShortcuts(true)}
          onOpenDesktopApp={() => setShowDesktopModal(true)}
          onSearchClick={() => setShowGlobalSearch(true)}
          searchQuery={searchQuery}
          onSearchChange={(q) => {
            setSearchQuery(q);
            setShowGlobalSearch(true);
          }}
          activeViewTitle={viewTitles[currentView]}
        />

        {/* Viewport content */}
        <main className="flex-1 overflow-hidden">
          {currentView === 'home' && (
            <div className="h-full overflow-y-auto">
              <HomeView
                metrics={metrics}
                selectedPeriod={selectedPeriod}
                onPeriodChange={handlePeriodChange}
                onOpenAddSale={() => {
                  setSelectedPartyForSale(undefined);
                  setSelectedTxForEdit(null);
                  setShowAddSale(true);
                }}
                onOpenAddPurchase={() => {
                  setSelectedPurchaseForEdit(null);
                  setShowAddPurchase(true);
                }}
                onViewTransaction={handleViewTransaction}
                onCancelTransaction={handleCancelTransaction}
                onDeleteTransaction={handleDeleteTransaction}
                onOpenReport={(rep) => {
                  setActiveReportType(rep as ReportType);
                  setCurrentView('reports');
                }}
              />
            </div>
          )}

          {currentView === 'parties' && (
            <PartiesView
              businessProfile={businessProfile}
              onOpenAddSaleForParty={(party) => {
                setSelectedPartyForSale(party.id);
                setSelectedTxForEdit(null);
                setShowAddSale(true);
              }}
              onOpenAddPurchaseForParty={() => {
                setSelectedPurchaseForEdit(null);
                setShowAddPurchase(true);
              }}
              onViewTransaction={handleViewTransaction}
              onEditSale={(tx) => {
                setSelectedTxForEdit(tx);
                setShowAddSale(true);
              }}
              onEditPurchase={(tx) => {
                setSelectedPurchaseForEdit(tx);
                setShowAddPurchase(true);
              }}
              onRefreshMetrics={() => refreshMetrics(selectedPeriod)}
            />
          )}

          {currentView === 'items' && (
            <ItemsView
              onViewTransaction={handleViewTransaction}
              onRefreshMetrics={() => refreshMetrics(selectedPeriod)}
            />
          )}

          {(currentView === 'sales' || currentView === 'estimates') && (
            <SalesView
              businessProfile={businessProfile}
              onOpenAddSale={() => {
                setSelectedPartyForSale(undefined);
                setSelectedTxForEdit(null);
                setShowAddSale(true);
              }}
              onEditSale={(tx) => {
                setSelectedTxForEdit(tx);
                setShowAddSale(true);
              }}
              onViewInvoice={handleViewTransaction}
              onReceivePayment={async (tx) => {
                let p: Party | null = null;
                if (tx.partyId) {
                  p = await getParty(tx.partyId);
                }
                setPaymentParty(p);
                setPaymentTargetInvoice(tx);
                setPaymentToEdit(null);
                setPaymentRecordMode('payment_in');
                setShowPaymentRecordModal(true);
              }}
              onConvertToReturn={(tx) => {
                setSourceTxForReturn(tx);
                setReturnToEdit(null);
                setReturnModalMode('sale_return');
                setShowReturnModal(true);
              }}
              onRefreshMetrics={() => refreshMetrics(selectedPeriod)}
            />
          )}

          {currentView === 'payments_in' && (
            <PaymentsView
              mode="payment_in"
              onOpenRecordPayment={(party, tx) => {
                setPaymentParty(party || null);
                setPaymentTargetInvoice(tx || null);
                setPaymentToEdit(null);
                setPaymentRecordMode('payment_in');
                setShowPaymentRecordModal(true);
              }}
              onEditPayment={(tx) => {
                setPaymentToEdit(tx);
                setPaymentRecordMode('payment_in');
                setShowPaymentRecordModal(true);
              }}
              onViewPayment={handleViewTransaction}
              onRefreshMetrics={() => refreshMetrics(selectedPeriod)}
            />
          )}

          {currentView === 'sale_returns' && (
            <ReturnsView
              mode="sale_return"
              businessProfile={businessProfile}
              onOpenCreateReturn={() => {
                setSourceTxForReturn(null);
                setReturnToEdit(null);
                setReturnModalMode('sale_return');
                setShowReturnModal(true);
              }}
              onEditReturn={(tx) => {
                setReturnToEdit(tx);
                setSourceTxForReturn(null);
                setReturnModalMode('sale_return');
                setShowReturnModal(true);
              }}
              onViewReturn={handleViewTransaction}
              onRefreshMetrics={() => refreshMetrics(selectedPeriod)}
            />
          )}

          {currentView === 'delivery_challans' && (
            <DeliveryChallansView
              businessProfile={businessProfile}
              onNavigateToSales={() => setCurrentView('sales')}
              onViewChallanPrint={handleViewTransaction}
              onRefreshMetrics={() => refreshMetrics(selectedPeriod)}
            />
          )}

          {currentView === 'purchases' && (
            <PurchasesView
              businessProfile={businessProfile}
              onOpenAddPurchase={() => {
                setSelectedPurchaseForEdit(null);
                setShowAddPurchase(true);
              }}
              onEditPurchase={(tx) => {
                setSelectedPurchaseForEdit(tx);
                setShowAddPurchase(true);
              }}
              onViewBill={handleViewTransaction}
              onMakePayment={async (tx) => {
                let p: Party | null = null;
                if (tx.partyId) {
                  p = await getParty(tx.partyId);
                }
                setPaymentParty(p);
                setPaymentTargetInvoice(tx);
                setPaymentToEdit(null);
                setPaymentRecordMode('payment_out');
                setShowPaymentRecordModal(true);
              }}
              onConvertToReturn={(tx) => {
                setSourceTxForReturn(tx);
                setReturnToEdit(null);
                setReturnModalMode('purchase_return');
                setShowReturnModal(true);
              }}
              onRefreshMetrics={() => refreshMetrics(selectedPeriod)}
            />
          )}

          {currentView === 'payments_out' && (
            <PaymentsView
              mode="payment_out"
              onOpenRecordPayment={(party, tx) => {
                setPaymentParty(party || null);
                setPaymentTargetInvoice(tx || null);
                setPaymentToEdit(null);
                setPaymentRecordMode('payment_out');
                setShowPaymentRecordModal(true);
              }}
              onEditPayment={(tx) => {
                setPaymentToEdit(tx);
                setPaymentRecordMode('payment_out');
                setShowPaymentRecordModal(true);
              }}
              onViewPayment={handleViewTransaction}
              onRefreshMetrics={() => refreshMetrics(selectedPeriod)}
            />
          )}

          {currentView === 'expenses' && (
            <ExpensesView
              onOpenAddExpense={() => {
                setExpenseToEdit(null);
                setShowExpenseModal(true);
              }}
              onEditExpense={(exp) => {
                setExpenseToEdit(exp);
                setShowExpenseModal(true);
              }}
              onRefreshMetrics={() => refreshMetrics(selectedPeriod)}
            />
          )}

          {currentView === 'purchase_returns' && (
            <ReturnsView
              mode="purchase_return"
              businessProfile={businessProfile}
              onOpenCreateReturn={() => {
                setSourceTxForReturn(null);
                setReturnToEdit(null);
                setReturnModalMode('purchase_return');
                setShowReturnModal(true);
              }}
              onEditReturn={(tx) => {
                setReturnToEdit(tx);
                setSourceTxForReturn(null);
                setReturnModalMode('purchase_return');
                setShowReturnModal(true);
              }}
              onViewReturn={handleViewTransaction}
              onRefreshMetrics={() => refreshMetrics(selectedPeriod)}
            />
          )}

          {currentView === 'reports' && (
            <ReportsView
              businessProfile={businessProfile}
              initialReportType={activeReportType}
              onViewTransaction={handleViewTransaction}
            />
          )}

          {currentView === 'sync_backup' && (
            <SyncBackupView
              businessProfile={businessProfile}
              onDataRestored={async () => {
                const profile = await getBusinessProfile();
                setBusinessProfile(profile);
                await refreshMetrics(selectedPeriod);
              }}
              onFactoryReset={async () => {
                setBusinessProfile(null);
                setCurrentView('home');
              }}
            />
          )}

          {currentView === 'settings' && (
            <SettingsView
              businessProfile={businessProfile}
              onProfileUpdated={(updated) => setBusinessProfile(updated)}
            />
          )}
        </main>
      </div>

      {/* Modals */}
      {/* 1. Add Sale Invoice Modal */}
      <AddSaleModal
        isOpen={showAddSale}
        onClose={() => {
          setShowAddSale(false);
          setSelectedPartyForSale(undefined);
          setSelectedTxForEdit(null);
          setInitialSaleType('sale_invoice');
        }}
        businessProfile={businessProfile}
        initialType={initialSaleType}
        initialPartyId={selectedPartyForSale}
        transactionToEdit={selectedTxForEdit}
        onSaved={async () => {
          await refreshMetrics(selectedPeriod);
        }}
      />

      {/* 2. Add Purchase Bill Modal */}
      <AddPurchaseModal
        isOpen={showAddPurchase}
        onClose={() => {
          setShowAddPurchase(false);
          setSelectedPurchaseForEdit(null);
        }}
        businessProfile={businessProfile}
        transactionToEdit={selectedPurchaseForEdit}
        onSaved={async () => {
          await refreshMetrics(selectedPeriod);
        }}
      />

      {/* 3. Payment Record Modal (Payment-In & Payment-Out) */}
      <PaymentRecordModal
        isOpen={showPaymentRecordModal}
        onClose={() => {
          setShowPaymentRecordModal(false);
          setPaymentParty(null);
          setPaymentTargetInvoice(null);
          setPaymentToEdit(null);
        }}
        defaultType={paymentRecordMode}
        initialParty={paymentParty}
        targetTransaction={paymentTargetInvoice}
        paymentToEdit={paymentToEdit}
        onSaved={async () => {
          await refreshMetrics(selectedPeriod);
        }}
      />

      {/* 4. Sale Return / Purchase Return Modal (Credit & Debit Notes) */}
      <ReturnModal
        isOpen={showReturnModal}
        onClose={() => {
          setShowReturnModal(false);
          setSourceTxForReturn(null);
          setReturnToEdit(null);
        }}
        mode={returnModalMode}
        sourceTransaction={sourceTxForReturn}
        returnToEdit={returnToEdit}
        businessProfile={businessProfile}
        onSaved={async () => {
          await refreshMetrics(selectedPeriod);
        }}
      />

      {/* 5. Business Expenses Modal */}
      <ExpenseModal
        isOpen={showExpenseModal}
        onClose={() => {
          setShowExpenseModal(false);
          setExpenseToEdit(null);
        }}
        expenseToEdit={expenseToEdit}
        onSaved={async () => {
          await refreshMetrics(selectedPeriod);
        }}
      />

      {/* 3. A4 GST Invoice Print & Preview Modal */}
      <InvoicePrintModal
        isOpen={showInvoicePrint}
        onClose={() => {
          setShowInvoicePrint(false);
          setSelectedTxForPrint(null);
        }}
        transaction={selectedTxForPrint}
        businessProfile={businessProfile}
      />

      {/* 4. Edit Business Profile Modal */}
      {businessProfile && (
        <BusinessProfileModal
          isOpen={showBusinessProfileModal}
          onClose={() => setShowBusinessProfileModal(false)}
          profile={businessProfile}
          onUpdate={(updated) => setBusinessProfile(updated)}
        />
      )}

      {/* 5. Global Search Transactions Modal */}
      <GlobalSearchModal
        isOpen={showGlobalSearch}
        onClose={() => {
          setShowGlobalSearch(false);
          setSearchQuery('');
        }}
        initialQuery={searchQuery}
        onSelectTransaction={(tx) => handleViewTransaction(tx)}
      />

      {/* Confirm Delete Modal */}
      <ConfirmDeleteModal
        isOpen={!!txToDelete}
        onClose={() => setTxToDelete(null)}
        onConfirm={confirmDeleteTransaction}
        title="Delete Transaction"
        message={
          txToDelete
            ? `Delete ${txToDelete.type === 'purchase_bill' ? 'purchase bill' : 'invoice'} ${txToDelete.invoiceNo}? This cannot be undone.`
            : 'Delete this transaction? This cannot be undone.'
        }
        details={
          txToDelete
            ? `Amount: ${formatINR(txToDelete.totalAmount)} | Party: ${txToDelete.partyName} | Date: ${formatDate(txToDelete.date)}`
            : undefined
        }
        confirmButtonText="Delete"
        isLoading={isDeleting}
      />

      {/* Confirm Cancel Modal */}
      <ConfirmDeleteModal
        isOpen={!!txToCancel}
        onClose={() => setTxToCancel(null)}
        onConfirm={confirmCancelTransaction}
        title="Cancel Invoice"
        message={
          txToCancel
            ? `Are you sure you want to cancel invoice ${txToCancel.invoiceNo}? Inventory stock and party balances will be automatically reversed.`
            : 'Cancel this invoice?'
        }
        confirmButtonText="Cancel Invoice"
        isLoading={isCanceling}
      />

      {/* 8. Settings Modal */}
      <SettingsModal
        isOpen={showSettings}
        onClose={() => setShowSettings(false)}
        businessProfile={businessProfile}
        onProfileUpdated={(updated) => setBusinessProfile(updated)}
      />

      {/* 9. Keyboard Shortcuts Cheat Sheet Modal */}
      <ShortcutsModal
        isOpen={showShortcuts}
        onClose={() => setShowShortcuts(false)}
      />

      {/* 10. Desktop App & Offline Installation Modal */}
      <DesktopAppModal
        isOpen={showDesktopModal}
        onClose={() => setShowDesktopModal(false)}
      />
    </div>
  );
}
