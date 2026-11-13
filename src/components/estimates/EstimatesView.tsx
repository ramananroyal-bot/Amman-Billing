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
  ArrowRightCircle,
  History,
  Filter,
  CheckCircle2,
  Clock,
} from 'lucide-react';
import { BusinessProfile, FilterPeriod, Transaction } from '../../types';
import {
  getTransactions,
  getTransaction,
  deleteTransaction,
  duplicateTransaction,
  convertEstimateToSale,
} from '../../db/indexedDB';
import { formatINR, formatDate, getTodayISO } from '../../utils/formatters';
import { FloatingRowMenu, FloatingMenuItem } from '../common/FloatingRowMenu';
import { RecordHistoryModal } from '../common/RecordHistoryModal';
import { ConfirmDeleteModal } from '../common/ConfirmDeleteModal';
import { useToast } from '../common/Toast';
import { useSecurity } from '../../contexts/SecurityContext';

interface EstimatesViewProps {
  businessProfile: BusinessProfile | null;
  onOpenCreateEstimate: () => void;
  onEditEstimate: (tx: Transaction) => void;
  onViewEstimate: (tx: Transaction) => void;
  onNavigateToSales: () => void;
  onRefreshMetrics?: () => void;
}

export const EstimatesView: React.FC<EstimatesViewProps> = ({
  businessProfile,
  onOpenCreateEstimate,
  onEditEstimate,
  onViewEstimate,
  onNavigateToSales,
  onRefreshMetrics,
}) => {
  const { showToast } = useToast();
  const { requirePin } = useSecurity();
  const [estimates, setEstimates] = useState<Transaction[]>([]);

  // Filters
  const [period, setPeriod] = useState<FilterPeriod>('this_month');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'open' | 'converted'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Floating menu state
  const [menuAnchorRect, setMenuAnchorRect] = useState<DOMRect | null>(null);
  const [activeMenuTxId, setActiveMenuTxId] = useState<string | null>(null);

  // Modals
  const [selectedTxForHistory, setSelectedTxForHistory] = useState<Transaction | null>(null);
  const [txToDelete, setTxToDelete] = useState<Transaction | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [convertingId, setConvertingId] = useState<string | null>(null);

  useEffect(() => {
    loadEstimates();
  }, []);

  const loadEstimates = async () => {
    const list = await getTransactions({ type: 'estimate' });
    setEstimates(list);
  };

  // Period filter computation
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

  const todayISO = getTodayISO();

  const filteredEstimates = estimates.filter((t) => {
    const tDate = new Date(t.date);
    if (startDate && t.date < startDate) return false;
    if (endDate && t.date > endDate) return false;
    if (!startDate && !endDate && (tDate < filterStart || tDate > now)) return false;

    const estStatus = t.estimateStatus || 'open';
    if (statusFilter === 'open' && estStatus !== 'open') return false;
    if (statusFilter === 'converted' && estStatus !== 'converted') return false;

    const q = searchQuery.toLowerCase().trim();
    if (!q) return true;
    return (
      t.invoiceNo.toLowerCase().includes(q) ||
      t.partyName.toLowerCase().includes(q) ||
      (t.partyPhone && t.partyPhone.includes(q)) ||
      t.totalAmount.toString().includes(q)
    );
  });

  // KPI metrics calculated directly from filtered estimates
  const totalEstimatedAmount = filteredEstimates.reduce((acc, t) => acc + t.totalAmount, 0);
  const openEstimates = filteredEstimates.filter((t) => (t.estimateStatus || 'open') === 'open');
  const openPipelineValue = openEstimates.reduce((acc, t) => acc + t.totalAmount, 0);
  const convertedCount = filteredEstimates.filter((t) => t.estimateStatus === 'converted').length;

  // One-click convert estimate to confirmed GST Sale Invoice
  const handleConvertToSale = async (tx: Transaction) => {
    if (tx.estimateStatus === 'converted') {
      showToast('Estimate is already converted to a Sale Invoice', 'info');
      return;
    }
    setConvertingId(tx.id);
    try {
      const saleTx = await convertEstimateToSale(tx.id);
      await loadEstimates();
      if (onRefreshMetrics) onRefreshMetrics();
      showToast(`Converted to Sale Invoice ${saleTx.invoiceNo}. Stock & balance updated.`, 'success');
    } catch (err) {
      showToast((err as Error).message || 'Failed to convert estimate', 'error');
    } finally {
      setConvertingId(null);
    }
  };

  // 3-Dot Action handler
  const handleAction = async (actionType: string, txId: string) => {
    setMenuAnchorRect(null);
    setActiveMenuTxId(null);

    const tx = await getTransaction(txId);
    if (!tx) {
      showToast('Estimate not found in database', 'error');
      return;
    }

    try {
      switch (actionType) {
        case 'view_edit':
          if (!(await requirePin(`Enter PIN to edit ${tx.invoiceNo}`))) return;
          onEditEstimate(tx);
          break;
        case 'convert_sale':
          await handleConvertToSale(tx);
          break;
        case 'duplicate': {
          const copy = await duplicateTransaction(tx.id);
          await loadEstimates();
          showToast(`Estimate duplicated as ${copy.invoiceNo}.`, 'success');
          break;
        }
        case 'preview':
        case 'open_pdf':
          onViewEstimate(tx);
          break;
        case 'print':
          onViewEstimate(tx);
          setTimeout(() => window.print(), 300);
          break;
        case 'delete':
          if (!(await requirePin(`Enter PIN to delete ${tx.invoiceNo}`))) return;
          setTxToDelete(tx);
          setShowDeleteConfirm(true);
          break;
        case 'history':
          setSelectedTxForHistory(tx);
          break;
      }
    } catch (err) {
      showToast(`Action failed: ${(err as Error).message || 'Unknown error'}`, 'error');
    }
  };

  const handleConfirmDelete = async () => {
    if (!txToDelete) return;
    setIsDeleting(true);
    try {
      const res = await deleteTransaction(txToDelete.id);
      if (!res.success) {
        showToast(res.error || 'Failed to delete estimate', 'error');
        return;
      }
      showToast('Estimate deleted', 'success');
      setShowDeleteConfirm(false);
      setTxToDelete(null);
      await loadEstimates();
      if (onRefreshMetrics) onRefreshMetrics();
    } catch (err) {
      showToast((err as Error).message || 'Delete failed', 'error');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleShareWhatsApp = (tx: Transaction) => {
    const cleanPhone = (tx.partyPhone || '').replace(/\D/g, '');
    const phone = cleanPhone.length === 10 ? `91${cleanPhone}` : cleanPhone;
    const validText = tx.dueDate ? ` (Valid until ${formatDate(tx.dueDate)})` : '';
    const msg = encodeURIComponent(
      `Dear ${tx.partyName}, please find Estimate/Quotation ${tx.invoiceNo} for ${formatINR(
        tx.totalAmount
      )} dated ${formatDate(tx.date)}${validText} from ${businessProfile?.businessName || 'our firm'}.`
    );
    window.open(`https://wa.me/${phone}?text=${msg}`, '_blank');
  };

  const currentMenuTx = estimates.find((t) => t.id === activeMenuTxId);
  const floatingMenuItems: FloatingMenuItem[] = currentMenuTx
    ? [
        {
          label: 'View / Edit',
          action: 'view_edit',
          dataId: currentMenuTx.id,
          dataType: 'estimate',
          icon: <Edit className="w-3.5 h-3.5" />,
          onClick: () => handleAction('view_edit', currentMenuTx.id),
        },
        {
          label: 'Convert to Sale Invoice',
          action: 'convert_sale',
          dataId: currentMenuTx.id,
          dataType: 'estimate',
          icon: <ArrowRightCircle className="w-3.5 h-3.5 text-emerald-600" />,
          disabled: currentMenuTx.estimateStatus === 'converted',
          disabledReason: 'Already converted',
          onClick: () => handleAction('convert_sale', currentMenuTx.id),
        },
        {
          label: 'Delete',
          action: 'delete',
          dataId: currentMenuTx.id,
          dataType: 'estimate',
          icon: <Trash2 className="w-3.5 h-3.5" />,
          danger: true,
          dividerBefore: true,
          onClick: () => handleAction('delete', currentMenuTx.id),
        },
        {
          label: 'Duplicate',
          action: 'duplicate',
          dataId: currentMenuTx.id,
          dataType: 'estimate',
          icon: <Copy className="w-3.5 h-3.5" />,
          dividerBefore: true,
          onClick: () => handleAction('duplicate', currentMenuTx.id),
        },
        {
          label: 'Preview / PDF',
          action: 'preview',
          dataId: currentMenuTx.id,
          dataType: 'estimate',
          icon: <Eye className="w-3.5 h-3.5" />,
          onClick: () => handleAction('preview', currentMenuTx.id),
        },
        {
          label: 'Print Quotation',
          action: 'print',
          dataId: currentMenuTx.id,
          dataType: 'estimate',
          icon: <Printer className="w-3.5 h-3.5" />,
          onClick: () => handleAction('print', currentMenuTx.id),
        },
        {
          label: 'View History',
          action: 'history',
          dataId: currentMenuTx.id,
          dataType: 'estimate',
          icon: <History className="w-3.5 h-3.5" />,
          dividerBefore: true,
          onClick: () => handleAction('history', currentMenuTx.id),
        },
      ]
    : [];

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto h-full overflow-y-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">Estimates & Quotations</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Create customer price quotes without affecting inventory or balances. Convert to Sale Invoice in one click.
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={onNavigateToSales}
            className="px-3 py-2 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-slate-300 rounded-lg cursor-pointer"
          >
            View Sale Invoices
          </button>
          <button
            type="button"
            onClick={onOpenCreateEstimate}
            className="px-4 py-2 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 rounded-lg shadow-sm flex items-center gap-1.5 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Add Estimate</span>
          </button>
        </div>
      </div>

      {/* 3 Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-4 bg-white border border-slate-200 rounded-xl shadow-2xs">
          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
            Total Quoted Value
          </span>
          <div className="text-xl font-bold text-slate-900 font-mono mt-1">
            {formatINR(totalEstimatedAmount)}
          </div>
          <span className="text-[11px] text-slate-400 mt-0.5 block">
            {filteredEstimates.length} Quotations
          </span>
        </div>

        <div className="p-4 bg-white border border-slate-200 rounded-xl shadow-2xs">
          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
            Open Pipeline
          </span>
          <div className="text-xl font-bold text-amber-700 font-mono mt-1">
            {formatINR(openPipelineValue)}
          </div>
          <span className="text-[11px] text-amber-600 mt-0.5 block">
            {openEstimates.length} Awaiting conversion
          </span>
        </div>

        <div className="p-4 bg-white border border-slate-200 rounded-xl shadow-2xs">
          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
            Converted to Invoices
          </span>
          <div className="text-xl font-bold text-emerald-700 font-mono mt-1">
            {convertedCount}
          </div>
          <span className="text-[11px] text-emerald-600 mt-0.5 block">Billed as active sales</span>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="p-4 bg-white border border-slate-200 rounded-xl shadow-2xs space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
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

          <div className="relative w-full sm:w-72">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search estimate #, party, phone..."
              className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-slate-900"
            />
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-slate-100 text-xs">
          <div className="flex items-center gap-1.5 text-slate-500">
            <Filter className="w-3.5 h-3.5" />
            <span className="font-medium text-[11px]">Status:</span>
          </div>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as 'all' | 'open' | 'converted')}
            className="px-2.5 py-1 bg-slate-50 border border-slate-200 rounded-md text-[11px] font-medium cursor-pointer"
          >
            <option value="all">All Quotations</option>
            <option value="open">Open Only</option>
            <option value="converted">Converted Only</option>
          </select>

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
        </div>
      </div>

      {/* Estimates Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
        {filteredEstimates.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200 uppercase text-[11px]">
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-4">Estimate #</th>
                  <th className="py-3 px-4">Party Name</th>
                  <th className="py-3 px-4">Valid Until</th>
                  <th className="py-3 px-4 text-right">Amount</th>
                  <th className="py-3 px-4 text-center">Status</th>
                  <th className="py-3 px-4 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredEstimates.map((tx) => {
                  const isConverted = tx.estimateStatus === 'converted';
                  const isExpired = !isConverted && !!tx.dueDate && tx.dueDate < todayISO;
                  const isMenuOpen = activeMenuTxId === tx.id;

                  return (
                    <tr
                      key={tx.id}
                      onClick={() => onViewEstimate(tx)}
                      className={`transition-colors cursor-pointer ${
                        isMenuOpen ? 'bg-rose-50/80 ring-1 ring-inset ring-rose-200' : 'hover:bg-slate-50'
                      }`}
                    >
                      <td className="py-3 px-4 font-mono text-slate-600">{formatDate(tx.date)}</td>
                      <td className="py-3 px-4 font-mono font-bold text-slate-900">{tx.invoiceNo}</td>
                      <td className="py-3 px-4">
                        <div className="font-semibold text-slate-900">{tx.partyName}</div>
                        {tx.partyPhone && (
                          <div className="text-[11px] text-slate-500 font-mono">{tx.partyPhone}</div>
                        )}
                      </td>
                      <td className="py-3 px-4 font-mono text-slate-600">
                        {tx.dueDate ? (
                          <span className={isExpired ? 'text-rose-600 font-semibold' : ''}>
                            {formatDate(tx.dueDate)}
                          </span>
                        ) : (
                          <span className="text-slate-400">-</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-bold text-slate-900 tabular-nums">
                        {formatINR(tx.totalAmount)}
                      </td>
                      <td className="py-3 px-4 text-center">
                        {isConverted ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase bg-emerald-100 text-emerald-800">
                            <CheckCircle2 className="w-3 h-3" />
                            Converted
                          </span>
                        ) : isExpired ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase bg-rose-100 text-rose-700">
                            <Clock className="w-3 h-3" />
                            Expired
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase bg-amber-100 text-amber-800">
                            Open
                          </span>
                        )}
                      </td>

                      <td className="py-3 px-4 text-center" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-center gap-1.5">
                          {!isConverted && (
                            <button
                              type="button"
                              disabled={convertingId === tx.id}
                              onClick={(e) => {
                                e.stopPropagation();
                                handleConvertToSale(tx);
                              }}
                              title="Convert to Sale Invoice"
                              className="px-2.5 py-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-md flex items-center gap-1 transition-colors cursor-pointer disabled:opacity-50"
                            >
                              <ArrowRightCircle className="w-3 h-3" />
                              <span>Convert to Sale</span>
                            </button>
                          )}

                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onViewEstimate(tx);
                              setTimeout(() => window.print(), 300);
                            }}
                            title="Print Estimate"
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
                            title="Share via WhatsApp"
                            className="p-1.5 text-emerald-600 hover:text-emerald-800 hover:bg-emerald-50 rounded-lg transition-colors cursor-pointer"
                          >
                            <Share2 className="w-3.5 h-3.5" />
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
            <p className="font-semibold text-slate-600">No estimates or quotations found</p>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Create your first quotation using the &quot;Add Estimate&quot; button above.
            </p>
          </div>
        )}
      </div>

      {/* Floating 3-Dot Menu */}
      <FloatingRowMenu
        isOpen={!!activeMenuTxId && !!menuAnchorRect}
        onClose={() => {
          setActiveMenuTxId(null);
          setMenuAnchorRect(null);
        }}
        anchorRect={menuAnchorRect}
        items={floatingMenuItems}
        minWidth={230}
      />

      {/* Delete Confirmation */}
      <ConfirmDeleteModal
        isOpen={showDeleteConfirm}
        isLoading={isDeleting}
        onClose={() => {
          setShowDeleteConfirm(false);
          setTxToDelete(null);
        }}
        onConfirm={handleConfirmDelete}
        title="Delete Estimate"
        message="Delete this estimate/quotation? This cannot be undone."
        details={
          txToDelete
            ? `Estimate: ${txToDelete.invoiceNo} · Party: ${txToDelete.partyName} · Amount: ${formatINR(
                txToDelete.totalAmount
              )}`
            : undefined
        }
        confirmButtonText="Delete Estimate"
      />

      {/* History Modal */}
      <RecordHistoryModal
        isOpen={!!selectedTxForHistory}
        onClose={() => setSelectedTxForHistory(null)}
        recordTitle={selectedTxForHistory?.invoiceNo || 'Estimate History'}
        recordSubtitle={`Party: ${selectedTxForHistory?.partyName} · Amount: ${formatINR(
          selectedTxForHistory?.totalAmount || 0
        )}`}
        record={selectedTxForHistory}
      />
    </div>
  );
};
