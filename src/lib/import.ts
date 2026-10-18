/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import * as XLSX from 'xlsx';
import { Customer, CustomerType, CustomerStatus, LeadSource } from '../types';
import { normalizePhone, isValidPhone } from './phone';

export interface ColumnMapping {
  companyName: string;
  contactPerson: string;
  phone: string;
  city: string;
  area: string;
  customerType: string;
  status: string;
  source: string;
  notes: string;
}

export interface ParsedRow {
  index: number;
  data: Partial<Customer>;
  raw: Record<string, unknown>;
  isValid: boolean;
  errors: string[];
  isDuplicate: boolean;
  normalizedPhone: string;
}

export interface ImportPreviewResult {
  headers: string[];
  totalRows: number;
  validRows: ParsedRow[];
  invalidRows: ParsedRow[];
  duplicateRows: ParsedRow[];
}

/**
 * Automatically guesses column mappings based on common header names
 */
export function autoDetectColumnMapping(headers: string[]): ColumnMapping {
  const findMatch = (candidates: string[]): string => {
    for (const c of candidates) {
      const match = headers.find((h) => h.toLowerCase().trim() === c.toLowerCase().trim());
      if (match) return match;
    }
    // Partial inclusion
    for (const c of candidates) {
      const match = headers.find((h) => h.toLowerCase().includes(c.toLowerCase()));
      if (match) return match;
    }
    return '';
  };

  return {
    companyName: findMatch(['company name', 'company', 'shop name', 'shop', 'business name', 'store name']),
    contactPerson: findMatch(['contact person', 'contact', 'name', 'person', 'owner name']),
    phone: findMatch(['phone', 'mobile', 'whatsapp', 'contact number', 'phone number', 'cell']),
    city: findMatch(['city', 'place', 'location', 'town']),
    area: findMatch(['area', 'street', 'locality', 'address']),
    customerType: findMatch(['customer type', 'type', 'category', 'business type']),
    status: findMatch(['status', 'customer status']),
    source: findMatch(['source', 'lead source', 'campaign']),
    notes: findMatch(['notes', 'remarks', 'comments', 'inquiry']),
  };
}

/**
 * Reads and parses an uploaded Excel/CSV file using SheetJS
 */
export async function parseImportFile(file: File): Promise<{ headers: string[]; rawRows: Record<string, unknown>[] }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];

        const rawRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(worksheet, { defval: '' });
        if (rawRows.length === 0) {
          resolve({ headers: [], rawRows: [] });
          return;
        }

        const headers = Object.keys(rawRows[0]);
        resolve({ headers, rawRows });
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = (err) => reject(err);
    reader.readAsArrayBuffer(file);
  });
}

/**
 * Validates parsed raw rows against mapping, normalizes phone, and checks duplicates
 */
export function validateAndMapRows(
  rawRows: Record<string, unknown>[],
  mapping: ColumnMapping,
  existingPhones: Set<string>,
  defaults: {
    status: CustomerStatus;
    source: LeadSource;
    assignedTo: string;
  }
): ImportPreviewResult {
  const validRows: ParsedRow[] = [];
  const invalidRows: ParsedRow[] = [];
  const duplicateRows: ParsedRow[] = [];
  const batchSeenPhones = new Set<string>();

  rawRows.forEach((row, idx) => {
    const company = String(row[mapping.companyName] || '').trim();
    const contact = String(row[mapping.contactPerson] || company || '').trim();
    const rawPhone = String(row[mapping.phone] || '').trim();
    const city = String(row[mapping.city] || 'Salem').trim();
    const area = String(row[mapping.area] || '').trim();
    const custType = (row[mapping.customerType] || 'Distributor') as CustomerType;
    const notes = String(row[mapping.notes] || '').trim();

    const errors: string[] = [];
    if (!company) {
      errors.push('Missing company or shop name');
    }

    const normalized = normalizePhone(rawPhone);
    if (!normalized || !isValidPhone(normalized)) {
      errors.push(`Invalid phone format: "${rawPhone}"`);
    }

    const isDuplicate = existingPhones.has(normalized) || batchSeenPhones.has(normalized);
    if (normalized) {
      batchSeenPhones.add(normalized);
    }

    const rowSource = (mapping.source ? String(row[mapping.source] || '').trim() : '') as LeadSource;
    const finalSource = rowSource || defaults.source;

    const parsedData: Partial<Customer> = {
      companyName: company,
      contactPerson: contact || company,
      phone: normalized,
      whatsapp: normalized,
      place: { area, city, district: city, state: 'Tamil Nadu' },
      customerType: custType,
      status: defaults.status,
      source: finalSource,
      assignedTo: defaults.assignedTo,
      leadStage: 'New',
      tags: ['Imported'],
      notes,
      totalOrdersCount: 0,
      totalRevenue: 0,
      statusHistory: [],
      isDeleted: false,
    };

    const parsedRow: ParsedRow = {
      index: idx + 1,
      data: parsedData,
      raw: row,
      isValid: errors.length === 0,
      errors,
      isDuplicate,
      normalizedPhone: normalized,
    };

    if (!parsedRow.isValid) {
      invalidRows.push(parsedRow);
    } else if (isDuplicate) {
      duplicateRows.push(parsedRow);
    } else {
      validRows.push(parsedRow);
    }
  });

  return {
    headers: rawRows.length > 0 ? Object.keys(rawRows[0]) : [],
    totalRows: rawRows.length,
    validRows,
    invalidRows,
    duplicateRows,
  };
}
