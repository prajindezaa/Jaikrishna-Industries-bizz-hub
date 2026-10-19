/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import {
  X,
  Building2,
  User,
  Phone,
  Mail,
  MapPin,
  FileText,
  Tag,
  Loader2,
  Calendar,
  CreditCard,
  CheckCircle,
  Trash2,
} from 'lucide-react';
import { Customer, CustomerType, CustomerStatus, LeadStage, LeadSource } from '../types';
import { TAMIL_NADU_DISTRICTS } from '../lib/districts';
import { normalizePhone } from '../lib/phone';
import { CustomerGroupSelect } from './customers/CustomerGroupSelect';
import { useApp } from '../context/AppContext';

interface EditCustomerModalProps {
  customer: Customer | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: (customerId: string, updates: Partial<Customer>) => Promise<void>;
  onDelete?: (customerId: string) => Promise<void>;
}

export const EditCustomerModal: React.FC<EditCustomerModalProps> = ({
  customer,
  isOpen,
  onClose,
  onSave,
  onDelete,
}) => {
  const { customerGroups } = useApp();
  const [companyName, setCompanyName] = useState('');
  const [contactPerson, setContactPerson] = useState('');
  const [rawPhone, setRawPhone] = useState('');
  const [altPhone, setAltPhone] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [email, setEmail] = useState('');
  const [gstin, setGstin] = useState('');
  const [address, setAddress] = useState('');
  const [area, setArea] = useState('');
  const [city, setCity] = useState('Salem');
  const [district, setDistrict] = useState('Salem');
  const [state, setState] = useState('Tamil Nadu');
  const [groupId, setGroupId] = useState<string | null>(null);
  const [status, setStatus] = useState<CustomerStatus>('New customer');
  const [leadStage, setLeadStage] = useState<LeadStage>('New');
  const [source, setSource] = useState<LeadSource>('Meta Ads');
  const [tagsStr, setTagsStr] = useState('');
  const [notes, setNotes] = useState('');
  const [nextFollowUpDate, setNextFollowUpDate] = useState('');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (customer) {
      setCompanyName(customer.companyName || '');
      setContactPerson(customer.contactPerson || '');
      setRawPhone(customer.phone ? customer.phone.replace('+91', '') : '');
      setAltPhone(customer.altPhone ? customer.altPhone.replace('+91', '') : '');
      setWhatsapp(customer.whatsapp ? customer.whatsapp.replace('+91', '') : '');
      setEmail(customer.email || '');
      setGstin(customer.gstin || '');
      setAddress(customer.address || '');
      setArea(customer.place?.area || '');
      setCity(customer.place?.city || customer.city || 'Salem');
      setDistrict(customer.place?.district || customer.place?.city || customer.city || 'Salem');
      setState(customer.place?.state || 'Tamil Nadu');
      setGroupId(customer.groupId || null);
      setStatus(customer.status || 'New customer');
      setLeadStage(customer.leadStage || 'New');
      setSource(customer.source || 'Meta Ads');
      setTagsStr(customer.tags ? customer.tags.join(', ') : '');
      setNotes(customer.notes || '');
      setNextFollowUpDate(customer.nextFollowUpDate || '');
      setErrorMsg(null);
    }
  }, [customer]);

  if (!isOpen || !customer) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    const trimmedCompany = companyName.trim();
    if (!trimmedCompany) {
      setErrorMsg('Company / Shop Name is required.');
      return;
    }

    let normalizedMainPhone = '';
    let isPhoneMissing = customer.isPhoneMissing;

    if (rawPhone.trim()) {
      try {
        normalizedMainPhone = normalizePhone(rawPhone.trim());
        isPhoneMissing = false;
      } catch (err: any) {
        setErrorMsg('Invalid primary phone number. Please enter a valid 10-digit mobile number.');
        return;
      }
    } else {
      isPhoneMissing = true;
    }

    let normalizedAlt = undefined;
    if (altPhone.trim()) {
      try {
        normalizedAlt = normalizePhone(altPhone.trim());
      } catch (err) {
        // Soft fallback for secondary
        normalizedAlt = altPhone.trim();
      }
    }

    let normalizedWp = '';
    if (whatsapp.trim()) {
      try {
        normalizedWp = normalizePhone(whatsapp.trim());
      } catch (err) {
        normalizedWp = normalizedMainPhone;
      }
    } else {
      normalizedWp = normalizedMainPhone;
    }

    const tagsArray = tagsStr
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);

    setIsSubmitting(true);
    try {
      await onSave(customer.id, {
        companyName: trimmedCompany,
        contactPerson: contactPerson.trim() || '',
        phone: normalizedMainPhone,
        altPhone: normalizedAlt || '',
        whatsapp: normalizedWp || '',
        email: email.trim() || '',
        gstin: gstin.trim().toUpperCase() || '',
        address: address.trim() || '',
        city: city.trim(),
        isPhoneMissing,
        place: {
          area: area.trim(),
          city: city.trim(),
          district: district.trim(),
          state: state.trim() || 'Tamil Nadu',
        },
        groupId: groupId || null,
        groupName: groupId ? (customerGroups.find((g) => g.id === groupId)?.name || 'Group') : 'Ungrouped',
        ...(customer.groupId !== groupId ? {
          previousGroupId: customer.groupId || null,
          groupAssignedAt: new Date().toISOString(),
        } : {}),
        status,
        leadStage,
        source,
        tags: tagsArray,
        notes: notes.trim(),
        nextFollowUpDate: nextFollowUpDate || '',
        updatedAt: new Date().toISOString(),
      });
      onClose();
    } catch (err: any) {
      setErrorMsg(err?.message || 'Failed to update customer details.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-stone-900/60 backdrop-blur-xs animate-in fade-in"
    >
      <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[92vh] flex flex-col shadow-2xl border border-stone-200 overflow-hidden">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-stone-200 bg-stone-50 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#881337] text-white flex items-center justify-center shadow-xs">
              <Building2 className="w-5 h-5 text-amber-300" />
            </div>
            <div>
              <h3 className="font-bold text-base text-stone-900 font-display">
                Edit Customer / Shop Profile
              </h3>
              <p className="text-xs text-stone-500 mt-0.5">
                Modify contact info, phone numbers, GSTIN, district, and lead pipeline stage
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-stone-400 hover:text-stone-700 hover:bg-stone-200/60 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 text-xs">
          {errorMsg && (
            <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs">
              {errorMsg}
            </div>
          )}

          {/* Section 1: Basic Identity */}
          <div className="space-y-3">
            <h4 className="font-bold text-stone-900 border-b border-stone-100 pb-1 text-xs uppercase tracking-wider text-stone-400">
              Company &amp; Contact Info
            </h4>

            <div>
              <label className="block font-semibold text-stone-700 mb-1">
                Company / Shop Name <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                placeholder="e.g. Murugan Stores &amp; Pooja Center"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-stone-300 focus:outline-hidden focus:border-[#881337] font-medium text-stone-900"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block font-semibold text-stone-700 mb-1">Contact Person</label>
                <input
                  type="text"
                  placeholder="e.g. Murugan Swamy"
                  value={contactPerson}
                  onChange={(e) => setContactPerson(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-stone-300 focus:outline-hidden focus:border-[#881337]"
                />
              </div>

              <div>
                <label className="block font-semibold text-stone-700 mb-1">GSTIN Number (15 chars)</label>
                <input
                  type="text"
                  maxLength={15}
                  placeholder="e.g. 33BBSPA1067M1ZJ"
                  value={gstin}
                  onChange={(e) => setGstin(e.target.value.toUpperCase())}
                  className="w-full px-3 py-2 rounded-lg border border-stone-300 font-mono focus:outline-hidden focus:border-[#881337] uppercase"
                />
              </div>
            </div>
          </div>

          {/* Section 2: Contact & Phone */}
          <div className="space-y-3 pt-1">
            <h4 className="font-bold text-stone-900 border-b border-stone-100 pb-1 text-xs uppercase tracking-wider text-stone-400">
              Phone &amp; Messaging Details
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block font-semibold text-stone-700 mb-1">
                  Primary Phone (+91)
                </label>
                <input
                  type="tel"
                  placeholder="e.g. 9842154321"
                  value={rawPhone}
                  onChange={(e) => setRawPhone(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-stone-300 font-mono focus:outline-hidden focus:border-[#881337]"
                />
              </div>

              <div>
                <label className="block font-semibold text-stone-700 mb-1">Alt / Landline Phone</label>
                <input
                  type="tel"
                  placeholder="e.g. 9443123456"
                  value={altPhone}
                  onChange={(e) => setAltPhone(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-stone-300 font-mono focus:outline-hidden focus:border-[#881337]"
                />
              </div>

              <div>
                <label className="block font-semibold text-stone-700 mb-1">WhatsApp Number</label>
                <input
                  type="tel"
                  placeholder="Leaves default to phone"
                  value={whatsapp}
                  onChange={(e) => setWhatsapp(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-stone-300 font-mono focus:outline-hidden focus:border-[#881337]"
                />
              </div>
            </div>

            <div>
              <label className="block font-semibold text-stone-700 mb-1">Email Address</label>
              <input
                type="email"
                placeholder="e.g. muruganstores@gmail.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-stone-300 focus:outline-hidden focus:border-[#881337]"
              />
            </div>
          </div>

          {/* Section 3: Location */}
          <div className="space-y-3 pt-1">
            <h4 className="font-bold text-stone-900 border-b border-stone-100 pb-1 text-xs uppercase tracking-wider text-stone-400">
              Address &amp; Location
            </h4>

            <div>
              <label className="block font-semibold text-stone-700 mb-1">Street Address</label>
              <input
                type="text"
                placeholder="e.g. 455, Telephone Nagar, Main Bazaar"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-stone-300 focus:outline-hidden focus:border-[#881337]"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block font-semibold text-stone-700 mb-1">Area / Locality</label>
                <input
                  type="text"
                  placeholder="e.g. Suramangalam"
                  value={area}
                  onChange={(e) => setArea(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-stone-300 focus:outline-hidden focus:border-[#881337]"
                />
              </div>

              <div>
                <label className="block font-semibold text-stone-700 mb-1">District (38 TN)</label>
                <select
                  value={district}
                  onChange={(e) => {
                    setDistrict(e.target.value);
                    if (!city || city === district) {
                      setCity(e.target.value);
                    }
                  }}
                  className="w-full px-3 py-2 rounded-lg border border-stone-300 focus:outline-hidden"
                >
                  {TAMIL_NADU_DISTRICTS.map((dist) => (
                    <option key={dist} value={dist}>
                      {dist}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-semibold text-stone-700 mb-1">City / Town</label>
                <input
                  type="text"
                  placeholder="e.g. Salem"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-stone-300 focus:outline-hidden focus:border-[#881337]"
                />
              </div>
            </div>
          </div>

          {/* Section 4: CRM Status & Classification */}
          <div className="space-y-3 pt-1">
            <h4 className="font-bold text-stone-900 border-b border-stone-100 pb-1 text-xs uppercase tracking-wider text-stone-400">
              Classification &amp; Pipeline
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
              <div>
                <label className="block font-semibold text-stone-700 mb-1">Customer Group</label>
                <CustomerGroupSelect
                  value={groupId}
                  onChange={(newGrpId) => setGroupId(newGrpId)}
                  allowUngrouped={true}
                />
              </div>

              <div>
                <label className="block font-semibold text-stone-700 mb-1">Status</label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value as CustomerStatus)}
                  className="w-full px-3 py-2 rounded-lg border border-stone-300 focus:outline-hidden"
                >
                  <option value="New customer">New customer</option>
                  <option value="Old customer">Old customer</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold text-stone-700 mb-1">Lead Stage</label>
                <select
                  value={leadStage}
                  onChange={(e) => setLeadStage(e.target.value as LeadStage)}
                  className="w-full px-3 py-2 rounded-lg border border-stone-300 focus:outline-hidden"
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
                <label className="block font-semibold text-stone-700 mb-1">Source</label>
                <select
                  value={source}
                  onChange={(e) => setSource(e.target.value as LeadSource)}
                  className="w-full px-3 py-2 rounded-lg border border-stone-300 focus:outline-hidden"
                >
                  <option value="Meta Ads">Meta Ads</option>
                  <option value="Google Ads">Google Ads</option>
                  <option value="Own Calling / Telecalling">Own Calling / Telecalling</option>
                  <option value="Direct Reach / Walk-in">Direct Reach / Walk-in</option>
                  <option value="Reference / Word of Mouth">Reference / Word of Mouth</option>
                  <option value="Exhibition / Trade Fair">Exhibition / Trade Fair</option>
                  <option value="WhatsApp Campaign">WhatsApp Campaign</option>
                  <option value="IndiaMART / B2B Portal">IndiaMART / B2B Portal</option>
                  <option value="Other">Other</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block font-semibold text-stone-700 mb-1">Next Follow-Up Date</label>
                <input
                  type="date"
                  value={nextFollowUpDate}
                  onChange={(e) => setNextFollowUpDate(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-stone-300 font-mono focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block font-semibold text-stone-700 mb-1">Tags (Comma-separated)</label>
                <input
                  type="text"
                  placeholder="e.g. VIP, Camphor wholesale, Diwali buyer"
                  value={tagsStr}
                  onChange={(e) => setTagsStr(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-stone-300 focus:outline-hidden"
                />
              </div>
            </div>

            <div>
              <label className="block font-semibold text-stone-700 mb-1">Notes &amp; Requirements</label>
              <textarea
                rows={2}
                placeholder="e.g. Inquired about pure Bhimseni camphor rates, preferred delivery via ST Courier..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-stone-300 focus:outline-hidden"
              />
            </div>
          </div>

          {/* Footer inside form */}
          <div className="flex items-center justify-between gap-2 pt-4 border-t border-stone-200">
            {onDelete && customer ? (
              <button
                type="button"
                onClick={async () => {
                  if (window.confirm(`Move "${customer.companyName}" to 30-day trash?`)) {
                    try {
                      setIsSubmitting(true);
                      await onDelete(customer.id);
                      onClose();
                    } catch (err: any) {
                      setErrorMsg(err?.message || 'Failed to delete customer');
                    } finally {
                      setIsSubmitting(false);
                    }
                  }
                }}
                className="px-3 py-2 text-xs font-semibold text-rose-700 hover:text-rose-900 hover:bg-rose-50 rounded-lg border border-rose-200 flex items-center gap-1.5 transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Move to Trash</span>
              </button>
            ) : (
              <div />
            )}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 font-semibold rounded-lg border border-stone-300 hover:bg-stone-50 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-5 py-2 font-bold rounded-lg bg-[#881337] text-white hover:bg-[#70102e] shadow-xs flex items-center gap-1.5 disabled:opacity-50 transition-colors"
              >
                {isSubmitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                Save Changes
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
