import React, { useState, useEffect } from 'react';
import { Search, X, FileText, ArrowRight } from 'lucide-react';
import { Transaction } from '../../types';
import { getTransactions } from '../../db/indexedDB';
import { formatINR, formatDate } from '../../utils/formatters';

interface GlobalSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectTransaction: (tx: Transaction) => void;
  initialQuery?: string;
}

export const GlobalSearchModal: React.FC<GlobalSearchModalProps> = ({
  isOpen,
  onClose,
  onSelectTransaction,
  initialQuery = '',
}) => {
  const [query, setQuery] = useState(initialQuery);
  const [results, setResults] = useState<Transaction[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setQuery(initialQuery);
      performSearch(initialQuery);
    }
  }, [isOpen, initialQuery]);

  const performSearch = async (searchTerm: string) => {
    setIsLoading(true);
    try {
      const all = await getTransactions();
      if (!searchTerm.trim()) {
        setResults(all.slice(0, 15));
      } else {
        const q = searchTerm.toLowerCase().trim();
        const filtered = all.filter(
          (t) =>
            t.invoiceNo.toLowerCase().includes(q) ||
            t.partyName.toLowerCase().includes(q) ||
            (t.partyPhone && t.partyPhone.includes(q)) ||
            t.totalAmount.toString().includes(q) ||
            t.items.some((i) => i.name.toLowerCase().includes(q))
        );
        setResults(filtered);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleChange = (val: string) => {
    setQuery(val);
    performSearch(val);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-slate-900/60 backdrop-blur-xs p-4 pt-16 sm:pt-20">
      <div className="w-full max-w-2xl bg-white rounded-xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[80vh] animate-in fade-in zoom-in-95 duration-150">
        {/* Search Input */}
        <div className="p-4 border-b border-slate-200 flex items-center gap-3 bg-slate-50">
          <Search className="w-5 h-5 text-slate-400 shrink-0" />
          <input
            type="text"
            autoFocus
            value={query}
            onChange={(e) => handleChange(e.target.value)}
            placeholder="Search by Invoice #, party name, phone, item or amount..."
            className="w-full bg-transparent text-sm text-slate-900 placeholder-slate-400 focus:outline-hidden"
          />
          {query && (
            <button
              type="button"
              onClick={() => handleChange('')}
              className="text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            className="text-xs text-slate-500 hover:text-slate-800 px-2 py-1 bg-white border border-slate-200 rounded-md cursor-pointer"
          >
            Esc
          </button>
        </div>

        {/* Results List */}
        <div className="overflow-y-auto flex-1 p-2 divide-y divide-slate-100">
          {isLoading ? (
            <div className="p-8 text-center text-xs text-slate-400">Searching transactions...</div>
          ) : results.length > 0 ? (
            results.map((tx) => (
              <div
                key={tx.id}
                onClick={() => {
                  onSelectTransaction(tx);
                  onClose();
                }}
                className="p-3 hover:bg-slate-50 rounded-lg flex items-center justify-between transition-colors cursor-pointer group"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div
                    className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                      tx.type === 'sale_invoice' ? 'bg-rose-50 text-rose-600' : 'bg-blue-50 text-blue-600'
                    }`}
                  >
                    <FileText className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-slate-900 font-mono">{tx.invoiceNo}</span>
                      <span className="text-[10px] text-slate-400">·</span>
                      <span className="text-xs font-medium text-slate-700 truncate">{tx.partyName}</span>
                    </div>
                    <div className="text-[11px] text-slate-400 flex items-center gap-2 font-mono">
                      <span>{formatDate(tx.date)}</span>
                      <span>·</span>
                      <span className="uppercase">{tx.type.replace('_', ' ')}</span>
                      <span>·</span>
                      <span>{tx.items.length} {tx.items.length === 1 ? 'item' : 'items'}</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3 shrink-0">
                  <div className="text-right font-mono">
                    <div className="text-xs font-bold text-slate-900 tabular-nums">
                      {formatINR(tx.totalAmount)}
                    </div>
                    {tx.balanceDue > 0 ? (
                      <div className="text-[10px] text-amber-600">Due: {formatINR(tx.balanceDue)}</div>
                    ) : (
                      <div className="text-[10px] text-emerald-600">Paid</div>
                    )}
                  </div>
                  <ArrowRight className="w-4 h-4 text-slate-300 group-hover:text-slate-600 transition-colors" />
                </div>
              </div>
            ))
          ) : (
            <div className="p-8 text-center text-xs text-slate-400">
              No transactions match &quot;{query}&quot;
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
