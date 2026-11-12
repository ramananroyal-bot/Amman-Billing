import React, { useState, useRef } from 'react';
import {
  X,
  Upload,
  Download,
  FileSpreadsheet,
  AlertTriangle,
  CheckCircle2,
  AlertCircle,
  FileText,
  Check,
} from 'lucide-react';
import { Party, Item } from '../../types';
import {
  getParties,
  getItems,
  saveParty,
  saveItem,
} from '../../db/indexedDB';
import { formatINR } from '../../utils/formatters';

interface ImportExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  target: 'parties' | 'items';
  onImportCompleted: () => void;
}

interface ParsedRow {
  index: number;
  data: any;
  errors: string[];
  isDuplicate: boolean;
  status: 'valid' | 'duplicate' | 'error';
}

export const ImportExportModal: React.FC<ImportExportModalProps> = ({
  isOpen,
  onClose,
  target,
  onImportCompleted,
}) => {
  const [activeTab, setActiveTab] = useState<'import' | 'export'>('import');
  const [file, setFile] = useState<File | null>(null);
  const [parsedRows, setParsedRows] = useState<ParsedRow[]>([]);
  const [duplicateAction, setDuplicateAction] = useState<'skip' | 'update'>('skip');
  const [isProcessing, setIsProcessing] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const isParties = target === 'parties';
  const entityName = isParties ? 'Parties' : 'Items';

  // 1. Download CSV Template
  const handleDownloadTemplate = () => {
    let headers: string[];
    let sampleRows: string[];
    let filename: string;

    if (isParties) {
      filename = 'vyapar_parties_template.csv';
      headers = [
        'Name*',
        'Phone*',
        'GSTIN',
        'GST Type',
        'State',
        'State Code',
        'Billing Address',
        'Opening Balance',
        'Opening Balance Type (to_receive / to_pay)',
        'Credit Limit',
        'Email',
      ];
      sampleRows = [
        'Ramesh Traders,9876543210,33AAAAA0000A1Z5,Registered,Tamil Nadu,33,"12 Anna Salai, Chennai",5000,to_receive,50000,ramesh@example.com',
        'Sri Murugan Stores,9841023456,,Unregistered,Tamil Nadu,33,"45 Market Road, Madurai",0,to_receive,25000,',
      ];
    } else {
      filename = 'vyapar_items_template.csv';
      headers = [
        'Name*',
        'Item Type (product / service)',
        'HSN',
        'Unit',
        'Sale Price*',
        'Sale Price Tax (with_tax / without_tax)',
        'Purchase Price',
        'Tax Rate (%)',
        'Opening Stock',
        'Min Stock Alert',
        'Category',
        'Item Code',
      ];
      sampleRows = [
        'Ponni Boiled Rice 25kg,product,100630,BAG,1250,without_tax,1100,5,100,10,Grains,RICE-01',
        'Aachi Chilli Powder 500g,product,090420,PKT,140,with_tax,115,12,50,5,Spices,SPICE-01',
        'Delivery & Installation,service,998719,NOS,500,without_tax,0,18,0,0,Services,SRV-01',
      ];
    }

    const csvContent = [headers.join(','), ...sampleRows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  // 2. Export All Current Records
  const handleExportData = async () => {
    let filename: string;
    let csvRows: string[] = [];

    if (isParties) {
      filename = `parties_export_${new Date().toISOString().split('T')[0]}.csv`;
      const parties = await getParties();
      const headers = [
        'Name*',
        'Phone*',
        'GSTIN',
        'GST Type',
        'State',
        'State Code',
        'Billing Address',
        'Opening Balance',
        'Opening Balance Type (to_receive / to_pay)',
        'Credit Limit',
        'Email',
      ];
      csvRows.push(headers.join(','));

      for (const p of parties) {
        const row = [
          `"${p.name.replace(/"/g, '""')}"`,
          `"${p.phone || ''}"`,
          `"${p.gstin || ''}"`,
          `"${p.gstType || 'Unregistered'}"`,
          `"${p.state || ''}"`,
          `"${p.stateCode || ''}"`,
          `"${(p.billingAddress || '').replace(/"/g, '""')}"`,
          p.openingBalance || 0,
          p.openingBalanceType || 'to_receive',
          p.creditLimit || 0,
          `"${p.email || ''}"`,
        ];
        csvRows.push(row.join(','));
      }
    } else {
      filename = `items_export_${new Date().toISOString().split('T')[0]}.csv`;
      const items = await getItems();
      const headers = [
        'Name*',
        'Item Type (product / service)',
        'HSN',
        'Unit',
        'Sale Price*',
        'Sale Price Tax (with_tax / without_tax)',
        'Purchase Price',
        'Tax Rate (%)',
        'Opening Stock',
        'Min Stock Alert',
        'Category',
        'Item Code',
      ];
      csvRows.push(headers.join(','));

      for (const i of items) {
        const row = [
          `"${i.name.replace(/"/g, '""')}"`,
          i.type || 'product',
          `"${i.hsn || ''}"`,
          `"${i.unit || 'PCS'}"`,
          i.salePrice || 0,
          i.salePriceTaxType || 'without_tax',
          i.purchasePrice || 0,
          i.taxRate || 0,
          i.currentStock || 0,
          i.minStockAlert || 0,
          `"${i.category || 'General'}"`,
          `"${i.itemCode || ''}"`,
        ];
        csvRows.push(row.join(','));
      }
    }

    const blob = new Blob([csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  // CSV line parser supporting quoted values
  const parseCSVLine = (text: string): string[] => {
    const result: string[] = [];
    let cur = '';
    let inQuotes = false;
    for (let i = 0; i < text.length; i++) {
      const c = text[i];
      if (c === '"') {
        if (inQuotes && text[i + 1] === '"') {
          cur += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (c === ',' && !inQuotes) {
        result.push(cur.trim());
        cur = '';
      } else {
        cur += c;
      }
    }
    result.push(cur.trim());
    return result;
  };

  // 3. Handle File Upload & Parse
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const uploaded = e.target.files?.[0];
    if (!uploaded) return;

    setFile(uploaded);
    setSaveSuccess(null);
    setIsProcessing(true);

    try {
      const text = await uploaded.text();
      const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
      if (lines.length <= 1) {
        setParsedRows([]);
        setIsProcessing(false);
        return;
      }

      // Existing records for duplicate checks
      const [existingParties, existingItems] = await Promise.all([
        getParties(),
        getItems(),
      ]);

      const rows: ParsedRow[] = [];

      // Skip header row
      for (let i = 1; i < lines.length; i++) {
        const cols = parseCSVLine(lines[i]);
        const errors: string[] = [];
        let isDuplicate = false;

        if (isParties) {
          const name = cols[0] || '';
          const phone = cols[1] || '';
          const gstin = (cols[2] || '').toUpperCase();
          const gstType = cols[3] || 'Unregistered';
          const state = cols[4] || 'Tamil Nadu';
          const stateCode = cols[5] || '33';
          const billingAddress = cols[6] || '';
          const openingBalance = parseFloat(cols[7]) || 0;
          const openingBalanceType = (cols[8] === 'to_pay' ? 'to_pay' : 'to_receive') as 'to_receive' | 'to_pay';
          const creditLimit = parseFloat(cols[9]) || 0;
          const email = cols[10] || '';

          if (!name.trim()) {
            errors.push('Party Name is required');
          }
          if (gstin && gstin.length !== 15) {
            errors.push('GSTIN must be exactly 15 characters if provided');
          }

          // Duplicate check
          const dup = existingParties.find(
            (p) =>
              p.name.trim().toLowerCase() === name.trim().toLowerCase() ||
              (phone && p.phone && p.phone.trim() === phone.trim())
          );
          if (dup) isDuplicate = true;

          const status: 'valid' | 'duplicate' | 'error' = errors.length > 0 ? 'error' : isDuplicate ? 'duplicate' : 'valid';

          rows.push({
            index: i,
            data: {
              id: dup ? dup.id : undefined,
              name: name.trim(),
              phone: phone.trim(),
              gstin: gstin.trim(),
              gstType: (['Registered', 'Unregistered', 'Composition', 'Consumer'].includes(gstType) ? gstType : 'Unregistered') as any,
              state: state.trim(),
              stateCode: stateCode.trim(),
              billingAddress: billingAddress.trim(),
              shippingAddresses: billingAddress ? [billingAddress.trim()] : [],
              openingBalance,
              openingBalanceType,
              creditLimit,
              email: email.trim(),
            },
            errors,
            isDuplicate,
            status,
          });
        } else {
          // Items
          const name = cols[0] || '';
          const type = cols[1] === 'service' ? 'service' : 'product';
          const hsn = cols[2] || '';
          const unit = cols[3] || 'PCS';
          const salePrice = parseFloat(cols[4]) || 0;
          const salePriceTaxType = cols[5] === 'with_tax' ? 'with_tax' : 'without_tax';
          const purchasePrice = parseFloat(cols[6]) || 0;
          const taxRate = parseFloat(cols[7]) || 0;
          const openingStock = parseFloat(cols[8]) || 0;
          const minStockAlert = parseFloat(cols[9]) || 0;
          const category = cols[10] || 'General';
          const itemCode = cols[11] || '';

          if (!name.trim()) {
            errors.push('Item Name is required');
          }
          if (isNaN(salePrice) || salePrice < 0) {
            errors.push('Sale Price must be a non-negative number');
          }

          // Duplicate check
          const dup = existingItems.find(
            (it) =>
              it.name.trim().toLowerCase() === name.trim().toLowerCase() ||
              (itemCode && it.itemCode && it.itemCode.trim().toLowerCase() === itemCode.trim().toLowerCase())
          );
          if (dup) isDuplicate = true;

          const status: 'valid' | 'duplicate' | 'error' = errors.length > 0 ? 'error' : isDuplicate ? 'duplicate' : 'valid';

          rows.push({
            index: i,
            data: {
              id: dup ? dup.id : undefined,
              name: name.trim(),
              type,
              hsn: hsn.trim(),
              unit: unit.trim(),
              salePrice,
              salePriceTaxType,
              purchasePrice,
              taxRate,
              openingStockQty: openingStock,
              openingStockDate: new Date().toISOString().split('T')[0],
              minStockAlert,
              category: category.trim(),
              itemCode: itemCode.trim(),
              location: 'Main Godown',
              currentStock: openingStock,
              stockValue: Math.round(openingStock * purchasePrice * 100) / 100,
            },
            errors,
            isDuplicate,
            status,
          });
        }
      }

      setParsedRows(rows);
    } catch (err: any) {
      console.error('Failed to parse CSV', err);
    } finally {
      setIsProcessing(false);
    }
  };

  // 4. Confirm & Import
  const handleConfirmImport = async () => {
    setIsProcessing(true);
    let importedCount = 0;

    try {
      for (const row of parsedRows) {
        if (row.status === 'error') continue;

        if (row.isDuplicate && duplicateAction === 'skip') {
          continue;
        }

        if (isParties) {
          await saveParty(row.data);
          importedCount++;
        } else {
          await saveItem(row.data);
          importedCount++;
        }
      }

      setSaveSuccess(`Successfully imported ${importedCount} ${entityName}!`);
      onImportCompleted();
      setTimeout(() => {
        onClose();
      }, 1500);
    } catch (err: any) {
      console.error('Import commit error', err);
    } finally {
      setIsProcessing(false);
    }
  };

  const validCount = parsedRows.filter((r) => r.status === 'valid').length;
  const duplicateCount = parsedRows.filter((r) => r.status === 'duplicate').length;
  const errorCount = parsedRows.filter((r) => r.status === 'error').length;
  const readyToImportCount = duplicateAction === 'skip' ? validCount : validCount + duplicateCount;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="w-full max-w-3xl bg-white rounded-xl shadow-2xl border border-slate-200 overflow-hidden my-8 animate-in fade-in zoom-in-95 duration-150 flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 bg-slate-900 text-white shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-rose-500/20 text-rose-400 flex items-center justify-center">
              <FileSpreadsheet className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold">Import / Export {entityName}</h3>
              <p className="text-[11px] text-slate-400">
                Bulk create or download {entityName.toLowerCase()} using clean CSV/Excel spreadsheets
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-md hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab switch */}
        <div className="flex border-b border-slate-200 bg-slate-50 px-5 pt-3 gap-3 shrink-0">
          <button
            type="button"
            onClick={() => setActiveTab('import')}
            className={`pb-2.5 text-xs font-bold transition-colors cursor-pointer border-b-2 ${
              activeTab === 'import' ? 'border-rose-600 text-rose-600' : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            Import {entityName} from CSV
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('export')}
            className={`pb-2.5 text-xs font-bold transition-colors cursor-pointer border-b-2 ${
              activeTab === 'export' ? 'border-rose-600 text-rose-600' : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            Export All {entityName}
          </button>
        </div>

        {/* Tab content */}
        <div className="p-5 flex-1 overflow-y-auto space-y-4 text-xs">
          {saveSuccess && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-lg flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <span className="font-semibold">{saveSuccess}</span>
            </div>
          )}

          {activeTab === 'export' ? (
            <div className="space-y-4 py-4 text-center">
              <div className="w-12 h-12 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center mx-auto">
                <Download className="w-6 h-6" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-slate-900">Export All {entityName} to Excel / CSV</h4>
                <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
                  Downloads a complete spreadsheet of all {entityName.toLowerCase()} in your database formatted with exact columns suitable for backup or re-import.
                </p>
              </div>
              <button
                type="button"
                onClick={handleExportData}
                className="px-5 py-2.5 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm transition-all cursor-pointer"
              >
                Download {entityName} CSV
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Step 1: Download sample template */}
              <div className="flex items-center justify-between p-3.5 bg-slate-50 border border-slate-200 rounded-lg">
                <div>
                  <div className="font-bold text-slate-800">1. Download Blank Sample Template</div>
                  <div className="text-[11px] text-slate-500">
                    Use our verified template with pre-filled sample rows and proper column headers.
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleDownloadTemplate}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-100 border border-slate-300 rounded-md shadow-2xs transition-colors cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download Template</span>
                </button>
              </div>

              {/* Step 2: Upload CSV */}
              <div className="p-5 border-2 border-dashed border-slate-300 rounded-lg text-center hover:bg-slate-50 transition-colors">
                <input
                  type="file"
                  ref={fileInputRef}
                  accept=".csv,text/csv"
                  onChange={handleFileUpload}
                  className="hidden"
                />
                <Upload className="w-8 h-8 text-slate-400 mx-auto mb-2" />
                <div className="text-xs font-bold text-slate-800">
                  {file ? file.name : `Select CSV file to import ${entityName}`}
                </div>
                <p className="text-[11px] text-slate-400 mt-1">UTF-8 encoded .csv files up to 5MB</p>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="mt-3 px-4 py-1.5 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-md cursor-pointer"
                >
                  {file ? 'Choose Different File' : 'Browse File'}
                </button>
              </div>

              {/* Duplicate Handling Option */}
              {parsedRows.length > 0 && duplicateCount > 0 && (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                    <span className="text-xs text-amber-900 font-semibold">
                      {duplicateCount} duplicate records found (matching by name or phone/code)
                    </span>
                  </div>
                  <div className="flex items-center gap-3 text-xs">
                    <label className="flex items-center gap-1.5 cursor-pointer text-slate-700">
                      <input
                        type="radio"
                        name="dupAction"
                        checked={duplicateAction === 'skip'}
                        onChange={() => setDuplicateAction('skip')}
                        className="text-rose-600"
                      />
                      <span>Skip duplicates</span>
                    </label>
                    <label className="flex items-center gap-1.5 cursor-pointer text-slate-700">
                      <input
                        type="radio"
                        name="dupAction"
                        checked={duplicateAction === 'update'}
                        onChange={() => setDuplicateAction('update')}
                        className="text-rose-600"
                      />
                      <span>Update existing</span>
                    </label>
                  </div>
                </div>
              )}

              {/* Step 3: Live Preview Table */}
              {parsedRows.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs font-semibold text-slate-700">
                    <span>
                      Preview Parsed Records ({parsedRows.length} total)
                    </span>
                    <div className="flex items-center gap-3 text-[11px]">
                      <span className="text-emerald-700 font-bold">{validCount} Valid</span>
                      <span className="text-amber-700 font-bold">{duplicateCount} Duplicates</span>
                      {errorCount > 0 && <span className="text-rose-700 font-bold">{errorCount} Errors</span>}
                    </div>
                  </div>

                  <div className="border border-slate-200 rounded-lg overflow-x-auto max-h-60">
                    <table className="w-full text-left text-[11px] border-collapse">
                      <thead className="bg-slate-100 text-slate-600 font-semibold border-b border-slate-200 sticky top-0">
                        <tr>
                          <th className="py-2 px-3">#</th>
                          <th className="py-2 px-3">Status</th>
                          <th className="py-2 px-3">Name</th>
                          {isParties ? (
                            <>
                              <th className="py-2 px-3">Phone</th>
                              <th className="py-2 px-3">GSTIN</th>
                              <th className="py-2 px-3 text-right">Opening Bal (₹)</th>
                            </>
                          ) : (
                            <>
                              <th className="py-2 px-3">Category</th>
                              <th className="py-2 px-3 text-right">Sale Price (₹)</th>
                              <th className="py-2 px-3 text-right">Stock</th>
                            </>
                          )}
                          <th className="py-2 px-3">Validation Details</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {parsedRows.map((r) => (
                          <tr key={r.index} className={r.status === 'error' ? 'bg-rose-50/50' : 'hover:bg-slate-50'}>
                            <td className="py-1.5 px-3 font-mono text-slate-500">{r.index}</td>
                            <td className="py-1.5 px-3 whitespace-nowrap">
                              {r.status === 'valid' && (
                                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                  <Check className="w-3 h-3" /> Valid
                                </span>
                              )}
                              {r.status === 'duplicate' && (
                                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                                  Duplicate ({duplicateAction})
                                </span>
                              )}
                              {r.status === 'error' && (
                                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                                  Error
                                </span>
                              )}
                            </td>
                            <td className="py-1.5 px-3 font-bold text-slate-900">{r.data.name || '-'}</td>
                            {isParties ? (
                              <>
                                <td className="py-1.5 px-3 font-mono text-slate-600">{r.data.phone || '-'}</td>
                                <td className="py-1.5 px-3 font-mono text-slate-600">{r.data.gstin || '-'}</td>
                                <td className="py-1.5 px-3 text-right font-mono">{formatINR(r.data.openingBalance)}</td>
                              </>
                            ) : (
                              <>
                                <td className="py-1.5 px-3 text-slate-600">{r.data.category || '-'}</td>
                                <td className="py-1.5 px-3 text-right font-mono font-bold">{formatINR(r.data.salePrice)}</td>
                                <td className="py-1.5 px-3 text-right font-mono">{r.data.currentStock} {r.data.unit}</td>
                              </>
                            )}
                            <td className="py-1.5 px-3 text-slate-500">
                              {r.errors.length > 0 ? (
                                <span className="text-rose-600 font-semibold">{r.errors.join(', ')}</span>
                              ) : r.isDuplicate ? (
                                <span className="text-amber-700">Already exists in database</span>
                              ) : (
                                <span className="text-emerald-600">Ready to save</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer actions */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer"
          >
            Cancel
          </button>

          {activeTab === 'import' && parsedRows.length > 0 && (
            <button
              type="button"
              onClick={handleConfirmImport}
              disabled={isProcessing || readyToImportCount === 0}
              className="flex items-center gap-1.5 px-5 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 disabled:opacity-50 rounded-lg shadow-sm transition-all cursor-pointer"
            >
              <Check className="w-3.5 h-3.5" />
              <span>
                {isProcessing ? 'Importing...' : `Confirm & Import (${readyToImportCount} Records)`}
              </span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
