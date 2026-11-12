import React, { useState } from 'react';
import { X, Package } from 'lucide-react';
import { GST_RATES, STANDARD_UNITS } from '../../types/indianStates';
import { saveItem } from '../../db/indexedDB';
import { Item, ItemType, PriceTaxType } from '../../types';

interface QuickAddItemModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved: (item: Item) => void;
}

export const QuickAddItemModal: React.FC<QuickAddItemModalProps> = ({
  isOpen,
  onClose,
  onSaved,
}) => {
  const [name, setName] = useState('');
  const [type, setType] = useState<ItemType>('product');
  const [hsn, setHsn] = useState('');
  const [unit, setUnit] = useState('PCS');
  const [category, setCategory] = useState('General');
  const [itemCode, setItemCode] = useState('');
  const [taxRate, setTaxRate] = useState<number>(18);
  const [salePrice, setSalePrice] = useState('0');
  const [saleTaxType, setSaleTaxType] = useState<PriceTaxType>('without_tax');
  const [purchasePrice, setPurchasePrice] = useState('0');
  const [purchaseTaxType, setPurchaseTaxType] = useState<PriceTaxType>('without_tax');
  const [openingStock, setOpeningStock] = useState('0');
  const [minStock, setMinStock] = useState('0');
  const [location, setLocation] = useState('Main Godown');

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSaving, setIsSaving] = useState(false);

  if (!isOpen) return null;

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setErrors({ name: 'Item name is required' });
      return;
    }

    setIsSaving(true);
    try {
      const saved = await saveItem({
        name: name.trim(),
        type,
        hsn: hsn.trim(),
        unit,
        category: category.trim() || 'General',
        itemCode: itemCode.trim(),
        taxRate: Number(taxRate) || 0,
        salePrice: parseFloat(salePrice) || 0,
        salePriceTaxType: saleTaxType,
        purchasePrice: parseFloat(purchasePrice) || 0,
        purchasePriceTaxType: purchaseTaxType,
        openingStockQty: parseFloat(openingStock) || 0,
        minStockAlert: parseFloat(minStock) || 0,
        location: location.trim(),
      });

      onSaved(saved);
      onClose();
    } catch {
      setErrors({ form: 'Failed to create item' });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="w-full max-w-lg bg-white rounded-xl shadow-2xl border border-slate-200 overflow-hidden my-6">
        <div className="flex items-center justify-between px-5 py-3.5 bg-slate-900 text-white">
          <div className="flex items-center gap-2">
            <Package className="w-4 h-4 text-rose-500" />
            <h3 className="text-sm font-bold">Add New Item</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-white cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSave} className="p-5 space-y-4 max-h-[80vh] overflow-y-auto">
          {errors.form && (
            <div className="p-2.5 text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded-lg">
              {errors.form}
            </div>
          )}

          {/* Type Toggle: Product vs Service */}
          <div className="flex items-center gap-2 p-1 bg-slate-100 rounded-lg w-fit">
            <button
              type="button"
              onClick={() => setType('product')}
              className={`px-3 py-1 text-xs font-semibold rounded-md transition-colors cursor-pointer ${
                type === 'product' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Product
            </button>
            <button
              type="button"
              onClick={() => setType('service')}
              className={`px-3 py-1 text-xs font-semibold rounded-md transition-colors cursor-pointer ${
                type === 'service' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Service
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-slate-700 mb-1">Item Name *</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Cotton Shirt or AC Repair Service"
                className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-slate-900"
              />
              {errors.name && <p className="mt-1 text-[11px] text-rose-600">{errors.name}</p>}
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">HSN / SAC Code</label>
              <input
                type="text"
                value={hsn}
                onChange={(e) => setHsn(e.target.value)}
                placeholder="e.g. 6205 or 9987"
                className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-slate-900 font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Unit</label>
              <select
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-slate-900 cursor-pointer"
              >
                {STANDARD_UNITS.map((u) => (
                  <option key={u} value={u}>
                    {u}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Sale Price (₹)</label>
              <input
                type="number"
                step="0.01"
                value={salePrice}
                onChange={(e) => setSalePrice(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-slate-900 font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Sale Tax Type</label>
              <select
                value={saleTaxType}
                onChange={(e) => setSaleTaxType(e.target.value as PriceTaxType)}
                className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-slate-900 cursor-pointer"
              >
                <option value="without_tax">Without Tax (Exclusive)</option>
                <option value="with_tax">With Tax (Inclusive)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Purchase Price (₹)</label>
              <input
                type="number"
                step="0.01"
                value={purchasePrice}
                onChange={(e) => setPurchasePrice(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-slate-900 font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">GST Tax Rate</label>
              <select
                value={taxRate}
                onChange={(e) => setTaxRate(Number(e.target.value))}
                className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-slate-900 cursor-pointer"
              >
                {GST_RATES.map((g) => (
                  <option key={g.rate} value={g.rate}>
                    {g.label}
                  </option>
                ))}
              </select>
            </div>

            {type === 'product' && (
              <>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Opening Stock Qty</label>
                  <input
                    type="number"
                    value={openingStock}
                    onChange={(e) => setOpeningStock(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-slate-900 font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Low Stock Alert Qty</label>
                  <input
                    type="number"
                    value={minStock}
                    onChange={(e) => setMinStock(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-slate-900 font-mono"
                  />
                </div>
              </>
            )}
          </div>

          <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="px-4 py-1.5 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 rounded-lg shadow-2xs transition-colors cursor-pointer"
            >
              {isSaving ? 'Saving...' : 'Save Item'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
