/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Normalizes phone numbers with India (+91) as default.
 * Handles:
 *  - 10 digits: "9876543210" -> "+919876543210"
 *  - Leading zero: "09876543210" -> "+919876543210"
 *  - 91 prefix without plus: "919876543210" -> "+919876543210"
 *  - Existing E.164: "+919876543210" -> "+919876543210"
 *  - Strips spaces, dashes, parentheses
 */
export function normalizePhone(rawPhone: string): string {
  if (!rawPhone) return '';

  // Remove all non-numeric characters except leading plus
  let cleaned = rawPhone.trim().replace(/[^\d+]/g, '');

  if (cleaned.startsWith('+')) {
    // Already has plus, strip extra pluses
    const digits = cleaned.slice(1).replace(/\D/g, '');
    return `+${digits}`;
  }

  // Remove leading zeros if present
  if (cleaned.startsWith('0')) {
    cleaned = cleaned.slice(1);
  }

  // If 12 digits starting with 91, format as +91
  if (cleaned.length === 12 && cleaned.startsWith('91')) {
    return `+${cleaned}`;
  }

  // If 10 digits, assume India (+91)
  if (cleaned.length === 10) {
    return `+91${cleaned}`;
  }

  // If it's already another country length without plus, add plus
  if (cleaned.length > 10) {
    return `+${cleaned}`;
  }

  // Default fallback prepend +91
  return cleaned ? `+91${cleaned}` : '';
}

/**
 * Validates whether the normalized phone string has at least 10 valid digits
 */
export function isValidPhone(phone: string): boolean {
  const normalized = normalizePhone(phone);
  const digitsOnly = normalized.replace(/\D/g, '');
  return digitsOnly.length >= 10 && digitsOnly.length <= 15;
}

/**
 * Formats a normalized phone number for visual display
 * e.g., +919876543210 -> "+91 98765 43210"
 */
export function formatPhoneDisplay(phone: string): string {
  const norm = normalizePhone(phone);
  if (!norm) return '';
  if (norm.startsWith('+91') && norm.length === 13) {
    return `+91 ${norm.slice(3, 8)} ${norm.slice(8)}`;
  }
  return norm;
}

/**
 * Builds a direct `tel:` URI for one-tap calling
 */
export function getTelLink(phone: string): string {
  const normalized = normalizePhone(phone);
  return `tel:${normalized}`;
}

/**
 * Builds a direct `https://wa.me/...` URL with optional prefilled message
 */
export function getWhatsAppLink(phone: string, message?: string): string {
  const normalized = normalizePhone(phone);
  // wa.me expects digits only without leading '+'
  const digitsOnly = normalized.replace(/\D/g, '');
  const baseUrl = `https://wa.me/${digitsOnly}`;
  if (message && message.trim()) {
    return `${baseUrl}?text=${encodeURIComponent(message.trim())}`;
  }
  return baseUrl;
}
