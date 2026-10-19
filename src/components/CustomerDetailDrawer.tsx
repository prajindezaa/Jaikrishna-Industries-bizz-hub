/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import {
  X,
  Phone,
  MessageSquare,
  MapPin,
  Calendar,
  Clock,
  Trash2,
  CheckCircle,
  Tag,
  UserCheck,
  Building2,
  History,
  FileText,
  AlertTriangle,
  Edit3,
  Layers,
} from 'lucide-react';
import { Customer, CustomerStatus, LeadStage } from '../types';
import { useLanguage } from '../context/LanguageContext';
import { formatPhoneDisplay, getTelLink, getWhatsAppLink } from '../lib/phone';
import { useAuth } from '../context/AuthContext';
import { useApp } from '../context/AppContext';
import { CustomerGroupBadge } from './customers/CustomerGroupBadge';

interface CustomerDetailDrawerProps {
  customer: Customer | null;
  onClose: () => void;
  onUpdateCustomer: (updated: Customer) => void;
  onDeleteCustomer: (id: string) => void;
  onLogOutcome: (channel: 'Call' | 'WhatsApp') => void;
  onEdit?: (customer: Customer) => void;
}

export const CustomerDetailDrawer: React.FC<CustomerDetailDrawerProps> = ({
  customer,
  onClose,
  onUpdateCustomer,
  onDeleteCustomer,
  onLogOutcome,
  onEdit,
}) => {
  const { t } = useLanguage();
  const { member } = useAuth();
  const { customerGroups } = useApp();
  const [activeTab, setActiveTab] = useState<'timeline' | 'details'>('timeline');
  const [confirmDelete, setConfirmDelete] = useState(false);

  if (!customer) return null;

  const handleToggleStatus = () => {
    const nextStatus: CustomerStatus =
      customer.status === 'New customer' ? 'Old customer' : 'New customer';
    const updated: Customer = {
      ...customer,
      status: nextStatus,
      statusHistory: [
        {
          from: customer.status,
          to: nextStatus,
          changedBy: member?.email || 'prajindezaa142@gmail.com',
          changedAt: new Date().toISOString(),
          reason: 'Manual status transition from customer detail panel',
        },
        ...customer.statusHistory,
      ],
      updatedAt: new Date().toISOString(),
    };
    onUpdateCustomer(updated);
  };

  const handleStageChange = (newStage: LeadStage) => {
    onUpdateCustomer({
      ...customer,
      leadStage: newStage,
      updatedAt: new Date().toISOString(),
    });
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 overflow-hidden bg-black/50 backdrop-blur-xs flex justify-end"
    >
      <div className="w-full max-w-lg bg-white h-full shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-right duration-200">
        {/* Top Header */}
        <div className="px-6 py-4 bg-stone-50 border-b border-stone-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span
              className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded ${
                customer.status === 'New customer'
                  ? 'bg-amber-100 text-amber-900'
                  : 'bg-emerald-100 text-emerald-900'
              }`}
            >
              {customer.status}
            </span>
            <span className="text-xs text-stone-400">·</span>
            <CustomerGroupBadge
              groupId={customer.groupId}
              groupName={customer.groupName}
              group={customerGroups.find((g) => g.id === customer.groupId)}
              size="sm"
            />
          </div>
          <button onClick={onClose} className="p-1 text-stone-400 hover:text-stone-600 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Customer Header Info */}
        <div className="p-6 border-b border-stone-100 bg-white">
          <h2 className="text-xl font-bold tracking-tight text-stone-900 font-display">
            {customer.companyName}
          </h2>
          <div className="text-xs text-stone-500 mt-0.5">Contact: {customer.contactPerson}</div>

          <div className="flex items-center gap-4 mt-3 text-xs text-stone-600">
            <div className="flex items-center gap-1 font-mono tabular-nums text-stone-900 font-semibold">
              <Phone className="w-3.5 h-3.5 text-stone-400" />
              <span>{formatPhoneDisplay(customer.phone)}</span>
            </div>
            <div className="flex items-center gap-1">
              <MapPin className="w-3.5 h-3.5 text-stone-400" />
              <span>{customer.place.city}, {customer.place.state}</span>
            </div>
          </div>

          {/* Quick Action Bar */}
          <div className="mt-5 flex flex-wrap items-center gap-2">
            <a
              href={getTelLink(customer.phone)}
              onClick={() => onLogOutcome('Call')}
              className="flex-1 py-2 px-3 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-xs flex items-center justify-center gap-1.5 transition-colors"
            >
              <Phone className="w-3.5 h-3.5" />
              <span>Call &amp; Log</span>
            </a>

            <a
              href={getWhatsAppLink(customer.whatsapp, `Vanakkam ${customer.contactPerson}, Jaikrishna Industries regarding:`)}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => onLogOutcome('WhatsApp')}
              className="flex-1 py-2 px-3 text-xs font-semibold text-white bg-green-600 hover:bg-green-700 rounded-lg shadow-xs flex items-center justify-center gap-1.5 transition-colors"
            >
              <MessageSquare className="w-3.5 h-3.5" />
              <span>WhatsApp</span>
            </a>

            <button
              onClick={handleToggleStatus}
              className="px-3 py-2 text-xs font-semibold text-stone-700 bg-stone-100 hover:bg-stone-200 rounded-lg transition-colors"
            >
              {customer.status === 'New customer' ? 'Move to Old Customer' : 'Move to New Customer'}
            </button>

            {onEdit && (
              <button
                onClick={() => onEdit(customer)}
                className="px-3 py-2 text-xs font-bold text-[#881337] bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-lg transition-colors flex items-center gap-1.5"
                title="Edit full customer profile & details"
              >
                <Edit3 className="w-3.5 h-3.5 text-[#881337]" />
                <span>Edit Profile</span>
              </button>
            )}
          </div>
        </div>

        {/* Tabs */}
        <div className="px-6 border-b border-stone-200 flex items-center gap-4 text-xs font-semibold">
          <button
            onClick={() => setActiveTab('timeline')}
            className={`py-3 border-b-2 transition-colors ${
              activeTab === 'timeline'
                ? 'border-[#881337] text-[#881337]'
                : 'border-transparent text-stone-500 hover:text-stone-900'
            }`}
          >
            Outreach Timeline
          </button>
          <button
            onClick={() => setActiveTab('details')}
            className={`py-3 border-b-2 transition-colors ${
              activeTab === 'details'
                ? 'border-[#881337] text-[#881337]'
                : 'border-transparent text-stone-500 hover:text-stone-900'
            }`}
          >
            Customer Profile &amp; Lead Stage
          </button>
        </div>

        {/* Tab Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {activeTab === 'timeline' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-stone-900">Interaction History</span>
                <span className="text-[11px] text-stone-500 font-mono">
                  Next Follow-up: {customer.nextFollowUpDate || 'Not set'}
                </span>
              </div>

              {/* Customer Group Timeline Entry */}
              {customer.groupId && (
                <div className="p-3 bg-stone-50 rounded-lg border border-stone-100 space-y-1 text-xs">
                  <div className="font-semibold text-stone-700 flex items-center gap-1.5">
                    <Layers className="w-3.5 h-3.5 text-amber-700" />
                    <span>Customer Group Assignment</span>
                  </div>
                  <div className="text-[11px] text-stone-600">
                    Currently assigned to{' '}
                    <CustomerGroupBadge
                      groupId={customer.groupId}
                      groupName={customer.groupName}
                      group={customerGroups.find((g) => g.id === customer.groupId)}
                      size="sm"
                    />
                    {customer.groupAssignedAt && (
                      <span className="text-stone-400 block pt-0.5 font-mono text-[10px]">
                        Assigned on {new Date(customer.groupAssignedAt).toLocaleDateString()}
                        {customer.groupAssignedBy ? ` by ${customer.groupAssignedBy}` : ''}
                      </span>
                    )}
                  </div>
                </div>
              )}

              {/* Status Change History */}
              {customer.statusHistory && customer.statusHistory.length > 0 && (
                <div className="p-3 bg-stone-50 rounded-lg border border-stone-100 space-y-1.5 text-xs">
                  <div className="font-semibold text-stone-700 flex items-center gap-1">
                    <History className="w-3.5 h-3.5 text-stone-400" />
                    <span>Status Transitions</span>
                  </div>
                  {customer.statusHistory.map((sh, idx) => (
                    <div key={idx} className="text-[11px] text-stone-600">
                      Moved from <strong>{sh.from}</strong> to <strong>{sh.to}</strong> on{' '}
                      {new Date(sh.changedAt).toLocaleDateString()}
                    </div>
                  ))}
                </div>
              )}

              {/* Customer Notes */}
              <div className="p-4 bg-amber-50/60 rounded-xl border border-amber-200/60 space-y-1 text-xs">
                <div className="font-semibold text-amber-900">Internal Notes</div>
                <div className="text-stone-700 leading-relaxed">{customer.notes || 'No notes added yet.'}</div>
              </div>

              {/* Sample timeline entry */}
              <div className="relative pl-6 pb-2 border-l-2 border-stone-200 space-y-1">
                <div className="absolute -left-1.5 top-0 w-3 h-3 rounded-full bg-amber-600 border-2 border-white" />
                <div className="text-xs font-semibold text-stone-900">Lead Ingested from Meta Ads Campaign</div>
                <div className="text-[11px] text-stone-500 font-mono">
                  {new Date(customer.createdAt).toLocaleString()} · Assigned to {customer.assignedTo}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'details' && (
            <div className="space-y-4 text-xs">
              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1">Lead Stage</label>
                <select
                  value={customer.leadStage}
                  onChange={(e) => handleStageChange(e.target.value as LeadStage)}
                  className="w-full px-3 py-2 text-xs border border-stone-300 rounded-lg font-medium"
                >
                  <option value="New">New</option>
                  <option value="Contacted">Contacted</option>
                  <option value="Interested">Interested</option>
                  <option value="Sample sent">Sample sent</option>
                  <option value="Negotiation">Negotiation</option>
                  <option value="Ordered">Ordered</option>
                  <option value="Not interested">Not interested</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1">Assigned Team Member</label>
                <div className="p-2.5 rounded-lg bg-stone-50 border border-stone-200 font-medium text-stone-800">
                  {customer.assignedTo} (Flat access, all 3 members can update)
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1">Orders &amp; Lifetime Value</label>
                <div className="grid grid-cols-2 gap-2">
                  <div className="p-3 bg-stone-50 rounded-lg border border-stone-100">
                    <span className="text-[11px] text-stone-500">Total Orders</span>
                    <div className="text-sm font-bold font-mono text-stone-900 mt-0.5">
                      {customer.totalOrdersCount} orders
                    </div>
                  </div>
                  <div className="p-3 bg-stone-50 rounded-lg border border-stone-100">
                    <span className="text-[11px] text-stone-500">Total Revenue</span>
                    <div className="text-sm font-bold font-mono text-stone-900 mt-0.5">
                      ₹{customer.totalRevenue.toLocaleString('en-IN')}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer: Soft Delete with Confirmation */}
        <div className="p-4 bg-stone-50 border-t border-stone-200 flex items-center justify-between">
          {confirmDelete ? (
            <div className="flex items-center justify-between w-full gap-2">
              <span className="text-xs text-rose-800 font-semibold flex items-center gap-1">
                <AlertTriangle className="w-3.5 h-3.5" /> Move to 30-day Trash?
              </span>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => setConfirmDelete(false)}
                  className="px-2.5 py-1 text-xs text-stone-600 hover:bg-stone-200 rounded"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    onDeleteCustomer(customer.id);
                    onClose();
                  }}
                  className="px-3 py-1 text-xs font-semibold text-white bg-rose-700 hover:bg-rose-800 rounded shadow-xs"
                >
                  Confirm Delete
                </button>
              </div>
            </div>
          ) : (
            <>
              <button
                onClick={() => setConfirmDelete(true)}
                className="text-xs text-rose-700 hover:text-rose-900 font-medium inline-flex items-center gap-1"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Move to Trash</span>
              </button>
              <button
                onClick={onClose}
                className="px-4 py-1.5 text-xs font-semibold text-stone-700 hover:bg-stone-200 rounded-lg"
              >
                Done
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
