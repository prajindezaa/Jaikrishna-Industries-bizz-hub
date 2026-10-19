/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Jaikrishna Industries — Invoice Upload & Interactive Review Card Modal
 */

import React, { useState, useRef } from 'react';
import {
  Upload,
  FileText,
  AlertTriangle,
  CheckCircle,
  Building2,
  Calendar,
  Hash,
  IndianRupee,
  MapPin,
  ShieldAlert,
  Loader2,
  X,
  Plus,
  UserCheck,
  PhoneCall,
} from 'lucide-react';
import { ParsedInvoiceData, parsePdfFileInBrowser, calculateFinancialYear } from '../../lib/invoice-parser';
import { Customer, Order } from '../../types';

export interface InvoiceReviewItem {
  id: string;
  file: File;
  previewUrl?: string;
  parsing: boolean;
  parsedData: ParsedInvoiceData;
  invoiceNumber: string;
  invoiceDate: string; // YYYY-MM-DD
  totalAmount: number;
  customerName: string;
  customerAddress: string;
  customerCity: string;
  customerGstin: string;
  notes: string;
  selectedCustomerId: string;
  customerSelectionMode: 'matched' | 'existing' | 'new';
  isDuplicateInvoice: boolean;
  duplicateOrderNumber?: string;
  isConfirmed: boolean;
  error?: string;
}

interface InvoiceUploadReviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  customers: Customer[];
  existingOrders: Order[];
  onConfirmOrder: (item: InvoiceReviewItem) => Promise<void>;
  onAddNewCustomer: (data: Partial<Customer>) => Promise<string>;
}

export const InvoiceUploadReviewModal: React.FC<InvoiceUploadReviewModalProps> = ({
  isOpen,
  onClose,
  customers,
  existingOrders,
  onConfirmOrder,
  onAddNewCustomer,
}) => {
  const [reviewItems, setReviewItems] = useState<InvoiceReviewItem[]>([]);
  const [activeItemIndex, setActiveItemIndex] = useState<number>(0);
  const [isProcessing, setIsProcessing] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const findCustomerMatch = (gstin?: string | null, name?: string | null, city?: string | null) => {
    if (gstin) {
      const matchByGstin = customers.find(
        (c) => c.gstin && c.gstin.trim().toUpperCase() === gstin.trim().toUpperCase() && !c.isDeleted
      );
      if (matchByGstin) return matchByGstin;
    }

    if (name) {
      const cleanTarget = name.toLowerCase().replace(/[^a-z0-9]/g, '');
      const matchByName = customers.find((c) => {
        if (c.isDeleted) return false;
        const cleanCust = c.companyName.toLowerCase().replace(/[^a-z0-9]/g, '');
        return cleanCust.includes(cleanTarget) || cleanTarget.includes(cleanCust);
      });
      if (matchByName) return matchByName;
    }

    return null;
  };

  const checkDuplicateInvoice = (invNo: string, invDate: string) => {
    if (!invNo || !invDate) return { isDuplicate: false };
    const fy = calculateFinancialYear(invDate);
    const dup = existingOrders.find(
      (o) =>
        !o.isDeleted &&
        o.invoiceNumber &&
        o.invoiceNumber.trim() === invNo.trim() &&
        (o.financialYear === fy || calculateFinancialYear(o.orderDate || '') === fy)
    );
    return {
      isDuplicate: Boolean(dup),
      orderNumber: dup?.orderNumber,
    };
  };

  const processFiles = async (files: FileList | File[]) => {
    setUploadError(null);
    const newItems: InvoiceReviewItem[] = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];

      if (file.size > 10 * 1024 * 1024) {
        setUploadError(`File "${file.name}" exceeds the 10MB size limit.`);
        continue;
      }

      const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
      const isImg = file.type.startsWith('image/');
      if (!isPdf && !isImg) {
        setUploadError(`File "${file.name}" is not a valid PDF or image.`);
        continue;
      }

      const itemId = `item_${Date.now()}_${i}`;
      const previewUrl = isPdf || isImg ? URL.createObjectURL(file) : undefined;

      let parsed: ParsedInvoiceData;
      if (isPdf) {
        parsed = await parsePdfFileInBrowser(file);
      } else {
        parsed = {
          invoiceNumber: null,
          invoiceDate: null,
          rawDateStr: null,
          totalAmount: null,
          customerName: null,
          customerAddress: null,
          customerCity: null,
          customerGstin: null,
          financialYear: null,
          isFallbackRequired: true,
          parsingWarnings: ['Image upload detected. Please review and type fields manually.'],
        };
      }

      const invNo = parsed.invoiceNumber || '';
      const invDate = parsed.invoiceDate || new Date().toISOString().slice(0, 10);
      const matchedCust = findCustomerMatch(parsed.customerGstin, parsed.customerName, parsed.customerCity);
      const dupCheck = checkDuplicateInvoice(invNo, invDate);

      newItems.push({
        id: itemId,
        file,
        previewUrl,
        parsing: false,
        parsedData: parsed,
        invoiceNumber: invNo,
        invoiceDate: invDate,
        totalAmount: parsed.totalAmount || 0,
        customerName: parsed.customerName || (matchedCust ? matchedCust.companyName : ''),
        customerAddress: parsed.customerAddress || '',
        customerCity: parsed.customerCity || (matchedCust ? matchedCust.place?.city || '' : ''),
        customerGstin: parsed.customerGstin || (matchedCust ? matchedCust.gstin || '' : ''),
        notes: '',
        selectedCustomerId: matchedCust ? matchedCust.id : 'new',
        customerSelectionMode: matchedCust ? 'matched' : 'new',
        isDuplicateInvoice: dupCheck.isDuplicate,
        duplicateOrderNumber: dupCheck.orderNumber,
        isConfirmed: false,
      });
    }

    if (newItems.length > 0) {
      setReviewItems((prev) => [...prev, ...newItems]);
      setActiveItemIndex(reviewItems.length);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      processFiles(e.dataTransfer.files);
    }
  };

  const handleConfirmCurrent = async () => {
    const item = reviewItems[activeItemIndex];
    if (!item) return;

    if (!item.invoiceNumber.trim()) {
      alert('Invoice number is required.');
      return;
    }
    if (!item.totalAmount || item.totalAmount <= 0) {
      alert('Total amount must be greater than zero.');
      return;
    }
    if (!item.customerName.trim() && item.customerSelectionMode === 'new') {
      alert('Customer name is required.');
      return;
    }

    setIsProcessing(true);
    try {
      let finalCustomerId = item.selectedCustomerId;

      if (item.customerSelectionMode === 'new' || finalCustomerId === 'new') {
        const newCustId = await onAddNewCustomer({
          companyName: item.customerName.trim(),
          contactPerson: item.customerName.trim(),
          phone: '',
          place: {
            area: item.customerAddress || '',
            city: item.customerCity || 'Tamil Nadu',
            district: item.customerCity || 'Tamil Nadu',
            state: 'Tamil Nadu',
          },
          address: item.customerAddress,
          city: item.customerCity,
          gstin: item.customerGstin,
          customerType: 'Retailer',
          status: 'New customer',
          source: 'Other',
          leadStage: 'New',
          tags: ['Invoice Import'],
          notes: `Created from Invoice #${item.invoiceNumber}`,
          assignedTo: 'prajindezaa142@gmail.com',
        });
        finalCustomerId = newCustId;
      }

      await onConfirmOrder({
        ...item,
        selectedCustomerId: finalCustomerId,
      });

      setReviewItems((prev) =>
        prev.map((it, idx) => (idx === activeItemIndex ? { ...it, isConfirmed: true } : it))
      );

      const nextPendingIndex = reviewItems.findIndex((it, idx) => idx !== activeItemIndex && !it.isConfirmed);
      if (nextPendingIndex !== -1) {
        setActiveItemIndex(nextPendingIndex);
      } else {
        setTimeout(onClose, 600);
      }
    } catch (err) {
      alert(`Failed to create order: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const currentItem = reviewItems[activeItemIndex];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-stone-900/60 backdrop-blur-xs overflow-y-auto">
      <div className="bg-white rounded-2xl max-w-5xl w-full my-auto shadow-2xl border border-stone-200 flex flex-col max-h-[92vh] overflow-hidden animate-in fade-in zoom-in-95">
        
        {/* Modal Header */}
        <div className="px-5 py-4 border-b border-stone-200 flex items-center justify-between shrink-0 bg-stone-50/70">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-[#881337] text-white flex items-center justify-center shadow-xs">
              <Upload className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-stone-900 font-display">
                Invoice-to-Order Import &amp; Review
              </h2>
              <p className="text-[11px] text-stone-500">
                100% free deterministic PDF text parser. Review fields before creating factory orders.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-stone-400 hover:text-stone-700 hover:bg-stone-200/50 rounded-lg transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {reviewItems.length === 0 ? (
            <div
              onDragOver={(e) => e.preventDefault()}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-stone-300 hover:border-[#881337] hover:bg-amber-50/30 rounded-2xl p-10 text-center cursor-pointer transition-all flex flex-col items-center justify-center space-y-3"
            >
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept="application/pdf,image/*"
                className="hidden"
                onChange={(e) => e.target.files && processFiles(e.target.files)}
              />
              <div className="w-14 h-14 rounded-2xl bg-amber-50 text-amber-800 flex items-center justify-center shadow-xs">
                <FileText className="w-7 h-7" />
              </div>
              <div>
                <span className="text-xs font-bold text-stone-800 block">
                  Click to select or drag &amp; drop Jaikrishna Industries invoice PDFs
                </span>
                <span className="text-[11px] text-stone-500 mt-1 block">
                  Supports multiple PDFs or photos. Zero AI cost · Instant local parsing.
                </span>
              </div>
              <div className="flex items-center gap-2 pt-2">
                <span className="px-2.5 py-1 bg-stone-100 text-stone-600 rounded text-[10px] font-mono font-medium">
                  PDF &lt; 10MB
                </span>
                <span className="px-2.5 py-1 bg-stone-100 text-stone-600 rounded text-[10px] font-mono font-medium">
                  Camera / Gallery
                </span>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {reviewItems.length > 1 && (
                <div className="flex items-center gap-2 overflow-x-auto pb-1 border-b border-stone-200">
                  {reviewItems.map((item, idx) => (
                    <button
                      key={item.id}
                      onClick={() => setActiveItemIndex(idx)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold shrink-0 flex items-center gap-2 transition-all ${
                        activeItemIndex === idx
                          ? 'bg-[#881337] text-white shadow-xs'
                          : 'bg-stone-100 text-stone-700 hover:bg-stone-200'
                      }`}
                    >
                      <span>Invoice #{item.invoiceNumber || `Card ${idx + 1}`}</span>
                      {item.isConfirmed && (
                        <CheckCircle className="w-3.5 h-3.5 text-emerald-300" />
                      )}
                    </button>
                  ))}
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="p-1.5 text-stone-500 hover:text-stone-800 hover:bg-stone-100 rounded-lg text-xs font-bold flex items-center gap-1 shrink-0 ml-auto"
                  >
                    <Plus className="w-3.5 h-3.5" /> Add more
                  </button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    accept="application/pdf,image/*"
                    className="hidden"
                    onChange={(e) => e.target.files && processFiles(e.target.files)}
                  />
                </div>
              )}

              {currentItem?.isDuplicateInvoice && (
                <div className="p-3 bg-amber-50 border border-amber-300 rounded-xl text-amber-900 text-xs flex items-center gap-2.5">
                  <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0" />
                  <div>
                    <span className="font-bold">Duplicate Invoice Warning:</span> Invoice #
                    {currentItem.invoiceNumber} already exists in Order{' '}
                    <span className="font-mono font-semibold">{currentItem.duplicateOrderNumber}</span> for financial year {calculateFinancialYear(currentItem.invoiceDate)}. You can still confirm if this is an intentional re-order.
                  </div>
                </div>
              )}

              {currentItem && (
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
                  {/* Left Side: Document Preview */}
                  <div className="lg:col-span-5 bg-stone-100 rounded-xl border border-stone-200 p-3 flex flex-col items-center justify-center min-h-[340px]">
                    {currentItem.previewUrl ? (
                      <object
                        data={currentItem.previewUrl}
                        type={currentItem.file.type}
                        className="w-full h-full min-h-[380px] rounded-lg shadow-2xs border border-stone-200"
                      >
                        <div className="p-6 text-center text-xs text-stone-500">
                          <FileText className="w-10 h-10 text-stone-400 mx-auto mb-2" />
                          <p className="font-semibold text-stone-700">{currentItem.file.name}</p>
                          <p className="mt-1">{(currentItem.file.size / 1024).toFixed(1)} KB</p>
                        </div>
                      </object>
                    ) : (
                      <div className="text-center p-6 text-stone-500">
                        <FileText className="w-12 h-12 text-stone-400 mx-auto mb-2" />
                        <span className="text-xs font-semibold text-stone-700">{currentItem.file.name}</span>
                      </div>
                    )}
                  </div>

                  {/* Right Side: The 6 Core Editable Fields + Customer Selection */}
                  <div className="lg:col-span-7 space-y-4 text-xs">
                    
                    {/* Customer Attribution */}
                    <div className="p-3.5 rounded-xl bg-stone-50 border border-stone-200/80 space-y-2.5">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-stone-800 flex items-center gap-1.5 font-display">
                          <Building2 className="w-3.5 h-3.5 text-stone-600" /> Customer Attribution
                        </span>
                        {currentItem.customerSelectionMode === 'matched' && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 flex items-center gap-1">
                            <UserCheck className="w-3 h-3" /> Auto-matched
                          </span>
                        )}
                        {currentItem.customerSelectionMode === 'new' && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-900 flex items-center gap-1">
                            <PhoneCall className="w-3 h-3" /> Phone Missing Task Will Be Created
                          </span>
                        )}
                      </div>

                      <div className="grid grid-cols-3 gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            const match = findCustomerMatch(
                              currentItem.customerGstin,
                              currentItem.customerName,
                              currentItem.customerCity
                            );
                            setReviewItems((prev) =>
                              prev.map((it, idx) =>
                                idx === activeItemIndex
                                  ? {
                                      ...it,
                                      customerSelectionMode: 'matched',
                                      selectedCustomerId: match ? match.id : 'new',
                                    }
                                  : it
                              )
                            );
                          }}
                          className={`p-2 rounded-lg border text-left font-medium transition-all ${
                            currentItem.customerSelectionMode === 'matched'
                              ? 'bg-stone-900 text-white border-stone-900 shadow-xs'
                              : 'bg-white text-stone-700 border-stone-200 hover:bg-stone-100'
                          }`}
                        >
                          <span className="block font-bold text-[11px]">Matched</span>
                          <span className="text-[10px] opacity-80 truncate block">By GSTIN or Name</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            setReviewItems((prev) =>
                              prev.map((it, idx) =>
                                idx === activeItemIndex
                                  ? {
                                      ...it,
                                      customerSelectionMode: 'existing',
                                      selectedCustomerId: customers[0]?.id || '',
                                    }
                                  : it
                              )
                            );
                          }}
                          className={`p-2 rounded-lg border text-left font-medium transition-all ${
                            currentItem.customerSelectionMode === 'existing'
                              ? 'bg-stone-900 text-white border-stone-900 shadow-xs'
                              : 'bg-white text-stone-700 border-stone-200 hover:bg-stone-100'
                          }`}
                        >
                          <span className="block font-bold text-[11px]">Pick Existing</span>
                          <span className="text-[10px] opacity-80 truncate block">From CRM Directory</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            setReviewItems((prev) =>
                              prev.map((it, idx) =>
                                idx === activeItemIndex
                                  ? {
                                      ...it,
                                      customerSelectionMode: 'new',
                                      selectedCustomerId: 'new',
                                    }
                                  : it
                              )
                            );
                          }}
                          className={`p-2 rounded-lg border text-left font-medium transition-all ${
                            currentItem.customerSelectionMode === 'new'
                              ? 'bg-stone-900 text-white border-stone-900 shadow-xs'
                              : 'bg-white text-stone-700 border-stone-200 hover:bg-stone-100'
                          }`}
                        >
                          <span className="block font-bold text-[11px]">Create New</span>
                          <span className="text-[10px] opacity-80 truncate block">From Invoice Buyer</span>
                        </button>
                      </div>

                      {currentItem.customerSelectionMode === 'existing' && (
                        <div>
                          <label className="block text-[11px] font-semibold text-stone-600 mb-1">
                            Select Customer from Directory:
                          </label>
                          <select
                            value={currentItem.selectedCustomerId}
                            onChange={(e) => {
                              const val = e.target.value;
                              const c = customers.find((cust) => cust.id === val);
                              setReviewItems((prev) =>
                                prev.map((it, idx) =>
                                  idx === activeItemIndex
                                    ? {
                                        ...it,
                                        selectedCustomerId: val,
                                        customerName: c ? c.companyName : it.customerName,
                                      }
                                    : it
                                )
                              );
                            }}
                            className="w-full px-3 py-1.5 bg-white border border-stone-300 rounded-lg text-xs"
                          >
                            {customers.map((c) => (
                              <option key={c.id} value={c.id}>
                                {c.companyName} ({c.place?.city || 'Salem'}) — {c.phone || 'No phone'}
                              </option>
                            ))}
                          </select>
                        </div>
                      )}
                    </div>

                    {/* The 6 Editable Fields */}
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block font-semibold text-stone-700 mb-1 flex items-center justify-between">
                          <span>1. Invoice Number</span>
                          {!currentItem.invoiceNumber && (
                            <span className="text-[10px] text-amber-700 font-bold">Could not read</span>
                          )}
                        </label>
                        <div className="relative">
                          <Hash className="w-3.5 h-3.5 text-stone-400 absolute left-2.5 top-2.5" />
                          <input
                            type="text"
                            value={currentItem.invoiceNumber}
                            onChange={(e) => {
                              const val = e.target.value;
                              const dup = checkDuplicateInvoice(val, currentItem.invoiceDate);
                              setReviewItems((prev) =>
                                prev.map((it, idx) =>
                                  idx === activeItemIndex
                                    ? {
                                        ...it,
                                        invoiceNumber: val,
                                        isDuplicateInvoice: dup.isDuplicate,
                                        duplicateOrderNumber: dup.orderNumber,
                                      }
                                    : it
                                )
                              );
                            }}
                            placeholder="e.g. 62"
                            className="w-full pl-8 pr-3 py-1.5 bg-white border border-stone-300 rounded-lg text-xs font-mono font-bold text-stone-900 focus:border-[#881337] focus:outline-hidden"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block font-semibold text-stone-700 mb-1 flex items-center justify-between">
                          <span>2. Invoice Date</span>
                          {!currentItem.invoiceDate && (
                            <span className="text-[10px] text-amber-700 font-bold">Could not read</span>
                          )}
                        </label>
                        <div className="relative">
                          <Calendar className="w-3.5 h-3.5 text-stone-400 absolute left-2.5 top-2.5" />
                          <input
                            type="date"
                            value={currentItem.invoiceDate}
                            onChange={(e) => {
                              const val = e.target.value;
                              const dup = checkDuplicateInvoice(currentItem.invoiceNumber, val);
                              setReviewItems((prev) =>
                                prev.map((it, idx) =>
                                  idx === activeItemIndex
                                    ? {
                                        ...it,
                                        invoiceDate: val,
                                        isDuplicateInvoice: dup.isDuplicate,
                                        duplicateOrderNumber: dup.orderNumber,
                                      }
                                    : it
                                )
                              );
                            }}
                            className="w-full pl-8 pr-3 py-1.5 bg-white border border-stone-300 rounded-lg text-xs font-mono text-stone-900 focus:border-[#881337] focus:outline-hidden"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block font-semibold text-stone-700 mb-1 flex items-center justify-between">
                          <span>3. Total Amount (₹)</span>
                          {currentItem.totalAmount <= 0 && (
                            <span className="text-[10px] text-amber-700 font-bold">Could not read</span>
                          )}
                        </label>
                        <div className="relative">
                          <IndianRupee className="w-3.5 h-3.5 text-stone-400 absolute left-2.5 top-2.5" />
                          <input
                            type="number"
                            step="0.01"
                            value={currentItem.totalAmount || ''}
                            onChange={(e) => {
                              const val = parseFloat(e.target.value) || 0;
                              setReviewItems((prev) =>
                                prev.map((it, idx) =>
                                  idx === activeItemIndex ? { ...it, totalAmount: val } : it
                                )
                              );
                            }}
                            placeholder="e.g. 8031.00"
                            className="w-full pl-8 pr-3 py-1.5 bg-white border border-stone-300 rounded-lg text-xs font-mono font-bold text-stone-900 focus:border-[#881337] focus:outline-hidden"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block font-semibold text-stone-700 mb-1 flex items-center justify-between">
                          <span>4. Customer / Buyer</span>
                          {!currentItem.customerName && (
                            <span className="text-[10px] text-amber-700 font-bold">Could not read</span>
                          )}
                        </label>
                        <input
                          type="text"
                          value={currentItem.customerName}
                          onChange={(e) => {
                            const val = e.target.value;
                            setReviewItems((prev) =>
                              prev.map((it, idx) =>
                                idx === activeItemIndex ? { ...it, customerName: val } : it
                              )
                            );
                          }}
                          placeholder="e.g. AMNS ENTERPRISES"
                          className="w-full px-3 py-1.5 bg-white border border-stone-300 rounded-lg text-xs font-medium text-stone-900 focus:border-[#881337] focus:outline-hidden"
                        />
                      </div>

                      <div>
                        <label className="block font-semibold text-stone-700 mb-1">
                          5. City / Town
                        </label>
                        <div className="relative">
                          <MapPin className="w-3.5 h-3.5 text-stone-400 absolute left-2.5 top-2.5" />
                          <input
                            type="text"
                            value={currentItem.customerCity}
                            onChange={(e) => {
                              const val = e.target.value;
                              setReviewItems((prev) =>
                                prev.map((it, idx) =>
                                  idx === activeItemIndex ? { ...it, customerCity: val } : it
                                )
                              );
                            }}
                            placeholder="e.g. Thoothukudi"
                            className="w-full pl-8 pr-3 py-1.5 bg-white border border-stone-300 rounded-lg text-xs text-stone-900 focus:border-[#881337] focus:outline-hidden"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block font-semibold text-stone-700 mb-1">
                          6. Customer GSTIN (Optional)
                        </label>
                        <input
                          type="text"
                          value={currentItem.customerGstin}
                          onChange={(e) => {
                            const val = e.target.value.toUpperCase();
                            setReviewItems((prev) =>
                              prev.map((it, idx) =>
                                idx === activeItemIndex ? { ...it, customerGstin: val } : it
                              )
                            );
                          }}
                          placeholder="e.g. 33BBSPA1067M1ZJ"
                          className="w-full px-3 py-1.5 bg-white border border-stone-300 rounded-lg text-xs font-mono uppercase text-stone-900 focus:border-[#881337] focus:outline-hidden"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block font-semibold text-stone-700 mb-1">
                        Buyer Address Lines
                      </label>
                      <input
                        type="text"
                        value={currentItem.customerAddress}
                        onChange={(e) => {
                          const val = e.target.value;
                          setReviewItems((prev) =>
                            prev.map((it, idx) =>
                              idx === activeItemIndex ? { ...it, customerAddress: val } : it
                            )
                          );
                        }}
                        placeholder="e.g. 306, A.S.K.R COMPOUND, THAMODAR NAGAR"
                        className="w-full px-3 py-1.5 bg-white border border-stone-300 rounded-lg text-xs text-stone-900 focus:border-[#881337] focus:outline-hidden"
                      />
                    </div>

                    <div>
                      <label className="block font-semibold text-stone-700 mb-1">
                        7. Notes (Optional)
                      </label>
                      <input
                        type="text"
                        value={currentItem.notes}
                        onChange={(e) => {
                          const val = e.target.value;
                          setReviewItems((prev) =>
                            prev.map((it, idx) =>
                              idx === activeItemIndex ? { ...it, notes: val } : it
                            )
                          );
                        }}
                        placeholder="Internal packaging instructions, transporter notes..."
                        className="w-full px-3 py-1.5 bg-white border border-stone-300 rounded-lg text-xs text-stone-900 focus:border-[#881337] focus:outline-hidden"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {uploadError && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-xs flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{uploadError}</span>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-5 py-3 border-t border-stone-200 bg-stone-50 flex items-center justify-between shrink-0">
          <div className="text-[11px] text-stone-500">
            {reviewItems.length > 0 && (
              <span>
                Card {activeItemIndex + 1} of {reviewItems.length} ·{' '}
                {reviewItems.filter((i) => i.isConfirmed).length} confirmed
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 bg-white border border-stone-300 text-stone-700 hover:bg-stone-50 rounded-lg text-xs font-semibold"
            >
              Cancel
            </button>
            {reviewItems.length > 0 && (
              <button
                type="button"
                disabled={isProcessing || currentItem?.isConfirmed}
                onClick={handleConfirmCurrent}
                className={`px-4 py-1.5 rounded-lg text-xs font-bold shadow-xs flex items-center gap-1.5 transition-colors ${
                  currentItem?.isConfirmed
                    ? 'bg-emerald-600 text-white cursor-default'
                    : 'bg-[#881337] text-white hover:bg-[#70102e]'
                }`}
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" /> Confirming...
                  </>
                ) : currentItem?.isConfirmed ? (
                  <>
                    <CheckCircle className="w-3.5 h-3.5" /> Confirmed
                  </>
                ) : (
                  <>
                    <CheckCircle className="w-3.5 h-3.5" /> Confirm &amp; Create Order
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
