/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Jaikrishna Industries — Invoice Text PDF Parser & Duplicate Verification
 * High-precision, zero-AI, deterministic position parser for Jaikrishna Industries Tax Invoices.
 *
 * Template features:
 * - "TAX INVOICE" header
 * - Seller: "JAI KRISHNA INDUSTRIES"
 * - Top-right: "Invoice No." and "Date"
 * - Left block: "Buyer" / "M/s. <Customer Name>" followed by address, city, GSTIN
 * - Bottom-right: "Bill Value <Amount>"
 */

export interface ParsedInvoiceData {
  invoiceNumber: string | null;
  invoiceDate: string | null; // YYYY-MM-DD
  rawDateStr: string | null;
  totalAmount: number | null;
  customerName: string | null;
  customerAddress: string | null;
  customerCity: string | null;
  customerGstin: string | null;
  financialYear: string | null; // e.g. "2026-2027"
  isFallbackRequired: boolean;
  notes?: string;
  parsingWarnings: string[];
}

/**
 * Calculates Indian Financial Year (April 1 to March 31) for a given date.
 */
export function calculateFinancialYear(dateStr: string): string {
  const parts = dateStr.split('-');
  if (parts.length < 3) return '';
  const year = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10);
  if (isNaN(year) || isNaN(month)) return '';

  if (month >= 4) {
    return `${year}-${year + 1}`;
  } else {
    return `${year - 1}-${year}`;
  }
}

/**
 * Converts DD/MM/YYYY or DD-MM-YYYY to standard ISO YYYY-MM-DD.
 */
export function parseDateToISO(dStr: string): string | null {
  if (!dStr) return null;
  const match = dStr.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
  if (!match) return null;
  const day = match[1].padStart(2, '0');
  const month = match[2].padStart(2, '0');
  const year = match[3];
  return `${year}-${month}-${day}`;
}

/**
 * Cleans extracted text and normalizes whitespace while strictly defending against prompt-injections
 * (Treats all input strictly as inert plain text).
 */
export function sanitizePlainText(val: string): string {
  if (!val) return '';
  return val.replace(/[\u0000-\u001F\u007F-\u009F]/g, ' ').replace(/\s+/g, ' ').trim();
}

/**
 * Parses raw text lines extracted from a Jaikrishna Industries born-digital PDF.
 */
export function parseInvoiceLines(lines: string[]): ParsedInvoiceData {
  const warnings: string[] = [];
  let invoiceNumber: string | null = null;
  let rawDateStr: string | null = null;
  let totalAmount: number | null = null;
  let customerName: string | null = null;
  let customerAddress: string | null = null;
  let customerCity: string | null = null;
  let customerGstin: string | null = null;

  // 1. Locate Invoice Number and Date
  // In the layout, Line 2 contains "Invoice No.   Date" and Line 3 contains "<Seller addr>,  <InvNo>   <DD/MM/YYYY>"
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Pattern A: "Invoice No." followed immediately or on next line
    if (/Invoice\s*No/i.test(line)) {
      // Check current line first
      const directMatch = line.match(/Invoice\s*No\.?\s*[:\-]?\s*(\d+)/i);
      if (directMatch) {
        invoiceNumber = directMatch[1];
      }

      // Check current or adjacent lines for Date
      const dateMatch = line.match(/(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{4})/);
      if (dateMatch) {
        rawDateStr = dateMatch[1];
      }

      // Check next line (Line 3 in standard template)
      if (i + 1 < lines.length) {
        const nextLine = lines[i + 1];
        if (!invoiceNumber) {
          // Look for standalone or trailing number before date, e.g. ", 62   01/10/2026"
          const numDateMatch = nextLine.match(/,\s*(\d{1,6})\s+(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{4})/);
          if (numDateMatch) {
            invoiceNumber = numDateMatch[1];
            if (!rawDateStr) rawDateStr = numDateMatch[2];
          } else {
            const numMatch = nextLine.match(/\b(\d{1,6})\b\s+(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{4})/);
            if (numMatch) {
              invoiceNumber = numMatch[1];
              if (!rawDateStr) rawDateStr = numMatch[2];
            }
          }
        }
        if (!rawDateStr) {
          const nextDateMatch = nextLine.match(/(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{4})/);
          if (nextDateMatch) rawDateStr = nextDateMatch[1];
        }
      }
    }
  }

  // 2. Locate Buyer Block (Customer Name, Address, City, GSTIN)
  // Usually starts with "Buyer" or "M/s."
  let buyerStartIndex = -1;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (/\bBuyer\b/i.test(line) && !/Buyer's Order/i.test(line)) {
      buyerStartIndex = i;
      break;
    }
  }

  if (buyerStartIndex !== -1) {
    const addressLines: string[] = [];

    for (let i = buyerStartIndex + 1; i < Math.min(lines.length, buyerStartIndex + 10); i++) {
      const line = lines[i];

      // End of buyer block indicators
      if (/Description of Goods/i.test(line) || /Tax %/i.test(line) || /HSN/i.test(line)) {
        break;
      }

      // Match Customer Name (Line with "M/s.")
      if (/M\/s\./i.test(line) && !customerName) {
        // Strip seller noise if any, e.g. "M/s. AMNS ENTERPRISES  M/s."
        const cleanName = line
          .replace(/M\/s\.\s*$/i, '')
          .replace(/^.*?M\/s\.\s*/i, '')
          .trim();
        if (cleanName) {
          customerName = sanitizePlainText(cleanName);
        }
        continue;
      }

      // Match Buyer GSTIN
      const gstinMatch = line.match(/GSTIN\s*\.?\s*:\s*([0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1})/i);
      if (gstinMatch) {
        customerGstin = gstinMatch[1].toUpperCase();
        continue;
      }

      // Collect Address / City lines
      if (!/State\s*:/i.test(line) && !/GSTIN/i.test(line) && !/Shipped to/i.test(line)) {
        const cleaned = sanitizePlainText(line);
        if (cleaned) {
          addressLines.push(cleaned);
        }
      }
    }

    if (addressLines.length > 0) {
      // The last line in the address block is almost always the City / Pin in Tamil Nadu invoices
      const possibleCityLine = addressLines[addressLines.length - 1];
      const cityMatch = possibleCityLine.match(/([A-Z\s]+)(?:-\d{6})?$/i);
      customerCity = cityMatch ? cityMatch[1].trim() : possibleCityLine;
      customerAddress = addressLines.join(', ');
    }
  }

  // 3. Locate Total Amount ("Bill Value")
  for (let i = lines.length - 1; i >= 0; i--) {
    const line = lines[i];
    if (/Bill\s*Value/i.test(line)) {
      const amtMatch = line.match(/Bill\s*Value\s*[:\-]?\s*([\d,]+\.?\d*)/i);
      if (amtMatch) {
        const numStr = amtMatch[1].replace(/,/g, '');
        const val = parseFloat(numStr);
        if (!isNaN(val) && val > 0) {
          totalAmount = val;
          break;
        }
      }
    }
  }

  // Fallback for Bill Value if not found directly on "Bill Value" line
  if (totalAmount === null) {
    for (let i = lines.length - 1; i >= 0; i--) {
      const line = lines[i];
      if (/Total/i.test(line) || /Taxable Value/i.test(line)) {
        const amtMatch = line.match(/\b([\d,]+\.\d{2})\b/);
        if (amtMatch) {
          const val = parseFloat(amtMatch[1].replace(/,/g, ''));
          if (!isNaN(val) && val > 0) {
            totalAmount = val;
            break;
          }
        }
      }
    }
  }

  const invoiceDate = rawDateStr ? parseDateToISO(rawDateStr) : null;
  const financialYear = invoiceDate ? calculateFinancialYear(invoiceDate) : null;

  if (!invoiceNumber) warnings.push('Invoice number could not be determined.');
  if (!invoiceDate) warnings.push('Invoice date could not be determined.');
  if (!totalAmount) warnings.push('Bill value could not be determined.');
  if (!customerName) warnings.push('Customer name could not be determined.');

  const isFallbackRequired =
    !invoiceNumber || !invoiceDate || totalAmount === null || !customerName;

  return {
    invoiceNumber,
    invoiceDate,
    rawDateStr,
    totalAmount,
    customerName,
    customerAddress,
    customerCity,
    customerGstin,
    financialYear,
    isFallbackRequired,
    parsingWarnings: warnings,
  };
}

/**
 * Parses a File object (PDF) directly in browser using pdfjs-dist.
 */
export async function parsePdfFileInBrowser(file: File): Promise<ParsedInvoiceData> {
  try {
    const pdfjsLib = await import('pdfjs-dist');
    // Set worker source to CDN for zero-bundler setup or use standard worker
    if (!pdfjsLib.GlobalWorkerOptions.workerSrc) {
      pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;
    }

    const arrayBuffer = await file.arrayBuffer();
    const pdfDoc = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    const allLines: string[] = [];

    for (let pageNum = 1; pageNum <= pdfDoc.numPages; pageNum++) {
      const page = await pdfDoc.getPage(pageNum);
      const textContent = await page.getTextContent();
      const items = textContent.items as Array<{ str: string; transform: number[] }>;

      // Sort items by Y (descending) and X (ascending)
      const sorted = [...items].sort((a, b) => {
        const yA = a.transform[5];
        const yB = b.transform[5];
        if (Math.abs(yA - yB) > 3) return yB - yA;
        return a.transform[4] - b.transform[4];
      });

      let currentLine = '';
      let lastY: number | null = null;

      for (const item of sorted) {
        const y = item.transform[5];
        if (lastY === null || Math.abs(y - lastY) > 4) {
          if (currentLine.trim()) allLines.push(currentLine.trim());
          currentLine = item.str;
          lastY = y;
        } else {
          currentLine += ' ' + item.str;
        }
      }
      if (currentLine.trim()) allLines.push(currentLine.trim());
    }

    return parseInvoiceLines(allLines);
  } catch (err) {
    console.warn('PDF parsing error, switching to manual fallback review screen:', err);
    return {
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
      parsingWarnings: ['Could not read text from this file. Please enter fields manually.'],
    };
  }
}
