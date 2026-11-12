import React, { useState } from 'react';
import { X, FileCode, CheckCircle2, AlertCircle, Download, Truck } from 'lucide-react';
import { BusinessProfile, Transaction } from '../../types';
import { saveTransaction } from '../../db/indexedDB';

interface EWayBillExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  transaction: Transaction | null;
  businessProfile: BusinessProfile | null;
  onSaved: (tx: Transaction) => void;
}

export const EWayBillExportModal: React.FC<EWayBillExportModalProps> = ({
  isOpen,
  onClose,
  transaction,
  businessProfile,
  onSaved,
}) => {
  const [transporterName, setTransporterName] = useState('');
  const [transporterId, setTransporterId] = useState('');
  const [transMode, setTransMode] = useState<'Road' | 'Rail' | 'Air' | 'Ship'>('Road');
  const [vehicleNo, setVehicleNo] = useState(transaction?.vehicleNo || '');
  const [distanceKm, setDistanceKm] = useState('50');
  const [fromPincode, setFromPincode] = useState('411001');
  const [toPincode, setToPincode] = useState('400001');
  const [eWayBillNumber, setEWayBillNumber] = useState(transaction?.eWayBillNo || '');

  const [validationError, setValidationError] = useState<string | null>(null);
  const [successNotice, setSuccessNotice] = useState<string | null>(null);

  if (!isOpen || !transaction) return null;

  // Generate e-Way Bill JSON for bulk upload to official e-Way bill portal
  const handleGenerateJSON = () => {
    if (!vehicleNo.trim()) {
      setValidationError('Vehicle number is required for Road transport');
      return;
    }
    if (!distanceKm.trim() || parseInt(distanceKm, 10) <= 0) {
      setValidationError('Approximate transport distance (km) is required');
      return;
    }

    setValidationError(null);

    // Official E-Way Bill schema representation
    const ewbData = {
      version: '1.0.1223',
      billLists: [
        {
          userGstin: businessProfile?.gstin || '27AAAAA0000A1Z5',
          supplyType: 'O', // Outward
          subSupplyType: '1', // Supply
          docType: 'INV',
          docNo: transaction.invoiceNo,
          docDate: transaction.date.split('-').reverse().join('/'),
          fromGstin: businessProfile?.gstin || '',
          fromTrdName: businessProfile?.businessName || '',
          fromAddr1: businessProfile?.address || '',
          fromPlace: businessProfile?.state || '',
          fromPincode: parseInt(fromPincode, 10) || 411001,
          toGstin: transaction.partyGstin || 'URP',
          toTrdName: transaction.partyName,
          toAddr1: transaction.billingAddress || '',
          toPlace: transaction.partyState,
          toPincode: parseInt(toPincode, 10) || 400001,
          totalValue: transaction.subtotal,
          cgstValue: transaction.cgst,
          sgstValue: transaction.sgst,
          igstValue: transaction.igst,
          totInvValue: transaction.totalAmount,
          transMode: transMode === 'Road' ? 1 : transMode === 'Rail' ? 2 : transMode === 'Air' ? 3 : 4,
          transDistance: parseInt(distanceKm, 10),
          transporterName,
          transporterId,
          transDocNo: transaction.invoiceNo,
          transDocDate: transaction.date.split('-').reverse().join('/'),
          vehNo: vehicleNo.trim().toUpperCase(),
          vehType: 'R', // Regular
          itemList: transaction.items.map((it, idx) => ({
            itemNo: idx + 1,
            productName: it.name,
            productDesc: it.name,
            hsnCode: parseInt(it.hsn || '0', 10),
            quantity: it.qty,
            qtyUnit: it.unit,
            cgstRate: transaction.igst > 0 ? 0 : it.taxRate / 2,
            sgstRate: transaction.igst > 0 ? 0 : it.taxRate / 2,
            igstRate: transaction.igst > 0 ? it.taxRate : 0,
            taxableAmount: it.totalAmount - it.taxAmount,
          })),
        },
      ],
    };

    const jsonStr = JSON.stringify(ewbData, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `EWayBill_${transaction.invoiceNo}.json`;
    link.click();
    URL.revokeObjectURL(url);

    setSuccessNotice('Official e-Way Bill JSON downloaded. Upload to ewaybillgst.gov.in and paste back the e-Way Bill No. below.');
  };

  const handleSaveEWayBillNo = async () => {
    if (!eWayBillNumber.trim()) {
      setValidationError('Please enter a valid 12-digit e-Way Bill Number');
      return;
    }

    const updated: Transaction = {
      ...transaction,
      eWayBillNo: eWayBillNumber.trim(),
      vehicleNo: vehicleNo.trim().toUpperCase(),
    };

    const saved = await saveTransaction(updated);
    onSaved(saved);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
      <div className="w-full max-w-xl bg-white rounded-xl shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-100">
        <div className="flex items-center justify-between px-6 py-4 bg-slate-900 text-white">
          <div className="flex items-center gap-2">
            <Truck className="w-5 h-5 text-rose-500" />
            <h3 className="text-sm font-bold">Generate e-Way Bill - {transaction.invoiceNo}</h3>
          </div>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-white cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6 space-y-4 text-xs max-h-[80vh] overflow-y-auto">
          {validationError && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-lg flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{validationError}</span>
            </div>
          )}

          {successNotice && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-lg flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>{successNotice}</span>
            </div>
          )}

          <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-1">
            <div className="font-semibold text-slate-800">
              Invoice Amount: <span className="font-mono text-rose-600 font-bold">₹ {transaction.totalAmount}</span>
            </div>
            <div className="text-slate-500 text-[11px]">
              Customer: {transaction.partyName} ({transaction.partyState})
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3.5">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Vehicle Number *</label>
              <input
                type="text"
                value={vehicleNo}
                onChange={(e) => setVehicleNo(e.target.value.toUpperCase())}
                placeholder="e.g. MH12AB1234"
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg uppercase font-mono"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Approx Distance (KM) *</label>
              <input
                type="number"
                value={distanceKm}
                onChange={(e) => setDistanceKm(e.target.value)}
                placeholder="50"
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg font-mono"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Transport Mode</label>
              <select
                value={transMode}
                onChange={(e) => setTransMode(e.target.value as 'Road' | 'Rail' | 'Air' | 'Ship')}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg cursor-pointer"
              >
                <option value="Road">1 - Road</option>
                <option value="Rail">2 - Rail</option>
                <option value="Air">3 - Air</option>
                <option value="Ship">4 - Ship</option>
              </select>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Transporter Name</label>
              <input
                type="text"
                value={transporterName}
                onChange={(e) => setTransporterName(e.target.value)}
                placeholder="e.g. VRL Logistics"
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">From Pincode</label>
              <input
                type="text"
                value={fromPincode}
                onChange={(e) => setFromPincode(e.target.value)}
                maxLength={6}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg font-mono"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">To Pincode</label>
              <input
                type="text"
                value={toPincode}
                onChange={(e) => setToPincode(e.target.value)}
                maxLength={6}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg font-mono"
              />
            </div>
          </div>

          {/* Level 1: Generate JSON Export */}
          <div className="pt-2 border-t border-slate-200">
            <button
              type="button"
              onClick={handleGenerateJSON}
              className="w-full py-2.5 px-4 text-xs font-semibold text-slate-800 bg-slate-100 hover:bg-slate-200 border border-slate-300 rounded-lg flex items-center justify-center gap-2 cursor-pointer shadow-2xs"
            >
              <Download className="w-4 h-4 text-slate-600" />
              <span>Generate & Download e-Way Bill Portal JSON</span>
            </button>
          </div>

          {/* Save e-Way Bill Number on Invoice */}
          <div className="pt-3 border-t border-slate-200 space-y-2">
            <label className="block font-bold text-slate-800">
              Save Generated e-Way Bill No. on Invoice
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={eWayBillNumber}
                onChange={(e) => setEWayBillNumber(e.target.value)}
                maxLength={12}
                placeholder="12-digit e-Way Bill No (e.g. 121000123456)"
                className="flex-1 px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg font-mono font-bold"
              />
              <button
                type="button"
                onClick={handleSaveEWayBillNo}
                className="px-4 py-2 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 rounded-lg cursor-pointer shrink-0 shadow-2xs"
              >
                Save on Invoice
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
