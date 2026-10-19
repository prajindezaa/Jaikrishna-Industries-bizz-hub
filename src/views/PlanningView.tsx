/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import {
  Calendar,
  MessageSquare,
  FileText,
  Copy,
  Check,
  CheckSquare,
  Sparkles,
  ArrowRight,
  TrendingUp,
  Target,
  Send,
  Building2,
} from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import { useApp } from '../context/AppContext';
import { ThreeDiyaHero } from '../components/ThreeDiyaHero';

export const PlanningView: React.FC = () => {
  const { t } = useLanguage();
  const { customers, orders, tasks } = useApp();

  // Active sub-tab
  const [activeTab, setActiveTab] = useState<'scripts' | 'checklist' | 'catalog'>('scripts');

  // Script customizer state
  const [copiedScript, setCopiedScript] = useState<string | null>(null);
  const [testCustomerName, setTestCustomerName] = useState('Murugan Swamy');
  const [testCity, setTestCity] = useState('Salem');
  const [testProduct, setTestProduct] = useState('Pure Bhimseni Camphor');

  // Daily operations goals state
  const [dailyGoals, setDailyGoals] = useState([
    { id: 1, text: 'Review new inbound wholesale lead submissions from Salem & Kovai', done: true },
    { id: 2, text: 'Dispatch 15 wholesale sample kits with camphor tablet jars', done: false },
    { id: 3, text: 'Follow up with Meenakshi Amman Temple Trust Store', done: false },
    { id: 4, text: 'Inspect factory packaging batch of Deepam Lamp Oil 1L cans', done: true },
    { id: 5, text: 'Verify transporter LR copies and update pending dispatches', done: false },
  ]);

  const rawScript1 = `Vanakkam {name},

Greetings from Jaikrishna Industries ({city}). 

We noticed your interest in our pooja products manufacturing catalog. We supply factory-direct {product}, Camphor Tablets, Deepam Lamp Oil, and Premium Agarbatti at direct wholesale rates.

Would you like us to dispatch our festival sample kit and wholesale price list to your shop?

Best regards,
Jaikrishna Industries, Salem`;

  const rawScript2 = `Vanakkam {name},

Jaikrishna Industries here! We dispatched your wholesale sample parcel via ST Courier yesterday.

Included inside:
1. Premium Bhimseni Camphor Sample Jar (50g)
2. Pure Deepam Cow Ghee Lamp Oil (200ml)
3. Handcrafted Fragrance Agarbatti pack
4. GST Wholesale Rate Sheet & Margin Calculator

Please let us know once the package arrives at your shop in {city}.

Contact: 9442262670
Factory: Jaikrishna Industries, Salem`;

  const rawScript3 = `Vanakkam {name},

Festival season orders are currently being booked for Tamil Nadu wholesale distributors.

As an existing valued customer of Jaikrishna Industries, we have reserved your priority batch pricing for {product} and Deepam Oils with immediate dispatch.

Kindly share your expected carton quantity so we can block factory stock for your shop.

Jaikrishna Industries, Salem`;

  const renderScript = (tmpl: string) => {
    return tmpl
      .replace(/\{name\}/g, testCustomerName)
      .replace(/\{city\}/g, testCity)
      .replace(/\{product\}/g, testProduct);
  };

  const copyScript = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedScript(id);
    setTimeout(() => setCopiedScript(null), 2000);
  };

  // Operational metrics
  const activeCustomersCount = customers.filter((c) => !c.isDeleted).length;
  const pendingOrdersCount = orders.filter((o) => !o.isDeleted && o.deliveryStatus === 'Pending').length;
  const pendingTasksCount = tasks.filter((t) => !t.isDeleted && t.status !== 'Done').length;

  return (
    <div className="space-y-6">
      {/* 3D Visual Hero */}
      <ThreeDiyaHero
        title="Planning &amp; Execution Hub"
        subtitle="Daily operations checklists, dynamic WhatsApp outreach sequences, and wholesale product catalog scripts"
      />

      {/* Top Navigation & KPI Strip */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-stone-200">
        <div className="flex items-center gap-1.5 p-1 bg-stone-100 rounded-xl w-fit">
          <button
            onClick={() => setActiveTab('scripts')}
            className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-colors flex items-center gap-2 ${
              activeTab === 'scripts'
                ? 'bg-white text-stone-900 shadow-2xs'
                : 'text-stone-600 hover:text-stone-900'
            }`}
          >
            <MessageSquare className="w-3.5 h-3.5 text-amber-700" />
            <span>Outreach Scripts &amp; Templates</span>
          </button>

          <button
            onClick={() => setActiveTab('checklist')}
            className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-colors flex items-center gap-2 ${
              activeTab === 'checklist'
                ? 'bg-white text-stone-900 shadow-2xs'
                : 'text-stone-600 hover:text-stone-900'
            }`}
          >
            <CheckSquare className="w-3.5 h-3.5 text-emerald-700" />
            <span>Daily Operations Checklist</span>
            <span className="px-1.5 py-0.2 bg-stone-200 text-stone-700 text-[10px] rounded-full font-mono">
              {dailyGoals.filter((g) => g.done).length}/{dailyGoals.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('catalog')}
            className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-colors flex items-center gap-2 ${
              activeTab === 'catalog'
                ? 'bg-white text-stone-900 shadow-2xs'
                : 'text-stone-600 hover:text-stone-900'
            }`}
          >
            <Building2 className="w-3.5 h-3.5 text-blue-700" />
            <span>Wholesale Lineup Reference</span>
          </button>
        </div>

        {/* Operational Indicators */}
        <div className="flex items-center gap-2 text-xs">
          <span className="px-2.5 py-1 bg-stone-50 border border-stone-200 rounded-lg text-stone-700 font-mono">
            <strong>{activeCustomersCount}</strong> CRM Shops
          </span>
          <span className="px-2.5 py-1 bg-amber-50 border border-amber-200 rounded-lg text-amber-900 font-mono">
            <strong>{pendingOrdersCount}</strong> Pending Dispatch
          </span>
          <span className="px-2.5 py-1 bg-blue-50 border border-blue-200 rounded-lg text-blue-900 font-mono">
            <strong>{pendingTasksCount}</strong> Open Tasks
          </span>
        </div>
      </div>

      {/* TAB 1: Outreach Scripts & WhatsApp Placeholders */}
      {activeTab === 'scripts' && (
        <div className="space-y-6">
          {/* Dynamic Placeholders Sandbox */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="bg-white rounded-2xl border border-stone-200/90 p-5 shadow-2xs space-y-4 text-xs">
              <div className="flex items-center gap-2 font-bold text-stone-900">
                <Sparkles className="w-4 h-4 text-amber-600" />
                <h3 className="font-display">Live Message Placeholders</h3>
              </div>
              <p className="text-stone-500 text-[11px] leading-relaxed">
                Fill these fields to preview how your WhatsApp outreach messages look before sending them to retailers or temple buyers.
              </p>

              <div>
                <label className="block font-semibold text-stone-700 mb-1">Customer / Contact Person</label>
                <input
                  type="text"
                  value={testCustomerName}
                  onChange={(e) => setTestCustomerName(e.target.value)}
                  className="w-full px-3 py-1.5 border border-stone-300 rounded-xl text-xs focus:ring-1 focus:ring-amber-500"
                />
              </div>

              <div>
                <label className="block font-semibold text-stone-700 mb-1">Town / City</label>
                <input
                  type="text"
                  value={testCity}
                  onChange={(e) => setTestCity(e.target.value)}
                  className="w-full px-3 py-1.5 border border-stone-300 rounded-xl text-xs focus:ring-1 focus:ring-amber-500"
                />
              </div>

              <div>
                <label className="block font-semibold text-stone-700 mb-1">Inquired Pooja Product</label>
                <input
                  type="text"
                  value={testProduct}
                  onChange={(e) => setTestProduct(e.target.value)}
                  className="w-full px-3 py-1.5 border border-stone-300 rounded-xl text-xs focus:ring-1 focus:ring-amber-500"
                />
              </div>
            </div>

            {/* Rendered Template 1: Inbound Lead Outreach */}
            <div className="lg:col-span-2 space-y-4">
              <div className="bg-white rounded-2xl border border-stone-200/90 p-5 shadow-2xs space-y-3">
                <div className="flex items-center justify-between pb-2 border-b border-stone-100">
                  <div>
                    <h4 className="text-xs font-bold text-stone-900 font-display">
                      Sequence 1: Day 1 Inbound WhatsApp Intro
                    </h4>
                    <span className="text-[11px] text-stone-500">Sent immediately upon new retail or temple inquiry</span>
                  </div>
                  <button
                    onClick={() => copyScript(renderScript(rawScript1), 's1')}
                    className="px-3 py-1.5 text-xs font-semibold text-amber-900 bg-amber-50 hover:bg-amber-100 border border-amber-200 rounded-xl inline-flex items-center gap-1.5 transition-colors shadow-2xs"
                  >
                    {copiedScript === 's1' ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedScript === 's1' ? 'Copied' : 'Copy'}</span>
                  </button>
                </div>
                <pre className="p-3.5 bg-stone-50 rounded-xl text-xs font-mono text-stone-800 whitespace-pre-wrap leading-relaxed border border-stone-200/60">
                  {renderScript(rawScript1)}
                </pre>
              </div>

              <div className="bg-white rounded-2xl border border-stone-200/90 p-5 shadow-2xs space-y-3">
                <div className="flex items-center justify-between pb-2 border-b border-stone-100">
                  <div>
                    <h4 className="text-xs font-bold text-stone-900 font-display">
                      Sequence 2: Sample Kit Dispatch Notification
                    </h4>
                    <span className="text-[11px] text-stone-500">Sent after courier parcel booking with LR details</span>
                  </div>
                  <button
                    onClick={() => copyScript(renderScript(rawScript2), 's2')}
                    className="px-3 py-1.5 text-xs font-semibold text-amber-900 bg-amber-50 hover:bg-amber-100 border border-amber-200 rounded-xl inline-flex items-center gap-1.5 transition-colors shadow-2xs"
                  >
                    {copiedScript === 's2' ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedScript === 's2' ? 'Copied' : 'Copy'}</span>
                  </button>
                </div>
                <pre className="p-3.5 bg-stone-50 rounded-xl text-xs font-mono text-stone-800 whitespace-pre-wrap leading-relaxed border border-stone-200/60">
                  {renderScript(rawScript2)}
                </pre>
              </div>

              <div className="bg-white rounded-2xl border border-stone-200/90 p-5 shadow-2xs space-y-3">
                <div className="flex items-center justify-between pb-2 border-b border-stone-100">
                  <div>
                    <h4 className="text-xs font-bold text-stone-900 font-display">
                      Sequence 3: Festival Reorder &amp; Batch Reservation
                    </h4>
                    <span className="text-[11px] text-stone-500">Sent 14 days before Karthigai Deepam, Diwali or Panguni Uthiram</span>
                  </div>
                  <button
                    onClick={() => copyScript(renderScript(rawScript3), 's3')}
                    className="px-3 py-1.5 text-xs font-semibold text-amber-900 bg-amber-50 hover:bg-amber-100 border border-amber-200 rounded-xl inline-flex items-center gap-1.5 transition-colors shadow-2xs"
                  >
                    {copiedScript === 's3' ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedScript === 's3' ? 'Copied' : 'Copy'}</span>
                  </button>
                </div>
                <pre className="p-3.5 bg-stone-50 rounded-xl text-xs font-mono text-stone-800 whitespace-pre-wrap leading-relaxed border border-stone-200/60">
                  {renderScript(rawScript3)}
                </pre>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: Daily Operations Checklist */}
      {activeTab === 'checklist' && (
        <div className="bg-white rounded-2xl border border-stone-200/90 p-6 shadow-2xs space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-stone-100">
            <div>
              <h3 className="text-sm font-bold text-stone-900 font-display">
                Factory &amp; Sales Operations Checklist
              </h3>
              <p className="text-xs text-stone-500">
                Daily manufacturing execution and wholesale dispatch cadence
              </p>
            </div>
            <span className="text-xs font-mono font-bold text-amber-900 bg-amber-50 border border-amber-200 px-3 py-1 rounded-xl">
              {dailyGoals.filter((g) => g.done).length} of {dailyGoals.length} Tasks Checked
            </span>
          </div>

          <div className="space-y-3 text-xs">
            {[...dailyGoals]
              .sort((a, b) => (a.done === b.done ? a.id - b.id : a.done ? 1 : -1))
              .map((goal) => (
                <label
                  key={goal.id}
                  className={`flex items-center gap-3 p-3.5 rounded-xl border transition-colors cursor-pointer select-none ${
                    goal.done
                      ? 'bg-stone-50/60 border-stone-200 text-stone-400'
                      : 'bg-white border-stone-200 hover:bg-stone-50 text-stone-900 font-semibold'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={goal.done}
                    onChange={() =>
                      setDailyGoals(
                        dailyGoals.map((g) => (g.id === goal.id ? { ...g, done: !g.done } : g))
                      )
                    }
                    className="rounded border-stone-300 text-amber-800 focus:ring-amber-500 w-4 h-4"
                  />
                  <span className={goal.done ? 'line-through' : ''}>{goal.text}</span>
                </label>
              ))}
          </div>
        </div>
      )}

      {/* TAB 3: Wholesale Product Catalog Reference */}
      {activeTab === 'catalog' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white rounded-2xl border border-stone-200/90 p-5 shadow-2xs space-y-3">
            <div className="w-10 h-10 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 flex items-center justify-center font-bold">
              🔥
            </div>
            <h4 className="font-bold text-sm text-stone-900 font-display">Bhimseni Camphor</h4>
            <p className="text-xs text-stone-600 leading-relaxed">
              100% Pure refined pacha karpooram tablets &amp; lumps. Zero chemical smoke, temple-grade aroma for wholesale distributors and pooja stores across Tamil Nadu.
            </p>
            <div className="pt-2 border-t border-stone-100 flex items-center justify-between text-xs font-mono text-stone-500">
              <span>Packaging: 50g, 100g, 1kg</span>
              <span className="font-bold text-amber-800">Master Box</span>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-stone-200/90 p-5 shadow-2xs space-y-3">
            <div className="w-10 h-10 rounded-xl bg-orange-50 border border-orange-200 text-orange-800 flex items-center justify-center font-bold">
              🪔
            </div>
            <h4 className="font-bold text-sm text-stone-900 font-display">Deepam Lamp Oil</h4>
            <p className="text-xs text-stone-600 leading-relaxed">
              Five-oil blend deepam tailam formulated for long-lasting steady flame without black smoke. Temple trusts and retail supermarket standard packaging.
            </p>
            <div className="pt-2 border-t border-stone-100 flex items-center justify-between text-xs font-mono text-stone-500">
              <span>Packaging: 500ml, 1L, 5L Cans</span>
              <span className="font-bold text-amber-800">Carton Units</span>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-stone-200/90 p-5 shadow-2xs space-y-3">
            <div className="w-10 h-10 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 flex items-center justify-center font-bold">
              🌸
            </div>
            <h4 className="font-bold text-sm text-stone-900 font-display">Fragrance Agarbatti</h4>
            <p className="text-xs text-stone-600 leading-relaxed">
              Charcoal-free floral &amp; herbal incense sticks. Natural sandal, rose, sambrani, and jasmine formulations for festive wholesale distributions.
            </p>
            <div className="pt-2 border-t border-stone-100 flex items-center justify-between text-xs font-mono text-stone-500">
              <span>Packaging: Zipper Pouch &amp; Box</span>
              <span className="font-bold text-amber-800">Dozen Bundles</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
