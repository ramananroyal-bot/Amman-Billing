import React, { useState, useEffect, useMemo } from 'react';
import {
  Wrench,
  Search,
  Plus,
  MoreVertical,
  Edit,
  Trash2,
  Printer,
  Download,
  ArrowDownLeft,
  ArrowUpRight,
  CheckCircle2,
  Clock,
  Ban,
  History,
} from 'lucide-react';
import { BusinessProfile, Transaction } from '../../types';
import {
  getTransactions,
  getTransaction,
  cancelTransaction,
  deleteTransaction,
  convertJobWorkOutToIn,
} from '../../db/indexedDB';
import { formatINR, formatDate } from '../../utils/formatters';
import { AddSaleModal } from '../modals/AddSaleModal';
import { FloatingRowMenu, FloatingMenuItem } from '../common/FloatingRowMenu';
import { ConfirmDeleteModal } from '../common/ConfirmDeleteModal';
import { RecordHistoryModal } from '../common/RecordHistoryModal';
import { useToast } from '../common/Toast';
import { useSecurity } from '../../contexts/SecurityContext';

interface JobWorkViewProps {
  businessProfile: BusinessProfile | null;
  onViewChallanPrint: (tx: Transaction) => void;
  onRefreshMetrics?: () => void;
}

export const JobWorkView: React.FC<JobWorkViewProps> = ({
  businessProfile,
  onViewChallanPrint,
  onRefreshMetrics,
}) => {
  const { showToast } = useToast();
  const { requirePin } = useSecurity();

  const [records, setRecords] = useState<Transaction[]>([]);
  const [activeTab, setActiveTab] = useState<'all' | 'job_work_out' | 'job_work_in'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Modal state reusing AddSaleModal
  const [showModal, setShowModal] = useState(false);
  const [modalMode, setModalMode] = useState<'job_work_out' | 'job_work_in'>('job_work_out');
  const [txToEdit, setTxToEdit] = useState<Transaction | null>(null);

  // Floating 3-dot menu
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);
  const [menuAnchorRect, setMenuAnchorRect] = useState<DOMRect | null>(null);

  // Delete & History modals
  const [txToDelete, setTxToDelete] = useState<Transaction | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [historyTx, setHistoryTx] = useState<Transaction | null>(null);

  useEffect(() => {
    loadRecords();
  }, []);

  const loadRecords = async () => {
    const all = await getTransactions();
    const jobWorks = all.filter((t) => t.type === 'job_work_out' || t.type === 'job_work_in');
    setRecords(jobWorks);
  };

  const filteredRecords = useMemo(() => {
    return records.filter((r) => {
      if (activeTab === 'job_work_out' && r.type !== 'job_work_out') return false;
      if (activeTab === 'job_work_in' && r.type !== 'job_work_in') return false;

      const q = searchQuery.toLowerCase().trim();
      if (!q) return true;
      return (
        r.invoiceNo.toLowerCase().includes(q) ||
        r.partyName.toLowerCase().includes(q) ||
        (r.processType && r.processType.toLowerCase().includes(q)) ||
        r.items.some((i) => i.name.toLowerCase().includes(q))
      );
    });
  }, [records, activeTab, searchQuery]);

  // Metrics from real IndexedDB records
  const outRecords = records.filter((r) => r.type === 'job_work_out' && r.status === 'active');
  const openOutRecords = outRecords.filter((r) => (r.jobWorkStatus || 'sent') !== 'completed');
  const inRecords = records.filter((r) => r.type === 'job_work_in' && r.status === 'active');

  const handleOpenCreate = (type: 'job_work_out' | 'job_work_in') => {
    setTxToEdit(null);
    setModalMode(type);
    setShowModal(true);
  };

  const handleReceiveGoods = async (outTx: Transaction) => {
    try {
      const inTx = await convertJobWorkOutToIn(outTx.id);
      await loadRecords();
      if (onRefreshMetrics) onRefreshMetrics();
      showToast(
        `Received back as ${inTx.invoiceNo}. Stock restored and ${outTx.invoiceNo} marked completed.`,
        'success'
      );
    } catch (err: any) {
      showToast(err?.message || 'Failed to receive job work goods', 'error');
    }
  };

  const handleAction = async (action: string, id: string) => {
    setActiveMenuId(null);
    setMenuAnchorRect(null);

    const tx = await getTransaction(id);
    if (!tx) {
      showToast('Job work challan not found', 'error');
      return;
    }

    try {
      switch (action) {
        case 'view_edit': {
          const allowed = await requirePin(`Enter PIN to edit ${tx.invoiceNo}`);
          if (!allowed) return;
          setModalMode(tx.type === 'job_work_in' ? 'job_work_in' : 'job_work_out');
          setTxToEdit(tx);
          setShowModal(true);
          break;
        }
        case 'receive_back':
          await handleReceiveGoods(tx);
          break;
        case 'open_pdf':
          onViewChallanPrint(tx);
          break;
        case 'print':
          onViewChallanPrint(tx);
          setTimeout(() => window.print(), 300);
          break;
        case 'cancel': {
          if (tx.status === 'cancelled') {
            showToast('Challan is already cancelled', 'info');
            return;
          }
          const allowed = await requirePin(`Enter PIN to cancel ${tx.invoiceNo}`);
          if (!allowed) return;
          await cancelTransaction(tx.id);
          await loadRecords();
          if (onRefreshMetrics) onRefreshMetrics();
          showToast(`Job Work ${tx.invoiceNo} cancelled and stock adjusted.`, 'info');
          break;
        }
        case 'delete': {
          const allowed = await requirePin(`Enter PIN to delete ${tx.invoiceNo}`);
          if (!allowed) return;
          setTxToDelete(tx);
          setShowDeleteConfirm(true);
          break;
        }
        case 'history':
          setHistoryTx(tx);
          break;
      }
    } catch (err: any) {
      showToast(err?.message || 'Action failed', 'error');
    }
  };

  const handleConfirmDelete = async () => {
    if (!txToDelete) return;
    setIsDeleting(true);
    try {
      const res = await deleteTransaction(txToDelete.id);
      if (!res.success) {
        showToast(res.error || 'Delete failed', 'error');
        return;
      }
      showToast(`Deleted ${txToDelete.invoiceNo}`, 'success');
      setShowDeleteConfirm(false);
      setTxToDelete(null);
      await loadRecords();
      if (onRefreshMetrics) onRefreshMetrics();
    } catch (err: any) {
      showToast(err?.message || 'Delete failed', 'error');
    } finally {
      setIsDeleting(false);
    }
  };

  const currentMenuTx = records.find((r) => r.id === activeMenuId);
  const menuItems: FloatingMenuItem[] = currentMenuTx
    ? [
        {
          label: 'View / Edit',
          action: 'view_edit',
          icon: <Edit className="w-3.5 h-3.5" />,
          onClick: () => handleAction('view_edit', currentMenuTx.id),
        },
        ...(currentMenuTx.type === 'job_work_out' &&
        currentMenuTx.status === 'active' &&
        currentMenuTx.jobWorkStatus !== 'completed'
          ? [
              {
                label: 'Receive Goods (Job Work In)',
                action: 'receive_back',
                icon: <ArrowDownLeft className="w-3.5 h-3.5 text-teal-600" />,
                onClick: () => handleAction('receive_back', currentMenuTx.id),
              },
            ]
          : []),
        {
          label: 'Print / Preview',
          action: 'print',
          icon: <Printer className="w-3.5 h-3.5" />,
          onClick: () => handleAction('print', currentMenuTx.id),
        },
        {
          label: 'Open PDF',
          action: 'open_pdf',
          icon: <Download className="w-3.5 h-3.5" />,
          onClick: () => handleAction('open_pdf', currentMenuTx.id),
        },
        {
          label: 'Record History',
          action: 'history',
          icon: <History className="w-3.5 h-3.5" />,
          onClick: () => handleAction('history', currentMenuTx.id),
        },
        {
          label: 'Cancel',
          action: 'cancel',
          icon: <Ban className="w-3.5 h-3.5" />,
          danger: true,
          dividerBefore: true,
          onClick: () => handleAction('cancel', currentMenuTx.id),
        },
        {
          label: 'Delete',
          action: 'delete',
          icon: <Trash2 className="w-3.5 h-3.5" />,
          danger: true,
          onClick: () => handleAction('delete', currentMenuTx.id),
        },
      ]
    : [];

  return (
    <div className="h-full flex flex-col bg-slate-50 overflow-hidden font-sans">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 px-6 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
            <Wrench className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-base font-bold text-slate-900">Job Work Challans (Out &amp; In)</h1>
            <p className="text-xs text-slate-500">
              Send raw materials out for processing and receive finished goods back into stock
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => handleOpenCreate('job_work_out')}
            className="px-3.5 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-xs flex items-center gap-1.5 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Job Work Out</span>
          </button>
          <button
            type="button"
            onClick={() => handleOpenCreate('job_work_in')}
            className="px-3.5 py-2 text-xs font-semibold text-white bg-teal-600 hover:bg-teal-700 rounded-lg shadow-xs flex items-center gap-1.5 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Job Work In</span>
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-5">
        {/* KPI Row */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs flex items-center justify-between">
            <div>
              <div className="text-xs text-slate-500 font-medium">Total Sent Out (Job Work Out)</div>
              <div className="text-xl font-bold text-slate-900 mt-1 font-mono">{outRecords.length}</div>
            </div>
            <div className="w-10 h-10 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <ArrowUpRight className="w-5 h-5" />
            </div>
          </div>

          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs flex items-center justify-between">
            <div>
              <div className="text-xs text-slate-500 font-medium">Open / At Job Worker</div>
              <div className="text-xl font-bold text-amber-600 mt-1 font-mono">
                {openOutRecords.length} Challans
              </div>
            </div>
            <div className="w-10 h-10 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
              <Clock className="w-5 h-5" />
            </div>
          </div>

          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs flex items-center justify-between">
            <div>
              <div className="text-xs text-slate-500 font-medium">Received Back (Job Work In)</div>
              <div className="text-xl font-bold text-teal-600 mt-1 font-mono">{inRecords.length}</div>
            </div>
            <div className="w-10 h-10 rounded-lg bg-teal-50 text-teal-600 flex items-center justify-center">
              <ArrowDownLeft className="w-5 h-5" />
            </div>
          </div>
        </div>

        {/* Filter & Tabs */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
          <div className="p-4 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg">
              {[
                { id: 'all', label: `All (${records.length})` },
                { id: 'job_work_out', label: 'Job Work Out' },
                { id: 'job_work_in', label: 'Job Work In' },
              ].map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setActiveTab(t.id as any)}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors cursor-pointer ${
                    activeTab === t.id
                      ? 'bg-white text-slate-900 shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>

            <div className="relative w-full sm:w-72">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search challan no, job worker, process..."
                className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-slate-900"
              />
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200 uppercase text-[11px]">
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-4">Challan No</th>
                  <th className="py-3 px-4">Type</th>
                  <th className="py-3 px-4">Job Worker / Party</th>
                  <th className="py-3 px-4">Process / Items</th>
                  <th className="py-3 px-4 text-right">Material Value</th>
                  <th className="py-3 px-4 text-center">Status</th>
                  <th className="py-3 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredRecords.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-slate-400">
                      No Job Work challans recorded yet. Click <strong>+ Job Work Out</strong> to send goods for processing.
                    </td>
                  </tr>
                ) : (
                  filteredRecords.map((tx) => {
                    const isOut = tx.type === 'job_work_out';
                    const isCompleted = isOut && tx.jobWorkStatus === 'completed';
                    return (
                      <tr key={tx.id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="py-3 px-4 font-mono text-slate-600">{formatDate(tx.date)}</td>
                        <td className="py-3 px-4 font-mono font-bold text-slate-900">{tx.invoiceNo}</td>
                        <td className="py-3 px-4">
                          <span
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                              isOut
                                ? 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                                : 'bg-teal-50 text-teal-700 border border-teal-200'
                            }`}
                          >
                            {isOut ? 'Job Work Out' : 'Job Work In'}
                          </span>
                        </td>
                        <td className="py-3 px-4 font-medium text-slate-800">{tx.partyName}</td>
                        <td className="py-3 px-4 text-slate-600">
                          {tx.processType && (
                            <span className="font-semibold text-slate-800 mr-1.5">[{tx.processType}]</span>
                          )}
                          <span className="text-[11px] text-slate-500">
                            {tx.items.map((i) => `${i.name} (${i.qty} ${i.unit})`).join(', ')}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right font-mono font-semibold text-slate-900">
                          {formatINR(tx.totalAmount)}
                        </td>
                        <td className="py-3 px-4 text-center">
                          {tx.status === 'cancelled' ? (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-700">
                              Cancelled
                            </span>
                          ) : isOut ? (
                            isCompleted ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700">
                                <CheckCircle2 className="w-3 h-3" />
                                Completed
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700">
                                <Clock className="w-3 h-3" />
                                Out for Work
                              </span>
                            )
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-teal-50 text-teal-700">
                              <CheckCircle2 className="w-3 h-3" />
                              Received
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            {isOut && tx.status === 'active' && !isCompleted && (
                              <button
                                type="button"
                                onClick={() => handleReceiveGoods(tx)}
                                className="px-2.5 py-1 text-[11px] font-semibold bg-teal-600 hover:bg-teal-700 text-white rounded-md cursor-pointer"
                              >
                                Receive Back
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={(e) => {
                                setMenuAnchorRect(e.currentTarget.getBoundingClientRect());
                                setActiveMenuId(tx.id);
                              }}
                              className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-md cursor-pointer"
                            >
                              <MoreVertical className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Floating 3-dot Menu */}
      <FloatingRowMenu
        isOpen={Boolean(activeMenuId && menuAnchorRect)}
        anchorRect={menuAnchorRect}
        onClose={() => {
          setActiveMenuId(null);
          setMenuAnchorRect(null);
        }}
        items={menuItems}
      />

      {/* Reused AddSaleModal for Job Work Out & Job Work In */}
      {businessProfile && (
        <AddSaleModal
          isOpen={showModal}
          onClose={() => {
            setShowModal(false);
            setTxToEdit(null);
          }}
          businessProfile={businessProfile}
          initialType={modalMode}
          transactionToEdit={txToEdit}
          onSaved={async () => {
            await loadRecords();
            if (onRefreshMetrics) onRefreshMetrics();
          }}
        />
      )}

      <ConfirmDeleteModal
        isOpen={showDeleteConfirm}
        onClose={() => {
          setShowDeleteConfirm(false);
          setTxToDelete(null);
        }}
        onConfirm={handleConfirmDelete}
        title="Delete Job Work Challan"
        message={
          txToDelete
            ? `Delete challan ${txToDelete.invoiceNo}? Inventory stock adjustments will be reversed automatically.`
            : 'Delete this challan?'
        }
        confirmButtonText="Delete"
        isLoading={isDeleting}
      />

      <RecordHistoryModal
        isOpen={Boolean(historyTx)}
        onClose={() => setHistoryTx(null)}
        recordTitle={historyTx?.invoiceNo || 'Job Work History'}
        recordSubtitle={`Party: ${historyTx?.partyName || ''} · Value: ${formatINR(historyTx?.totalAmount || 0)}`}
        record={historyTx}
      />
    </div>
  );
};
