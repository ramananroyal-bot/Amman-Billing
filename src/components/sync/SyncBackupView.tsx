import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Cloud,
  Download,
  Upload,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  FileSpreadsheet,
  Share2,
  Copy,
  Check,
  HardDrive,
  Smartphone,
  ShieldCheck,
  Database,
  Trash2,
  RotateCcw,
  AlertCircle,
  Info,
  ExternalLink,
  MessageCircle,
  FileText,
  Clock,
  ArrowRight,
  ShieldAlert,
  Monitor,
  Laptop,
} from 'lucide-react';
import { BusinessProfile, LocalSnapshot, BackupMetadata, IntegrityReport } from '../../types';
import {
  exportBackupJSON,
  inspectBackupJSON,
  importBackupJSON,
  getLocalSnapshots,
  createLocalSnapshot,
  restoreLocalSnapshot,
  deleteLocalSnapshot,
  verifyDatabaseIntegrity,
  reconcileDatabase,
  resetTransactionsOnly,
  factoryResetDatabase,
  getParties,
  getItems,
  getTransactions,
  getDashboardMetrics,
} from '../../db/indexedDB';
import { formatINR, formatDate } from '../../utils/formatters';
import { useToast } from '../common/Toast';
import { ConfirmDeleteModal } from '../common/ConfirmDeleteModal';
import { DesktopAppModal } from '../modals/DesktopAppModal';

export type SyncTab = 'backup_restore' | 'share_export' | 'sync_devices' | 'maintenance';

interface SyncBackupViewProps {
  businessProfile: BusinessProfile | null;
  onDataRestored: () => Promise<void>;
  onFactoryReset: () => Promise<void>;
}

export const SyncBackupView: React.FC<SyncBackupViewProps> = ({
  businessProfile,
  onDataRestored,
  onFactoryReset,
}) => {
  const { showToast } = useToast();
  const [activeTab, setActiveTab] = useState<SyncTab>('backup_restore');
  const [snapshots, setSnapshots] = useState<LocalSnapshot[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Restore inspection state
  const [pendingBackupJSON, setPendingBackupJSON] = useState<string | null>(null);
  const [backupMetadata, setBackupMetadata] = useState<BackupMetadata | null>(null);
  const [restoreMode, setRestoreMode] = useState<'clean' | 'merge'>('clean');
  const [showRestoreModal, setShowRestoreModal] = useState(false);

  // Storage estimation state
  const [storageUsage, setStorageUsage] = useState<{ usedMB: number; quotaMB: number } | null>(null);
  const [isPersisted, setIsPersisted] = useState(false);
  const [showDesktopAppModal, setShowDesktopAppModal] = useState(false);

  // WhatsApp share state
  const [whatsappSummary, setWhatsappSummary] = useState('');
  const [copiedSummary, setCopiedSummary] = useState(false);

  // Portable sync code state
  const [syncCode, setSyncCode] = useState('');
  const [inputSyncCode, setInputSyncCode] = useState('');
  const [copiedSyncCode, setCopiedSyncCode] = useState(false);

  // Database maintenance state
  const [integrityReport, setIntegrityReport] = useState<IntegrityReport | null>(null);
  const [isCheckingIntegrity, setIsCheckingIntegrity] = useState(false);
  const [isReconciling, setIsReconciling] = useState(false);

  // Destructive actions state
  const [showResetTxModal, setShowResetTxModal] = useState(false);
  const [showFactoryResetModal, setShowFactoryResetModal] = useState(false);
  const [factoryConfirmText, setFactoryConfirmText] = useState('');
  const [snapshotToDelete, setSnapshotToDelete] = useState<LocalSnapshot | null>(null);
  const [snapshotToRollback, setSnapshotToRollback] = useState<LocalSnapshot | null>(null);

  // Load snapshots and storage info
  const loadSnapshots = useCallback(async () => {
    try {
      const list = await getLocalSnapshots();
      setSnapshots(list);
    } catch (err) {
      console.error('Error fetching snapshots', err);
    }
  }, []);

  const loadStorageEstimate = useCallback(async () => {
    if (navigator.storage && navigator.storage.estimate) {
      try {
        const est = await navigator.storage.estimate();
        const used = (est.usage || 0) / (1024 * 1024);
        const quota = (est.quota || 0) / (1024 * 1024);
        setStorageUsage({
          usedMB: Math.round(used * 100) / 100,
          quotaMB: Math.round(quota),
        });
      } catch (e) {
        console.warn('Storage estimate failed', e);
      }
    }
    if (navigator.storage && navigator.storage.persisted) {
      try {
        const persisted = await navigator.storage.persisted();
        setIsPersisted(persisted);
      } catch {}
    }
  }, []);

  // Generate WhatsApp business summary
  const generateBusinessSummary = useCallback(async () => {
    try {
      const metrics = await getDashboardMetrics('this_month');
      const items = await getItems();
      const parties = await getParties();
      const today = new Date().toLocaleDateString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      });

      const totalStockValuation = items.reduce(
        (sum, item) => sum + (item.currentStock > 0 ? item.currentStock * item.purchasePrice : 0),
        0
      );

      const text =
        `📊 *${businessProfile?.businessName || 'Business'} - Daily Performance Summary*\n` +
        `📅 Date: ${today}\n` +
        `GSTIN: ${businessProfile?.gstin || 'Unregistered'}\n` +
        `━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
        `💰 *Receivables (To Collect):* ${formatINR(metrics.totalReceivable)}\n` +
        `💳 *Payables (To Pay):* ${formatINR(metrics.totalPayable)}\n` +
        `📈 *Sales This Month:* ${formatINR(metrics.totalSale)} (${metrics.saleCount} invoices)\n` +
        `📦 *Inventory Valuation:* ${formatINR(totalStockValuation)} (${items.length} active items)\n` +
        `👥 *Active Parties:* ${parties.length} accounts\n` +
        `━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
        `_Generated via Vyapar GST Desktop Accounting (Offline-First)_`;

      setWhatsappSummary(text);
    } catch (err) {
      console.error('Error generating summary', err);
    }
  }, [businessProfile]);

  useEffect(() => {
    loadSnapshots();
    loadStorageEstimate();
    generateBusinessSummary();
  }, [loadSnapshots, loadStorageEstimate, generateBusinessSummary]);

  // Handle Download JSON Backup
  const handleDownloadBackup = async () => {
    try {
      setIsLoading(true);
      const json = await exportBackupJSON();
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      const today = new Date().toISOString().split('T')[0];
      const safeName = (businessProfile?.businessName || 'Business')
        .replace(/[^a-zA-Z0-9]/g, '_')
        .slice(0, 20);
      link.download = `VyaparGST_Backup_${safeName}_${today}.json`;
      link.click();
      URL.revokeObjectURL(url);

      // Create snapshot record
      await createLocalSnapshot('Manual File Backup Export');
      await loadSnapshots();
      showToast('Backup file downloaded successfully', 'success');
    } catch (err: any) {
      showToast(err?.message || 'Failed to generate backup', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  // Handle file selection for restore
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      const meta = inspectBackupJSON(content);
      setPendingBackupJSON(content);
      setBackupMetadata(meta);
      setShowRestoreModal(true);
    };
    reader.onerror = () => {
      showToast('Failed to read backup file', 'error');
    };
    reader.readAsText(file);

    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Execute restore
  const executeRestore = async () => {
    if (!pendingBackupJSON) return;
    try {
      setIsLoading(true);
      const res = await importBackupJSON(pendingBackupJSON, restoreMode);
      if (res.success) {
        showToast(res.message, 'success');
        setShowRestoreModal(false);
        setPendingBackupJSON(null);
        setBackupMetadata(null);
        await onDataRestored();
        await loadSnapshots();
        await loadStorageEstimate();
      } else {
        showToast(res.message, 'error');
      }
    } catch (err: any) {
      showToast(err?.message || 'Restore failed', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  // Handle manual snapshot creation
  const handleCreateSnapshot = async () => {
    try {
      setIsLoading(true);
      await createLocalSnapshot('Manual On-Demand Snapshot');
      await loadSnapshots();
      showToast('Local safety snapshot created', 'success');
    } catch (err: any) {
      showToast(err?.message || 'Snapshot creation failed', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  // Handle snapshot rollback
  const executeRollback = async () => {
    if (!snapshotToRollback) return;
    try {
      setIsLoading(true);
      const res = await restoreLocalSnapshot(snapshotToRollback.id);
      if (res.success) {
        showToast(`Rolled back to snapshot from ${formatDate(snapshotToRollback.timestamp)}`, 'success');
        setSnapshotToRollback(null);
        await onDataRestored();
        await loadSnapshots();
      } else {
        showToast(res.message, 'error');
      }
    } catch (err: any) {
      showToast(err?.message || 'Rollback failed', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  // Handle snapshot delete
  const executeDeleteSnapshot = async () => {
    if (!snapshotToDelete) return;
    try {
      await deleteLocalSnapshot(snapshotToDelete.id);
      setSnapshotToDelete(null);
      await loadSnapshots();
      showToast('Snapshot deleted', 'info');
    } catch (err: any) {
      showToast(err?.message || 'Failed to delete snapshot', 'error');
    }
  };

  // CSV Helpers
  const triggerDownloadCSV = (csvContent: string, fileName: string) => {
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    link.click();
    URL.revokeObjectURL(url);
  };

  const escapeCSV = (value: any): string => {
    if (value === null || value === undefined) return '""';
    const str = String(value).replace(/"/g, '""');
    return `"${str}"`;
  };

  // Export Parties CSV
  const handleExportPartiesCSV = async () => {
    try {
      const parties = await getParties();
      const headers = [
        'Party ID',
        'Party Name',
        'Phone',
        'GSTIN',
        'GST Type',
        'State',
        'Email',
        'Billing Address',
        'Opening Balance',
        'Opening Balance Type',
        'Credit Limit',
        'Current Balance',
      ];
      const rows = parties.map((p) => [
        escapeCSV(p.id),
        escapeCSV(p.name),
        escapeCSV(p.phone),
        escapeCSV(p.gstin || ''),
        escapeCSV(p.gstType),
        escapeCSV(p.state),
        escapeCSV(p.email || ''),
        escapeCSV(p.billingAddress || ''),
        p.openingBalance || 0,
        escapeCSV(p.openingBalanceType),
        p.creditLimit || 0,
        p.currentBalance || 0,
      ]);

      const csv = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
      triggerDownloadCSV(csv, `Parties_Master_${new Date().toISOString().split('T')[0]}.csv`);
      showToast('Parties CSV exported', 'success');
    } catch (err: any) {
      showToast(err?.message || 'Parties CSV export failed', 'error');
    }
  };

  // Export Items & Inventory CSV
  const handleExportItemsCSV = async () => {
    try {
      const items = await getItems();
      const headers = [
        'Item ID',
        'Item Name',
        'Item Code',
        'HSN',
        'Category',
        'Unit',
        'Sale Price',
        'Purchase Price',
        'Tax Rate %',
        'Opening Stock',
        'Current Stock',
        'Min Stock Alert',
        'Stock Valuation (₹)',
      ];
      const rows = items.map((i) => [
        escapeCSV(i.id),
        escapeCSV(i.name),
        escapeCSV(i.itemCode),
        escapeCSV(i.hsn),
        escapeCSV(i.category),
        escapeCSV(i.unit),
        i.salePrice || 0,
        i.purchasePrice || 0,
        i.taxRate || 0,
        i.openingStockQty || 0,
        i.currentStock || 0,
        i.minStockAlert || 0,
        Math.round((i.currentStock > 0 ? i.currentStock * i.purchasePrice : 0) * 100) / 100,
      ]);

      const csv = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
      triggerDownloadCSV(csv, `Items_Stock_${new Date().toISOString().split('T')[0]}.csv`);
      showToast('Items Inventory CSV exported', 'success');
    } catch (err: any) {
      showToast(err?.message || 'Items CSV export failed', 'error');
    }
  };

  // Export Sales Register CSV
  const handleExportSalesCSV = async () => {
    try {
      const txs = await getTransactions({ type: 'sale_invoice' });
      const headers = [
        'Invoice Date',
        'Invoice No',
        'Party Name',
        'Party GSTIN',
        'Party State',
        'Taxable Subtotal (₹)',
        'CGST (₹)',
        'SGST (₹)',
        'IGST (₹)',
        'Total Tax (₹)',
        'Total Invoice Amount (₹)',
        'Payment Mode',
        'Received Amount (₹)',
        'Balance Due (₹)',
        'Status',
      ];
      const rows = txs.map((t) => [
        escapeCSV(t.date),
        escapeCSV(t.invoiceNo),
        escapeCSV(t.partyName),
        escapeCSV(t.partyGstin || ''),
        escapeCSV(t.partyState),
        t.subtotal || 0,
        t.cgst || 0,
        t.sgst || 0,
        t.igst || 0,
        t.totalTax || 0,
        t.totalAmount || 0,
        escapeCSV(t.paymentType),
        t.receivedAmount || 0,
        t.balanceDue || 0,
        escapeCSV(t.status),
      ]);

      const csv = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
      triggerDownloadCSV(csv, `Sales_Register_${new Date().toISOString().split('T')[0]}.csv`);
      showToast('Sales Register CSV exported', 'success');
    } catch (err: any) {
      showToast(err?.message || 'Sales CSV export failed', 'error');
    }
  };

  // Export Purchases Register CSV
  const handleExportPurchasesCSV = async () => {
    try {
      const txs = await getTransactions({ type: 'purchase_bill' });
      const headers = [
        'Bill Date',
        'Bill / Invoice No',
        'Supplier Name',
        'Supplier GSTIN',
        'State',
        'Taxable Subtotal (₹)',
        'CGST (₹)',
        'SGST (₹)',
        'IGST (₹)',
        'Total Tax (₹)',
        'Total Bill Amount (₹)',
        'Payment Mode',
        'Paid Amount (₹)',
        'Balance Due (₹)',
        'Status',
      ];
      const rows = txs.map((t) => [
        escapeCSV(t.date),
        escapeCSV(t.invoiceNo),
        escapeCSV(t.partyName),
        escapeCSV(t.partyGstin || ''),
        escapeCSV(t.partyState),
        t.subtotal || 0,
        t.cgst || 0,
        t.sgst || 0,
        t.igst || 0,
        t.totalTax || 0,
        t.totalAmount || 0,
        escapeCSV(t.paymentType),
        t.receivedAmount || 0,
        t.balanceDue || 0,
        escapeCSV(t.status),
      ]);

      const csv = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
      triggerDownloadCSV(csv, `Purchases_Register_${new Date().toISOString().split('T')[0]}.csv`);
      showToast('Purchases Register CSV exported', 'success');
    } catch (err: any) {
      showToast(err?.message || 'Purchases CSV export failed', 'error');
    }
  };

  // Export All CSVs Bundle
  const handleExportAllCSVs = async () => {
    await handleExportPartiesCSV();
    await handleExportItemsCSV();
    await handleExportSalesCSV();
    await handleExportPurchasesCSV();
    showToast('All 4 accounting CSV registers downloaded', 'success');
  };

  // WhatsApp Share button
  const handleOpenWhatsApp = () => {
    const encoded = encodeURIComponent(whatsappSummary);
    window.open(`https://api.whatsapp.com/send?text=${encoded}`, '_blank');
  };

  // Copy WhatsApp summary
  const handleCopySummary = () => {
    navigator.clipboard.writeText(whatsappSummary);
    setCopiedSummary(true);
    showToast('Summary copied to clipboard', 'success');
    setTimeout(() => setCopiedSummary(false), 2000);
  };

  // Web Share API
  const handleNativeShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: `${businessProfile?.businessName || 'Business'} Performance Summary`,
          text: whatsappSummary,
        });
        showToast('Shared successfully', 'success');
      } catch (err) {
        // User cancelled or share failed
      }
    } else {
      handleCopySummary();
    }
  };

  // Generate Portable Sync Bundle
  const handleGenerateSyncCode = async () => {
    try {
      setIsLoading(true);
      const json = await exportBackupJSON();
      // Base64 encode for easy copying
      const encoded = btoa(unescape(encodeURIComponent(json)));
      setSyncCode(encoded);
      showToast('Portable sync token generated', 'success');
    } catch (err: any) {
      showToast(err?.message || 'Failed to generate sync code', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  // Import Sync Bundle
  const handleImportSyncCode = async () => {
    if (!inputSyncCode.trim()) {
      showToast('Please paste a valid sync code first', 'error');
      return;
    }
    try {
      setIsLoading(true);
      const decoded = decodeURIComponent(escape(atob(inputSyncCode.trim())));
      const meta = inspectBackupJSON(decoded);
      if (!meta.isValid) {
        showToast('Invalid sync code format', 'error');
        return;
      }
      setPendingBackupJSON(decoded);
      setBackupMetadata(meta);
      setShowRestoreModal(true);
    } catch (err: any) {
      showToast('Failed to decode sync code. Ensure entire code was copied.', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  // Database Integrity Check
  const handleRunIntegrityCheck = async () => {
    try {
      setIsCheckingIntegrity(true);
      const rep = await verifyDatabaseIntegrity();
      setIntegrityReport(rep);
      if (rep.isHealthy) {
        showToast('Database integrity verified! Zero discrepancies found.', 'success');
      } else {
        showToast(`Integrity check found ${rep.details.length} issue(s)`, 'error');
      }
    } catch (err: any) {
      showToast(err?.message || 'Integrity check failed', 'error');
    } finally {
      setIsCheckingIntegrity(false);
    }
  };

  // Database Reconciliation
  const handleRunReconcile = async () => {
    try {
      setIsReconciling(true);
      const res = await reconcileDatabase();
      showToast(
        `Reconciled successfully! ${res.partiesUpdated} party balances and ${res.itemsUpdated} item stock records recalculated.`,
        'success'
      );
      await onDataRestored();
      await handleRunIntegrityCheck();
    } catch (err: any) {
      showToast(err?.message || 'Reconciliation failed', 'error');
    } finally {
      setIsReconciling(false);
    }
  };

  // Reset Transactions Only
  const executeResetTransactionsOnly = async () => {
    try {
      setIsLoading(true);
      await resetTransactionsOnly();
      setShowResetTxModal(false);
      showToast('All transactions reset. Item stock and party balances restored to opening values.', 'success');
      await onDataRestored();
      await loadSnapshots();
    } catch (err: any) {
      showToast(err?.message || 'Reset failed', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  // Factory Reset
  const executeFactoryReset = async () => {
    if (factoryConfirmText !== 'DELETE ALL DATA') {
      showToast('Please type "DELETE ALL DATA" exactly to confirm', 'error');
      return;
    }
    try {
      setIsLoading(true);
      await factoryResetDatabase();
      setShowFactoryResetModal(false);
      showToast('Database completely wiped. Returning to business setup.', 'info');
      await onFactoryReset();
    } catch (err: any) {
      showToast(err?.message || 'Factory reset failed', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="h-full flex flex-col bg-slate-50 overflow-hidden font-sans">
      {/* Top Banner / Navigation */}
      <div className="bg-white border-b border-slate-200 px-6 py-4 shrink-0">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-slate-900 text-white flex items-center justify-center shadow-xs">
              <Cloud className="w-5 h-5 text-rose-500" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base font-bold text-slate-900">Sync, Share & Backup</h1>
                <span className="px-2 py-0.5 text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  IndexedDB Offline-First
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                {businessProfile?.businessName || 'Business'} · Full ownership of your data on this device
              </p>
            </div>
          </div>

          {/* Quick Header Actions */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleCreateSnapshot}
              disabled={isLoading}
              className="px-3 py-1.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
            >
              <Clock className="w-3.5 h-3.5 text-slate-500" />
              <span>Take Snapshot</span>
            </button>
            <button
              type="button"
              onClick={handleDownloadBackup}
              disabled={isLoading}
              className="px-3.5 py-1.5 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 active:bg-rose-800 rounded-lg shadow-2xs transition-colors cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Backup to Computer</span>
            </button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center gap-1 mt-4 border-b border-slate-100 -mb-4">
          <button
            type="button"
            onClick={() => setActiveTab('backup_restore')}
            className={`px-4 py-2 text-xs font-semibold border-b-2 transition-colors cursor-pointer flex items-center gap-2 ${
              activeTab === 'backup_restore'
                ? 'border-rose-600 text-rose-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Database className="w-3.5 h-3.5" />
            <span>Backup & Restore</span>
            {snapshots.length > 0 && (
              <span className="ml-1 px-1.5 py-0.2 bg-slate-100 text-slate-600 text-[10px] rounded-full font-mono">
                {snapshots.length}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('share_export')}
            className={`px-4 py-2 text-xs font-semibold border-b-2 transition-colors cursor-pointer flex items-center gap-2 ${
              activeTab === 'share_export'
                ? 'border-rose-600 text-rose-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Share2 className="w-3.5 h-3.5" />
            <span>Share & CA Export</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('sync_devices')}
            className={`px-4 py-2 text-xs font-semibold border-b-2 transition-colors cursor-pointer flex items-center gap-2 ${
              activeTab === 'sync_devices'
                ? 'border-rose-600 text-rose-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Smartphone className="w-3.5 h-3.5" />
            <span>Multi-Device & Storage</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('maintenance')}
            className={`px-4 py-2 text-xs font-semibold border-b-2 transition-colors cursor-pointer flex items-center gap-2 ${
              activeTab === 'maintenance'
                ? 'border-rose-600 text-rose-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Integrity & Maintenance</span>
          </button>
        </div>
      </div>

      {/* Main Tab Content */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {/* ========================================================================= */}
        {/* TAB 1: BACKUP & RESTORE */}
        {/* ========================================================================= */}
        {activeTab === 'backup_restore' && (
          <div className="max-w-5xl mx-auto space-y-6">
            {/* Primary Action Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {/* Card 1: Backup to Computer */}
              <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-2xs flex flex-col justify-between">
                <div>
                  <div className="w-10 h-10 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center mb-3">
                    <Download className="w-5 h-5" />
                  </div>
                  <h3 className="text-sm font-bold text-slate-900">Backup To Computer (.JSON)</h3>
                  <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                    Export a full snapshot of your business profile, parties, items, sales, purchases, delivery
                    challans, and stock adjustments to a portable, verifiable JSON file on your computer.
                  </p>
                  <div className="mt-3.5 p-3 bg-slate-50 rounded-lg border border-slate-100 space-y-1.5 text-[11px] text-slate-600">
                    <div className="flex items-center justify-between">
                      <span>Includes:</span>
                      <span className="font-semibold text-slate-800">Master + Registers + Settings</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>File Format:</span>
                      <span className="font-mono text-slate-700">.json (Human-readable & portable)</span>
                    </div>
                  </div>
                </div>

                <div className="mt-5 pt-4 border-t border-slate-100 flex items-center justify-between">
                  <span className="text-[11px] text-slate-400">100% Offline & Private</span>
                  <button
                    type="button"
                    onClick={handleDownloadBackup}
                    disabled={isLoading}
                    className="px-4 py-2 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 active:bg-rose-800 rounded-lg shadow-2xs transition-colors cursor-pointer flex items-center gap-2 disabled:opacity-50"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Download Backup Now</span>
                  </button>
                </div>
              </div>

              {/* Card 2: Restore Backup */}
              <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-2xs flex flex-col justify-between">
                <div>
                  <div className="w-10 h-10 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center mb-3">
                    <Upload className="w-5 h-5" />
                  </div>
                  <h3 className="text-sm font-bold text-slate-900">Restore From Backup File</h3>
                  <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                    Restore previously exported records into your IndexedDB storage. You can inspect all counts, business
                    details, and revenue before confirming, with automatic rollback protection.
                  </p>
                  <div className="mt-3.5 p-3 bg-blue-50/60 rounded-lg border border-blue-100 space-y-1.5 text-[11px] text-blue-800">
                    <div className="flex items-center gap-1.5 font-semibold">
                      <ShieldCheck className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                      <span>Automatic Safety Rollback Snapshot</span>
                    </div>
                    <p className="text-[11px] text-blue-700 leading-normal">
                      A safety snapshot of your current data is automatically taken before any restore is performed.
                    </p>
                  </div>
                </div>

                <div className="mt-5 pt-4 border-t border-slate-100 flex items-center justify-between">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".json"
                    onChange={handleFileChange}
                    className="hidden"
                  />
                  <span className="text-[11px] text-slate-400">Supports .json backups</span>
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isLoading}
                    className="px-4 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 active:bg-slate-100 rounded-lg shadow-2xs transition-colors cursor-pointer flex items-center gap-2 disabled:opacity-50"
                  >
                    <Upload className="w-3.5 h-3.5 text-slate-500" />
                    <span>Select Backup File</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Local Safety Snapshots List */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-bold text-slate-900">Local Safety Snapshots</h3>
                    <span className="px-2 py-0.5 text-[10px] font-semibold bg-slate-100 text-slate-700 rounded-full font-mono">
                      {snapshots.length} / 10
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Internal points-in-time stored in browser IndexedDB. Roll back instantly if you make accidental changes.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleCreateSnapshot}
                  disabled={isLoading}
                  className="px-3 py-1.5 text-xs font-semibold text-slate-700 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg transition-colors cursor-pointer flex items-center gap-1.5 self-start sm:self-auto disabled:opacity-50"
                >
                  <Clock className="w-3.5 h-3.5 text-slate-500" />
                  <span>Create Snapshot</span>
                </button>
              </div>

              {snapshots.length > 0 ? (
                <div className="divide-y divide-slate-100">
                  {snapshots.map((snap) => (
                    <div
                      key={snap.id}
                      className="px-5 py-3.5 flex flex-col md:flex-row md:items-center justify-between gap-3 hover:bg-slate-50/70 transition-colors"
                    >
                      <div className="flex items-start gap-3">
                        <div className="w-8 h-8 rounded-lg bg-slate-100 text-slate-600 flex items-center justify-center shrink-0 mt-0.5">
                          <Database className="w-4 h-4" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h4 className="text-xs font-bold text-slate-900">{snap.name}</h4>
                            <span className="text-[10px] px-2 py-0.2 rounded-full font-medium bg-slate-100 text-slate-600 border border-slate-200">
                              {snap.reason}
                            </span>
                          </div>
                          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-500 mt-1">
                            <span>{new Date(snap.timestamp).toLocaleString('en-IN')}</span>
                            <span>•</span>
                            <span>{snap.partiesCount} Parties</span>
                            <span>•</span>
                            <span>{snap.itemsCount} Items</span>
                            <span>•</span>
                            <span>{snap.transactionsCount} Transactions</span>
                            <span>•</span>
                            <span className="font-semibold text-slate-700 font-mono">
                              Total Sales: {formatINR(snap.totalSalesAmount)}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 self-end md:self-auto shrink-0">
                        <button
                          type="button"
                          onClick={() => {
                            const blob = new Blob([snap.data], { type: 'application/json' });
                            const url = URL.createObjectURL(blob);
                            const link = document.createElement('a');
                            link.href = url;
                            link.download = `Snapshot_${snap.id}.json`;
                            link.click();
                            URL.revokeObjectURL(url);
                          }}
                          title="Download Snapshot JSON"
                          className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 rounded-md transition-colors cursor-pointer"
                        >
                          <Download className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setSnapshotToRollback(snap)}
                          className="px-2.5 py-1 text-xs font-semibold text-rose-600 hover:bg-rose-50 border border-rose-200 rounded-md transition-colors cursor-pointer flex items-center gap-1"
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                          <span>Rollback</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setSnapshotToDelete(snap)}
                          title="Delete Snapshot"
                          className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-md transition-colors cursor-pointer"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="py-12 text-center flex flex-col items-center justify-center">
                  <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mb-2.5">
                    <Clock className="w-6 h-6" />
                  </div>
                  <h4 className="text-xs font-semibold text-slate-800">No Local Snapshots Yet</h4>
                  <p className="text-[11px] text-slate-500 max-w-sm mt-0.5">
                    Click &ldquo;Create Snapshot&rdquo; to save an instant restore point before making major stock or invoice
                    modifications.
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 2: SHARE & CA EXPORT */}
        {/* ========================================================================= */}
        {activeTab === 'share_export' && (
          <div className="max-w-5xl mx-auto space-y-6">
            {/* WhatsApp Share Card */}
            <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-2xs">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-100">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
                    <MessageCircle className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">WhatsApp Daily Business Summary</h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Send a formatted business performance health card directly to your CA, partner, or accountant.
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleCopySummary}
                    className="px-3 py-1.5 text-xs font-semibold text-slate-700 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg transition-colors cursor-pointer flex items-center gap-1.5"
                  >
                    {copiedSummary ? (
                      <Check className="w-3.5 h-3.5 text-emerald-600" />
                    ) : (
                      <Copy className="w-3.5 h-3.5 text-slate-500" />
                    )}
                    <span>{copiedSummary ? 'Copied!' : 'Copy Summary'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleNativeShare}
                    className="px-3 py-1.5 text-xs font-semibold text-slate-700 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg transition-colors cursor-pointer flex items-center gap-1.5"
                  >
                    <Share2 className="w-3.5 h-3.5 text-slate-500" />
                    <span>Share...</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleOpenWhatsApp}
                    className="px-3.5 py-1.5 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 rounded-lg shadow-2xs transition-colors cursor-pointer flex items-center gap-1.5"
                  >
                    <MessageCircle className="w-3.5 h-3.5" />
                    <span>Send on WhatsApp</span>
                  </button>
                </div>
              </div>

              {/* Message Preview */}
              <div className="mt-4 p-4 bg-slate-900 text-slate-100 rounded-xl font-mono text-xs whitespace-pre-wrap leading-relaxed border border-slate-800 shadow-inner">
                {whatsappSummary}
              </div>
            </div>

            {/* Complete CA & Accountant CSV Registers */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Accountant & CA Excel / CSV Export Pack</h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Download complete raw ledgers in universal comma-separated CSV format ready for Microsoft Excel,
                    Tally, Zoho, or GST filing.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleExportAllCSVs}
                  className="px-3.5 py-1.5 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 rounded-lg shadow-2xs transition-colors cursor-pointer flex items-center gap-1.5 self-start sm:self-auto"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download All 4 CSVs</span>
                </button>
              </div>

              <div className="p-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* 1. Sales Register */}
                <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 flex flex-col justify-between hover:border-slate-300 transition-colors">
                  <div>
                    <div className="w-8 h-8 rounded-lg bg-rose-100 text-rose-700 flex items-center justify-center mb-2.5">
                      <FileSpreadsheet className="w-4 h-4" />
                    </div>
                    <h4 className="text-xs font-bold text-slate-900">Sales Register CSV</h4>
                    <p className="text-[11px] text-slate-500 mt-1">
                      Taxable amount, CGST, SGST, IGST, invoice number, party GSTIN, and payments.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleExportSalesCSV}
                    className="mt-4 w-full py-1.5 text-xs font-semibold text-rose-600 bg-white hover:bg-rose-50 border border-rose-200 rounded-lg transition-colors cursor-pointer flex items-center justify-center gap-1.5"
                  >
                    <Download className="w-3 h-3" />
                    <span>Download CSV</span>
                  </button>
                </div>

                {/* 2. Purchases Register */}
                <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 flex flex-col justify-between hover:border-slate-300 transition-colors">
                  <div>
                    <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center mb-2.5">
                      <FileSpreadsheet className="w-4 h-4" />
                    </div>
                    <h4 className="text-xs font-bold text-slate-900">Purchases Register CSV</h4>
                    <p className="text-[11px] text-slate-500 mt-1">
                      Purchase bills, supplier details, input tax credit split, and balance payable.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleExportPurchasesCSV}
                    className="mt-4 w-full py-1.5 text-xs font-semibold text-blue-600 bg-white hover:bg-blue-50 border border-blue-200 rounded-lg transition-colors cursor-pointer flex items-center justify-center gap-1.5"
                  >
                    <Download className="w-3 h-3" />
                    <span>Download CSV</span>
                  </button>
                </div>

                {/* 3. Parties Ledger Master */}
                <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 flex flex-col justify-between hover:border-slate-300 transition-colors">
                  <div>
                    <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center mb-2.5">
                      <FileSpreadsheet className="w-4 h-4" />
                    </div>
                    <h4 className="text-xs font-bold text-slate-900">Parties Master CSV</h4>
                    <p className="text-[11px] text-slate-500 mt-1">
                      Full customer & vendor master with GSTIN, phone, address, and live ledger balances.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleExportPartiesCSV}
                    className="mt-4 w-full py-1.5 text-xs font-semibold text-emerald-600 bg-white hover:bg-emerald-50 border border-emerald-200 rounded-lg transition-colors cursor-pointer flex items-center justify-center gap-1.5"
                  >
                    <Download className="w-3 h-3" />
                    <span>Download CSV</span>
                  </button>
                </div>

                {/* 4. Items & Stock Inventory */}
                <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 flex flex-col justify-between hover:border-slate-300 transition-colors">
                  <div>
                    <div className="w-8 h-8 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center mb-2.5">
                      <FileSpreadsheet className="w-4 h-4" />
                    </div>
                    <h4 className="text-xs font-bold text-slate-900">Items & Stock CSV</h4>
                    <p className="text-[11px] text-slate-500 mt-1">
                      HSN codes, tax rates, current inventory quantity, purchase rates, and total stock valuation.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleExportItemsCSV}
                    className="mt-4 w-full py-1.5 text-xs font-semibold text-amber-700 bg-white hover:bg-amber-50 border border-amber-200 rounded-lg transition-colors cursor-pointer flex items-center justify-center gap-1.5"
                  >
                    <Download className="w-3 h-3" />
                    <span>Download CSV</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 3: MULTI-DEVICE & STORAGE */}
        {/* ========================================================================= */}
        {activeTab === 'sync_devices' && (
          <div className="max-w-5xl mx-auto space-y-6">
            {/* Storage Usage Diagnostics */}
            <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-2xs">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
                  <HardDrive className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">IndexedDB Device Storage Status</h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Real-time disk space allocated to this application by your local browser
                  </p>
                </div>
              </div>

              {storageUsage && (
                <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
                  <div className="flex items-center justify-between text-xs font-semibold text-slate-700">
                    <span>Database Usage: {storageUsage.usedMB} MB</span>
                    <span className="font-mono text-slate-500">
                      {Math.round((storageUsage.usedMB / (storageUsage.quotaMB || 1)) * 10000) / 100}% of{' '}
                      {(storageUsage.quotaMB / 1024).toFixed(1)} GB Quota
                    </span>
                  </div>

                  {/* Progress bar */}
                  <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden">
                    <div
                      className="bg-emerald-500 h-full rounded-full transition-all duration-300"
                      style={{
                        width: `${Math.min(100, Math.max(1, (storageUsage.usedMB / (storageUsage.quotaMB || 1)) * 100))}%`,
                      }}
                    />
                  </div>

                  <div className="flex flex-wrap items-center justify-between text-[11px] text-slate-500 pt-1">
                    <div className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-emerald-500" />
                      <span>Persistent Storage: {isPersisted ? 'Guaranteed (No eviction)' : 'Standard'}</span>
                    </div>
                    <span>Zero cloud dependencies · Operates 100% offline</span>
                  </div>
                </div>
              )}
            </div>

            {/* Portable Sync Token */}
            <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-2xs">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-lg bg-violet-50 text-violet-600 flex items-center justify-center">
                  <Smartphone className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Transfer Database Across Devices (Sync Token)</h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Copy a compact portable data token to instantly duplicate your accounts onto another phone, laptop,
                    or desktop browser.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5 pt-2">
                {/* 1. Generate Token */}
                <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 flex flex-col justify-between">
                  <div>
                    <h4 className="text-xs font-bold text-slate-900">Export Sync Code (Current Device)</h4>
                    <p className="text-[11px] text-slate-500 mt-1">
                      Generates a single encrypted text string containing all your parties, items, and sales.
                    </p>

                    {syncCode && (
                      <div className="mt-3 relative">
                        <textarea
                          readOnly
                          rows={4}
                          value={syncCode}
                          className="w-full p-2.5 text-[10px] font-mono bg-white border border-slate-200 rounded-lg text-slate-700 resize-none focus:outline-hidden"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            navigator.clipboard.writeText(syncCode);
                            setCopiedSyncCode(true);
                            showToast('Sync code copied to clipboard', 'success');
                            setTimeout(() => setCopiedSyncCode(false), 2000);
                          }}
                          className="absolute bottom-2.5 right-2.5 px-2 py-1 bg-slate-900 text-white rounded text-[10px] font-semibold flex items-center gap-1 shadow-xs cursor-pointer hover:bg-slate-800"
                        >
                          {copiedSyncCode ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                          <span>{copiedSyncCode ? 'Copied' : 'Copy Code'}</span>
                        </button>
                      </div>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={handleGenerateSyncCode}
                    disabled={isLoading}
                    className="mt-4 py-2 text-xs font-semibold text-violet-700 bg-white hover:bg-violet-50 border border-violet-200 rounded-lg transition-colors cursor-pointer flex items-center justify-center gap-1.5"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>Generate Sync Code</span>
                  </button>
                </div>

                {/* 2. Import Token */}
                <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 flex flex-col justify-between">
                  <div>
                    <h4 className="text-xs font-bold text-slate-900">Receive Sync Code (From Another Device)</h4>
                    <p className="text-[11px] text-slate-500 mt-1">
                      Paste a sync token generated from another computer to import all records.
                    </p>
                    <textarea
                      rows={4}
                      value={inputSyncCode}
                      onChange={(e) => setInputSyncCode(e.target.value)}
                      placeholder="Paste your sync code string here..."
                      className="mt-3 w-full p-2.5 text-[10px] font-mono bg-white border border-slate-200 rounded-lg text-slate-700 placeholder:text-slate-400 focus:outline-hidden focus:ring-1 focus:ring-slate-900"
                    />
                  </div>

                  <button
                    type="button"
                    onClick={handleImportSyncCode}
                    disabled={isLoading || !inputSyncCode.trim()}
                    className="mt-4 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition-colors cursor-pointer flex items-center justify-center gap-1.5 disabled:opacity-50"
                  >
                    <ArrowRight className="w-3.5 h-3.5" />
                    <span>Import & Verify Records</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Desktop App & Windows Release */}
            <div className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-xl p-5 text-white shadow-md">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-rose-600/30 border border-rose-500/20 text-rose-400 flex items-center justify-center">
                    <Monitor className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold flex items-center gap-2">
                      <span>Offline Desktop App (Windows .EXE / PWA)</span>
                      {window.electronAPI?.isDesktop && (
                        <span className="px-2 py-0.5 rounded text-[10px] bg-emerald-500/20 text-emerald-300 font-mono">
                          Native Desktop Active
                        </span>
                      )}
                    </h3>
                    <p className="text-xs text-slate-300 mt-0.5">
                      Install as standalone desktop app on Windows with full offline database access, keyboard shortcuts, and native A4/thermal printing.
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setShowDesktopAppModal(true)}
                  className="shrink-0 px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold rounded-lg shadow-sm transition-colors cursor-pointer flex items-center justify-center gap-1.5"
                >
                  <Laptop className="w-4 h-4" />
                  <span>Desktop App Setup</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 4: INTEGRITY & MAINTENANCE */}
        {/* ========================================================================= */}
        {activeTab === 'maintenance' && (
          <div className="max-w-5xl mx-auto space-y-6">
            {/* Integrity Engine Card */}
            <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-2xs">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-teal-50 text-teal-600 flex items-center justify-center">
                    <ShieldCheck className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">Database Integrity & Health Audit</h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Verify relational links, detect missing party IDs, orphan invoices, or inventory imbalances.
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleRunIntegrityCheck}
                    disabled={isCheckingIntegrity}
                    className="px-3.5 py-1.5 text-xs font-semibold text-slate-700 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg transition-colors cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isCheckingIntegrity ? 'animate-spin' : ''}`} />
                    <span>Run Health Audit</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleRunReconcile}
                    disabled={isReconciling}
                    className="px-3.5 py-1.5 text-xs font-semibold text-white bg-teal-600 hover:bg-teal-700 rounded-lg shadow-2xs transition-colors cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
                  >
                    <RotateCcw className={`w-3.5 h-3.5 ${isReconciling ? 'animate-spin' : ''}`} />
                    <span>Auto-Reconcile Balances</span>
                  </button>
                </div>
              </div>

              {/* Audit Results */}
              {integrityReport && (
                <div className="mt-4 space-y-3">
                  <div
                    className={`p-4 rounded-xl border flex items-center gap-3 ${
                      integrityReport.isHealthy
                        ? 'bg-emerald-50 text-emerald-900 border-emerald-200'
                        : 'bg-rose-50 text-rose-900 border-rose-200'
                    }`}
                  >
                    {integrityReport.isHealthy ? (
                      <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                    ) : (
                      <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0" />
                    )}
                    <div>
                      <h4 className="text-xs font-bold">
                        {integrityReport.isHealthy
                          ? '100% Database Consistency & Integrity Verified'
                          : `${integrityReport.details.length} Inconsistencies Detected`}
                      </h4>
                      <p className="text-[11px] opacity-90 mt-0.5">
                        Audited {integrityReport.totalTransactions} transactions, {integrityReport.totalParties} parties,
                        and {integrityReport.totalItems} stock items.
                      </p>
                    </div>
                  </div>

                  {integrityReport.details.length > 0 && (
                    <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 max-h-48 overflow-y-auto space-y-1">
                      {integrityReport.details.map((detail, idx) => (
                        <div key={idx} className="text-xs font-mono text-slate-700 flex items-center gap-2">
                          <span className="text-rose-500">•</span>
                          <span>{detail}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Destructive Actions & Reset Section */}
            <div className="bg-white rounded-xl border border-rose-200 p-5 shadow-2xs">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center">
                  <ShieldAlert className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Danger Zone: Data Reset Tools</h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Clear transactions or perform a clean wipe before public release. Protected by automatic backup.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                {/* 1. Reset Transactions Only */}
                <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 flex flex-col justify-between">
                  <div>
                    <h4 className="text-xs font-bold text-slate-900">Clear All Transactions Only</h4>
                    <p className="text-[11px] text-slate-500 mt-1">
                      Wipes all Sale Invoices, Purchase Bills, and Delivery Challans. Keeps your Party master and Item
                      catalog intact, resetting balances to opening values.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowResetTxModal(true)}
                    className="mt-4 py-2 text-xs font-semibold text-amber-700 bg-white hover:bg-amber-50 border border-amber-300 rounded-lg transition-colors cursor-pointer flex items-center justify-center gap-1.5"
                  >
                    <Trash2 className="w-3.5 h-3.5 text-amber-600" />
                    <span>Clear Transactions...</span>
                  </button>
                </div>

                {/* 2. Complete Factory Reset */}
                <div className="p-4 bg-rose-50/50 rounded-xl border border-rose-200 flex flex-col justify-between">
                  <div>
                    <h4 className="text-xs font-bold text-rose-900">Complete Factory Reset</h4>
                    <p className="text-[11px] text-rose-700 mt-1">
                      Deletes business profile, all parties, items, invoices, and settings. Returns the application to the
                      initial first-launch setup screen.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setFactoryConfirmText('');
                      setShowFactoryResetModal(true);
                    }}
                    className="mt-4 py-2 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 rounded-lg transition-colors cursor-pointer flex items-center justify-center gap-1.5"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Factory Reset Database...</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* MODALS */}
      {/* ========================================================================= */}

      {/* 1. Restore Inspection & Confirmation Modal */}
      {showRestoreModal && backupMetadata && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-in fade-in duration-100">
          <div className="w-full max-w-lg bg-white rounded-xl shadow-2xl border border-slate-200 overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 bg-slate-900 text-white">
              <div className="flex items-center gap-2">
                <Database className="w-5 h-5 text-rose-500" />
                <h3 className="text-sm font-bold">Inspect & Confirm Restore</h3>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowRestoreModal(false);
                  setPendingBackupJSON(null);
                  setBackupMetadata(null);
                }}
                className="text-slate-400 hover:text-white cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="p-6 space-y-4">
              {backupMetadata.isValid ? (
                <>
                  <div className="p-4 bg-emerald-50 rounded-xl border border-emerald-200 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-emerald-800 font-semibold">Business Name:</span>
                      <span className="text-xs font-bold text-emerald-950">{backupMetadata.businessName}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-emerald-800 font-semibold">GSTIN:</span>
                      <span className="text-xs font-mono text-emerald-950">{backupMetadata.gstin}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-emerald-800 font-semibold">Exported At:</span>
                      <span className="text-xs text-emerald-950">
                        {new Date(backupMetadata.exportedAt || '').toLocaleString('en-IN')}
                      </span>
                    </div>
                  </div>

                  {/* Record counts grid */}
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
                      <div className="text-base font-bold text-slate-900 font-mono">
                        {backupMetadata.partiesCount}
                      </div>
                      <div className="text-[10px] text-slate-500 font-medium">Parties</div>
                    </div>
                    <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
                      <div className="text-base font-bold text-slate-900 font-mono">
                        {backupMetadata.itemsCount}
                      </div>
                      <div className="text-[10px] text-slate-500 font-medium">Items</div>
                    </div>
                    <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
                      <div className="text-base font-bold text-slate-900 font-mono">
                        {backupMetadata.transactionsCount}
                      </div>
                      <div className="text-[10px] text-slate-500 font-medium">Transactions</div>
                    </div>
                  </div>

                  <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg flex items-center justify-between text-xs">
                    <span className="text-slate-600 font-medium">Total Confirmed Sales:</span>
                    <span className="font-bold text-slate-900 font-mono">
                      {formatINR(backupMetadata.totalSalesAmount)}
                    </span>
                  </div>

                  {/* Mode selection */}
                  <div className="space-y-2 pt-2">
                    <label className="text-xs font-bold text-slate-800 block">Choose Restore Mode:</label>
                    <div className="grid grid-cols-2 gap-3">
                      <label
                        className={`p-3 rounded-lg border text-left cursor-pointer transition-colors ${
                          restoreMode === 'clean'
                            ? 'bg-rose-50/70 border-rose-300 text-rose-900'
                            : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        <input
                          type="radio"
                          name="restoreMode"
                          checked={restoreMode === 'clean'}
                          onChange={() => setRestoreMode('clean')}
                          className="sr-only"
                        />
                        <div className="text-xs font-bold">Wipe & Clean Restore</div>
                        <div className="text-[11px] opacity-80 mt-0.5">Replaces current records completely</div>
                      </label>

                      <label
                        className={`p-3 rounded-lg border text-left cursor-pointer transition-colors ${
                          restoreMode === 'merge'
                            ? 'bg-rose-50/70 border-rose-300 text-rose-900'
                            : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        <input
                          type="radio"
                          name="restoreMode"
                          checked={restoreMode === 'merge'}
                          onChange={() => setRestoreMode('merge')}
                          className="sr-only"
                        />
                        <div className="text-xs font-bold">Merge with Existing</div>
                        <div className="text-[11px] opacity-80 mt-0.5">Preserves non-conflicting records</div>
                      </label>
                    </div>
                  </div>
                </>
              ) : (
                <div className="p-4 bg-rose-50 text-rose-800 rounded-xl border border-rose-200 flex items-center gap-3 text-xs">
                  <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0" />
                  <div>
                    <h4 className="font-bold">Invalid Backup File</h4>
                    <p className="mt-0.5">{backupMetadata.errorMessage}</p>
                  </div>
                </div>
              )}
            </div>

            <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => {
                  setShowRestoreModal(false);
                  setPendingBackupJSON(null);
                  setBackupMetadata(null);
                }}
                className="px-4 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg cursor-pointer"
              >
                Cancel
              </button>

              {backupMetadata.isValid && (
                <button
                  type="button"
                  disabled={isLoading}
                  onClick={executeRestore}
                  className="px-4 py-2 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 rounded-lg shadow-2xs cursor-pointer flex items-center gap-2 disabled:opacity-50"
                >
                  {isLoading ? (
                    <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <Upload className="w-3.5 h-3.5" />
                  )}
                  <span>Confirm Restore</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 2. Clear Transactions Only Confirmation Modal */}
      <ConfirmDeleteModal
        isOpen={showResetTxModal}
        onClose={() => setShowResetTxModal(false)}
        onConfirm={executeResetTransactionsOnly}
        title="Clear All Transactions"
        message="Are you sure you want to delete all Sale Invoices, Purchase Bills, and Challans? Your parties and items will be preserved, but stock and balances will be reset to opening values."
        details="An automated backup snapshot will be created before resetting."
        confirmButtonText="Yes, Reset Transactions"
        isLoading={isLoading}
      />

      {/* 3. Factory Reset Modal (with exact typing verification) */}
      {showFactoryResetModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-in fade-in duration-100">
          <div className="w-full max-w-md bg-white rounded-xl shadow-2xl border border-rose-300 overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 bg-rose-600 text-white">
              <div className="flex items-center gap-2.5">
                <ShieldAlert className="w-5 h-5" />
                <h3 className="text-sm font-bold">Complete Factory Reset</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowFactoryResetModal(false)}
                className="text-white/80 hover:text-white cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="p-5 space-y-4">
              <p className="text-xs text-slate-700 leading-relaxed font-medium">
                This action is <span className="font-bold text-rose-600">permanent and irreversible</span>. All your
                business configuration, customer records, inventory items, and transaction history will be wiped from this
                device.
              </p>

              <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-900 space-y-1">
                <p className="font-semibold">To confirm, type &ldquo;DELETE ALL DATA&rdquo; below:</p>
                <input
                  type="text"
                  value={factoryConfirmText}
                  onChange={(e) => setFactoryConfirmText(e.target.value)}
                  placeholder="DELETE ALL DATA"
                  className="w-full px-3 py-2 text-xs font-mono font-bold bg-white border border-rose-300 rounded text-rose-700 uppercase focus:outline-hidden focus:ring-1 focus:ring-rose-500"
                />
              </div>
            </div>

            <div className="px-5 py-3.5 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setShowFactoryResetModal(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 hover:bg-slate-100 rounded-lg cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={factoryConfirmText !== 'DELETE ALL DATA' || isLoading}
                onClick={executeFactoryReset}
                className="px-4 py-2 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 rounded-lg shadow-2xs transition-colors cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
              >
                {isLoading ? (
                  <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <Trash2 className="w-3.5 h-3.5" />
                )}
                <span>Wipe Database</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 4. Snapshot Delete Confirmation */}
      <ConfirmDeleteModal
        isOpen={!!snapshotToDelete}
        onClose={() => setSnapshotToDelete(null)}
        onConfirm={executeDeleteSnapshot}
        title="Delete Safety Snapshot"
        message={
          snapshotToDelete
            ? `Delete snapshot "${snapshotToDelete.name}" from ${formatDate(snapshotToDelete.timestamp)}?`
            : 'Delete snapshot?'
        }
        confirmButtonText="Delete Snapshot"
      />

      {/* 5. Snapshot Rollback Confirmation */}
      <ConfirmDeleteModal
        isOpen={!!snapshotToRollback}
        onClose={() => setSnapshotToRollback(null)}
        onConfirm={executeRollback}
        title="Rollback Database to Snapshot"
        message={
          snapshotToRollback
            ? `Revert all database records to "${snapshotToRollback.name}" taken on ${new Date(snapshotToRollback.timestamp).toLocaleString('en-IN')}? Current state will be safely snapshotted first.`
            : 'Revert to snapshot?'
        }
        details={
          snapshotToRollback
            ? `${snapshotToRollback.partiesCount} Parties | ${snapshotToRollback.itemsCount} Items | ${snapshotToRollback.transactionsCount} Transactions`
            : undefined
        }
        confirmButtonText="Confirm Rollback"
        isLoading={isLoading}
      />

      {/* Desktop App Modal */}
      <DesktopAppModal
        isOpen={showDesktopAppModal}
        onClose={() => setShowDesktopAppModal(false)}
      />
    </div>
  );
};
