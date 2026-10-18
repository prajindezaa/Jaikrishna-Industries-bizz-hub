/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import {
  Calendar,
  TrendingUp,
  MessageSquare,
  FileText,
  Copy,
  Check,
  Plus,
  Target,
  BarChart2,
  Sliders,
  Sparkles,
  LayoutGrid,
  Table,
  LineChart,
} from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import { useApp } from '../context/AppContext';
import { ThreeDiyaHero } from '../components/ThreeDiyaHero';
import { MetaAdsPipelineKanban } from '../components/meta-ads/MetaAdsPipelineKanban';
import { MetaAdsTableView } from '../components/meta-ads/MetaAdsTableView';
import { MetaAdsCalendarView } from '../components/meta-ads/MetaAdsCalendarView';
import { MetaAdsReportsView } from '../components/meta-ads/MetaAdsReportsView';
import { MetaAdPlanningModal } from '../components/meta-ads/MetaAdPlanningModal';
import { MetaAdResultsModal } from '../components/meta-ads/MetaAdResultsModal';
import { FestivalManagerModal } from '../components/meta-ads/FestivalManagerModal';
import { PastAdWizardModal } from '../components/meta-ads/PastAdWizardModal';
import { BulkImportPastAdsModal } from '../components/meta-ads/BulkImportPastAdsModal';
import { AdCustomerLinkModal } from '../components/meta-ads/AdCustomerLinkModal';
import { MetaAd, FestivalEvent } from '../types';

export const PlanningView: React.FC = () => {
  const { t } = useLanguage();
  const { metaAds, festivalEvents } = useApp();

  // Primary Tab: Phase 5B (Meta Ads Hub) vs Phase 5A (Scripts & Daily Execution)
  const [primaryTab, setPrimaryTab] = useState<'meta_hub' | 'phase5a_plans'>('meta_hub');

  // Meta Ads Hub sub-view
  const [metaSubView, setMetaSubView] = useState<'pipeline' | 'table' | 'calendar' | 'reports'>('pipeline');

  // Modals state
  const [isPlanningModalOpen, setIsPlanningModalOpen] = useState(false);
  const [adToEdit, setAdToEdit] = useState<MetaAd | null>(null);
  const [initialFestivalForAd, setInitialFestivalForAd] = useState<FestivalEvent | null>(null);

  const [isResultsModalOpen, setIsResultsModalOpen] = useState(false);
  const [adForResults, setAdForResults] = useState<MetaAd | null>(null);

  const [isFestivalModalOpen, setIsFestivalModalOpen] = useState(false);

  // Past Ads Modals state
  const [isPastAdModalOpen, setIsPastAdModalOpen] = useState(false);
  const [draftAdToEdit, setDraftAdToEdit] = useState<MetaAd | null>(null);
  const [isBulkImportModalOpen, setIsBulkImportModalOpen] = useState(false);
  const [adForCustomerLink, setAdForCustomerLink] = useState<MetaAd | null>(null);

  // Phase 5A: Script customization state
  const [copiedScript, setCopiedScript] = useState<string | null>(null);
  const [testCustomerName, setTestCustomerName] = useState('Murugan Swamy');
  const [testCity, setTestCity] = useState('Salem');
  const [testProduct, setTestProduct] = useState('Pure Bhimseni Camphor');

  // Phase 5A: Daily goals state
  const [dailyGoals, setDailyGoals] = useState([
    { id: 1, text: 'Review new Meta ad lead submissions from Salem & Kovai', done: true },
    { id: 2, text: 'Dispatch 15 wholesale sample kits with camphor tablet jars', done: false },
    { id: 3, text: 'Follow up with Meenakshi Amman Temple Trust Store', done: false },
    { id: 4, text: 'Inspect factory packaging batch of Deepam Lamp Oil 1L cans', done: true },
  ]);

  const rawScript = `Vanakkam {name},

Greetings from Jaikrishna Industries ({city}). 

We noticed your interest in our pooja products manufacturing catalog. We supply factory-direct {product}, Camphor Tablets, Deepam Lamp Oil, and Premium Agarbatti at direct wholesale rates.

Would you like us to dispatch our festival sample kit and wholesale price list to your shop?

Best regards,
Jaikrishna Industries, Salem`;

  const renderedScript = rawScript
    .replace('{name}', testCustomerName)
    .replace('{city}', testCity)
    .replace('{product}', testProduct);

  const copyScript = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedScript(id);
    setTimeout(() => setCopiedScript(null), 2000);
  };

  // Handlers for Meta Ads
  const handleOpenPlanModal = (ad?: MetaAd, initialDate?: string) => {
    setAdToEdit(ad || null);
    setInitialFestivalForAd(null);
    setIsPlanningModalOpen(true);
  };

  const handleOpenResultsModal = (ad: MetaAd) => {
    setAdForResults(ad);
    setIsResultsModalOpen(true);
  };

  const handlePlanAdForFestival = (festival: FestivalEvent) => {
    setAdToEdit(null);
    setInitialFestivalForAd(festival);
    setIsPlanningModalOpen(true);
  };

  // Counts per stage
  const pendingCount = metaAds.filter(a => a.stage === 'Pending').length;
  const publishedCount = metaAds.filter(a => a.stage === 'Published').length;
  const waitingCount = metaAds.filter(a => a.stage === 'Waiting for result').length;
  const fulfilledCount = metaAds.filter(a => a.stage === 'Fulfilled').length;

  return (
    <div className="space-y-6">
      {/* 3D Visual Hero */}
      <ThreeDiyaHero
        title="Planning Hub &amp; Meta Ads Command"
        subtitle="End-to-end Meta advertising pipeline, Panchangam festival calendar, verified results, and wholesale outreach scripts"
      />

      {/* Primary Section Switcher: Phase 5B (Meta Ads Hub) vs Phase 5A (Execution Plans & Scripts) */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-stone-200">
        <div className="flex items-center gap-1.5 p-1 bg-stone-100 rounded-xl w-fit">
          <button
            onClick={() => setPrimaryTab('meta_hub')}
            className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-colors flex items-center gap-2 ${
              primaryTab === 'meta_hub'
                ? 'bg-amber-600 text-white shadow-2xs'
                : 'text-stone-600 hover:text-stone-900'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Meta Ads Hub (Phase 5B)</span>
            <span className="px-1.5 py-0.2 bg-white/20 text-white text-[10px] rounded-full font-mono">
              {metaAds.length}
            </span>
          </button>

          <button
            onClick={() => setPrimaryTab('phase5a_plans')}
            className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-colors flex items-center gap-2 ${
              primaryTab === 'phase5a_plans'
                ? 'bg-amber-600 text-white shadow-2xs'
                : 'text-stone-600 hover:text-stone-900'
            }`}
          >
            <MessageSquare className="w-3.5 h-3.5" />
            <span>Phase 5A: Daily Plans &amp; Dynamic Scripts</span>
          </button>
        </div>

        {primaryTab === 'meta_hub' && (
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setIsFestivalModalOpen(true)}
              className="px-3 py-1.5 text-xs font-semibold text-amber-900 bg-amber-50 hover:bg-amber-100 border border-amber-200 rounded-xl flex items-center gap-1.5 transition-colors shadow-2xs"
            >
              <Calendar className="w-3.5 h-3.5 text-amber-600" />
              <span>Festivals ({festivalEvents.length})</span>
            </button>
            <button
              onClick={() => setIsBulkImportModalOpen(true)}
              className="px-3 py-1.5 text-xs font-semibold text-blue-900 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-xl flex items-center gap-1.5 transition-colors shadow-2xs"
            >
              <Table className="w-3.5 h-3.5 text-blue-600" />
              <span>Import Past Ads</span>
            </button>
            <button
              onClick={() => {
                setDraftAdToEdit(null);
                setIsPastAdModalOpen(true);
              }}
              className="px-3 py-1.5 text-xs font-semibold text-emerald-900 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-xl flex items-center gap-1.5 transition-colors shadow-2xs"
            >
              <Plus className="w-3.5 h-3.5 text-emerald-600" />
              <span>Add Past Ad</span>
            </button>
            <button
              onClick={() => handleOpenPlanModal()}
              className="px-3.5 py-1.5 text-xs font-semibold text-white bg-amber-600 hover:bg-amber-700 rounded-xl flex items-center gap-1.5 transition-colors shadow-xs"
            >
              <Plus className="w-4 h-4" />
              <span>Plan New Ad</span>
            </button>
          </div>
        )}
      </div>

      {/* PHASE 5B: Full Meta Ads Hub */}
      {primaryTab === 'meta_hub' && (
        <div className="space-y-5">
          {/* Sub-View Switcher: Kanban Pipeline | Table | Calendar | Reports */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-1 p-1 bg-stone-100 rounded-xl w-fit">
              <button
                onClick={() => setMetaSubView('pipeline')}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors flex items-center gap-1.5 ${
                  metaSubView === 'pipeline'
                    ? 'bg-white text-stone-900 shadow-2xs font-bold'
                    : 'text-stone-600 hover:text-stone-900'
                }`}
              >
                <LayoutGrid className="w-3.5 h-3.5 text-amber-600" />
                Pipeline (Kanban)
              </button>
              <button
                onClick={() => setMetaSubView('table')}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors flex items-center gap-1.5 ${
                  metaSubView === 'table'
                    ? 'bg-white text-stone-900 shadow-2xs font-bold'
                    : 'text-stone-600 hover:text-stone-900'
                }`}
              >
                <Table className="w-3.5 h-3.5 text-blue-600" />
                Table View
              </button>
              <button
                onClick={() => setMetaSubView('calendar')}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors flex items-center gap-1.5 ${
                  metaSubView === 'calendar'
                    ? 'bg-white text-stone-900 shadow-2xs font-bold'
                    : 'text-stone-600 hover:text-stone-900'
                }`}
              >
                <Calendar className="w-3.5 h-3.5 text-purple-600" />
                Calendar View
              </button>
              <button
                onClick={() => setMetaSubView('reports')}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors flex items-center gap-1.5 ${
                  metaSubView === 'reports'
                    ? 'bg-white text-stone-900 shadow-2xs font-bold'
                    : 'text-stone-600 hover:text-stone-900'
                }`}
              >
                <LineChart className="w-3.5 h-3.5 text-emerald-600" />
                Reports &amp; ROI
              </button>
            </div>

            {/* Stage Summary Badges */}
            <div className="flex items-center gap-1.5 text-xs">
              <span className="px-2 py-0.5 bg-amber-50 text-amber-900 border border-amber-200 rounded-md font-mono">
                {pendingCount} Pending
              </span>
              <span className="px-2 py-0.5 bg-blue-50 text-blue-900 border border-blue-200 rounded-md font-mono">
                {publishedCount} Live
              </span>
              <span className="px-2 py-0.5 bg-purple-50 text-purple-900 border border-purple-200 rounded-md font-mono">
                {waitingCount} Results Due
              </span>
              <span className="px-2 py-0.5 bg-emerald-50 text-emerald-900 border border-emerald-200 rounded-md font-mono">
                {fulfilledCount} Fulfilled
              </span>
            </div>
          </div>

          {/* Sub-view Content */}
          {metaSubView === 'pipeline' && (
            <MetaAdsPipelineKanban
              ads={metaAds}
              onOpenPlanModal={handleOpenPlanModal}
              onOpenResultsModal={handleOpenResultsModal}
              onOpenPastAdModal={(draftAd) => {
                setDraftAdToEdit(draftAd || null);
                setIsPastAdModalOpen(true);
              }}
              onOpenBulkImportModal={() => setIsBulkImportModalOpen(true)}
              onOpenCustomerLinkModal={(ad) => setAdForCustomerLink(ad)}
            />
          )}

          {metaSubView === 'table' && (
            <MetaAdsTableView
              ads={metaAds}
              onOpenPlanModal={handleOpenPlanModal}
              onOpenResultsModal={handleOpenResultsModal}
              onOpenPastAdModal={(draftAd) => {
                setDraftAdToEdit(draftAd || null);
                setIsPastAdModalOpen(true);
              }}
              onOpenBulkImportModal={() => setIsBulkImportModalOpen(true)}
              onOpenCustomerLinkModal={(ad) => setAdForCustomerLink(ad)}
            />
          )}

          {metaSubView === 'calendar' && (
            <MetaAdsCalendarView
              ads={metaAds}
              festivalEvents={festivalEvents}
              onOpenPlanModal={handleOpenPlanModal}
              onOpenResultsModal={handleOpenResultsModal}
              onOpenFestivalCalendar={() => setIsFestivalModalOpen(true)}
            />
          )}

          {metaSubView === 'reports' && (
            <MetaAdsReportsView
              ads={metaAds}
              onOpenCustomerLinkModal={(ad) => setAdForCustomerLink(ad)}
            />
          )}
        </div>
      )}

      {/* PHASE 5A: Daily Execution Plans & Dynamic Scripts */}
      {primaryTab === 'phase5a_plans' && (
        <div className="space-y-6">
          {/* Dynamic WhatsApp Scripts with Live Placeholders */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="bg-white rounded-2xl border border-stone-200/80 p-5 shadow-2xs space-y-3 text-xs">
              <h3 className="font-bold text-stone-900 font-display">Test Dynamic Placeholders</h3>
              <p className="text-stone-500 text-[11px]">
                Templates automatically replace placeholders like <code>{'{name}'}</code>, <code>{'{city}'}</code>, and <code>{'{product}'}</code>.
              </p>

              <div>
                <label className="block font-semibold text-stone-700 mb-1">Customer Name</label>
                <input
                  type="text"
                  value={testCustomerName}
                  onChange={(e) => setTestCustomerName(e.target.value)}
                  className="w-full px-2.5 py-1.5 border border-stone-300 rounded-lg text-xs"
                />
              </div>

              <div>
                <label className="block font-semibold text-stone-700 mb-1">City</label>
                <input
                  type="text"
                  value={testCity}
                  onChange={(e) => setTestCity(e.target.value)}
                  className="w-full px-2.5 py-1.5 border border-stone-300 rounded-lg text-xs"
                />
              </div>

              <div>
                <label className="block font-semibold text-stone-700 mb-1">Inquired Product</label>
                <input
                  type="text"
                  value={testProduct}
                  onChange={(e) => setTestProduct(e.target.value)}
                  className="w-full px-2.5 py-1.5 border border-stone-300 rounded-lg text-xs"
                />
              </div>
            </div>

            <div className="lg:col-span-2 bg-white rounded-2xl border border-stone-200/80 p-6 shadow-2xs space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-stone-100">
                <div>
                  <h3 className="text-sm font-bold text-stone-900 font-display">
                    Live Formatted WhatsApp Template
                  </h3>
                  <span className="text-[11px] text-stone-500">Day 1 Inbound Outreach Sequence</span>
                </div>
                <button
                  onClick={() => copyScript(renderedScript, 'rendered')}
                  className="px-3 py-1.5 text-xs font-semibold text-stone-800 bg-amber-100 hover:bg-amber-200 rounded-xl inline-flex items-center gap-1.5 transition-colors shadow-2xs"
                >
                  {copiedScript === 'rendered' ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedScript === 'rendered' ? 'Copied' : 'Copy to Clipboard'}</span>
                </button>
              </div>

              <pre className="p-4 bg-stone-50 rounded-xl text-xs font-mono text-stone-800 whitespace-pre-wrap leading-relaxed border border-stone-200/80">
                {renderedScript}
              </pre>
            </div>
          </div>

          {/* Daily Goals Checklist */}
          <div className="bg-white rounded-2xl border border-stone-200/80 p-6 shadow-2xs space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-stone-100">
              <div>
                <h2 className="text-sm font-bold text-stone-900 font-display">Daily Operations Checklist</h2>
                <p className="text-xs text-stone-500">End-of-day execution review for manufacturing &amp; sales</p>
              </div>
            </div>

            <div className="space-y-2.5 text-xs">
              {dailyGoals.map((goal) => (
                <label
                  key={goal.id}
                  className="flex items-center gap-3 p-3 rounded-xl border border-stone-200 hover:bg-stone-50 cursor-pointer transition-colors"
                >
                  <input
                    type="checkbox"
                    checked={goal.done}
                    onChange={() =>
                      setDailyGoals(
                        dailyGoals.map((g) => (g.id === goal.id ? { ...g, done: !g.done } : g))
                      )
                    }
                    className="rounded border-stone-300 text-amber-800"
                  />
                  <span className={goal.done ? 'line-through text-stone-400 font-normal' : 'text-stone-900 font-semibold'}>
                    {goal.text}
                  </span>
                </label>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Modals */}
      <MetaAdPlanningModal
        isOpen={isPlanningModalOpen}
        onClose={() => setIsPlanningModalOpen(false)}
        adToEdit={adToEdit}
        initialFestival={initialFestivalForAd}
        onOpenFestivalCalendar={() => setIsFestivalModalOpen(true)}
      />

      {adForResults && (
        <MetaAdResultsModal
          isOpen={isResultsModalOpen}
          onClose={() => {
            setIsResultsModalOpen(false);
            setAdForResults(null);
          }}
          ad={adForResults}
        />
      )}

      <FestivalManagerModal
        isOpen={isFestivalModalOpen}
        onClose={() => setIsFestivalModalOpen(false)}
        onPlanAdForFestival={handlePlanAdForFestival}
      />

      <PastAdWizardModal
        isOpen={isPastAdModalOpen}
        onClose={() => {
          setIsPastAdModalOpen(false);
          setDraftAdToEdit(null);
        }}
        initialDraftAd={draftAdToEdit}
      />

      <BulkImportPastAdsModal
        isOpen={isBulkImportModalOpen}
        onClose={() => setIsBulkImportModalOpen(false)}
      />

      {adForCustomerLink && (
        <AdCustomerLinkModal
          isOpen={Boolean(adForCustomerLink)}
          onClose={() => setAdForCustomerLink(null)}
          ad={adForCustomerLink}
        />
      )}
    </div>
  );
};
