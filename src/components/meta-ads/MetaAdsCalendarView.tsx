/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Calendar as CalendarIcon,
  Plus,
  Sparkles,
  Clock,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';
import { MetaAd, MetaAdStage, FestivalEvent } from '../../types';

interface MetaAdsCalendarViewProps {
  ads: MetaAd[];
  festivalEvents: FestivalEvent[];
  onOpenPlanModal: (ad?: MetaAd, initialDate?: string) => void;
  onOpenResultsModal: (ad: MetaAd) => void;
  onOpenFestivalCalendar?: () => void;
}

export const MetaAdsCalendarView: React.FC<MetaAdsCalendarViewProps> = ({
  ads,
  festivalEvents,
  onOpenPlanModal,
  onOpenResultsModal,
  onOpenFestivalCalendar,
}) => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<'month' | 'week'>('month');

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  // Navigation handlers
  const prevPeriod = () => {
    if (viewMode === 'month') {
      setCurrentDate(new Date(year, month - 1, 1));
    } else {
      const d = new Date(currentDate);
      d.setDate(d.getDate() - 7);
      setCurrentDate(d);
    }
  };

  const nextPeriod = () => {
    if (viewMode === 'month') {
      setCurrentDate(new Date(year, month + 1, 1));
    } else {
      const d = new Date(currentDate);
      d.setDate(d.getDate() + 7);
      setCurrentDate(d);
    }
  };

  const goToToday = () => {
    setCurrentDate(new Date());
  };

  // Month grid calculation
  const firstDayOfMonth = new Date(year, month, 1).getDay(); // 0 is Sunday
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  // Generate calendar days
  const calendarDays: { dateStr: string; dayNum: number; isCurrentMonth: boolean }[] = [];

  // Padding days from previous month
  const prevMonthDays = new Date(year, month, 0).getDate();
  for (let i = firstDayOfMonth - 1; i >= 0; i--) {
    const d = prevMonthDays - i;
    const m = month === 0 ? 12 : month;
    const y = month === 0 ? year - 1 : year;
    const dateStr = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    calendarDays.push({ dateStr, dayNum: d, isCurrentMonth: false });
  }

  // Days of current month
  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    calendarDays.push({ dateStr, dayNum: d, isCurrentMonth: true });
  }

  // Next month padding to fill complete weeks
  const remaining = (7 - (calendarDays.length % 7)) % 7;
  for (let d = 1; d <= remaining; d++) {
    const m = month === 11 ? 1 : month + 2;
    const y = month === 11 ? year + 1 : year;
    const dateStr = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    calendarDays.push({ dateStr, dayNum: d, isCurrentMonth: false });
  }

  // Week view calculation
  const startOfWeek = new Date(currentDate);
  startOfWeek.setDate(currentDate.getDate() - currentDate.getDay());
  const weekDays: { dateStr: string; dayNum: number; dayName: string }[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(startOfWeek);
    d.setDate(startOfWeek.getDate() + i);
    const dateStr = d.toISOString().slice(0, 10);
    weekDays.push({
      dateStr,
      dayNum: d.getDate(),
      dayName: d.toLocaleDateString('en-US', { weekday: 'short' }),
    });
  }

  const getStageBarColor = (stage: MetaAdStage) => {
    switch (stage) {
      case 'Pending':
        return 'bg-amber-500 text-white';
      case 'Published':
        return 'bg-blue-600 text-white';
      case 'Waiting for result':
        return 'bg-purple-600 text-white';
      case 'Fulfilled':
        return 'bg-emerald-600 text-white';
      case 'Cancelled':
        return 'bg-stone-400 text-white line-through';
    }
  };

  const todayStr = new Date().toISOString().slice(0, 10);

  return (
    <div className="space-y-4">
      {/* Calendar Header & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-3.5 rounded-2xl border border-stone-200/90 shadow-2xs">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1">
            <button
              onClick={prevPeriod}
              className="p-1.5 text-stone-600 hover:text-stone-900 hover:bg-stone-100 rounded-lg transition-colors"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <button
              onClick={goToToday}
              className="px-2.5 py-1 text-xs font-semibold text-stone-700 bg-stone-100 hover:bg-stone-200 rounded-lg transition-colors"
            >
              Today
            </button>
            <button
              onClick={nextPeriod}
              className="p-1.5 text-stone-600 hover:text-stone-900 hover:bg-stone-100 rounded-lg transition-colors"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>

          <h3 className="text-base font-bold text-stone-900 font-display">
            {currentDate.toLocaleDateString('en-US', {
              month: 'long',
              year: 'numeric',
            })}
          </h3>
        </div>

        <div className="flex items-center gap-2">
          {/* Panchangam Calendar Button */}
          {onOpenFestivalCalendar && (
            <button
              onClick={onOpenFestivalCalendar}
              className="px-3 py-1.5 text-xs font-semibold text-amber-900 bg-amber-50 hover:bg-amber-100 border border-amber-200 rounded-xl flex items-center gap-1.5 transition-colors"
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-600" />
              Panchangam Calendar
            </button>
          )}

          {/* View toggle */}
          <div className="flex items-center p-1 bg-stone-100 rounded-xl">
            <button
              onClick={() => setViewMode('month')}
              className={`px-3 py-1 text-xs font-semibold rounded-lg transition-colors ${
                viewMode === 'month' ? 'bg-white text-stone-900 shadow-2xs' : 'text-stone-600'
              }`}
            >
              Month
            </button>
            <button
              onClick={() => setViewMode('week')}
              className={`px-3 py-1 text-xs font-semibold rounded-lg transition-colors ${
                viewMode === 'week' ? 'bg-white text-stone-900 shadow-2xs' : 'text-stone-600'
              }`}
            >
              Week
            </button>
          </div>
        </div>
      </div>

      {/* Stage Legend */}
      <div className="flex flex-wrap items-center gap-3 px-2 text-[11px] font-medium text-stone-600">
        <span className="font-semibold text-stone-800">Legend:</span>
        <span className="flex items-center gap-1">
          <span className="w-2.5 h-2.5 rounded-full bg-amber-500" /> Pending (Plan)
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2.5 h-2.5 rounded-full bg-blue-600" /> Published (Live)
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2.5 h-2.5 rounded-full bg-purple-600" /> Results Due
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-600" /> Fulfilled
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2.5 h-2.5 rounded-full bg-rose-500" /> 🪔 Panchangam Festival
        </span>
      </div>

      {/* Month View Grid */}
      {viewMode === 'month' && (
        <div className="bg-white rounded-2xl border border-stone-200/90 shadow-2xs overflow-hidden">
          {/* Day of week headers */}
          <div className="grid grid-cols-7 border-b border-stone-200 text-center py-2 bg-stone-50 text-[11px] font-bold text-stone-600 uppercase tracking-wider">
            <span>Sun</span>
            <span>Mon</span>
            <span>Tue</span>
            <span>Wed</span>
            <span>Thu</span>
            <span>Fri</span>
            <span>Sat</span>
          </div>

          {/* Calendar Day Cells */}
          <div className="grid grid-cols-7 divide-x divide-y divide-stone-100">
            {calendarDays.map((cell, idx) => {
              const dayStr = cell.dateStr;
              const isToday = dayStr === todayStr;

              // Matching festivals
              const matchingFestivals = festivalEvents.filter(
                (f) => !f.isDeleted && f.date === dayStr
              );

              // Matching ads spanning this day
              const matchingAds = ads.filter((ad) => {
                if (!ad.plannedStart) return false;
                const start = ad.plannedStart.slice(0, 10);
                const end = ad.plannedEnd ? ad.plannedEnd.slice(0, 10) : start;
                return dayStr >= start && dayStr <= end;
              });

              // Ads ending on this day requiring results
              const endingAds = ads.filter((ad) => {
                if (!ad.plannedEnd) return false;
                return ad.plannedEnd.slice(0, 10) === dayStr && ad.stage !== 'Fulfilled';
              });

              return (
                <div
                  key={idx}
                  onClick={() => onOpenPlanModal(undefined, dayStr)}
                  className={`min-h-[120px] p-1.5 flex flex-col justify-between hover:bg-amber-50/20 cursor-pointer transition-colors group ${
                    !cell.isCurrentMonth ? 'bg-stone-50/50 opacity-60' : 'bg-white'
                  }`}
                >
                  {/* Date number & badges */}
                  <div className="flex items-center justify-between">
                    <span
                      className={`text-xs font-mono font-bold w-6 h-6 rounded-full flex items-center justify-center ${
                        isToday ? 'bg-amber-600 text-white' : 'text-stone-800'
                      }`}
                    >
                      {cell.dayNum}
                    </span>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onOpenPlanModal(undefined, dayStr);
                      }}
                      className="opacity-0 group-hover:opacity-100 p-0.5 text-stone-400 hover:text-amber-700 rounded transition-opacity"
                      title="Plan ad starting this day"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {/* Day Content */}
                  <div className="flex-1 space-y-1 mt-1 overflow-hidden">
                    {/* Festival markers */}
                    {matchingFestivals.map((fest) => (
                      <div
                        key={fest.id}
                        onClick={(e) => {
                          e.stopPropagation();
                          onOpenFestivalCalendar?.();
                        }}
                        className="px-1.5 py-0.5 bg-rose-50 border border-rose-200 text-rose-900 rounded text-[10px] font-bold truncate flex items-center gap-1"
                        title={fest.name}
                      >
                        <span>🪔</span>
                        <span className="truncate">{fest.name}</span>
                      </div>
                    ))}

                    {/* Meta Ad Bars */}
                    {matchingAds.slice(0, 3).map((ad) => (
                      <div
                        key={ad.id}
                        onClick={(e) => {
                          e.stopPropagation();
                          if (ad.stage === 'Fulfilled') {
                            onOpenResultsModal(ad);
                          } else {
                            onOpenPlanModal(ad);
                          }
                        }}
                        className={`px-1.5 py-0.5 rounded text-[10px] font-semibold truncate shadow-2xs hover:opacity-90 ${getStageBarColor(
                          ad.stage
                        )}`}
                        title={`${ad.name} (${ad.stage})`}
                      >
                        {ad.name}
                      </div>
                    ))}

                    {matchingAds.length > 3 && (
                      <span className="text-[9px] font-bold text-stone-400 block px-1">
                        +{matchingAds.length - 3} more ads
                      </span>
                    )}

                    {/* Deadline results due */}
                    {endingAds.map((ad) => (
                      <div
                        key={`due-${ad.id}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          onOpenResultsModal(ad);
                        }}
                        className="px-1 py-0.5 bg-purple-100 text-purple-900 border border-purple-300 rounded text-[9px] font-bold truncate flex items-center gap-0.5"
                      >
                        <Clock className="w-2.5 h-2.5" />
                        <span>Due: {ad.name.slice(0, 10)}</span>
                      </div>
                    ))}
                  </div>

                  <div className="text-[9px] text-stone-300 group-hover:text-amber-700/60 font-medium text-right">
                    Click to plan
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Week View */}
      {viewMode === 'week' && (
        <div className="bg-white rounded-2xl border border-stone-200/90 shadow-2xs overflow-hidden">
          <div className="grid grid-cols-7 divide-x divide-stone-200">
            {weekDays.map((wd) => {
              const dayStr = wd.dateStr;
              const isToday = dayStr === todayStr;

              const matchingFestivals = festivalEvents.filter(
                (f) => !f.isDeleted && f.date === dayStr
              );

              const matchingAds = ads.filter((ad) => {
                if (!ad.plannedStart) return false;
                const start = ad.plannedStart.slice(0, 10);
                const end = ad.plannedEnd ? ad.plannedEnd.slice(0, 10) : start;
                return dayStr >= start && dayStr <= end;
              });

              return (
                <div key={dayStr} className="min-h-[400px] flex flex-col p-2 space-y-2">
                  <div className="text-center pb-2 border-b border-stone-100">
                    <span className="text-[11px] font-bold text-stone-500 uppercase block">
                      {wd.dayName}
                    </span>
                    <span
                      className={`inline-block text-sm font-mono font-bold w-7 h-7 rounded-full leading-7 mt-0.5 ${
                        isToday ? 'bg-amber-600 text-white' : 'text-stone-900'
                      }`}
                    >
                      {wd.dayNum}
                    </span>
                  </div>

                  <div className="flex-1 space-y-2 overflow-y-auto">
                    {matchingFestivals.map((f) => (
                      <div
                        key={f.id}
                        className="p-1.5 bg-rose-50 border border-rose-200 rounded-lg text-xs font-bold text-rose-900"
                      >
                        🪔 {f.name}
                      </div>
                    ))}

                    {matchingAds.map((ad) => (
                      <div
                        key={ad.id}
                        onClick={() => {
                          if (ad.stage === 'Fulfilled') onOpenResultsModal(ad);
                          else onOpenPlanModal(ad);
                        }}
                        className={`p-2 rounded-xl text-xs font-semibold cursor-pointer shadow-2xs space-y-1 ${getStageBarColor(
                          ad.stage
                        )}`}
                      >
                        <div className="font-bold line-clamp-2">{ad.name}</div>
                        <div className="text-[10px] opacity-90">{ad.stage}</div>
                      </div>
                    ))}
                  </div>

                  <button
                    onClick={() => onOpenPlanModal(undefined, dayStr)}
                    className="w-full py-1 text-[11px] font-medium text-stone-600 hover:text-amber-800 hover:bg-amber-50 rounded border border-dashed border-stone-300"
                  >
                    + Plan Ad
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
