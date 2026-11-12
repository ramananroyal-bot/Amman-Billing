import React, { useState, useEffect } from 'react';
import { X, Printer, Download, Share2, Building2, Receipt, FileText, QrCode } from 'lucide-react';
import { BusinessProfile, Transaction, AppSettings } from '../../types';
import { formatINR, formatDate, numberToIndianWords } from '../../utils/formatters';
import { getAppSettings } from '../../db/indexedDB';

interface InvoicePrintModalProps {
  isOpen: boolean;
  onClose: () => void;
  transaction: Transaction | null;
  businessProfile: BusinessProfile | null;
}

type PrintFormat = 'a4' | 'thermal_80' | 'thermal_58';

export const InvoicePrintModal: React.FC<InvoicePrintModalProps> = ({
  isOpen,
  onClose,
  transaction,
  businessProfile,
}) => {
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [format, setFormat] = useState<PrintFormat>('a4');

  useEffect(() => {
    if (isOpen) {
      getAppSettings().then(setSettings);
    }
  }, [isOpen]);

  if (!isOpen || !transaction) return null;

  const isSale = transaction.type === 'sale_invoice';
  const isComposition = settings?.isCompositionScheme;
  const invoiceTitle = isComposition
    ? 'BILL OF SUPPLY'
    : isSale
    ? 'TAX INVOICE'
    : transaction.type === 'purchase_bill'
    ? 'PURCHASE BILL'
    : transaction.type === 'sale_return'
    ? 'CREDIT NOTE (SALE RETURN)'
    : transaction.type === 'purchase_return'
    ? 'DEBIT NOTE (PURCHASE RETURN)'
    : transaction.type === 'payment_in'
    ? 'PAYMENT RECEIPT'
    : transaction.type === 'payment_out'
    ? 'PAYMENT VOUCHER'
    : transaction.type === 'delivery_challan'
    ? 'DELIVERY CHALLAN'
    : 'TRANSACTION RECEIPT';

  const isInterState = transaction.igst > 0;
  const accentColor = settings?.invoiceColor || '#e11d48';

  // Generate UPI QR Code URL for easy scanning
  const upiId = businessProfile?.bankDetails?.upiId;
  const payeeName = encodeURIComponent(businessProfile?.businessName || 'Business');
  const amountStr = transaction.totalAmount.toFixed(2);
  const upiPayLink = upiId
    ? `upi://pay?pa=${encodeURIComponent(upiId)}&pn=${payeeName}&am=${amountStr}&cu=INR&tn=${encodeURIComponent(
        transaction.invoiceNo
      )}`
    : '';

  const qrCodeUrl = upiPayLink && settings?.printShowUPIQR !== false
    ? `https://api.qrserver.com/v1/create-qr-code/?size=120x120&data=${encodeURIComponent(upiPayLink)}`
    : '';

  const handlePrint = () => {
    window.print();
  };

  // Export official NIC format e-Way Bill JSON
  const handleExportEWayBill = () => {
    const payload = {
      version: '1.0.0421',
      billLists: [
        {
          userGstin: businessProfile?.gstin || '',
          supplyType: 'O',
          subSupplyType: '1',
          docType: 'INV',
          docNo: transaction.invoiceNo,
          docDate: transaction.date.split('-').reverse().join('/'),
          fromGstin: businessProfile?.gstin || '',
          fromTrdName: businessProfile?.businessName || '',
          fromAddr1: businessProfile?.address || '',
          fromStateCode: Number(businessProfile?.stateCode || 27),
          toGstin: transaction.partyGstin || 'URP',
          toTrdName: transaction.partyName,
          toAddr1: transaction.billingAddress || '',
          toStateCode: Number(transaction.partyStateCode || 27),
          totalValue: transaction.subtotal,
          cgstValue: transaction.cgst,
          sgstValue: transaction.sgst,
          igstValue: transaction.igst,
          totInvValue: transaction.totalAmount,
          mainHsnCode: transaction.items[0]?.hsn || '',
          itemList: transaction.items.map((it, i) => ({
            itemNo: i + 1,
            productName: it.name,
            productDesc: it.name,
            hsnCode: it.hsn ? Number(it.hsn.replace(/\D/g, '')) : 0,
            quantity: it.qty,
            qtyUnit: it.unit || 'NOS',
            taxableAmount: (it.qty * it.priceUnit) - (it.discountAmount || 0),
            sgstRate: isInterState ? 0 : it.taxRate / 2,
            cgstRate: isInterState ? 0 : it.taxRate / 2,
            igstRate: isInterState ? it.taxRate : 0,
          })),
        },
      ],
    };

    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `EWAYBILL_${transaction.invoiceNo.replace(/\s+/g, '_')}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Group line items by HSN for GST tax rate breakdown
  interface HsnSummary {
    hsn: string;
    taxable: number;
    taxRate: number;
    cgst: number;
    sgst: number;
    igst: number;
    totalTax: number;
  }

  const hsnMap = new Map<string, HsnSummary>();
  transaction.items.forEach((item) => {
    const hsn = item.hsn?.trim() || 'General';
    const taxable = (Number(item.qty) || 0) * (Number(item.priceUnit) || 0) - (Number(item.discountAmount) || 0);
    const tax = Number(item.taxAmount) || 0;
    const cgst = isInterState ? 0 : tax / 2;
    const sgst = isInterState ? 0 : tax / 2;
    const igst = isInterState ? tax : 0;

    const existing = hsnMap.get(hsn);
    if (existing) {
      existing.taxable += taxable;
      existing.cgst += cgst;
      existing.sgst += sgst;
      existing.igst += igst;
      existing.totalTax += tax;
    } else {
      hsnMap.set(hsn, {
        hsn,
        taxable,
        taxRate: item.taxRate,
        cgst,
        sgst,
        igst,
        totalTax: tax,
      });
    }
  });
  const hsnList = Array.from(hsnMap.values());

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 backdrop-blur-xs p-2 sm:p-4 overflow-y-auto print:p-0 print:bg-white print:fixed print:inset-0">
      <div className="w-full max-w-4xl bg-white rounded-xl shadow-2xl border border-slate-200 overflow-hidden my-4 flex flex-col max-h-[96vh] print:max-h-none print:shadow-none print:border-none print:w-full print:m-0">
        {/* Modal Top Bar - Hidden on print */}
        <div className="no-print flex flex-wrap items-center justify-between gap-3 px-6 py-3.5 bg-slate-900 text-white shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-rose-600/30 text-rose-400 flex items-center justify-center">
              <Printer className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold">
                {invoiceTitle} - {transaction.invoiceNo}
              </h3>
              <p className="text-[11px] text-slate-400">
                {formatDate(transaction.date)} · Total: {formatINR(transaction.totalAmount)}
              </p>
            </div>
          </div>

          {/* Format Switcher */}
          <div className="flex items-center bg-slate-800 p-0.5 rounded-lg border border-slate-700 text-xs">
            <button
              type="button"
              onClick={() => setFormat('a4')}
              className={`px-3 py-1 rounded font-medium transition-colors cursor-pointer flex items-center gap-1.5 ${
                format === 'a4' ? 'bg-rose-600 text-white shadow-xs' : 'text-slate-400 hover:text-white'
              }`}
            >
              <FileText className="w-3.5 h-3.5" />
              <span>A4 Full Sheet</span>
            </button>
            <button
              type="button"
              onClick={() => setFormat('thermal_80')}
              className={`px-3 py-1 rounded font-medium transition-colors cursor-pointer flex items-center gap-1.5 ${
                format === 'thermal_80' ? 'bg-rose-600 text-white shadow-xs' : 'text-slate-400 hover:text-white'
              }`}
            >
              <Receipt className="w-3.5 h-3.5" />
              <span>3&quot; POS (80mm)</span>
            </button>
            <button
              type="button"
              onClick={() => setFormat('thermal_58')}
              className={`px-3 py-1 rounded font-medium transition-colors cursor-pointer flex items-center gap-1.5 ${
                format === 'thermal_58' ? 'bg-rose-600 text-white shadow-xs' : 'text-slate-400 hover:text-white'
              }`}
            >
              <Receipt className="w-3.5 h-3.5" />
              <span>2&quot; POS (58mm)</span>
            </button>
          </div>

          <div className="flex items-center gap-2">
            {transaction.totalAmount >= 50000 && (
              <button
                type="button"
                onClick={handleExportEWayBill}
                title="Download e-Way Bill JSON payload for NIC portal"
                className="px-3 py-1.5 text-xs font-semibold text-slate-200 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg shadow-2xs flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">e-Way Bill JSON</span>
              </button>
            )}

            <button
              type="button"
              onClick={handlePrint}
              className="px-4 py-1.5 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 rounded-lg shadow-2xs flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print {format === 'a4' ? 'A4 Invoice' : 'Receipt'}</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Invoice Body Content */}
        <div className="overflow-y-auto flex-1 p-4 sm:p-6 print:p-0 bg-slate-100/60 print:bg-white flex justify-center">
          {format === 'a4' ? (
            /* ========================================================================= */
            /* A4 FULL SHEET TAX INVOICE */
            /* ========================================================================= */
            <div className="invoice-a4-page bg-white w-full max-w-[210mm] min-h-[297mm] p-8 shadow-sm border border-slate-200 print:border-none print:shadow-none print:p-0 flex flex-col justify-between text-slate-900 text-xs">
              {/* Header copy line */}
              <div className="flex items-center justify-between text-[10px] text-slate-500 font-medium pb-2 border-b border-slate-200 mb-4">
                <span>{invoiceTitle}</span>
                <span className="uppercase tracking-wider font-semibold">
                  Original for Recipient / Duplicate for Transporter
                </span>
              </div>

              {/* Business Header + Invoice Meta */}
              <div className="flex items-start justify-between gap-6 pb-6 border-b border-slate-200">
                {/* Business Info */}
                <div className="flex items-start gap-4 flex-1">
                  {settings?.printShowLogo !== false && (
                    businessProfile?.logo ? (
                      <div className="w-16 h-16 rounded-lg border border-slate-200 p-1 flex items-center justify-center shrink-0">
                        <img
                          src={businessProfile.logo}
                          alt="Logo"
                          className="max-h-full max-w-full object-contain"
                        />
                      </div>
                    ) : (
                      <div
                        className="w-14 h-14 rounded-lg text-white flex items-center justify-center font-bold text-lg shrink-0"
                        style={{ backgroundColor: accentColor }}
                      >
                        {businessProfile?.businessName?.charAt(0) || 'A'}
                      </div>
                    )
                  )}

                  <div className="space-y-1">
                    <h1 className="text-xl font-bold tracking-tight text-slate-950 font-serif">
                      {businessProfile?.businessName || 'Business Firm'}
                    </h1>
                    <p className="text-xs text-slate-600 max-w-md whitespace-pre-line leading-relaxed">
                      {businessProfile?.address}
                    </p>
                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-700 pt-1 font-mono">
                      {businessProfile?.gstin && (
                        <span>
                          <strong className="font-sans font-semibold text-slate-900">GSTIN:</strong>{' '}
                          {businessProfile.gstin}
                        </span>
                      )}
                      {businessProfile?.phone && (
                        <span>
                          <strong className="font-sans font-semibold text-slate-900">Phone:</strong>{' '}
                          {businessProfile.phone}
                        </span>
                      )}
                      <span>
                        <strong className="font-sans font-semibold text-slate-900">State:</strong>{' '}
                        {businessProfile?.state} ({businessProfile?.stateCode})
                      </span>
                    </div>
                  </div>
                </div>

                {/* Invoice Meta Box */}
                <div className="text-right space-y-1.5 font-mono text-xs shrink-0 bg-slate-50 p-3 rounded-lg border border-slate-200">
                  <div className="text-sm font-bold text-slate-900">
                    <span className="font-sans text-xs text-slate-500 font-normal">
                      {transaction.type === 'payment_in'
                        ? 'Receipt No: '
                        : transaction.type === 'payment_out'
                        ? 'Voucher No: '
                        : transaction.type === 'sale_return'
                        ? 'Credit Note No: '
                        : transaction.type === 'purchase_return'
                        ? 'Debit Note No: '
                        : 'Invoice No: '}
                    </span>
                    {transaction.invoiceNo}
                  </div>
                  {transaction.originalInvoiceNo && (
                    <div className="text-blue-700 font-bold">
                      <span className="font-sans text-xs text-slate-500 font-normal">Original Ref: </span>
                      {transaction.originalInvoiceNo}
                    </div>
                  )}
                  {transaction.returnReason && (
                    <div className="text-slate-700">
                      <span className="font-sans text-xs text-slate-500">Reason: </span>
                      {transaction.returnReason}
                    </div>
                  )}
                  {transaction.referenceNo && (
                    <div className="text-slate-700">
                      <span className="font-sans text-xs text-slate-500">Payment Ref: </span>
                      {transaction.referenceNo}
                    </div>
                  )}
                  <div className="text-slate-600">
                    <span className="font-sans text-xs text-slate-500">Date: </span>
                    {formatDate(transaction.date)}
                  </div>
                  {transaction.dueDate && (
                    <div className="text-slate-600">
                      <span className="font-sans text-xs text-slate-500">Due Date: </span>
                      {formatDate(transaction.dueDate)}
                    </div>
                  )}
                  <div className="text-slate-600">
                    <span className="font-sans text-xs text-slate-500">Place of Supply: </span>
                    {transaction.stateOfSupply}
                  </div>
                  {transaction.vehicleNo && (
                    <div className="text-slate-600">
                      <span className="font-sans text-xs text-slate-500">Vehicle No: </span>
                      {transaction.vehicleNo}
                    </div>
                  )}
                </div>
              </div>

              {/* Bill To & Ship To Details */}
              <div className="grid grid-cols-2 gap-6 py-4 border-b border-slate-200">
                {/* Bill To */}
                <div>
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                    Bill To / Buyer
                  </span>
                  <div className="text-sm font-bold text-slate-900">{transaction.partyName}</div>
                  <p className="text-xs text-slate-600 mt-0.5 whitespace-pre-line leading-relaxed">
                    {transaction.billingAddress || 'Address on record'}
                  </p>
                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-700 mt-2 font-mono">
                    {transaction.partyGstin ? (
                      <span>
                        <strong className="font-sans font-semibold text-slate-900">GSTIN:</strong>{' '}
                        {transaction.partyGstin}
                      </span>
                    ) : (
                      <span className="text-slate-500 italic">Unregistered Buyer</span>
                    )}
                    {transaction.partyPhone && (
                      <span>
                        <strong className="font-sans font-semibold text-slate-900">Phone:</strong>{' '}
                        {transaction.partyPhone}
                      </span>
                    )}
                    <span>
                      <strong className="font-sans font-semibold text-slate-900">State:</strong>{' '}
                      {transaction.partyState} ({transaction.partyStateCode})
                    </span>
                  </div>
                </div>

                {/* Ship To */}
                <div>
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                    Ship To / Delivery Destination
                  </span>
                  <div className="text-xs font-semibold text-slate-800">
                    {transaction.shippingAddress ? transaction.partyName : 'Same as Billing Address'}
                  </div>
                  <p className="text-xs text-slate-600 mt-0.5 whitespace-pre-line leading-relaxed">
                    {transaction.shippingAddress || transaction.billingAddress}
                  </p>
                </div>
              </div>

              {/* Line Items Table OR Payment Details */}
              <div className="py-4 flex-1">
                {transaction.items.length === 0 ? (
                  <div className="border border-slate-300 rounded-lg p-5 bg-slate-50 space-y-4">
                    <div className="grid grid-cols-2 gap-4 pb-4 border-b border-slate-200">
                      <div>
                        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                          {transaction.type === 'payment_in' ? 'Amount Received' : 'Amount Paid'}
                        </span>
                        <div className="text-2xl font-bold font-mono text-slate-900 mt-1">
                          {formatINR(transaction.totalAmount)}
                        </div>
                        <div className="text-[11px] text-slate-600 font-serif italic mt-0.5">
                          {numberToIndianWords(transaction.totalAmount)}
                        </div>
                      </div>
                      <div className="text-right space-y-1">
                        <div>
                          <span className="text-slate-500 font-sans">Payment Mode: </span>
                          <strong className="capitalize text-slate-900">{transaction.paymentType ? transaction.paymentType.replace('_', ' ') : 'Cash'}</strong>
                        </div>
                        {transaction.referenceNo && (
                          <div>
                            <span className="text-slate-500 font-sans">Ref / UTR: </span>
                            <strong className="font-mono text-slate-900">{transaction.referenceNo}</strong>
                          </div>
                        )}
                      </div>
                    </div>

                    {transaction.invoiceLinks && transaction.invoiceLinks.length > 0 && (
                      <div>
                        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-2">
                          Allocated Against Outstanding Invoices
                        </span>
                        <table className="w-full text-left border-collapse border border-slate-300 text-xs">
                          <thead className="bg-slate-100 font-bold">
                            <tr>
                              <th className="py-1.5 px-3 border-r border-slate-300 w-12 text-center">#</th>
                              <th className="py-1.5 px-3 border-r border-slate-300">Invoice / Bill #</th>
                              <th className="py-1.5 px-3 text-right">Amount Allocated (₹)</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-200 font-mono">
                            {transaction.invoiceLinks.map((link, idx) => (
                              <tr key={link.invoiceId || idx}>
                                <td className="py-1.5 px-3 border-r border-slate-200 text-center text-slate-500">{idx + 1}</td>
                                <td className="py-1.5 px-3 border-r border-slate-200 font-bold">{link.invoiceNo}</td>
                                <td className="py-1.5 px-3 text-right font-bold text-slate-900">{formatINR(link.amountAllocated)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                ) : (
                  <table className="w-full text-left border-collapse border border-slate-300">
                    <thead>
                      <tr className="bg-slate-100 text-slate-800 font-bold border-b border-slate-300 text-[10px] uppercase tracking-wider">
                        <th className="py-2 px-2.5 border-r border-slate-300 text-center w-8">#</th>
                        <th className="py-2 px-3 border-r border-slate-300">Item Description</th>
                        <th className="py-2 px-2.5 border-r border-slate-300 text-center w-16">HSN</th>
                        <th className="py-2 px-2.5 border-r border-slate-300 text-right w-14">Qty</th>
                        <th className="py-2 px-2 border-r border-slate-300 text-center w-12">Unit</th>
                        <th className="py-2 px-2.5 border-r border-slate-300 text-right w-20">Rate (₹)</th>
                        <th className="py-2 px-2 border-r border-slate-300 text-center w-12">Tax %</th>
                        <th className="py-2 px-2.5 border-r border-slate-300 text-right w-20">Tax (₹)</th>
                        <th className="py-2 px-3 text-right w-24">Amount (₹)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 font-mono text-[11px]">
                      {transaction.items.map((item, idx) => (
                        <tr key={item.id || idx}>
                          <td className="py-2 px-2 text-center border-r border-slate-200 text-slate-500">
                            {idx + 1}
                          </td>
                          <td className="py-2 px-3 border-r border-slate-200 font-sans font-medium text-slate-900">
                            {item.name}
                          </td>
                          <td className="py-2 px-2 text-center border-r border-slate-200 text-slate-600">
                            {item.hsn || '-'}
                          </td>
                          <td className="py-2 px-2.5 text-right border-r border-slate-200 tabular-nums">
                            {item.qty}
                          </td>
                          <td className="py-2 px-2 text-center border-r border-slate-200 text-slate-600">
                            {item.unit}
                          </td>
                          <td className="py-2 px-2.5 text-right border-r border-slate-200 tabular-nums">
                            {formatINR(item.priceUnit, false)}
                          </td>
                          <td className="py-2 px-2 text-center border-r border-slate-200 text-slate-600">
                            {item.taxRate}%
                          </td>
                          <td className="py-2 px-2.5 text-right border-r border-slate-200 tabular-nums">
                            {formatINR(item.taxAmount, false)}
                          </td>
                          <td className="py-2 px-3 text-right font-bold text-slate-900 tabular-nums">
                            {formatINR(item.totalAmount, false)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>

              {/* HSN/SAC Tax Summary Table */}
              {hsnList.length > 0 && (
                <div className="pb-4">
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                    GST Tax Summary by HSN / SAC Code
                  </span>
                  <table className="w-full text-left border-collapse border border-slate-300 text-[10px] font-mono">
                    <thead>
                      <tr className="bg-slate-100 text-slate-700 font-bold border-b border-slate-300">
                        <th className="py-1 px-2 border-r border-slate-300">HSN/SAC</th>
                        <th className="py-1 px-2 border-r border-slate-300 text-right">Taxable Val (₹)</th>
                        {!isInterState && (
                          <>
                            <th className="py-1 px-2 border-r border-slate-300 text-right">CGST (₹)</th>
                            <th className="py-1 px-2 border-r border-slate-300 text-right">SGST (₹)</th>
                          </>
                        )}
                        {isInterState && (
                          <th className="py-1 px-2 border-r border-slate-300 text-right">IGST (₹)</th>
                        )}
                        <th className="py-1 px-2 text-right">Total Tax (₹)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {hsnList.map((h, i) => (
                        <tr key={i}>
                          <td className="py-1 px-2 border-r border-slate-200 font-semibold">{h.hsn}</td>
                          <td className="py-1 px-2 border-r border-slate-200 text-right tabular-nums">
                            {formatINR(h.taxable, false)}
                          </td>
                          {!isInterState && (
                            <>
                              <td className="py-1 px-2 border-r border-slate-200 text-right tabular-nums">
                                {formatINR(h.cgst, false)} ({h.taxRate / 2}%)
                              </td>
                              <td className="py-1 px-2 border-r border-slate-200 text-right tabular-nums">
                                {formatINR(h.sgst, false)} ({h.taxRate / 2}%)
                              </td>
                            </>
                          )}
                          {isInterState && (
                            <td className="py-1 px-2 border-r border-slate-200 text-right tabular-nums">
                              {formatINR(h.igst, false)} ({h.taxRate}%)
                            </td>
                          )}
                          <td className="py-1 px-2 text-right font-bold tabular-nums">
                            {formatINR(h.totalTax, false)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Bottom Calculations & Amount in Words */}
              <div className="grid grid-cols-12 gap-4 py-3 border-t border-slate-200">
                {/* Left Column: Words & Bank & UPI QR */}
                <div className="col-span-7 space-y-3">
                  {/* Total in Words */}
                  <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-200">
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                      Total Amount in Words:
                    </span>
                    <div className="text-xs font-semibold text-slate-900 italic mt-0.5">
                      {numberToIndianWords(transaction.totalAmount)}
                    </div>
                  </div>

                  {/* Bank Details & QR */}
                  {settings?.printShowBankDetails !== false && (
                    <div className="flex items-start gap-4 p-3 bg-slate-50 rounded-lg border border-slate-200">
                      <div className="flex-1 space-y-1 text-[11px] font-mono">
                        <span className="text-[10px] font-bold text-slate-700 uppercase tracking-wider block font-sans mb-1">
                          Bank & Payment Details
                        </span>
                        {businessProfile?.bankDetails?.bankName && (
                          <div>Bank: <span className="font-semibold">{businessProfile.bankDetails.bankName}</span></div>
                        )}
                        {businessProfile?.bankDetails?.accountNo && (
                          <div>A/C No: <span className="font-semibold">{businessProfile.bankDetails.accountNo}</span></div>
                        )}
                        {businessProfile?.bankDetails?.ifsc && (
                          <div>IFSC: <span className="font-semibold uppercase">{businessProfile.bankDetails.ifsc}</span></div>
                        )}
                        {businessProfile?.bankDetails?.upiId && (
                          <div>UPI ID: <span className="font-semibold text-slate-900">{businessProfile.bankDetails.upiId}</span></div>
                        )}
                      </div>

                      {qrCodeUrl && (
                        <div className="w-20 h-20 bg-white p-1 rounded-md border border-slate-300 flex flex-col items-center justify-center shrink-0">
                          <img src={qrCodeUrl} alt="UPI QR" className="w-full h-full object-contain" />
                          <span className="text-[8px] font-semibold text-slate-600 mt-0.5">Scan to Pay</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Right Column: Financial Totals */}
                <div className="col-span-5 bg-slate-50 p-3.5 rounded-lg border border-slate-200 space-y-2 text-xs font-mono">
                  <div className="flex items-center justify-between text-slate-600">
                    <span className="font-sans">Taxable Subtotal:</span>
                    <span className="tabular-nums font-semibold">{formatINR(transaction.subtotal)}</span>
                  </div>

                  {isInterState ? (
                    <div className="flex items-center justify-between text-slate-600">
                      <span className="font-sans">IGST:</span>
                      <span className="tabular-nums">{formatINR(transaction.igst)}</span>
                    </div>
                  ) : (
                    <>
                      <div className="flex items-center justify-between text-slate-600">
                        <span className="font-sans">CGST:</span>
                        <span className="tabular-nums">{formatINR(transaction.cgst)}</span>
                      </div>
                      <div className="flex items-center justify-between text-slate-600">
                        <span className="font-sans">SGST:</span>
                        <span className="tabular-nums">{formatINR(transaction.sgst)}</span>
                      </div>
                    </>
                  )}

                  {transaction.roundOff !== 0 && (
                    <div className="flex items-center justify-between text-slate-500 text-[11px]">
                      <span className="font-sans">Round Off:</span>
                      <span className="tabular-nums">{formatINR(transaction.roundOff)}</span>
                    </div>
                  )}

                  <div className="border-t border-slate-300 pt-2 flex items-center justify-between text-sm font-bold text-slate-950 font-sans">
                    <span>Grand Total:</span>
                    <span
                      className="font-mono text-base tabular-nums"
                      style={{ color: accentColor }}
                    >
                      {formatINR(transaction.totalAmount)}
                    </span>
                  </div>

                  <div className="border-t border-slate-200 pt-2 flex items-center justify-between text-slate-700 text-[11px]">
                    <span className="font-sans">Received Amount:</span>
                    <span className="tabular-nums font-semibold text-emerald-700">
                      {formatINR(transaction.receivedAmount)}
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-slate-900 font-bold text-xs pt-1">
                    <span className="font-sans">Balance Due:</span>
                    <span className="tabular-nums text-rose-600 font-mono">
                      {formatINR(transaction.balanceDue)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Terms & Authorized Signatory */}
              <div className="grid grid-cols-2 gap-6 pt-4 border-t border-slate-200 mt-4">
                <div>
                  {settings?.printShowTerms !== false && (
                    <>
                      <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                        Terms & Conditions
                      </span>
                      <p className="text-[11px] text-slate-600 whitespace-pre-line leading-relaxed">
                        {businessProfile?.terms ||
                          '1. Goods once sold will not be taken back.\n2. Subject to local jurisdiction only.'}
                      </p>
                    </>
                  )}
                </div>

                <div className="flex flex-col items-end justify-between h-24 text-right">
                  {settings?.printShowSignatory !== false && (
                    <>
                      <span className="text-xs font-bold text-slate-900">
                        For {businessProfile?.businessName || 'Business Firm'}
                      </span>
                      <div className="border-t border-slate-400 w-48 pt-1 text-[11px] text-slate-600 text-center font-medium">
                        {businessProfile?.signatoryText || 'Authorized Signatory'}
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>
          ) : (
            /* ========================================================================= */
            /* THERMAL POS RECEIPT (80mm / 58mm) */
            /* ========================================================================= */
            <div
              className={`bg-white p-4 shadow-sm border border-slate-200 print:border-none print:shadow-none print:p-0 font-mono text-slate-900 ${
                format === 'thermal_80'
                  ? 'thermal-receipt-80 w-[78mm] text-xs'
                  : 'thermal-receipt-58 w-[56mm] text-[10px]'
              }`}
            >
              {/* Receipt Header */}
              <div className="text-center pb-2 border-b border-dashed border-slate-400 space-y-1">
                <h2 className="font-bold text-sm tracking-tight uppercase">
                  {businessProfile?.businessName || 'Amman Store'}
                </h2>
                <p className="text-[10px] leading-tight text-slate-600">{businessProfile?.address}</p>
                {businessProfile?.gstin && (
                  <p className="text-[10px] font-bold">GSTIN: {businessProfile.gstin}</p>
                )}
                {businessProfile?.phone && (
                  <p className="text-[10px]">Ph: {businessProfile.phone}</p>
                )}
              </div>

              {/* Receipt Meta */}
              <div className="py-2 border-b border-dashed border-slate-400 text-[10px] space-y-0.5">
                <div className="flex justify-between">
                  <span>Bill: {transaction.invoiceNo}</span>
                  <span>{formatDate(transaction.date)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Customer: {transaction.partyName}</span>
                </div>
                {transaction.partyPhone && (
                  <div>Phone: {transaction.partyPhone}</div>
                )}
              </div>

              {/* Itemized Table */}
              <div className="py-2 border-b border-dashed border-slate-400">
                <div className="flex justify-between font-bold pb-1 text-[10px] border-b border-slate-300">
                  <span className="flex-1">Item</span>
                  <span className="w-12 text-center">Qty</span>
                  <span className="w-14 text-right">Amount</span>
                </div>
                <div className="divide-y divide-slate-100 pt-1 space-y-1">
                  {transaction.items.map((item, idx) => (
                    <div key={idx} className="pt-1">
                      <div className="font-semibold text-slate-900 truncate">{item.name}</div>
                      <div className="flex justify-between text-[10px] text-slate-600">
                        <span>
                          {item.qty} {item.unit} @ ₹{item.priceUnit}
                        </span>
                        <span className="font-bold text-slate-900">
                          {formatINR(item.totalAmount, false)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Totals */}
              <div className="py-2 border-b border-dashed border-slate-400 space-y-1 text-[11px]">
                <div className="flex justify-between">
                  <span>Subtotal:</span>
                  <span>{formatINR(transaction.subtotal)}</span>
                </div>
                {!isInterState && (
                  <>
                    <div className="flex justify-between text-[10px] text-slate-600">
                      <span>CGST:</span>
                      <span>{formatINR(transaction.cgst)}</span>
                    </div>
                    <div className="flex justify-between text-[10px] text-slate-600">
                      <span>SGST:</span>
                      <span>{formatINR(transaction.sgst)}</span>
                    </div>
                  </>
                )}
                {isInterState && (
                  <div className="flex justify-between text-[10px] text-slate-600">
                    <span>IGST:</span>
                    <span>{formatINR(transaction.igst)}</span>
                  </div>
                )}
                {transaction.roundOff !== 0 && (
                  <div className="flex justify-between text-[10px] text-slate-600">
                    <span>Round Off:</span>
                    <span>{formatINR(transaction.roundOff)}</span>
                  </div>
                )}
                <div className="flex justify-between font-bold text-sm pt-1 border-t border-slate-400 text-slate-950">
                  <span>NET TOTAL:</span>
                  <span>{formatINR(transaction.totalAmount)}</span>
                </div>
                <div className="flex justify-between text-[10px] text-emerald-700">
                  <span>Paid:</span>
                  <span>{formatINR(transaction.receivedAmount)}</span>
                </div>
                {transaction.balanceDue > 0 && (
                  <div className="flex justify-between text-[10px] font-bold text-rose-700">
                    <span>Balance Due:</span>
                    <span>{formatINR(transaction.balanceDue)}</span>
                  </div>
                )}
              </div>

              {/* Thermal UPI QR */}
              {qrCodeUrl && (
                <div className="py-3 flex flex-col items-center justify-center border-b border-dashed border-slate-400 text-center">
                  <div className="w-24 h-24 p-1 bg-white border border-slate-400 rounded-sm">
                    <img src={qrCodeUrl} alt="UPI QR" className="w-full h-full object-contain" />
                  </div>
                  <span className="text-[9px] font-bold uppercase mt-1">Scan to Pay via UPI</span>
                </div>
              )}

              {/* Receipt Footer */}
              <div className="pt-3 text-center text-[10px] text-slate-600 space-y-1">
                <p className="font-bold">THANK YOU! VISIT AGAIN</p>
                <p className="text-[9px] text-slate-500">Amman Billing & Accounting</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
