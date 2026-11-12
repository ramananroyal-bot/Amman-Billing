import React, { useState, useEffect } from 'react';
import {
  Package,
  Search,
  Plus,
  SlidersHorizontal,
  MoreVertical,
  Edit,
  Trash2,
  History,
  FileText,
  ArrowDownRight,
  ArrowUpRight,
  Layers,
  Scale,
  Barcode,
  Download,
} from 'lucide-react';
import { Item, ItemType, StockAdjustment, Transaction } from '../../types';
import {
  getItems,
  getItem,
  deleteItem,
  getItemTransactions,
  getStockAdjustments,
} from '../../db/indexedDB';
import { formatINR, formatDate } from '../../utils/formatters';
import { AddItemModal } from './AddItemModal';
import { AdjustStockModal } from './AdjustStockModal';
import { BarcodeModal } from './BarcodeModal';
import { ImportExportModal } from '../common/ImportExportModal';
import { FloatingRowMenu, FloatingMenuItem } from '../common/FloatingRowMenu';
import { RecordHistoryModal } from '../common/RecordHistoryModal';
import { ConfirmDeleteModal } from '../common/ConfirmDeleteModal';
import { useToast } from '../common/Toast';
import { STANDARD_UNITS } from '../../types/indianStates';

interface ItemsViewProps {
  onViewTransaction: (tx: Transaction) => void;
  onRefreshMetrics?: () => void;
}

type MainTab = 'products' | 'services' | 'categories' | 'units';

export const ItemsView: React.FC<ItemsViewProps> = ({ onViewTransaction, onRefreshMetrics }) => {
  const { showToast } = useToast();
  const [activeTab, setActiveTab] = useState<MainTab>('products');
  const [items, setItems] = useState<Item[]>([]);
  const [selectedItem, setSelectedItem] = useState<Item | null>(null);
  const [itemTransactions, setItemTransactions] = useState<Transaction[]>([]);
  const [itemAdjustments, setItemAdjustments] = useState<StockAdjustment[]>([]);

  // Search & Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [stockFilter, setStockFilter] = useState<'all' | 'low' | 'out'>('all');

  // Modals
  const [showAddModal, setShowAddModal] = useState(false);
  const [itemToEdit, setItemToEdit] = useState<Item | null>(null);
  const [showAdjustModal, setShowAdjustModal] = useState(false);
  const [showBarcodeModal, setShowBarcodeModal] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [showImportExport, setShowImportExport] = useState(false);
  const [selectedItemForHistory, setSelectedItemForHistory] = useState<Item | null>(null);

  // Floating 3-dot row menu state
  const [activeMenuItemId, setActiveMenuItemId] = useState<string | null>(null);
  const [menuAnchorRect, setMenuAnchorRect] = useState<DOMRect | null>(null);

  // In-app Delete Confirmation Modal
  const [itemToDelete, setItemToDelete] = useState<Item | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    loadItems();
  }, []);

  const loadItems = async () => {
    const list = await getItems();
    list.sort((a, b) => a.name.localeCompare(b.name));
    setItems(list);

    if (list.length > 0) {
      if (!selectedItem || !list.some((i) => i.id === selectedItem.id)) {
        await selectItem(list[0]);
      } else {
        const fresh = await getItem(selectedItem.id);
        if (fresh) await selectItem(fresh);
      }
    } else {
      setSelectedItem(null);
      setItemTransactions([]);
      setItemAdjustments([]);
    }
  };

  const selectItem = async (item: Item) => {
    setSelectedItem(item);
    const txs = await getItemTransactions(item.id);
    setItemTransactions(txs);
    const adjs = await getStockAdjustments(item.id);
    setItemAdjustments(adjs);
  };

  // Filter items
  const currentTabType: ItemType = activeTab === 'services' ? 'service' : 'product';
  const filteredItems = items.filter((item) => {
    if (activeTab === 'products' && item.type !== 'product') return false;
    if (activeTab === 'services' && item.type !== 'service') return false;

    if (categoryFilter !== 'All' && item.category !== categoryFilter) return false;

    if (stockFilter === 'low' && item.minStockAlert > 0 && item.currentStock > item.minStockAlert) {
      return false;
    }
    if (stockFilter === 'out' && item.currentStock > 0) {
      return false;
    }

    const q = searchQuery.toLowerCase().trim();
    if (!q) return true;
    return (
      item.name.toLowerCase().includes(q) ||
      (item.hsn && item.hsn.toLowerCase().includes(q)) ||
      (item.itemCode && item.itemCode.toLowerCase().includes(q)) ||
      (item.category && item.category.toLowerCase().includes(q))
    );
  });

  // Extract unique categories
  const categoriesList = Array.from(new Set(items.map((i) => i.category || 'General')));

  // Actions for items (Exact requested order: View/Edit | Delete | View History)
  const handleItemAction = async (actionType: 'view_edit' | 'delete' | 'view_history', itemId: string) => {
    setActiveMenuItemId(null);
    setMenuAnchorRect(null);

    const item = await getItem(itemId);
    if (!item) {
      showToast('Item not found in database', 'error');
      return;
    }

    try {
      switch (actionType) {
        case 'view_edit':
          setItemToEdit(item);
          setShowAddModal(true);
          break;

        case 'delete': {
          // Check if transactions exist
          const txs = await getItemTransactions(item.id);
          if (txs.length > 0) {
            showToast('This item is used in transactions and cannot be deleted', 'error');
            return;
          }

          setItemToDelete(item);
          setShowDeleteConfirm(true);
          break;
        }

        case 'view_history':
          setSelectedItemForHistory(item);
          setShowHistoryModal(true);
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
    if (!itemToDelete) return;
    setIsDeleting(true);
    try {
      const res = await deleteItem(itemToDelete.id);
      if (!res.success) {
        showToast(res.error || 'This item is used in transactions and cannot be deleted', 'error');
        return;
      }

      showToast('Item deleted', 'success');
      setItems((prev) => prev.filter((i) => i.id !== itemToDelete.id));
      setShowDeleteConfirm(false);
      setItemToDelete(null);

      await loadItems();
      if (onRefreshMetrics) onRefreshMetrics();
    } catch (err) {
      showToast(`Delete failed: ${(err as Error).message || 'Unknown error'}`, 'error');
    } finally {
      setIsDeleting(false);
    }
  };

  // Build Floating Menu items for active item
  // Exact requested order: View/Edit | Delete | View History
  const currentMenuItem = items.find((i) => i.id === activeMenuItemId);
  const floatingMenuItems: FloatingMenuItem[] = currentMenuItem
    ? [
        {
          label: 'View / Edit',
          action: 'view_edit',
          dataId: currentMenuItem.id,
          dataType: 'item',
          icon: <Edit className="w-3.5 h-3.5" />,
          onClick: () => handleItemAction('view_edit', currentMenuItem.id),
        },
        {
          label: 'Delete',
          action: 'delete',
          dataId: currentMenuItem.id,
          dataType: 'item',
          icon: <Trash2 className="w-3.5 h-3.5" />,
          danger: true,
          dividerBefore: true,
          onClick: () => handleItemAction('delete', currentMenuItem.id),
        },
        {
          label: 'Print Barcode Label',
          action: 'barcode',
          dataId: currentMenuItem.id,
          dataType: 'item',
          icon: <Barcode className="w-3.5 h-3.5" />,
          onClick: () => {
            setSelectedItem(currentMenuItem);
            setShowBarcodeModal(true);
          },
        },
        {
          label: 'View History',
          action: 'view_history',
          dataId: currentMenuItem.id,
          dataType: 'item',
          icon: <History className="w-3.5 h-3.5" />,
          dividerBefore: true,
          onClick: () => handleItemAction('view_history', currentMenuItem.id),
        },
      ]
    : [];

  return (
    <div className="flex flex-col h-full w-full overflow-hidden bg-slate-50">
      {/* Top Main Navigation Tabs: Products | Services | Category | Units */}
      <div className="px-6 pt-3 border-b border-slate-200 bg-white flex items-center justify-between shrink-0">
        <div className="flex items-center gap-1 overflow-x-auto">
          <button
            type="button"
            onClick={() => setActiveTab('products')}
            className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold border-b-2 transition-colors cursor-pointer ${
              activeTab === 'products'
                ? 'border-rose-600 text-rose-600 bg-rose-50/50 rounded-t-md'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Package className="w-3.5 h-3.5" />
            <span>Products ({items.filter((i) => i.type === 'product').length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('services')}
            className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold border-b-2 transition-colors cursor-pointer ${
              activeTab === 'services'
                ? 'border-rose-600 text-rose-600 bg-rose-50/50 rounded-t-md'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Services ({items.filter((i) => i.type === 'service').length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('categories')}
            className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold border-b-2 transition-colors cursor-pointer ${
              activeTab === 'categories'
                ? 'border-rose-600 text-rose-600 bg-rose-50/50 rounded-t-md'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Category</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('units')}
            className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold border-b-2 transition-colors cursor-pointer ${
              activeTab === 'units'
                ? 'border-rose-600 text-rose-600 bg-rose-50/50 rounded-t-md'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Scale className="w-3.5 h-3.5" />
            <span>Units</span>
          </button>
        </div>

        <div className="flex items-center gap-2 mb-2">
          <button
            type="button"
            onClick={() => setShowImportExport(true)}
            title="Import or Export Items CSV"
            className="px-2.5 py-1.5 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-slate-300 rounded-lg shadow-2xs flex items-center gap-1 cursor-pointer"
          >
            <Download className="w-3.5 h-3.5 text-slate-500" />
            <span>Import/Export</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setItemToEdit(null);
              setShowAddModal(true);
            }}
            className="px-3 py-1.5 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 rounded-lg shadow-2xs flex items-center gap-1.5 cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Item</span>
          </button>
        </div>
      </div>

      {/* TAB CONTENT: Categories View */}
      {activeTab === 'categories' && (
        <div className="p-6 overflow-y-auto max-w-4xl mx-auto w-full space-y-4">
          <h3 className="text-sm font-bold text-slate-900">Categories Breakdown</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            {categoriesList.map((cat) => {
              const catItems = items.filter((i) => i.category === cat);
              const totalVal = catItems.reduce((acc, i) => acc + (i.stockValue || 0), 0);
              return (
                <div key={cat} className="p-4 bg-white border border-slate-200 rounded-xl shadow-2xs">
                  <div className="text-xs font-bold text-slate-900">{cat}</div>
                  <div className="mt-2 text-xs text-slate-500 space-y-0.5">
                    <div>{catItems.length} items</div>
                    <div className="font-mono font-semibold text-slate-800">
                      Total Value: {formatINR(totalVal)}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* TAB CONTENT: Units View */}
      {activeTab === 'units' && (
        <div className="p-6 overflow-y-auto max-w-4xl mx-auto w-full space-y-4">
          <h3 className="text-sm font-bold text-slate-900">Standard GST Units</h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {STANDARD_UNITS.map((u) => {
              const count = items.filter((i) => i.unit === u).length;
              return (
                <div key={u} className="p-3 bg-white border border-slate-200 rounded-lg shadow-2xs font-mono">
                  <div className="text-xs font-bold text-slate-900">{u}</div>
                  <div className="text-[11px] text-slate-400 mt-0.5 font-sans">
                    {count} items using this unit
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* TAB CONTENT: Products & Services Master-Detail */}
      {(activeTab === 'products' || activeTab === 'services') && (
        <div className="flex-1 flex overflow-hidden">
          {/* Left Column: Items List */}
          <div className="w-80 md:w-96 border-r border-slate-200 bg-white flex flex-col shrink-0">
            <div className="p-3.5 border-b border-slate-200 space-y-2.5">
              {/* Search */}
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search item, HSN, barcode..."
                  className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-slate-900"
                />
              </div>

              {/* Category & Stock filters */}
              <div className="flex items-center gap-2 text-xs">
                <select
                  value={categoryFilter}
                  onChange={(e) => setCategoryFilter(e.target.value)}
                  className="w-1/2 px-2 py-1 bg-slate-50 border border-slate-200 rounded-md text-[11px] cursor-pointer"
                >
                  <option value="All">All Categories</option>
                  {categoriesList.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>

                {activeTab === 'products' && (
                  <select
                    value={stockFilter}
                    onChange={(e) => setStockFilter(e.target.value as 'all' | 'low' | 'out')}
                    className="w-1/2 px-2 py-1 bg-slate-50 border border-slate-200 rounded-md text-[11px] cursor-pointer"
                  >
                    <option value="all">All Stock</option>
                    <option value="low">Low Stock Alert</option>
                    <option value="out">Out of Stock</option>
                  </select>
                )}
              </div>
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
              {filteredItems.length > 0 ? (
                filteredItems.map((item) => {
                  const isSelected = selectedItem?.id === item.id;
                  const isMenuActive = activeMenuItemId === item.id;
                  const isLowStock =
                    item.type === 'product' &&
                    item.minStockAlert > 0 &&
                    item.currentStock <= item.minStockAlert;

                  return (
                    <div
                      key={item.id}
                      onClick={() => selectItem(item)}
                      className={`p-3.5 transition-colors cursor-pointer flex items-center justify-between group ${
                        isMenuActive
                          ? 'bg-rose-50/80 ring-1 ring-inset ring-rose-200'
                          : isSelected
                          ? 'bg-rose-50/60 border-l-3 border-rose-600'
                          : 'hover:bg-slate-50'
                      }`}
                    >
                      <div className="min-w-0 flex-1 pr-2">
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-bold text-slate-900 truncate">{item.name}</span>
                          {isLowStock && (
                            <span className="w-1.5 h-1.5 rounded-full bg-rose-500 shrink-0" title="Low Stock" />
                          )}
                        </div>
                        <div className="text-[11px] text-slate-500 font-mono mt-0.5 truncate">
                          {item.hsn ? `HSN: ${item.hsn}` : item.category || 'General'}
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <div className="text-right font-mono">
                          <div className="text-xs font-bold text-slate-900 tabular-nums">
                            {formatINR(item.salePrice)}
                          </div>
                          {item.type === 'product' && (
                            <div
                              className={`text-[10px] ${
                                item.currentStock <= 0
                                  ? 'text-rose-600 font-semibold'
                                  : isLowStock
                                  ? 'text-amber-600 font-semibold'
                                  : 'text-slate-500'
                              }`}
                            >
                              Stock: {item.currentStock} {item.unit}
                            </div>
                          )}
                        </div>

                        {/* 3-Dot row action trigger */}
                        <button
                          type="button"
                          data-menu-trigger-for={item.id}
                          onClick={(e) => {
                            e.stopPropagation();
                            if (activeMenuItemId === item.id) {
                              setActiveMenuItemId(null);
                              setMenuAnchorRect(null);
                            } else {
                              setActiveMenuItemId(item.id);
                              setMenuAnchorRect(e.currentTarget.getBoundingClientRect());
                            }
                          }}
                          className={`p-1 rounded-md border transition-colors cursor-pointer ${
                            isMenuActive
                              ? 'bg-rose-100 border-rose-300 text-rose-700'
                              : 'opacity-0 group-hover:opacity-100 border-slate-200 text-slate-400 hover:text-slate-800 hover:bg-slate-100'
                          }`}
                          title="Item Actions"
                        >
                          <MoreVertical className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="p-8 text-center">
                  <div className="w-10 h-10 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mx-auto mb-2">
                    <Package className="w-5 h-5" />
                  </div>
                  <p className="text-xs text-slate-500">No {activeTab} found</p>
                  <button
                    type="button"
                    onClick={() => {
                      setItemToEdit(null);
                      setShowAddModal(true);
                    }}
                    className="mt-2 text-xs font-semibold text-rose-600 hover:underline cursor-pointer"
                  >
                    + Add New Item
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Right Column: Item Detail & Transactions */}
          <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-6 max-w-5xl">
            {selectedItem ? (
              <>
                {/* Header Card */}
                <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-2xs">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
                    <div className="flex items-start gap-3">
                      {selectedItem.imageUrl ? (
                        <div className="w-14 h-14 rounded-lg border border-slate-200 p-0.5 overflow-hidden shrink-0">
                          <img src={selectedItem.imageUrl} alt={selectedItem.name} className="w-full h-full object-cover" />
                        </div>
                      ) : (
                        <div className="w-12 h-12 rounded-lg bg-slate-900 text-white flex items-center justify-center shrink-0">
                          <Package className="w-6 h-6" />
                        </div>
                      )}

                      <div>
                        <div className="flex items-center gap-2">
                          <h2 className="text-base font-bold text-slate-900">{selectedItem.name}</h2>
                          <span className="px-2 py-0.5 text-[10px] font-semibold bg-slate-100 text-slate-700 rounded-md">
                            {selectedItem.category}
                          </span>
                          <span className="px-2 py-0.5 text-[10px] font-medium bg-slate-100 text-slate-600 rounded-md capitalize">
                            {selectedItem.type}
                          </span>
                        </div>
                        <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500 font-mono">
                          {selectedItem.hsn && <span>HSN: {selectedItem.hsn}</span>}
                          {selectedItem.itemCode && <span>Code: {selectedItem.itemCode}</span>}
                          <span>Tax: {selectedItem.taxRate}% GST</span>
                          <span>Unit: {selectedItem.unit}</span>
                        </div>
                      </div>
                    </div>

                    {/* Quick Buttons & 3-Dot Action */}
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => setShowBarcodeModal(true)}
                        className="px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-100 border border-slate-300 rounded-lg flex items-center gap-1.5 cursor-pointer shadow-2xs"
                        title="Print Barcode Labels"
                      >
                        <Barcode className="w-3.5 h-3.5" />
                        <span>Barcode Label</span>
                      </button>

                      {selectedItem.type === 'product' && (
                        <button
                          type="button"
                          onClick={() => setShowAdjustModal(true)}
                          className="px-3 py-1.5 text-xs font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-lg flex items-center gap-1.5 cursor-pointer shadow-2xs"
                        >
                          <SlidersHorizontal className="w-3.5 h-3.5" />
                          <span>Adjust Item</span>
                        </button>
                      )}

                      {/* Header 3-Dot Button */}
                      <button
                        type="button"
                        data-menu-trigger-for={selectedItem.id}
                        onClick={(e) => {
                          e.stopPropagation();
                          if (activeMenuItemId === selectedItem.id) {
                            setActiveMenuItemId(null);
                            setMenuAnchorRect(null);
                          } else {
                            setActiveMenuItemId(selectedItem.id);
                            setMenuAnchorRect(e.currentTarget.getBoundingClientRect());
                          }
                        }}
                        className={`p-2 rounded-lg border transition-colors cursor-pointer ${
                          activeMenuItemId === selectedItem.id
                            ? 'bg-rose-100 border-rose-300 text-rose-700'
                            : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100 border-slate-200'
                        }`}
                        title="Item Actions"
                      >
                        <MoreVertical className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* 4 Metrics Cards */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-4">
                    <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                      <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Sale Price</span>
                      <div className="text-base font-bold text-slate-900 font-mono mt-0.5">
                        {formatINR(selectedItem.salePrice)}
                      </div>
                      <span className="text-[10px] text-slate-400 capitalize">
                        {selectedItem.salePriceTaxType.replace('_', ' ')}
                      </span>
                    </div>

                    <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                      <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Purchase Price</span>
                      <div className="text-base font-bold text-slate-900 font-mono mt-0.5">
                        {formatINR(selectedItem.purchasePrice)}
                      </div>
                      <span className="text-[10px] text-slate-400 capitalize">
                        {selectedItem.purchasePriceTaxType.replace('_', ' ')}
                      </span>
                    </div>

                    {selectedItem.type === 'product' ? (
                      <>
                        <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Stock Quantity</span>
                          <div className="text-base font-bold text-slate-900 font-mono mt-0.5">
                            {selectedItem.currentStock} {selectedItem.unit}
                          </div>
                          {selectedItem.minStockAlert > 0 && selectedItem.currentStock <= selectedItem.minStockAlert && (
                            <span className="text-[10px] text-rose-600 font-semibold">Low Stock Alert</span>
                          )}
                        </div>

                        <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Stock Value</span>
                          <div className="text-base font-bold text-rose-600 font-mono mt-0.5">
                            {formatINR(selectedItem.stockValue || 0)}
                          </div>
                          <span className="text-[10px] text-slate-400">At Purchase Price</span>
                        </div>
                      </>
                    ) : (
                      <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 col-span-2">
                        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Service Category</span>
                        <div className="text-xs text-slate-700 mt-1">Non-inventory service item</div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Item Transactions Table */}
                <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
                  <div className="px-5 py-4 border-b border-slate-200">
                    <h3 className="text-sm font-bold text-slate-900">Transactions for this Item</h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      All sales and purchases containing &quot;{selectedItem.name}&quot;
                    </p>
                  </div>

                  {itemTransactions.length > 0 ? (
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs border-collapse">
                        <thead>
                          <tr className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200 uppercase text-[11px]">
                            <th className="py-2.5 px-4">Date</th>
                            <th className="py-2.5 px-4">Type</th>
                            <th className="py-2.5 px-4">Invoice #</th>
                            <th className="py-2.5 px-4">Party Name</th>
                            <th className="py-2.5 px-4 text-right">Qty</th>
                            <th className="py-2.5 px-4 text-right">Price / Unit</th>
                            <th className="py-2.5 px-4 text-right">Total Amount</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {itemTransactions.map((tx) => {
                            const lineItem = tx.items.find((i) => i.itemId === selectedItem.id);
                            const isSale = tx.type === 'sale_invoice';

                            return (
                              <tr
                                key={tx.id}
                                onClick={() => onViewTransaction(tx)}
                                className="hover:bg-slate-50 cursor-pointer"
                              >
                                <td className="py-2.5 px-4 font-mono text-slate-600">{formatDate(tx.date)}</td>
                                <td className="py-2.5 px-4 whitespace-nowrap">
                                  <span
                                    className={`font-medium flex items-center gap-1 ${
                                      isSale ? 'text-rose-700' : 'text-blue-700'
                                    }`}
                                  >
                                    {isSale ? (
                                      <ArrowDownRight className="w-3.5 h-3.5" />
                                    ) : (
                                      <ArrowUpRight className="w-3.5 h-3.5" />
                                    )}
                                    <span>{tx.type.replace('_', ' ')}</span>
                                  </span>
                                </td>
                                <td className="py-2.5 px-4 font-mono font-semibold text-slate-900">{tx.invoiceNo}</td>
                                <td className="py-2.5 px-4 text-slate-800">{tx.partyName}</td>
                                <td className="py-2.5 px-4 text-right font-mono font-bold tabular-nums">
                                  {isSale ? `-${lineItem?.qty || 0}` : `+${lineItem?.qty || 0}`} {lineItem?.unit}
                                </td>
                                <td className="py-2.5 px-4 text-right font-mono tabular-nums">
                                  {formatINR(lineItem?.priceUnit || 0)}
                                </td>
                                <td className="py-2.5 px-4 text-right font-mono font-bold text-slate-900 tabular-nums">
                                  {formatINR(lineItem?.totalAmount || 0)}
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
                      <span>No transactions recorded for this item yet.</span>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center p-8 text-center text-slate-400 text-xs">
                Select an item from the left list to view details and history.
              </div>
            )}
          </div>
        </div>
      )}

      {/* Floating 3-Dot Row Menu for Items */}
      <FloatingRowMenu
        isOpen={!!activeMenuItemId && !!menuAnchorRect}
        onClose={() => {
          setActiveMenuItemId(null);
          setMenuAnchorRect(null);
        }}
        anchorRect={menuAnchorRect}
        items={floatingMenuItems}
        minWidth={200}
      />

      {/* In-App Delete Confirmation Modal */}
      <ConfirmDeleteModal
        isOpen={showDeleteConfirm}
        isLoading={isDeleting}
        onClose={() => {
          setShowDeleteConfirm(false);
          setItemToDelete(null);
        }}
        onConfirm={handleConfirmDelete}
        title="Delete Item"
        message={`Delete "${itemToDelete?.name}"? This cannot be undone.`}
        details={
          itemToDelete
            ? `Item: ${itemToDelete.name} · Code: ${itemToDelete.itemCode || 'N/A'} · HSN: ${itemToDelete.hsn || 'N/A'} · Current Stock: ${itemToDelete.currentStock} ${itemToDelete.unit}`
            : undefined
        }
        confirmButtonText="Delete Item"
      />

      {/* Add / Edit Item Modal */}
      <AddItemModal
        isOpen={showAddModal}
        onClose={() => {
          setShowAddModal(false);
          setItemToEdit(null);
        }}
        itemToEdit={itemToEdit}
        defaultType={currentTabType}
        onSaved={async (saved, saveAndNew) => {
          await loadItems();
          if (onRefreshMetrics) onRefreshMetrics();
          if (!saveAndNew) {
            selectItem(saved);
          }
        }}
      />

      {/* Adjust Stock Modal */}
      <AdjustStockModal
        isOpen={showAdjustModal}
        onClose={() => setShowAdjustModal(false)}
        item={selectedItem}
        onAdjusted={async () => {
          await loadItems();
          if (onRefreshMetrics) onRefreshMetrics();
        }}
      />

      {/* Item History Modal */}
      <RecordHistoryModal
        isOpen={showHistoryModal && !!selectedItemForHistory}
        onClose={() => {
          setShowHistoryModal(false);
          setSelectedItemForHistory(null);
        }}
        recordTitle={selectedItemForHistory?.name || 'Item History'}
        recordSubtitle={`Code: ${selectedItemForHistory?.itemCode || 'N/A'} · HSN: ${selectedItemForHistory?.hsn || 'N/A'} · Unit: ${selectedItemForHistory?.unit}`}
        record={selectedItemForHistory}
      />

      {/* Barcode Label Generator Modal */}
      <BarcodeModal
        isOpen={showBarcodeModal && !!selectedItem}
        onClose={() => setShowBarcodeModal(false)}
        item={selectedItem}
      />

      {/* Import / Export Modal */}
      <ImportExportModal
        isOpen={showImportExport}
        onClose={() => setShowImportExport(false)}
        target="items"
        onImportCompleted={async () => {
          await loadItems();
          if (onRefreshMetrics) onRefreshMetrics();
        }}
      />
    </div>
  );
};
