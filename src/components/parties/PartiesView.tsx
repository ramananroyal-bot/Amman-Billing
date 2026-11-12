import React, { useState, useEffect } from 'react';
import {
  Users,
  Search,
  Plus,
  Phone,
  Mail,
  MapPin,
  MoreVertical,
  Edit,
  Trash2,
  Copy,
  Printer,
  CreditCard,
  History,
  MessageSquare,
  FileText,
  RotateCcw,
  Eye,
  Download,
} from 'lucide-react';
import { BusinessProfile, Party, Transaction } from '../../types';
import {
  getParties,
  getParty,
  getTransactions,
  getTransaction,
  deleteParty,
  duplicateParty,
  calculatePartyBalance,
  deleteTransaction,
  duplicateTransaction,
  convertInvoiceToReturn,
  convertBillToReturn,
} from '../../db/indexedDB';
import { formatINR, formatDate } from '../../utils/formatters';
import { AddPartyModal } from './AddPartyModal';
import { PaymentRecordModal } from '../payments/PaymentRecordModal';
import { ImportExportModal } from '../common/ImportExportModal';
import { PartyStatementModal } from './PartyStatementModal';
import { FloatingRowMenu, FloatingMenuItem } from '../common/FloatingRowMenu';
import { RecordHistoryModal } from '../common/RecordHistoryModal';
import { ConfirmDeleteModal } from '../common/ConfirmDeleteModal';
import { useToast } from '../common/Toast';

interface PartiesViewProps {
  businessProfile: BusinessProfile | null;
  onOpenAddSaleForParty: (party: Party) => void;
  onOpenAddPurchaseForParty: (party: Party) => void;
  onViewTransaction: (tx: Transaction) => void;
  onEditSale?: (tx: Transaction) => void;
  onEditPurchase?: (tx: Transaction) => void;
  onRefreshMetrics?: () => void;
}

export const PartiesView: React.FC<PartiesViewProps> = ({
  businessProfile,
  onOpenAddSaleForParty,
  onOpenAddPurchaseForParty,
  onViewTransaction,
  onEditSale,
  onEditPurchase,
  onRefreshMetrics,
}) => {
  const { showToast } = useToast();
  const [parties, setParties] = useState<Party[]>([]);
  const [partyBalances, setPartyBalances] = useState<Record<string, { balance: number; type: 'to_receive' | 'to_pay' }>>({});
  const [selectedParty, setSelectedParty] = useState<Party | null>(null);
  const [partyTransactions, setPartyTransactions] = useState<Transaction[]>([]);

  // Search & Filter
  const [searchQuery, setSearchQuery] = useState('');
  const [groupFilter, setGroupFilter] = useState<'All' | 'Customer' | 'Supplier'>('All');

  // Modals
  const [showAddModal, setShowAddModal] = useState(false);
  const [partyToEdit, setPartyToEdit] = useState<Party | null>(null);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentModalType, setPaymentModalType] = useState<'payment_in' | 'payment_out'>('payment_in');
  const [targetTxForPayment, setTargetTxForPayment] = useState<Transaction | null>(null);
  const [showStatementModal, setShowStatementModal] = useState(false);
  const [showImportExport, setShowImportExport] = useState(false);
  const [showPartyHistoryModal, setShowPartyHistoryModal] = useState(false);
  const [selectedTxForHistory, setSelectedTxForHistory] = useState<Transaction | null>(null);

  // Floating row menu state for transactions
  const [activeMenuTxId, setActiveMenuTxId] = useState<string | null>(null);
  const [txMenuAnchorRect, setTxMenuAnchorRect] = useState<DOMRect | null>(null);

  // Floating row menu state for selected party header
  const [isPartyMenuOpen, setIsPartyMenuOpen] = useState(false);
  const [partyMenuAnchorRect, setPartyMenuAnchorRect] = useState<DOMRect | null>(null);

  // In-app Delete Confirmation Modal
  const [deleteDialogConfig, setDeleteDialogConfig] = useState<{
    isOpen: boolean;
    type: 'transaction' | 'party';
    title: string;
    message: string;
    details?: string;
    recordId: string;
  }>({
    isOpen: false,
    type: 'transaction',
    title: 'Delete Record',
    message: 'Delete this record? This cannot be undone.',
    recordId: '',
  });
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    loadParties();
  }, []);

  const loadParties = async () => {
    const list = await getParties();
    list.sort((a, b) => a.name.localeCompare(b.name));
    setParties(list);

    // Compute net balances
    const balances: Record<string, { balance: number; type: 'to_receive' | 'to_pay' }> = {};
    for (const p of list) {
      balances[p.id] = await calculatePartyBalance(p);
    }
    setPartyBalances(balances);

    // Default select first party if none selected
    if (list.length > 0) {
      if (!selectedParty || !list.some((p) => p.id === selectedParty.id)) {
        await selectParty(list[0]);
      } else {
        const fresh = await getParty(selectedParty.id);
        if (fresh) await selectParty(fresh);
      }
    } else {
      setSelectedParty(null);
      setPartyTransactions([]);
    }
  };

  const selectParty = async (party: Party) => {
    setSelectedParty(party);
    const txs = await getTransactions({ partyId: party.id });
    setPartyTransactions(txs);
  };

  // Filter parties
  const filteredParties = parties.filter((p) => {
    const matchesGroup = groupFilter === 'All' || p.group === groupFilter;
    const q = searchQuery.toLowerCase().trim();
    const matchesQuery =
      !q ||
      p.name.toLowerCase().includes(q) ||
      (p.phone && p.phone.includes(q)) ||
      (p.gstin && p.gstin.toLowerCase().includes(q));
    return matchesGroup && matchesQuery;
  });

  // Action handlers for Party
  const handleEditParty = (party: Party) => {
    setPartyToEdit(party);
    setShowAddModal(true);
  };

  const handleDuplicateParty = async (party: Party) => {
    try {
      const copy = await duplicateParty(party.id);
      await loadParties();
      showToast(`Party duplicated as ${copy.name}.`, 'success');
    } catch {
      showToast('Failed to duplicate party', 'error');
    }
  };

  const handleDeletePartyClick = async (party: Party) => {
    // Check if party has transactions
    const txList = await getTransactions({ partyId: party.id });
    if (txList.length > 0) {
      showToast('This party has transactions and cannot be deleted', 'error');
      return;
    }

    setDeleteDialogConfig({
      isOpen: true,
      type: 'party',
      title: 'Delete Party',
      message: `Delete ${party.name}? This cannot be undone.`,
      details: `Party: ${party.name} · Phone: ${party.phone || 'N/A'} · GSTIN: ${party.gstin || 'Unregistered'}`,
      recordId: party.id,
    });
  };

  // WhatsApp Connect
  const handleOpenWhatsApp = (party: Party) => {
    if (!party.phone) {
      showToast('This party does not have a phone number entered.', 'info');
      return;
    }
    const cleanPhone = party.phone.replace(/\D/g, '');
    const fullPhone = cleanPhone.length === 10 ? `91${cleanPhone}` : cleanPhone;
    const partyBal = partyBalances[party.id];
    const balText = partyBal ? `${formatINR(partyBal.balance)} (${partyBal.type})` : '₹0.00';
    const message = encodeURIComponent(
      `Hello ${party.name}, Greetings from ${businessProfile?.businessName || 'our business'}. Your current balance is ${balText}. Thank you!`
    );
    window.open(`https://wa.me/${fullPhone}?text=${message}`, '_blank');
  };

  // Transaction Row Actions
  // Exact requested order:
  // View/Edit | Delete | Duplicate | Open PDF | Preview | Print | Convert To Return | Make Payment | View History
  const handleTxAction = async (actionType: string, txId: string) => {
    setActiveMenuTxId(null);
    setTxMenuAnchorRect(null);

    const tx = await getTransaction(txId);
    if (!tx) {
      showToast('Transaction not found in database', 'error');
      return;
    }

    try {
      switch (actionType) {
        case 'view_edit':
          if (tx.type === 'purchase_bill' || tx.type === 'purchase_return') {
            if (onEditPurchase) {
              onEditPurchase(tx);
            } else {
              onViewTransaction(tx);
            }
          } else {
            if (onEditSale) {
              onEditSale(tx);
            } else {
              onViewTransaction(tx);
            }
          }
          break;

        case 'delete':
          setDeleteDialogConfig({
            isOpen: true,
            type: 'transaction',
            title: 'Delete Transaction',
            message: `Delete ${tx.invoiceNo}? This cannot be undone.`,
            details: `Invoice: ${tx.invoiceNo} · Type: ${tx.type} · Amount: ₹${tx.totalAmount.toFixed(2)}`,
            recordId: tx.id,
          });
          break;

        case 'duplicate':
          try {
            const copy = await duplicateTransaction(tx.id);
            if (selectedParty) await selectParty(selectedParty);
            await loadParties();
            if (onRefreshMetrics) onRefreshMetrics();
            showToast(`Transaction duplicated as ${copy.invoiceNo}.`, 'success');
          } catch {
            showToast('Failed to duplicate transaction', 'error');
          }
          break;

        case 'open_pdf':
        case 'preview':
          onViewTransaction(tx);
          break;

        case 'print':
          onViewTransaction(tx);
          setTimeout(() => window.print(), 300);
          break;

        case 'convert_return':
          if (tx.type === 'sale_invoice') {
            const ret = await convertInvoiceToReturn(tx.id);
            if (selectedParty) await selectParty(selectedParty);
            await loadParties();
            if (onRefreshMetrics) onRefreshMetrics();
            showToast(`Created return credit note ${ret.invoiceNo}. Stock restored.`, 'success');
          } else if (tx.type === 'purchase_bill') {
            const ret = await convertBillToReturn(tx.id);
            if (selectedParty) await selectParty(selectedParty);
            await loadParties();
            if (onRefreshMetrics) onRefreshMetrics();
            showToast(`Created return debit note ${ret.invoiceNo}. Stock adjusted.`, 'success');
          } else {
            showToast('This transaction type cannot be converted to return.', 'info');
          }
          break;

        case 'make_payment':
          setTargetTxForPayment(tx);
          setPaymentModalType(tx.type === 'purchase_bill' ? 'payment_out' : 'payment_in');
          setShowPaymentModal(true);
          break;

        case 'history':
          setSelectedTxForHistory(tx);
          break;

        default:
          showToast('Feature coming soon', 'info');
          break;
      }
    } catch (err) {
      showToast(`Action failed: ${(err as Error).message || 'Unknown error'}`, 'error');
    }
  };

  // Perform confirmed delete
  const handleConfirmDelete = async () => {
    setIsDeleting(true);
    try {
      if (deleteDialogConfig.type === 'transaction') {
        const res = await deleteTransaction(deleteDialogConfig.recordId);
        if (!res.success) {
          showToast(res.error || 'Failed to delete transaction', 'error');
          return;
        }
        showToast('Transaction deleted', 'success');
        setPartyTransactions((prev) => prev.filter((t) => t.id !== deleteDialogConfig.recordId));
        setDeleteDialogConfig((prev) => ({ ...prev, isOpen: false }));

        if (selectedParty) await selectParty(selectedParty);
        await loadParties();
        if (onRefreshMetrics) onRefreshMetrics();
      } else {
        const res = await deleteParty(deleteDialogConfig.recordId);
        if (!res.success) {
          showToast(res.error || 'This party has transactions and cannot be deleted', 'error');
          return;
        }
        showToast('Party deleted', 'success');
        setParties((prev) => prev.filter((p) => p.id !== deleteDialogConfig.recordId));
        setDeleteDialogConfig((prev) => ({ ...prev, isOpen: false }));
        await loadParties();
      }
    } catch (err) {
      showToast(`Delete failed: ${(err as Error).message || 'Unknown error'}`, 'error');
    } finally {
      setIsDeleting(false);
    }
  };

  // Build items for the active transaction menu
  // Exact requested order:
  // View/Edit | Delete | Duplicate | Open PDF | Preview | Print | Convert To Return | Make Payment | View History
  const currentMenuTx = partyTransactions.find((t) => t.id === activeMenuTxId);
  const txMenuItems: FloatingMenuItem[] = currentMenuTx
    ? [
        {
          label: 'View / Edit',
          action: 'view_edit',
          dataId: currentMenuTx.id,
          dataType: currentMenuTx.type,
          icon: <Edit className="w-3.5 h-3.5" />,
          onClick: () => handleTxAction('view_edit', currentMenuTx.id),
        },
        {
          label: 'Delete',
          action: 'delete',
          dataId: currentMenuTx.id,
          dataType: currentMenuTx.type,
          icon: <Trash2 className="w-3.5 h-3.5" />,
          danger: true,
          dividerBefore: true,
          onClick: () => handleTxAction('delete', currentMenuTx.id),
        },
        {
          label: 'Duplicate',
          action: 'duplicate',
          dataId: currentMenuTx.id,
          dataType: currentMenuTx.type,
          icon: <Copy className="w-3.5 h-3.5" />,
          dividerBefore: true,
          onClick: () => handleTxAction('duplicate', currentMenuTx.id),
        },
        {
          label: 'Open PDF',
          action: 'open_pdf',
          dataId: currentMenuTx.id,
          dataType: currentMenuTx.type,
          icon: <Download className="w-3.5 h-3.5" />,
          onClick: () => handleTxAction('open_pdf', currentMenuTx.id),
        },
        {
          label: 'Preview',
          action: 'preview',
          dataId: currentMenuTx.id,
          dataType: currentMenuTx.type,
          icon: <Eye className="w-3.5 h-3.5" />,
          onClick: () => handleTxAction('preview', currentMenuTx.id),
        },
        {
          label: 'Print',
          action: 'print',
          dataId: currentMenuTx.id,
          dataType: currentMenuTx.type,
          icon: <Printer className="w-3.5 h-3.5" />,
          onClick: () => handleTxAction('print', currentMenuTx.id),
        },
        {
          label: 'Convert To Return',
          action: 'convert_return',
          dataId: currentMenuTx.id,
          dataType: currentMenuTx.type,
          icon: <RotateCcw className="w-3.5 h-3.5" />,
          dividerBefore: true,
          disabled:
            currentMenuTx.status === 'cancelled' ||
            currentMenuTx.type === 'sale_return' ||
            currentMenuTx.type === 'purchase_return' ||
            currentMenuTx.type === 'payment_in' ||
            currentMenuTx.type === 'payment_out',
          disabledReason:
            currentMenuTx.status === 'cancelled'
              ? 'Cancelled'
              : currentMenuTx.type.includes('return')
              ? 'Already a return'
              : 'Not applicable',
          onClick: () => handleTxAction('convert_return', currentMenuTx.id),
        },
        {
          label: 'Make Payment',
          action: 'make_payment',
          dataId: currentMenuTx.id,
          dataType: currentMenuTx.type,
          icon: <CreditCard className="w-3.5 h-3.5" />,
          disabled: currentMenuTx.status === 'cancelled' || currentMenuTx.balanceDue <= 0,
          disabledReason: currentMenuTx.balanceDue <= 0 ? 'Fully Paid' : 'Cancelled',
          onClick: () => handleTxAction('make_payment', currentMenuTx.id),
        },
        {
          label: 'View History',
          action: 'history',
          dataId: currentMenuTx.id,
          dataType: currentMenuTx.type,
          icon: <History className="w-3.5 h-3.5" />,
          dividerBefore: true,
          onClick: () => handleTxAction('history', currentMenuTx.id),
        },
      ]
    : [];

  // Party Header Menu items
  const partyMenuItems: FloatingMenuItem[] = selectedParty
    ? [
        {
          label: 'View / Edit',
          action: 'view_edit',
          dataId: selectedParty.id,
          dataType: 'party',
          icon: <Edit className="w-3.5 h-3.5" />,
          onClick: () => handleEditParty(selectedParty),
        },
        {
          label: 'Delete',
          action: 'delete',
          dataId: selectedParty.id,
          dataType: 'party',
          icon: <Trash2 className="w-3.5 h-3.5" />,
          danger: true,
          dividerBefore: true,
          onClick: () => handleDeletePartyClick(selectedParty),
        },
        {
          label: 'Duplicate',
          action: 'duplicate',
          dataId: selectedParty.id,
          dataType: 'party',
          icon: <Copy className="w-3.5 h-3.5" />,
          dividerBefore: true,
          onClick: () => handleDuplicateParty(selectedParty),
        },
        {
          label: 'Open PDF',
          action: 'open_pdf',
          dataId: selectedParty.id,
          dataType: 'party',
          icon: <Download className="w-3.5 h-3.5" />,
          onClick: () => setShowStatementModal(true),
        },
        {
          label: 'Preview',
          action: 'preview',
          dataId: selectedParty.id,
          dataType: 'party',
          icon: <Eye className="w-3.5 h-3.5" />,
          onClick: () => setShowStatementModal(true),
        },
        {
          label: 'Print',
          action: 'print',
          dataId: selectedParty.id,
          dataType: 'party',
          icon: <Printer className="w-3.5 h-3.5" />,
          onClick: () => {
            setShowStatementModal(true);
            setTimeout(() => window.print(), 300);
          },
        },
        {
          label: 'Make Payment',
          action: 'make_payment',
          dataId: selectedParty.id,
          dataType: 'party',
          icon: <CreditCard className="w-3.5 h-3.5" />,
          dividerBefore: true,
          onClick: () => {
            setTargetTxForPayment(null);
            setPaymentModalType(selectedParty.group === 'Supplier' ? 'payment_out' : 'payment_in');
            setShowPaymentModal(true);
          },
        },
        {
          label: 'View History',
          action: 'history',
          dataId: selectedParty.id,
          dataType: 'party',
          icon: <History className="w-3.5 h-3.5" />,
          dividerBefore: true,
          onClick: () => setShowPartyHistoryModal(true),
        },
      ]
    : [];

  return (
    <div className="flex h-full w-full overflow-hidden bg-slate-50">
      {/* LEFT COLUMN: Parties List & Search */}
      <div className="w-80 md:w-96 border-r border-slate-200 bg-white flex flex-col shrink-0">
        {/* Top bar */}
        <div className="p-4 border-b border-slate-200 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-slate-900">Parties</h2>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setShowImportExport(true)}
                title="Import or Export Parties CSV"
                className="px-2.5 py-1.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-200 rounded-lg flex items-center gap-1 cursor-pointer"
              >
                <Download className="w-3.5 h-3.5 text-slate-500" />
                <span className="hidden sm:inline">Import/Export</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setPartyToEdit(null);
                  setShowAddModal(true);
                }}
                className="px-3 py-1.5 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 rounded-lg shadow-2xs flex items-center gap-1.5 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Party</span>
              </button>
            </div>
          </div>

          {/* Search box */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by name, phone or GSTIN..."
              className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-slate-900"
            />
          </div>

          {/* Filter segment tabs */}
          <div className="flex items-center gap-1 p-0.5 bg-slate-100 rounded-lg text-xs">
            {(['All', 'Customer', 'Supplier'] as const).map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => setGroupFilter(tab)}
                className={`flex-1 py-1 rounded-md font-medium transition-colors cursor-pointer text-center ${
                  groupFilter === tab
                    ? 'bg-white text-slate-900 shadow-2xs font-semibold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {tab === 'All' ? 'All' : `${tab}s`}
              </button>
            ))}
          </div>
        </div>

        {/* Parties list */}
        <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
          {filteredParties.length > 0 ? (
            filteredParties.map((party) => {
              const bal = partyBalances[party.id];
              const isSelected = selectedParty?.id === party.id;

              return (
                <div
                  key={party.id}
                  onClick={() => selectParty(party)}
                  className={`p-3.5 hover:bg-slate-50 transition-colors cursor-pointer flex items-center justify-between ${
                    isSelected ? 'bg-rose-50/60 border-l-3 border-rose-600' : ''
                  }`}
                >
                  <div className="min-w-0 flex-1 pr-2">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-bold text-slate-900 truncate">{party.name}</span>
                      <span className="text-[10px] text-slate-400 font-medium">({party.group || 'Customer'})</span>
                    </div>
                    <div className="text-[11px] text-slate-500 font-mono mt-0.5 truncate">
                      {party.phone || 'No Phone'} {party.gstin ? `· ${party.gstin.substring(0, 10)}...` : ''}
                    </div>
                  </div>

                  <div className="text-right shrink-0 font-mono">
                    {bal && bal.balance > 0 ? (
                      <div>
                        <div
                          className={`text-xs font-bold tabular-nums ${
                            bal.type === 'to_receive' ? 'text-emerald-700' : 'text-rose-700'
                          }`}
                        >
                          {formatINR(bal.balance)}
                        </div>
                        <span className="text-[9px] uppercase text-slate-400">
                          {bal.type === 'to_receive' ? "You'll Receive" : "You'll Pay"}
                        </span>
                      </div>
                    ) : (
                      <span className="text-xs text-slate-400">₹0.00</span>
                    )}
                  </div>
                </div>
              );
            })
          ) : (
            <div className="p-8 text-center">
              <div className="w-10 h-10 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mx-auto mb-2">
                <Users className="w-5 h-5" />
              </div>
              <p className="text-xs text-slate-500">No parties found</p>
              <button
                type="button"
                onClick={() => {
                  setPartyToEdit(null);
                  setShowAddModal(true);
                }}
                className="mt-2 text-xs font-semibold text-rose-600 hover:underline cursor-pointer"
              >
                + Add New Party
              </button>
            </div>
          )}
        </div>
      </div>

      {/* RIGHT COLUMN: Selected Party Details & Transactions */}
      <div className="flex-1 flex flex-col min-w-0 overflow-y-auto">
        {selectedParty ? (
          <div className="p-5 sm:p-6 space-y-6 max-w-5xl">
            {/* Top Header Card */}
            <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-2xs">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-lg font-bold text-slate-900">{selectedParty.name}</h2>
                    <span className="px-2 py-0.5 text-[10px] font-semibold bg-slate-100 text-slate-700 rounded-md">
                      {selectedParty.group}
                    </span>
                    <span className="px-2 py-0.5 text-[10px] font-medium bg-slate-100 text-slate-600 rounded-md">
                      {selectedParty.gstType}
                    </span>
                  </div>
                  <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
                    {selectedParty.phone && (
                      <span className="flex items-center gap-1 font-mono">
                        <Phone className="w-3 h-3 text-slate-400" />
                        {selectedParty.phone}
                      </span>
                    )}
                    {selectedParty.email && (
                      <span className="flex items-center gap-1">
                        <Mail className="w-3 h-3 text-slate-400" />
                        {selectedParty.email}
                      </span>
                    )}
                    {selectedParty.gstin && (
                      <span className="font-mono font-semibold text-slate-800">
                        GSTIN: {selectedParty.gstin}
                      </span>
                    )}
                    <span>State: {selectedParty.state} ({selectedParty.stateCode})</span>
                  </div>
                </div>

                {/* Quick Action Buttons & 3-Dot Row Menu */}
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => onOpenAddSaleForParty(selectedParty)}
                    className="px-3 py-1.5 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 rounded-lg shadow-2xs cursor-pointer"
                  >
                    + Add Sale
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setTargetTxForPayment(null);
                      setPaymentModalType(selectedParty.group === 'Supplier' ? 'payment_out' : 'payment_in');
                      setShowPaymentModal(true);
                    }}
                    className="px-3 py-1.5 text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg cursor-pointer"
                  >
                    Make Payment
                  </button>

                  <button
                    type="button"
                    onClick={() => handleOpenWhatsApp(selectedParty)}
                    title="WhatsApp Connect"
                    className="p-2 text-emerald-600 hover:bg-emerald-50 border border-emerald-200 rounded-lg transition-colors cursor-pointer"
                  >
                    <MessageSquare className="w-4 h-4" />
                  </button>

                  {/* 3-Dot Menu Button using FloatingRowMenu */}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (isPartyMenuOpen) {
                        setIsPartyMenuOpen(false);
                        setPartyMenuAnchorRect(null);
                      } else {
                        setIsPartyMenuOpen(true);
                        setPartyMenuAnchorRect(e.currentTarget.getBoundingClientRect());
                      }
                    }}
                    className={`p-2 rounded-lg border transition-colors cursor-pointer ${
                      isPartyMenuOpen
                        ? 'bg-slate-100 text-slate-900 border-slate-300'
                        : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100 border-slate-200'
                    }`}
                    title="Party Actions"
                  >
                    <MoreVertical className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Balances & Addresses Strip */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4">
                {/* Net Balance Card */}
                <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                    Current Net Balance
                  </span>
                  <div className="mt-1 font-mono">
                    {partyBalances[selectedParty.id] ? (
                      <span
                        className={`text-lg font-bold tabular-nums ${
                          partyBalances[selectedParty.id].type === 'to_receive'
                            ? 'text-emerald-700'
                            : 'text-rose-700'
                        }`}
                      >
                        {formatINR(partyBalances[selectedParty.id].balance)}
                      </span>
                    ) : (
                      <span className="text-lg font-bold text-slate-800">₹0.00</span>
                    )}
                    <span className="text-[11px] text-slate-500 ml-1.5 capitalize font-sans">
                      ({partyBalances[selectedParty.id]?.type === 'to_receive' ? "You'll Receive" : "You'll Pay"})
                    </span>
                  </div>
                </div>

                {/* Opening Balance & Limit */}
                <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 text-xs font-mono space-y-1">
                  <div>
                    <span className="text-slate-500 font-sans">Opening Balance:</span>{' '}
                    <span className="font-semibold">{formatINR(selectedParty.openingBalance)}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 font-sans">Credit Limit:</span>{' '}
                    <span>{selectedParty.creditLimit > 0 ? formatINR(selectedParty.creditLimit) : 'No Limit'}</span>
                  </div>
                </div>

                {/* Billing Address Card */}
                <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 text-xs">
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1 mb-1">
                    <MapPin className="w-3 h-3 text-slate-400" />
                    Billing Address
                  </span>
                  <p className="text-slate-700 line-clamp-2">
                    {selectedParty.billingAddress || 'No billing address specified'}
                  </p>
                </div>
              </div>
            </div>

            {/* Transactions Table for Selected Party */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Transactions Ledger</h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Chronological sales, purchases, and payments with {selectedParty.name}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowStatementModal(true)}
                  className="px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 border border-slate-300 rounded-lg flex items-center gap-1.5 cursor-pointer"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Statement</span>
                </button>
              </div>

              {partyTransactions.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200 uppercase text-[11px]">
                        <th className="py-2.5 px-4">Date</th>
                        <th className="py-2.5 px-4">Type</th>
                        <th className="py-2.5 px-4">Invoice / Ref #</th>
                        <th className="py-2.5 px-4">Payment</th>
                        <th className="py-2.5 px-4 text-right">Total Amount</th>
                        <th className="py-2.5 px-4 text-right">Balance Due</th>
                        <th className="py-2.5 px-4 text-center">Status</th>
                        <th className="py-2.5 px-4 text-center">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {partyTransactions.map((tx) => {
                        const isRowMenuActive = activeMenuTxId === tx.id;

                        return (
                          <tr
                            key={tx.id}
                            onClick={() => onViewTransaction(tx)}
                            className={`transition-colors cursor-pointer ${
                              isRowMenuActive
                                ? 'bg-rose-50/80 ring-1 ring-inset ring-rose-200'
                                : 'hover:bg-slate-50'
                            }`}
                          >
                            <td className="py-2.5 px-4 font-mono text-slate-600">{formatDate(tx.date)}</td>
                            <td className="py-2.5 px-4 capitalize font-medium text-slate-900">
                              {tx.type.replace('_', ' ')}
                            </td>
                            <td className="py-2.5 px-4 font-mono font-semibold text-slate-900">{tx.invoiceNo}</td>
                            <td className="py-2.5 px-4 uppercase font-mono text-[11px] text-slate-600">
                              {tx.paymentType}
                            </td>
                            <td className="py-2.5 px-4 text-right font-mono font-bold text-slate-900 tabular-nums">
                              {formatINR(tx.totalAmount)}
                            </td>
                            <td className="py-2.5 px-4 text-right font-mono tabular-nums">
                              {tx.balanceDue > 0 ? (
                                <span className="text-amber-700 font-semibold">{formatINR(tx.balanceDue)}</span>
                              ) : (
                                <span className="text-emerald-700">Paid</span>
                              )}
                            </td>
                            <td className="py-2.5 px-4 text-center">
                              <span
                                className={`text-[11px] font-medium ${
                                  tx.status === 'cancelled' ? 'text-rose-600' : 'text-emerald-600'
                                }`}
                              >
                                {tx.status}
                              </span>
                            </td>
                            {/* 3-Dot Row Menu on Party's Transaction Table */}
                            <td className="py-2.5 px-4 text-center" onClick={(e) => e.stopPropagation()}>
                              <button
                                type="button"
                                data-menu-trigger-for={tx.id}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (activeMenuTxId === tx.id) {
                                    setActiveMenuTxId(null);
                                    setTxMenuAnchorRect(null);
                                  } else {
                                    setActiveMenuTxId(tx.id);
                                    setTxMenuAnchorRect(e.currentTarget.getBoundingClientRect());
                                  }
                                }}
                                className={`p-1.5 rounded-lg border transition-colors cursor-pointer ${
                                  isRowMenuActive
                                    ? 'bg-rose-100 border-rose-300 text-rose-700'
                                    : 'border-slate-200 text-slate-500 hover:bg-slate-100 hover:text-slate-800'
                                }`}
                                title="Actions"
                              >
                                <MoreVertical className="w-3.5 h-3.5" />
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="py-12 text-center text-xs text-slate-400">
                  <FileText className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                  <span>No transactions recorded for this party yet.</span>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center p-8 text-center text-slate-400 text-xs">
            Select a party from the left list to view details and transactions.
          </div>
        )}
      </div>

      {/* Floating Row Menu for Party's Transaction Ledger */}
      <FloatingRowMenu
        isOpen={!!activeMenuTxId && !!txMenuAnchorRect}
        onClose={() => {
          setActiveMenuTxId(null);
          setTxMenuAnchorRect(null);
        }}
        anchorRect={txMenuAnchorRect}
        items={txMenuItems}
        minWidth={260}
      />

      {/* Floating Row Menu for Party Header */}
      <FloatingRowMenu
        isOpen={isPartyMenuOpen && !!partyMenuAnchorRect}
        onClose={() => {
          setIsPartyMenuOpen(false);
          setPartyMenuAnchorRect(null);
        }}
        anchorRect={partyMenuAnchorRect}
        items={partyMenuItems}
        minWidth={240}
      />

      {/* In-App Delete Confirmation Modal */}
      <ConfirmDeleteModal
        isOpen={deleteDialogConfig.isOpen}
        isLoading={isDeleting}
        onClose={() => setDeleteDialogConfig((prev) => ({ ...prev, isOpen: false }))}
        onConfirm={handleConfirmDelete}
        title={deleteDialogConfig.title}
        message={deleteDialogConfig.message}
        details={deleteDialogConfig.details}
        confirmButtonText="Delete"
      />

      {/* Add / Edit Party Modal */}
      <AddPartyModal
        isOpen={showAddModal}
        onClose={() => {
          setShowAddModal(false);
          setPartyToEdit(null);
        }}
        partyToEdit={partyToEdit}
        defaultGroup={groupFilter !== 'All' ? groupFilter : 'Customer'}
        onSaved={async (saved, saveAndNew) => {
          await loadParties();
          if (!saveAndNew) {
            selectParty(saved);
          }
        }}
      />

      {/* Payment Record Modal (Payment In / Payment Out) */}
      <PaymentRecordModal
        isOpen={showPaymentModal}
        onClose={() => {
          setShowPaymentModal(false);
          setTargetTxForPayment(null);
        }}
        initialParty={selectedParty}
        defaultType={paymentModalType}
        targetTransaction={targetTxForPayment}
        onSaved={async () => {
          if (selectedParty) await selectParty(selectedParty);
          await loadParties();
          if (onRefreshMetrics) onRefreshMetrics();
        }}
      />

      {/* Import / Export Modal */}
      <ImportExportModal
        isOpen={showImportExport}
        onClose={() => setShowImportExport(false)}
        target="parties"
        onImportCompleted={async () => {
          await loadParties();
          if (onRefreshMetrics) onRefreshMetrics();
        }}
      />

      {/* Party Statement Modal */}
      <PartyStatementModal
        isOpen={showStatementModal}
        onClose={() => setShowStatementModal(false)}
        party={selectedParty}
        businessProfile={businessProfile}
      />

      {/* Party Audit History Modal */}
      <RecordHistoryModal
        isOpen={showPartyHistoryModal}
        onClose={() => setShowPartyHistoryModal(false)}
        recordTitle={selectedParty?.name || 'Party'}
        recordSubtitle={`Party ID: ${selectedParty?.id} · GSTIN: ${selectedParty?.gstin || 'Unregistered'}`}
        record={selectedParty}
      />

      {/* Transaction History Modal */}
      <RecordHistoryModal
        isOpen={!!selectedTxForHistory}
        onClose={() => setSelectedTxForHistory(null)}
        recordTitle={selectedTxForHistory?.invoiceNo || 'Transaction'}
        recordSubtitle={`Party: ${selectedTxForHistory?.partyName} · Amount: ₹${selectedTxForHistory?.totalAmount.toFixed(2)}`}
        record={selectedTxForHistory}
      />
    </div>
  );
};
