import React from 'react';
import { X, Printer, Truck } from 'lucide-react';
import { BusinessProfile, Transaction } from '../../types';
import { formatDate } from '../../utils/formatters';

interface DeliveryChallanPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  transaction: Transaction | null;
  businessProfile: BusinessProfile | null;
}

export const DeliveryChallanPreviewModal: React.FC<DeliveryChallanPreviewModalProps> = ({
  isOpen,
  onClose,
  transaction,
  businessProfile,
}) => {
  if (!isOpen || !transaction) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-3 sm:p-5 overflow-y-auto print:p-0 print:bg-white print:fixed print:inset-0">
      <div className="w-full max-w-3xl bg-white rounded-xl shadow-2xl border border-slate-200 overflow-hidden my-4 flex flex-col max-h-[95vh] print:max-h-none print:shadow-none print:border-none print:w-full print:m-0">
        <div className="no-print flex items-center justify-between px-6 py-4 bg-slate-900 text-white shrink-0">
          <div className="flex items-center gap-2">
            <Truck className="w-4 h-4 text-rose-500" />
            <h3 className="text-sm font-bold">Delivery Challan - DC-{transaction.invoiceNo}</h3>
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => window.print()}
              className="px-3.5 py-1.5 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 rounded-lg flex items-center gap-1.5 cursor-pointer shadow-2xs"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print Challan</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="text-slate-400 hover:text-white cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="p-8 overflow-y-auto flex-1 space-y-6 text-xs text-slate-900 bg-white">
          <div className="flex justify-between border-b border-slate-200 pb-4">
            <div>
              <h1 className="text-base font-bold uppercase">{businessProfile?.businessName}</h1>
              <p className="text-slate-600 whitespace-pre-line mt-0.5">{businessProfile?.address}</p>
              <div className="mt-1 font-mono text-[11px] text-slate-600">
                Phone: {businessProfile?.phone} {businessProfile?.gstin ? `· GSTIN: ${businessProfile.gstin}` : ''}
              </div>
            </div>
            <div className="text-right">
              <span className="text-xs font-bold uppercase bg-slate-100 py-1 px-3 rounded-md block mb-1">
                DELIVERY CHALLAN
              </span>
              <div className="font-mono text-[11px] space-y-0.5">
                <div>Challan No: <strong>DC-{transaction.invoiceNo}</strong></div>
                <div>Date: {formatDate(transaction.date)}</div>
                {transaction.vehicleNo && <div>Vehicle No: <strong>{transaction.vehicleNo}</strong></div>}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 bg-slate-50 p-4 rounded-lg border border-slate-200">
            <div>
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Consignee (Deliver To):</span>
              <div className="text-xs font-bold text-slate-950 mt-1">{transaction.partyName}</div>
              <p className="text-slate-600 mt-0.5 whitespace-pre-line">
                {transaction.shippingAddress || transaction.billingAddress}
              </p>
              {transaction.partyPhone && <div className="mt-1 font-mono">Phone: {transaction.partyPhone}</div>}
            </div>
            <div className="text-right text-[11px] font-mono text-slate-600 space-y-1">
              <div>Invoice Ref: {transaction.invoiceNo}</div>
              <div>State of Supply: {transaction.stateOfSupply}</div>
            </div>
          </div>

          <div className="border border-slate-300 rounded-lg overflow-hidden">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-100 text-slate-800 font-bold border-b border-slate-300 text-[10px] uppercase">
                  <th className="py-2.5 px-3 w-10 text-center">#</th>
                  <th className="py-2.5 px-3">Item Description</th>
                  <th className="py-2.5 px-3 text-center w-20">HSN</th>
                  <th className="py-2.5 px-3 text-right w-24">Delivered Qty</th>
                  <th className="py-2.5 px-3 text-center w-20">Unit</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 font-mono text-[11px]">
                {transaction.items.map((it, idx) => (
                  <tr key={it.id || idx}>
                    <td className="py-2.5 px-3 text-center text-slate-400">{idx + 1}</td>
                    <td className="py-2.5 px-3 font-sans font-medium text-slate-900">{it.name}</td>
                    <td className="py-2.5 px-3 text-center text-slate-600">{it.hsn || '-'}</td>
                    <td className="py-2.5 px-3 text-right font-bold text-slate-900">
                      {it.qty} {it.freeQty > 0 ? `(+${it.freeQty} Free)` : ''}
                    </td>
                    <td className="py-2.5 px-3 text-center text-slate-600">{it.unit}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="grid grid-cols-2 gap-6 pt-8 mt-8 border-t border-slate-200">
            <div className="text-center pt-8 border-t border-slate-300 w-48">
              <span className="text-[11px] text-slate-500 font-medium">Receiver&apos;s Signature & Stamp</span>
            </div>
            <div className="text-right flex flex-col items-end">
              <span className="text-xs font-bold text-slate-900">For {businessProfile?.businessName}</span>
              <div className="pt-8 mt-4 border-t border-slate-300 w-48 text-center text-[11px] text-slate-500 font-medium">
                Authorized Signatory
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
