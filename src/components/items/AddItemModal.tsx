import React, { useState, useEffect } from 'react';
import { X, Package, DollarSign, Archive, Factory, Upload } from 'lucide-react';
import { Item, ItemType, PriceTaxType } from '../../types';
import { GST_RATES, STANDARD_UNITS } from '../../types/indianStates';
import { saveItem } from '../../db/indexedDB';
import { ConfirmDiscardModal } from '../common/ConfirmDiscardModal';

interface AddItemModalProps {
  isOpen: boolean;
  onClose: () => void;
  itemToEdit?: Item | null;
  onSaved: (item: Item, isSaveAndNew?: boolean) => void;
  defaultType?: ItemType;
}

type ItemTab = 'pricing' | 'stock' | 'manufacturing';

export const AddItemModal: React.FC<AddItemModalProps> = ({
  isOpen,
  onClose,
  itemToEdit,
  onSaved,
  defaultType = 'product',
}) => {
  const [activeTab, setActiveTab] = useState<ItemTab>('pricing');

  // Form states
  const [name, setName] = useState('');
  const [type, setType] = useState<ItemType>(defaultType);
  const [hsn, setHsn] = useState('');
  const [unit, setUnit] = useState('PCS');
  const [category, setCategory] = useState('General');
  const [itemCode, setItemCode] = useState('');
  const [barcode, setBarcode] = useState('');
  const [taxRate, setTaxRate] = useState<number>(18);
  const [salePrice, setSalePrice] = useState('0');
  const [saleTaxType, setSaleTaxType] = useState<PriceTaxType>('without_tax');
  const [wholesalePrice, setWholesalePrice] = useState('0');
  const [purchasePrice, setPurchasePrice] = useState('0');
  const [purchaseTaxType, setPurchaseTaxType] = useState<PriceTaxType>('without_tax');

  // Stock Tab
  const [openingStock, setOpeningStock] = useState('0');
  const [openingStockDate, setOpeningStockDate] = useState(new Date().toISOString().split('T')[0]);
  const [minStock, setMinStock] = useState('0');
  const [location, setLocation] = useState('Main Godown');

  // Manufacturing Tab
  const [manufacturer, setManufacturer] = useState('');
  const [batchNumber, setBatchNumber] = useState('');
  const [serialNumber, setSerialNumber] = useState('');
  const [expiryDate, setExpiryDate] = useState('');

  // Image
  const [imageUrl, setImageUrl] = useState('');

  // Dirty check & Discard confirmation
  const [isDirty, setIsDirty] = useState(false);
  const [showDiscardConfirm, setShowDiscardConfirm] = useState(false);

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (isOpen) {
      if (itemToEdit) {
        setName(itemToEdit.name);
        setType(itemToEdit.type || 'product');
        setHsn(itemToEdit.hsn || '');
        setUnit(itemToEdit.unit || 'PCS');
        setCategory(itemToEdit.category || 'General');
        setItemCode(itemToEdit.itemCode || '');
        setBarcode(itemToEdit.barcode || '');
        setTaxRate(itemToEdit.taxRate || 0);
        setSalePrice(String(itemToEdit.salePrice || 0));
        setSaleTaxType(itemToEdit.salePriceTaxType || 'without_tax');
        setWholesalePrice(String(itemToEdit.wholesalePrice || 0));
        setPurchasePrice(String(itemToEdit.purchasePrice || 0));
        setPurchaseTaxType(itemToEdit.purchasePriceTaxType || 'without_tax');
        setOpeningStock(String(itemToEdit.openingStockQty || 0));
        setOpeningStockDate(itemToEdit.openingStockDate || new Date().toISOString().split('T')[0]);
        setMinStock(String(itemToEdit.minStockAlert || 0));
        setLocation(itemToEdit.location || 'Main Godown');
        setManufacturer(itemToEdit.manufacturer || '');
        setBatchNumber(itemToEdit.batchNumber || '');
        setSerialNumber(itemToEdit.serialNumber || '');
        setExpiryDate(itemToEdit.expiryDate || '');
        setImageUrl(itemToEdit.imageUrl || '');
      } else {
        resetForm();
      }
      setIsDirty(false);
      setActiveTab('pricing');
    }
  }, [isOpen, itemToEdit, defaultType]);

  const resetForm = () => {
    setName('');
    setType(defaultType);
    setHsn('');
    setUnit('PCS');
    setCategory('General');
    setItemCode('');
    setBarcode('');
    setTaxRate(18);
    setSalePrice('0');
    setSaleTaxType('without_tax');
    setWholesalePrice('0');
    setPurchasePrice('0');
    setPurchaseTaxType('without_tax');
    setOpeningStock('0');
    setOpeningStockDate(new Date().toISOString().split('T')[0]);
    setMinStock('0');
    setLocation('Main Godown');
    setManufacturer('');
    setBatchNumber('');
    setSerialNumber('');
    setExpiryDate('');
    setImageUrl('');
    setErrors({});
    setIsDirty(false);
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) {
        setErrors((prev) => ({ ...prev, image: 'Image must be under 2MB' }));
        return;
      }
      const reader = new FileReader();
      reader.onload = (event) => {
        setImageUrl(event.target?.result as string);
        setIsDirty(true);
      };
      reader.readAsDataURL(file);
    }
  };

  const validate = () => {
    const errs: Record<string, string> = {};
    if (!name.trim()) errs.name = 'Item name is required';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSave = async (saveAndNew: boolean = false) => {
    if (!validate()) {
      setActiveTab('pricing');
      return;
    }

    setIsSaving(true);
    try {
      const saved = await saveItem({
        id: itemToEdit?.id,
        name: name.trim(),
        type,
        hsn: hsn.trim(),
        unit: unit.toUpperCase(),
        category: category.trim() || 'General',
        itemCode: itemCode.trim(),
        barcode: barcode.trim(),
        taxRate: Number(taxRate) || 0,
        salePrice: parseFloat(salePrice) || 0,
        salePriceTaxType: saleTaxType,
        wholesalePrice: parseFloat(wholesalePrice) || 0,
        purchasePrice: parseFloat(purchasePrice) || 0,
        purchasePriceTaxType: purchaseTaxType,
        openingStockQty: parseFloat(openingStock) || 0,
        openingStockDate,
        minStockAlert: parseFloat(minStock) || 0,
        location: location.trim(),
        manufacturer: manufacturer.trim(),
        batchNumber: batchNumber.trim(),
        serialNumber: serialNumber.trim(),
        expiryDate,
        imageUrl,
      });

      setIsDirty(false);
      onSaved(saved, saveAndNew);

      if (saveAndNew) {
        resetForm();
        setActiveTab('pricing');
      } else {
        onClose();
      }
    } catch {
      setErrors({ form: 'Failed to save item. Please try again.' });
    } finally {
      setIsSaving(false);
    }
  };

  // In-modal Keyboard shortcuts (Ctrl+Enter or Ctrl+S to Save, Esc to Close)
  useEffect(() => {
    if (!isOpen) return;
    const handleModalKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && (e.key === 'Enter' || e.key === 's' || e.key === 'S')) {
        e.preventDefault();
        handleSave(false);
      } else if (e.key === 'Escape') {
        e.preventDefault();
        handleAttemptClose();
      }
    };
    window.addEventListener('keydown', handleModalKeyDown);
    return () => window.removeEventListener('keydown', handleModalKeyDown);
  }, [isOpen, name, salePrice, purchasePrice, taxRate, openingStock, barcode, serialNumber, batchNumber, isDirty]);

  const handleAttemptClose = () => {
    if (isDirty) {
      setShowDiscardConfirm(true);
    } else {
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <>
      <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-3 sm:p-5 overflow-y-auto">
        <div className="w-full max-w-2xl bg-white rounded-xl shadow-2xl border border-slate-200 overflow-hidden my-4 flex flex-col max-h-[92vh]">
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 bg-slate-900 text-white shrink-0">
            <div className="flex items-center gap-2.5">
              <Package className="w-5 h-5 text-rose-500" />
              <h2 className="text-sm font-bold tracking-tight">
                {itemToEdit ? `Edit Item - ${itemToEdit.name}` : `Add Item (${type === 'product' ? 'Product' : 'Service'})`}
              </h2>
            </div>
            <button
              type="button"
              onClick={handleAttemptClose}
              className="text-slate-400 hover:text-white transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Tab Strip */}
          <div className="flex items-center gap-1 px-6 pt-3 border-b border-slate-200 bg-slate-50 shrink-0">
            <button
              type="button"
              onClick={() => setActiveTab('pricing')}
              className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold border-b-2 transition-colors cursor-pointer ${
                activeTab === 'pricing'
                  ? 'border-rose-600 text-rose-600 bg-white rounded-t-md shadow-2xs'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <DollarSign className="w-3.5 h-3.5" />
              <span>Pricing & Tax</span>
            </button>

            {type === 'product' && (
              <button
                type="button"
                onClick={() => setActiveTab('stock')}
                className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold border-b-2 transition-colors cursor-pointer ${
                  activeTab === 'stock'
                    ? 'border-rose-600 text-rose-600 bg-white rounded-t-md shadow-2xs'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                <Archive className="w-3.5 h-3.5" />
                <span>Stock</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => setActiveTab('manufacturing')}
              className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold border-b-2 transition-colors cursor-pointer ${
                activeTab === 'manufacturing'
                  ? 'border-rose-600 text-rose-600 bg-white rounded-t-md shadow-2xs'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <Factory className="w-3.5 h-3.5" />
              <span>Manufacturing & Extra</span>
            </button>
          </div>

          {/* Form Content */}
          <div className="p-6 overflow-y-auto flex-1 space-y-4">
            {errors.form && (
              <div className="p-3 text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded-lg">
                {errors.form}
              </div>
            )}

            {/* TAB 1: Pricing */}
            {activeTab === 'pricing' && (
              <div className="space-y-4">
                {/* Product vs Service Toggle */}
                <div className="flex items-center gap-2 p-1 bg-slate-100 rounded-lg w-fit">
                  <button
                    type="button"
                    onClick={() => {
                      setIsDirty(true);
                      setType('product');
                    }}
                    className={`px-3 py-1 text-xs font-semibold rounded-md transition-colors cursor-pointer ${
                      type === 'product' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Product
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setIsDirty(true);
                      setType('service');
                    }}
                    className={`px-3 py-1 text-xs font-semibold rounded-md transition-colors cursor-pointer ${
                      type === 'service' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Service
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Item Name */}
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Item Name <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => {
                        setIsDirty(true);
                        setName(e.target.value);
                      }}
                      placeholder="e.g. Basmati Rice 10kg or Laptop Repair"
                      className={`w-full px-3 py-2 text-xs bg-slate-50 border rounded-lg focus:outline-hidden focus:ring-1 focus:ring-slate-900 ${
                        errors.name ? 'border-rose-400 bg-rose-50/50' : 'border-slate-300'
                      }`}
                    />
                    {errors.name && <p className="mt-1 text-[11px] text-rose-600">{errors.name}</p>}
                  </div>

                  {/* HSN Code */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">HSN / SAC Code</label>
                    <input
                      type="text"
                      value={hsn}
                      onChange={(e) => {
                        setIsDirty(true);
                        setHsn(e.target.value);
                      }}
                      placeholder="e.g. 1006 or 9987"
                      className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg font-mono"
                    />
                  </div>

                  {/* Unit */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Unit of Measurement</label>
                    <select
                      value={unit}
                      onChange={(e) => {
                        setIsDirty(true);
                        setUnit(e.target.value);
                      }}
                      className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg cursor-pointer"
                    >
                      {STANDARD_UNITS.map((u) => (
                        <option key={u} value={u}>
                          {u}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Category */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Category</label>
                    <input
                      type="text"
                      value={category}
                      onChange={(e) => {
                        setIsDirty(true);
                        setCategory(e.target.value);
                      }}
                      placeholder="e.g. Electronics, Grocery, Apparel"
                      className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg"
                    />
                  </div>

                  {/* Item Code */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Item Code / SKU</label>
                    <input
                      type="text"
                      value={itemCode}
                      onChange={(e) => {
                        setIsDirty(true);
                        setItemCode(e.target.value);
                      }}
                      placeholder="e.g. PROD-101"
                      className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg font-mono"
                    />
                  </div>

                  {/* Barcode */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Barcode (EAN / UPC / Custom)</label>
                    <input
                      type="text"
                      value={barcode}
                      onChange={(e) => {
                        setIsDirty(true);
                        setBarcode(e.target.value);
                      }}
                      placeholder="Scan or type barcode e.g. 8901234567890"
                      className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg font-mono"
                    />
                  </div>

                  {/* GST Tax Rate */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">GST Tax Rate</label>
                    <select
                      value={taxRate}
                      onChange={(e) => {
                        setIsDirty(true);
                        setTaxRate(Number(e.target.value));
                      }}
                      className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg cursor-pointer"
                    >
                      {GST_RATES.map((g) => (
                        <option key={g.rate} value={g.rate}>
                          {g.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Sale Price & Tax Type */}
                  <div className="sm:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-4 p-3.5 bg-slate-50 rounded-xl border border-slate-200">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">Sale Price (₹)</label>
                      <input
                        type="number"
                        step="0.01"
                        value={salePrice}
                        onChange={(e) => {
                          setIsDirty(true);
                          setSalePrice(e.target.value);
                        }}
                        className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg font-mono font-bold"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">Sale Tax Mode</label>
                      <select
                        value={saleTaxType}
                        onChange={(e) => {
                          setIsDirty(true);
                          setSaleTaxType(e.target.value as PriceTaxType);
                        }}
                        className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg cursor-pointer"
                      >
                        <option value="without_tax">Without Tax (Tax Added on Top)</option>
                        <option value="with_tax">With Tax (Inclusive)</option>
                      </select>
                    </div>
                  </div>

                  {/* Wholesale Price */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Wholesale Price (₹) (Optional)</label>
                    <input
                      type="number"
                      step="0.01"
                      value={wholesalePrice}
                      onChange={(e) => {
                        setIsDirty(true);
                        setWholesalePrice(e.target.value);
                      }}
                      className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg font-mono"
                    />
                  </div>

                  {/* Purchase Price & Tax Type */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Purchase Price (₹)</label>
                    <input
                      type="number"
                      step="0.01"
                      value={purchasePrice}
                      onChange={(e) => {
                        setIsDirty(true);
                        setPurchasePrice(e.target.value);
                      }}
                      className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg font-mono"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* TAB 2: Stock */}
            {activeTab === 'stock' && type === 'product' && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Opening Stock Qty</label>
                    <input
                      type="number"
                      value={openingStock}
                      onChange={(e) => {
                        setIsDirty(true);
                        setOpeningStock(e.target.value);
                      }}
                      className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg font-mono"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">As-Of Date</label>
                    <input
                      type="date"
                      value={openingStockDate}
                      onChange={(e) => {
                        setIsDirty(true);
                        setOpeningStockDate(e.target.value);
                      }}
                      className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg font-mono"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Min Stock Alert Qty</label>
                    <input
                      type="number"
                      value={minStock}
                      onChange={(e) => {
                        setIsDirty(true);
                        setMinStock(e.target.value);
                      }}
                      placeholder="e.g. 5"
                      className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg font-mono"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Item Location / Godown</label>
                    <input
                      type="text"
                      value={location}
                      onChange={(e) => {
                        setIsDirty(true);
                        setLocation(e.target.value);
                      }}
                      placeholder="e.g. Main Godown, Shelf A-3"
                      className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* TAB 3: Manufacturing & Extra */}
            {activeTab === 'manufacturing' && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Manufacturer</label>
                    <input
                      type="text"
                      value={manufacturer}
                      onChange={(e) => {
                        setIsDirty(true);
                        setManufacturer(e.target.value);
                      }}
                      placeholder="e.g. Hindustan Unilever"
                      className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Batch Number</label>
                    <input
                      type="text"
                      value={batchNumber}
                      onChange={(e) => {
                        setIsDirty(true);
                        setBatchNumber(e.target.value);
                      }}
                      placeholder="e.g. BATCH-2026-X"
                      className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg font-mono"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Default Serial No. (Optional)</label>
                    <input
                      type="text"
                      value={serialNumber}
                      onChange={(e) => {
                        setIsDirty(true);
                        setSerialNumber(e.target.value);
                      }}
                      placeholder="e.g. SN-001928"
                      className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg font-mono"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Expiry Date</label>
                    <input
                      type="date"
                      value={expiryDate}
                      onChange={(e) => {
                        setIsDirty(true);
                        setExpiryDate(e.target.value);
                      }}
                      className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg font-mono"
                    />
                  </div>

                  {/* Image upload */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Item Photo</label>
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-lg border border-slate-300 bg-slate-50 flex items-center justify-center overflow-hidden shrink-0">
                        {imageUrl ? (
                          <img src={imageUrl} alt="Item" className="w-full h-full object-cover" />
                        ) : (
                          <Upload className="w-4 h-4 text-slate-400" />
                        )}
                      </div>
                      <input
                        type="file"
                        id="item-image"
                        accept="image/*"
                        onChange={handleImageUpload}
                        className="hidden"
                      />
                      <label
                        htmlFor="item-image"
                        className="px-3 py-1.5 text-xs text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 cursor-pointer"
                      >
                        {imageUrl ? 'Change Photo' : 'Upload Photo'}
                      </label>
                      {imageUrl && (
                        <button
                          type="button"
                          onClick={() => setImageUrl('')}
                          className="text-xs text-rose-600 hover:underline"
                        >
                          Remove
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3 shrink-0">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={handleAttemptClose}
                className="px-4 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <div className="hidden sm:flex items-center gap-2 text-[10px] text-slate-400">
                <span>
                  <kbd className="px-1.5 py-0.5 bg-slate-200 text-slate-700 font-mono font-bold rounded">Ctrl</kbd>+<kbd className="px-1.5 py-0.5 bg-slate-200 text-slate-700 font-mono font-bold rounded">Enter</kbd> Save
                </span>
                <span>
                  <kbd className="px-1.5 py-0.5 bg-slate-200 text-slate-700 font-mono font-bold rounded">Esc</kbd> Discard
                </span>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => handleSave(true)}
                disabled={isSaving}
                className="px-4 py-2 text-xs font-semibold text-rose-700 bg-rose-50 border border-rose-200 hover:bg-rose-100 rounded-lg shadow-2xs transition-colors cursor-pointer"
              >
                Save & New
              </button>

              <button
                type="button"
                onClick={() => handleSave(false)}
                disabled={isSaving}
                className="px-5 py-2 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 disabled:opacity-50 rounded-lg shadow-sm transition-colors cursor-pointer flex items-center gap-1.5"
              >
                <span>{isSaving ? 'Saving...' : 'Save Item'}</span>
                <span className="text-[10px] opacity-75 font-mono hidden sm:inline">(Ctrl+↵)</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      <ConfirmDiscardModal
        isOpen={showDiscardConfirm}
        onConfirm={() => {
          setShowDiscardConfirm(false);
          setIsDirty(false);
          onClose();
        }}
        onCancel={() => setShowDiscardConfirm(false)}
      />
    </>
  );
};
