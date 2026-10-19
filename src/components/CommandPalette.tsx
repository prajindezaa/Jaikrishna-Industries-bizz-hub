/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import {
  Search,
  Users,
  CheckSquare,
  Sparkles,
  ShoppingBag,
  Trash2,
  Settings,
  LayoutDashboard,
  Calendar,
  Globe,
  LogOut,
  X,
  PlusCircle,
  Megaphone,
} from 'lucide-react';
import { ActiveModule } from '../types';
import { useLanguage } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigate: (module: ActiveModule) => void;
  onOpenNewCustomer?: () => void;
  onOpenNewTask?: () => void;
}

export const CommandPalette: React.FC<CommandPaletteProps> = ({
  isOpen,
  onClose,
  onNavigate,
  onOpenNewCustomer,
  onOpenNewTask,
}) => {
  const [query, setQuery] = useState('');
  const { toggleLanguage, t } = useLanguage();
  const { signOut, member } = useAuth();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        onClose(); // toggle or open handled externally
      }
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const items = [
    {
      category: 'Navigation',
      items: [
        { id: 'dashboard', label: t('navDashboard', 'Dashboard'), icon: LayoutDashboard, action: () => onNavigate('dashboard') },
        { id: 'customers', label: t('navCustomers', 'Customers (CRM)'), icon: Users, action: () => onNavigate('customers') },
        { id: 'tasks', label: t('navTasks', 'Tasks & Planner'), icon: CheckSquare, action: () => onNavigate('tasks') },
        { id: 'planning', label: t('navPlanning', 'Planning Hub'), icon: Calendar, action: () => onNavigate('planning') },
        { id: 'meta_ads', label: t('navMetaAds', 'Meta Ads Hub'), icon: Megaphone, action: () => onNavigate('meta_ads') },
        { id: 'orders', label: t('navOrders', 'Orders'), icon: ShoppingBag, action: () => onNavigate('orders') },
        { id: 'trash', label: t('navTrash', 'Trash (30-day retention)'), icon: Trash2, action: () => onNavigate('trash') },
        { id: 'settings', label: t('navSettings', 'Settings'), icon: Settings, action: () => onNavigate('settings') },
      ],
    },
    {
      category: 'AI Assistant',
      items: [
        {
          id: 'ask_ai',
          label: 'Ask AI Assistant (Shortcut: A)',
          icon: Sparkles,
          action: () => onNavigate('assistant'),
        },
      ],
    },
    {
      category: 'Quick Actions',
      items: [
        {
          id: 'new_customer',
          label: 'New Customer (Shortcut: N)',
          icon: PlusCircle,
          action: () => {
            onNavigate('customers');
            onOpenNewCustomer?.();
          },
        },
        {
          id: 'new_task',
          label: 'New Task (Shortcut: T)',
          icon: PlusCircle,
          action: () => {
            onNavigate('tasks');
            onOpenNewTask?.();
          },
        },
        {
          id: 'toggle_lang',
          label: 'Toggle Language (English / தமிழ்)',
          icon: Globe,
          action: () => toggleLanguage(),
        },
        {
          id: 'sign_out',
          label: `${t('signOut', 'Sign Out')} (${member?.email || ''})`,
          icon: LogOut,
          action: () => signOut(),
        },
      ],
    },
  ];

  const filteredCategories = items
    .map((cat) => ({
      ...cat,
      items: cat.items.filter((item) => item.label.toLowerCase().includes(query.toLowerCase())),
    }))
    .filter((cat) => cat.items.length > 0);

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-start justify-center pt-16 sm:pt-24 p-4 bg-stone-900/60 backdrop-blur-xs animate-in fade-in"
      onClick={onClose}
    >
      <div
        className="w-full max-w-xl rounded-2xl bg-white shadow-2xl border border-stone-200 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search Input Bar */}
        <div className="flex items-center gap-3 px-4 py-3.5 border-b border-stone-200">
          <Search className="w-5 h-5 text-stone-400 shrink-0" />
          <input
            autoFocus
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Type a command or search modules..."
            className="w-full text-sm text-stone-900 placeholder:text-stone-400 focus:outline-none"
          />
          <button onClick={onClose} className="p-1 text-stone-400 hover:text-stone-600 rounded-md">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Results list */}
        <div className="max-h-80 overflow-y-auto p-2 divide-y divide-stone-100">
          {filteredCategories.length === 0 ? (
            <div className="p-8 text-center text-xs text-stone-500">
              No matching commands or navigation links found.
            </div>
          ) : (
            filteredCategories.map((cat) => (
              <div key={cat.category} className="py-2">
                <div className="px-3 py-1 text-[11px] font-semibold text-stone-400 uppercase tracking-wider">
                  {cat.category}
                </div>
                <div className="space-y-0.5 mt-1">
                  {cat.items.map((item) => {
                    const Icon = item.icon;
                    return (
                      <button
                        key={item.id}
                        onClick={() => {
                          item.action();
                          onClose();
                        }}
                        className="w-full flex items-center justify-between px-3 py-2 text-xs font-medium text-stone-800 hover:text-stone-900 hover:bg-amber-50/70 rounded-lg transition-colors group text-left"
                      >
                        <div className="flex items-center gap-2.5">
                          <Icon className="w-4 h-4 text-stone-500 group-hover:text-amber-800 shrink-0" />
                          <span>{item.label}</span>
                        </div>
                        <span className="text-[10px] font-mono text-stone-400 opacity-0 group-hover:opacity-100">
                          Jump &rarr;
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer shortcuts tip */}
        <div className="px-4 py-2.5 bg-stone-50 border-t border-stone-100 flex items-center justify-between text-[11px] text-stone-500">
          <div className="flex items-center gap-3">
            <span><kbd className="px-1.5 py-0.5 bg-white border border-stone-200 rounded text-[10px] font-mono">ESC</kbd> to close</span>
            <span><kbd className="px-1.5 py-0.5 bg-white border border-stone-200 rounded text-[10px] font-mono">Ctrl/Cmd + K</kbd> to toggle</span>
          </div>
          <span className="font-medium text-stone-700">Jaikrishna Hub</span>
        </div>
      </div>
    </div>
  );
};
