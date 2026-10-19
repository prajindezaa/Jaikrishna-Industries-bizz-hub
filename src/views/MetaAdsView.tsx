/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import {
  Sparkles,
  LayoutGrid,
  Table,
  Calendar as CalendarIcon,
  LineChart,
  Calendar,
  Layers,
  Award,
  Upload,
  Plus,
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

export const MetaAdsView: React.FC = () => {
  const { t } = useLanguage();
  const { metaAds, festivalEvents } = useApp();

  // Sub-view: Pipeline | Table | Calendar | Reports
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

  // Selected ad for reporting drill-down
  const [selectedAdForReport, setSelectedAdForReport] = useState<string | undefined>(undefined);

  // Handlers
  const handleOpenPlanModal = (ad?: MetaAd) => {
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
  const pendingCount = metaAds.filter((a) => !a.isDeleted && a.stage === 'Pending').length;
  const publishedCount = metaAds.filter((a) => !a.isDeleted && a.stage === 'Published').length;
  const waitingCount = metaAds.filter((a) => !a.isDeleted && a.stage === 'Waiting for result').length;
  const fulfilledCount = metaAds.filter((a) => !a.isDeleted && a.stage === 'Fulfilled').length;

  return (
    <div className="space-y-6">
      {/* 3D Visual Hero */}
      <ThreeDiyaHero
        title="Meta Ads Command Hub"
        subtitle="End-to-end advertising pipeline, Panchangam festival calendar, verified results, and 100% accurate conversion reports"
      />

      {/* Meta Ads View Navigation Bar & Quick Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-stone-200">
        <div className="flex flex-wrap items-center gap-1.5 p-1 bg-stone-100 rounded-xl w-fit">
          <button
            onClick={() => setMetaSubView('pipeline')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors flex items-center gap-1.5 ${
              metaSubView === 'pipeline'
                ? 'bg-white text-stone-900 shadow-2xs'
                : 'text-stone-600 hover:text-stone-900'
            }`}
          >
            <LayoutGrid className="w-3.5 h-3.5" />
            <span>Pipeline Kanban</span>
            <span className="px-1.5 py-0.2 bg-stone-200 text-stone-700 text-[10px] rounded-full font-mono">
              {metaAds.filter((a) => !a.isDeleted).length}
            </span>
          </button>

          <button
            onClick={() => setMetaSubView('table')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors flex items-center gap-1.5 ${
              metaSubView === 'table'
                ? 'bg-white text-stone-900 shadow-2xs'
                : 'text-stone-600 hover:text-stone-900'
            }`}
          >
            <Table className="w-3.5 h-3.5" />
            <span>Table &amp; Records</span>
          </button>

          <button
            onClick={() => setMetaSubView('calendar')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors flex items-center gap-1.5 ${
              metaSubView === 'calendar'
                ? 'bg-white text-stone-900 shadow-2xs'
                : 'text-stone-600 hover:text-stone-900'
            }`}
          >
            <CalendarIcon className="w-3.5 h-3.5" />
            <span>Festival Calendar</span>
            <span className="px-1.5 py-0.2 bg-amber-100 text-amber-800 text-[10px] rounded-full font-mono">
              {festivalEvents.length}
            </span>
          </button>

          <button
            onClick={() => setMetaSubView('reports')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors flex items-center gap-1.5 ${
              metaSubView === 'reports'
                ? 'bg-white text-stone-900 shadow-2xs'
                : 'text-stone-600 hover:text-stone-900'
            }`}
          >
            <LineChart className="w-3.5 h-3.5" />
            <span>Accurate Reports &amp; ROI</span>
            <span className="px-1.5 py-0.2 bg-emerald-100 text-emerald-800 text-[10px] rounded-full font-mono">
              {fulfilledCount}
            </span>
          </button>
        </div>

        {/* Global Action Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setIsFestivalModalOpen(true)}
            className="px-3 py-1.5 text-xs font-semibold text-stone-700 bg-white hover:bg-stone-50 border border-stone-200 rounded-xl flex items-center gap-1.5 transition-colors shadow-2xs"
          >
            <Calendar className="w-3.5 h-3.5 text-amber-600" />
            <span>Panchangam ({festivalEvents.length})</span>
          </button>

          <button
            onClick={() => {
              setDraftAdToEdit(null);
              setIsPastAdModalOpen(true);
            }}
            className="px-3 py-1.5 text-xs font-semibold text-emerald-900 bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 rounded-xl flex items-center gap-1.5 transition-colors shadow-2xs"
          >
            <Plus className="w-3.5 h-3.5 text-emerald-700" />
            <span>Add Past Ad</span>
          </button>

          <button
            onClick={() => setIsBulkImportModalOpen(true)}
            className="px-3 py-1.5 text-xs font-semibold text-blue-900 bg-blue-50 hover:bg-blue-100 border border-blue-300 rounded-xl flex items-center gap-1.5 transition-colors shadow-2xs"
          >
            <Upload className="w-3.5 h-3.5 text-blue-700" />
            <span>Import Excel</span>
          </button>

          <button
            onClick={() => handleOpenPlanModal()}
            className="px-4 py-1.5 text-xs font-bold text-white bg-amber-600 hover:bg-amber-700 rounded-xl flex items-center gap-1.5 transition-colors shadow-xs"
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-200" />
            <span>New Campaign</span>
          </button>
        </div>
      </div>

      {/* SUB-VIEWS */}
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
          onSelectAdForReport={(ad) => {
            setSelectedAdForReport(ad.id);
            setMetaSubView('reports');
          }}
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
          selectedAdId={selectedAdForReport}
          onSelectAdId={setSelectedAdForReport}
          onOpenCustomerLinkModal={(ad) => setAdForCustomerLink(ad)}
        />
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
