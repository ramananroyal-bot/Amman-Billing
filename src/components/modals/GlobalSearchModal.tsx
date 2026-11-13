import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Search,
  X,
  FileText,
  ArrowRight,
  Users,
  Package,
  Compass,
} from 'lucide-react';
import { Item, Party, Transaction } from '../../types';
import { getTransactions, getParties, getItems } from '../../db/indexedDB';
import { formatINR, formatDate } from '../../utils/formatters';
import { NavView } from '../layout/Sidebar';
import { useTranslation } from '../../i18n/LanguageContext';

interface GlobalSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectTransaction: (tx: Transaction) => void;
  onSelectParty?: (party: Party) => void;
  onSelectItem?: (item: Item) => void;
  onNavigate?: (view: NavView) => void;
  initialQuery?: string;
}

type SearchEntry =
  | { kind: 'page'; id: string; view: NavView; title: string; subtitle: string; keywords: string }
  | { kind: 'party'; id: string; party: Party }
  | { kind: 'item'; id: string; item: Item }
  | { kind: 'transaction'; id: string; tx: Transaction };

export const GlobalSearchModal: React.FC<GlobalSearchModalProps> = ({
  isOpen,
  onClose,
  onSelectTransaction,
  onSelectParty,
  onSelectItem,
  onNavigate,
  initialQuery = '',
}) => {
  const { t } = useTranslation();
  const [query, setQuery] = useState(initialQuery);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [parties, setParties] = useState<Party[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const pageEntries: SearchEntry[] = useMemo(
    () => [
      { kind: 'page', id: 'p_home', view: 'home', title: t('nav.home'), subtitle: 'Dashboard, Overdue Payments, Low Stock', keywords: 'dashboard home overview' },
      { kind: 'page', id: 'p_parties', view: 'parties', title: t('nav.parties'), subtitle: 'Customers & Suppliers ledger', keywords: 'customers suppliers ledger balances' },
      { kind: 'page', id: 'p_items', view: 'items', title: t('nav.items'), subtitle: 'Products, Services, Stock, HSN', keywords: 'inventory stock products services hsn barcode' },
      { kind: 'page', id: 'p_sales', view: 'sales', title: t('nav.saleInvoice'), subtitle: 'GST Tax Invoices', keywords: 'sale invoice tax gst bill' },
      { kind: 'page', id: 'p_estimates', view: 'estimates', title: t('nav.estimateQuotation'), subtitle: 'Price Quotes & Estimates', keywords: 'estimate quotation quote' },
      { kind: 'page', id: 'p_payin', view: 'payments_in', title: t('nav.paymentIn'), subtitle: 'Customer Receipts', keywords: 'payment in receipt collection' },
      { kind: 'page', id: 'p_sret', view: 'sale_returns', title: t('nav.saleReturn'), subtitle: 'Credit Notes', keywords: 'sale return credit note' },
      { kind: 'page', id: 'p_chal', view: 'delivery_challans', title: t('nav.deliveryChallan'), subtitle: 'Dispatch & Delivery Challans', keywords: 'delivery challan dispatch' },
      { kind: 'page', id: 'p_jw', view: 'job_work', title: t('nav.jobWork'), subtitle: 'Job Work Out & Job Work In Challans', keywords: 'job work out in processing challan' },
      { kind: 'page', id: 'p_purch', view: 'purchases', title: t('nav.purchaseBill'), subtitle: 'Supplier Purchase Bills', keywords: 'purchase bill vendor' },
      { kind: 'page', id: 'p_payout', view: 'payments_out', title: t('nav.paymentOut'), subtitle: 'Vendor Payment Vouchers', keywords: 'payment out voucher vendor' },
      { kind: 'page', id: 'p_exp', view: 'expenses', title: t('nav.expenses'), subtitle: 'Operating & Office Expenses', keywords: 'expenses rent salary' },
      { kind: 'page', id: 'p_pret', view: 'purchase_returns', title: t('nav.purchaseReturn'), subtitle: 'Debit Notes', keywords: 'purchase return debit note' },
      { kind: 'page', id: 'p_rep', view: 'reports', title: t('nav.reports'), subtitle: 'GSTR-1, GSTR-2, P&L, Daybook, Stock', keywords: 'reports gstr1 gstr2 gst tax daybook profit loss' },
      { kind: 'page', id: 'p_sync', view: 'sync_backup', title: t('nav.syncBackup'), subtitle: 'Backup JSON, Restore, Integrity', keywords: 'backup restore export sync' },
      { kind: 'page', id: 'p_set', view: 'settings', title: t('nav.settings'), subtitle: 'Language, Invoice Prefixes, Taxes, Reminders', keywords: 'settings language tamil prefixes whatsapp' },
    ],
    [t]
  );

  useEffect(() => {
    if (!isOpen) return;
    setQuery(initialQuery);
    setActiveIndex(0);
    setIsLoading(true);
    Promise.all([getTransactions(), getParties(), getItems()])
      .then(([txs, pts, itms]) => {
        setTransactions(txs);
        setParties(pts);
        setItems(itms);
      })
      .finally(() => setIsLoading(false));

    setTimeout(() => {
      inputRef.current?.focus();
    }, 30);
  }, [isOpen, initialQuery]);

  // Combine matching pages, parties, items, and transactions
  const results: SearchEntry[] = useMemo(() => {
    const q = query.toLowerCase().trim();
    const list: SearchEntry[] = [];

    // 1. Pages
    const matchedPages = q
      ? pageEntries.filter(
          (p) =>
            p.kind === 'page' &&
            (p.title.toLowerCase().includes(q) ||
              p.subtitle.toLowerCase().includes(q) ||
              p.keywords.toLowerCase().includes(q))
        )
      : pageEntries.slice(0, 5);
    list.push(...matchedPages.slice(0, 6));

    // 2. Parties
    const matchedParties = (q
      ? parties.filter(
          (p) =>
            p.name.toLowerCase().includes(q) ||
            (p.phone && p.phone.includes(q)) ||
            (p.gstin && p.gstin.toLowerCase().includes(q))
        )
      : parties.slice(0, 3)
    ).slice(0, 6);
    matchedParties.forEach((party) => list.push({ kind: 'party', id: `pt_${party.id}`, party }));

    // 3. Items
    const matchedItems = (q
      ? items.filter(
          (i) =>
            i.name.toLowerCase().includes(q) ||
            (i.hsn && i.hsn.toLowerCase().includes(q)) ||
            (i.itemCode && i.itemCode.toLowerCase().includes(q)) ||
            (i.barcode && i.barcode.toLowerCase().includes(q))
        )
      : items.slice(0, 3)
    ).slice(0, 6);
    matchedItems.forEach((item) => list.push({ kind: 'item', id: `it_${item.id}`, item }));

    // 4. Transactions / Invoices
    const matchedTxs = (q
      ? transactions.filter(
          (tx) =>
            tx.invoiceNo.toLowerCase().includes(q) ||
            tx.partyName.toLowerCase().includes(q) ||
            (tx.partyPhone && tx.partyPhone.includes(q)) ||
            tx.totalAmount.toString().includes(q) ||
            tx.items.some((i) => i.name.toLowerCase().includes(q))
        )
      : transactions.slice(0, 6)
    ).slice(0, 10);
    matchedTxs.forEach((tx) => list.push({ kind: 'transaction', id: `tx_${tx.id}`, tx }));

    return list;
  }, [query, pageEntries, parties, items, transactions]);

  useEffect(() => {
    setActiveIndex(0);
  }, [query]);

  const activateEntry = (entry: SearchEntry) => {
    if (entry.kind === 'page') {
      if (onNavigate) onNavigate(entry.view);
    } else if (entry.kind === 'party') {
      if (onSelectParty) onSelectParty(entry.party);
      else if (onNavigate) onNavigate('parties');
    } else if (entry.kind === 'item') {
      if (onSelectItem) onSelectItem(entry.item);
      else if (onNavigate) onNavigate('items');
    } else if (entry.kind === 'transaction') {
      onSelectTransaction(entry.tx);
    }
    onClose();
  };

  // Keyboard navigation: ArrowDown, ArrowUp, Enter, Esc
  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        setActiveIndex((prev) => (results.length > 0 ? (prev + 1) % results.length : 0));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setActiveIndex((prev) => (results.length > 0 ? (prev - 1 + results.length) % results.length : 0));
      } else if (e.key === 'Enter') {
        if (results[activeIndex]) {
          e.preventDefault();
          activateEntry(results[activeIndex]);
        }
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [isOpen, results, activeIndex]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-slate-900/60 backdrop-blur-xs p-4 pt-14 sm:pt-20"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl bg-white rounded-xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[80vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search Input */}
        <div className="p-4 border-b border-slate-200 flex items-center gap-3 bg-slate-50">
          <Search className="w-5 h-5 text-rose-500 shrink-0" />
          <input
            ref={inputRef}
            type="text"
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Open Anything — search pages, parties, items, invoices, or amounts..."
            className="w-full bg-transparent text-sm text-slate-900 placeholder-slate-400 focus:outline-hidden"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery('')}
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
        <div className="overflow-y-auto flex-1 p-2 space-y-1">
          {isLoading ? (
            <div className="p-8 text-center text-xs text-slate-400">Searching across pages, parties, items & invoices...</div>
          ) : results.length > 0 ? (
            results.map((entry, idx) => {
              const isSelected = idx === activeIndex;
              if (entry.kind === 'page') {
                return (
                  <div
                    key={entry.id}
                    onMouseEnter={() => setActiveIndex(idx)}
                    onClick={() => activateEntry(entry)}
                    className={`px-3 py-2.5 rounded-lg flex items-center justify-between transition-colors cursor-pointer ${
                      isSelected ? 'bg-rose-50 ring-1 ring-rose-200' : 'hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-8 h-8 rounded-lg bg-slate-100 text-slate-700 flex items-center justify-center shrink-0">
                        <Compass className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-slate-900">{entry.title}</span>
                          <span className="text-[9px] px-1.5 py-0.5 rounded bg-slate-200 text-slate-700 font-semibold uppercase">
                            Page
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-500 truncate">{entry.subtitle}</div>
                      </div>
                    </div>
                    <ArrowRight className="w-4 h-4 text-slate-400 shrink-0" />
                  </div>
                );
              }

              if (entry.kind === 'party') {
                return (
                  <div
                    key={entry.id}
                    onMouseEnter={() => setActiveIndex(idx)}
                    onClick={() => activateEntry(entry)}
                    className={`px-3 py-2.5 rounded-lg flex items-center justify-between transition-colors cursor-pointer ${
                      isSelected ? 'bg-rose-50 ring-1 ring-rose-200' : 'hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center shrink-0">
                        <Users className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-slate-900 truncate">{entry.party.name}</span>
                          <span className="text-[9px] px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 font-semibold uppercase">
                            Party · {entry.party.group || 'Customer'}
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-500 font-mono truncate">
                          {entry.party.phone || 'No Phone'} {entry.party.gstin ? `· GSTIN: ${entry.party.gstin}` : ''} · {entry.party.state}
                        </div>
                      </div>
                    </div>
                    <ArrowRight className="w-4 h-4 text-slate-400 shrink-0" />
                  </div>
                );
              }

              if (entry.kind === 'item') {
                return (
                  <div
                    key={entry.id}
                    onMouseEnter={() => setActiveIndex(idx)}
                    onClick={() => activateEntry(entry)}
                    className={`px-3 py-2.5 rounded-lg flex items-center justify-between transition-colors cursor-pointer ${
                      isSelected ? 'bg-rose-50 ring-1 ring-rose-200' : 'hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-700 flex items-center justify-center shrink-0">
                        <Package className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-slate-900 truncate">{entry.item.name}</span>
                          <span className="text-[9px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 font-semibold uppercase">
                            Item
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-500 font-mono truncate">
                          Rate: {formatINR(entry.item.salePrice)} · Stock: {entry.item.currentStock} {entry.item.unit} {entry.item.hsn ? `· HSN: ${entry.item.hsn}` : ''}
                        </div>
                      </div>
                    </div>
                    <ArrowRight className="w-4 h-4 text-slate-400 shrink-0" />
                  </div>
                );
              }

              const tx = entry.tx;
              return (
                <div
                  key={entry.id}
                  onMouseEnter={() => setActiveIndex(idx)}
                  onClick={() => activateEntry(entry)}
                  className={`px-3 py-2.5 rounded-lg flex items-center justify-between transition-colors cursor-pointer ${
                    isSelected ? 'bg-rose-50 ring-1 ring-rose-200' : 'hover:bg-slate-50'
                  }`}
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
                        <div className="text-[10px] text-emerald-600">Settled</div>
                      )}
                    </div>
                    <ArrowRight className="w-4 h-4 text-slate-400 shrink-0" />
                  </div>
                </div>
              );
            })
          ) : (
            <div className="p-8 text-center text-xs text-slate-400">
              No pages, parties, items, or invoices match &quot;{query}&quot;
            </div>
          )}
        </div>

        {/* Footer keyboard hints */}
        <div className="px-4 py-2 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-[10px] text-slate-500">
          <div className="flex items-center gap-3">
            <span><kbd className="px-1 py-0.5 bg-white border border-slate-300 rounded font-mono">↑↓</kbd> Navigate</span>
            <span><kbd className="px-1 py-0.5 bg-white border border-slate-300 rounded font-mono">Enter</kbd> Open</span>
            <span><kbd className="px-1 py-0.5 bg-white border border-slate-300 rounded font-mono">Esc</kbd> Close</span>
          </div>
          <span>{results.length} results</span>
        </div>
      </div>
    </div>
  );
};
