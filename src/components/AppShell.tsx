/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import {
  LayoutDashboard,
  Users,
  CheckSquare,
  Calendar,
  ShoppingBag,
  Trash2,
  Settings,
  Sparkles,
  Menu,
  X,
  Search,
  Globe,
  Plus,
  LogOut,
  ChevronLeft,
  ChevronRight,
  User as UserIcon,
  ShieldCheck,
  Zap,
  Megaphone,
} from 'lucide-react';
import { ActiveModule } from '../types';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { useApp } from '../context/AppContext';
import { PWAInstallButton } from './PWAInstallButton';
import { CommandPalette } from './CommandPalette';
import { OfflineIndicator } from './OfflineIndicator';
import { FirestoreRulesNotice } from './FirestoreRulesNotice';
import { NotificationBell } from './layout/NotificationBell';

interface AppShellProps {
  currentModule: ActiveModule;
  onNavigate: (module: ActiveModule) => void;
  children: React.ReactNode;
  onOpenNewCustomer?: () => void;
  onOpenNewTask?: () => void;
}

export const AppShell: React.FC<AppShellProps> = ({
  currentModule,
  onNavigate,
  children,
  onOpenNewCustomer,
  onOpenNewTask,
}) => {
  const { member, signOut } = useAuth();
  const { language, toggleLanguage, t } = useLanguage();
  const { tasks, customers, metaAds, orders } = useApp();

  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);

  // Dynamic live badge counts based on real Firestore data
  const todayStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date());
  const overdueTasksCount = tasks.filter(
    (t) => !t.isDeleted && (t.status === 'Pending' || t.status === 'In progress') && t.date && t.date <= todayStr
  ).length;
  const followupsDueCount = customers.filter(
    (c) => !c.isDeleted && c.nextFollowUpDate && c.nextFollowUpDate <= todayStr
  ).length;
  const adsWaitingResultsCount = metaAds.filter(
    (a) => !a.isDeleted && a.stage === 'Waiting for result'
  ).length;
  const pendingDispatchCount = orders.filter(
    (o) => !o.isDeleted && (o.deliveryStatus === 'Pending' || o.deliveryStatus === 'Packed')
  ).length;
  const overduePaymentsCount = orders.filter(
    (o) => !o.isDeleted && (o.paymentStatus === 'Unpaid' || o.paymentStatus === 'Partial' || o.paymentStatus === 'Credit') && o.paymentDueDate && o.paymentDueDate <= todayStr
  ).length;

  // Global Keyboard Shortcuts (N = New Customer, T = New Task, A = AI Assistant, / = Search, Ctrl/Cmd+K = Palette)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger if user is typing inside an input/textarea/select
      const target = e.target as HTMLElement;
      const isInput =
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.tagName === 'SELECT' ||
        target.isContentEditable;

      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setCommandPaletteOpen((prev) => !prev);
        return;
      }

      if (isInput) return;

      const key = e.key.toLowerCase();
      if (e.key === '/') {
        e.preventDefault();
        setCommandPaletteOpen(true);
      } else if (key === 'a') {
        e.preventDefault();
        onNavigate('assistant');
      } else if (key === 'n') {
        e.preventDefault();
        onNavigate('customers');
        onOpenNewCustomer?.();
      } else if (key === 't') {
        e.preventDefault();
        onNavigate('tasks');
        onOpenNewTask?.();
      } else if (key === 'd') {
        e.preventDefault();
        onNavigate('dashboard');
      } else if (key === 'c') {
        e.preventDefault();
        onNavigate('customers');
      } else if (key === 'o') {
        e.preventDefault();
        onNavigate('orders');
      } else if (key === 'p') {
        e.preventDefault();
        onNavigate('planning');
      } else if (key === 'm') {
        e.preventDefault();
        onNavigate('meta_ads');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onNavigate, onOpenNewCustomer, onOpenNewTask]);

  const navItems = [
    { id: 'dashboard' as ActiveModule, label: t('navDashboard', 'Dashboard'), icon: LayoutDashboard },
    { id: 'customers' as ActiveModule, label: t('navCustomers', 'Customers'), icon: Users },
    { id: 'tasks' as ActiveModule, label: t('navTasks', 'Tasks'), icon: CheckSquare },
    { id: 'planning' as ActiveModule, label: t('navPlanning', 'Planning Hub'), icon: Calendar },
    { id: 'meta_ads' as ActiveModule, label: t('navMetaAds', 'Meta Ads'), icon: Megaphone },
    { id: 'orders' as ActiveModule, label: t('navOrders', 'Orders'), icon: ShoppingBag },
    { id: 'automations' as ActiveModule, label: t('navAutomations', 'Automation Rules'), icon: Zap },
    { id: 'trash' as ActiveModule, label: t('navTrash', 'Trash (30d)'), icon: Trash2 },
    { id: 'settings' as ActiveModule, label: t('navSettings', 'Settings'), icon: Settings },
  ];

  return (
    <div className="min-h-screen bg-[#FAF8F5] text-stone-900 flex flex-col selection:bg-amber-200">
      <OfflineIndicator />
      <FirestoreRulesNotice />

      <CommandPalette
        isOpen={commandPaletteOpen}
        onClose={() => setCommandPaletteOpen(false)}
        onNavigate={(mod) => {
          onNavigate(mod);
          setMobileMenuOpen(false);
        }}
        onOpenNewCustomer={onOpenNewCustomer}
        onOpenNewTask={onOpenNewTask}
      />

      <div className="flex flex-1 overflow-hidden">
        {/* ========================================================= */}
        {/* DESKTOP SIDEBAR */}
        {/* ========================================================= */}
        <aside
          className={`hidden md:flex flex-col bg-white border-r border-stone-200/80 transition-all duration-200 z-30 select-none ${
            sidebarCollapsed ? 'w-18' : 'w-64'
          }`}
        >
          {/* Brand Wordmark & Icon */}
          <div className="h-16 flex items-center justify-between px-4 border-b border-stone-100">
            <div className="flex items-center gap-3 overflow-hidden">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#881337] via-[#701A24] to-[#4C0519] flex items-center justify-center p-1.5 shadow-xs shrink-0">
                <img src="/icon.svg" alt="Jaikrishna" className="w-full h-full object-contain" />
              </div>
              {!sidebarCollapsed && (
                <div className="flex flex-col truncate">
                  <span className="text-sm font-bold tracking-tight text-stone-900 font-display truncate">
                    Jaikrishna
                  </span>
                  <span className="text-[10px] font-semibold text-amber-800 tracking-wider uppercase truncate">
                    Pooja Products
                  </span>
                </div>
              )}
            </div>

            <button
              onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
              className="p-1 text-stone-400 hover:text-stone-700 hover:bg-stone-50 rounded-lg transition-colors"
              title={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            >
              {sidebarCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
            </button>
          </div>

          {/* AI Assistant Special Card */}
          <div className="p-3">
            <button
              onClick={() => onNavigate('assistant')}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all ${
                currentModule === 'assistant'
                  ? 'bg-gradient-to-r from-amber-600 to-amber-700 text-white font-semibold shadow-xs'
                  : 'bg-amber-50/70 hover:bg-amber-100/70 text-amber-900 border border-amber-200/60 font-medium'
              }`}
            >
              <Sparkles className="w-4 h-4 text-amber-700 shrink-0" />
              {!sidebarCollapsed && (
                <div className="flex items-center justify-between flex-1 text-xs">
                  <span>{t('navAssistant', 'AI Assistant')}</span>
                  <kbd className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-white/80 text-amber-900 border border-amber-200/80 shadow-2xs font-semibold">
                    A
                  </kbd>
                </div>
              )}
            </button>
          </div>

          {/* Primary Navigation Links */}
          <nav className="flex-1 px-3 space-y-1 overflow-y-auto">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = currentModule === item.id;
              let badgeCount = 0;
              let badgeColor = 'bg-stone-200 text-stone-700';

              if (item.id === 'tasks' && overdueTasksCount > 0) {
                badgeCount = overdueTasksCount;
                badgeColor = 'bg-rose-600 text-white';
              } else if (item.id === 'customers' && followupsDueCount > 0) {
                badgeCount = followupsDueCount;
                badgeColor = 'bg-amber-600 text-white';
              } else if (item.id === 'orders' && pendingDispatchCount > 0) {
                badgeCount = pendingDispatchCount;
                badgeColor = 'bg-rose-600 text-white';
              } else if (item.id === 'meta_ads' && adsWaitingResultsCount > 0) {
                badgeCount = adsWaitingResultsCount;
                badgeColor = 'bg-amber-600 text-white';
              }

              return (
                <button
                  key={item.id}
                  onClick={() => onNavigate(item.id)}
                  title={sidebarCollapsed ? item.label : undefined}
                  className={`w-full flex items-center justify-between px-3 py-2 text-xs font-medium rounded-lg transition-colors text-left ${
                    isActive
                      ? 'bg-stone-900 text-white font-semibold shadow-xs'
                      : 'text-stone-600 hover:text-stone-900 hover:bg-stone-100/80'
                  }`}
                >
                  <div className="flex items-center gap-3 truncate">
                    <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-amber-400' : 'text-stone-500'}`} />
                    {!sidebarCollapsed && <span className="truncate">{item.label}</span>}
                  </div>
                  {!sidebarCollapsed && badgeCount > 0 && (
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${badgeColor}`}>
                      {badgeCount}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>

          {/* PWA Install & Member Profile Card */}
          <div className="p-3 border-t border-stone-100 space-y-2">
            {!sidebarCollapsed && <PWAInstallButton variant="sidebar" />}

            {/* Member Profile pill */}
            <div
              className={`flex items-center ${
                sidebarCollapsed ? 'justify-center' : 'justify-between'
              } p-2 rounded-lg bg-stone-50 border border-stone-200/60`}
            >
              <div className="flex items-center gap-2 overflow-hidden">
                <div className="w-7 h-7 rounded-full bg-amber-100 text-amber-900 flex items-center justify-center font-bold text-xs shrink-0">
                  {member?.name ? member.name.charAt(0).toUpperCase() : <UserIcon className="w-3.5 h-3.5" />}
                </div>
                {!sidebarCollapsed && (
                  <div className="flex flex-col truncate">
                    <span className="text-xs font-semibold text-stone-900 truncate">
                      {member?.name || 'Authorized Member'}
                    </span>
                    <span className="text-[10px] text-amber-800 font-medium flex items-center gap-1">
                      <ShieldCheck className="w-3 h-3 text-amber-700" />
                      {member?.label || 'Admin'}
                    </span>
                  </div>
                )}
              </div>

              {!sidebarCollapsed && (
                <button
                  onClick={() => signOut()}
                  title={t('signOut', 'Sign Out')}
                  className="p-1 text-stone-400 hover:text-stone-700 rounded-md transition-colors"
                >
                  <LogOut className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>
        </aside>

        {/* ========================================================= */}
        {/* MAIN VIEWPORT */}
        {/* ========================================================= */}
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
          {/* Desktop & Mobile Header (Top Bar Contract: 3 Zones) */}
          <header className="h-16 bg-white border-b border-stone-200/80 px-4 sm:px-6 flex items-center justify-between gap-4 z-20 shrink-0">
            {/* Zone 1: Mobile Hamburger & Context Breadcrumb */}
            <div className="flex items-center gap-3">
              <button
                onClick={() => setMobileMenuOpen(true)}
                className="md:hidden p-2 -ml-2 text-stone-600 hover:text-stone-900 rounded-lg"
              >
                <Menu className="w-5 h-5" />
              </button>

              <div className="flex items-center gap-2 text-xs font-medium text-stone-500">
                <span className="hidden sm:inline font-display font-semibold text-stone-900">
                  Jaikrishna Industries
                </span>
                <span className="hidden sm:inline text-stone-300">/</span>
                <span className="text-stone-900 font-semibold capitalize">
                  {currentModule === 'assistant' ? 'AI Assistant' : currentModule}
                </span>
              </div>
            </div>

            {/* Zone 2: Search Trigger */}
            <div className="flex-1 max-w-md mx-2 hidden sm:block">
              <button
                onClick={() => setCommandPaletteOpen(true)}
                className="w-full flex items-center justify-between px-3 py-1.5 text-xs text-stone-400 bg-stone-50 hover:bg-stone-100 border border-stone-200 rounded-lg transition-colors"
              >
                <div className="flex items-center gap-2">
                  <Search className="w-3.5 h-3.5 text-stone-400" />
                  <span className="truncate">{t('searchPlaceholder', 'Search by name, shop, or phone (/)...')}</span>
                </div>
                <kbd className="hidden md:inline-block px-1.5 py-0.5 text-[10px] font-mono bg-white border border-stone-200 rounded text-stone-500 shadow-2xs">
                  /
                </kbd>
              </button>
            </div>

            {/* Zone 3: Quick Action CTAs & Language Switcher */}
            <div className="flex items-center gap-2 sm:gap-3 shrink-0">
              {/* Notification Bell Dropdown */}
              <NotificationBell onNavigate={onNavigate} />

              {/* Language Switcher */}
              <button
                onClick={toggleLanguage}
                title="Toggle Language: English / தமிழ்"
                className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-stone-700 hover:bg-stone-100 border border-stone-200 rounded-lg transition-colors"
              >
                <Globe className="w-3.5 h-3.5 text-amber-700" />
                <span className="font-mono text-[11px]">{language.toUpperCase()}</span>
              </button>

              {/* Quick Customer CTA (Shortcut: N) */}
              <button
                onClick={() => {
                  onNavigate('customers');
                  onOpenNewCustomer?.();
                }}
                className="hidden lg:flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-white bg-[#881337] hover:bg-[#701A24] rounded-lg shadow-xs transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>{t('newCustomer', 'New Customer')}</span>
                <kbd className="ml-1 text-[10px] font-mono opacity-70">N</kbd>
              </button>

              {/* Quick Task CTA (Shortcut: T) */}
              <button
                onClick={() => {
                  onNavigate('tasks');
                  onOpenNewTask?.();
                }}
                className="hidden lg:flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-stone-800 bg-amber-100/80 hover:bg-amber-200/80 border border-amber-300/80 rounded-lg shadow-xs transition-colors"
              >
                <Plus className="w-3.5 h-3.5 text-amber-800" />
                <span>{t('newTask', 'New Task')}</span>
                <kbd className="ml-1 text-[10px] font-mono opacity-70">T</kbd>
              </button>

              {/* Mobile Search Icon Button */}
              <button
                onClick={() => setCommandPaletteOpen(true)}
                className="sm:hidden p-2 text-stone-600 hover:text-stone-900 rounded-lg"
              >
                <Search className="w-4 h-4" />
              </button>
            </div>
          </header>

          {/* Main Content Area */}
          <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 pb-20 md:pb-8">
            <div className="max-w-7xl mx-auto">{children}</div>
          </main>
        </div>
      </div>

      {/* ========================================================= */}
      {/* MOBILE BOTTOM NAVIGATION BAR */}
      {/* ========================================================= */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 h-16 bg-white/95 backdrop-blur-md border-t border-stone-200 flex items-center justify-around px-2 z-40 shadow-lg">
        <button
          onClick={() => onNavigate('dashboard')}
          className={`flex flex-col items-center justify-center w-14 h-full gap-1 text-[10px] font-medium ${
            currentModule === 'dashboard' ? 'text-amber-800 font-bold' : 'text-stone-500 hover:text-stone-900'
          }`}
        >
          <LayoutDashboard className="w-4 h-4" />
          <span>{t('navDashboard', 'Home')}</span>
        </button>

        <button
          onClick={() => onNavigate('customers')}
          className={`flex flex-col items-center justify-center w-14 h-full gap-1 text-[10px] font-medium ${
            currentModule === 'customers' ? 'text-amber-800 font-bold' : 'text-stone-500 hover:text-stone-900'
          }`}
        >
          <Users className="w-4 h-4" />
          <span>{t('navCustomers', 'Leads')}</span>
        </button>

        <button
          onClick={() => onNavigate('tasks')}
          className={`relative flex flex-col items-center justify-center w-14 h-full gap-1 text-[10px] font-medium ${
            currentModule === 'tasks' ? 'text-amber-800 font-bold' : 'text-stone-500 hover:text-stone-900'
          }`}
        >
          <div className="relative">
            <CheckSquare className="w-4 h-4" />
            {overdueTasksCount > 0 && (
              <span className="absolute -top-1 -right-2 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-rose-600 text-[8px] font-bold text-white">
                {overdueTasksCount > 9 ? '9+' : overdueTasksCount}
              </span>
            )}
          </div>
          <span>{t('navTasks', 'Tasks')}</span>
        </button>

        <button
          onClick={() => onNavigate('planning')}
          className={`flex flex-col items-center justify-center w-14 h-full gap-1 text-[10px] font-medium ${
            currentModule === 'planning' ? 'text-amber-800 font-bold' : 'text-stone-500 hover:text-stone-900'
          }`}
        >
          <Calendar className="w-4 h-4" />
          <span>{t('navPlanning', 'Plan')}</span>
        </button>

        <button
          onClick={() => onNavigate('assistant')}
          className={`flex flex-col items-center justify-center w-14 h-full gap-1 text-[10px] font-medium ${
            currentModule === 'assistant' ? 'text-amber-800 font-bold' : 'text-amber-700'
          }`}
        >
          <Sparkles className="w-4 h-4" />
          <span>AI</span>
        </button>
      </nav>

      {/* ========================================================= */}
      {/* MOBILE DRAWER MENU */}
      {/* ========================================================= */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 flex md:hidden">
          <div className="fixed inset-0 bg-black/50" onClick={() => setMobileMenuOpen(false)} />
          <div className="relative flex-1 flex flex-col max-w-xs w-full bg-white">
            <div className="flex items-center justify-between p-4 border-b border-stone-100">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-[#881337] flex items-center justify-center p-1.5">
                  <img src="/icon.svg" alt="Jaikrishna" className="w-full h-full object-contain" />
                </div>
                <span className="font-bold text-stone-900 font-display">Jaikrishna Hub</span>
              </div>
              <button onClick={() => setMobileMenuOpen(false)} className="p-1 text-stone-400">
                <X className="w-5 h-5" />
              </button>
            </div>

            <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = currentModule === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => {
                      onNavigate(item.id);
                      setMobileMenuOpen(false);
                    }}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 text-xs font-medium rounded-lg text-left ${
                      isActive ? 'bg-stone-900 text-white font-semibold' : 'text-stone-600 hover:bg-stone-50'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </nav>

            <div className="p-4 border-t border-stone-100 space-y-3">
              <PWAInstallButton variant="sidebar" />
              <button
                onClick={() => {
                  signOut();
                  setMobileMenuOpen(false);
                }}
                className="w-full flex items-center justify-center gap-2 px-3 py-2 text-xs font-semibold text-rose-800 bg-rose-50 hover:bg-rose-100 rounded-lg"
              >
                <LogOut className="w-4 h-4" />
                <span>{t('signOut', 'Sign Out')}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
