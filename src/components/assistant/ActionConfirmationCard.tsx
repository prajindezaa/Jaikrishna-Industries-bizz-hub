/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Jaikrishna Industries — Action Confirmation Card Component
 * Presents proposed changes (what will change, for whom, resolved dates, risk level)
 * with Confirm, Edit, and Cancel controls.
 */

import React, { useState } from 'react';
import {
  AlertTriangle,
  Calendar,
  Clock,
  User,
  CheckCircle2,
  XCircle,
  Edit2,
  ShieldAlert,
  Loader2,
  ArrowRight,
} from 'lucide-react';
import { RiskLevel } from '../../shared/schemas';

export interface ActionConfirmationCardProps {
  pendingAction: {
    id: string;
    catalog: string;
    tool: string;
    riskLevel: RiskLevel;
    requiresSecondConfirmation: boolean;
    preview: {
      summary: string;
      summaryTa?: string;
      details?: string;
      before?: Record<string, any>;
      after: Record<string, any>;
      resolvedDates?: Array<{
        field: string;
        rawInput: string;
        resolvedIst: string;
        iso: string;
        warning?: string;
      }>;
    };
    parametersHash: string;
    expiresAt: string;
  };
  onConfirm: (actionId: string, parametersHash: string, typedConfirmText?: string) => Promise<void>;
  onCancel: (actionId: string) => void;
}

export const ActionConfirmationCard: React.FC<ActionConfirmationCardProps> = ({
  pendingAction,
  onConfirm,
  onCancel,
}) => {
  const [loading, setLoading] = useState(false);
  const [typedConfirmation, setTypedConfirmation] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [editedTitle, setEditedTitle] = useState(pendingAction.preview.after?.title || '');
  const [cancelled, setCancelled] = useState(false);

  const { preview, riskLevel, requiresSecondConfirmation, id, parametersHash, expiresAt } = pendingAction;
  const isExpired = new Date(expiresAt).getTime() < Date.now();

  const handleConfirmTap = async () => {
    if (requiresSecondConfirmation && typedConfirmation.trim().toUpperCase() !== 'CONFIRM') {
      alert('Please type CONFIRM to authorize this high-risk change.');
      return;
    }
    setLoading(true);
    try {
      await onConfirm(id, parametersHash);
    } finally {
      setLoading(false);
    }
  };

  const handleCancelTap = () => {
    setCancelled(true);
    onCancel(id);
  };

  if (cancelled) {
    return (
      <div className="my-2 p-3 rounded-xl border border-stone-200 bg-stone-50 text-xs text-stone-500 flex items-center gap-2">
        <XCircle className="w-4 h-4 text-stone-400" />
        <span>Action cancelled by user.</span>
      </div>
    );
  }

  const riskBadgeStyles: Record<RiskLevel, string> = {
    low: 'bg-emerald-50 text-emerald-800 border-emerald-200',
    medium: 'bg-amber-50 text-amber-800 border-amber-200',
    high: 'bg-rose-50 text-rose-800 border-rose-200',
  };

  return (
    <div className="my-3 rounded-xl border border-amber-200/90 bg-amber-50/40 p-4 text-stone-800 shadow-xs max-w-xl">
      {/* Header Badge */}
      <div className="flex items-center justify-between pb-2.5 border-b border-amber-200/70 text-xs">
        <div className="flex items-center gap-1.5 font-semibold text-amber-900">
          <Calendar className="w-4 h-4 text-amber-700" />
          <span>Proposed Action Preview</span>
        </div>
        <div className="flex items-center gap-2">
          <span
            className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${
              riskBadgeStyles[riskLevel] || riskBadgeStyles.low
            }`}
          >
            {riskLevel} Risk
          </span>
          {isExpired && (
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-stone-200 text-stone-600">
              Expired
            </span>
          )}
        </div>
      </div>

      {/* Main Proposal Summary */}
      <div className="py-3 space-y-2">
        <h4 className="font-semibold text-stone-900 text-sm font-display">
          {preview.summary}
        </h4>
        {preview.summaryTa && (
          <p className="text-xs text-stone-500 font-tamil">
            {preview.summaryTa}
          </p>
        )}

        {/* Resolved Dates */}
        {preview.resolvedDates && preview.resolvedDates.length > 0 && (
          <div className="space-y-1.5 pt-1">
            {preview.resolvedDates.map((rd, i) => (
              <div key={i} className="text-xs bg-white/80 p-2.5 rounded-lg border border-amber-200/50 space-y-1">
                <div className="flex items-center gap-1.5 text-stone-700 font-medium">
                  <Clock className="w-3.5 h-3.5 text-amber-700" />
                  <span>Resolved Time: <strong>{rd.resolvedIst}</strong></span>
                </div>
                {rd.warning && (
                  <div className="flex items-start gap-1 text-[11px] text-amber-800 bg-amber-100/50 p-1.5 rounded">
                    <AlertTriangle className="w-3.5 h-3.5 shrink-0 text-amber-700 mt-0.5" />
                    <span>{rd.warning}</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Before / After Preview */}
        {preview.before && Object.keys(preview.before).length > 0 && (
          <div className="grid grid-cols-2 gap-2 text-[11px] pt-1">
            <div className="bg-stone-100/80 p-2 rounded border border-stone-200">
              <span className="font-bold text-stone-500 block mb-1">Current Value:</span>
              <pre className="whitespace-pre-wrap font-mono text-[10px] text-stone-700">
                {JSON.stringify(preview.before, null, 2)}
              </pre>
            </div>
            <div className="bg-emerald-50/80 p-2 rounded border border-emerald-200">
              <span className="font-bold text-emerald-800 block mb-1">New Value:</span>
              <pre className="whitespace-pre-wrap font-mono text-[10px] text-emerald-900">
                {JSON.stringify(preview.after, null, 2)}
              </pre>
            </div>
          </div>
        )}
      </div>

      {/* Second Confirmation Input for High Risk */}
      {requiresSecondConfirmation && !isExpired && (
        <div className="my-2 p-2.5 rounded-lg bg-rose-100/70 border border-rose-300 text-xs text-rose-900 space-y-1.5">
          <div className="flex items-center gap-1.5 font-bold">
            <ShieldAlert className="w-4 h-4 text-rose-700" />
            <span>High Risk Action Requires Explicit Confirmation</span>
          </div>
          <p className="text-[11px]">Type <strong>CONFIRM</strong> below to execute this change:</p>
          <input
            type="text"
            value={typedConfirmation}
            onChange={(e) => setTypedConfirmation(e.target.value)}
            placeholder="Type CONFIRM"
            className="w-full px-2.5 py-1 text-xs uppercase font-mono border border-rose-300 rounded bg-white text-stone-900"
          />
        </div>
      )}

      {/* Action Footer Controls */}
      <div className="pt-2 border-t border-amber-200/70 flex items-center justify-between gap-2">
        <button
          onClick={handleCancelTap}
          disabled={loading}
          className="px-3 py-1.5 text-xs text-stone-600 hover:text-stone-900 font-medium transition-colors"
        >
          Cancel
        </button>

        <div className="flex items-center gap-2">
          {riskLevel === 'low' && !requiresSecondConfirmation && !isExpired && (
            <span className="text-[11px] text-stone-500 italic hidden sm:inline">
              (Say &quot;Confirm&quot; / &quot;சரி&quot; or tap)
            </span>
          )}
          <button
            onClick={handleConfirmTap}
            disabled={loading || isExpired}
            className="flex items-center gap-1.5 px-4 py-1.5 text-xs font-semibold rounded-lg bg-[#881337] hover:bg-[#9f1239] text-white shadow-xs transition-colors disabled:opacity-50"
          >
            {loading ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Executing...</span>
              </>
            ) : (
              <>
                <CheckCircle2 className="w-3.5 h-3.5 text-amber-300" />
                <span>Confirm Change</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
