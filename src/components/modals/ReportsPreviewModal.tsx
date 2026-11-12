import React, { useState, useEffect } from 'react';
import { X, Download, Printer, FileSpreadsheet } from 'lucide-react';
import { Party, Transaction } from '../../types';
import { getParties, getTransactions } from '../../db/indexedDB';
import { formatINR, formatDate } from '../../utils/formatters';

interface ReportsPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  reportType: string;
  onSelectTransaction: (tx: Transaction) => void;
}

export const ReportsPreviewModal: React.FC<ReportsPreviewModalProps> = ({
  isOpen,
  onClose,
  reportType,
  onSelectTransaction,
}) => {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [parties, setParties] = useState<Party[]>([]);
  const [filterStartDate, setFilterStartDate] = useState('');
  const [filterEndDate, setFilterEndDate] = useState('');

  useEffect(() => {
    if (isOpen) {
      loadData();
    }
  }, [isOpen]);

  const loadData = async () => {
    const txs = await getTransactions();
    setTransactions(txs);
    const pts = await getParties();
    setParties(pts);
  };

  if (!isOpen) return null;

  const reportTitles: Record<string, string> = {
    sale_report: 'GST Sale Report',
    all_transactions: 'All Transactions Statement',
    daybook: 'Daybook (Daily Ledger)',
    party_statement: 'Party Statement & Balances',
  };

  const title = reportTitles[reportType] || 'Financial Report';

  // Filter transactions based on reportType and dates
  let filtered = [...transactions];
  if (reportType === 'sale_report') {
    filtered = filtered.filter((t) => t.type === 'sale_invoice' && t.status === 'active');
  } else if (reportType === 'daybook') {
    const today = new Date().toISOString().split('T')[0];
    filtered = filtered.filter((t) => t.date === today && t.status === 'active');
  }

  if (filterStartDate) {
    filtered = filtered.filter((t) => t.date >= filterStartDate);
  }
  if (filterEndDate) {
    filtered = filtered.filter((t) => t.date <= filterEndDate);
  }

  // Calculate totals
  const totalAmount = filtered.reduce((acc, t) => acc + t.totalAmount, 0);
  const totalTax = filtered.reduce((acc, t) => acc + t.totalTax, 0);
  const totalBalance = filtered.reduce((acc, t) => acc + t.balanceDue, 0);

  // CSV Export
  const handleExportCSV = () => {
    let csv = '';
    if (reportType === 'party_statement') {
      csv = 'Party Name,Phone,GSTIN,State,Opening Balance,Opening Type\n';
      parties.forEach((p) => {
        csv += `"${p.name}","${p.phone || ''}","${p.gstin || ''}","${p.state}",${p.openingBalance},"${p.openingBalanceType}"\n`;
      });
    } else {
      csv = 'Date,Invoice No,Type,Party Name,Payment Mode,Subtotal,Tax,Total Amount,Balance Due,Status\n';
      filtered.forEach((t) => {
        csv += `"${t.date}","${t.invoiceNo}","${t.type}","${t.partyName}","${t.paymentType}",${t.subtotal},${t.totalTax},${t.totalAmount},${t.balanceDue},"${t.status}"\n`;
      });
    }

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${reportType}_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-3 sm:p-6 overflow-y-auto">
      <div className="w-full max-w-5xl bg-white rounded-xl shadow-2xl border border-slate-200 overflow-hidden my-4 flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-slate-900 text-white shrink-0">
          <div className="flex items-center gap-2.5">
            <FileSpreadsheet className="w-5 h-5 text-rose-500" />
            <h2 className="text-base font-bold">{title}</h2>
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleExportCSV}
              className="px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-slate-300 rounded-lg flex items-center gap-1.5 cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export CSV</span>
            </button>
            <button
              type="button"
              onClick={() => window.print()}
              className="px-3 py-1.5 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 rounded-lg flex items-center gap-1.5 cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="text-slate-400 hover:text-white cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Date Filter Bar */}
        {reportType !== 'party_statement' && (
          <div className="px-6 py-3 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-4 text-xs">
            <div className="flex items-center gap-3">
              <span className="font-semibold text-slate-700">Filter Dates:</span>
              <div className="flex items-center gap-2">
                <input
                  type="date"
                  value={filterStartDate}
                  onChange={(e) => setFilterStartDate(e.target.value)}
                  className="px-2.5 py-1 bg-white border border-slate-300 rounded-md font-mono text-xs"
                />
                <span className="text-slate-400">to</span>
                <input
                  type="date"
                  value={filterEndDate}
                  onChange={(e) => setFilterEndDate(e.target.value)}
                  className="px-2.5 py-1 bg-white border border-slate-300 rounded-md font-mono text-xs"
                />
                {(filterStartDate || filterEndDate) && (
                  <button
                    type="button"
                    onClick={() => {
                      setFilterStartDate('');
                      setFilterEndDate('');
                    }}
                    className="text-xs text-rose-600 hover:underline cursor-pointer"
                  >
                    Clear
                  </button>
                )}
              </div>
            </div>

            {/* Quick Metrics */}
            <div className="flex items-center gap-4 font-mono text-xs font-bold text-slate-800">
              <div>Total: <span className="text-slate-900">{formatINR(totalAmount)}</span></div>
              <div>Tax: <span className="text-slate-900">{formatINR(totalTax)}</span></div>
              <div>Due: <span className="text-amber-700">{formatINR(totalBalance)}</span></div>
            </div>
          </div>
        )}

        {/* Report Content Table */}
        <div className="p-6 overflow-y-auto flex-1">
          {reportType === 'party_statement' ? (
            parties.length > 0 ? (
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200 uppercase text-[11px]">
                    <th className="py-2.5 px-3">Party Name</th>
                    <th className="py-2.5 px-3">Phone</th>
                    <th className="py-2.5 px-3">GSTIN</th>
                    <th className="py-2.5 px-3">State</th>
                    <th className="py-2.5 px-3 text-right">Opening Balance</th>
                    <th className="py-2.5 px-3">Type</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {parties.map((p) => (
                    <tr key={p.id} className="hover:bg-slate-50/60">
                      <td className="py-2.5 px-3 font-semibold text-slate-900">{p.name}</td>
                      <td className="py-2.5 px-3 font-mono text-slate-600">{p.phone || '-'}</td>
                      <td className="py-2.5 px-3 font-mono text-slate-600">{p.gstin || 'Unregistered'}</td>
                      <td className="py-2.5 px-3 text-slate-600">{p.state}</td>
                      <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-900 tabular-nums">
                        {formatINR(p.openingBalance)}
                      </td>
                      <td className="py-2.5 px-3 text-slate-600 text-[11px] capitalize">
                        {p.openingBalanceType.replace('_', ' ')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="py-12 text-center text-xs text-slate-400">
                No parties added yet. Add parties to see their statements and ledgers.
              </div>
            )
          ) : filtered.length > 0 ? (
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200 uppercase text-[11px]">
                  <th className="py-2.5 px-3">Date</th>
                  <th className="py-2.5 px-3">Invoice #</th>
                  <th className="py-2.5 px-3">Party</th>
                  <th className="py-2.5 px-3">Type</th>
                  <th className="py-2.5 px-3 text-right">Taxable</th>
                  <th className="py-2.5 px-3 text-right">GST Tax</th>
                  <th className="py-2.5 px-3 text-right">Total Amount</th>
                  <th className="py-2.5 px-3 text-right">Balance Due</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((t) => (
                  <tr
                    key={t.id}
                    onClick={() => {
                      onSelectTransaction(t);
                      onClose();
                    }}
                    className="hover:bg-slate-50 cursor-pointer"
                  >
                    <td className="py-2.5 px-3 font-mono text-slate-600">{formatDate(t.date)}</td>
                    <td className="py-2.5 px-3 font-mono font-semibold text-slate-900">{t.invoiceNo}</td>
                    <td className="py-2.5 px-3 font-medium text-slate-800">{t.partyName}</td>
                    <td className="py-2.5 px-3 text-slate-600 capitalize">{t.type.replace('_', ' ')}</td>
                    <td className="py-2.5 px-3 text-right font-mono tabular-nums">{formatINR(t.subtotal)}</td>
                    <td className="py-2.5 px-3 text-right font-mono tabular-nums">{formatINR(t.totalTax)}</td>
                    <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-900 tabular-nums">
                      {formatINR(t.totalAmount)}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono tabular-nums">
                      {t.balanceDue > 0 ? (
                        <span className="text-amber-700 font-semibold">{formatINR(t.balanceDue)}</span>
                      ) : (
                        <span className="text-emerald-700">Paid</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="py-12 text-center text-xs text-slate-400">
              No transactions found for this report period.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
