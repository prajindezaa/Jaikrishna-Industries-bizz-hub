/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  CartesianGrid,
  Legend,
  LineChart,
  Line,
} from 'recharts';
import {
  TrendingUp,
  Download,
  FileText,
  FileSpreadsheet,
  Award,
  DollarSign,
  Users,
  Eye,
  MessageSquare,
  Sparkles,
  ArrowRight,
  Filter,
} from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { MetaAd } from '../../types';
import { useApp } from '../../context/AppContext';
import {
  formatINR,
  formatIndianNumber,
  calculateRoi,
} from '../../lib/meta-ads-utils';

interface MetaAdsReportsViewProps {
  ads: MetaAd[];
  selectedAdId?: string;
  onSelectAdId?: (id: string) => void;
  onOpenCustomerLinkModal?: (ad: MetaAd) => void;
}

const COLORS = ['#d97706', '#2563eb', '#9333ea', '#059669', '#dc2626', '#475569'];

export const MetaAdsReportsView: React.FC<MetaAdsReportsViewProps> = ({
  ads,
  selectedAdId,
  onSelectAdId,
}) => {
  const { getDerivedAdMetrics } = useApp();

  const fulfilledAds = useMemo(() => {
    return ads.filter((a) => a.stage === 'Fulfilled' && a.results);
  }, [ads]);

  const [activeReportTab, setActiveReportTab] = useState<'single' | 'cross' | 'comparison'>('single');
  const [currentAdId, setCurrentAdId] = useState<string>(
    selectedAdId || fulfilledAds[0]?.id || ads[0]?.id || ''
  );

  // Multi-ad comparison state (select 2 to 5 ads)
  const [selectedAdIdsForComparison, setSelectedAdIdsForComparison] = useState<string[]>(() => {
    return fulfilledAds.slice(0, 3).map((a) => a.id);
  });

  const selectedAd = useMemo(() => {
    return ads.find((a) => a.id === currentAdId) || fulfilledAds[0];
  }, [ads, currentAdId, fulfilledAds]);

  const derived = useMemo(() => {
    if (!selectedAd) return { customersImported: 0, orders: 0, revenue: 0, roi: 0, costPerCustomer: 0, costPerOrder: 0 };
    return getDerivedAdMetrics(selectedAd.id);
  }, [selectedAd, getDerivedAdMetrics]);

  // Funnel Data for selected ad
  const funnelData = useMemo(() => {
    if (!selectedAd?.results) return [];
    const r = selectedAd.results;
    return [
      { step: '1. Views', count: r.views, fill: '#3b82f6' },
      { step: '2. Reach', count: r.viewers, fill: '#6366f1' },
      { step: '3. Clicks', count: r.linkClicks, fill: '#f59e0b' },
      { step: '4. Conversations', count: r.conversations, fill: '#10b981' },
      { step: '5. CRM Leads', count: derived.customersImported, fill: '#8b5cf6' },
      { step: '6. Orders', count: derived.orders, fill: '#ec4899' },
    ];
  }, [selectedAd, derived]);

  // Audience splits for pie charts
  const agePieData = useMemo(() => {
    if (!selectedAd?.results?.audienceAge) return [];
    return Object.entries(selectedAd.results.audienceAge).map(([name, value]) => ({
      name,
      value,
    }));
  }, [selectedAd]);

  const genderPieData = useMemo(() => {
    if (!selectedAd?.results?.audienceGender) return [];
    return Object.entries(selectedAd.results.audienceGender).map(([name, value]) => ({
      name,
      value,
    }));
  }, [selectedAd]);

  const placesPieData = useMemo(() => {
    if (!selectedAd?.results?.audiencePlaces) return [];
    return Object.entries(selectedAd.results.audiencePlaces).map(([name, value]) => ({
      name,
      value,
    }));
  }, [selectedAd]);

  // Engagement breakdown data
  const engagementData = useMemo(() => {
    if (!selectedAd?.results) return [];
    const r = selectedAd.results;
    return [
      { metric: 'Reactions', count: r.reactions || 0 },
      { metric: 'Comments', count: r.comments || 0 },
      { metric: 'Shares', count: r.shares || 0 },
      { metric: 'Saves', count: r.saves || 0 },
    ];
  }, [selectedAd]);

  // Cross-ad comparison data
  const comparisonAds = useMemo(() => {
    return ads.filter((a) => selectedAdIdsForComparison.includes(a.id));
  }, [ads, selectedAdIdsForComparison]);

  const comparisonChartData = useMemo(() => {
    return comparisonAds.map((ad) => {
      const d = getDerivedAdMetrics(ad.id);
      return {
        name: ad.name.length > 20 ? ad.name.slice(0, 18) + '...' : ad.name,
        spend: ad.results?.totalSpent || ad.totalBudget,
        conversations: ad.results?.conversations || 0,
        costPerConv: ad.results?.costPerConversation || 0,
        roi: d.roi,
        revenue: d.revenue,
      };
    });
  }, [comparisonAds, getDerivedAdMetrics]);

  // Export Per-Ad PDF Report
  const exportPdfReport = () => {
    if (!selectedAd) return;
    const doc = new jsPDF();

    // Title
    doc.setFontSize(18);
    doc.text('Jaikrishna Industries — Meta Ad Campaign Report', 14, 20);

    doc.setFontSize(11);
    doc.setTextColor(100);
    doc.text(`Campaign: ${selectedAd.name}`, 14, 28);
    doc.text(`Status: ${selectedAd.stage} | Generated on: ${new Date().toLocaleDateString('en-IN')}`, 14, 34);

    // KPI Summary Table
    const r = selectedAd.results;
    const kpiData = [
      ['Total Spend', formatINR(r?.totalSpent || selectedAd.totalBudget), 'Messaging Convs', formatIndianNumber(r?.conversations || 0)],
      ['Cost per Conv', formatINR(r?.costPerConversation || 0, true), 'Click-Through Rate (CTR)', `${(r?.ctr || 0).toFixed(2)}%`],
      ['Total Views (Impressions)', formatIndianNumber(r?.views || 0), 'Total Reach (Viewers)', formatIndianNumber(r?.viewers || 0)],
      ['Attributed Orders', formatIndianNumber(derived.orders), 'Attributed Revenue', formatINR(derived.revenue)],
      ['Return on Ad Spend (ROI)', `${derived.roi.toFixed(1)}%`, 'Campaign Rating', `${r?.rating || 5} / 5 Stars`],
    ];

    autoTable(doc, {
      startY: 42,
      head: [['Metric', 'Value', 'Metric', 'Value']],
      body: kpiData,
      theme: 'grid',
      headStyles: { fillColor: [217, 119, 6] },
    });

    // Funnel Details
    const funnelTable = funnelData.map(f => [f.step, formatIndianNumber(f.count)]);
    autoTable(doc, {
      startY: (doc as any).lastAutoTable.finalY + 10,
      head: [['Funnel Stage', 'Volume / Count']],
      body: funnelTable,
      theme: 'striped',
    });

    if (r?.lessons) {
      doc.setFontSize(12);
      doc.setTextColor(20);
      const y = (doc as any).lastAutoTable.finalY + 12;
      doc.text('Strategic Lessons & What Worked:', 14, y);
      doc.setFontSize(10);
      doc.setTextColor(80);
      doc.text(doc.splitTextToSize(r.lessons, 180), 14, y + 6);
    }

    doc.save(`meta-ad-report-${selectedAd.id.slice(0, 6)}.pdf`);
  };

  // Export Per-Ad Excel
  const exportExcelReport = () => {
    if (!selectedAd) return;
    const r = selectedAd.results;
    const summary = [
      { Metric: 'Campaign Name', Value: selectedAd.name },
      { Metric: 'Stage', Value: selectedAd.stage },
      { Metric: 'Total Spend (INR)', Value: r?.totalSpent || selectedAd.totalBudget },
      { Metric: 'Messaging Conversations', Value: r?.conversations || 0 },
      { Metric: 'Cost Per Conversation (INR)', Value: r?.costPerConversation || 0 },
      { Metric: 'Total Views (Impressions)', Value: r?.views || 0 },
      { Metric: 'Total Reach (Viewers)', Value: r?.viewers || 0 },
      { Metric: 'Frequency', Value: r?.frequency || 0 },
      { Metric: 'Link Clicks', Value: r?.linkClicks || 0 },
      { Metric: 'CTR (%)', Value: r?.ctr || 0 },
      { Metric: 'Attributed CRM Customers', Value: derived.customersImported },
      { Metric: 'Attributed Orders', Value: derived.orders },
      { Metric: 'Attributed Revenue (INR)', Value: derived.revenue },
      { Metric: 'Campaign ROI (%)', Value: derived.roi },
      { Metric: 'Rating (1-5)', Value: r?.rating || 5 },
      { Metric: 'Lessons', Value: r?.lessons || '' },
    ];

    const ws = XLSX.utils.json_to_sheet(summary);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Campaign Report');
    XLSX.writeFile(wb, `meta-ad-${selectedAd.id.slice(0, 6)}.xlsx`);
  };

  return (
    <div className="space-y-6">
      {/* Report Mode Tabs & Ad Selector */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-3.5 rounded-2xl border border-stone-200/90 shadow-2xs">
        <div className="flex items-center gap-1.5 p-1 bg-stone-100 rounded-xl">
          <button
            onClick={() => setActiveReportTab('single')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
              activeReportTab === 'single'
                ? 'bg-white text-stone-900 shadow-2xs'
                : 'text-stone-600 hover:text-stone-900'
            }`}
          >
            Individual Ad Deep-Dive
          </button>
          <button
            onClick={() => setActiveReportTab('comparison')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
              activeReportTab === 'comparison'
                ? 'bg-white text-stone-900 shadow-2xs'
                : 'text-stone-600 hover:text-stone-900'
            }`}
          >
            Compare 2 to 5 Ads
          </button>
        </div>

        {activeReportTab === 'single' && (
          <div className="flex items-center gap-2">
            <select
              value={selectedAd?.id || ''}
              onChange={(e) => {
                setCurrentAdId(e.target.value);
                onSelectAdId?.(e.target.value);
              }}
              className="px-3 py-1.5 text-xs font-semibold rounded-xl border border-stone-300 bg-white focus:outline-none max-w-xs truncate"
            >
              {ads.map((ad) => (
                <option key={ad.id} value={ad.id}>
                  {ad.name} ({ad.stage})
                </option>
              ))}
            </select>

            <button
              onClick={exportPdfReport}
              className="p-1.5 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-lg shadow-2xs transition-colors"
              title="Download PDF Report"
            >
              <FileText className="w-4 h-4" />
            </button>
            <button
              onClick={exportExcelReport}
              className="p-1.5 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-lg shadow-2xs transition-colors"
              title="Download Excel Report"
            >
              <FileSpreadsheet className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>

      {/* Mode 1: Single Ad Deep Dive */}
      {activeReportTab === 'single' && selectedAd && (
        <div className="space-y-6">
          {/* Top KPI Summary Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            <div className="bg-white p-3.5 rounded-2xl border border-stone-200/90 shadow-2xs">
              <span className="text-[11px] font-medium text-stone-500 uppercase tracking-wider block">Total Spent</span>
              <div className="text-lg font-bold font-mono text-stone-900 mt-1">
                {formatINR(selectedAd.results?.totalSpent || selectedAd.totalBudget)}
              </div>
              <span className="text-[10px] text-stone-400">Budget: {formatINR(selectedAd.totalBudget)}</span>
            </div>

            <div className="bg-white p-3.5 rounded-2xl border border-stone-200/90 shadow-2xs">
              <span className="text-[11px] font-medium text-stone-500 uppercase tracking-wider block">Conversations</span>
              <div className="text-lg font-bold font-mono text-stone-900 mt-1">
                {formatIndianNumber(selectedAd.results?.conversations || 0)}
              </div>
              <span className="text-[10px] text-stone-400">WhatsApp inquiries</span>
            </div>

            <div className="bg-white p-3.5 rounded-2xl border border-stone-200/90 shadow-2xs">
              <span className="text-[11px] font-medium text-stone-500 uppercase tracking-wider block">Cost / Conversation</span>
              <div className="text-lg font-bold font-mono text-amber-800 mt-1">
                {formatINR(selectedAd.results?.costPerConversation || 0, true)}
              </div>
              <span className="text-[10px] text-stone-400">Total spent / convs</span>
            </div>

            <div className="bg-white p-3.5 rounded-2xl border border-stone-200/90 shadow-2xs">
              <span className="text-[11px] font-medium text-stone-500 uppercase tracking-wider block">Click Rate (CTR)</span>
              <div className="text-lg font-bold font-mono text-blue-700 mt-1">
                {(selectedAd.results?.ctr || 0).toFixed(2)}%
              </div>
              <span className="text-[10px] text-stone-400">{formatIndianNumber(selectedAd.results?.linkClicks || 0)} link clicks</span>
            </div>

            <div className="bg-white p-3.5 rounded-2xl border border-stone-200/90 shadow-2xs">
              <span className="text-[11px] font-medium text-stone-500 uppercase tracking-wider block">Verified ROI</span>
              <div className={`text-lg font-bold font-mono mt-1 ${derived.roi >= 0 ? 'text-emerald-700' : 'text-rose-600'}`}>
                {derived.roi >= 0 ? '+' : ''}{derived.roi.toFixed(1)}%
              </div>
              <span className="text-[10px] text-stone-400">Rev: {formatINR(derived.revenue)}</span>
            </div>
          </div>

          {/* Funnel Chart */}
          <div className="bg-white p-5 rounded-2xl border border-stone-200/90 shadow-2xs space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-stone-100">
              <div>
                <h4 className="text-sm font-bold text-stone-900 font-display">
                  Conversion Funnel Analysis
                </h4>
                <p className="text-xs text-stone-500">
                  Views → Reach → Link Clicks → Conversations → CRM Leads → Wholesale Orders
                </p>
              </div>
              <span className="text-xs font-mono font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded">
                6-Stage Attribution
              </span>
            </div>

            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={funnelData} layout="vertical" margin={{ top: 5, right: 30, left: 40, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f0eded" />
                  <XAxis type="number" tickFormatter={(v) => formatIndianNumber(v)} />
                  <YAxis type="category" dataKey="step" tick={{ fontSize: 11 }} />
                  <Tooltip
                    formatter={(val: any) => [formatIndianNumber(Number(val)), 'Count']}
                    contentStyle={{ borderRadius: '8px', fontSize: '12px' }}
                  />
                  <Bar dataKey="count" radius={[0, 6, 6, 0]}>
                    {funnelData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.fill} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Audience Split Charts */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Age Split */}
            <div className="bg-white p-4 rounded-2xl border border-stone-200/90 shadow-2xs space-y-2">
              <h5 className="text-xs font-bold text-stone-800 uppercase tracking-wider">Age Group Split (%)</h5>
              <div className="h-44">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={agePieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={60} label={({ name, value }) => `${name}: ${value}%`}>
                      {agePieData.map((_, i) => (
                        <Cell key={i} fill={COLORS[i % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(v: any) => [`${v}%`, 'Share']} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Gender Split */}
            <div className="bg-white p-4 rounded-2xl border border-stone-200/90 shadow-2xs space-y-2">
              <h5 className="text-xs font-bold text-stone-800 uppercase tracking-wider">Gender Split (%)</h5>
              <div className="h-44">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={genderPieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={60} label={({ name, value }) => `${name}: ${value}%`}>
                      {genderPieData.map((_, i) => (
                        <Cell key={i} fill={i === 0 ? '#2563eb' : '#ec4899'} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(v: any) => [`${v}%`, 'Share']} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Top Places Split */}
            <div className="bg-white p-4 rounded-2xl border border-stone-200/90 shadow-2xs space-y-2">
              <h5 className="text-xs font-bold text-stone-800 uppercase tracking-wider">Top Places Split (%)</h5>
              <div className="h-44">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={placesPieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={60} label={({ name, value }: { name?: string; value?: number }) => `${(name || '').slice(0, 8)}: ${value}%`}>
                      {placesPieData.map((_, i) => (
                        <Cell key={i} fill={COLORS[(i + 2) % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(v: any) => [`${v}%`, 'Share']} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* Qualitative Lessons & Rating */}
          {selectedAd.results?.lessons && (
            <div className="bg-amber-50/70 p-4 rounded-2xl border border-amber-200 space-y-1.5 text-xs text-amber-950">
              <div className="flex items-center gap-2 font-bold">
                <Sparkles className="w-4 h-4 text-amber-700" />
                <span>What Worked &amp; Strategic Learnings for Next Festival:</span>
              </div>
              <p className="leading-relaxed text-stone-700">
                {selectedAd.results.lessons}
              </p>
            </div>
          )}
        </div>
      )}

      {/* Mode 2: Multi-Ad Comparison (2 to 5 ads) */}
      {activeReportTab === 'comparison' && (
        <div className="space-y-6">
          {/* Ad Selection Checkboxes */}
          <div className="bg-white p-4 rounded-2xl border border-stone-200/90 shadow-2xs space-y-2">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold uppercase tracking-wider text-stone-700">
                Select 2 to 5 Campaigns to Compare:
              </h4>
              <span className="text-xs font-mono font-bold text-stone-500">
                Selected: {selectedAdIdsForComparison.length} / 5
              </span>
            </div>
            <div className="flex flex-wrap gap-2">
              {ads.map((ad) => {
                const isSelected = selectedAdIdsForComparison.includes(ad.id);
                return (
                  <button
                    key={ad.id}
                    onClick={() => {
                      if (isSelected) {
                        if (selectedAdIdsForComparison.length > 2) {
                          setSelectedAdIdsForComparison(prev => prev.filter(id => id !== ad.id));
                        }
                      } else {
                        if (selectedAdIdsForComparison.length < 5) {
                          setSelectedAdIdsForComparison(prev => [...prev, ad.id]);
                        }
                      }
                    }}
                    className={`px-3 py-1.5 text-xs rounded-xl border transition-colors ${
                      isSelected
                        ? 'bg-amber-600 border-amber-600 text-white font-semibold shadow-2xs'
                        : 'bg-stone-50 border-stone-200 text-stone-700 hover:bg-stone-100'
                    }`}
                  >
                    {ad.name.slice(0, 28)}...
                  </button>
                );
              })}
            </div>
          </div>

          {/* Side by side chart */}
          <div className="bg-white p-5 rounded-2xl border border-stone-200/90 shadow-2xs space-y-4">
            <h4 className="text-sm font-bold text-stone-900 font-display">
              Spend vs. Messaging Conversations Comparison
            </h4>
            <div className="h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={comparisonChartData} margin={{ top: 10, right: 30, left: 10, bottom: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0eded" />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis yAxisId="left" orientation="left" tickFormatter={(v) => `₹${v}`} />
                  <YAxis yAxisId="right" orientation="right" tickFormatter={(v) => `${v}`} />
                  <Tooltip formatter={(v: any, name: any) => [name === 'spend' ? formatINR(Number(v)) : formatIndianNumber(Number(v)), name]} />
                  <Legend />
                  <Bar yAxisId="left" dataKey="spend" name="Spend (₹)" fill="#d97706" radius={[4, 4, 0, 0]} />
                  <Bar yAxisId="right" dataKey="conversations" name="WhatsApp Convs" fill="#2563eb" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Comparison Table */}
          <div className="bg-white rounded-2xl border border-stone-200/90 shadow-2xs overflow-hidden">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-stone-50 border-b border-stone-200 font-bold text-stone-600 uppercase tracking-wider text-[11px]">
                  <th className="p-3">Campaign</th>
                  <th className="p-3 text-right">Spend</th>
                  <th className="p-3 text-right">Conversations</th>
                  <th className="p-3 text-right">Cost/Conv</th>
                  <th className="p-3 text-right">Attributed Rev</th>
                  <th className="p-3 text-right">ROI (%)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100 font-mono">
                {comparisonAds.map((ad) => {
                  const d = getDerivedAdMetrics(ad.id);
                  return (
                    <tr key={ad.id} className="hover:bg-amber-50/20">
                      <td className="p-3 font-sans font-semibold text-stone-900 max-w-xs truncate">
                        {ad.name}
                      </td>
                      <td className="p-3 text-right">
                        {formatINR(ad.results?.totalSpent || ad.totalBudget)}
                      </td>
                      <td className="p-3 text-right font-bold text-stone-900">
                        {formatIndianNumber(ad.results?.conversations || 0)}
                      </td>
                      <td className="p-3 text-right text-amber-800 font-bold">
                        {formatINR(ad.results?.costPerConversation || 0, true)}
                      </td>
                      <td className="p-3 text-right text-emerald-800">
                        {formatINR(d.revenue)}
                      </td>
                      <td className="p-3 text-right font-bold">
                        <span className={d.roi >= 0 ? 'text-emerald-700' : 'text-rose-600'}>
                          {d.roi >= 0 ? '+' : ''}{d.roi.toFixed(1)}%
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
