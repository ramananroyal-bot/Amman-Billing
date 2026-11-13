import React, { useState, useEffect, useMemo } from 'react';
import {
  Receipt,
  Plus,
  Search,
  Filter,
  Calendar,
  Eye,
  Edit2,
  Trash2,
  Tag,
  FolderPlus,
  X,
} from 'lucide-react';
import { Expense, ExpenseCategory } from '../../types';
import {
  getExpenses,
  getExpenseCategories,
  deleteExpense,
  saveExpenseCategory,
  deleteExpenseCategory,
} from '../../db/indexedDB';
import { formatINR, formatDate } from '../../utils/formatters';
import { ConfirmDeleteModal } from '../common/ConfirmDeleteModal';
import { useToast } from '../common/Toast';
import { useSecurity } from '../../contexts/SecurityContext';

interface ExpensesViewProps {
  onOpenAddExpense: () => void;
  onEditExpense: (exp: Expense) => void;
  onRefreshMetrics: () => void;
}

export const ExpensesView: React.FC<ExpensesViewProps> = ({
  onOpenAddExpense,
  onEditExpense,
  onRefreshMetrics,
}) => {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [categories, setCategories] = useState<ExpenseCategory[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedPaymentMode, setSelectedPaymentMode] = useState('all');
  const [dateFilter, setDateFilter] = useState<'all' | 'today' | 'this_month' | 'last_30_days'>('this_month');

  // Deletion modal state
  const [expenseToDelete, setExpenseToDelete] = useState<Expense | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Manage categories modal state
  const [showCategoryManager, setShowCategoryManager] = useState(false);
  const [newCatName, setNewCatName] = useState('');

  const { showToast } = useToast();
  const { requirePin } = useSecurity();

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [allExpenses, allCats] = await Promise.all([
        getExpenses(),
        getExpenseCategories(),
      ]);
      setExpenses(allExpenses);
      setCategories(allCats);
    } catch (e) {
      console.error('Failed to load expenses', e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const filteredExpenses = useMemo(() => {
    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];

    return expenses.filter((e) => {
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchNo = (e.expenseNo || '').toLowerCase().includes(q);
        const matchCat = (e.category || '').toLowerCase().includes(q);
        const matchParty = (e.partyName || '').toLowerCase().includes(q);
        const matchNotes = (e.notes || '').toLowerCase().includes(q);
        if (!matchNo && !matchCat && !matchParty && !matchNotes) return false;
      }

      if (selectedCategory !== 'all' && e.category !== selectedCategory) {
        return false;
      }

      if (selectedPaymentMode !== 'all' && e.paymentType !== selectedPaymentMode) {
        return false;
      }

      if (dateFilter === 'today') {
        if (e.date !== todayStr) return false;
      } else if (dateFilter === 'this_month') {
        const d = new Date(e.date);
        if (d.getMonth() !== now.getMonth() || d.getFullYear() !== now.getFullYear()) {
          return false;
        }
      } else if (dateFilter === 'last_30_days') {
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(now.getDate() - 30);
        if (new Date(e.date) < thirtyDaysAgo) return false;
      }

      return true;
    });
  }, [expenses, searchQuery, selectedCategory, selectedPaymentMode, dateFilter]);

  const totalExpenseAmount = useMemo(() => {
    return filteredExpenses.reduce((sum, e) => sum + (e.amount || 0), 0);
  }, [filteredExpenses]);

  // Top category by spending
  const topCategory = useMemo(() => {
    if (filteredExpenses.length === 0) return null;
    const catTotals: Record<string, number> = {};
    for (const exp of filteredExpenses) {
      catTotals[exp.category] = (catTotals[exp.category] || 0) + exp.amount;
    }
    const sorted = Object.entries(catTotals).sort((a, b) => b[1] - a[1]);
    return sorted[0] ? { name: sorted[0][0], amount: sorted[0][1] } : null;
  }, [filteredExpenses]);

  const handleDeleteConfirm = async () => {
    if (!expenseToDelete) return;
    setIsDeleting(true);
    try {
      await deleteExpense(expenseToDelete.id);
      showToast(`Expense ${expenseToDelete.expenseNo} deleted`, 'success');
      setExpenseToDelete(null);
      await loadData();
      onRefreshMetrics();
    } catch (err: any) {
      showToast(err?.message || 'Failed to delete expense', 'error');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleAddCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCatName.trim()) return;
    try {
      const created = await saveExpenseCategory({ name: newCatName.trim() });
      setCategories([...categories, created]);
      setNewCatName('');
      showToast(`Category "${created.name}" created`, 'success');
    } catch (err: any) {
      showToast(err?.message || 'Failed to create category', 'error');
    }
  };

  const handleDeleteCategory = async (id: string, name: string) => {
    try {
      await deleteExpenseCategory(id);
      setCategories(categories.filter((c) => c.id !== id));
      showToast(`Category "${name}" deleted`, 'info');
    } catch (err: any) {
      showToast(err?.message || 'Failed to delete category', 'error');
    }
  };

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-5">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-rose-100 text-rose-700 flex items-center justify-center">
              <Receipt className="w-5 h-5" />
            </div>
            <span>Business Expenses</span>
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Record, categorize, and control company expenditures for accurate Profit & Loss calculation
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={() => setShowCategoryManager(true)}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-slate-300 rounded-lg shadow-2xs transition-colors cursor-pointer"
          >
            <Tag className="w-3.5 h-3.5 text-slate-500" />
            <span>Manage Categories</span>
          </button>

          <button
            type="button"
            onClick={onOpenAddExpense}
            className="flex items-center gap-2 px-4 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-lg shadow-sm transition-all transform active:scale-95 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Record Expense</span>
          </button>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
          <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
            Total Expenses
          </span>
          <div className="text-2xl font-bold font-mono text-rose-700 mt-1">
            {formatINR(totalExpenseAmount)}
          </div>
          <p className="text-[11px] text-slate-400 mt-0.5">In selected period</p>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
          <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
            Top Expense Category
          </span>
          <div className="text-xl font-bold text-slate-900 truncate mt-1">
            {topCategory ? topCategory.name : 'None'}
          </div>
          <p className="text-[11px] text-slate-400 mt-0.5">
            {topCategory ? `${formatINR(topCategory.amount)} spent` : 'No expenses in period'}
          </p>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
          <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
            Number of Expense Entries
          </span>
          <div className="text-2xl font-bold text-slate-900 font-mono mt-1">
            {filteredExpenses.length}
          </div>
          <p className="text-[11px] text-slate-400 mt-0.5">Recorded items</p>
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
            placeholder="Search by voucher #, category, notes..."
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
          value={selectedCategory}
          onChange={(e) => setSelectedCategory(e.target.value)}
          className="px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg"
        >
          <option value="all">All Categories</option>
          {categories.map((c) => (
            <option key={c.id} value={c.name}>
              {c.name}
            </option>
          ))}
        </select>

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

      {/* Expenses Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
        {isLoading ? (
          <div className="p-12 text-center text-xs text-slate-400">Loading expenses...</div>
        ) : filteredExpenses.length === 0 ? (
          <div className="p-12 text-center text-xs text-slate-400 space-y-2">
            <p>No business expenses recorded in this period.</p>
            <button
              type="button"
              onClick={onOpenAddExpense}
              className="text-rose-600 font-semibold hover:underline cursor-pointer"
            >
              + Record your first business expense
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200 text-[11px] uppercase">
                  <th className="py-2.5 px-4">Date</th>
                  <th className="py-2.5 px-4">Expense Voucher #</th>
                  <th className="py-2.5 px-4">Category</th>
                  <th className="py-2.5 px-4">Payment Mode</th>
                  <th className="py-2.5 px-4">Paid To</th>
                  <th className="py-2.5 px-4 text-right">Amount (₹)</th>
                  <th className="py-2.5 px-4">GST / ITC</th>
                  <th className="py-2.5 px-4">Notes</th>
                  <th className="py-2.5 px-4 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredExpenses.map((e) => (
                  <tr key={e.id} className="hover:bg-slate-50 transition-colors">
                    <td className="py-2.5 px-4 font-mono text-slate-600 whitespace-nowrap">
                      {formatDate(e.date)}
                    </td>
                    <td className="py-2.5 px-4 font-mono font-bold text-slate-900 whitespace-nowrap">
                      {e.expenseNo}
                    </td>
                    <td className="py-2.5 px-4">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 text-slate-800">
                        {e.category}
                      </span>
                    </td>
                    <td className="py-2.5 px-4 capitalize text-slate-600 whitespace-nowrap">
                      {e.paymentType.replace('_', ' ')}
                    </td>
                    <td className="py-2.5 px-4 text-slate-800">
                      {e.partyName || '-'}
                    </td>
                    <td className="py-2.5 px-4 text-right font-mono font-bold text-rose-700 tabular-nums whitespace-nowrap">
                      {formatINR(e.amount)}
                    </td>
                    <td className="py-2.5 px-4 text-[11px]">
                      {e.gstAmount ? (
                        <span className="text-emerald-700 font-semibold font-mono">
                          ITC: {formatINR(e.gstAmount)} ({e.taxRate}%)
                        </span>
                      ) : (
                        <span className="text-slate-400">-</span>
                      )}
                    </td>
                    <td className="py-2.5 px-4 text-slate-500 max-w-[180px] truncate" title={e.notes}>
                      {e.notes || '-'}
                    </td>
                    <td className="py-2.5 px-4 text-center whitespace-nowrap">
                      <div className="flex items-center justify-center gap-1.5">
                        <button
                          type="button"
                          onClick={async () => {
                            if (await requirePin(`Enter PIN to edit ${e.expenseNo}`)) {
                              onEditExpense(e);
                            }
                          }}
                          title="Edit Expense"
                          className="p-1 text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded-md transition-colors cursor-pointer"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={async () => {
                            if (await requirePin(`Enter PIN to delete ${e.expenseNo}`)) {
                              setExpenseToDelete(e);
                            }
                          }}
                          title="Delete Expense"
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

      {/* Category Manager Modal */}
      {showCategoryManager && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="w-full max-w-md bg-white rounded-xl shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-100">
            <div className="flex items-center justify-between px-5 py-3.5 bg-slate-900 text-white">
              <div className="flex items-center gap-2">
                <Tag className="w-4 h-4 text-rose-400" />
                <h3 className="text-sm font-bold">Manage Expense Categories</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowCategoryManager(false)}
                className="text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-4 text-xs">
              {/* Add form */}
              <form onSubmit={handleAddCategory} className="flex gap-2">
                <input
                  type="text"
                  required
                  value={newCatName}
                  onChange={(e) => setNewCatName(e.target.value)}
                  placeholder="New category name..."
                  className="flex-1 px-3 py-1.5 text-xs bg-white border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-rose-500"
                />
                <button
                  type="submit"
                  className="px-3.5 py-1.5 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-lg cursor-pointer flex items-center gap-1"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add</span>
                </button>
              </form>

              {/* List */}
              <div className="max-h-64 overflow-y-auto divide-y divide-slate-100 border border-slate-200 rounded-lg">
                {categories.map((c) => (
                  <div key={c.id} className="flex items-center justify-between px-3 py-2 hover:bg-slate-50">
                    <span className="font-semibold text-slate-800">{c.name}</span>
                    <button
                      type="button"
                      onClick={() => handleDeleteCategory(c.id, c.name)}
                      className="text-slate-400 hover:text-rose-600 p-1 rounded-sm cursor-pointer"
                      title="Delete category"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>

              <div className="flex justify-end pt-2">
                <button
                  type="button"
                  onClick={() => setShowCategoryManager(false)}
                  className="px-4 py-1.5 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg cursor-pointer"
                >
                  Done
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirmation modal */}
      <ConfirmDeleteModal
        isOpen={Boolean(expenseToDelete)}
        onClose={() => setExpenseToDelete(null)}
        onConfirm={handleDeleteConfirm}
        title="Delete Expense Record"
        message={`Delete expense voucher ${expenseToDelete?.expenseNo || ''}? This cannot be undone.`}
        details="Are you sure you want to permanently delete this expense record? It will be removed from your Profit & Loss figures and daybook reports."
        isLoading={isDeleting}
      />
    </div>
  );
};
