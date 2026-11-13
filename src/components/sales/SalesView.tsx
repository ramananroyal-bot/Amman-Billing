import React, { useState, useEffect } from 'react';
import {
  FileText,
  Search,
  Plus,
  Printer,
  Share2,
  MoreVertical,
  Edit,
  Trash2,
  Copy,
  Eye,
  Download,
  Ban,
  RotateCcw,
  CreditCard,
  FileCode,
  Truck,
  History,
  CheckCircle2,
  X,
  Filter,
} from 'lucide-react';
import { BusinessProfile, FilterPeriod, Transaction } from '../../types';
import {
  getTransactions,
  getTransaction,
  cancelTransaction,
  deleteTransaction,
  duplicateTransaction,
  convertInvoiceToReturn,
} from '../../db/indexedDB';
import { formatINR, formatDate } from '../../utils/formatters';
import { EWayBillExportModal } from './EWayBillExportModal';
import { DeliveryChallanPreviewModal } from './DeliveryChallanPreviewModal';
import { FloatingRowMenu, FloatingMenuItem } from '../common/FloatingRowMenu';
import { RecordHistoryModal } from '../common/RecordHistoryModal';
import { ConfirmDeleteModal } from '../common/ConfirmDeleteModal';
import { useToast } from '../common/Toast';
import { useSecurity } from '../../contexts/SecurityContext';

interface SalesViewProps {
  businessProfile: BusinessProfile | null;
  onOpenAddSale: () => void;
  onEditSale: (tx: Transaction) => void;
  onViewInvoice: (tx: Transaction) => void;
  onReceivePayment: (tx: Transaction) => void;
  onConvertToReturn?: (tx: Transaction) => void;
  onRefreshMetrics?: () => void;
}

export const SalesView: React.FC<SalesViewProps> = ({
  businessProfile,
  onOpenAddSale,
  onEditSale,
  onViewInvoice,
  onReceivePayment,
  onConvertToReturn,
  onRefreshMetrics,
}) => {
  const { showToast } = useToast();
  const { requirePin } = useSecurity();
  const [transactions, setTransactions] = useState<Transaction[]>([]);

  // Filters
  const [period, setPeriod] = useState<FilterPeriod>('this_month');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [paymentTypeFilter, setPaymentTypeFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Floating menu portal state
  const [menuAnchorRect, setMenuAnchorRect] = useState<DOMRect | null>(null);
  const [activeMenuTxId, setActiveMenuTxId] = useState<string | null>(null);

  // Modals for 3-dot actions
  const [selectedTxForEWay, setSelectedTxForEWay] = useState<Transaction | null>(null);
  const [selectedTxForChallan, setSelectedTxForChallan] = useState<Transaction | null>(null);
  const [selectedTxForHistory, setSelectedTxForHistory] = useState<Transaction | null>(null);

  // In-app Delete Confirmation Modal state
  const [txToDelete, setTxToDelete] = useState<Transaction | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    loadSales();
  }, []);

  const loadSales = async () => {
    const list = await getTransactions();
    const salesOnly = list.filter((t) => t.type === 'sale_invoice' || t.type === 'sale_return');
    setTransactions(salesOnly);
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

  const filteredSales = transactions.filter((t) => {
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
  const activeSales = filteredSales.filter((t) => t.status === 'active');
  const totalSalesAmount = activeSales.reduce((acc, t) => acc + t.totalAmount, 0);
  const totalReceivedAmount = activeSales.reduce((acc, t) => acc + (t.receivedAmount || 0), 0);
  const totalBalanceDue = activeSales.reduce((acc, t) => acc + (t.balanceDue || 0), 0);

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
          onEditSale(tx);
          break;

        case 'eway_bill':
          setSelectedTxForEWay(tx);
          break;

        case 'receive_payment':
          onReceivePayment(tx);
          break;

        case 'convert_return':
          if (tx.status === 'cancelled') {
            showToast('Cancelled invoice cannot be converted to return', 'error');
            return;
          }
          if (tx.type === 'sale_return') {
            showToast('Already a sale return credit note', 'info');
            return;
          }
          if (onConvertToReturn) {
            onConvertToReturn(tx);
          } else {
            const ret = await convertInvoiceToReturn(tx.id);
            await loadSales();
            if (onRefreshMetrics) onRefreshMetrics();
            showToast(`Created return credit note ${ret.invoiceNo}. Stock returned to inventory.`, 'success');
          }
          break;

        case 'preview_challan':
          setSelectedTxForChallan(tx);
          break;

        case 'cancel':
          if (tx.status === 'cancelled') {
            showToast('This invoice is already cancelled', 'info');
            return;
          }
          if (!(await requirePin(`Enter PIN to cancel ${tx.invoiceNo}`))) return;
          await cancelTransaction(tx.id);
          await loadSales();
          if (onRefreshMetrics) onRefreshMetrics();
          showToast(`Invoice ${tx.invoiceNo} cancelled. Inventory and receivable reversed.`, 'success');
          break;

        case 'delete':
          if (!(await requirePin(`Enter PIN to delete ${tx.invoiceNo}`))) return;
          setTxToDelete(tx);
          setShowDeleteConfirm(true);
          break;

        case 'duplicate':
          try {
            const copy = await duplicateTransaction(tx.id);
            await loadSales();
            if (onRefreshMetrics) onRefreshMetrics();
            showToast(`Invoice duplicated as ${copy.invoiceNo}.`, 'success');
          } catch {
            showToast('Failed to duplicate invoice', 'error');
          }
          break;

        case 'open_pdf':
        case 'preview':
          onViewInvoice(tx);
          break;

        case 'print':
          onViewInvoice(tx);
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
        showToast(res.error || 'Failed to delete invoice', 'error');
        return;
      }

      // Remove row immediately and refresh
      showToast('Invoice deleted', 'success');
      setTransactions((prev) => prev.filter((t) => t.id !== txToDelete.id));
      setShowDeleteConfirm(false);
      setTxToDelete(null);

      await loadSales();
      if (onRefreshMetrics) onRefreshMetrics();
    } catch (err) {
      showToast(`Delete failed: ${(err as Error).message || 'Unknown error'}`, 'error');
    } finally {
      setIsDeleting(false);
    }
  };

  // WhatsApp Share
  const handleShareWhatsApp = (tx: Transaction) => {
    const cleanPhone = (tx.partyPhone || '').replace(/\D/g, '');
    const phone = cleanPhone.length === 10 ? `91${cleanPhone}` : cleanPhone;
    const msg = encodeURIComponent(
      `Dear ${tx.partyName}, your invoice ${tx.invoiceNo} of ${formatINR(tx.totalAmount)} dated ${formatDate(
        tx.date
      )} from ${businessProfile?.businessName || 'our firm'} is generated. Balance due: ${formatINR(
        tx.balanceDue
      )}. Thank you!`
    );
    window.open(`https://wa.me/${phone}?text=${msg}`, '_blank');
  };

  // Build floating menu items for active record
  // EXACT GROUPING AND ORDER FROM SPECIFICATION:
  // Group 1: View / Edit, Generate e-Way Bill, Receive Payment, Convert To Return, Preview Delivery Challan, Cancel Invoice
  // Group 2: Delete (red text and red icon)
  // Group 3: Duplicate, Open PDF, Preview, Print
  // Group 4: View History
  const currentMenuTx = transactions.find((t) => t.id === activeMenuTxId);
  const floatingMenuItems: FloatingMenuItem[] = currentMenuTx
    ? [
        // Group 1
        {
          label: 'View / Edit',
          action: 'view_edit',
          dataId: currentMenuTx.id,
          dataType: 'sale_invoice',
          icon: <Edit className="w-3.5 h-3.5" />,
          onClick: () => handleAction('view_edit', currentMenuTx.id),
        },
        {
          label: 'Generate e-Way Bill',
          action: 'eway_bill',
          dataId: currentMenuTx.id,
          dataType: 'sale_invoice',
          icon: <FileCode className="w-3.5 h-3.5" />,
          onClick: () => handleAction('eway_bill', currentMenuTx.id),
        },
        {
          label: 'Receive Payment',
          action: 'receive_payment',
          dataId: currentMenuTx.id,
          dataType: 'sale_invoice',
          icon: <CreditCard className="w-3.5 h-3.5" />,
          disabled: currentMenuTx.status === 'cancelled' || currentMenuTx.balanceDue <= 0,
          disabledReason: currentMenuTx.balanceDue <= 0 ? 'Fully Paid' : 'Cancelled',
          onClick: () => handleAction('receive_payment', currentMenuTx.id),
        },
        {
          label: 'Convert To Return',
          action: 'convert_return',
          dataId: currentMenuTx.id,
          dataType: 'sale_invoice',
          icon: <RotateCcw className="w-3.5 h-3.5" />,
          disabled: currentMenuTx.status === 'cancelled' || currentMenuTx.type === 'sale_return',
          disabledReason: currentMenuTx.status === 'cancelled' ? 'Cancelled' : 'Already a return',
          onClick: () => handleAction('convert_return', currentMenuTx.id),
        },
        {
          label: 'Preview Delivery Challan',
          action: 'preview_challan',
          dataId: currentMenuTx.id,
          dataType: 'sale_invoice',
          icon: <Truck className="w-3.5 h-3.5" />,
          onClick: () => handleAction('preview_challan', currentMenuTx.id),
        },
        {
          label: 'Cancel Invoice',
          action: 'cancel',
          dataId: currentMenuTx.id,
          dataType: 'sale_invoice',
          icon: <Ban className="w-3.5 h-3.5" />,
          disabled: currentMenuTx.status === 'cancelled',
          disabledReason: 'Already cancelled',
          onClick: () => handleAction('cancel', currentMenuTx.id),
        },

        // Group 2 (Delete - red text and red icon)
        {
          label: 'Delete',
          action: 'delete',
          dataId: currentMenuTx.id,
          dataType: 'sale_invoice',
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
          dataType: 'sale_invoice',
          icon: <Copy className="w-3.5 h-3.5" />,
          dividerBefore: true,
          onClick: () => handleAction('duplicate', currentMenuTx.id),
        },
        {
          label: 'Open PDF',
          action: 'open_pdf',
          dataId: currentMenuTx.id,
          dataType: 'sale_invoice',
          icon: <Download className="w-3.5 h-3.5" />,
          onClick: () => handleAction('open_pdf', currentMenuTx.id),
        },
        {
          label: 'Preview',
          action: 'preview',
          dataId: currentMenuTx.id,
          dataType: 'sale_invoice',
          icon: <Eye className="w-3.5 h-3.5" />,
          onClick: () => handleAction('preview', currentMenuTx.id),
        },
        {
          label: 'Print',
          action: 'print',
          dataId: currentMenuTx.id,
          dataType: 'sale_invoice',
          icon: <Printer className="w-3.5 h-3.5" />,
          onClick: () => handleAction('print', currentMenuTx.id),
        },

        // Group 4 (View History)
        {
          label: 'View History',
          action: 'history',
          dataId: currentMenuTx.id,
          dataType: 'sale_invoice',
          icon: <History className="w-3.5 h-3.5" />,
          dividerBefore: true,
          onClick: () => handleAction('history', currentMenuTx.id),
        },
      ]
    : [];

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto h-full overflow-y-auto">
      {/* Top Header & Metrics Strip */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">Sale Invoices</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Manage GST tax invoices, delivery challans, e-Way bills, and client payments
          </p>
        </div>

        <button
          type="button"
          onClick={onOpenAddSale}
          className="px-4 py-2 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 rounded-lg shadow-sm flex items-center gap-1.5 cursor-pointer shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>Add Sale (Alt + S)</span>
        </button>
      </div>

      {/* 3 Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-4 bg-white border border-slate-200 rounded-xl shadow-2xs">
          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
            Total Sales (Filtered)
          </span>
          <div className="text-xl font-bold text-slate-900 font-mono mt-1">
            {formatINR(totalSalesAmount)}
          </div>
          <span className="text-[11px] text-slate-400 mt-0.5 block">
            {activeSales.length} Active Invoices
          </span>
        </div>

        <div className="p-4 bg-white border border-slate-200 rounded-xl shadow-2xs">
          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
            Amount Received
          </span>
          <div className="text-xl font-bold text-emerald-700 font-mono mt-1">
            {formatINR(totalReceivedAmount)}
          </div>
          <span className="text-[11px] text-emerald-600 mt-0.5 block">Cleared in Bank / Cash</span>
        </div>

        <div className="p-4 bg-white border border-slate-200 rounded-xl shadow-2xs">
          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
            Balance Due (Receivable)
          </span>
          <div className="text-xl font-bold text-amber-700 font-mono mt-1">
            {formatINR(totalBalanceDue)}
          </div>
          <span className="text-[11px] text-amber-600 mt-0.5 block">Unpaid balance</span>
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
              placeholder="Search invoice #, party, phone..."
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

      {/* Transactions Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
        {filteredSales.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200 uppercase text-[11px]">
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-4">Invoice #</th>
                  <th className="py-3 px-4">Party Name</th>
                  <th className="py-3 px-4">Payment Type</th>
                  <th className="py-3 px-4 text-right">Amount</th>
                  <th className="py-3 px-4 text-right">Balance Due</th>
                  <th className="py-3 px-4 text-center">Status</th>
                  <th className="py-3 px-4 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredSales.map((tx) => {
                  const isCancelled = tx.status === 'cancelled';
                  const isMenuOpen = activeMenuTxId === tx.id;

                  return (
                    <tr
                      key={tx.id}
                      onClick={() => onViewInvoice(tx)}
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
                        {tx.type === 'sale_return' && (
                          <span className="ml-1.5 text-[9px] px-1.5 py-0.2 bg-amber-100 text-amber-800 rounded font-sans">
                            Return
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
                          <span className="text-amber-700 font-semibold">{formatINR(tx.balanceDue)}</span>
                        ) : (
                          <span className="text-emerald-700 font-medium">Paid</span>
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
                          {isCancelled ? 'Cancelled' : tx.balanceDue === 0 ? 'Paid' : 'Unpaid'}
                        </span>
                      </td>

                      {/* Actions Column: Print Icon, Share Icon, 3-Dots Button */}
                      <td className="py-3 px-4 text-center" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onViewInvoice(tx);
                              setTimeout(() => window.print(), 300);
                            }}
                            title="Quick Print"
                            className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                          >
                            <Printer className="w-3.5 h-3.5" />
                          </button>

                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleShareWhatsApp(tx);
                            }}
                            title="Share on WhatsApp"
                            className="p-1.5 text-emerald-600 hover:text-emerald-800 hover:bg-emerald-50 rounded-lg transition-colors cursor-pointer"
                          >
                            <Share2 className="w-3.5 h-3.5" />
                          </button>

                          {/* 3-Dot Floating Menu Anchor Button */}
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
            <p className="font-semibold text-slate-600">No sale invoices found</p>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Create your first sale invoice using the &quot;Add Sale&quot; button above.
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
        title="Delete Sale Invoice"
        message="Delete this invoice? This cannot be undone."
        details={
          txToDelete
            ? `Invoice: ${txToDelete.invoiceNo} · Party: ${txToDelete.partyName} · Amount: ₹${txToDelete.totalAmount.toFixed(
                2
              )} · Date: ${formatDate(txToDelete.date)}`
            : undefined
        }
        confirmButtonText="Delete Invoice"
      />

      {/* e-Way Bill Export Modal */}
      {selectedTxForEWay && (
        <EWayBillExportModal
          isOpen={!!selectedTxForEWay}
          onClose={() => setSelectedTxForEWay(null)}
          transaction={selectedTxForEWay}
          businessProfile={businessProfile}
          onSaved={async () => {
            await loadSales();
            setSelectedTxForEWay(null);
          }}
        />
      )}

      {/* Delivery Challan Preview Modal */}
      {selectedTxForChallan && (
        <DeliveryChallanPreviewModal
          isOpen={!!selectedTxForChallan}
          onClose={() => setSelectedTxForChallan(null)}
          transaction={selectedTxForChallan}
          businessProfile={businessProfile}
        />
      )}

      {/* Record History Audit Modal */}
      <RecordHistoryModal
        isOpen={!!selectedTxForHistory}
        onClose={() => setSelectedTxForHistory(null)}
        recordTitle={selectedTxForHistory?.invoiceNo || 'Invoice History'}
        recordSubtitle={`Party: ${selectedTxForHistory?.partyName} · Amount: ₹${selectedTxForHistory?.totalAmount.toFixed(
          2
        )}`}
        record={selectedTxForHistory}
      />
    </div>
  );
};
