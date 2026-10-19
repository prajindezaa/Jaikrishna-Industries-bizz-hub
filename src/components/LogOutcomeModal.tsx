/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Phone, MessageSquare, X, Check, Calendar, Clock } from 'lucide-react';
import { Customer, OutreachLog } from '../types';
import { useLanguage } from '../context/LanguageContext';
import { formatPhoneDisplay } from '../lib/phone';
import { useAuth } from '../context/AuthContext';

interface LogOutcomeModalProps {
  isOpen: boolean;
  onClose: () => void;
  customer: Customer;
  channel: 'Call' | 'WhatsApp';
  onSaveOutcome: (outcome: OutreachLog, updatedNextFollowUp?: string) => void;
}

export const LogOutcomeModal: React.FC<LogOutcomeModalProps> = ({
  isOpen,
  onClose,
  customer,
  channel,
  onSaveOutcome,
}) => {
  const { t } = useLanguage();
  const { member } = useAuth();

  const [outcome, setOutcome] = useState<OutreachLog['outcome']>('Answered');
  const [note, setNote] = useState('');
  const [nextFollowUp, setNextFollowUp] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() + 3);
    return d.toISOString().slice(0, 10);
  });

  if (!isOpen) return null;

  const outcomes: OutreachLog['outcome'][] = [
    'Answered',
    'No answer',
    'Interested',
    'Call later',
    'Not interested',
  ];

  const handleQuickFollowUp = (daysAhead: number) => {
    const d = new Date();
    d.setDate(d.getDate() + daysAhead);
    setNextFollowUp(d.toISOString().slice(0, 10));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const log: OutreachLog = {
      channel,
      outcome,
      note,
      nextFollowUp,
      loggedBy: member?.email || 'prajindezaa142@gmail.com',
      loggedAt: new Date().toISOString(),
    };
    onSaveOutcome(log, nextFollowUp);
    onClose();
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs"
    >
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl border border-stone-200">
        <div className="flex items-center justify-between pb-3 border-b border-stone-100">
          <div className="flex items-center gap-2">
            <div
              className={`p-2 rounded-lg ${
                channel === 'Call' ? 'bg-emerald-100 text-emerald-800' : 'bg-green-100 text-green-800'
              }`}
            >
              {channel === 'Call' ? <Phone className="w-4 h-4" /> : <MessageSquare className="w-4 h-4" />}
            </div>
            <div>
              <h3 className="text-sm font-bold text-stone-900 font-display">
                Log {channel} Outcome
              </h3>
              <p className="text-[11px] text-stone-500 font-mono">
                {customer.companyName} ({formatPhoneDisplay(customer.phone)})
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 text-stone-400 hover:text-stone-600 rounded-lg">
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          {/* Outcome Buttons */}
          <div>
            <label className="block text-xs font-semibold text-stone-700 mb-2">Call/Message Outcome</label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {outcomes.map((o) => (
                <button
                  key={o}
                  type="button"
                  onClick={() => setOutcome(o)}
                  className={`px-3 py-2 text-xs font-medium rounded-lg border text-center transition-all ${
                    outcome === o
                      ? 'bg-[#881337] text-white border-[#881337] font-semibold shadow-xs'
                      : 'bg-stone-50 text-stone-700 border-stone-200 hover:bg-stone-100'
                  }`}
                >
                  {o}
                </button>
              ))}
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs font-semibold text-stone-700 mb-1">Conversation Note</label>
            <textarea
              rows={2}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="e.g. Inquired about pure bhimseni camphor rates, requested sample to Kovai shop..."
              className="w-full px-3 py-2 text-xs border border-stone-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-600/30"
            />
          </div>

          {/* Next Follow-Up Date */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-semibold text-stone-700">Next Follow-Up Date</label>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => handleQuickFollowUp(1)}
                  className="px-2 py-0.5 text-[10px] font-mono text-stone-600 bg-stone-100 hover:bg-stone-200 rounded"
                >
                  Tomorrow
                </button>
                <button
                  type="button"
                  onClick={() => handleQuickFollowUp(3)}
                  className="px-2 py-0.5 text-[10px] font-mono text-stone-600 bg-stone-100 hover:bg-stone-200 rounded"
                >
                  +3 Days
                </button>
                <button
                  type="button"
                  onClick={() => handleQuickFollowUp(7)}
                  className="px-2 py-0.5 text-[10px] font-mono text-stone-600 bg-stone-100 hover:bg-stone-200 rounded"
                >
                  +1 Week
                </button>
              </div>
            </div>
            <input
              type="date"
              value={nextFollowUp}
              onChange={(e) => setNextFollowUp(e.target.value)}
              className="w-full px-3 py-2 text-xs border border-stone-300 rounded-lg"
            />
          </div>

          {/* Buttons */}
          <div className="flex items-center justify-end gap-2 pt-3 border-t border-stone-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-stone-700 hover:bg-stone-100 rounded-lg"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-xs font-semibold text-white bg-[#881337] hover:bg-[#701A24] rounded-lg shadow-xs"
            >
              Save Outcome &amp; Update Follow-Up
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
