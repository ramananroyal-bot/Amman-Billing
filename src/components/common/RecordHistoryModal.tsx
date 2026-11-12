import React from 'react';
import { X, History, Clock, FileText, CheckCircle2, AlertCircle, Ban, ArrowRightCircle } from 'lucide-react';
import { Transaction, Party, Item } from '../../types';
import { formatDate } from '../../utils/formatters';

interface HistoryEvent {
  title: string;
  timestamp: string;
  description: string;
  type: 'create' | 'update' | 'payment' | 'cancel' | 'convert';
}

interface RecordHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  recordTitle: string;
  recordSubtitle?: string;
  record: Transaction | Party | Item | null;
}

export const RecordHistoryModal: React.FC<RecordHistoryModalProps> = ({
  isOpen,
  onClose,
  recordTitle,
  recordSubtitle,
  record,
}) => {
  if (!isOpen || !record) return null;

  // Build events chronological timeline
  const events: HistoryEvent[] = [];

  if ('createdAt' in record && record.createdAt) {
    events.push({
      title: 'Record Created',
      timestamp: record.createdAt,
      description: 'Initial entry created in IndexedDB.',
      type: 'create',
    });
  }

  // If transaction has specific events
  if ('type' in record && 'invoiceNo' in record) {
    const tx = record as Transaction;

    if (tx.deliveryDate) {
      events.push({
        title: 'Dispatched / Delivery Date',
        timestamp: tx.deliveryDate,
        description: `Scheduled delivery for vehicle: ${tx.vehicleNo || 'Self / Courier'}`,
        type: 'update',
      });
    }

    if (tx.receivedAmount && tx.receivedAmount > 0) {
      events.push({
        title: 'Payment Recorded',
        timestamp: tx.updatedAt || tx.date,
        description: `Received / Paid amount recorded: ₹${tx.receivedAmount.toFixed(2)}. Remaining balance: ₹${tx.balanceDue.toFixed(2)}.`,
        type: 'payment',
      });
    }

    if (tx.challanStatus === 'converted') {
      events.push({
        title: 'Converted To Sale',
        timestamp: tx.updatedAt || tx.date,
        description: 'Challan successfully converted to confirmed GST Sale Invoice. Stock decremented.',
        type: 'convert',
      });
    }

    if (tx.status === 'cancelled') {
      events.push({
        title: 'Invoice Cancelled',
        timestamp: tx.updatedAt || tx.date,
        description: 'Transaction cancelled. Stock and party balances reversed.',
        type: 'cancel',
      });
    }
  }

  if ('updatedAt' in record && record.updatedAt && record.updatedAt !== record.createdAt) {
    events.push({
      title: 'Last Modified',
      timestamp: record.updatedAt,
      description: 'Record details or amounts modified and saved.',
      type: 'update',
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-in fade-in duration-100">
      <div className="w-full max-w-lg bg-white rounded-xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 bg-slate-900 text-white shrink-0">
          <div className="flex items-center gap-2">
            <History className="w-4 h-4 text-rose-500" />
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider">Audit & Activity History</h3>
              <p className="text-[11px] text-slate-400 font-mono">{recordTitle}</p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-white cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Subtitle */}
        {recordSubtitle && (
          <div className="px-5 py-2.5 bg-slate-50 border-b border-slate-200 text-xs text-slate-600 font-medium">
            {recordSubtitle}
          </div>
        )}

        {/* Timeline Content */}
        <div className="p-6 overflow-y-auto flex-1">
          {events.length > 0 ? (
            <div className="relative pl-6 border-l-2 border-slate-200 space-y-6">
              {events.map((event, idx) => {
                const dateObj = new Date(event.timestamp);
                const formattedTime = !isNaN(dateObj.getTime())
                  ? dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                  : '';
                const formattedDate = !isNaN(dateObj.getTime())
                  ? formatDate(event.timestamp.split('T')[0])
                  : event.timestamp;

                return (
                  <div key={idx} className="relative group">
                    {/* Circle icon on line */}
                    <div className="absolute -left-[31px] top-0.5 w-4 h-4 rounded-full bg-white border-2 border-slate-400 flex items-center justify-center">
                      <div
                        className={`w-1.5 h-1.5 rounded-full ${
                          event.type === 'cancel'
                            ? 'bg-rose-500'
                            : event.type === 'convert' || event.type === 'payment'
                            ? 'bg-emerald-500'
                            : 'bg-slate-700'
                        }`}
                      />
                    </div>

                    <div>
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-bold text-slate-900">{event.title}</span>
                        <span className="text-[11px] text-slate-400 font-mono">
                          {formattedDate} {formattedTime}
                        </span>
                      </div>
                      <p className="text-xs text-slate-600 mt-1 leading-relaxed bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                        {event.description}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="py-12 text-center text-xs text-slate-400">
              <Clock className="w-8 h-8 text-slate-300 mx-auto mb-2" />
              <p className="font-semibold text-slate-600">No activity history recorded yet</p>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Modifications, payments, and conversions will appear here.
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 bg-slate-50 border-t border-slate-200 flex justify-end shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-300 hover:bg-slate-100 rounded-lg cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
