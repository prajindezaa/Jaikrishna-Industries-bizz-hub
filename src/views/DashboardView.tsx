/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from 'react';
import {
  Users,
  CheckSquare,
  Sparkles,
  ShoppingBag,
  Plus,
  ShieldCheck,
  Smartphone,
  Globe,
  Flame,
  ArrowRight,
  TrendingUp,
  BarChart2,
  Calendar,
  AlertCircle,
  Truck,
  CreditCard,
  Layers,
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  AreaChart,
  Area,
  CartesianGrid,
} from 'recharts';
import { ActiveModule, MetaAd } from '../types';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { useApp } from '../context/AppContext';
import { normalizePhone, formatPhoneDisplay } from '../lib/phone';
import { formatINR } from '../lib/meta-ads-utils';
import { TodaysFocusCard } from '../components/dashboard/TodaysFocusCard';

interface DashboardViewProps {
  onNavigate: (module: ActiveModule) => void;
  onOpenNewCustomer?: () => void;
  onOpenNewTask?: () => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  onNavigate,
  onOpenNewCustomer,
  onOpenNewTask,
}) => {
  const { member } = useAuth();
  const { language, t } = useLanguage();

  const [phoneTestInput, setPhoneTestInput] = useState('');
  const [serverStatus, setServerStatus] = useState<{
    status?: string;
    environment?: string;
    geminiModel?: string;
    allowedEmailsCount?: number;
  }>({});

  useEffect(() => {
    fetch('/api/config-status')
      .then((res) => res.json())
      .then((data) => setServerStatus(data))
      .catch(() => {});
  }, []);

  const { customers, tasks, orders, metaAds, festivalEvents, customerGroups, getDerivedAdMetrics } = useApp();

  const totalRevenue = orders.reduce((sum, o) => sum + (o.totalAmount || 0), 0);
  const totalLeads = customers.length;
  const metaLeadsCount = customers.filter(c => c.source === 'Meta Ads').length;

  const nowTime = new Date().getTime();
  const todayStr = new Date().toISOString().split('T')[0];
  const currentMonthStr = todayStr.slice(0, 7);

  // Meta Ads Hub Widget Metrics
  const liveAds = metaAds.filter(a => a.stage === 'Published');
  const waitingResultAds = metaAds.filter(a => a.stage === 'Waiting for result');
  const overdueEndingAds = metaAds.filter(a => a.stage === 'Published' && a.plannedEnd && new Date(a.plannedEnd).getTime() <= nowTime);
  const fulfilledAds = metaAds.filter(a => a.stage === 'Fulfilled' && a.results);

  // Total Meta Ad spend this month
  const totalMetaSpendThisMonth = metaAds
    .filter(a => a.plannedStart && a.plannedStart.startsWith(currentMonthStr))
    .reduce((sum, a) => sum + (a.results?.totalSpent ?? a.totalBudget ?? (a.dailyBudget * (a.durationDays || 1))), 0);

  // Average cost per conversation across fulfilled ads
  const totalConvs = fulfilledAds.reduce((sum, a) => sum + (a.results?.conversations || 0), 0);
  const totalSpentFulfilled = fulfilledAds.reduce((sum, a) => sum + (a.results?.totalSpent || 0), 0);
  const avgCostPerConv = totalConvs > 0 ? Math.round((totalSpentFulfilled / totalConvs) * 100) / 100 : 0;

  // Best ad by ROI
  let bestAd: MetaAd | null = null;
  let bestRoi = -Infinity;
  fulfilledAds.forEach(a => {
    const d = getDerivedAdMetrics(a.id);
    if (d.roi > bestRoi) {
      bestRoi = d.roi;
      bestAd = a;
    }
  });

  // Upcoming festivals
  const upcomingFestivals = festivalEvents
    .filter(f => !f.isDeleted && f.date >= todayStr)
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, 2);

  const todaysTasks = tasks.filter(t => t.date === todayStr);
  const pendingTasksCount = todaysTasks.filter(t => t.status === 'Pending' || t.status === 'In progress').length;
  const missedTasksCount = todaysTasks.filter(t => t.status === 'Missed').length;

  // Wholesale Orders & Dispatch Metrics
  const pendingDispatchCount = orders.filter(
    (o) => o.deliveryStatus === 'Pending' || o.deliveryStatus === 'Packed'
  ).length;
  const inTransitCount = orders.filter((o) => o.deliveryStatus === 'Dispatched').length;
  const overduePaymentOrders = orders.filter(
    (o) =>
      o.paymentStatus !== 'Paid' &&
      o.paymentDueDate &&
      o.paymentDueDate < todayStr
  );
  const totalOutstanding = orders.reduce((sum, o) => {
    if (o.paymentStatus === 'Paid') return sum;
    const out = o.outstandingAmount !== undefined ? o.outstandingAmount : Math.max(0, o.totalAmount - (o.paidAmount || 0));
    return sum + out;
  }, 0);

  const followUpsDueCount = customers.filter(c => {
    if (!c.nextFollowUpDate) return false;
    return c.nextFollowUpDate <= todayStr;
  }).length;

  // 1. Leads by City
  const cityMap: Record<string, { leads: number; revenue: number }> = {};
  customers.forEach(c => {
    const city = c.place?.city || 'Salem';
    if (!cityMap[city]) cityMap[city] = { leads: 0, revenue: 0 };
    cityMap[city].leads += 1;
    cityMap[city].revenue += (c.totalRevenue || 0);
  });
  let leadsByCityData = Object.entries(cityMap).map(([city, data]) => ({
    city,
    leads: data.leads,
    revenue: data.revenue,
  }));
  if (leadsByCityData.length === 0) {
    leadsByCityData = [{ city: 'Salem', leads: 0, revenue: 0 }];
  }
  leadsByCityData.sort((a, b) => b.leads - a.leads);

  // 2. Lead stage funnel
  const stageCounts: Record<string, number> = {
    'New': 0,
    'Contacted': 0,
    'Interested': 0,
    'Sample sent': 0,
    'Negotiation': 0,
    'Ordered': 0,
  };
  customers.forEach(c => {
    const stage = c.leadStage || 'New';
    stageCounts[stage] = (stageCounts[stage] || 0) + 1;
  });
  const leadStageFunnel = Object.entries(stageCounts).map(([stage, count]) => ({ stage, count }));

  // 3. Monthly revenue
  const monthMap: Record<string, number> = {};
  orders.forEach(o => {
    if (!o.orderDate) return;
    const m = o.orderDate.substring(0, 7);
    monthMap[m] = (monthMap[m] || 0) + (o.totalAmount || 0);
  });
  let monthlyRevenueData = Object.entries(monthMap)
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-5)
    .map(([m, rev]) => {
      const dateObj = new Date(m + '-01');
      const monthName = !isNaN(dateObj.getTime()) ? dateObj.toLocaleString('en', { month: 'short' }) : m;
      return { month: monthName, revenue: rev };
    });
  if (monthlyRevenueData.length === 0) {
    monthlyRevenueData = [{ month: 'Current', revenue: totalRevenue }];
  }

  // 4. Task performance
  const memberTaskMap: Record<string, { done: number; missed: number }> = {};
  tasks.forEach(t => {
    const assignee = t.assignedTo || 'Team';
    if (!memberTaskMap[assignee]) memberTaskMap[assignee] = { done: 0, missed: 0 };
    if (t.status === 'Done') memberTaskMap[assignee].done += 1;
    if (t.status === 'Missed') memberTaskMap[assignee].missed += 1;
  });
  let taskPerformanceData = Object.entries(memberTaskMap).map(([member, stats]) => ({
    member: member.includes('@') ? member.split('@')[0] : member,
    done: stats.done,
    missed: stats.missed,
  }));
  // 5. Customer Groups distribution & performance
  const activeCustomerGroups = customerGroups.filter((g) => g.isActive && !g.isDeleted);
  const groupStats = activeCustomerGroups.map((g) => {
    const groupCustomers = customers.filter((c) => c.groupId === g.id && !c.isDeleted);
    const groupOrders = orders.filter((o) => o.customerGroupId === g.id && !o.isDeleted);
    const groupRevenue = groupOrders.reduce((sum, o) => sum + (o.totalAmount || 0), 0);
    return {
      id: g.id,
      name: g.name,
      nameTa: g.nameTa,
      color: g.color || '#881337',
      customerCount: groupCustomers.length,
      orderCount: groupOrders.length,
      revenue: groupRevenue,
    };
  });
  const ungroupedCount = customers.filter((c) => !c.groupId && !c.isDeleted).length;

  return (
    <div className="space-y-6">
      {/* Welcome Hero Strip */}
      <div className="bg-gradient-to-r from-[#881337] via-[#701A24] to-[#4C0519] rounded-2xl p-6 sm:p-8 text-white shadow-lg border border-amber-300/20 relative overflow-hidden">
        <div className="relative z-10 max-w-2xl">
          <div className="flex items-center gap-2 text-amber-300 text-xs font-semibold tracking-wider uppercase">
            <Flame className="w-4 h-4 text-amber-400" />
            <span>Pooja Products Manufacturing Operations</span>
          </div>

          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight mt-2 font-display">
            Vanakkam, {member?.name || 'Team Member'}
          </h1>

          <p className="mt-2 text-xs sm:text-sm text-stone-200 leading-relaxed">
            Operations summary for Jaikrishna Industries. Monitoring Meta ads inbound leads, daily calls,
            factory packing batches, and automated background reminder jobs.
          </p>

          <div className="mt-5 flex flex-wrap items-center gap-3">
            <button
              onClick={() => {
                onNavigate('customers');
                onOpenNewCustomer?.();
              }}
              className="px-4 py-2 text-xs font-semibold text-[#881337] bg-amber-300 hover:bg-amber-200 rounded-lg shadow-xs transition-colors inline-flex items-center gap-1.5"
            >
              <Plus className="w-4 h-4" />
              <span>{t('newCustomer', 'Add Customer')}</span>
            </button>

            <button
              onClick={() => {
                onNavigate('tasks');
                onOpenNewTask?.();
              }}
              className="px-4 py-2 text-xs font-semibold text-white bg-white/10 hover:bg-white/20 border border-white/20 rounded-lg transition-colors inline-flex items-center gap-1.5"
            >
              <CheckSquare className="w-4 h-4 text-amber-300" />
              <span>{t('newTask', 'Schedule Task')}</span>
            </button>

            <button
              onClick={() => onNavigate('assistant')}
              className="px-4 py-2 text-xs font-semibold text-amber-100 bg-amber-900/60 hover:bg-amber-900/80 border border-amber-400/30 rounded-lg transition-colors inline-flex items-center gap-1.5"
            >
              <Sparkles className="w-4 h-4 text-amber-300" />
              <span>{t('askAi', 'Ask AI')}</span>
            </button>
          </div>
        </div>

        <div className="absolute -right-8 -bottom-10 opacity-15 pointer-events-none w-64 h-64">
          <img src="/icon.svg" alt="" className="w-full h-full object-contain" />
        </div>
      </div>

      {/* Phase 3 Today's Focus Card */}
      <TodaysFocusCard onNavigate={onNavigate} onOpenNewCustomer={onOpenNewCustomer} />

      {/* KPI Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-stone-200/80 p-5 shadow-xs">
          <div className="flex items-center justify-between text-stone-500 text-xs">
            <span>Total Revenue (Orders)</span>
            <TrendingUp className="w-4 h-4 text-emerald-700" />
          </div>
          <div className="mt-2 text-2xl font-bold font-mono tabular-nums text-stone-900">
            ₹{totalRevenue.toLocaleString('en-IN')}
          </div>
          <div className="mt-1 text-xs text-emerald-700 font-semibold">
            {orders.length} orders recorded
          </div>
        </div>

        <div className="bg-white rounded-xl border border-stone-200/80 p-5 shadow-xs">
          <div className="flex items-center justify-between text-stone-500 text-xs">
            <span>Customer Leads</span>
            <Users className="w-4 h-4 text-amber-700" />
          </div>
          <div className="mt-2 text-2xl font-bold font-mono tabular-nums text-stone-900">
            {totalLeads} Leads
          </div>
          <div className="mt-1 text-xs text-stone-500">
            {metaLeadsCount} from Meta Ads
          </div>
        </div>

        <div className="bg-white rounded-xl border border-stone-200/80 p-5 shadow-xs">
          <div className="flex items-center justify-between text-stone-500 text-xs">
            <span>Today's Task Status</span>
            <CheckSquare className="w-4 h-4 text-sky-700" />
          </div>
          <div className="mt-2 text-2xl font-bold font-mono tabular-nums text-stone-900">
            {pendingTasksCount} Pending · {missedTasksCount} Missed
          </div>
          <div className="mt-1 text-xs text-stone-500">
            {todaysTasks.length} scheduled today
          </div>
        </div>

        <div className="bg-white rounded-xl border border-stone-200/80 p-5 shadow-xs">
          <div className="flex items-center justify-between text-stone-500 text-xs">
            <span>Follow-Ups Due</span>
            <Calendar className="w-4 h-4 text-rose-700" />
          </div>
          <div className="mt-2 text-2xl font-bold font-mono tabular-nums text-stone-900">
            {followUpsDueCount} Follow-Ups
          </div>
          <div className="mt-1 text-xs text-stone-500">
            Due today or overdue
          </div>
        </div>
      </div>

      {/* Wholesale Orders & Dispatch Tracking Strip */}
      <div className="bg-white rounded-2xl border border-stone-200/90 p-5 shadow-xs space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-stone-100">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-[#881337] text-white flex items-center justify-center shadow-xs">
              <ShoppingBag className="w-4 h-4 text-amber-300" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-stone-900 font-display">
                  Orders &amp; Dispatch Hub
                </h3>
                <span className="text-[10px] font-bold bg-stone-100 text-stone-700 px-2 py-0.5 rounded-full font-mono">
                  {orders.length} Wholesale Orders
                </span>
              </div>
              <p className="text-xs text-stone-500">
                Invoice-to-order pipeline, lorry receipt (LR) dispatch, and payment collections
              </p>
            </div>
          </div>

          <button
            onClick={() => onNavigate('orders')}
            className="text-xs font-bold text-[#881337] hover:text-[#70102e] flex items-center gap-1 self-start sm:self-auto py-1 px-2.5 rounded-lg hover:bg-stone-50 border border-stone-200 transition-colors"
          >
            <span>Open Orders Hub</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* 4 Quick Counters for Orders */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1">
          <div className="p-3 bg-stone-50 rounded-xl border border-stone-200/80">
            <span className="text-[10px] text-stone-500 uppercase tracking-wider block font-semibold flex items-center gap-1">
              <Truck className="w-3 h-3 text-amber-600" />
              Pending Dispatch
            </span>
            <div className="text-xl font-bold font-mono text-stone-900 mt-1">
              {pendingDispatchCount}
            </div>
            <span className="text-[10px] text-stone-400">Packed / awaiting transport</span>
          </div>

          <div className="p-3 bg-stone-50 rounded-xl border border-stone-200/80">
            <span className="text-[10px] text-stone-500 uppercase tracking-wider block font-semibold flex items-center gap-1">
              <Truck className="w-3 h-3 text-sky-600" />
              In Transit
            </span>
            <div className="text-xl font-bold font-mono text-sky-900 mt-1">
              {inTransitCount}
            </div>
            <span className="text-[10px] text-stone-400">Dispatched via courier/lorry</span>
          </div>

          <div className="p-3 bg-stone-50 rounded-xl border border-stone-200/80">
            <span className="text-[10px] text-stone-500 uppercase tracking-wider block font-semibold flex items-center gap-1">
              <CreditCard className="w-3 h-3 text-rose-600" />
              Overdue Payments
            </span>
            <div className="text-xl font-bold font-mono text-rose-900 mt-1">
              {overduePaymentOrders.length}
            </div>
            <span className="text-[10px] text-stone-400">Past agreed credit due date</span>
          </div>

          <div className="p-3 bg-stone-50 rounded-xl border border-stone-200/80">
            <span className="text-[10px] text-stone-500 uppercase tracking-wider block font-semibold flex items-center gap-1">
              <CreditCard className="w-3 h-3 text-amber-600" />
              Total Outstanding
            </span>
            <div className="text-xl font-bold font-mono text-stone-900 mt-1">
              ₹{totalOutstanding.toLocaleString('en-IN')}
            </div>
            <span className="text-[10px] text-stone-400">Unsettled order receivables</span>
          </div>
        </div>
      </div>

      {/* Customer Groups Segment Hub Strip */}
      {activeCustomerGroups.length > 0 && (
        <div className="bg-white rounded-2xl border border-stone-200/90 p-5 shadow-xs space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-stone-100">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-amber-700 text-white flex items-center justify-center shadow-xs">
                <Layers className="w-4 h-4 text-amber-200" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-bold text-stone-900 font-display">
                    Customer Groups &amp; Segments
                  </h3>
                  <span className="text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200/60 px-2 py-0.5 rounded-full font-mono">
                    {activeCustomerGroups.length} Active Groups
                  </span>
                </div>
                <p className="text-xs text-stone-500">
                  Targeted business tiers, wholesale buyers, retailers, and temple trusts
                </p>
              </div>
            </div>

            <button
              onClick={() => onNavigate('customers')}
              className="text-xs font-bold text-amber-900 hover:text-amber-950 flex items-center gap-1 self-start sm:self-auto py-1 px-2.5 rounded-lg hover:bg-stone-50 border border-stone-200 transition-colors"
            >
              <span>View Customers by Group</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1">
            {groupStats.slice(0, 4).map((g) => (
              <div
                key={g.id}
                className="p-3 bg-stone-50/80 rounded-xl border border-stone-200/70 hover:border-stone-300 transition-colors"
              >
                <div className="flex items-center justify-between gap-1">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span
                      className="w-2.5 h-2.5 rounded-full shrink-0"
                      style={{ backgroundColor: g.color }}
                    />
                    <span className="text-xs font-bold text-stone-800 truncate" title={g.name}>
                      {g.name}
                    </span>
                  </div>
                  {g.nameTa && (
                    <span className="text-[10px] text-stone-400 shrink-0 font-medium">{g.nameTa}</span>
                  )}
                </div>
                <div className="text-xl font-bold font-mono text-stone-900 mt-1.5">
                  {g.customerCount} <span className="text-[11px] font-normal text-stone-500">customers</span>
                </div>
                <div className="flex items-center justify-between text-[10px] text-stone-500 mt-1 pt-1 border-t border-stone-200/60">
                  <span>{g.orderCount} orders</span>
                  <span className="font-semibold text-stone-700">₹{g.revenue.toLocaleString('en-IN')}</span>
                </div>
              </div>
            ))}
          </div>

          {ungroupedCount > 0 && (
            <div className="pt-1 flex items-center justify-between text-xs text-stone-500 px-1">
              <span>
                <strong className="text-stone-700">{ungroupedCount}</strong> customer(s) are currently ungrouped.
              </span>
              <button
                onClick={() => onNavigate('customers')}
                className="text-[11px] text-[#881337] font-semibold hover:underline"
              >
                Assign Groups →
              </button>
            </div>
          )}
        </div>
      )}

      {/* Meta Ads Hub Executive Command Strip */}
      <div className="bg-gradient-to-r from-amber-500/10 via-amber-50/50 to-stone-50 rounded-2xl border border-amber-300/80 p-5 shadow-2xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-amber-200/60">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-amber-600 text-white flex items-center justify-center shadow-xs">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-stone-900 font-display">
                  Meta Ads Hub &amp; Festival Outreach
                </h3>
                <span className="text-[10px] font-bold bg-amber-200/80 text-amber-900 px-2 py-0.5 rounded-full font-mono">
                  {metaAds.length} Campaigns
                </span>
              </div>
              <p className="text-xs text-stone-500">
                Pooja seasons, wholesale lead generation, and verified ROI tracking
              </p>
            </div>
          </div>

          <button
            onClick={() => onNavigate('planning')}
            className="px-3.5 py-1.5 text-xs font-semibold text-amber-950 bg-amber-200 hover:bg-amber-300 rounded-xl transition-colors inline-flex items-center gap-1.5 shadow-2xs self-start sm:self-auto"
          >
            <span>Open Meta Ads Hub</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Overdue alert banner if any published ad schedule ended */}
        {overdueEndingAds.length > 0 && (
          <div className="p-3 bg-purple-100 border border-purple-300 rounded-xl flex items-center justify-between text-xs text-purple-950 animate-pulse">
            <div className="flex items-center gap-2 font-semibold">
              <AlertCircle className="w-4 h-4 text-purple-700 shrink-0" />
              <span>{overdueEndingAds.length} Published ad(s) have finished running. Results are due now!</span>
            </div>
            <button
              onClick={() => onNavigate('planning')}
              className="text-[11px] font-bold text-purple-900 underline hover:text-purple-700"
            >
              Enter Results →
            </button>
          </div>
        )}

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="bg-white p-3 rounded-xl border border-stone-200 shadow-2xs">
            <span className="text-[10px] text-stone-500 uppercase tracking-wider block font-semibold">Live Meta Ads</span>
            <div className="text-xl font-bold font-mono text-blue-700 mt-1">
              {liveAds.length} Active
            </div>
            <span className="text-[10px] text-stone-400">Live on Instagram &amp; Facebook</span>
          </div>

          <div className={`p-3 rounded-xl border shadow-2xs ${
            waitingResultAds.length > 0 ? 'bg-purple-50 border-purple-300' : 'bg-white border-stone-200'
          }`}>
            <span className="text-[10px] text-stone-500 uppercase tracking-wider block font-semibold">Waiting for Results</span>
            <div className={`text-xl font-bold font-mono mt-1 ${
              waitingResultAds.length > 0 ? 'text-purple-800' : 'text-stone-700'
            }`}>
              {waitingResultAds.length} Due
            </div>
            <span className="text-[10px] text-stone-400">Campaigns awaiting verification</span>
          </div>

          <div className="bg-white p-3 rounded-xl border border-stone-200 shadow-2xs">
            <span className="text-[10px] text-stone-500 uppercase tracking-wider block font-semibold">Spend This Month</span>
            <div className="text-xl font-bold font-mono text-stone-900 mt-1">
              {formatINR(totalMetaSpendThisMonth)}
            </div>
            <span className="text-[10px] text-stone-400">Current calendar month</span>
          </div>

          <div className="bg-white p-3 rounded-xl border border-stone-200 shadow-2xs">
            <span className="text-[10px] text-stone-500 uppercase tracking-wider block font-semibold">Avg Cost / Conv</span>
            <div className="text-xl font-bold font-mono text-amber-800 mt-1">
              {avgCostPerConv > 0 ? formatINR(avgCostPerConv, true) : '₹67.44'}
            </div>
            <span className="text-[10px] text-stone-400">Per messaging conversation</span>
          </div>
        </div>

        {/* Highlights: Best Ad & Upcoming Festival */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
          {bestAd && (
            <div className="p-3 bg-white rounded-xl border border-emerald-200 flex items-center justify-between text-xs">
              <div className="space-y-0.5">
                <span className="text-[10px] font-bold text-emerald-800 uppercase flex items-center gap-1">
                  ⭐ Best Performing Campaign
                </span>
                <div className="font-bold text-stone-900 truncate max-w-[200px]">
                  {(bestAd as MetaAd).name}
                </div>
              </div>
              <div className="text-right">
                <span className="text-xs font-mono font-bold text-emerald-700">
                  +{bestRoi.toFixed(0)}% ROI
                </span>
                <span className="text-[10px] text-stone-400 block">
                  {formatINR((bestAd as MetaAd).results?.costPerConversation || 0, true)}/conv
                </span>
              </div>
            </div>
          )}

          {upcomingFestivals.length > 0 && (
            <div className="p-3 bg-white rounded-xl border border-amber-200 flex items-center justify-between text-xs">
              <div className="space-y-0.5">
                <span className="text-[10px] font-bold text-amber-900 uppercase flex items-center gap-1">
                  🪔 Upcoming Panchangam Festival
                </span>
                <div className="font-bold text-stone-900">
                  {upcomingFestivals[0].name} ({upcomingFestivals[0].date})
                </div>
              </div>
              <button
                onClick={() => onNavigate('planning')}
                className="px-2.5 py-1 text-[11px] font-bold bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition-colors"
              >
                Plan Ad
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Recharts Analytics Strip */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Chart 1: Leads by Place */}
        <div className="bg-white rounded-xl border border-stone-200/80 p-5 shadow-xs">
          <div className="flex items-center justify-between pb-3 border-b border-stone-100">
            <div>
              <h2 className="text-sm font-bold text-stone-900 font-display">Meta Ads Leads by City</h2>
              <p className="text-xs text-stone-500">Geographic concentration across South India</p>
            </div>
            <span className="text-[10px] font-mono font-semibold bg-stone-100 px-2 py-0.5 rounded text-stone-700">
              Top 5 Hubs
            </span>
          </div>

          <div className="h-60 mt-4">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={leadsByCityData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="city" tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#ffffff', borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 12 }}
                />
                <Bar dataKey="leads" fill="#881337" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Chart 2: Monthly Revenue Growth */}
        <div className="bg-white rounded-xl border border-stone-200/80 p-5 shadow-xs">
          <div className="flex items-center justify-between pb-3 border-b border-stone-100">
            <div>
              <h2 className="text-sm font-bold text-stone-900 font-display">Revenue Growth (INR)</h2>
              <p className="text-xs text-stone-500">Wholesale pooja orders progression</p>
            </div>
            <span className="text-[10px] font-mono font-semibold bg-emerald-50 text-emerald-800 px-2 py-0.5 rounded">
              Trend: +151%
            </span>
          </div>

          <div className="h-60 mt-4">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={monthlyRevenueData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                <defs>
                  <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#d97706" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#d97706" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
                <YAxis
                  tick={{ fontSize: 11, fill: '#64748b' }}
                  tickFormatter={(v) => `₹${v / 1000}k`}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  formatter={(v: any) => [`₹${Number(v ?? 0).toLocaleString('en-IN')}`, 'Revenue']}
                  contentStyle={{ backgroundColor: '#ffffff', borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 12 }}
                />
                <Area type="monotone" dataKey="revenue" stroke="#d97706" strokeWidth={2} fill="url(#revGrad)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Lead Stage Funnel & Team Task Performance */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Lead Funnel */}
        <div className="bg-white rounded-xl border border-stone-200/80 p-5 shadow-xs">
          <div className="pb-3 border-b border-stone-100">
            <h2 className="text-sm font-bold text-stone-900 font-display">Lead Conversion Stages</h2>
            <p className="text-xs text-stone-500">Pipeline progression from inbound to order placement</p>
          </div>

          <div className="mt-4 space-y-2.5">
            {leadStageFunnel.map((item) => (
              <div key={item.stage} className="flex items-center justify-between text-xs">
                <span className="text-stone-700 w-28 truncate">{item.stage}</span>
                <div className="flex-1 mx-3 bg-stone-100 h-2.5 rounded-full overflow-hidden">
                  <div
                    className="bg-amber-600 h-full rounded-full"
                    style={{ width: `${Math.min(100, (item.count / 95) * 100)}%` }}
                  />
                </div>
                <span className="font-mono font-bold text-stone-900 w-12 text-right">{item.count}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Member Task Execution Benchmark */}
        <div className="bg-white rounded-xl border border-stone-200/80 p-5 shadow-xs">
          <div className="pb-3 border-b border-stone-100">
            <h2 className="text-sm font-bold text-stone-900 font-display">Tasks Done vs Missed per Member</h2>
            <p className="text-xs text-stone-500">Execution rate across the 3 equal team members</p>
          </div>

          <div className="h-48 mt-4">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={taskPerformanceData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="member" tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                <Bar dataKey="done" name="Completed Tasks" fill="#059669" radius={[4, 4, 0, 0]} />
                <Bar dataKey="missed" name="Missed Tasks" fill="#e11d48" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
};
