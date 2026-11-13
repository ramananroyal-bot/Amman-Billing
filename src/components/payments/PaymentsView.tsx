import React, { useState, useEffect, useMemo } from 'react';
import {
  IndianRupee,
  Plus,
  Search,
  Calendar,
  Filter,
  Eye,
  Edit2,
  Trash2,
  ArrowDownLeft,
  ArrowUpRight,
  Link as LinkIcon,
} from 'lucide-react';
import { Transaction, Party, FilterPeriod } from '../../types';
import { getTransactions, getParties, deleteTransaction } from '../../db/indexedDB';
import { formatINR, formatDate } from '../../utils/formatters';
import { ConfirmDeleteModal } from '../common/ConfirmDeleteModal';
import { useToast } from '../common/Toast';
import { useSecurity } from '../../contexts/SecurityContext';

interface PaymentsViewProps {
  mode: 'payment_in' | 'payment_out';
  onOpenRecordPayment: (party?: Party, tx?: Transaction) => void;
  onEditPayment: (tx: Transaction) => void;
  onViewPayment: (tx: Transaction) => void;
  onRefreshMetrics: () => void;
}

export const PaymentsView: React.FC<PaymentsViewProps> = ({
  mode,
  onOpenRecordPayment,
  onEditPayment,
  onViewPayment,
  onRefreshMetrics,
}) => {
  const [payments, setPayments] = useState<Transaction[]>([]);
  const [parties, setParties] = useState<Party[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPartyId, setSelectedPartyId] = useState('all');
  const [selectedPaymentMode, setSelectedPaymentMode] = useState('all');
  const [dateFilter, setDateFilter] = useState<'all' | 'today' | 'this_month' | 'last_30_days'>('this_month');

  // Deletion modal state
  const [paymentToDelete, setPaymentToDelete] = useState<Transaction | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const { showToast } = useToast();
  const { requirePin } = useSecurity();

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [allTxs, partyList] = await Promise.all([
        getTransactions({ type: mode }),
        getParties(),
      ]);
      setPayments(allTxs);
      setParties(partyList);
    } catch (err) {
      console.error('Failed to load payments', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [mode]);

  // Filtered payments list
  const filteredPayments = useMemo(() => {
    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];

    return payments.filter((tx) => {
      // 1. Text search
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchNo = (tx.invoiceNo || tx.receiptNo || '').toLowerCase().includes(q);
        const matchParty = (tx.partyName || '').toLowerCase().includes(q);
        const matchRef = (tx.referenceNo || '').toLowerCase().includes(q);
        const matchNotes = (tx.description || '').toLowerCase().includes(q);
        if (!matchNo && !matchParty && !matchRef && !matchNotes) return false;
      }

      // 2. Party filter
      if (selectedPartyId !== 'all' && tx.partyId !== selectedPartyId) {
        return false;
      }

      // 3. Payment mode
      if (selectedPaymentMode !== 'all' && tx.paymentType !== selectedPaymentMode) {
        return false;
      }

      // 4. Date filter
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
  }, [payments, searchQuery, selectedPartyId, selectedPaymentMode, dateFilter]);

  // Compute Total Card Metric
  const totalAmount = useMemo(() => {
    return filteredPayments.reduce((sum, p) => sum + (p.totalAmount || 0), 0);
  }, [filteredPayments]);

  const handleDeleteConfirm = async () => {
    if (!paymentToDelete) return;
    setIsDeleting(true);
    try {
      const res = await deleteTransaction(paymentToDelete.id);
      if (res.success) {
        showToast(`Payment ${paymentToDelete.invoiceNo} deleted successfully`, 'success');
        setPaymentToDelete(null);
        await loadData();
        onRefreshMetrics();
      } else {
        showToast(res.error || 'Failed to delete payment', 'error');
      }
    } catch (err: any) {
      showToast(err?.message || 'Failed to delete payment', 'error');
    } finally {
      setIsDeleting(false);
    }
  };

  const isIncome = mode === 'payment_in';

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-5">
      {/* Top Banner & Action */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${isIncome ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
              {isIncome ? <ArrowDownLeft className="w-5 h-5" /> : <ArrowUpRight className="w-5 h-5" />}
            </div>
            <span>{isIncome ? 'Payment-In (Money Received)' : 'Payment-Out (Money Paid)'}</span>
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            {isIncome
              ? 'Track payments received from customers and allocate to sales invoices'
              : 'Track payments made to vendors/suppliers and allocate to purchase bills'}
          </p>
        </div>

        <button
          type="button"
          onClick={() => onOpenRecordPayment()}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold text-white rounded-lg shadow-sm transition-all transform active:scale-95 cursor-pointer ${
            isIncome ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-rose-600 hover:bg-rose-700'
          }`}
        >
          <Plus className="w-4 h-4" />
          <span>{isIncome ? 'Record Payment-In' : 'Record Payment-Out'}</span>
        </button>
      </div>

      {/* Metric Cards Row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
          <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
            {isIncome ? 'Total Amount Received' : 'Total Amount Paid'}
          </span>
          <div className={`text-2xl font-bold font-mono mt-1 ${isIncome ? 'text-emerald-700' : 'text-rose-700'}`}>
            {formatINR(totalAmount)}
          </div>
          <p className="text-[11px] text-slate-400 mt-0.5">In selected filter period</p>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
          <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
            Number of Payments
          </span>
          <div className="text-2xl font-bold text-slate-900 font-mono mt-1">
            {filteredPayments.length}
          </div>
          <p className="text-[11px] text-slate-400 mt-0.5">Transactions recorded</p>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
          <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
            Linked to Invoices
          </span>
          <div className="text-2xl font-bold text-blue-700 font-mono mt-1">
            {filteredPayments.filter((p) => p.invoiceLinks && p.invoiceLinks.length > 0).length}
          </div>
          <p className="text-[11px] text-slate-400 mt-0.5">Directly allocated payments</p>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs flex flex-wrap items-center gap-3 text-xs">
        {/* Search */}
        <div className="relative flex-1 min-w-[200px]">
          <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by receipt #, party, reference..."
            className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-hidden focus:bg-white focus:border-rose-500"
          />
        </div>

        {/* Date Filter */}
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

        {/* Party Filter */}
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

        {/* Payment Mode */}
        <select
          value={selectedPaymentMode}
          onChange={(e) => setSelectedPaymentMode(e.target.value)}
          className="px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg"
        >
          <option value="all">All Modes</option>
          <option value="cash">Cash</option>
          <option value="upi">UPI</option>
          <option value="bank_transfer">Bank Transfer</option>
          <option value="cheque">Cheque</option>
        </select>
      </div>

      {/* Payments Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
        {isLoading ? (
          <div className="p-12 text-center text-xs text-slate-400">Loading payments...</div>
        ) : filteredPayments.length === 0 ? (
          <div className="p-12 text-center text-xs text-slate-400 space-y-2">
            <p>No payment records found.</p>
            <button
              type="button"
              onClick={() => onOpenRecordPayment()}
              className="text-rose-600 font-semibold hover:underline cursor-pointer"
            >
              + Record your first payment
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200 text-[11px] uppercase">
                  <th className="py-2.5 px-4">Date</th>
                  <th className="py-2.5 px-4">Receipt / Voucher #</th>
                  <th className="py-2.5 px-4">Party Name</th>
                  <th className="py-2.5 px-4">Payment Mode</th>
                  <th className="py-2.5 px-4">Reference No</th>
                  <th className="py-2.5 px-4 text-right">Amount (₹)</th>
                  <th className="py-2.5 px-4">Allocation</th>
                  <th className="py-2.5 px-4">Notes</th>
                  <th className="py-2.5 px-4 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredPayments.map((p) => {
                  const hasLinks = p.invoiceLinks && p.invoiceLinks.length > 0;
                  return (
                    <tr key={p.id} className="hover:bg-slate-50 transition-colors">
                      <td className="py-2.5 px-4 font-mono text-slate-600 whitespace-nowrap">
                        {formatDate(p.date)}
                      </td>
                      <td className="py-2.5 px-4 font-mono font-bold text-slate-900 whitespace-nowrap">
                        {p.invoiceNo || p.receiptNo || '-'}
                      </td>
                      <td className="py-2.5 px-4 font-semibold text-slate-800">
                        {p.partyName || 'Cash / Unregistered'}
                      </td>
                      <td className="py-2.5 px-4 capitalize text-slate-700 whitespace-nowrap">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 text-slate-800">
                          {p.paymentType ? p.paymentType.replace('_', ' ') : 'Cash'}
                        </span>
                      </td>
                      <td className="py-2.5 px-4 font-mono text-slate-500 text-[11px]">
                        {p.referenceNo || '-'}
                      </td>
                      <td className={`py-2.5 px-4 text-right font-mono font-bold tabular-nums whitespace-nowrap ${isIncome ? 'text-emerald-700' : 'text-rose-700'}`}>
                        {formatINR(p.totalAmount)}
                      </td>
                      <td className="py-2.5 px-4 text-[11px]">
                        {hasLinks ? (
                          <div className="flex items-center gap-1 text-blue-600 font-medium">
                            <LinkIcon className="w-3 h-3" />
                            <span>{p.invoiceLinks!.map((l) => l.invoiceNo).join(', ')}</span>
                          </div>
                        ) : (
                          <span className="text-slate-400 italic">On-account</span>
                        )}
                      </td>
                      <td className="py-2.5 px-4 text-slate-500 max-w-[150px] truncate" title={p.description}>
                        {p.description || '-'}
                      </td>
                      <td className="py-2.5 px-4 text-center whitespace-nowrap">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => onViewPayment(p)}
                            title="View / Print Receipt"
                            className="p-1 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-md transition-colors cursor-pointer"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={async () => {
                              if (await requirePin(`Enter PIN to edit ${p.invoiceNo || p.receiptNo || 'payment'}`)) {
                                onEditPayment(p);
                              }
                            }}
                            title="Edit Payment"
                            className="p-1 text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded-md transition-colors cursor-pointer"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={async () => {
                              if (await requirePin(`Enter PIN to delete ${p.invoiceNo || p.receiptNo || 'payment'}`)) {
                                setPaymentToDelete(p);
                              }
                            }}
                            title="Delete Payment"
                            className="p-1 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-md transition-colors cursor-pointer"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Confirm Delete Modal */}
      <ConfirmDeleteModal
        isOpen={Boolean(paymentToDelete)}
        onClose={() => setPaymentToDelete(null)}
        onConfirm={handleDeleteConfirm}
        title="Delete Payment Record"
        message={`Delete payment voucher ${paymentToDelete?.invoiceNo || ''}? This cannot be undone.`}
        details="Deleting this payment will reverse its effect on the party balance and restore any unpaid balances on linked invoices."
        isLoading={isDeleting}
      />
    </div>
  );
};
