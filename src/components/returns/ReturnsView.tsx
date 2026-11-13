import React, { useState, useEffect, useMemo } from 'react';
import {
  RotateCcw,
  Plus,
  Search,
  Eye,
  Edit2,
  Trash2,
  FileText,
  AlertTriangle,
} from 'lucide-react';
import { Transaction, Party, BusinessProfile } from '../../types';
import { getTransactions, getParties, deleteTransaction } from '../../db/indexedDB';
import { formatINR, formatDate } from '../../utils/formatters';
import { ConfirmDeleteModal } from '../common/ConfirmDeleteModal';
import { useToast } from '../common/Toast';
import { useSecurity } from '../../contexts/SecurityContext';

interface ReturnsViewProps {
  mode: 'sale_return' | 'purchase_return';
  businessProfile: BusinessProfile | null;
  onOpenCreateReturn: () => void;
  onEditReturn: (tx: Transaction) => void;
  onViewReturn: (tx: Transaction) => void;
  onRefreshMetrics: () => void;
}

export const ReturnsView: React.FC<ReturnsViewProps> = ({
  mode,
  businessProfile,
  onOpenCreateReturn,
  onEditReturn,
  onViewReturn,
  onRefreshMetrics,
}) => {
  const [returns, setReturns] = useState<Transaction[]>([]);
  const [parties, setParties] = useState<Party[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPartyId, setSelectedPartyId] = useState('all');
  const [dateFilter, setDateFilter] = useState<'all' | 'today' | 'this_month' | 'last_30_days'>('this_month');

  // Deletion modal state
  const [txToDelete, setTxToDelete] = useState<Transaction | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const { showToast } = useToast();
  const { requirePin } = useSecurity();

  const isSaleReturn = mode === 'sale_return';
  const heading = isSaleReturn ? 'Sale Returns (Credit Notes)' : 'Purchase Returns (Debit Notes)';

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [allTxs, partyList] = await Promise.all([
        getTransactions({ type: mode }),
        getParties(),
      ]);
      setReturns(allTxs);
      setParties(partyList);
    } catch (err) {
      console.error('Failed to load returns', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [mode]);

  const filteredReturns = useMemo(() => {
    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];

    return returns.filter((tx) => {
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchNo = (tx.invoiceNo || '').toLowerCase().includes(q);
        const matchParty = (tx.partyName || '').toLowerCase().includes(q);
        const matchOrig = (tx.originalInvoiceNo || '').toLowerCase().includes(q);
        const matchReason = (tx.returnReason || '').toLowerCase().includes(q);
        if (!matchNo && !matchParty && !matchOrig && !matchReason) return false;
      }

      if (selectedPartyId !== 'all' && tx.partyId !== selectedPartyId) {
        return false;
      }

      if (dateFilter === 'today') {
        if (tx.date !== todayStr) return false;
      } else if (dateFilter === 'this_month') {
        const txDate = new Date(tx.date);
        if (txDate.getMonth() !== now.getMonth() || txDate.getFullYear() !== now.getFullYear()) {
          return false;
        }
      } else if (dateFilter === 'last_30_days') {
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(now.getDate() - 30);
        if (new Date(tx.date) < thirtyDaysAgo) return false;
      }

      return true;
    });
  }, [returns, searchQuery, selectedPartyId, dateFilter]);

  const totalReturnAmount = useMemo(() => {
    return filteredReturns.reduce((sum, r) => sum + (r.totalAmount || 0), 0);
  }, [filteredReturns]);

  const handleDeleteConfirm = async () => {
    if (!txToDelete) return;
    setIsDeleting(true);
    try {
      const res = await deleteTransaction(txToDelete.id);
      if (res.success) {
        showToast(`${isSaleReturn ? 'Credit Note' : 'Debit Note'} ${txToDelete.invoiceNo} deleted`, 'success');
        setTxToDelete(null);
        await loadData();
        onRefreshMetrics();
      } else {
        showToast(res.error || 'Failed to delete return', 'error');
      }
    } catch (err: any) {
      showToast(err?.message || 'Failed to delete return', 'error');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${isSaleReturn ? 'bg-amber-100 text-amber-700' : 'bg-blue-100 text-blue-700'}`}>
              <RotateCcw className="w-5 h-5" />
            </div>
            <span>{heading}</span>
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            {isSaleReturn
              ? 'Manage customer returns, issue GST Credit Notes, restore stock, and reduce receivables'
              : 'Manage vendor returns, issue GST Debit Notes, deduct stock, and reduce payables'}
          </p>
        </div>

        <button
          type="button"
          onClick={onOpenCreateReturn}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold text-white rounded-lg shadow-sm transition-all transform active:scale-95 cursor-pointer ${
            isSaleReturn ? 'bg-amber-600 hover:bg-amber-700' : 'bg-blue-600 hover:bg-blue-700'
          }`}
        >
          <Plus className="w-4 h-4" />
          <span>{isSaleReturn ? 'Create Credit Note' : 'Create Debit Note'}</span>
        </button>
      </div>

      {/* Metric Cards Row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
          <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
            Total Return Value
          </span>
          <div className="text-2xl font-bold font-mono text-slate-900 mt-1">
            {formatINR(totalReturnAmount)}
          </div>
          <p className="text-[11px] text-slate-400 mt-0.5">In selected period</p>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
          <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
            Total Returns Count
          </span>
          <div className="text-2xl font-bold text-slate-900 font-mono mt-1">
            {filteredReturns.length}
          </div>
          <p className="text-[11px] text-slate-400 mt-0.5">Notes issued</p>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
          <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
            Total Tax Reversal
          </span>
          <div className="text-2xl font-bold text-rose-600 font-mono mt-1">
            {formatINR(filteredReturns.reduce((sum, r) => sum + (r.totalTax || 0), 0))}
          </div>
          <p className="text-[11px] text-slate-400 mt-0.5">GST reversed</p>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs flex flex-wrap items-center gap-3 text-xs">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={`Search ${isSaleReturn ? 'Credit Notes' : 'Debit Notes'}...`}
            className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-hidden focus:bg-white focus:border-rose-500"
          />
        </div>

        <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg">
          {(['all', 'today', 'this_month', 'last_30_days'] as const).map((period) => (
            <button
              key={period}
              type="button"
              onClick={() => setDateFilter(period)}
              className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors cursor-pointer capitalize ${
                dateFilter === period ? 'bg-white text-slate-900 shadow-2xs font-semibold' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {period.replace('_', ' ')}
            </button>
          ))}
        </div>

        <select
          value={selectedPartyId}
          onChange={(e) => setSelectedPartyId(e.target.value)}
          className="px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg"
        >
          <option value="all">All Parties</option>
          {parties.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
        {isLoading ? (
          <div className="p-12 text-center text-xs text-slate-400">Loading returns...</div>
        ) : filteredReturns.length === 0 ? (
          <div className="p-12 text-center text-xs text-slate-400 space-y-2">
            <p>No return records found.</p>
            <button
              type="button"
              onClick={onOpenCreateReturn}
              className="text-rose-600 font-semibold hover:underline cursor-pointer"
            >
              + Create your first {isSaleReturn ? 'Credit Note' : 'Debit Note'}
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200 text-[11px] uppercase">
                  <th className="py-2.5 px-4">Date</th>
                  <th className="py-2.5 px-4">{isSaleReturn ? 'Credit Note #' : 'Debit Note #'}</th>
                  <th className="py-2.5 px-4">Original Ref #</th>
                  <th className="py-2.5 px-4">Party Name</th>
                  <th className="py-2.5 px-4">Reason</th>
                  <th className="py-2.5 px-4 text-center">Items</th>
                  <th className="py-2.5 px-4 text-right">Tax (₹)</th>
                  <th className="py-2.5 px-4 text-right">Total Amount (₹)</th>
                  <th className="py-2.5 px-4 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredReturns.map((r) => (
                  <tr key={r.id} className="hover:bg-slate-50 transition-colors">
                    <td className="py-2.5 px-4 font-mono text-slate-600 whitespace-nowrap">
                      {formatDate(r.date)}
                    </td>
                    <td className="py-2.5 px-4 font-mono font-bold text-slate-900 whitespace-nowrap">
                      {r.invoiceNo}
                    </td>
                    <td className="py-2.5 px-4 font-mono text-blue-600 text-[11px]">
                      {r.originalInvoiceNo || '-'}
                    </td>
                    <td className="py-2.5 px-4 font-semibold text-slate-800">
                      {r.partyName}
                    </td>
                    <td className="py-2.5 px-4 text-slate-600">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-amber-50 text-amber-800 border border-amber-200">
                        {r.returnReason || 'Goods Returned'}
                      </span>
                    </td>
                    <td className="py-2.5 px-4 text-center font-mono text-slate-600">
                      {r.items.length}
                    </td>
                    <td className="py-2.5 px-4 text-right font-mono text-slate-700">
                      {formatINR(r.totalTax)}
                    </td>
                    <td className="py-2.5 px-4 text-right font-mono font-bold text-slate-900 tabular-nums">
                      {formatINR(r.totalAmount)}
                    </td>
                    <td className="py-2.5 px-4 text-center whitespace-nowrap">
                      <div className="flex items-center justify-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => onViewReturn(r)}
                          title="View / Print Note"
                          className="p-1 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-md transition-colors cursor-pointer"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={async () => {
                            if (await requirePin(`Enter PIN to edit ${r.invoiceNo}`)) {
                              onEditReturn(r);
                            }
                          }}
                          title="Edit Note"
                          className="p-1 text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded-md transition-colors cursor-pointer"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={async () => {
                            if (await requirePin(`Enter PIN to delete ${r.invoiceNo}`)) {
                              setTxToDelete(r);
                            }
                          }}
                          title="Delete Note"
                          className="p-1 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-md transition-colors cursor-pointer"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <ConfirmDeleteModal
        isOpen={Boolean(txToDelete)}
        onClose={() => setTxToDelete(null)}
        onConfirm={handleDeleteConfirm}
        title={`Delete ${isSaleReturn ? 'Credit Note' : 'Debit Note'}`}
        message={`Delete ${isSaleReturn ? 'credit note' : 'debit note'} ${txToDelete?.invoiceNo || ''}? This cannot be undone.`}
        details={`Deleting this ${isSaleReturn ? 'Credit Note' : 'Debit Note'} will revert the inventory adjustment and restore the original party balance.`}
        isLoading={isDeleting}
      />
    </div>
  );
};
