import React, { useState, useEffect } from 'react';
import {
  FileText,
  Search,
  Plus,
  Printer,
  MoreVertical,
  Edit,
  Trash2,
  Copy,
  Eye,
  Download,
  Ban,
  RotateCcw,
  CreditCard,
  History,
  Filter,
} from 'lucide-react';
import { BusinessProfile, FilterPeriod, Transaction } from '../../types';
import {
  getTransactions,
  getTransaction,
  cancelTransaction,
  deleteTransaction,
  duplicateTransaction,
  convertBillToReturn,
} from '../../db/indexedDB';
import { formatINR, formatDate } from '../../utils/formatters';
import { FloatingRowMenu, FloatingMenuItem } from '../common/FloatingRowMenu';
import { RecordHistoryModal } from '../common/RecordHistoryModal';
import { ConfirmDeleteModal } from '../common/ConfirmDeleteModal';
import { useToast } from '../common/Toast';
import { useSecurity } from '../../contexts/SecurityContext';

interface PurchasesViewProps {
  businessProfile: BusinessProfile | null;
  onOpenAddPurchase: () => void;
  onEditPurchase: (tx: Transaction) => void;
  onViewBill: (tx: Transaction) => void;
  onMakePayment: (tx: Transaction) => void;
  onConvertToReturn?: (tx: Transaction) => void;
  onRefreshMetrics?: () => void;
}

export const PurchasesView: React.FC<PurchasesViewProps> = ({
  businessProfile,
  onOpenAddPurchase,
  onEditPurchase,
  onViewBill,
  onMakePayment,
  onConvertToReturn,
  onRefreshMetrics,
}) => {
  const { showToast } = useToast();
  const { requirePin } = useSecurity();
  const [purchases, setPurchases] = useState<Transaction[]>([]);

  // Filters
  const [period, setPeriod] = useState<FilterPeriod>('this_month');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [paymentTypeFilter, setPaymentTypeFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Floating row menu state
  const [menuAnchorRect, setMenuAnchorRect] = useState<DOMRect | null>(null);
  const [activeMenuTxId, setActiveMenuTxId] = useState<string | null>(null);

  // Modals for 3-dot actions
  const [selectedTxForHistory, setSelectedTxForHistory] = useState<Transaction | null>(null);

  // In-app Delete Confirmation Modal
  const [txToDelete, setTxToDelete] = useState<Transaction | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    loadPurchases();
  }, []);

  const loadPurchases = async () => {
    const list = await getTransactions();
    const purchasesOnly = list.filter((t) => t.type === 'purchase_bill' || t.type === 'purchase_return');
    setPurchases(purchasesOnly);
  };

  // Filter calculations
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth();

  const filterStart = new Date();
  filterStart.setHours(0, 0, 0, 0);

  if (period === 'this_month') {
    filterStart.setDate(1);
  } else if (period === 'last_30_days') {
    filterStart.setDate(now.getDate() - 30);
  } else if (period === 'this_quarter') {
    const qMonth = Math.floor(currentMonth / 3) * 3;
    filterStart.setMonth(qMonth, 1);
  } else if (period === 'this_year') {
    if (currentMonth < 3) {
      filterStart.setFullYear(currentYear - 1, 3, 1);
    } else {
      filterStart.setFullYear(currentYear, 3, 1);
    }
  } else {
    filterStart.setFullYear(2000, 0, 1);
  }

  const filteredPurchases = purchases.filter((t) => {
    const tDate = new Date(t.date);

    if (startDate && t.date < startDate) return false;
    if (endDate && t.date > endDate) return false;
    if (!startDate && !endDate && (tDate < filterStart || tDate > now)) return false;

    if (paymentTypeFilter !== 'all' && t.paymentType !== paymentTypeFilter) return false;

    const q = searchQuery.toLowerCase().trim();
    if (!q) return true;
    return (
      t.invoiceNo.toLowerCase().includes(q) ||
      t.partyName.toLowerCase().includes(q) ||
      (t.partyPhone && t.partyPhone.includes(q)) ||
      t.totalAmount.toString().includes(q)
    );
  });

  // KPI calculations
  const activePurchases = filteredPurchases.filter((t) => t.status === 'active');
  const totalPurchasesAmount = activePurchases.reduce((acc, t) => acc + t.totalAmount, 0);
  const totalPaidAmount = activePurchases.reduce((acc, t) => acc + (t.receivedAmount || 0), 0);
  const totalBalanceDue = activePurchases.reduce((acc, t) => acc + (t.balanceDue || 0), 0);

  // 3-Dot Actions (Always fetches fresh record from IndexedDB by id)
  const handleAction = async (actionType: string, txId: string) => {
    setMenuAnchorRect(null);
    setActiveMenuTxId(null);

    const tx = await getTransaction(txId);
    if (!tx) {
      showToast('Record not found in database', 'error');
      return;
    }

    try {
      switch (actionType) {
        case 'view_edit':
          if (!(await requirePin(`Enter PIN to edit ${tx.invoiceNo}`))) return;
          onEditPurchase(tx);
          break;

        case 'make_payment':
          onMakePayment(tx);
          break;

        case 'convert_return':
          if (tx.status === 'cancelled') {
            showToast('Cancelled purchase bill cannot be converted to return', 'error');
            return;
          }
          if (tx.type === 'purchase_return') {
            showToast('Already a purchase return debit note', 'info');
            return;
          }
          if (onConvertToReturn) {
            onConvertToReturn(tx);
          } else {
            const ret = await convertBillToReturn(tx.id);
            await loadPurchases();
            if (onRefreshMetrics) onRefreshMetrics();
            showToast(`Created purchase return debit note ${ret.invoiceNo}. Stock adjusted.`, 'success');
          }
          break;

        case 'cancel':
          if (tx.status === 'cancelled') {
            showToast('This purchase bill is already cancelled', 'info');
            return;
          }
          if (!(await requirePin(`Enter PIN to cancel ${tx.invoiceNo}`))) return;
          await cancelTransaction(tx.id);
          await loadPurchases();
          if (onRefreshMetrics) onRefreshMetrics();
          showToast(`Purchase bill ${tx.invoiceNo} cancelled. Stock and payable reversed.`, 'success');
          break;

        case 'delete':
          if (!(await requirePin(`Enter PIN to delete ${tx.invoiceNo}`))) return;
          setTxToDelete(tx);
          setShowDeleteConfirm(true);
          break;

        case 'duplicate':
          try {
            const copy = await duplicateTransaction(tx.id);
            await loadPurchases();
            if (onRefreshMetrics) onRefreshMetrics();
            showToast(`Purchase bill duplicated as ${copy.invoiceNo}.`, 'success');
          } catch {
            showToast('Failed to duplicate purchase bill', 'error');
          }
          break;

        case 'open_pdf':
        case 'preview':
          onViewBill(tx);
          break;

        case 'print':
          onViewBill(tx);
          setTimeout(() => window.print(), 300);
          break;

        case 'history':
          setSelectedTxForHistory(tx);
          break;

        default:
          showToast('Feature coming soon', 'info');
          break;
      }
    } catch (err) {
      showToast(`Action failed: ${(err as Error).message || 'Unknown error'}`, 'error');
    }
  };

  // Perform confirmed atomic delete
  const handleConfirmDelete = async () => {
    if (!txToDelete) return;
    setIsDeleting(true);
    try {
      const res = await deleteTransaction(txToDelete.id);
      if (!res.success) {
        showToast(res.error || 'Failed to delete purchase bill', 'error');
        return;
      }

      showToast('Purchase bill deleted', 'success');
      setPurchases((prev) => prev.filter((p) => p.id !== txToDelete.id));
      setShowDeleteConfirm(false);
      setTxToDelete(null);

      await loadPurchases();
      if (onRefreshMetrics) onRefreshMetrics();
    } catch (err) {
      showToast(`Delete failed: ${(err as Error).message || 'Unknown error'}`, 'error');
    } finally {
      setIsDeleting(false);
    }
  };

  // Exact requested order:
  // View/Edit, Make Payment, Convert To Return, Cancel, Delete, Duplicate, Open PDF, Preview, Print, View History
  const currentMenuTx = purchases.find((t) => t.id === activeMenuTxId);
  const floatingMenuItems: FloatingMenuItem[] = currentMenuTx
    ? [
        // Group 1
        {
          label: 'View / Edit',
          action: 'view_edit',
          dataId: currentMenuTx.id,
          dataType: 'purchase_bill',
          icon: <Edit className="w-3.5 h-3.5" />,
          onClick: () => handleAction('view_edit', currentMenuTx.id),
        },
        {
          label: 'Make Payment',
          action: 'make_payment',
          dataId: currentMenuTx.id,
          dataType: 'purchase_bill',
          icon: <CreditCard className="w-3.5 h-3.5" />,
          disabled: currentMenuTx.status === 'cancelled' || currentMenuTx.balanceDue <= 0,
          disabledReason: currentMenuTx.balanceDue <= 0 ? 'Fully Settled' : 'Cancelled',
          onClick: () => handleAction('make_payment', currentMenuTx.id),
        },
        {
          label: 'Convert To Return',
          action: 'convert_return',
          dataId: currentMenuTx.id,
          dataType: 'purchase_bill',
          icon: <RotateCcw className="w-3.5 h-3.5" />,
          disabled: currentMenuTx.status === 'cancelled' || currentMenuTx.type === 'purchase_return',
          disabledReason: currentMenuTx.status === 'cancelled' ? 'Cancelled' : 'Already a return',
          onClick: () => handleAction('convert_return', currentMenuTx.id),
        },
        {
          label: 'Cancel',
          action: 'cancel',
          dataId: currentMenuTx.id,
          dataType: 'purchase_bill',
          icon: <Ban className="w-3.5 h-3.5" />,
          disabled: currentMenuTx.status === 'cancelled',
          disabledReason: 'Already cancelled',
          onClick: () => handleAction('cancel', currentMenuTx.id),
        },

        // Group 2 (Delete - red)
        {
          label: 'Delete',
          action: 'delete',
          dataId: currentMenuTx.id,
          dataType: 'purchase_bill',
          icon: <Trash2 className="w-3.5 h-3.5" />,
          danger: true,
          dividerBefore: true,
          onClick: () => handleAction('delete', currentMenuTx.id),
        },

        // Group 3 (Duplicate, Open PDF, Preview, Print)
        {
          label: 'Duplicate',
          action: 'duplicate',
          dataId: currentMenuTx.id,
          dataType: 'purchase_bill',
          icon: <Copy className="w-3.5 h-3.5" />,
          dividerBefore: true,
          onClick: () => handleAction('duplicate', currentMenuTx.id),
        },
        {
          label: 'Open PDF',
          action: 'open_pdf',
          dataId: currentMenuTx.id,
          dataType: 'purchase_bill',
          icon: <Download className="w-3.5 h-3.5" />,
          onClick: () => handleAction('open_pdf', currentMenuTx.id),
        },
        {
          label: 'Preview',
          action: 'preview',
          dataId: currentMenuTx.id,
          dataType: 'purchase_bill',
          icon: <Eye className="w-3.5 h-3.5" />,
          onClick: () => handleAction('preview', currentMenuTx.id),
        },
        {
          label: 'Print',
          action: 'print',
          dataId: currentMenuTx.id,
          dataType: 'purchase_bill',
          icon: <Printer className="w-3.5 h-3.5" />,
          onClick: () => handleAction('print', currentMenuTx.id),
        },

        // Group 4 (View History)
        {
          label: 'View History',
          action: 'history',
          dataId: currentMenuTx.id,
          dataType: 'purchase_bill',
          icon: <History className="w-3.5 h-3.5" />,
          dividerBefore: true,
          onClick: () => handleAction('history', currentMenuTx.id),
        },
      ]
    : [];

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto h-full overflow-y-auto">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">Purchase Bills</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Record inventory vendor bills, input tax credits (ITC), and supplier payments
          </p>
        </div>

        <button
          type="button"
          onClick={onOpenAddPurchase}
          className="px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm flex items-center gap-1.5 cursor-pointer shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>Add Purchase (Alt + P)</span>
        </button>
      </div>

      {/* 3 Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-4 bg-white border border-slate-200 rounded-xl shadow-2xs">
          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
            Total Purchases (Filtered)
          </span>
          <div className="text-xl font-bold text-slate-900 font-mono mt-1">
            {formatINR(totalPurchasesAmount)}
          </div>
          <span className="text-[11px] text-slate-400 mt-0.5 block">
            {activePurchases.length} Active Bills
          </span>
        </div>

        <div className="p-4 bg-white border border-slate-200 rounded-xl shadow-2xs">
          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
            Amount Paid
          </span>
          <div className="text-xl font-bold text-emerald-700 font-mono mt-1">
            {formatINR(totalPaidAmount)}
          </div>
          <span className="text-[11px] text-emerald-600 mt-0.5 block">Paid to Suppliers</span>
        </div>

        <div className="p-4 bg-white border border-slate-200 rounded-xl shadow-2xs">
          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
            Balance Due (Payable)
          </span>
          <div className="text-xl font-bold text-rose-700 font-mono mt-1">
            {formatINR(totalBalanceDue)}
          </div>
          <span className="text-[11px] text-rose-600 mt-0.5 block">Unsettled vendor balance</span>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="p-4 bg-white border border-slate-200 rounded-xl shadow-2xs space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          {/* Quick period buttons */}
          <div className="flex items-center gap-1 overflow-x-auto p-0.5 bg-slate-100 rounded-lg text-xs">
            {(
              [
                ['this_month', 'This Month'],
                ['last_30_days', 'Last 30 Days'],
                ['this_quarter', 'This Quarter'],
                ['this_year', 'This Year'],
                ['all', 'All Time'],
              ] as const
            ).map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => setPeriod(key)}
                className={`px-3 py-1.5 rounded-md font-medium transition-colors cursor-pointer whitespace-nowrap ${
                  period === key
                    ? 'bg-white text-slate-900 shadow-2xs font-semibold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {/* Search box */}
          <div className="relative w-full sm:w-72">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search bill #, supplier, phone..."
              className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-slate-900"
            />
          </div>
        </div>

        {/* Custom date range & payment type filter */}
        <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-slate-100 text-xs">
          <div className="flex items-center gap-1.5 text-slate-500">
            <Filter className="w-3.5 h-3.5" />
            <span className="font-medium text-[11px]">Filters:</span>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="px-2 py-1 bg-slate-50 border border-slate-200 rounded-md text-[11px] font-mono"
            />
            <span className="text-slate-400">to</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="px-2 py-1 bg-slate-50 border border-slate-200 rounded-md text-[11px] font-mono"
            />
          </div>

          <select
            value={paymentTypeFilter}
            onChange={(e) => setPaymentTypeFilter(e.target.value)}
            className="px-2.5 py-1 bg-slate-50 border border-slate-200 rounded-md text-[11px] font-medium cursor-pointer"
          >
            <option value="all">All Payment Types</option>
            <option value="cash">Cash Only</option>
            <option value="credit">Credit Only</option>
            <option value="bank">Bank / UPI</option>
          </select>

          {(startDate || endDate || paymentTypeFilter !== 'all') && (
            <button
              type="button"
              onClick={() => {
                setStartDate('');
                setEndDate('');
                setPaymentTypeFilter('all');
              }}
              className="text-xs text-rose-600 hover:underline cursor-pointer"
            >
              Reset Filters
            </button>
          )}
        </div>
      </div>

      {/* Purchases Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
        {filteredPurchases.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200 uppercase text-[11px]">
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-4">Bill #</th>
                  <th className="py-3 px-4">Supplier Name</th>
                  <th className="py-3 px-4">Payment Type</th>
                  <th className="py-3 px-4 text-right">Amount</th>
                  <th className="py-3 px-4 text-right">Balance Due</th>
                  <th className="py-3 px-4 text-center">Status</th>
                  <th className="py-3 px-4 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredPurchases.map((tx) => {
                  const isCancelled = tx.status === 'cancelled';
                  const isMenuOpen = activeMenuTxId === tx.id;

                  return (
                    <tr
                      key={tx.id}
                      onClick={() => onViewBill(tx)}
                      className={`transition-colors cursor-pointer ${
                        isMenuOpen
                          ? 'bg-rose-50/80 ring-1 ring-inset ring-rose-200'
                          : isCancelled
                          ? 'bg-slate-50/60 opacity-60 hover:bg-slate-100/60'
                          : 'hover:bg-slate-50'
                      }`}
                    >
                      <td className="py-3 px-4 font-mono text-slate-600">{formatDate(tx.date)}</td>
                      <td className="py-3 px-4 font-mono font-bold text-slate-900">
                        {tx.invoiceNo}
                        {tx.type === 'purchase_return' && (
                          <span className="ml-1.5 text-[9px] px-1.5 py-0.2 bg-amber-100 text-amber-800 rounded font-sans">
                            Debit Note
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-semibold text-slate-900">{tx.partyName}</div>
                        {tx.partyPhone && (
                          <div className="text-[11px] text-slate-500 font-mono">{tx.partyPhone}</div>
                        )}
                      </td>
                      <td className="py-3 px-4 uppercase font-mono text-[11px] text-slate-600">
                        {tx.paymentType}
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-bold text-slate-900 tabular-nums">
                        {formatINR(tx.totalAmount)}
                      </td>
                      <td className="py-3 px-4 text-right font-mono tabular-nums">
                        {tx.balanceDue > 0 ? (
                          <span className="text-rose-700 font-semibold">{formatINR(tx.balanceDue)}</span>
                        ) : (
                          <span className="text-emerald-700 font-medium">Settled</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span
                          className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase ${
                            isCancelled
                              ? 'bg-rose-100 text-rose-700'
                              : tx.balanceDue === 0
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-amber-100 text-amber-800'
                          }`}
                        >
                          {isCancelled ? 'Cancelled' : tx.balanceDue === 0 ? 'Settled' : 'Pending'}
                        </span>
                      </td>

                      {/* Actions Column */}
                      <td className="py-3 px-4 text-center" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onViewBill(tx);
                              setTimeout(() => window.print(), 300);
                            }}
                            title="Quick Print"
                            className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                          >
                            <Printer className="w-3.5 h-3.5" />
                          </button>

                          <button
                            type="button"
                            data-menu-trigger-for={tx.id}
                            onClick={(e) => {
                              e.stopPropagation();
                              if (activeMenuTxId === tx.id) {
                                setActiveMenuTxId(null);
                                setMenuAnchorRect(null);
                              } else {
                                setActiveMenuTxId(tx.id);
                                setMenuAnchorRect(e.currentTarget.getBoundingClientRect());
                              }
                            }}
                            title="More Actions"
                            className={`p-1.5 rounded-lg border transition-colors cursor-pointer ${
                              isMenuOpen
                                ? 'bg-rose-100 border-rose-300 text-rose-700'
                                : 'border-slate-200 text-slate-500 hover:bg-slate-100 hover:text-slate-800'
                            }`}
                          >
                            <MoreVertical className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="py-16 text-center text-xs text-slate-400">
            <FileText className="w-10 h-10 text-slate-300 mx-auto mb-2" />
            <p className="font-semibold text-slate-600">No purchase bills found</p>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Record your first purchase bill using the &quot;Add Purchase&quot; button above.
            </p>
          </div>
        )}
      </div>

      {/* Floating 3-Dot Portal Menu */}
      <FloatingRowMenu
        isOpen={!!activeMenuTxId && !!menuAnchorRect}
        onClose={() => {
          setActiveMenuTxId(null);
          setMenuAnchorRect(null);
        }}
        anchorRect={menuAnchorRect}
        items={floatingMenuItems}
        minWidth={260}
      />

      {/* In-App Delete Confirmation Modal */}
      <ConfirmDeleteModal
        isOpen={showDeleteConfirm}
        isLoading={isDeleting}
        onClose={() => {
          setShowDeleteConfirm(false);
          setTxToDelete(null);
        }}
        onConfirm={handleConfirmDelete}
        title="Delete Purchase Bill"
        message="Delete this purchase bill? This cannot be undone."
        details={
          txToDelete
            ? `Bill: ${txToDelete.invoiceNo} · Supplier: ${txToDelete.partyName} · Amount: ₹${txToDelete.totalAmount.toFixed(
                2
              )} · Date: ${formatDate(txToDelete.date)}`
            : undefined
        }
        confirmButtonText="Delete Bill"
      />

      {/* Record History Audit Modal */}
      <RecordHistoryModal
        isOpen={!!selectedTxForHistory}
        onClose={() => setSelectedTxForHistory(null)}
        recordTitle={selectedTxForHistory?.invoiceNo || 'Bill History'}
        recordSubtitle={`Supplier: ${selectedTxForHistory?.partyName} · Amount: ₹${selectedTxForHistory?.totalAmount.toFixed(
          2
        )}`}
        record={selectedTxForHistory}
      />
    </div>
  );
};
