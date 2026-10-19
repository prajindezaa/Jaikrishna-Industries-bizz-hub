/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Jaikrishna Industries — Central Deep Link & Route Registry
 * Supports query parameters without heavy router churn:
 * Parses ?module=tasks&id=... or ?module=customers&id=...
 * Supports fallback to trash, missing record notice, and persistence across login.
 */

import { ActiveModule } from '../types';

export interface ParsedRoute {
  module: ActiveModule;
  id?: string;
  tab?: string;
  batch?: string;
  filter?: string;
  date?: string;
  rawUrl: string;
}

export function parseDeepLink(urlOrPath: string): ParsedRoute {
  try {
    const parsed = new URL(urlOrPath, window.location.origin);
    const path = parsed.pathname.replace(/^\//, '');
    const searchParams = parsed.searchParams;

    let module: ActiveModule = 'dashboard';
    if (path.includes('customer') || searchParams.get('module') === 'customers') module = 'customers';
    else if (path.includes('task') || searchParams.get('module') === 'tasks') module = 'tasks';
    else if (path.includes('planning') || path.includes('meta-ad') || searchParams.get('module') === 'planning') module = 'planning';
    else if (path.includes('order') || searchParams.get('module') === 'orders') module = 'orders';
    else if (path.includes('automation') || searchParams.get('module') === 'automations') module = 'automations';
    else if (path.includes('setting') || searchParams.get('module') === 'settings') module = 'settings';
    else if (path.includes('trash') || searchParams.get('module') === 'trash') module = 'trash';
    else if (path.includes('assistant') || searchParams.get('module') === 'assistant') module = 'assistant';

    return {
      module,
      id: searchParams.get('id') || undefined,
      tab: searchParams.get('tab') || undefined,
      batch: searchParams.get('batch') || undefined,
      filter: searchParams.get('filter') || undefined,
      date: searchParams.get('date') || undefined,
      rawUrl: urlOrPath,
    };
  } catch {
    return {
      module: 'dashboard',
      rawUrl: urlOrPath,
    };
  }
}

export function buildDeepLink(module: ActiveModule, params?: Record<string, string>): string {
  const query = new URLSearchParams({ module, ...(params || {}) }).toString();
  return `/?${query}`;
}

const REDIRECT_STORAGE_KEY = 'jaikrishna_pending_deeplink';

export function storePendingDeepLink(url: string) {
  try {
    sessionStorage.setItem(REDIRECT_STORAGE_KEY, url);
  } catch (e) {
    console.warn('Failed to store pending deep link', e);
  }
}

export function consumePendingDeepLink(): string | null {
  try {
    const link = sessionStorage.getItem(REDIRECT_STORAGE_KEY);
    if (link) {
      sessionStorage.removeItem(REDIRECT_STORAGE_KEY);
      return link;
    }
  } catch (e) {
    console.warn('Failed to consume pending deep link', e);
  }
  return null;
}
