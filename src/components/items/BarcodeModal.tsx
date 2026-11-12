import React, { useState, useRef } from 'react';
import { X, Printer, Barcode, Copy, Check, Sliders } from 'lucide-react';
import { Item, BusinessProfile } from '../../types';
import { formatINR } from '../../utils/formatters';

interface BarcodeModalProps {
  isOpen: boolean;
  onClose: () => void;
  item: Item | null;
  businessProfile?: BusinessProfile | null;
}

export const BarcodeModal: React.FC<BarcodeModalProps> = ({
  isOpen,
  onClose,
  item,
  businessProfile,
}) => {
  const [labelCount, setLabelCount] = useState(1);
  const [showPrice, setShowPrice] = useState(true);
  const [showBusinessName, setShowBusinessName] = useState(true);
  const [labelSize, setLabelSize] = useState<'single' | 'sheet_24'>('single');

  if (!isOpen || !item) return null;

  const barcodeValue = item.itemCode || item.hsn || String(item.id).substring(0, 8);

  const handlePrint = () => {
    window.print();
  };

  // Simple clean SVG barcode generator (Code 128 style representation)
  const renderBarcodeSVG = (value: string) => {
    const bars: boolean[] = [];
    // Deterministic visual bars based on characters
    let seed = 0;
    for (let i = 0; i < value.length; i++) {
      seed = (seed * 31 + value.charCodeAt(i)) % 10007;
    }

    // Generate bar pattern
    bars.push(true, false, true, true); // start pattern
    for (let i = 0; i < Math.max(12, value.length * 4); i++) {
      const bit = ((seed >> (i % 16)) & 1) === 1;
      bars.push(bit, !bit, bit);
      seed = (seed * 11 + 7) % 10007;
    }
    bars.push(true, true, false, true); // stop pattern

    return (
      <svg className="w-full h-10" viewBox={`0 0 ${bars.length * 2} 40`} preserveAspectRatio="none">
        {bars.map((isBar, idx) =>
          isBar ? (
            <rect key={idx} x={idx * 2} y={0} width="1.8" height="40" fill="#000000" />
          ) : null
        )}
      </svg>
    );
  };

  const renderSingleLabel = (key?: number) => (
    <div
      key={key}
      className="w-48 p-2.5 bg-white border border-slate-300 rounded-md flex flex-col items-center justify-between text-center select-none shadow-2xs print:shadow-none print:border-dashed print:border-slate-400"
      style={{ minHeight: '110px' }}
    >
      {showBusinessName && (
        <span className="text-[9px] font-bold text-slate-800 uppercase truncate max-w-full">
          {businessProfile?.businessName || 'Amman Store'}
        </span>
      )}
      <div className="text-[11px] font-bold text-slate-900 truncate max-w-full my-0.5">
        {item.name}
      </div>

      <div className="w-full px-1 py-0.5">{renderBarcodeSVG(barcodeValue)}</div>

      <div className="text-[10px] font-mono font-semibold text-slate-700 tracking-wider">
        {barcodeValue}
      </div>

      {showPrice && (
        <div className="text-xs font-bold text-slate-900 mt-0.5">
          MRP: {formatINR(item.salePrice)}
        </div>
      )}
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 backdrop-blur-xs p-3 overflow-y-auto print:p-0 print:bg-white print:fixed print:inset-0">
      <div className="w-full max-w-2xl bg-white rounded-xl shadow-2xl border border-slate-200 overflow-hidden my-4 flex flex-col max-h-[92vh] print:max-h-none print:shadow-none print:border-none print:w-full print:m-0">
        {/* Header */}
        <div className="no-print flex items-center justify-between px-6 py-4 bg-slate-900 text-white shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-rose-600/30 text-rose-400 flex items-center justify-center">
              <Barcode className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold">Barcode Label Generator</h3>
              <p className="text-[11px] text-slate-400">{item.name} · Code: {barcodeValue}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-white transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Controls - Hidden on print */}
        <div className="no-print p-4 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-4 text-xs">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-slate-700">Layout:</span>
              <select
                value={labelSize}
                onChange={(e) => setLabelSize(e.target.value as any)}
                className="px-2.5 py-1.5 bg-white border border-slate-300 rounded-md text-xs font-medium"
              >
                <option value="single">Single Label Preview</option>
                <option value="sheet_24">A4 Sheet (24 Labels)</option>
              </select>
            </div>

            <label className="flex items-center gap-1.5 cursor-pointer font-medium text-slate-700">
              <input
                type="checkbox"
                checked={showPrice}
                onChange={(e) => setShowPrice(e.target.checked)}
                className="rounded text-rose-600"
              />
              <span>Show Price</span>
            </label>

            <label className="flex items-center gap-1.5 cursor-pointer font-medium text-slate-700">
              <input
                type="checkbox"
                checked={showBusinessName}
                onChange={(e) => setShowBusinessName(e.target.checked)}
                className="rounded text-rose-600"
              />
              <span>Show Firm Name</span>
            </label>
          </div>

          <button
            type="button"
            onClick={handlePrint}
            className="px-4 py-1.5 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 rounded-lg shadow-sm flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Print Labels</span>
          </button>
        </div>

        {/* Preview Area */}
        <div className="p-6 overflow-y-auto flex-1 bg-slate-100/60 print:bg-white flex justify-center items-start">
          {labelSize === 'single' ? (
            <div className="p-4 bg-white rounded-lg shadow-xs border border-slate-200">
              {renderSingleLabel()}
            </div>
          ) : (
            <div className="w-full max-w-[210mm] bg-white p-6 shadow-xs border border-slate-200 grid grid-cols-3 sm:grid-cols-4 gap-3 print:border-none print:shadow-none print:p-0">
              {Array.from({ length: 24 }).map((_, i) => renderSingleLabel(i))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
