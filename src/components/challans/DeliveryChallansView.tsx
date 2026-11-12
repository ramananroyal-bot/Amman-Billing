import React, { useState, useEffect } from 'react';
import {
  Truck,
  Search,
  Plus,
  ArrowRightCircle,
  MoreVertical,
  Edit,
  Trash2,
  Copy,
  Printer,
  Download,
  Ban,
  Clock,
  Filter,
} from 'lucide-react';
import { BusinessProfile, Transaction } from '../../types';
import {
  getTransactions,
  getTransaction,
  cancelTransaction,
  deleteTransaction,
  duplicateTransaction,
  convertChallanToSale,
  bulkConvertChallansToSale,
} from '../../db/indexedDB';
import { formatINR, formatDate } from '../../utils/formatters';
import { AddSaleModal } from '../modals/AddSaleModal';
import { FloatingRowMenu, FloatingMenuItem } from '../common/FloatingRowMenu';
import { ConfirmDeleteModal } from '../common/ConfirmDeleteModal';
import { useToast } from '../common/Toast';

interface DeliveryChallansViewProps {
  businessProfile: BusinessProfile | null;
  onNavigateToSales: () => void;
  onViewChallanPrint: (tx: Transaction) => void;
  onRefreshMetrics?: () => void;
}

export const DeliveryChallansView: React.FC<DeliveryChallansViewProps> = ({
  businessProfile,
  onNavigateToSales,
  onViewChallanPrint,
  onRefreshMetrics,
}) => {
  const { showToast } = useToast();
  const [challans, setChallans] = useState<Transaction[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'open' | 'converted' | 'cancelled'>('all');

  // Multi-select for bulk convert
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  // Create / Edit Challan Modal
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [challanToEdit, setChallanToEdit] = useState<Transaction | null>(null);

  // Floating row menu state
  const [activeMenuChallanId, setActiveMenuChallanId] = useState<string | null>(null);
  const [menuAnchorRect, setMenuAnchorRect] = useState<DOMRect | null>(null);

  // In-app Delete Confirmation Modal
  const [challanToDelete, setChallanToDelete] = useState<Transaction | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    loadChallans();
  }, []);

  const loadChallans = async () => {
    const list = await getTransactions();
    const challansOnly = list.filter((t) => t.type === 'delivery_challan');
    setChallans(challansOnly);
  };

  // Filter
  const filteredChallans = challans.filter((c) => {
    if (statusFilter === 'open' && (c.challanStatus !== 'open' || c.status === 'cancelled')) return false;
    if (statusFilter === 'converted' && c.challanStatus !== 'converted') return false;
    if (statusFilter === 'cancelled' && c.status !== 'cancelled') return false;

    const q = searchQuery.toLowerCase().trim();
    if (!q) return true;
    return (
      c.invoiceNo.toLowerCase().includes(q) ||
      c.partyName.toLowerCase().includes(q) ||
      (c.partyPhone && c.partyPhone.includes(q)) ||
      (c.vehicleNo && c.vehicleNo.toLowerCase().includes(q))
    );
  });

  // KPI Calculations
  const openChallans = challans.filter((c) => c.challanStatus === 'open' && c.status === 'active');
  const convertedChallans = challans.filter((c) => c.challanStatus === 'converted');
  const openValue = openChallans.reduce((acc, c) => acc + c.totalAmount, 0);

  // Row selection
  const handleToggleSelect = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleSelectAll = () => {
    if (selectedIds.length === filteredChallans.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredChallans.map((c) => c.id));
    }
  };

  // 3-Dot Actions (Always fetches fresh record from IndexedDB by id)
  const handleAction = async (actionType: string, challanId: string) => {
    setActiveMenuChallanId(null);
    setMenuAnchorRect(null);

    const tx = await getTransaction(challanId);
    if (!tx) {
      showToast('Delivery challan not found in database', 'error');
      return;
    }

    try {
      switch (actionType) {
        case 'view_edit':
          setChallanToEdit(tx);
          setShowCreateModal(true);
          break;

        case 'convert_sale':
          if (tx.challanStatus === 'converted') {
            showToast('This delivery challan has already been converted to a Sale Invoice', 'info');
            return;
          }
          if (tx.status === 'cancelled') {
            showToast('Cancelled challans cannot be converted to sale', 'error');
            return;
          }
          await convertChallanToSale(tx.id);
          await loadChallans();
          if (onRefreshMetrics) onRefreshMetrics();
          showToast(`Challan ${tx.invoiceNo} successfully converted to Sale Invoice. Stock decremented.`, 'success');
          onNavigateToSales();
          break;

        case 'duplicate':
          try {
            const copy = await duplicateTransaction(tx.id);
            await loadChallans();
            if (onRefreshMetrics) onRefreshMetrics();
            showToast(`Challan duplicated as ${copy.invoiceNo}.`, 'success');
          } catch {
            showToast('Failed to duplicate challan', 'error');
          }
          break;

        case 'print':
          onViewChallanPrint(tx);
          setTimeout(() => window.print(), 300);
          break;

        case 'open_pdf':
          onViewChallanPrint(tx);
          break;

        case 'cancel':
          if (tx.status === 'cancelled') {
            showToast('This challan is already cancelled', 'info');
            return;
          }
          await cancelTransaction(tx.id);
          await loadChallans();
          if (onRefreshMetrics) onRefreshMetrics();
          showToast(`Challan ${tx.invoiceNo} cancelled.`, 'success');
          break;

        case 'delete':
          if (tx.challanStatus === 'converted') {
            showToast('Converted challans cannot be deleted. Delete the linked sale first.', 'error');
            return;
          }
          setChallanToDelete(tx);
          setShowDeleteConfirm(true);
          break;

        default:
          showToast('Feature coming soon', 'info');
          break;
      }
    } catch (err) {
      showToast(`Action failed: ${(err as Error).message || 'Unknown error'}`, 'error');
    }
  };

  // Perform confirmed atomic delete
  const handleConfirmDelete = async () => {
    if (!challanToDelete) return;
    setIsDeleting(true);
    try {
      const res = await deleteTransaction(challanToDelete.id);
      if (!res.success) {
        showToast(res.error || 'Failed to delete delivery challan', 'error');
        return;
      }

      showToast('Delivery challan deleted', 'success');
      setChallans((prev) => prev.filter((c) => c.id !== challanToDelete.id));
      setShowDeleteConfirm(false);
      setChallanToDelete(null);

      await loadChallans();
      if (onRefreshMetrics) onRefreshMetrics();
    } catch (err) {
      showToast(`Delete failed: ${(err as Error).message || 'Unknown error'}`, 'error');
    } finally {
      setIsDeleting(false);
    }
  };

  // Bulk convert
  const handleBulkConvert = async () => {
    if (selectedIds.length === 0) return;
    try {
      const converted = await bulkConvertChallansToSale(selectedIds);
      await loadChallans();
      setSelectedIds([]);
      if (onRefreshMetrics) onRefreshMetrics();
      showToast(`Successfully converted ${converted.length} challans into Sale Invoices.`, 'success');
    } catch {
      showToast('Failed to bulk convert challans', 'error');
    }
  };

  // Active menu items (Exact requested order: View/Edit | Convert To Sale | Duplicate | Print | Open PDF | Cancel | Delete)
  const currentChallan = challans.find((c) => c.id === activeMenuChallanId);
  const floatingMenuItems: FloatingMenuItem[] = currentChallan
    ? [
        // Group 1
        {
          label: 'View / Edit',
          action: 'view_edit',
          dataId: currentChallan.id,
          dataType: 'delivery_challan',
          icon: <Edit className="w-3.5 h-3.5" />,
          onClick: () => handleAction('view_edit', currentChallan.id),
        },
        {
          label: 'Convert To Sale',
          action: 'convert_sale',
          dataId: currentChallan.id,
          dataType: 'delivery_challan',
          icon: <ArrowRightCircle className="w-3.5 h-3.5" />,
          disabled: currentChallan.challanStatus === 'converted' || currentChallan.status === 'cancelled',
          disabledReason: currentChallan.challanStatus === 'converted' ? 'Already Converted' : 'Cancelled',
          onClick: () => handleAction('convert_sale', currentChallan.id),
        },
        {
          label: 'Duplicate',
          action: 'duplicate',
          dataId: currentChallan.id,
          dataType: 'delivery_challan',
          icon: <Copy className="w-3.5 h-3.5" />,
          onClick: () => handleAction('duplicate', currentChallan.id),
        },

        // Group 2 (Print & PDF)
        {
          label: 'Print',
          action: 'print',
          dataId: currentChallan.id,
          dataType: 'delivery_challan',
          icon: <Printer className="w-3.5 h-3.5" />,
          dividerBefore: true,
          onClick: () => handleAction('print', currentChallan.id),
        },
        {
          label: 'Open PDF',
          action: 'open_pdf',
          dataId: currentChallan.id,
          dataType: 'delivery_challan',
          icon: <Download className="w-3.5 h-3.5" />,
          onClick: () => handleAction('open_pdf', currentChallan.id),
        },

        // Group 3 (Cancel)
        {
          label: 'Cancel',
          action: 'cancel',
          dataId: currentChallan.id,
          dataType: 'delivery_challan',
          icon: <Ban className="w-3.5 h-3.5" />,
          dividerBefore: true,
          disabled: currentChallan.status === 'cancelled',
          disabledReason: 'Already Cancelled',
          onClick: () => handleAction('cancel', currentChallan.id),
        },

        // Group 4 (Delete)
        {
          label: 'Delete',
          action: 'delete',
          dataId: currentChallan.id,
          dataType: 'delivery_challan',
          icon: <Trash2 className="w-3.5 h-3.5" />,
          danger: true,
          dividerBefore: true,
          onClick: () => handleAction('delete', currentChallan.id),
        },
      ]
    : [];

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto h-full overflow-y-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <Truck className="w-5 h-5 text-rose-600" />
            <span>Delivery Challans</span>
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Issue goods dispatch notes. Stock is decremented only when converted into a confirmed Sale Invoice.
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {selectedIds.length > 0 && (
            <button
              type="button"
              onClick={handleBulkConvert}
              className="px-3.5 py-2 text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg shadow-2xs flex items-center gap-1.5 cursor-pointer transition-colors"
            >
              <ArrowRightCircle className="w-4 h-4" />
              <span>Convert Selected ({selectedIds.length}) to Sale</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => {
              setChallanToEdit(null);
              setShowCreateModal(true);
            }}
            className="px-4 py-2 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 rounded-lg shadow-sm flex items-center gap-1.5 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Create Challan</span>
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-4 bg-white border border-slate-200 rounded-xl shadow-2xs">
          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
            Open Challans (In Transit)
          </span>
          <div className="text-xl font-bold text-amber-700 font-mono mt-1">
            {openChallans.length}
          </div>
          <span className="text-[11px] text-amber-600 mt-0.5 block">Goods sent, awaiting invoice</span>
        </div>

        <div className="p-4 bg-white border border-slate-200 rounded-xl shadow-2xs">
          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
            Open Challans Value
          </span>
          <div className="text-xl font-bold text-slate-900 font-mono mt-1">
            {formatINR(openValue)}
          </div>
          <span className="text-[11px] text-slate-400 mt-0.5 block">Pending stock conversion</span>
        </div>

        <div className="p-4 bg-white border border-slate-200 rounded-xl shadow-2xs">
          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
            Converted to Sales
          </span>
          <div className="text-xl font-bold text-emerald-700 font-mono mt-1">
            {convertedChallans.length}
          </div>
          <span className="text-[11px] text-emerald-600 mt-0.5 block">Invoiced & stock reduced</span>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="p-4 bg-white border border-slate-200 rounded-xl shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        {/* Status segment tabs */}
        <div className="flex items-center gap-1 p-0.5 bg-slate-100 rounded-lg text-xs">
          {(['all', 'open', 'converted', 'cancelled'] as const).map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setStatusFilter(tab)}
              className={`px-3 py-1.5 rounded-md font-medium transition-colors cursor-pointer capitalize ${
                statusFilter === tab
                  ? 'bg-white text-slate-900 shadow-2xs font-semibold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {tab === 'all' ? 'All Challans' : tab}
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="relative w-full sm:w-72">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search challan #, party, vehicle..."
            className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-slate-900"
          />
        </div>
      </div>

      {/* Challans Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
        {filteredChallans.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200 uppercase text-[11px]">
                  <th className="py-3 px-4 w-10 text-center">
                    <input
                      type="checkbox"
                      checked={
                        filteredChallans.length > 0 && selectedIds.length === filteredChallans.length
                      }
                      onChange={handleSelectAll}
                      className="rounded text-rose-600 focus:ring-rose-500 cursor-pointer"
                    />
                  </th>
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-4">Challan #</th>
                  <th className="py-3 px-4">Party Name</th>
                  <th className="py-3 px-4">Vehicle No</th>
                  <th className="py-3 px-4 text-right">Items Qty</th>
                  <th className="py-3 px-4 text-right">Value</th>
                  <th className="py-3 px-4 text-center">Status</th>
                  <th className="py-3 px-4 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredChallans.map((challan) => {
                  const isConverted = challan.challanStatus === 'converted';
                  const isCancelled = challan.status === 'cancelled';
                  const totalQty = challan.items.reduce((acc, i) => acc + (i.qty || 0), 0);
                  const isSelected = selectedIds.includes(challan.id);
                  const isMenuOpen = activeMenuChallanId === challan.id;

                  return (
                    <tr
                      key={challan.id}
                      onClick={() => onViewChallanPrint(challan)}
                      className={`transition-colors cursor-pointer ${
                        isMenuOpen
                          ? 'bg-rose-50/80 ring-1 ring-inset ring-rose-200'
                          : isSelected
                          ? 'bg-rose-50/50'
                          : isCancelled
                          ? 'bg-slate-50/50 opacity-60 hover:bg-slate-100/50'
                          : 'hover:bg-slate-50'
                      }`}
                    >
                      <td className="py-3 px-4 text-center" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={isSelected}
                          disabled={isConverted || isCancelled}
                          onChange={() => handleToggleSelect(challan.id)}
                          className="rounded text-rose-600 focus:ring-rose-500 cursor-pointer disabled:opacity-30"
                        />
                      </td>
                      <td className="py-3 px-4 font-mono text-slate-600">{formatDate(challan.date)}</td>
                      <td className="py-3 px-4 font-mono font-bold text-slate-900">{challan.invoiceNo}</td>
                      <td className="py-3 px-4">
                        <div className="font-semibold text-slate-900">{challan.partyName}</div>
                        {challan.partyPhone && (
                          <div className="text-[11px] text-slate-500 font-mono">{challan.partyPhone}</div>
                        )}
                      </td>
                      <td className="py-3 px-4 font-mono text-[11px] text-slate-600">
                        {challan.vehicleNo || 'Self / Courier'}
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-bold text-slate-800">
                        {totalQty}
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-bold text-slate-900 tabular-nums">
                        {formatINR(challan.totalAmount)}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold uppercase ${
                            isCancelled
                              ? 'bg-rose-100 text-rose-700'
                              : isConverted
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-amber-100 text-amber-800'
                          }`}
                        >
                          <Clock className="w-2.5 h-2.5" />
                          <span>{isCancelled ? 'Cancelled' : challan.challanStatus}</span>
                        </span>
                      </td>

                      {/* Actions */}
                      <td className="py-3 px-4 text-center" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-center gap-1.5">
                          {!isConverted && !isCancelled && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleAction('convert_sale', challan.id);
                              }}
                              title="Convert to Sale Invoice"
                              className="px-2 py-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-md transition-colors cursor-pointer"
                            >
                              Convert
                            </button>
                          )}

                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onViewChallanPrint(challan);
                              setTimeout(() => window.print(), 300);
                            }}
                            title="Quick Print"
                            className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                          >
                            <Printer className="w-3.5 h-3.5" />
                          </button>

                          <button
                            type="button"
                            data-menu-trigger-for={challan.id}
                            onClick={(e) => {
                              e.stopPropagation();
                              if (activeMenuChallanId === challan.id) {
                                setActiveMenuChallanId(null);
                                setMenuAnchorRect(null);
                              } else {
                                setActiveMenuChallanId(challan.id);
                                setMenuAnchorRect(e.currentTarget.getBoundingClientRect());
                              }
                            }}
                            title="More Actions"
                            className={`p-1.5 rounded-lg border transition-colors cursor-pointer ${
                              isMenuOpen
                                ? 'bg-rose-100 border-rose-300 text-rose-700'
                                : 'border-slate-200 text-slate-500 hover:bg-slate-100 hover:text-slate-800'
                            }`}
                          >
                            <MoreVertical className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="py-16 text-center text-xs text-slate-400">
            <Truck className="w-10 h-10 text-slate-300 mx-auto mb-2" />
            <p className="font-semibold text-slate-600">No delivery challans recorded</p>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Create goods delivery challans to track items in transit before invoicing.
            </p>
          </div>
        )}
      </div>

      {/* Floating 3-Dot Portal Menu */}
      <FloatingRowMenu
        isOpen={!!activeMenuChallanId && !!menuAnchorRect}
        onClose={() => {
          setActiveMenuChallanId(null);
          setMenuAnchorRect(null);
        }}
        anchorRect={menuAnchorRect}
        items={floatingMenuItems}
        minWidth={260}
      />

      {/* In-App Delete Confirmation Modal */}
      <ConfirmDeleteModal
        isOpen={showDeleteConfirm}
        isLoading={isDeleting}
        onClose={() => {
          setShowDeleteConfirm(false);
          setChallanToDelete(null);
        }}
        onConfirm={handleConfirmDelete}
        title="Delete Delivery Challan"
        message="Delete this delivery challan? This cannot be undone."
        details={
          challanToDelete
            ? `Challan: ${challanToDelete.invoiceNo} · Party: ${challanToDelete.partyName} · Amount: ₹${challanToDelete.totalAmount.toFixed(
                2
              )} · Date: ${formatDate(challanToDelete.date)}`
            : undefined
        }
        confirmButtonText="Delete Challan"
      />

      {/* Create / Edit Challan Modal */}
      {businessProfile && (
        <AddSaleModal
          isOpen={showCreateModal}
          onClose={() => {
            setShowCreateModal(false);
            setChallanToEdit(null);
          }}
          businessProfile={businessProfile}
          initialType="delivery_challan"
          transactionToEdit={challanToEdit}
          onSaved={async () => {
            await loadChallans();
            if (onRefreshMetrics) onRefreshMetrics();
          }}
        />
      )}
    </div>
  );
};
