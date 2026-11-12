import React, { useState } from 'react';
import {
  TrendingUp,
  ArrowDownLeft,
  ArrowUpRight,
  FileSpreadsheet,
  BookOpen,
  Calendar,
  Users,
  Plus,
  MoreVertical,
  Printer,
  Ban,
  Trash2,
  Eye,
  FileText,
} from 'lucide-react';
import { DashboardMetrics, FilterPeriod, Transaction } from '../../types';
import { formatINR, formatDate } from '../../utils/formatters';

interface HomeViewProps {
  metrics: DashboardMetrics;
  selectedPeriod: FilterPeriod;
  onPeriodChange: (period: FilterPeriod) => void;
  onOpenAddSale: () => void;
  onOpenAddPurchase: () => void;
  onViewTransaction: (tx: Transaction) => void;
  onCancelTransaction: (tx: Transaction) => void;
  onDeleteTransaction: (tx: Transaction) => void;
  onOpenReport: (reportType: string) => void;
}

export const HomeView: React.FC<HomeViewProps> = ({
  metrics,
  selectedPeriod,
  onPeriodChange,
  onOpenAddSale,
  onOpenAddPurchase,
  onViewTransaction,
  onCancelTransaction,
  onDeleteTransaction,
  onOpenReport,
}) => {
  const [activeMenuTxId, setActiveMenuTxId] = useState<string | null>(null);

  // Toggle 3-dot action menu
  const toggleMenu = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setActiveMenuTxId((prev) => (prev === id ? null : id));
  };

  // Close menus on outside click
  React.useEffect(() => {
    const handleClickOutside = () => setActiveMenuTxId(null);
    window.addEventListener('click', handleClickOutside);
    return () => window.removeEventListener('click', handleClickOutside);
  }, []);

  // Compute chart max for SVG scaling
  const maxSaleAmount = Math.max(
    ...metrics.salesByDay.map((d) => d.amount),
    1000
  );

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto">
      {/* Top Metric Cards: Receivable, Payable, Sales */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {/* Total Receivable */}
        <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-2xs hover:shadow-xs transition-shadow">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Total Receivable
            </span>
            <div className="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center text-emerald-600">
              <ArrowDownLeft className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold text-slate-900 font-mono tracking-tight tabular-nums">
              {formatINR(metrics.totalReceivable)}
            </div>
            <p className="mt-1 text-xs text-slate-400">
              From unpaid sales & customer opening balances
            </p>
          </div>
        </div>

        {/* Total Payable */}
        <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-2xs hover:shadow-xs transition-shadow">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Total Payable
            </span>
            <div className="w-8 h-8 rounded-lg bg-rose-50 flex items-center justify-center text-rose-600">
              <ArrowUpRight className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold text-slate-900 font-mono tracking-tight tabular-nums">
              {formatINR(metrics.totalPayable)}
            </div>
            <p className="mt-1 text-xs text-slate-400">
              To suppliers for unpaid purchase bills
            </p>
          </div>
        </div>

        {/* Total Sales in Period */}
        <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-2xs hover:shadow-xs transition-shadow">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Total Sales
            </span>
            <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center text-blue-600">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold text-slate-900 font-mono tracking-tight tabular-nums">
              {formatINR(metrics.totalSale)}
            </div>
            <div className="mt-1 flex items-center gap-2">
              {metrics.saleChangePercent !== null ? (
                <span
                  className={`text-xs font-semibold ${
                    metrics.saleChangePercent >= 0 ? 'text-emerald-600' : 'text-rose-600'
                  }`}
                >
                  {metrics.saleChangePercent >= 0 ? '+' : ''}
                  {metrics.saleChangePercent}% vs last month
                </span>
              ) : (
                <span className="text-xs text-slate-400">
                  {metrics.lastMonthSale > 0
                    ? `Last month: ${formatINR(metrics.lastMonthSale)}`
                    : 'No prior month data to compare'}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Profit and Loss figure on Home (Profit = sales - purchases - expenses, shown only when data exists) */}
      {metrics.netProfit !== null && metrics.netProfit !== undefined && (
        <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 rounded-xl p-5 text-white shadow-2xs border border-slate-700">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-700/60">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-rose-500/20 text-rose-400 flex items-center justify-center">
                <TrendingUp className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white tracking-tight">
                  Net Profit & Loss ({metrics.period.replace('_', ' ')})
                </h3>
                <p className="text-[11px] text-slate-400">
                  Formula: Profit = Sales ({formatINR(metrics.totalSale)}) - Purchases ({formatINR(metrics.totalPurchase || 0)}) - Expenses ({formatINR(metrics.totalExpenses || 0)})
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => onOpenReport('profit_loss')}
              className="text-xs text-rose-400 hover:text-rose-300 font-medium transition-colors cursor-pointer self-start sm:self-center"
            >
              View Detailed P&L &rarr;
            </button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-4">
            <div>
              <span className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold block">Sales Revenue (+)</span>
              <div className="text-lg font-bold font-mono text-emerald-400 mt-0.5">{formatINR(metrics.totalSale)}</div>
            </div>
            <div>
              <span className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold block">Purchases (-)</span>
              <div className="text-lg font-bold font-mono text-blue-400 mt-0.5">{formatINR(metrics.totalPurchase || 0)}</div>
            </div>
            <div>
              <span className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold block">Expenses (-)</span>
              <div className="text-lg font-bold font-mono text-amber-400 mt-0.5">{formatINR(metrics.totalExpenses || 0)}</div>
            </div>
            <div>
              <span className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold block">Net Profit</span>
              <div className={`text-xl font-bold font-mono mt-0.5 ${metrics.netProfit >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                {formatINR(metrics.netProfit)}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Total Sale Chart Section with "This Month" filter */}
      <div className="bg-white rounded-xl p-5 sm:p-6 border border-slate-200 shadow-2xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
          <div>
            <h2 className="text-base font-bold text-slate-900">Total Sale Timeline</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Calculated dynamically from confirmed active GST sale invoices
            </p>
          </div>

          <div className="flex items-center gap-3">
            <select
              value={selectedPeriod}
              onChange={(e) => onPeriodChange(e.target.value as FilterPeriod)}
              className="px-3 py-1.5 text-xs font-medium bg-slate-50 border border-slate-300 rounded-lg text-slate-700 focus:outline-hidden focus:ring-1 focus:ring-slate-900 cursor-pointer"
            >
              <option value="this_month">This Month</option>
              <option value="last_30_days">Last 30 Days</option>
              <option value="this_quarter">This Quarter</option>
              <option value="this_year">This Fiscal Year</option>
              <option value="all">All Time</option>
            </select>

            <button
              type="button"
              onClick={onOpenAddSale}
              className="px-3 py-1.5 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 rounded-lg shadow-2xs flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Sale</span>
            </button>
          </div>
        </div>

        {/* Chart View or Empty State */}
        <div className="pt-6">
          {metrics.salesByDay.length > 0 ? (
            <div>
              {/* Daily Sales Bar / Area Chart */}
              <div className="h-48 w-full flex items-end gap-2 pt-6 pb-2 px-2 overflow-x-auto">
                {metrics.salesByDay.map((day) => {
                  const heightPercent = Math.max(Math.round((day.amount / maxSaleAmount) * 100), 8);
                  return (
                    <div
                      key={day.date}
                      className="flex-1 min-w-[28px] max-w-[48px] flex flex-col items-center group relative cursor-pointer"
                    >
                      {/* Tooltip */}
                      <div className="absolute -top-10 opacity-0 group-hover:opacity-100 transition-opacity bg-slate-900 text-white text-[11px] px-2 py-1 rounded-md shadow-md pointer-events-none whitespace-nowrap z-10 font-mono">
                        {formatDate(day.date)}: {formatINR(day.amount)}
                      </div>
                      {/* Bar */}
                      <div
                        style={{ height: `${heightPercent}%` }}
                        className="w-full bg-rose-500/80 group-hover:bg-rose-600 rounded-t-sm transition-all"
                      />
                      {/* Date label */}
                      <span className="text-[10px] text-slate-400 mt-2 truncate w-full text-center">
                        {day.date.split('-')[2]}
                      </span>
                    </div>
                  );
                })}
              </div>
              <div className="flex items-center justify-between text-[11px] text-slate-400 border-t border-slate-100 pt-2 px-1">
                <span>0</span>
                <span>Peak: {formatINR(maxSaleAmount)}</span>
              </div>
            </div>
          ) : (
            <div className="py-12 flex flex-col items-center justify-center text-center">
              <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 mb-3">
                <TrendingUp className="w-6 h-6" />
              </div>
              <h3 className="text-sm font-semibold text-slate-800">No Sales Recorded for this Period</h3>
              <p className="text-xs text-slate-500 max-w-sm mt-1">
                Every sale invoice you generate will automatically plot its date and tax-inclusive amount here.
              </p>
              <button
                type="button"
                onClick={onOpenAddSale}
                className="mt-4 px-4 py-2 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 rounded-lg shadow-xs transition-colors cursor-pointer inline-flex items-center gap-1.5"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Create First Sale Invoice</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Most Used Reports */}
      <div>
        <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider mb-3">
          Most Used Reports
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <button
            type="button"
            onClick={() => onOpenReport('sale_report')}
            className="p-4 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl text-left transition-all hover:border-slate-300 group cursor-pointer"
          >
            <div className="w-9 h-9 rounded-lg bg-rose-50 group-hover:bg-rose-100 text-rose-600 flex items-center justify-center transition-colors mb-2.5">
              <FileSpreadsheet className="w-4 h-4" />
            </div>
            <h4 className="text-xs font-bold text-slate-900">Sale Report</h4>
            <p className="text-[11px] text-slate-500 mt-0.5">Itemized sales & GST tax collected</p>
          </button>

          <button
            type="button"
            onClick={() => onOpenReport('all_transactions')}
            className="p-4 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl text-left transition-all hover:border-slate-300 group cursor-pointer"
          >
            <div className="w-9 h-9 rounded-lg bg-blue-50 group-hover:bg-blue-100 text-blue-600 flex items-center justify-center transition-colors mb-2.5">
              <BookOpen className="w-4 h-4" />
            </div>
            <h4 className="text-xs font-bold text-slate-900">All Transactions</h4>
            <p className="text-[11px] text-slate-500 mt-0.5">Combined sales, purchases & returns</p>
          </button>

          <button
            type="button"
            onClick={() => onOpenReport('daybook')}
            className="p-4 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl text-left transition-all hover:border-slate-300 group cursor-pointer"
          >
            <div className="w-9 h-9 rounded-lg bg-amber-50 group-hover:bg-amber-100 text-amber-600 flex items-center justify-center transition-colors mb-2.5">
              <Calendar className="w-4 h-4" />
            </div>
            <h4 className="text-xs font-bold text-slate-900">Daybook</h4>
            <p className="text-[11px] text-slate-500 mt-0.5">Today&apos;s chronological ins and outs</p>
          </button>

          <button
            type="button"
            onClick={() => onOpenReport('party_statement')}
            className="p-4 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl text-left transition-all hover:border-slate-300 group cursor-pointer"
          >
            <div className="w-9 h-9 rounded-lg bg-emerald-50 group-hover:bg-emerald-100 text-emerald-600 flex items-center justify-center transition-colors mb-2.5">
              <Users className="w-4 h-4" />
            </div>
            <h4 className="text-xs font-bold text-slate-900">Party Statement</h4>
            <p className="text-[11px] text-slate-500 mt-0.5">Customer & supplier ledgers with balances</p>
          </button>
        </div>
      </div>

      {/* Recent Transactions Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-slate-900">Recent Transactions</h3>
            <p className="text-xs text-slate-500 mt-0.5">
              All transactions automatically maintain stock & receivable / payable balances
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onOpenAddSale}
              className="px-2.5 py-1 text-xs font-semibold text-rose-600 hover:bg-rose-50 border border-rose-200 rounded-lg transition-colors cursor-pointer"
            >
              + Sale
            </button>
            <button
              type="button"
              onClick={onOpenAddPurchase}
              className="px-2.5 py-1 text-xs font-semibold text-blue-600 hover:bg-blue-50 border border-blue-200 rounded-lg transition-colors cursor-pointer"
            >
              + Purchase
            </button>
          </div>
        </div>

        {metrics.recentTransactions.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200 uppercase tracking-wider text-[11px]">
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-4">Invoice / Bill No</th>
                  <th className="py-3 px-4">Party Name</th>
                  <th className="py-3 px-4">Type</th>
                  <th className="py-3 px-4">Payment</th>
                  <th className="py-3 px-4 text-right">Amount</th>
                  <th className="py-3 px-4 text-right">Balance Due</th>
                  <th className="py-3 px-4 text-center">Status</th>
                  <th className="py-3 px-4 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {metrics.recentTransactions.map((tx) => (
                  <tr
                    key={tx.id}
                    onClick={() => onViewTransaction(tx)}
                    className="hover:bg-slate-50/80 transition-colors cursor-pointer"
                  >
                    <td className="py-3 px-4 font-mono text-slate-600 whitespace-nowrap">
                      {formatDate(tx.date)}
                    </td>
                    <td className="py-3 px-4 font-mono font-medium text-slate-900 whitespace-nowrap">
                      {tx.invoiceNo}
                    </td>
                    <td className="py-3 px-4 font-medium text-slate-800 whitespace-nowrap">
                      {tx.partyName}
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      <span
                        className={`font-medium ${
                          tx.type === 'sale_invoice'
                            ? 'text-rose-700'
                            : tx.type === 'purchase_bill'
                            ? 'text-blue-700'
                            : 'text-slate-700'
                        }`}
                      >
                        {tx.type === 'sale_invoice'
                          ? 'Sale Invoice'
                          : tx.type === 'purchase_bill'
                          ? 'Purchase Bill'
                          : tx.type}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-slate-600 uppercase font-mono text-[11px] whitespace-nowrap">
                      {tx.paymentType}
                    </td>
                    <td className="py-3 px-4 text-right font-mono font-bold text-slate-900 tabular-nums whitespace-nowrap">
                      {formatINR(tx.totalAmount)}
                    </td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums whitespace-nowrap">
                      {tx.balanceDue > 0 ? (
                        <span className="text-amber-700 font-semibold">{formatINR(tx.balanceDue)}</span>
                      ) : (
                        <span className="text-emerald-700">Paid</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-center whitespace-nowrap">
                      {tx.status === 'cancelled' ? (
                        <span className="text-rose-600 text-[11px] font-medium">Cancelled</span>
                      ) : (
                        <span className="text-emerald-600 text-[11px] font-medium">Active</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-center relative whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                      <div className="relative inline-block text-left">
                        <button
                          type="button"
                          onClick={(e) => toggleMenu(e, tx.id)}
                          className="p-1 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
                        >
                          <MoreVertical className="w-4 h-4" />
                        </button>

                        {/* 3-Dot Action Menu */}
                        {activeMenuTxId === tx.id && (
                          <div className="absolute right-0 mt-1 w-44 bg-white rounded-lg shadow-xl border border-slate-200 py-1 z-20 animate-in fade-in zoom-in-95 duration-100">
                            <button
                              type="button"
                              onClick={() => {
                                onViewTransaction(tx);
                                setActiveMenuTxId(null);
                              }}
                              className="w-full text-left px-3 py-2 text-xs text-slate-700 hover:bg-slate-50 flex items-center gap-2 cursor-pointer"
                            >
                              <Eye className="w-3.5 h-3.5 text-slate-500" />
                              <span>View / Preview</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                onViewTransaction(tx);
                                setActiveMenuTxId(null);
                              }}
                              className="w-full text-left px-3 py-2 text-xs text-slate-700 hover:bg-slate-50 flex items-center gap-2 cursor-pointer"
                            >
                              <Printer className="w-3.5 h-3.5 text-slate-500" />
                              <span>Print Tax Invoice</span>
                            </button>
                            {tx.status === 'active' && (
                              <button
                                type="button"
                                onClick={() => {
                                  onCancelTransaction(tx);
                                  setActiveMenuTxId(null);
                                }}
                                className="w-full text-left px-3 py-2 text-xs text-amber-700 hover:bg-amber-50 flex items-center gap-2 cursor-pointer"
                              >
                                <Ban className="w-3.5 h-3.5 text-amber-500" />
                                <span>Cancel Invoice</span>
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => {
                                onDeleteTransaction(tx);
                                setActiveMenuTxId(null);
                              }}
                              className="w-full text-left px-3 py-2 text-xs text-rose-600 hover:bg-rose-50 flex items-center gap-2 border-t border-slate-100 cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5 text-rose-500" />
                              <span>Delete</span>
                            </button>
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="py-14 text-center flex flex-col items-center justify-center">
            <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mb-3">
              <FileText className="w-6 h-6" />
            </div>
            <h4 className="text-sm font-semibold text-slate-800">No Transactions Found</h4>
            <p className="text-xs text-slate-500 max-w-sm mt-1">
              Start by recording a sale or purchase. Each transaction will update party balance, inventory, and GST reports.
            </p>
            <div className="mt-4 flex items-center gap-3">
              <button
                type="button"
                onClick={onOpenAddSale}
                className="px-4 py-2 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 rounded-lg shadow-2xs transition-colors cursor-pointer inline-flex items-center gap-1.5"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Sale</span>
              </button>
              <button
                type="button"
                onClick={onOpenAddPurchase}
                className="px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-2xs transition-colors cursor-pointer inline-flex items-center gap-1.5"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Purchase</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
