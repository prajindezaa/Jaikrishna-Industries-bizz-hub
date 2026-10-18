/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import {
  Upload,
  FileSpreadsheet,
  Download,
  X,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  RefreshCw,
  Copy,
} from 'lucide-react';
import { Customer, CustomerStatus, LeadSource } from '../types';
import {
  parseImportFile,
  autoDetectColumnMapping,
  validateAndMapRows,
  ColumnMapping,
  ImportPreviewResult,
} from '../lib/import';
import { downloadCustomerImportTemplate } from '../lib/export';

interface CustomerImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  existingCustomers: Customer[];
  onImportComplete: (newCustomers: Customer[]) => void;
}

export const CustomerImportModal: React.FC<CustomerImportModalProps> = ({
  isOpen,
  onClose,
  existingCustomers,
  onImportComplete,
}) => {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [file, setFile] = useState<File | null>(null);
  const [headers, setHeaders] = useState<string[]>([]);
  const [rawRows, setRawRows] = useState<Record<string, unknown>[]>([]);
  const [mapping, setMapping] = useState<ColumnMapping>({
    companyName: '',
    contactPerson: '',
    phone: '',
    city: '',
    area: '',
    customerType: '',
    status: '',
    source: '',
    notes: '',
  });

  const [defaultStatus, setDefaultStatus] = useState<CustomerStatus>('New customer');
  const [defaultSource, setDefaultSource] = useState<LeadSource>('Meta Ads');
  const [duplicateAction, setDuplicateAction] = useState<'skip' | 'update' | 'import_anyway'>('skip');

  const [preview, setPreview] = useState<ImportPreviewResult | null>(null);
  const [importing, setImporting] = useState(false);
  const [importProgress, setImportProgress] = useState(0);

  if (!isOpen) return null;

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (!selected) return;
    setFile(selected);

    try {
      const { headers: detectedHeaders, rawRows: rows } = await parseImportFile(selected);
      setHeaders(detectedHeaders);
      setRawRows(rows);
      const autoMap = autoDetectColumnMapping(detectedHeaders);
      setMapping(autoMap);
      setStep(2);
    } catch (err) {
      alert(`Error reading file: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  const handleProceedToPreview = () => {
    const existingPhones = new Set(existingCustomers.map((c) => c.phone));
    const result = validateAndMapRows(rawRows, mapping, existingPhones, {
      status: defaultStatus,
      source: defaultSource,
      assignedTo: 'prajindezaa142@gmail.com',
    });
    setPreview(result);
    setStep(3);
  };

  const handleExecuteImport = async () => {
    if (!preview) return;
    setImporting(true);
    setImportProgress(10);

    const rowsToImport = [...preview.validRows];
    if (duplicateAction === 'import_anyway') {
      rowsToImport.push(...preview.duplicateRows);
    }

    const total = rowsToImport.length;
    const finalCustomers: Customer[] = [];

    for (let i = 0; i < total; i++) {
      const row = rowsToImport[i];
      const cust: Customer = {
        id: `cust-${Date.now()}-${i}`,
        companyName: row.data.companyName || 'Unknown Shop',
        contactPerson: row.data.contactPerson || row.data.companyName || '',
        phone: row.data.phone || '',
        whatsapp: row.data.whatsapp || row.data.phone || '',
        place: row.data.place || { area: '', city: 'Salem', district: 'Salem', state: 'Tamil Nadu' },
        customerType: row.data.customerType || 'Distributor',
        status: row.data.status || defaultStatus,
        source: row.data.source || defaultSource,
        leadStage: 'New',
        assignedTo: 'prajindezaa142@gmail.com',
        tags: ['Imported Batch'],
        notes: row.data.notes || '',
        totalOrdersCount: 0,
        totalRevenue: 0,
        statusHistory: [],
        isDeleted: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      finalCustomers.push(cust);

      // Simulate batch progress updates
      if (i % 25 === 0 || i === total - 1) {
        setImportProgress(Math.round(((i + 1) / total) * 100));
        await new Promise((r) => setTimeout(r, 10));
      }
    }

    onImportComplete(finalCustomers);
    setImporting(false);
    onClose();
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs"
    >
      <div className="w-full max-w-2xl rounded-2xl bg-white p-6 shadow-2xl border border-stone-200 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="flex items-center justify-between pb-3 border-b border-stone-100 shrink-0">
          <div>
            <h2 className="text-base font-bold text-stone-900 font-display">
              Import Customers from Excel or CSV
            </h2>
            <div className="text-xs text-stone-500 mt-0.5">
              Step {step} of 3: {step === 1 ? 'Select File' : step === 2 ? 'Map Columns' : 'Preview & Duplicate Rules'}
            </div>
          </div>
          <button onClick={onClose} className="p-1 text-stone-400 hover:text-stone-600 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Wizard Steps */}
        <div className="flex-1 overflow-y-auto py-4">
          {step === 1 && (
            <div className="space-y-6">
              {/* Template Download Card */}
              <div className="p-4 rounded-xl bg-amber-50/80 border border-amber-200/80 flex items-center justify-between">
                <div>
                  <div className="text-xs font-semibold text-amber-900">Need the standard spreadsheet format?</div>
                  <div className="text-[11px] text-amber-800/80">
                    Download the Jaikrishna Industries Excel template with sample pooja customer rows.
                  </div>
                </div>
                <button
                  type="button"
                  onClick={downloadCustomerImportTemplate}
                  className="px-3 py-1.5 text-xs font-semibold text-white bg-amber-800 hover:bg-amber-900 rounded-lg inline-flex items-center gap-1.5 shadow-2xs"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download Template</span>
                </button>
              </div>

              {/* Upload Zone */}
              <label className="border-2 border-dashed border-stone-300 hover:border-amber-600 rounded-2xl p-8 flex flex-col items-center justify-center cursor-pointer bg-stone-50/50 hover:bg-amber-50/30 transition-colors">
                <Upload className="w-10 h-10 text-stone-400 mb-2" />
                <span className="text-sm font-semibold text-stone-800">
                  Click to browse or drag &amp; drop file
                </span>
                <span className="text-xs text-stone-500 mt-1">
                  Supports Excel (.xlsx, .xls) and CSV (tested for 200+ up to 5,000+ leads)
                </span>
                <input
                  type="file"
                  accept=".xlsx, .xls, .csv"
                  onChange={handleFileUpload}
                  className="hidden"
                />
              </label>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <div className="p-3 bg-stone-50 rounded-lg border border-stone-200 text-xs text-stone-700">
                Found <strong>{rawRows.length} rows</strong> in <code>{file?.name}</code>. Match spreadsheet columns
                to Jaikrishna CRM fields.
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div>
                  <label className="block font-semibold text-stone-700 mb-1">Company / Shop Name *</label>
                  <select
                    value={mapping.companyName}
                    onChange={(e) => setMapping({ ...mapping, companyName: e.target.value })}
                    className="w-full px-2.5 py-1.5 border border-stone-300 rounded-lg"
                  >
                    <option value="">-- Select Column --</option>
                    {headers.map((h) => (
                      <option key={h} value={h}>
                        {h}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-stone-700 mb-1">Primary Phone *</label>
                  <select
                    value={mapping.phone}
                    onChange={(e) => setMapping({ ...mapping, phone: e.target.value })}
                    className="w-full px-2.5 py-1.5 border border-stone-300 rounded-lg"
                  >
                    <option value="">-- Select Column --</option>
                    {headers.map((h) => (
                      <option key={h} value={h}>
                        {h}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-stone-700 mb-1">Contact Person</label>
                  <select
                    value={mapping.contactPerson}
                    onChange={(e) => setMapping({ ...mapping, contactPerson: e.target.value })}
                    className="w-full px-2.5 py-1.5 border border-stone-300 rounded-lg"
                  >
                    <option value="">-- Select Column --</option>
                    {headers.map((h) => (
                      <option key={h} value={h}>
                        {h}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-stone-700 mb-1">City / Location</label>
                  <select
                    value={mapping.city}
                    onChange={(e) => setMapping({ ...mapping, city: e.target.value })}
                    className="w-full px-2.5 py-1.5 border border-stone-300 rounded-lg"
                  >
                    <option value="">-- Select Column --</option>
                    {headers.map((h) => (
                      <option key={h} value={h}>
                        {h}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Default Batch Settings */}
              <div className="pt-3 border-t border-stone-100 grid grid-cols-2 gap-3 text-xs">
                <div>
                  <label className="block font-semibold text-stone-700 mb-1">Default Batch Status</label>
                  <select
                    value={defaultStatus}
                    onChange={(e) => setDefaultStatus(e.target.value as CustomerStatus)}
                    className="w-full px-2.5 py-1.5 border border-stone-300 rounded-lg"
                  >
                    <option value="New customer">New customer</option>
                    <option value="Old customer">Old customer</option>
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-stone-700 mb-1">Default Batch Source</label>
                  <select
                    value={defaultSource}
                    onChange={(e) => setDefaultSource(e.target.value as LeadSource)}
                    className="w-full px-2.5 py-1.5 border border-stone-300 rounded-lg"
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
            </div>
          )}

          {step === 3 && preview && (
            <div className="space-y-4 text-xs">
              {/* Validation Summary Metrics */}
              <div className="grid grid-cols-3 gap-3">
                <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200">
                  <div className="text-[11px] text-emerald-800">Valid Leads</div>
                  <div className="text-xl font-bold font-mono text-emerald-900 mt-0.5">
                    {preview.validRows.length}
                  </div>
                </div>

                <div className="p-3 rounded-lg bg-amber-50 border border-amber-200">
                  <div className="text-[11px] text-amber-800">Duplicate Phones</div>
                  <div className="text-xl font-bold font-mono text-amber-900 mt-0.5">
                    {preview.duplicateRows.length}
                  </div>
                </div>

                <div className="p-3 rounded-lg bg-rose-50 border border-rose-200">
                  <div className="text-[11px] text-rose-800">Invalid Rows</div>
                  <div className="text-xl font-bold font-mono text-rose-900 mt-0.5">
                    {preview.invalidRows.length}
                  </div>
                </div>
              </div>

              {/* Duplicate Resolution Strategy */}
              {preview.duplicateRows.length > 0 && (
                <div className="p-3 rounded-lg bg-stone-50 border border-stone-200 space-y-1.5">
                  <label className="block font-semibold text-stone-800">Duplicate Phone Handling Strategy</label>
                  <div className="flex gap-4">
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="radio"
                        name="dupAction"
                        checked={duplicateAction === 'skip'}
                        onChange={() => setDuplicateAction('skip')}
                      />
                      <span>Skip duplicates ({preview.duplicateRows.length} rows)</span>
                    </label>
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="radio"
                        name="dupAction"
                        checked={duplicateAction === 'import_anyway'}
                        onChange={() => setDuplicateAction('import_anyway')}
                      />
                      <span>Import anyway</span>
                    </label>
                  </div>
                </div>
              )}

              {/* Progress Bar (Visible during import) */}
              {importing && (
                <div className="space-y-1.5 pt-2">
                  <div className="flex justify-between text-[11px] text-stone-600">
                    <span>Writing batch to CRM...</span>
                    <span className="font-mono font-bold">{importProgress}%</span>
                  </div>
                  <div className="w-full bg-stone-200 h-2 rounded-full overflow-hidden">
                    <div
                      className="bg-[#881337] h-full transition-all duration-150"
                      style={{ width: `${importProgress}%` }}
                    />
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer Navigation */}
        <div className="pt-3 border-t border-stone-100 flex items-center justify-between shrink-0">
          {step > 1 ? (
            <button
              onClick={() => setStep((step - 1) as 1 | 2)}
              disabled={importing}
              className="px-4 py-2 text-xs font-medium text-stone-700 hover:bg-stone-100 rounded-lg"
            >
              Back
            </button>
          ) : (
            <div />
          )}

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              disabled={importing}
              className="px-4 py-2 text-xs font-medium text-stone-700 hover:bg-stone-100 rounded-lg"
            >
              Cancel
            </button>

            {step === 2 && (
              <button
                onClick={handleProceedToPreview}
                disabled={!mapping.companyName || !mapping.phone}
                className="px-4 py-2 text-xs font-semibold text-white bg-[#881337] hover:bg-[#701A24] rounded-lg shadow-xs inline-flex items-center gap-1.5 disabled:opacity-50"
              >
                <span>Preview Import</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            )}

            {step === 3 && (
              <button
                onClick={handleExecuteImport}
                disabled={importing || (preview?.validRows.length === 0 && duplicateAction === 'skip')}
                className="px-5 py-2 text-xs font-semibold text-white bg-[#881337] hover:bg-[#701A24] rounded-lg shadow-xs inline-flex items-center gap-1.5 disabled:opacity-50"
              >
                {importing && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                <span>Confirm &amp; Import Leads</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
