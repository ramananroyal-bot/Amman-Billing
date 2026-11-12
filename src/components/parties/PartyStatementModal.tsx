import React, { useState, useEffect } from 'react';
import { X, Printer, Download, Users } from 'lucide-react';
import { BusinessProfile, Party, Transaction } from '../../types';
import { getTransactions } from '../../db/indexedDB';
import { formatINR, formatDate } from '../../utils/formatters';

interface PartyStatementModalProps {
  isOpen: boolean;
  onClose: () => void;
  party: Party | null;
  businessProfile: BusinessProfile | null;
}

export const PartyStatementModal: React.FC<PartyStatementModalProps> = ({
  isOpen,
  onClose,
  party,
  businessProfile,
}) => {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [filterStartDate, setFilterStartDate] = useState('');
  const [filterEndDate, setFilterEndDate] = useState('');

  useEffect(() => {
    if (isOpen && party) {
      loadPartyTransactions();
    }
  }, [isOpen, party]);

  const loadPartyTransactions = async () => {
    if (!party) return;
    const all = await getTransactions({ partyId: party.id });
    // Sort chronological ascending for running balance ledger
    all.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    setTransactions(all);
  };

  if (!isOpen || !party) return null;

  let filtered = [...transactions];
  if (filterStartDate) {
    filtered = filtered.filter((t) => t.date >= filterStartDate);
  }
  if (filterEndDate) {
    filtered = filtered.filter((t) => t.date <= filterEndDate);
  }

  // Calculate Running Balance Ledger
  let running = party.openingBalanceType === 'to_receive' ? party.openingBalance : -party.openingBalance;
  const ledgerRows = filtered.map((t) => {
    let debit = 0;
    let credit = 0;

    if (t.type === 'sale_invoice') {
      debit = t.totalAmount;
      credit = t.receivedAmount;
      running += (debit - credit);
    } else if (t.type === 'purchase_bill') {
      credit = t.totalAmount;
      debit = t.receivedAmount; // paid
      running -= (credit - debit);
    } else if (t.type === 'payment_in') {
      credit = t.totalAmount;
      running -= credit;
    } else if (t.type === 'payment_out') {
      debit = t.totalAmount;
      running += debit;
    }

    return {
      ...t,
      debit,
      credit,
      runningBalance: Math.round(running * 100) / 100,
    };
  });

  const finalBalance = Math.round(running * 100) / 100;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-3 sm:p-5 overflow-y-auto print:p-0 print:bg-white print:fixed print:inset-0">
      <div className="w-full max-w-4xl bg-white rounded-xl shadow-2xl border border-slate-200 overflow-hidden my-4 flex flex-col max-h-[95vh] print:max-h-none print:shadow-none print:border-none print:w-full print:m-0">
        {/* Header - Hidden on print */}
        <div className="no-print flex items-center justify-between px-6 py-4 bg-slate-900 text-white shrink-0">
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-rose-500" />
            <h3 className="text-sm font-bold">Party Statement - {party.name}</h3>
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => window.print()}
              className="px-3.5 py-1.5 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 rounded-lg flex items-center gap-1.5 cursor-pointer shadow-2xs"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print Statement</span>
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

        {/* Date Filter - Hidden on print */}
        <div className="no-print px-6 py-2.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between text-xs">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-slate-700">Statement Period:</span>
            <input
              type="date"
              value={filterStartDate}
              onChange={(e) => setFilterStartDate(e.target.value)}
              className="px-2 py-1 bg-white border border-slate-300 rounded-md font-mono text-xs"
            />
            <span className="text-slate-400">to</span>
            <input
              type="date"
              value={filterEndDate}
              onChange={(e) => setFilterEndDate(e.target.value)}
              className="px-2 py-1 bg-white border border-slate-300 rounded-md font-mono text-xs"
            />
          </div>
          <div className="font-mono font-bold text-xs">
            Net Balance:{' '}
            <span className={finalBalance >= 0 ? 'text-emerald-700' : 'text-rose-700'}>
              {formatINR(Math.abs(finalBalance))} ({finalBalance >= 0 ? 'Receivable' : 'Payable'})
            </span>
          </div>
        </div>

        {/* Printable Statement Sheet */}
        <div className="p-6 sm:p-8 overflow-y-auto flex-1 space-y-6 text-xs text-slate-900 bg-white">
          {/* Business & Party Header */}
          <div className="flex justify-between border-b border-slate-200 pb-4">
            <div>
              <h1 className="text-base font-bold uppercase">{businessProfile?.businessName}</h1>
              <p className="text-slate-600 whitespace-pre-line mt-1">{businessProfile?.address}</p>
              <p className="text-slate-600 font-mono mt-0.5">
                Phone: {businessProfile?.phone} {businessProfile?.gstin ? `· GSTIN: ${businessProfile.gstin}` : ''}
              </p>
            </div>
            <div className="text-right">
              <span className="text-xs font-bold uppercase bg-slate-100 py-1 px-3 rounded-md block mb-1">
                Statement of Account
              </span>
              <div className="font-mono text-[11px] text-slate-500">
                Generated: {formatDate(new Date().toISOString().split('T')[0])}
              </div>
            </div>
          </div>

          {/* Party Details Card */}
          <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 grid grid-cols-2 gap-4">
            <div>
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Statement For:</span>
              <div className="text-sm font-bold text-slate-950 mt-0.5">{party.name}</div>
              {party.billingAddress && <p className="text-slate-600 mt-1">{party.billingAddress}</p>}
              <div className="mt-1 font-mono text-[11px] text-slate-600">
                Phone: {party.phone} {party.gstin ? `· GSTIN: ${party.gstin}` : ''}
              </div>
            </div>

            <div className="text-right font-mono space-y-1">
              <div>
                <span className="text-slate-500">Opening Balance:</span>{' '}
                <span className="font-semibold">{formatINR(party.openingBalance)}</span> ({party.openingBalanceType})
              </div>
              <div>
                <span className="text-slate-500">Credit Limit:</span>{' '}
                <span>{party.creditLimit > 0 ? formatINR(party.creditLimit) : 'No Limit'}</span>
              </div>
              <div className="border-t border-slate-200 pt-1 text-sm font-bold">
                <span className="text-slate-700">Closing Balance:</span>{' '}
                <span className={finalBalance >= 0 ? 'text-emerald-700' : 'text-rose-700'}>
                  {formatINR(Math.abs(finalBalance))} ({finalBalance >= 0 ? 'Receivable' : 'Payable'})
                </span>
              </div>
            </div>
          </div>

          {/* Ledger Table */}
          <div className="border border-slate-200 rounded-lg overflow-hidden">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-100 text-slate-800 font-bold border-b border-slate-200 uppercase text-[10px] tracking-wider">
                  <th className="py-2.5 px-3">Date</th>
                  <th className="py-2.5 px-3">Tx Type</th>
                  <th className="py-2.5 px-3">Invoice / Ref #</th>
                  <th className="py-2.5 px-3 text-right">Debit (₹)</th>
                  <th className="py-2.5 px-3 text-right">Credit (₹)</th>
                  <th className="py-2.5 px-3 text-right">Running Balance (₹)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-mono text-[11px]">
                {/* Opening balance row */}
                <tr className="bg-slate-50/50 italic text-slate-600">
                  <td className="py-2 px-3">{formatDate(party.openingBalanceDate || party.createdAt)}</td>
                  <td className="py-2 px-3">Opening Balance</td>
                  <td className="py-2 px-3">-</td>
                  <td className="py-2 px-3 text-right">
                    {party.openingBalanceType === 'to_receive' ? formatINR(party.openingBalance, false) : '-'}
                  </td>
                  <td className="py-2 px-3 text-right">
                    {party.openingBalanceType === 'to_pay' ? formatINR(party.openingBalance, false) : '-'}
                  </td>
                  <td className="py-2 px-3 text-right font-semibold">
                    {formatINR(party.openingBalance, false)}
                  </td>
                </tr>

                {ledgerRows.map((row) => (
                  <tr key={row.id} className="hover:bg-slate-50">
                    <td className="py-2 px-3 text-slate-600">{formatDate(row.date)}</td>
                    <td className="py-2 px-3 capitalize font-sans">{row.type.replace('_', ' ')}</td>
                    <td className="py-2 px-3 font-semibold text-slate-900">{row.invoiceNo}</td>
                    <td className="py-2 px-3 text-right tabular-nums">
                      {row.debit > 0 ? formatINR(row.debit, false) : '-'}
                    </td>
                    <td className="py-2 px-3 text-right tabular-nums">
                      {row.credit > 0 ? formatINR(row.credit, false) : '-'}
                    </td>
                    <td className="py-2 px-3 text-right font-bold tabular-nums text-slate-900">
                      {formatINR(Math.abs(row.runningBalance), false)}{' '}
                      <span className="text-[10px] font-normal text-slate-500">
                        {row.runningBalance >= 0 ? 'Dr' : 'Cr'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};
