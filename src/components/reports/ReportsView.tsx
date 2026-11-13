import React, { useState, useEffect, useMemo } from 'react';
import {
  BarChart3,
  FileSpreadsheet,
  Printer,
  Download,
  Search,
  Calendar,
  Filter,
  ArrowUpRight,
  ArrowDownRight,
  TrendingUp,
  ShoppingBag,
  Users,
  Package,
  CreditCard,
  Layers,
  PieChart,
  Receipt,
  FileCheck,
  AlertTriangle,
  RotateCcw,
  Activity,
  Trash2,
} from 'lucide-react';
import { AuditLogEntry, BusinessProfile, Item, Party, Transaction, Expense } from '../../types';
import {
  getTransactions,
  getParties,
  getItems,
  calculatePartyBalance,
  getExpenses,
  getAuditLogs,
  clearAuditLogs,
} from '../../db/indexedDB';
import { formatINR, formatDate, getTodayISO } from '../../utils/formatters';
import { useSecurity } from '../../contexts/SecurityContext';

export type ReportCategory = 'transactions' | 'gst' | 'parties' | 'inventory' | 'security';

export type ReportType =
  | 'sale_report'
  | 'purchase_report'
  | 'all_transactions'
  | 'daybook'
  | 'profit_loss'
  | 'gstr1'
  | 'gstr2'
  | 'gstr3b'
  | 'party_statement'
  | 'parties_balance'
  | 'stock_summary'
  | 'low_stock'
  | 'item_sales'
  | 'audit_trail';

interface ReportsViewProps {
  businessProfile: BusinessProfile | null;
  initialReportType?: ReportType;
  onViewTransaction: (tx: Transaction) => void;
}

interface ReportNavItem {
  id: ReportType;
  name: string;
  category: ReportCategory;
  description: string;
  badge?: string;
}

export const ReportsView: React.FC<ReportsViewProps> = ({
  businessProfile,
  initialReportType = 'sale_report',
  onViewTransaction,
}) => {
  const { requirePin } = useSecurity();
  const [activeReport, setActiveReport] = useState<ReportType>(initialReportType);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [parties, setParties] = useState<Party[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);
  const [partyBalances, setPartyBalances] = useState<Record<string, { balance: number; type: 'to_receive' | 'to_pay' }>>({});

  // Filters
  const [datePreset, setDatePreset] = useState<
    'today' | 'this_week' | 'this_month' | 'this_quarter' | 'by_month' | 'by_quarter' | 'this_year' | 'all' | 'custom'
  >('this_month');
  const [selectedMonth, setSelectedMonth] = useState(() => new Date().toISOString().slice(0, 7));
  const [selectedQuarterFY, setSelectedQuarterFY] = useState(() => {
    const now = new Date();
    return now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
  });
  const [selectedQuarterNum, setSelectedQuarterNum] = useState<'Q1' | 'Q2' | 'Q3' | 'Q4'>(() => {
    const m = new Date().getMonth();
    if (m >= 3 && m <= 5) return 'Q1';
    if (m >= 6 && m <= 8) return 'Q2';
    if (m >= 9 && m <= 11) return 'Q3';
    return 'Q4';
  });
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [selectedPartyId, setSelectedPartyId] = useState<string>('all');
  const [paymentModeFilter, setPaymentModeFilter] = useState<'all' | 'cash' | 'credit' | 'bank'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Specific state for single party statement
  const [statementPartyId, setStatementPartyId] = useState<string>('');

  useEffect(() => {
    loadAllData();
  }, []);

  useEffect(() => {
    if (initialReportType) {
      setActiveReport(initialReportType);
    }
  }, [initialReportType]);

  const loadAllData = async () => {
    const txs = await getTransactions();
    setTransactions(txs);

    const pts = await getParties();
    pts.sort((a, b) => a.name.localeCompare(b.name));
    setParties(pts);
    if (pts.length > 0 && !statementPartyId) {
      setStatementPartyId(pts[0].id);
    }

    const itms = await getItems();
    itms.sort((a, b) => a.name.localeCompare(b.name));
    setItems(itms);

    const exps = await getExpenses();
    setExpenses(exps);

    const logs = await getAuditLogs();
    setAuditLogs(logs);

    // Compute party balances
    const bMap: Record<string, { balance: number; type: 'to_receive' | 'to_pay' }> = {};
    for (const p of pts) {
      bMap[p.id] = await calculatePartyBalance(p);
    }
    setPartyBalances(bMap);
  };

  // Date range calculations
  const effectiveDateRange = useMemo(() => {
    const now = new Date();
    const todayStr = getTodayISO();

    if (datePreset === 'today') {
      return { start: todayStr, end: todayStr };
    }
    if (datePreset === 'this_week') {
      const d = new Date(now);
      const day = d.getDay() || 7;
      d.setDate(d.getDate() - day + 1);
      return { start: d.toISOString().split('T')[0], end: todayStr };
    }
    if (datePreset === 'this_month') {
      const start = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
      return { start, end: todayStr };
    }
    if (datePreset === 'this_quarter') {
      const qMonth = Math.floor(now.getMonth() / 3) * 3;
      const start = new Date(now.getFullYear(), qMonth, 1).toISOString().split('T')[0];
      return { start, end: todayStr };
    }
    if (datePreset === 'by_month' && selectedMonth) {
      const [y, m] = selectedMonth.split('-').map(Number);
      if (y && m) {
        const start = `${y}-${String(m).padStart(2, '0')}-01`;
        const lastDay = new Date(y, m, 0).getDate();
        const end = `${y}-${String(m).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
        return { start, end };
      }
    }
    if (datePreset === 'by_quarter') {
      const fy = selectedQuarterFY;
      if (selectedQuarterNum === 'Q1') return { start: `${fy}-04-01`, end: `${fy}-06-30` };
      if (selectedQuarterNum === 'Q2') return { start: `${fy}-07-01`, end: `${fy}-09-30` };
      if (selectedQuarterNum === 'Q3') return { start: `${fy}-10-01`, end: `${fy}-12-31` };
      return { start: `${fy + 1}-01-01`, end: `${fy + 1}-03-31` };
    }
    if (datePreset === 'this_year') {
      // Indian Financial Year: April 1 to March 31
      const curYear = now.getFullYear();
      const isPastMarch = now.getMonth() >= 3;
      const fyStart = isPastMarch ? `${curYear}-04-01` : `${curYear - 1}-04-01`;
      return { start: fyStart, end: todayStr };
    }
    if (datePreset === 'custom') {
      return { start: startDate, end: endDate };
    }
    return { start: '2000-01-01', end: '2099-12-31' };
  }, [datePreset, startDate, endDate, selectedMonth, selectedQuarterFY, selectedQuarterNum]);

  // Filtered transactions for the selected date range & filters
  const filteredTxs = useMemo(() => {
    return transactions.filter((t) => {
      if (t.status === 'cancelled') return false;
      if (effectiveDateRange.start && t.date < effectiveDateRange.start) return false;
      if (effectiveDateRange.end && t.date > effectiveDateRange.end) return false;

      if (selectedPartyId !== 'all' && t.partyId !== selectedPartyId) return false;
      if (paymentModeFilter !== 'all' && t.paymentType !== paymentModeFilter) return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchInvoice = t.invoiceNo.toLowerCase().includes(q);
        const matchParty = t.partyName.toLowerCase().includes(q);
        const matchAmount = t.totalAmount.toString().includes(q);
        if (!matchInvoice && !matchParty && !matchAmount) return false;
      }

      return true;
    });
  }, [transactions, effectiveDateRange, selectedPartyId, paymentModeFilter, searchQuery]);

  // Filtered expenses for Daybook and P&L
  const filteredExpenses = useMemo(() => {
    return expenses.filter((e) => {
      if (effectiveDateRange.start && e.date < effectiveDateRange.start) return false;
      if (effectiveDateRange.end && e.date > effectiveDateRange.end) return false;
      if (paymentModeFilter !== 'all' && (e.paymentType || '').toLowerCase() !== paymentModeFilter.toLowerCase()) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchNo = e.expenseNo.toLowerCase().includes(q);
        const matchCat = e.category.toLowerCase().includes(q);
        const matchParty = (e.partyName || '').toLowerCase().includes(q);
        const matchNotes = (e.notes || '').toLowerCase().includes(q);
        if (!matchNo && !matchCat && !matchParty && !matchNotes) return false;
      }
      return true;
    });
  }, [expenses, effectiveDateRange, paymentModeFilter, searchQuery]);

  // Report Navigation Directory
  const reportNavItems: ReportNavItem[] = [
    // Transaction Reports
    { id: 'sale_report', name: 'Sale Report', category: 'transactions', description: 'Complete sales register with GST breakdowns and balances' },
    { id: 'purchase_report', name: 'Purchase Report', category: 'transactions', description: 'Vendor bills, input tax credits (ITC) & payables' },
    { id: 'all_transactions', name: 'All Transactions', category: 'transactions', description: 'Chronological consolidated cash/credit ledger' },
    { id: 'daybook', name: 'Daybook', category: 'transactions', description: 'Daily inflow, outflow, and net cash/bank movements' },
    { id: 'profit_loss', name: 'Profit & Loss', category: 'transactions', description: 'Sales revenue vs cost of goods sold (COGS) & margin %', badge: 'P&L' },

    // GST Reports
    { id: 'gstr1', name: 'GSTR-1 Summary', category: 'gst', description: 'Outward supplies: B2B, B2C, Credit notes & HSN summary', badge: 'GST' },
    { id: 'gstr2', name: 'GSTR-2 Summary', category: 'gst', description: 'Inward supplies & eligible Input Tax Credit (ITC)', badge: 'GST' },
    { id: 'gstr3b', name: 'GSTR-3B Summary', category: 'gst', description: 'Monthly consolidated tax liability vs ITC payable', badge: 'GST' },

    // Party Reports
    { id: 'party_statement', name: 'Party Statement', category: 'parties', description: 'Individual party ledger with running balance statement' },
    { id: 'parties_balance', name: 'Parties Balance & Aging', category: 'parties', description: 'Receivables & payables across all customers & vendors' },

    // Item & Stock Reports
    { id: 'stock_summary', name: 'Stock Summary', category: 'inventory', description: 'Inventory valuation, opening, inwards, outwards & closing stock' },
    { id: 'low_stock', name: 'Low Stock Alert', category: 'inventory', description: 'Items at or below reorder threshold' },
    { id: 'item_sales', name: 'Item-wise Sales', category: 'inventory', description: 'Units sold, sales revenue & product performance' },

    // Security & Audit
    { id: 'audit_trail', name: 'Audit Trail Log', category: 'security', description: 'Chronological log of all create, edit, cancel, convert, and delete actions', badge: 'LOG' },
  ];

  // Export CSV
  const handleExportCSV = () => {
    let csv = '';
    const dateStr = getTodayISO();

    switch (activeReport) {
      case 'sale_report': {
        csv = 'Date,Invoice No,Party Name,Party GSTIN,Payment Type,Taxable Value (Subtotal),CGST,SGST,IGST,Total Tax,Total Amount,Balance Due\n';
        filteredTxs
          .filter((t) => t.type === 'sale_invoice' || t.type === 'sale_return')
          .forEach((t) => {
            csv += `"${t.date}","${t.invoiceNo}","${t.partyName}","${t.partyGstin || ''}","${t.paymentType}",${t.subtotal},${t.cgst},${t.sgst},${t.igst},${t.totalTax},${t.totalAmount},${t.balanceDue}\n`;
          });
        break;
      }
      case 'purchase_report': {
        csv = 'Date,Bill No,Supplier Name,GSTIN,Payment Type,Subtotal,Tax,Total Amount,Balance Due\n';
        filteredTxs
          .filter((t) => t.type === 'purchase_bill' || t.type === 'purchase_return')
          .forEach((t) => {
            csv += `"${t.date}","${t.invoiceNo}","${t.partyName}","${t.partyGstin || ''}","${t.paymentType}",${t.subtotal},${t.totalTax},${t.totalAmount},${t.balanceDue}\n`;
          });
        break;
      }
      case 'all_transactions': {
        csv = 'Date,Invoice/Ref No,Type,Party Name,Payment Mode,Total Amount,Balance Due\n';
        filteredTxs.forEach((t) => {
          csv += `"${t.date}","${t.invoiceNo}","${t.type}","${t.partyName}","${t.paymentType}",${t.totalAmount},${t.balanceDue}\n`;
        });
        break;
      }
      case 'stock_summary': {
        csv = 'Item Name,Item Code,HSN,Category,Unit,Sale Price,Purchase Price,Current Stock,Stock Value\n';
        items.forEach((i) => {
          csv += `"${i.name}","${i.itemCode || ''}","${i.hsn || ''}","${i.category || 'General'}","${i.unit}",${i.salePrice},${i.purchasePrice},${i.currentStock},${i.stockValue || 0}\n`;
        });
        break;
      }
      case 'parties_balance': {
        csv = 'Party Name,Group,Phone,GSTIN,Opening Balance,Net Balance,Balance Type\n';
        parties.forEach((p) => {
          const b = partyBalances[p.id];
          csv += `"${p.name}","${p.group}","${p.phone || ''}","${p.gstin || ''}",${p.openingBalance},${b?.balance || 0},"${b?.type || 'to_receive'}"\n`;
        });
        break;
      }
      case 'gstr1': {
        const sales = filteredTxs.filter((t) => t.type === 'sale_invoice');
        const creditNotes = filteredTxs.filter((t) => t.type === 'sale_return');
        const lines: string[] = [];
        lines.push('SECTION: 4A B2B REGISTERED INVOICES');
        lines.push('Date,Invoice No,Party GSTIN,Party Name,Place of Supply,Taxable Value,CGST,SGST,IGST,Invoice Total');
        sales
          .filter((t) => t.partyGstin && t.partyGstin.trim().length === 15)
          .forEach((t) => {
            lines.push(`"${t.date}","${t.invoiceNo}","${t.partyGstin}","${t.partyName}","${t.stateOfSupply}",${t.subtotal},${t.cgst},${t.sgst},${t.igst},${t.totalAmount}`);
          });

        lines.push('');
        lines.push('SECTION: 5 B2C LARGE (INTER-STATE > 2.5L)');
        lines.push('Date,Invoice No,Party Name,Place of Supply,Taxable Value,IGST,Invoice Total');
        sales
          .filter((t) => (!t.partyGstin || t.partyGstin.trim().length !== 15) && t.igst > 0 && t.totalAmount > 250000)
          .forEach((t) => {
            lines.push(`"${t.date}","${t.invoiceNo}","${t.partyName}","${t.stateOfSupply}",${t.subtotal},${t.igst},${t.totalAmount}`);
          });

        lines.push('');
        lines.push('SECTION: 7 B2C SMALL SUMMARY');
        lines.push('Date,Invoice No,Party Name,Place of Supply,Taxable Value,CGST,SGST,IGST,Invoice Total');
        sales
          .filter((t) => (!t.partyGstin || t.partyGstin.trim().length !== 15) && !(t.igst > 0 && t.totalAmount > 250000))
          .forEach((t) => {
            lines.push(`"${t.date}","${t.invoiceNo}","${t.partyName}","${t.stateOfSupply}",${t.subtotal},${t.cgst},${t.sgst},${t.igst},${t.totalAmount}`);
          });

        lines.push('');
        lines.push('SECTION: 9B CREDIT NOTES (SALE RETURNS)');
        lines.push('Date,Credit Note No,Original Invoice,Party GSTIN,Party Name,Taxable Reversed,CGST,SGST,IGST,Total Reversed');
        creditNotes.forEach((t) => {
          lines.push(`"${t.date}","${t.invoiceNo}","${t.originalInvoiceNo || ''}","${t.partyGstin || 'URP'}","${t.partyName}",${t.subtotal},${t.cgst},${t.sgst},${t.igst},${t.totalAmount}`);
        });

        lines.push('');
        lines.push('SECTION: 12 HSN-WISE SUMMARY');
        lines.push('HSN Code,Description,UQC,Total Qty,Taxable Value,CGST,SGST,IGST,Total Tax');
        const hsnExportMap = new Map<string, { desc: string; uqc: string; qty: number; taxable: number; cgst: number; sgst: number; igst: number; tax: number }>();
        for (const s of sales) {
          const inter = s.igst > 0;
          for (const it of s.items) {
            const k = it.hsn || 'NON-HSN';
            const prev = hsnExportMap.get(k) || { desc: it.name, uqc: it.unit || 'PCS', qty: 0, taxable: 0, cgst: 0, sgst: 0, igst: 0, tax: 0 };
            const tAmt = it.taxAmount || 0;
            prev.qty += it.qty || 0;
            prev.taxable += (it.totalAmount || 0) - tAmt;
            prev.tax += tAmt;
            if (inter) prev.igst += tAmt;
            else {
              prev.cgst += tAmt / 2;
              prev.sgst += tAmt / 2;
            }
            hsnExportMap.set(k, prev);
          }
        }
        hsnExportMap.forEach((v, k) => {
          lines.push(`"${k}","${v.desc}","${v.uqc}",${v.qty},${v.taxable.toFixed(2)},${v.cgst.toFixed(2)},${v.sgst.toFixed(2)},${v.igst.toFixed(2)},${v.tax.toFixed(2)}`);
        });

        csv = lines.join('\n');
        break;
      }
      case 'gstr2': {
        csv = 'Date,Type,Bill / Debit Note No,Supplier GSTIN,Supplier Name,Taxable Value,CGST,SGST,IGST,Eligible ITC\n';
        filteredTxs
          .filter((t) => t.type === 'purchase_bill' || t.type === 'purchase_return')
          .forEach((t) => {
            const sign = t.type === 'purchase_return' ? -1 : 1;
            csv += `"${t.date}","${t.type === 'purchase_return' ? 'Debit Note' : 'Purchase Bill'}","${t.invoiceNo}","${
              t.partyGstin || 'Unregistered'
            }","${t.partyName}",${sign * t.subtotal},${sign * (t.cgst || 0)},${sign * (t.sgst || 0)},${sign * (t.igst || 0)},${
              sign * t.totalTax
            }\n`;
          });
        break;
      }
      case 'audit_trail': {
        csv = 'Timestamp,Action,Entity Type,Entity Label,Actor,Details\n';
        auditLogs.forEach((l) => {
          csv += `"${l.timestamp}","${l.action}","${l.entityType}","${l.entityLabel.replace(/"/g, '""')}","${l.actor}","${l.details.replace(/"/g, '""')}"\n`;
        });
        break;
      }
      default: {
        csv = 'Date,Reference,Party,Amount\n';
        filteredTxs.forEach((t) => {
          csv += `"${t.date}","${t.invoiceNo}","${t.partyName}",${t.totalAmount}\n`;
        });
        break;
      }
    }

    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${activeReport}_${dateStr}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="flex h-full w-full overflow-hidden bg-slate-50">
      {/* LEFT NAVIGATION: Report Catalog Directory */}
      <div className="w-72 md:w-80 border-r border-slate-200 bg-white flex flex-col shrink-0">
        <div className="p-4 border-b border-slate-200">
          <div className="flex items-center gap-2 text-slate-900">
            <div className="w-7 h-7 rounded-lg bg-rose-600 text-white flex items-center justify-center shadow-xs">
              <BarChart3 className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold tracking-tight">Reports & Registers</h2>
              <p className="text-[10px] text-slate-500">Vyapar Desktop Accounting</p>
            </div>
          </div>
        </div>

        {/* Categories List */}
        <div className="flex-1 overflow-y-auto p-3 space-y-4">
          {/* 1. Transaction Reports */}
          <div>
            <span className="px-2 text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
              Transaction Reports
            </span>
            <div className="space-y-0.5">
              {reportNavItems
                .filter((r) => r.category === 'transactions')
                .map((r) => (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => setActiveReport(r.id)}
                    className={`w-full px-2.5 py-2 text-left rounded-lg text-xs transition-colors flex items-center justify-between cursor-pointer ${
                      activeReport === r.id
                        ? 'bg-rose-50 text-rose-700 font-bold border border-rose-200/80 shadow-2xs'
                        : 'text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    <span className="truncate">{r.name}</span>
                    {r.badge && (
                      <span className="text-[9px] px-1.5 py-0.2 rounded-md bg-rose-100 text-rose-800 font-semibold font-mono">
                        {r.badge}
                      </span>
                    )}
                  </button>
                ))}
            </div>
          </div>

          {/* 2. GST Filing Reports */}
          <div>
            <span className="px-2 text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
              GST Filing & Returns
            </span>
            <div className="space-y-0.5">
              {reportNavItems
                .filter((r) => r.category === 'gst')
                .map((r) => (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => setActiveReport(r.id)}
                    className={`w-full px-2.5 py-2 text-left rounded-lg text-xs transition-colors flex items-center justify-between cursor-pointer ${
                      activeReport === r.id
                        ? 'bg-rose-50 text-rose-700 font-bold border border-rose-200/80 shadow-2xs'
                        : 'text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    <span className="truncate">{r.name}</span>
                    <span className="text-[9px] px-1.5 py-0.2 rounded-md bg-slate-200 text-slate-700 font-semibold font-mono">
                      {r.badge}
                    </span>
                  </button>
                ))}
            </div>
          </div>

          {/* 3. Party & Balance Reports */}
          <div>
            <span className="px-2 text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
              Parties & Ledgers
            </span>
            <div className="space-y-0.5">
              {reportNavItems
                .filter((r) => r.category === 'parties')
                .map((r) => (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => setActiveReport(r.id)}
                    className={`w-full px-2.5 py-2 text-left rounded-lg text-xs transition-colors flex items-center justify-between cursor-pointer ${
                      activeReport === r.id
                        ? 'bg-rose-50 text-rose-700 font-bold border border-rose-200/80 shadow-2xs'
                        : 'text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    <span className="truncate">{r.name}</span>
                  </button>
                ))}
            </div>
          </div>

          {/* 4. Inventory & Stock Reports */}
          <div>
            <span className="px-2 text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
              Inventory & Items
            </span>
            <div className="space-y-0.5">
              {reportNavItems
                .filter((r) => r.category === 'inventory')
                .map((r) => (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => setActiveReport(r.id)}
                    className={`w-full px-2.5 py-2 text-left rounded-lg text-xs transition-colors flex items-center justify-between cursor-pointer ${
                      activeReport === r.id
                        ? 'bg-rose-50 text-rose-700 font-bold border border-rose-200/80 shadow-2xs'
                        : 'text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    <span className="truncate">{r.name}</span>
                  </button>
                ))}
            </div>
          </div>

          {/* 5. Security & Audit */}
          <div>
            <span className="px-2 text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
              Security &amp; Audit
            </span>
            <div className="space-y-0.5">
              {reportNavItems
                .filter((r) => r.category === 'security')
                .map((r) => (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => setActiveReport(r.id)}
                    className={`w-full px-2.5 py-2 text-left rounded-lg text-xs transition-colors flex items-center justify-between cursor-pointer ${
                      activeReport === r.id
                        ? 'bg-rose-50 text-rose-700 font-bold border border-rose-200/80 shadow-2xs'
                        : 'text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    <span className="truncate">{r.name}</span>
                    {r.badge && (
                      <span className="px-1.5 py-0.5 rounded bg-indigo-100 text-indigo-700 text-[9px] font-bold">
                        {r.badge}
                      </span>
                    )}
                  </button>
                ))}
            </div>
          </div>
        </div>
      </div>

      {/* RIGHT WORKSPACE: Active Report Content & Print Ready Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-y-auto">
        {/* Top Control Bar: Title, Filters & Export */}
        <div className="p-4 sm:p-5 border-b border-slate-200 bg-white sticky top-0 z-20 shadow-2xs space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h1 className="text-lg font-bold text-slate-900 tracking-tight flex items-center gap-2">
                <span>{reportNavItems.find((r) => r.id === activeReport)?.name || 'Report'}</span>
              </h1>
              <p className="text-xs text-slate-500 mt-0.5">
                {reportNavItems.find((r) => r.id === activeReport)?.description}
              </p>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={handlePrint}
                className="px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg flex items-center gap-1.5 cursor-pointer shadow-2xs transition-colors"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Print PDF</span>
              </button>

              <button
                type="button"
                onClick={handleExportCSV}
                className="px-3.5 py-1.5 text-xs font-semibold text-white bg-emerald-700 hover:bg-emerald-800 rounded-lg flex items-center gap-1.5 cursor-pointer shadow-2xs transition-colors"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Export Excel / CSV</span>
              </button>
            </div>
          </div>

          {/* Filter Bar */}
          <div className="pt-2 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3 text-xs">
            {/* Presets */}
            <div className="flex items-center gap-1 overflow-x-auto p-0.5 bg-slate-100 rounded-lg">
              {(
                [
                  ['today', 'Today'],
                  ['this_week', 'This Week'],
                  ['this_month', 'This Month'],
                  ['by_month', 'Month'],
                  ['by_quarter', 'Quarter'],
                  ['this_year', 'This FY'],
                  ['all', 'All Time'],
                  ['custom', 'Custom'],
                ] as const
              ).map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setDatePreset(key)}
                  className={`px-2.5 py-1 rounded-md font-medium transition-colors cursor-pointer whitespace-nowrap text-[11px] ${
                    datePreset === key
                      ? 'bg-white text-slate-900 shadow-2xs font-semibold'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            {/* Specific Month Picker */}
            {datePreset === 'by_month' && (
              <div className="flex items-center gap-2">
                <span className="text-[11px] text-slate-500 font-medium">Select Month:</span>
                <input
                  type="month"
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(e.target.value)}
                  className="px-2.5 py-1 bg-slate-50 border border-slate-200 rounded-md text-[11px] font-mono cursor-pointer"
                />
              </div>
            )}

            {/* Specific Fiscal Quarter Picker */}
            {datePreset === 'by_quarter' && (
              <div className="flex items-center gap-2">
                <select
                  value={selectedQuarterNum}
                  onChange={(e) => setSelectedQuarterNum(e.target.value as 'Q1' | 'Q2' | 'Q3' | 'Q4')}
                  className="px-2.5 py-1 bg-slate-50 border border-slate-200 rounded-md text-[11px] font-medium cursor-pointer"
                >
                  <option value="Q1">Q1 (Apr – Jun)</option>
                  <option value="Q2">Q2 (Jul – Sep)</option>
                  <option value="Q3">Q3 (Oct – Dec)</option>
                  <option value="Q4">Q4 (Jan – Mar)</option>
                </select>
                <select
                  value={selectedQuarterFY}
                  onChange={(e) => setSelectedQuarterFY(Number(e.target.value))}
                  className="px-2.5 py-1 bg-slate-50 border border-slate-200 rounded-md text-[11px] font-mono cursor-pointer"
                >
                  {[2023, 2024, 2025, 2026, 2027].map((yr) => (
                    <option key={yr} value={yr}>
                      FY {yr}-{String(yr + 1).slice(-2)}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Custom Range if Custom selected */}
            {datePreset === 'custom' && (
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
            )}

            {/* Party selector for party_statement */}
            {activeReport === 'party_statement' ? (
              <div className="flex items-center gap-2">
                <span className="text-slate-500 font-medium">Select Party:</span>
                <select
                  value={statementPartyId}
                  onChange={(e) => setStatementPartyId(e.target.value)}
                  className="px-2.5 py-1 bg-slate-50 border border-slate-200 rounded-md text-[11px] font-medium cursor-pointer max-w-xs truncate"
                >
                  {parties.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.group})
                    </option>
                  ))}
                </select>
              </div>
            ) : (
              /* Search box for table filtering */
              <div className="relative w-full sm:w-64">
                <Search className="w-3 h-3 text-slate-400 absolute left-2.5 top-2.5" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Filter report records..."
                  className="w-full pl-8 pr-3 py-1 bg-slate-50 border border-slate-200 rounded-md text-[11px] focus:outline-hidden focus:ring-1 focus:ring-slate-900"
                />
              </div>
            )}
          </div>
        </div>

        {/* Report Content Container */}
        <div className="p-4 sm:p-6 space-y-6 max-w-7xl">
          {/* Printable Business Header (visible on paper/PDF) */}
          <div className="hidden print:block pb-4 mb-4 border-b border-slate-300">
            <h1 className="text-xl font-bold text-slate-900">{businessProfile?.businessName || 'Business'}</h1>
            <p className="text-xs text-slate-600">{businessProfile?.address}</p>
            <p className="text-xs text-slate-600 font-mono">GSTIN: {businessProfile?.gstin || 'Unregistered'} · State: {businessProfile?.state}</p>
            <h2 className="text-base font-bold text-slate-900 mt-2 uppercase">{reportNavItems.find((r) => r.id === activeReport)?.name}</h2>
            <p className="text-xs text-slate-500 font-mono">Period: {effectiveDateRange.start} to {effectiveDateRange.end}</p>
          </div>

          {/* 1. SALE REPORT */}
          {activeReport === 'sale_report' && (
            <SaleReportView
              transactions={filteredTxs}
              onSelectTransaction={onViewTransaction}
            />
          )}

          {/* 2. PURCHASE REPORT */}
          {activeReport === 'purchase_report' && (
            <PurchaseReportView
              transactions={filteredTxs}
              onSelectTransaction={onViewTransaction}
            />
          )}

          {/* 3. ALL TRANSACTIONS */}
          {activeReport === 'all_transactions' && (
            <AllTransactionsReportView
              transactions={filteredTxs}
              onSelectTransaction={onViewTransaction}
            />
          )}

          {/* 4. DAYBOOK */}
          {activeReport === 'daybook' && (
            <DaybookReportView
              transactions={filteredTxs}
              expenses={filteredExpenses}
              onSelectTransaction={onViewTransaction}
            />
          )}

          {/* 5. PROFIT & LOSS */}
          {activeReport === 'profit_loss' && (
            <ProfitAndLossView
              transactions={filteredTxs}
              items={items}
              expenses={filteredExpenses}
            />
          )}

          {/* 6. GSTR-1 */}
          {activeReport === 'gstr1' && (
            <Gstr1ReportView
              transactions={filteredTxs}
            />
          )}

          {/* 7. GSTR-2 */}
          {activeReport === 'gstr2' && (
            <Gstr2ReportView
              transactions={filteredTxs}
            />
          )}

          {/* 8. GSTR-3B */}
          {activeReport === 'gstr3b' && (
            <Gstr3bReportView
              transactions={filteredTxs}
            />
          )}

          {/* 9. PARTY STATEMENT */}
          {activeReport === 'party_statement' && (
            <PartyStatementView
              party={parties.find((p) => p.id === statementPartyId) || null}
              transactions={transactions}
              startDate={effectiveDateRange.start}
              endDate={effectiveDateRange.end}
              onSelectTransaction={onViewTransaction}
            />
          )}

          {/* 10. PARTIES BALANCE & AGING */}
          {activeReport === 'parties_balance' && (
            <PartiesBalanceView
              parties={parties}
              balances={partyBalances}
            />
          )}

          {/* 11. STOCK SUMMARY */}
          {activeReport === 'stock_summary' && (
            <StockSummaryView
              items={items}
              transactions={transactions}
            />
          )}

          {/* 12. LOW STOCK */}
          {activeReport === 'low_stock' && (
            <LowStockReportView
              items={items}
            />
          )}

          {/* 13. ITEM SALES */}
          {activeReport === 'item_sales' && (
            <ItemWiseSalesReportView
              items={items}
              transactions={filteredTxs}
            />
          )}

          {/* 14. AUDIT TRAIL */}
          {activeReport === 'audit_trail' && (
            <AuditTrailReportView
              logs={auditLogs}
              searchQuery={searchQuery}
              onClearLogs={async () => {
                const ok = await requirePin('Enter PIN to clear Audit Trail logs');
                if (!ok) return;
                await clearAuditLogs();
                setAuditLogs([]);
              }}
              onRefresh={loadAllData}
            />
          )}
        </div>
      </div>
    </div>
  );
};

// =========================================================================
// SUB-REPORT 1: SALE REPORT VIEW
// =========================================================================
const SaleReportView: React.FC<{ transactions: Transaction[]; onSelectTransaction: (tx: Transaction) => void }> = ({
  transactions,
  onSelectTransaction,
}) => {
  const sales = transactions.filter((t) => t.type === 'sale_invoice' || t.type === 'sale_return');
  const totalSales = sales.reduce((acc, t) => acc + (t.type === 'sale_return' ? -t.totalAmount : t.totalAmount), 0);
  const totalTax = sales.reduce((acc, t) => acc + (t.type === 'sale_return' ? -t.totalTax : t.totalTax), 0);
  const totalReceived = sales.reduce((acc, t) => acc + (t.receivedAmount || 0), 0);
  const totalBalance = sales.reduce((acc, t) => acc + (t.balanceDue || 0), 0);

  return (
    <div className="space-y-4">
      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-2xs">
          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Net Sales</span>
          <div className="text-lg font-bold text-slate-900 font-mono mt-1">{formatINR(totalSales)}</div>
          <span className="text-[11px] text-slate-400">{sales.length} Invoices</span>
        </div>
        <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-2xs">
          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">GST Collected</span>
          <div className="text-lg font-bold text-rose-600 font-mono mt-1">{formatINR(totalTax)}</div>
          <span className="text-[11px] text-slate-400">CGST + SGST + IGST</span>
        </div>
        <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-2xs">
          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Received</span>
          <div className="text-lg font-bold text-emerald-700 font-mono mt-1">{formatINR(totalReceived)}</div>
          <span className="text-[11px] text-emerald-600">Paid in Cash / Bank</span>
        </div>
        <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-2xs">
          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Balance Receivable</span>
          <div className="text-lg font-bold text-amber-700 font-mono mt-1">{formatINR(totalBalance)}</div>
          <span className="text-[11px] text-amber-600">Pending collections</span>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
        {sales.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200 uppercase text-[11px]">
                  <th className="py-2.5 px-3">Date</th>
                  <th className="py-2.5 px-3">Invoice #</th>
                  <th className="py-2.5 px-3">Party Name</th>
                  <th className="py-2.5 px-3">GSTIN</th>
                  <th className="py-2.5 px-3">Payment</th>
                  <th className="py-2.5 px-3 text-right">Taxable</th>
                  <th className="py-2.5 px-3 text-right">CGST</th>
                  <th className="py-2.5 px-3 text-right">SGST</th>
                  <th className="py-2.5 px-3 text-right">IGST</th>
                  <th className="py-2.5 px-3 text-right">Total Amount</th>
                  <th className="py-2.5 px-3 text-right">Balance</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {sales.map((t) => (
                  <tr
                    key={t.id}
                    onClick={() => onSelectTransaction(t)}
                    className="hover:bg-slate-50 transition-colors cursor-pointer"
                  >
                    <td className="py-2.5 px-3 font-mono text-slate-600">{formatDate(t.date)}</td>
                    <td className="py-2.5 px-3 font-mono font-bold text-slate-900">{t.invoiceNo}</td>
                    <td className="py-2.5 px-3 font-medium text-slate-900">{t.partyName}</td>
                    <td className="py-2.5 px-3 font-mono text-[11px] text-slate-500">{t.partyGstin || '-'}</td>
                    <td className="py-2.5 px-3 uppercase text-[11px] text-slate-600 font-mono">{t.paymentType}</td>
                    <td className="py-2.5 px-3 text-right font-mono tabular-nums">{formatINR(t.subtotal)}</td>
                    <td className="py-2.5 px-3 text-right font-mono tabular-nums">{formatINR(t.cgst)}</td>
                    <td className="py-2.5 px-3 text-right font-mono tabular-nums">{formatINR(t.sgst)}</td>
                    <td className="py-2.5 px-3 text-right font-mono tabular-nums">{formatINR(t.igst)}</td>
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
          </div>
        ) : (
          <div className="p-12 text-center text-xs text-slate-400">No sales recorded for this period.</div>
        )}
      </div>
    </div>
  );
};

// =========================================================================
// SUB-REPORT 2: PURCHASE REPORT VIEW
// =========================================================================
const PurchaseReportView: React.FC<{ transactions: Transaction[]; onSelectTransaction: (tx: Transaction) => void }> = ({
  transactions,
  onSelectTransaction,
}) => {
  const purchases = transactions.filter((t) => t.type === 'purchase_bill' || t.type === 'purchase_return');
  const totalPurchases = purchases.reduce((acc, t) => acc + (t.type === 'purchase_return' ? -t.totalAmount : t.totalAmount), 0);
  const totalTax = purchases.reduce((acc, t) => acc + (t.type === 'purchase_return' ? -t.totalTax : t.totalTax), 0);
  const totalPaid = purchases.reduce((acc, t) => acc + (t.receivedAmount || 0), 0);
  const totalBalance = purchases.reduce((acc, t) => acc + (t.balanceDue || 0), 0);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-2xs">
          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Net Purchases</span>
          <div className="text-lg font-bold text-slate-900 font-mono mt-1">{formatINR(totalPurchases)}</div>
          <span className="text-[11px] text-slate-400">{purchases.length} Bills</span>
        </div>
        <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-2xs">
          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">ITC (Input Tax)</span>
          <div className="text-lg font-bold text-blue-600 font-mono mt-1">{formatINR(totalTax)}</div>
          <span className="text-[11px] text-slate-400">Claimable GST Credit</span>
        </div>
        <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-2xs">
          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Paid</span>
          <div className="text-lg font-bold text-emerald-700 font-mono mt-1">{formatINR(totalPaid)}</div>
          <span className="text-[11px] text-emerald-600">Paid to Vendors</span>
        </div>
        <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-2xs">
          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Payable Balance</span>
          <div className="text-lg font-bold text-rose-700 font-mono mt-1">{formatINR(totalBalance)}</div>
          <span className="text-[11px] text-rose-600">Pending payment</span>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
        {purchases.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200 uppercase text-[11px]">
                  <th className="py-2.5 px-3">Date</th>
                  <th className="py-2.5 px-3">Bill #</th>
                  <th className="py-2.5 px-3">Supplier Name</th>
                  <th className="py-2.5 px-3">GSTIN</th>
                  <th className="py-2.5 px-3">Payment</th>
                  <th className="py-2.5 px-3 text-right">Taxable</th>
                  <th className="py-2.5 px-3 text-right">Tax (ITC)</th>
                  <th className="py-2.5 px-3 text-right">Total Amount</th>
                  <th className="py-2.5 px-3 text-right">Balance Due</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {purchases.map((t) => (
                  <tr
                    key={t.id}
                    onClick={() => onSelectTransaction(t)}
                    className="hover:bg-slate-50 transition-colors cursor-pointer"
                  >
                    <td className="py-2.5 px-3 font-mono text-slate-600">{formatDate(t.date)}</td>
                    <td className="py-2.5 px-3 font-mono font-bold text-slate-900">{t.invoiceNo}</td>
                    <td className="py-2.5 px-3 font-medium text-slate-900">{t.partyName}</td>
                    <td className="py-2.5 px-3 font-mono text-[11px] text-slate-500">{t.partyGstin || '-'}</td>
                    <td className="py-2.5 px-3 uppercase text-[11px] text-slate-600 font-mono">{t.paymentType}</td>
                    <td className="py-2.5 px-3 text-right font-mono tabular-nums">{formatINR(t.subtotal)}</td>
                    <td className="py-2.5 px-3 text-right font-mono text-blue-700 tabular-nums">{formatINR(t.totalTax)}</td>
                    <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-900 tabular-nums">{formatINR(t.totalAmount)}</td>
                    <td className="py-2.5 px-3 text-right font-mono tabular-nums">
                      {t.balanceDue > 0 ? (
                        <span className="text-rose-700 font-semibold">{formatINR(t.balanceDue)}</span>
                      ) : (
                        <span className="text-emerald-700">Settled</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-12 text-center text-xs text-slate-400">No purchases recorded for this period.</div>
        )}
      </div>
    </div>
  );
};

// =========================================================================
// SUB-REPORT 3: ALL TRANSACTIONS
// =========================================================================
const AllTransactionsReportView: React.FC<{ transactions: Transaction[]; onSelectTransaction: (tx: Transaction) => void }> = ({
  transactions,
  onSelectTransaction,
}) => {
  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
      {transactions.length > 0 ? (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200 uppercase text-[11px]">
                <th className="py-2.5 px-4">Date</th>
                <th className="py-2.5 px-4">Type</th>
                <th className="py-2.5 px-4">Invoice / Ref #</th>
                <th className="py-2.5 px-4">Party Name</th>
                <th className="py-2.5 px-4">Payment Mode</th>
                <th className="py-2.5 px-4 text-right">Total Amount</th>
                <th className="py-2.5 px-4 text-right">Balance Due</th>
                <th className="py-2.5 px-4 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {transactions.map((tx) => (
                <tr
                  key={tx.id}
                  onClick={() => onSelectTransaction(tx)}
                  className="hover:bg-slate-50 transition-colors cursor-pointer"
                >
                  <td className="py-2.5 px-4 font-mono text-slate-600">{formatDate(tx.date)}</td>
                  <td className="py-2.5 px-4 capitalize font-medium text-slate-900">{tx.type.replace('_', ' ')}</td>
                  <td className="py-2.5 px-4 font-mono font-bold text-slate-900">{tx.invoiceNo}</td>
                  <td className="py-2.5 px-4 text-slate-800">{tx.partyName}</td>
                  <td className="py-2.5 px-4 uppercase font-mono text-[11px] text-slate-600">{tx.paymentType}</td>
                  <td className="py-2.5 px-4 text-right font-mono font-bold text-slate-900 tabular-nums">
                    {formatINR(tx.totalAmount)}
                  </td>
                  <td className="py-2.5 px-4 text-right font-mono tabular-nums">
                    {tx.balanceDue > 0 ? (
                      <span className="text-amber-700 font-semibold">{formatINR(tx.balanceDue)}</span>
                    ) : (
                      <span className="text-emerald-700">Settled</span>
                    )}
                  </td>
                  <td className="py-2.5 px-4 text-center">
                    <span className="text-[11px] font-medium text-emerald-600 uppercase">{tx.status}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="p-12 text-center text-xs text-slate-400">No transactions recorded.</div>
      )}
    </div>
  );
};

// =========================================================================
// SUB-REPORT 4: DAYBOOK VIEW (Inflow, Outflow, Expenses & Net Cash Flow)
// =========================================================================
const DaybookReportView: React.FC<{
  transactions: Transaction[];
  expenses?: Expense[];
  onSelectTransaction: (tx: Transaction) => void;
}> = ({ transactions, expenses = [], onSelectTransaction }) => {
  const inflow = transactions
    .filter((t) => t.type === 'sale_invoice' || t.type === 'payment_in')
    .reduce((acc, t) => acc + (t.type === 'sale_invoice' ? t.receivedAmount || 0 : t.totalAmount), 0);

  const txOutflow = transactions
    .filter((t) => t.type === 'purchase_bill' || t.type === 'payment_out')
    .reduce((acc, t) => acc + (t.type === 'purchase_bill' ? t.receivedAmount || 0 : t.totalAmount), 0);

  const expenseOutflow = expenses.reduce((acc, e) => acc + (e.amount || 0), 0);
  const totalOutflow = txOutflow + expenseOutflow;

  const netCashFlow = inflow - totalOutflow;

  // Merge transactions and expenses for the daybook list
  interface DaybookRow {
    id: string;
    date: string;
    refNo: string;
    particulars: string;
    type: string;
    inflow: number;
    outflow: number;
    originalTx?: Transaction;
  }

  const rows: DaybookRow[] = [
    ...transactions.map((t) => {
      const isNonCash =
        t.type === 'estimate' ||
        t.type === 'delivery_challan' ||
        t.type === 'job_work_out' ||
        t.type === 'job_work_in';
      const isInflow = t.type === 'sale_invoice' || t.type === 'payment_in' || t.type === 'purchase_return';
      const amount = isNonCash
        ? 0
        : t.type === 'sale_invoice'
        ? t.receivedAmount || 0
        : t.type === 'purchase_bill'
        ? t.receivedAmount || 0
        : t.totalAmount;
      return {
        id: t.id,
        date: t.date,
        refNo: t.invoiceNo,
        particulars: t.partyName || 'Cash Sale',
        type: t.type.replace(/_/g, ' '),
        inflow: isInflow ? amount : 0,
        outflow: !isInflow && !isNonCash ? amount : 0,
        originalTx: t,
      };
    }),
    ...expenses.map((e) => ({
      id: e.id,
      date: e.date,
      refNo: e.expenseNo,
      particulars: `${e.category}${e.partyName ? ` (${e.partyName})` : ''}${e.notes ? ` - ${e.notes}` : ''}`,
      type: 'Expense',
      inflow: 0,
      outflow: e.amount,
    })),
  ].sort((a, b) => b.date.localeCompare(a.date));

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-2xs">
          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Total Inflow (Receipts)</span>
          <div className="text-lg font-bold text-emerald-700 font-mono mt-1">{formatINR(inflow)}</div>
          <span className="text-[11px] text-slate-400">Customer payments & cash sales</span>
        </div>
        <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-2xs">
          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Total Outflow (Bills & Expenses)</span>
          <div className="text-lg font-bold text-rose-700 font-mono mt-1">{formatINR(totalOutflow)}</div>
          <span className="text-[11px] text-slate-400">Bills: {formatINR(txOutflow)} | Expenses: {formatINR(expenseOutflow)}</span>
        </div>
        <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-2xs">
          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Net Cash / Bank Movement</span>
          <div className={`text-lg font-bold font-mono mt-1 ${netCashFlow >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
            {formatINR(netCashFlow)}
          </div>
          <span className="text-[11px] text-slate-400">Inflow minus outflow</span>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
        {rows.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200 uppercase text-[11px]">
                  <th className="py-2.5 px-4">Date</th>
                  <th className="py-2.5 px-4">Ref #</th>
                  <th className="py-2.5 px-4">Particulars</th>
                  <th className="py-2.5 px-4">Type</th>
                  <th className="py-2.5 px-4 text-right">Inflow (₹)</th>
                  <th className="py-2.5 px-4 text-right">Outflow (₹)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((r) => (
                  <tr
                    key={r.id}
                    onClick={() => r.originalTx && onSelectTransaction(r.originalTx)}
                    className={`hover:bg-slate-50 ${r.originalTx ? 'cursor-pointer' : ''}`}
                  >
                    <td className="py-2.5 px-4 font-mono text-slate-600">{formatDate(r.date)}</td>
                    <td className="py-2.5 px-4 font-mono font-bold text-slate-900">{r.refNo}</td>
                    <td className="py-2.5 px-4 text-slate-800 font-medium truncate max-w-xs">{r.particulars}</td>
                    <td className="py-2.5 px-4 capitalize">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                        r.type === 'Expense'
                          ? 'bg-amber-100 text-amber-800'
                          : r.inflow > 0
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-rose-100 text-rose-800'
                      }`}>
                        {r.type}
                      </span>
                    </td>
                    <td className="py-2.5 px-4 text-right font-mono font-bold text-emerald-700 tabular-nums">
                      {r.inflow > 0 ? formatINR(r.inflow) : '-'}
                    </td>
                    <td className="py-2.5 px-4 text-right font-mono font-bold text-rose-700 tabular-nums">
                      {r.outflow > 0 ? formatINR(r.outflow) : '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-12 text-center text-xs text-slate-400">No daybook entries recorded.</div>
        )}
      </div>
    </div>
  );
};

// =========================================================================
// SUB-REPORT 5: PROFIT & LOSS VIEW (Sales - Purchases - Expenses)
// =========================================================================
const ProfitAndLossView: React.FC<{
  transactions: Transaction[];
  items: Item[];
  expenses?: Expense[];
}> = ({ transactions, items, expenses = [] }) => {
  const itemMap = useMemo(() => new Map(items.map((i) => [i.id, i])), [items]);

  const salesTxs = transactions.filter((t) => t.type === 'sale_invoice');
  const saleReturnTxs = transactions.filter((t) => t.type === 'sale_return');
  const purchaseTxs = transactions.filter((t) => t.type === 'purchase_bill');
  const purchaseReturnTxs = transactions.filter((t) => t.type === 'purchase_return');

  const totalSalesRevenue = salesTxs.reduce((acc, t) => acc + t.totalAmount, 0) - saleReturnTxs.reduce((acc, t) => acc + t.totalAmount, 0);
  const totalPurchaseCost = purchaseTxs.reduce((acc, t) => acc + t.totalAmount, 0) - purchaseReturnTxs.reduce((acc, t) => acc + t.totalAmount, 0);
  const totalExpenseAmt = expenses.reduce((acc, e) => acc + (e.amount || 0), 0);

  const hasData = totalSalesRevenue > 0 || totalPurchaseCost > 0 || totalExpenseAmt > 0;
  const netProfit = hasData ? totalSalesRevenue - totalPurchaseCost - totalExpenseAmt : 0;
  const netMarginPercent = totalSalesRevenue > 0 ? (netProfit / totalSalesRevenue) * 100 : 0;

  // Item COGS calculation for inventory analysis
  const netSalesSubtotal = salesTxs.reduce((acc, t) => acc + t.subtotal, 0) - saleReturnTxs.reduce((acc, t) => acc + t.subtotal, 0);
  let cogs = 0;
  for (const sale of salesTxs) {
    for (const line of sale.items) {
      if (line.itemId) {
        const itm = itemMap.get(line.itemId);
        const purchaseCost = itm ? itm.purchasePrice : 0;
        cogs += (line.qty || 0) * purchaseCost;
      }
    }
  }
  const grossProfit = netSalesSubtotal - cogs;

  return (
    <div className="space-y-6">
      {/* Primary Financial Overview: Profit = sales - purchases - expenses */}
      <div className="bg-gradient-to-r from-slate-900 to-slate-800 rounded-xl p-5 text-white shadow-sm border border-slate-700">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-700/60">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-rose-400">
              Net Profit Formula
            </span>
            <h3 className="text-base font-bold text-white mt-0.5">Profit = Sales - Purchases - Expenses</h3>
          </div>
          <span className="text-xs text-slate-300 font-mono bg-white/10 px-2.5 py-1 rounded">
            Filtered Period Summary
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-4">
          <div>
            <span className="text-[10px] uppercase text-slate-400 block font-semibold">Total Sales (+)</span>
            <div className="text-lg font-bold font-mono text-emerald-400 mt-0.5">{formatINR(totalSalesRevenue)}</div>
            <span className="text-[10px] text-slate-400">Net of credit returns</span>
          </div>

          <div>
            <span className="text-[10px] uppercase text-slate-400 block font-semibold">Total Purchases (-)</span>
            <div className="text-lg font-bold font-mono text-blue-400 mt-0.5">{formatINR(totalPurchaseCost)}</div>
            <span className="text-[10px] text-slate-400">Net of debit returns</span>
          </div>

          <div>
            <span className="text-[10px] uppercase text-slate-400 block font-semibold">Total Expenses (-)</span>
            <div className="text-lg font-bold font-mono text-amber-400 mt-0.5">{formatINR(totalExpenseAmt)}</div>
            <span className="text-[10px] text-slate-400">{expenses.length} Expense vouchers</span>
          </div>

          <div>
            <span className="text-[10px] uppercase text-slate-400 block font-semibold">Net Profit / Loss</span>
            <div className={`text-xl font-bold font-mono mt-0.5 ${netProfit >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
              {formatINR(netProfit)}
            </div>
            <span className="text-[10px] text-slate-300">
              {totalSalesRevenue > 0 ? `${netMarginPercent.toFixed(1)}% net margin` : 'Based on actual records'}
            </span>
          </div>
        </div>
      </div>

      {/* 4 Cards: Inventory Gross Margin */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-2xs">
          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Net Revenue (Excl Tax)</span>
          <div className="text-xl font-bold text-slate-900 font-mono mt-1">{formatINR(netSalesSubtotal)}</div>
          <span className="text-[11px] text-slate-400">Total goods/services billed</span>
        </div>
        <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-2xs">
          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Cost of Goods Sold (COGS)</span>
          <div className="text-xl font-bold text-slate-700 font-mono mt-1">{formatINR(cogs)}</div>
          <span className="text-[11px] text-slate-400">At item purchase rates</span>
        </div>
        <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-2xs">
          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Gross Profit (Inventory)</span>
          <div className={`text-xl font-bold font-mono mt-1 ${grossProfit >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
            {formatINR(grossProfit)}
          </div>
          <span className="text-[11px] text-emerald-600">Revenue minus item cost</span>
        </div>
        <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-2xs">
          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Operating Expenses</span>
          <div className="text-xl font-bold text-slate-900 font-mono mt-1">{formatINR(totalExpenseAmt)}</div>
          <span className="text-[11px] text-slate-400">Utilities, rent, salaries</span>
        </div>
      </div>

      {/* Bill-Wise Profitability Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
        <div className="px-5 py-3 border-b border-slate-200">
          <h3 className="text-xs font-bold text-slate-900 uppercase">Bill-Wise Profit Breakdown</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200 uppercase text-[11px]">
                <th className="py-2.5 px-4">Date</th>
                <th className="py-2.5 px-4">Invoice #</th>
                <th className="py-2.5 px-4">Customer</th>
                <th className="py-2.5 px-4 text-right">Invoice Value</th>
                <th className="py-2.5 px-4 text-right">Est. Cost</th>
                <th className="py-2.5 px-4 text-right">Profit</th>
                <th className="py-2.5 px-4 text-right">Margin %</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {salesTxs.map((tx) => {
                let billCost = 0;
                for (const line of tx.items) {
                  if (line.itemId) {
                    const itm = itemMap.get(line.itemId);
                    billCost += (line.qty || 0) * (itm?.purchasePrice || 0);
                  }
                }
                const billProfit = tx.subtotal - billCost;
                const billMargin = tx.subtotal > 0 ? (billProfit / tx.subtotal) * 100 : 0;

                return (
                  <tr key={tx.id} className="hover:bg-slate-50">
                    <td className="py-2.5 px-4 font-mono text-slate-600">{formatDate(tx.date)}</td>
                    <td className="py-2.5 px-4 font-mono font-bold text-slate-900">{tx.invoiceNo}</td>
                    <td className="py-2.5 px-4 text-slate-800">{tx.partyName}</td>
                    <td className="py-2.5 px-4 text-right font-mono tabular-nums">{formatINR(tx.subtotal)}</td>
                    <td className="py-2.5 px-4 text-right font-mono text-slate-600 tabular-nums">{formatINR(billCost)}</td>
                    <td className={`py-2.5 px-4 text-right font-mono font-bold tabular-nums ${billProfit >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                      {formatINR(billProfit)}
                    </td>
                    <td className="py-2.5 px-4 text-right font-mono tabular-nums font-semibold">
                      {billMargin.toFixed(1)}%
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

// =========================================================================
// SUB-REPORT 6: GSTR-1 SUMMARY (B2B, B2C Large, B2C Small, Credit Notes, HSN Summary)
// =========================================================================
const Gstr1ReportView: React.FC<{ transactions: Transaction[] }> = ({ transactions }) => {
  const sales = transactions.filter((t) => t.type === 'sale_invoice');
  const creditNotes = transactions.filter((t) => t.type === 'sale_return');

  // 4A: B2B Invoices with valid 15-char GSTIN
  const b2bInvoices = sales.filter((t) => t.partyGstin && t.partyGstin.trim().length === 15);
  const b2bTaxable = b2bInvoices.reduce((acc, t) => acc + t.subtotal, 0);
  const b2bTax = b2bInvoices.reduce((acc, t) => acc + t.totalTax, 0);

  // 5: B2C Large (Inter-state unregistered invoices > ₹2,50,000)
  const b2cLargeInvoices = sales.filter(
    (t) => (!t.partyGstin || t.partyGstin.trim().length !== 15) && t.igst > 0 && t.totalAmount > 250000
  );
  const b2cLargeTaxable = b2cLargeInvoices.reduce((acc, t) => acc + t.subtotal, 0);
  const b2cLargeTax = b2cLargeInvoices.reduce((acc, t) => acc + t.totalTax, 0);

  // 7: B2C Small (Remaining unregistered sales)
  const b2cSmallInvoices = sales.filter(
    (t) => (!t.partyGstin || t.partyGstin.trim().length !== 15) && !(t.igst > 0 && t.totalAmount > 250000)
  );
  const b2cSmallTaxable = b2cSmallInvoices.reduce((acc, t) => acc + t.subtotal, 0);
  const b2cSmallTax = b2cSmallInvoices.reduce((acc, t) => acc + t.totalTax, 0);

  // 9B: Credit Notes (Sale Returns reducing liability)
  const cnTaxable = creditNotes.reduce((acc, t) => acc + t.subtotal, 0);
  const cnTax = creditNotes.reduce((acc, t) => acc + t.totalTax, 0);

  const netOutwardTax = b2bTax + b2cLargeTax + b2cSmallTax - cnTax;

  // 12: HSN Summary aggregation (net of credit notes optional — keep outward supply HSN clearly itemized)
  const hsnMap = new Map<
    string,
    { hsn: string; desc: string; uqc: string; totalQty: number; taxable: number; cgst: number; sgst: number; igst: number; totalTax: number }
  >();
  for (const s of sales) {
    const isInterState = s.igst > 0;
    for (const item of s.items) {
      const hsnKey = item.hsn || 'NON-HSN';
      const existing = hsnMap.get(hsnKey) || {
        hsn: hsnKey,
        desc: item.name,
        uqc: item.unit || 'PCS',
        totalQty: 0,
        taxable: 0,
        cgst: 0,
        sgst: 0,
        igst: 0,
        totalTax: 0,
      };

      const taxAmt = item.taxAmount || 0;
      existing.totalQty += item.qty || 0;
      existing.taxable += (item.totalAmount || 0) - taxAmt;
      existing.totalTax += taxAmt;
      if (isInterState) {
        existing.igst += taxAmt;
      } else {
        existing.cgst += taxAmt / 2;
        existing.sgst += taxAmt / 2;
      }
      hsnMap.set(hsnKey, existing);
    }
  }

  const hsnList = Array.from(hsnMap.values());

  return (
    <div className="space-y-6">
      {/* 5 Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-2xs">
          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">4A · B2B Registered</span>
          <div className="text-lg font-bold text-slate-900 font-mono mt-1">{formatINR(b2bTaxable)}</div>
          <span className="text-[11px] text-slate-500">{b2bInvoices.length} Invoices · Tax: {formatINR(b2bTax)}</span>
        </div>
        <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-2xs">
          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">5 · B2C Large (&gt;2.5L)</span>
          <div className="text-lg font-bold text-slate-900 font-mono mt-1">{formatINR(b2cLargeTaxable)}</div>
          <span className="text-[11px] text-slate-500">{b2cLargeInvoices.length} Inter-state · Tax: {formatINR(b2cLargeTax)}</span>
        </div>
        <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-2xs">
          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">7 · B2C Small</span>
          <div className="text-lg font-bold text-slate-900 font-mono mt-1">{formatINR(b2cSmallTaxable)}</div>
          <span className="text-[11px] text-slate-500">{b2cSmallInvoices.length} Invoices · Tax: {formatINR(b2cSmallTax)}</span>
        </div>
        <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-2xs">
          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">9B · Credit Notes</span>
          <div className="text-lg font-bold text-amber-700 font-mono mt-1">-{formatINR(cnTaxable)}</div>
          <span className="text-[11px] text-slate-500">{creditNotes.length} Returns · Tax: -{formatINR(cnTax)}</span>
        </div>
        <div className="p-4 bg-white rounded-xl border border-rose-200 bg-rose-50/30 shadow-2xs">
          <span className="text-[10px] font-bold text-rose-700 uppercase tracking-wider block">Net Output GST</span>
          <div className="text-lg font-bold text-rose-700 font-mono mt-1">{formatINR(netOutwardTax)}</div>
          <span className="text-[11px] text-rose-600">After Credit Note reversals</span>
        </div>
      </div>

      {/* 4A B2B Invoices Detail Table */}
      {b2bInvoices.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
          <div className="px-5 py-3 border-b border-slate-200">
            <h3 className="text-xs font-bold text-slate-900 uppercase">4A - B2B Invoices (Registered Buyers)</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200 uppercase text-[11px]">
                  <th className="py-2.5 px-4">GSTIN</th>
                  <th className="py-2.5 px-4">Party Name</th>
                  <th className="py-2.5 px-4">Invoice #</th>
                  <th className="py-2.5 px-4">Date</th>
                  <th className="py-2.5 px-4 text-right">Taxable</th>
                  <th className="py-2.5 px-4 text-right">CGST</th>
                  <th className="py-2.5 px-4 text-right">SGST</th>
                  <th className="py-2.5 px-4 text-right">IGST</th>
                  <th className="py-2.5 px-4 text-right">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {b2bInvoices.map((inv) => (
                  <tr key={inv.id} className="hover:bg-slate-50">
                    <td className="py-2.5 px-4 font-mono font-bold text-slate-900">{inv.partyGstin}</td>
                    <td className="py-2.5 px-4 text-slate-800">{inv.partyName}</td>
                    <td className="py-2.5 px-4 font-mono">{inv.invoiceNo}</td>
                    <td className="py-2.5 px-4 font-mono text-slate-600">{formatDate(inv.date)}</td>
                    <td className="py-2.5 px-4 text-right font-mono tabular-nums">{formatINR(inv.subtotal)}</td>
                    <td className="py-2.5 px-4 text-right font-mono tabular-nums">{formatINR(inv.cgst)}</td>
                    <td className="py-2.5 px-4 text-right font-mono tabular-nums">{formatINR(inv.sgst)}</td>
                    <td className="py-2.5 px-4 text-right font-mono tabular-nums">{formatINR(inv.igst)}</td>
                    <td className="py-2.5 px-4 text-right font-mono font-bold tabular-nums">{formatINR(inv.totalAmount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 9B Credit Notes Table */}
      {creditNotes.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
          <div className="px-5 py-3 border-b border-slate-200">
            <h3 className="text-xs font-bold text-slate-900 uppercase">9B - Credit Notes (Sale Returns GST Reversal)</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200 uppercase text-[11px]">
                  <th className="py-2.5 px-4">Credit Note #</th>
                  <th className="py-2.5 px-4">Original Inv</th>
                  <th className="py-2.5 px-4">Party Name</th>
                  <th className="py-2.5 px-4">GSTIN</th>
                  <th className="py-2.5 px-4 text-right">Taxable Reversed</th>
                  <th className="py-2.5 px-4 text-right">Tax Reversed</th>
                  <th className="py-2.5 px-4 text-right">Note Value</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {creditNotes.map((cn) => (
                  <tr key={cn.id} className="hover:bg-slate-50">
                    <td className="py-2.5 px-4 font-mono font-bold text-amber-700">{cn.invoiceNo}</td>
                    <td className="py-2.5 px-4 font-mono text-slate-500">{cn.originalInvoiceNo || '-'}</td>
                    <td className="py-2.5 px-4 text-slate-800">{cn.partyName}</td>
                    <td className="py-2.5 px-4 font-mono text-slate-500">{cn.partyGstin || 'URP'}</td>
                    <td className="py-2.5 px-4 text-right font-mono tabular-nums">{formatINR(cn.subtotal)}</td>
                    <td className="py-2.5 px-4 text-right font-mono text-amber-700 tabular-nums">{formatINR(cn.totalTax)}</td>
                    <td className="py-2.5 px-4 text-right font-mono font-bold tabular-nums">{formatINR(cn.totalAmount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 12 HSN Summary Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
        <div className="px-5 py-3 border-b border-slate-200">
          <h3 className="text-xs font-bold text-slate-900 uppercase">12 - HSN-Wise Summary of Outward Supplies</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200 uppercase text-[11px]">
                <th className="py-2.5 px-4">HSN Code</th>
                <th className="py-2.5 px-4">Description</th>
                <th className="py-2.5 px-4">UQC</th>
                <th className="py-2.5 px-4 text-right">Total Qty</th>
                <th className="py-2.5 px-4 text-right">Taxable Value</th>
                <th className="py-2.5 px-4 text-right">CGST</th>
                <th className="py-2.5 px-4 text-right">SGST</th>
                <th className="py-2.5 px-4 text-right">IGST</th>
                <th className="py-2.5 px-4 text-right">Total Tax</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {hsnList.length > 0 ? (
                hsnList.map((hsn) => (
                  <tr key={hsn.hsn} className="hover:bg-slate-50">
                    <td className="py-2.5 px-4 font-mono font-bold text-slate-900">{hsn.hsn}</td>
                    <td className="py-2.5 px-4 text-slate-800">{hsn.desc}</td>
                    <td className="py-2.5 px-4 font-mono">{hsn.uqc}</td>
                    <td className="py-2.5 px-4 text-right font-mono font-semibold">{hsn.totalQty}</td>
                    <td className="py-2.5 px-4 text-right font-mono font-semibold tabular-nums">{formatINR(hsn.taxable)}</td>
                    <td className="py-2.5 px-4 text-right font-mono tabular-nums">{formatINR(hsn.cgst)}</td>
                    <td className="py-2.5 px-4 text-right font-mono tabular-nums">{formatINR(hsn.sgst)}</td>
                    <td className="py-2.5 px-4 text-right font-mono tabular-nums">{formatINR(hsn.igst)}</td>
                    <td className="py-2.5 px-4 text-right font-mono font-bold text-rose-700 tabular-nums">{formatINR(hsn.totalTax)}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={9} className="py-8 text-center text-slate-400">
                    No outward supplies in selected period.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

// =========================================================================
// SUB-REPORT 7: PURCHASE TAX SUMMARY / GSTR-2 (Net Input Tax Credit)
// =========================================================================
const Gstr2ReportView: React.FC<{ transactions: Transaction[] }> = ({ transactions }) => {
  const purchases = transactions.filter((t) => t.type === 'purchase_bill' || t.type === 'purchase_return');
  const totalTaxable = purchases.reduce((acc, t) => acc + (t.type === 'purchase_return' ? -t.subtotal : t.subtotal), 0);
  const totalCGST = purchases.reduce((acc, t) => acc + (t.type === 'purchase_return' ? -(t.cgst || 0) : (t.cgst || 0)), 0);
  const totalSGST = purchases.reduce((acc, t) => acc + (t.type === 'purchase_return' ? -(t.sgst || 0) : (t.sgst || 0)), 0);
  const totalIGST = purchases.reduce((acc, t) => acc + (t.type === 'purchase_return' ? -(t.igst || 0) : (t.igst || 0)), 0);
  const totalITC = totalCGST + totalSGST + totalIGST;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-2xs">
          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Net Taxable Purchases</span>
          <div className="text-lg font-bold text-slate-900 font-mono mt-1">{formatINR(totalTaxable)}</div>
          <span className="text-[11px] text-slate-400">{purchases.length} Docs</span>
        </div>
        <div className="p-4 bg-white rounded-xl border border-blue-200 bg-blue-50/30 shadow-2xs">
          <span className="text-[10px] font-bold text-blue-700 uppercase tracking-wider block">Net Eligible ITC</span>
          <div className="text-lg font-bold text-blue-700 font-mono mt-1">{formatINR(totalITC)}</div>
          <span className="text-[11px] text-blue-600">Net of Debit Notes</span>
        </div>
        <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-2xs">
          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Input CGST</span>
          <div className="text-lg font-bold text-slate-900 font-mono mt-1">{formatINR(totalCGST)}</div>
        </div>
        <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-2xs">
          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Input SGST</span>
          <div className="text-lg font-bold text-slate-900 font-mono mt-1">{formatINR(totalSGST)}</div>
        </div>
        <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-2xs">
          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Input IGST</span>
          <div className="text-lg font-bold text-slate-900 font-mono mt-1">{formatINR(totalIGST)}</div>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200 uppercase text-[11px]">
                <th className="py-2.5 px-4">Date</th>
                <th className="py-2.5 px-4">Type</th>
                <th className="py-2.5 px-4">Supplier GSTIN</th>
                <th className="py-2.5 px-4">Supplier Name</th>
                <th className="py-2.5 px-4">Bill / Note #</th>
                <th className="py-2.5 px-4 text-right">Taxable (₹)</th>
                <th className="py-2.5 px-4 text-right">CGST</th>
                <th className="py-2.5 px-4 text-right">SGST</th>
                <th className="py-2.5 px-4 text-right">IGST</th>
                <th className="py-2.5 px-4 text-right">ITC (₹)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {purchases.length > 0 ? (
                purchases.map((p) => {
                  const isReturn = p.type === 'purchase_return';
                  const sign = isReturn ? -1 : 1;
                  return (
                    <tr key={p.id} className="hover:bg-slate-50">
                      <td className="py-2.5 px-4 font-mono text-slate-600">{formatDate(p.date)}</td>
                      <td className="py-2.5 px-4">
                        <span
                          className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                            isReturn ? 'bg-amber-100 text-amber-800' : 'bg-blue-100 text-blue-800'
                          }`}
                        >
                          {isReturn ? 'Debit Note' : 'Bill'}
                        </span>
                      </td>
                      <td className="py-2.5 px-4 font-mono font-bold text-slate-900">{p.partyGstin || 'Unregistered'}</td>
                      <td className="py-2.5 px-4 text-slate-800">{p.partyName}</td>
                      <td className="py-2.5 px-4 font-mono">{p.invoiceNo}</td>
                      <td className="py-2.5 px-4 text-right font-mono tabular-nums">{formatINR(sign * p.subtotal)}</td>
                      <td className="py-2.5 px-4 text-right font-mono tabular-nums">{formatINR(sign * (p.cgst || 0))}</td>
                      <td className="py-2.5 px-4 text-right font-mono tabular-nums">{formatINR(sign * (p.sgst || 0))}</td>
                      <td className="py-2.5 px-4 text-right font-mono tabular-nums">{formatINR(sign * (p.igst || 0))}</td>
                      <td className={`py-2.5 px-4 text-right font-mono font-bold tabular-nums ${isReturn ? 'text-amber-700' : 'text-blue-700'}`}>
                        {formatINR(sign * p.totalTax)}
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={10} className="py-8 text-center text-slate-400">
                    No purchase bills or debit notes in selected period.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

// =========================================================================
// SUB-REPORT 8: GSTR-3B SUMMARY (Net Tax Payable)
// =========================================================================
const Gstr3bReportView: React.FC<{ transactions: Transaction[] }> = ({ transactions }) => {
  const sales = transactions.filter((t) => t.type === 'sale_invoice');
  const purchases = transactions.filter((t) => t.type === 'purchase_bill');

  const outputTax = sales.reduce((acc, t) => acc + t.totalTax, 0);
  const inputTaxCredit = purchases.reduce((acc, t) => acc + t.totalTax, 0);
  const netPayable = Math.max(0, outputTax - inputTaxCredit);
  const excessCredit = Math.max(0, inputTaxCredit - outputTax);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-2xs">
          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">3.1 - Outward Tax Liability</span>
          <div className="text-xl font-bold text-rose-700 font-mono mt-1">{formatINR(outputTax)}</div>
          <span className="text-[11px] text-slate-400">Tax on sales</span>
        </div>
        <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-2xs">
          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">4 - Eligible ITC</span>
          <div className="text-xl font-bold text-blue-700 font-mono mt-1">{formatINR(inputTaxCredit)}</div>
          <span className="text-[11px] text-slate-400">Tax paid on purchases</span>
        </div>
        <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-2xs">
          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">6.1 - Net GST Cash Payable</span>
          <div className="text-xl font-bold text-slate-900 font-mono mt-1">{formatINR(netPayable)}</div>
          {excessCredit > 0 && (
            <span className="text-[11px] text-emerald-600 font-medium">Excess ITC Carried Forward: {formatINR(excessCredit)}</span>
          )}
        </div>
      </div>
    </div>
  );
};

// =========================================================================
// SUB-REPORT 9: PARTY STATEMENT (Individual Running Balance Ledger)
// =========================================================================
const PartyStatementView: React.FC<{
  party: Party | null;
  transactions: Transaction[];
  startDate: string;
  endDate: string;
  onSelectTransaction: (tx: Transaction) => void;
}> = ({ party, transactions, startDate, endDate, onSelectTransaction }) => {
  if (!party) {
    return <div className="p-12 text-center text-xs text-slate-400">Select a party to view their ledger statement.</div>;
  }

  // Filter party transactions within date range
  const partyTxs = transactions
    .filter((t) => t.partyId === party.id && t.status !== 'cancelled')
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  // Running balance calculation
  let running = party.openingBalance || 0;
  if (party.openingBalanceType === 'to_pay') {
    running = -running;
  }

  const statementRows = partyTxs.map((t) => {
    let debit = 0;
    let credit = 0;

    if (t.type === 'sale_invoice') {
      debit = t.totalAmount;
      running += debit;
    } else if (t.type === 'purchase_bill') {
      credit = t.totalAmount;
      running -= credit;
    } else if (t.type === 'payment_in') {
      credit = t.totalAmount;
      running -= credit;
    } else if (t.type === 'payment_out') {
      debit = t.totalAmount;
      running += debit;
    } else if (t.type === 'sale_return') {
      credit = t.totalAmount;
      running -= credit;
    } else if (t.type === 'purchase_return') {
      debit = t.totalAmount;
      running += debit;
    }

    return {
      tx: t,
      debit,
      credit,
      balance: running,
    };
  });

  return (
    <div className="space-y-4">
      {/* Party Summary Strip */}
      <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h3 className="text-base font-bold text-slate-900">{party.name}</h3>
          <p className="text-xs text-slate-500 font-mono">
            {party.phone ? `Phone: ${party.phone}` : ''} {party.gstin ? `· GSTIN: ${party.gstin}` : ''} · State: {party.state}
          </p>
        </div>
        <div className="text-right font-mono">
          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Closing Balance</span>
          <span className={`text-lg font-bold ${running >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
            {formatINR(Math.abs(running))}
          </span>
          <span className="text-[11px] text-slate-500 ml-1 font-sans">
            ({running >= 0 ? "You'll Receive" : "You'll Pay"})
          </span>
        </div>
      </div>

      {/* Ledger Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200 uppercase text-[11px]">
                <th className="py-2.5 px-4">Date</th>
                <th className="py-2.5 px-4">Particulars</th>
                <th className="py-2.5 px-4">Ref #</th>
                <th className="py-2.5 px-4 text-right">Debit (Sales / Payments Out)</th>
                <th className="py-2.5 px-4 text-right">Credit (Purchases / Receipts)</th>
                <th className="py-2.5 px-4 text-right">Running Net Balance</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {/* Opening balance row */}
              <tr className="bg-slate-50/50 font-medium">
                <td className="py-2.5 px-4 font-mono text-slate-500">-</td>
                <td className="py-2.5 px-4 text-slate-700 font-bold">Opening Balance</td>
                <td className="py-2.5 px-4 font-mono text-slate-400">-</td>
                <td className="py-2.5 px-4 text-right font-mono text-slate-600">-</td>
                <td className="py-2.5 px-4 text-right font-mono text-slate-600">-</td>
                <td className="py-2.5 px-4 text-right font-mono font-bold text-slate-900 tabular-nums">
                  {formatINR(party.openingBalance || 0)}
                </td>
              </tr>

              {statementRows.map((row) => (
                <tr
                  key={row.tx.id}
                  onClick={() => onSelectTransaction(row.tx)}
                  className="hover:bg-slate-50 cursor-pointer"
                >
                  <td className="py-2.5 px-4 font-mono text-slate-600">{formatDate(row.tx.date)}</td>
                  <td className="py-2.5 px-4 capitalize font-medium text-slate-900">
                    {row.tx.type.replace('_', ' ')}
                  </td>
                  <td className="py-2.5 px-4 font-mono font-semibold text-slate-900">{row.tx.invoiceNo}</td>
                  <td className="py-2.5 px-4 text-right font-mono font-semibold tabular-nums">
                    {row.debit > 0 ? formatINR(row.debit) : '-'}
                  </td>
                  <td className="py-2.5 px-4 text-right font-mono font-semibold tabular-nums text-emerald-700">
                    {row.credit > 0 ? formatINR(row.credit) : '-'}
                  </td>
                  <td className="py-2.5 px-4 text-right font-mono font-bold tabular-nums">
                    <span className={row.balance >= 0 ? 'text-emerald-700' : 'text-rose-700'}>
                      {formatINR(Math.abs(row.balance))} {row.balance >= 0 ? 'Dr' : 'Cr'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

// =========================================================================
// SUB-REPORT 10: PARTIES BALANCE & AGING REPORT
// =========================================================================
const PartiesBalanceView: React.FC<{
  parties: Party[];
  balances: Record<string, { balance: number; type: 'to_receive' | 'to_pay' }>;
}> = ({ parties, balances }) => {
  const totalReceivables = parties
    .filter((p) => balances[p.id]?.type === 'to_receive')
    .reduce((acc, p) => acc + (balances[p.id]?.balance || 0), 0);

  const totalPayables = parties
    .filter((p) => balances[p.id]?.type === 'to_pay')
    .reduce((acc, p) => acc + (balances[p.id]?.balance || 0), 0);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-2xs">
          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Total Receivables (To Receive)</span>
          <div className="text-xl font-bold text-emerald-700 font-mono mt-1">{formatINR(totalReceivables)}</div>
          <span className="text-[11px] text-emerald-600">Money owed by customers</span>
        </div>
        <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-2xs">
          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Total Payables (To Pay)</span>
          <div className="text-xl font-bold text-rose-700 font-mono mt-1">{formatINR(totalPayables)}</div>
          <span className="text-[11px] text-rose-600">Money owed to suppliers</span>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200 uppercase text-[11px]">
                <th className="py-2.5 px-4">Party Name</th>
                <th className="py-2.5 px-4">Group</th>
                <th className="py-2.5 px-4">Phone</th>
                <th className="py-2.5 px-4">GSTIN</th>
                <th className="py-2.5 px-4 text-right">Opening Balance</th>
                <th className="py-2.5 px-4 text-right">Net Balance Due</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {parties.map((p) => {
                const bal = balances[p.id];
                return (
                  <tr key={p.id} className="hover:bg-slate-50">
                    <td className="py-2.5 px-4 font-semibold text-slate-900">{p.name}</td>
                    <td className="py-2.5 px-4">
                      <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-slate-100 text-slate-700">
                        {p.group}
                      </span>
                    </td>
                    <td className="py-2.5 px-4 font-mono text-slate-600">{p.phone || '-'}</td>
                    <td className="py-2.5 px-4 font-mono text-slate-600">{p.gstin || '-'}</td>
                    <td className="py-2.5 px-4 text-right font-mono tabular-nums">{formatINR(p.openingBalance)}</td>
                    <td className="py-2.5 px-4 text-right font-mono font-bold tabular-nums">
                      {bal && bal.balance > 0 ? (
                        <span className={bal.type === 'to_receive' ? 'text-emerald-700' : 'text-rose-700'}>
                          {formatINR(bal.balance)} ({bal.type === 'to_receive' ? 'Receive' : 'Pay'})
                        </span>
                      ) : (
                        <span className="text-slate-400">₹0.00</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

// =========================================================================
// SUB-REPORT 11: STOCK SUMMARY VIEW
// =========================================================================
const StockSummaryView: React.FC<{ items: Item[]; transactions: Transaction[] }> = ({ items, transactions }) => {
  const totalStockValue = items.reduce((acc, i) => acc + (i.stockValue || 0), 0);
  const totalProducts = items.filter((i) => i.type === 'product').length;
  const totalUnits = items.reduce((acc, i) => acc + (i.currentStock || 0), 0);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-2xs">
          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Total Inventory Valuation</span>
          <div className="text-xl font-bold text-slate-900 font-mono mt-1">{formatINR(totalStockValue)}</div>
          <span className="text-[11px] text-slate-400">Computed at purchase rates</span>
        </div>
        <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-2xs">
          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Products in Catalog</span>
          <div className="text-xl font-bold text-slate-900 font-mono mt-1">{totalProducts}</div>
          <span className="text-[11px] text-slate-400">Distinct inventory SKU items</span>
        </div>
        <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-2xs">
          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Total Quantity in Hand</span>
          <div className="text-xl font-bold text-emerald-700 font-mono mt-1">{totalUnits} Units</div>
          <span className="text-[11px] text-emerald-600">Physical stock count</span>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200 uppercase text-[11px]">
                <th className="py-2.5 px-4">Item Name</th>
                <th className="py-2.5 px-4">Code / HSN</th>
                <th className="py-2.5 px-4">Category</th>
                <th className="py-2.5 px-4 text-right">Sale Price</th>
                <th className="py-2.5 px-4 text-right">Purchase Price</th>
                <th className="py-2.5 px-4 text-right">Current Stock</th>
                <th className="py-2.5 px-4 text-right">Stock Valuation</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {items.map((i) => (
                <tr key={i.id} className="hover:bg-slate-50">
                  <td className="py-2.5 px-4 font-semibold text-slate-900">{i.name}</td>
                  <td className="py-2.5 px-4 font-mono text-slate-500">
                    {i.itemCode ? `Code: ${i.itemCode} · ` : ''}HSN: {i.hsn || '-'}
                  </td>
                  <td className="py-2.5 px-4 text-slate-700">{i.category || 'General'}</td>
                  <td className="py-2.5 px-4 text-right font-mono tabular-nums">{formatINR(i.salePrice)}</td>
                  <td className="py-2.5 px-4 text-right font-mono text-slate-600 tabular-nums">{formatINR(i.purchasePrice)}</td>
                  <td className="py-2.5 px-4 text-right font-mono font-bold tabular-nums">
                    {i.currentStock} {i.unit}
                  </td>
                  <td className="py-2.5 px-4 text-right font-mono font-bold text-slate-900 tabular-nums">
                    {formatINR(i.stockValue || 0)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

// =========================================================================
// SUB-REPORT 12: LOW STOCK REPORT VIEW
// =========================================================================
const LowStockReportView: React.FC<{ items: Item[] }> = ({ items }) => {
  const lowItems = items.filter(
    (i) => i.type === 'product' && ((i.minStockAlert > 0 && i.currentStock <= i.minStockAlert) || i.currentStock <= 0)
  );

  return (
    <div className="space-y-4">
      <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl text-amber-800 text-xs flex items-center justify-between">
        <div className="flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
          <span>Found <strong>{lowItems.length}</strong> items below min stock alert or out of stock.</span>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
        {lowItems.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200 uppercase text-[11px]">
                  <th className="py-2.5 px-4">Item Name</th>
                  <th className="py-2.5 px-4">HSN</th>
                  <th className="py-2.5 px-4 text-right">Min Stock Limit</th>
                  <th className="py-2.5 px-4 text-right">Current Stock</th>
                  <th className="py-2.5 px-4 text-right">Deficit</th>
                  <th className="py-2.5 px-4 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {lowItems.map((i) => {
                  const deficit = Math.max(0, i.minStockAlert - i.currentStock);
                  return (
                    <tr key={i.id} className="hover:bg-slate-50">
                      <td className="py-2.5 px-4 font-bold text-slate-900">{i.name}</td>
                      <td className="py-2.5 px-4 font-mono text-slate-500">{i.hsn || '-'}</td>
                      <td className="py-2.5 px-4 text-right font-mono">{i.minStockAlert} {i.unit}</td>
                      <td className="py-2.5 px-4 text-right font-mono font-bold text-rose-600 tabular-nums">
                        {i.currentStock} {i.unit}
                      </td>
                      <td className="py-2.5 px-4 text-right font-mono font-bold text-amber-700 tabular-nums">
                        -{deficit} {i.unit}
                      </td>
                      <td className="py-2.5 px-4 text-center">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase bg-rose-100 text-rose-800">
                          {i.currentStock <= 0 ? 'Out of Stock' : 'Low Stock'}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-12 text-center text-xs text-slate-400">All items are sufficiently stocked above minimum levels.</div>
        )}
      </div>
    </div>
  );
};

// =========================================================================
// SUB-REPORT 13: ITEM-WISE SALES REPORT
// =========================================================================
const ItemWiseSalesReportView: React.FC<{ items: Item[]; transactions: Transaction[] }> = ({ items, transactions }) => {
  const salesTxs = transactions.filter((t) => t.type === 'sale_invoice');

  // Aggregate quantity sold and revenue
  const itemSalesMap = new Map<string, { itemId: string; name: string; hsn: string; unit: string; totalQty: number; totalRevenue: number }>();

  for (const s of salesTxs) {
    for (const row of s.items) {
      if (row.name) {
        const key = row.itemId || row.name;
        const existing = itemSalesMap.get(key) || {
          itemId: key,
          name: row.name,
          hsn: row.hsn || '',
          unit: row.unit || 'PCS',
          totalQty: 0,
          totalRevenue: 0,
        };

        existing.totalQty += (row.qty || 0);
        existing.totalRevenue += (row.totalAmount || 0);
        itemSalesMap.set(key, existing);
      }
    }
  }

  const list = Array.from(itemSalesMap.values()).sort((a, b) => b.totalRevenue - a.totalRevenue);
  const totalRevenueAll = list.reduce((acc, i) => acc + i.totalRevenue, 0);

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
        {list.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200 uppercase text-[11px]">
                  <th className="py-2.5 px-4">Item Name</th>
                  <th className="py-2.5 px-4">HSN</th>
                  <th className="py-2.5 px-4 text-right">Units Sold</th>
                  <th className="py-2.5 px-4 text-right">Avg Selling Rate</th>
                  <th className="py-2.5 px-4 text-right">Total Sales Revenue</th>
                  <th className="py-2.5 px-4 text-right">% Contribution</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {list.map((i) => {
                  const avgPrice = i.totalQty > 0 ? i.totalRevenue / i.totalQty : 0;
                  const pct = totalRevenueAll > 0 ? (i.totalRevenue / totalRevenueAll) * 100 : 0;
                  return (
                    <tr key={i.itemId} className="hover:bg-slate-50">
                      <td className="py-2.5 px-4 font-bold text-slate-900">{i.name}</td>
                      <td className="py-2.5 px-4 font-mono text-slate-500">{i.hsn || '-'}</td>
                      <td className="py-2.5 px-4 text-right font-mono font-bold text-slate-800 tabular-nums">
                        {i.totalQty} {i.unit}
                      </td>
                      <td className="py-2.5 px-4 text-right font-mono text-slate-600 tabular-nums">
                        {formatINR(avgPrice)}
                      </td>
                      <td className="py-2.5 px-4 text-right font-mono font-bold text-emerald-700 tabular-nums">
                        {formatINR(i.totalRevenue)}
                      </td>
                      <td className="py-2.5 px-4 text-right font-mono font-semibold text-slate-900 tabular-nums">
                        {pct.toFixed(1)}%
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-12 text-center text-xs text-slate-400">No item sales recorded for this period.</div>
        )}
      </div>
    </div>
  );
};

// =========================================================================
// SUB-REPORT 14: AUDIT TRAIL REPORT VIEW
// =========================================================================
const AuditTrailReportView: React.FC<{
  logs: AuditLogEntry[];
  searchQuery: string;
  onClearLogs: () => Promise<void>;
  onRefresh: () => void;
}> = ({ logs, searchQuery, onClearLogs, onRefresh }) => {
  const [actionFilter, setActionFilter] = useState<string>('all');

  const filteredLogs = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    return logs.filter((l) => {
      if (actionFilter !== 'all' && l.action !== actionFilter) return false;
      if (!q) return true;
      return (
        l.entityLabel.toLowerCase().includes(q) ||
        l.details.toLowerCase().includes(q) ||
        l.entityType.toLowerCase().includes(q) ||
        l.actor.toLowerCase().includes(q)
      );
    });
  }, [logs, actionFilter, searchQuery]);

  const badgeClass = (action: string) => {
    switch (action) {
      case 'CREATE':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case 'EDIT':
        return 'bg-blue-50 text-blue-700 border-blue-200';
      case 'DELETE':
      case 'CANCEL':
        return 'bg-rose-50 text-rose-700 border-rose-200';
      case 'CONVERT':
        return 'bg-indigo-50 text-indigo-700 border-indigo-200';
      case 'BACKUP_RESTORE':
        return 'bg-amber-50 text-amber-700 border-amber-200';
      default:
        return 'bg-slate-100 text-slate-700 border-slate-200';
    }
  };

  return (
    <div className="space-y-4">
      <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-2xs flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
            <Activity className="w-4 h-4" />
          </div>
          <div>
            <div className="text-xs font-bold text-slate-900">
              Audit Activity Log ({filteredLogs.length} events)
            </div>
            <div className="text-[11px] text-slate-500">
              Enable or disable logging in Settings &rarr; Optional Features &amp; Security.
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <select
            value={actionFilter}
            onChange={(e) => setActionFilter(e.target.value)}
            className="px-3 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded-lg cursor-pointer"
          >
            <option value="all">All Actions</option>
            <option value="CREATE">CREATE</option>
            <option value="EDIT">EDIT</option>
            <option value="DELETE">DELETE</option>
            <option value="CANCEL">CANCEL</option>
            <option value="CONVERT">CONVERT</option>
            <option value="SETTINGS">SETTINGS</option>
            <option value="BACKUP_RESTORE">BACKUP_RESTORE</option>
          </select>

          <button
            type="button"
            onClick={onRefresh}
            className="px-3 py-1.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg cursor-pointer"
          >
            Refresh
          </button>

          {logs.length > 0 && (
            <button
              type="button"
              onClick={onClearLogs}
              className="px-3 py-1.5 text-xs font-semibold text-rose-600 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-lg flex items-center gap-1 cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Clear Logs</span>
            </button>
          )}
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
        {filteredLogs.length === 0 ? (
          <div className="p-12 text-center text-xs text-slate-400">
            No audit log entries recorded yet. Turn on Audit Trail in Settings &rarr; Optional Features &amp; Security to record events.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200 uppercase text-[11px]">
                  <th className="py-2.5 px-4">Timestamp</th>
                  <th className="py-2.5 px-4">Action</th>
                  <th className="py-2.5 px-4">Entity</th>
                  <th className="py-2.5 px-4">Reference / Name</th>
                  <th className="py-2.5 px-4">Details</th>
                  <th className="py-2.5 px-4">Actor</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredLogs.map((l) => (
                  <tr key={l.id} className="hover:bg-slate-50">
                    <td className="py-2.5 px-4 font-mono text-[11px] text-slate-500 whitespace-nowrap">
                      {new Date(l.timestamp).toLocaleString('en-IN')}
                    </td>
                    <td className="py-2.5 px-4">
                      <span className={`px-2 py-0.5 rounded border text-[10px] font-bold font-mono ${badgeClass(l.action)}`}>
                        {l.action}
                      </span>
                    </td>
                    <td className="py-2.5 px-4 font-mono text-[11px] uppercase text-slate-600">{l.entityType}</td>
                    <td className="py-2.5 px-4 font-semibold text-slate-900">{l.entityLabel}</td>
                    <td className="py-2.5 px-4 text-slate-600">{l.details}</td>
                    <td className="py-2.5 px-4 font-mono text-[11px] text-slate-500">{l.actor}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

