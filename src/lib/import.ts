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
  groupName?: string;
  customerType?: string; // legacy fallback
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
  matchedExistingCustomer?: Customer | null;
  detectedGroupName?: string | null;
}

export interface ImportPreviewResult {
  headers: string[];
  totalRows: number;
  validRows: ParsedRow[];
  invalidRows: ParsedRow[];
  duplicateRows: ParsedRow[];
  groupDistribution: Record<string, number>;
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
    groupName: findMatch(['customer group', 'group', 'group name', 'segment', 'customer type', 'type', 'category']),
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
 * Validates parsed raw rows against mapping, normalizes phone, resolves customer groups, and checks duplicates
 */
export function validateAndMapRows(
  rawRows: Record<string, unknown>[],
  mapping: ColumnMapping,
  existingCustomers: Customer[],
  defaults: {
    status: CustomerStatus;
    source: LeadSource;
    assignedTo: string;
    groupMode: 'fixed_group' | 'file_column';
    fixedGroupId?: string | null;
    customerGroups: Array<{ id: string; name: string; isActive: boolean }>;
  }
): ImportPreviewResult {
  const validRows: ParsedRow[] = [];
  const invalidRows: ParsedRow[] = [];
  const duplicateRows: ParsedRow[] = [];
  const batchSeenPhones = new Map<string, number>();
  const groupDistribution: Record<string, number> = {};

  const existingPhoneMap = new Map<string, Customer>();
  existingCustomers.forEach((c) => {
    if (c.phone && !c.isDeleted) {
      existingPhoneMap.set(c.phone, c);
    }
  });

  const now = new Date().toISOString();
  const fixedGroup = defaults.fixedGroupId
    ? defaults.customerGroups.find((g) => g.id === defaults.fixedGroupId)
    : null;

  rawRows.forEach((row, idx) => {
    const company = String(row[mapping.companyName] || '').trim();
    const contact = String(row[mapping.contactPerson] || company || '').trim();
    const rawPhone = String(row[mapping.phone] || '').trim();
    const city = String(row[mapping.city] || 'Salem').trim();
    const area = String(row[mapping.area] || '').trim();
    const notes = String(row[mapping.notes] || '').trim();

    const errors: string[] = [];
    if (!company) {
      errors.push('Missing company or shop name');
    }

    const normalized = normalizePhone(rawPhone);
    if (!normalized || !isValidPhone(normalized)) {
      errors.push(`Invalid phone format: "${rawPhone}"`);
    }

    // Resolve Customer Group
    let resolvedGroupId: string | null = null;
    let resolvedGroupName: string = 'Ungrouped';
    let rawGroupFromRow = '';

    if (defaults.groupMode === 'fixed_group') {
      if (fixedGroup) {
        resolvedGroupId = fixedGroup.id;
        resolvedGroupName = fixedGroup.name;
      } else {
        resolvedGroupId = null;
        resolvedGroupName = 'Ungrouped';
      }
    } else {
      // From File Column
      const colKey = mapping.groupName || mapping.customerType;
      rawGroupFromRow = colKey ? String(row[colKey] || '').trim() : '';

      if (rawGroupFromRow) {
        const matched = defaults.customerGroups.find(
          (g) => g.name.toLowerCase().trim() === rawGroupFromRow.toLowerCase().trim()
        );
        if (matched) {
          if (!matched.isActive) {
            errors.push(`Group "${matched.name}" is archived and cannot receive new customers.`);
          }
          resolvedGroupId = matched.id;
          resolvedGroupName = matched.name;
        } else {
          // Unrecognized group name in file column -> flag warning or fallback to Ungrouped
          resolvedGroupId = null;
          resolvedGroupName = 'Ungrouped';
        }
      } else {
        resolvedGroupId = null;
        resolvedGroupName = 'Ungrouped';
      }
    }

    // Duplicate Phone Check
    const matchedExisting = normalized ? existingPhoneMap.get(normalized) || null : null;
    const isBatchDuplicate = normalized ? batchSeenPhones.has(normalized) : false;
    const isDuplicate = Boolean(matchedExisting) || isBatchDuplicate;

    if (normalized) {
      batchSeenPhones.set(normalized, idx);
    }

    const rowSource = (mapping.source ? String(row[mapping.source] || '').trim() : '') as LeadSource;
    const finalSource = rowSource || defaults.source;

    const parsedData: Partial<Customer> = {
      companyName: company,
      contactPerson: contact || company,
      phone: normalized,
      whatsapp: normalized,
      place: { area, city, district: city, state: 'Tamil Nadu' },
      groupId: resolvedGroupId,
      groupName: resolvedGroupName,
      groupAssignedAt: resolvedGroupId ? now : undefined,
      groupAssignedBy: resolvedGroupId ? defaults.assignedTo : undefined,
      previousGroupId: null,
      customerType: resolvedGroupName as CustomerType,
      status: defaults.status,
      source: finalSource,
      assignedTo: defaults.assignedTo,
      leadStage: 'New',
      tags: ['Imported Batch'],
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
      matchedExistingCustomer: matchedExisting,
      detectedGroupName: rawGroupFromRow || resolvedGroupName,
    };

    // Track group breakdown for valid rows
    if (parsedRow.isValid) {
      const gKey = resolvedGroupName || 'Ungrouped';
      groupDistribution[gKey] = (groupDistribution[gKey] || 0) + 1;
    }

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
    groupDistribution,
  };
}
