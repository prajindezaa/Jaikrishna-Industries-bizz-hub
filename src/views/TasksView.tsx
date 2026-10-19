/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import {
  CheckSquare,
  Plus,
  Clock,
  Phone,
  MessageSquare,
  Calendar as CalendarIcon,
  AlertCircle,
  CheckCircle2,
  Users,
  MapPin,
  ChevronLeft,
  ChevronRight,
  Filter,
  Check,
  X,
  Layers,
  Trash2,
  Repeat,
  Loader2,
  Sparkles,
  Zap,
  RotateCcw,
} from 'lucide-react';
import { Task, TaskType, TaskPriority, TaskStatus, TaskRepeat } from '../types';
import { useLanguage } from '../context/LanguageContext';
import { useApp } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import { formatPhoneDisplay, getTelLink, getWhatsAppLink } from '../lib/phone';

export const TasksView: React.FC = () => {
  const { t } = useLanguage();
  const { member } = useAuth();
  const {
    tasks,
    customers,
    loadingTasks,
    addTask,
    updateTask,
    completeTask,
    softDeleteTask,
    bulkGenerateTasks,
    metaAds,
    festivalEvents,
  } = useApp();

  const [viewMode, setViewMode] = useState<'daily' | 'weekly' | 'agenda'>('daily');
  const [selectedStatus, setSelectedStatus] = useState<string>('All');
  const [selectedAssignee, setSelectedAssignee] = useState<string>('All');
  const [activeDate, setActiveDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [showMetaAdsLayer, setShowMetaAdsLayer] = useState(true);

  // Modals
  const [showAddModal, setShowAddModal] = useState(false);
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [completionTask, setCompletionTask] = useState<Task | null>(null);
  const [completionNote, setCompletionNote] = useState('');

  // Form State
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [taskType, setTaskType] = useState<TaskType>('Call');
  const [priority, setPriority] = useState<TaskPriority>('Medium');
  const [assignedTo, setAssignedTo] = useState(member?.email || 'prajindezaa142@gmail.com');
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('');
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [startTime, setStartTime] = useState('10:00');
  const [endTime, setEndTime] = useState('10:30');
  const [repeat, setRepeat] = useState<TaskRepeat>('None');
  const [repeatDays, setRepeatDays] = useState<number[]>([1, 2, 3, 4, 5]);

  // Bulk Generator State
  const [bulkCity, setBulkCity] = useState('Salem');
  const [bulkType, setBulkType] = useState<TaskType>('Call');
  const [bulkDay, setBulkDay] = useState(() => new Date().toISOString().slice(0, 10));

  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    const matchedCustomer = customers.find((c) => c.id === selectedCustomerId);

    await addTask({
      title: title.trim(),
      description: description.trim(),
      customerId: selectedCustomerId || null,
      customerName: matchedCustomer ? matchedCustomer.companyName : null,
      type: taskType,
      assignedTo,
      priority,
      date,
      startTime,
      endTime,
      repeat,
      repeatDays: repeat === 'Custom' ? repeatDays : undefined,
      status: 'Pending',
    });

    setShowAddModal(false);
    setTitle('');
    setDescription('');
    setSelectedCustomerId('');
    showToast('Task added to schedule.');
  };

  const handleCompleteSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!completionTask) return;

    await completeTask(completionTask.id, completionNote);
    setCompletionTask(null);
    setCompletionNote('');
    showToast('Task marked as Done.');
  };

  const handleRunBulkGenerator = async () => {
    const targetCustomers = customers.filter(
      (c) => (bulkCity === 'All' || c.place?.city === bulkCity) && c.status === 'New customer'
    );

    if (targetCustomers.length === 0) {
      alert(`No new customer leads found in ${bulkCity}.`);
      return;
    }

    const count = await bulkGenerateTasks(targetCustomers, bulkType, bulkDay, '10:00', '10:15');
    setShowBulkModal(false);
    showToast(`Generated ${count} follow-up ${bulkType} tasks for ${bulkDay}!`);
  };

  const filteredTasks = useMemo(() => {
    const priorityWeight: Record<TaskPriority, number> = {
      Urgent: 1,
      High: 2,
      Medium: 3,
      Low: 4,
    };

    const statusWeight: Record<TaskStatus, number> = {
      'In progress': 1,
      'Pending': 2,
      'Missed': 3,
      'Done': 4,
    };

    return [...tasks]
      .filter((t) => {
        const matchesStatus = selectedStatus === 'All' || t.status === selectedStatus;
        const matchesAssignee = selectedAssignee === 'All' || t.assignedTo === selectedAssignee;

        if (viewMode === 'daily') {
          return matchesStatus && matchesAssignee && t.date === activeDate;
        }

        if (viewMode === 'weekly') {
          const curr = new Date(activeDate);
          const day = curr.getDay();
          const diff = curr.getDate() - day + (day === 0 ? -6 : 1);
          const monday = new Date(curr.setDate(diff));
          const sunday = new Date(monday);
          sunday.setDate(sunday.getDate() + 6);

          const mStr = monday.toISOString().slice(0, 10);
          const sStr = sunday.toISOString().slice(0, 10);
          return matchesStatus && matchesAssignee && t.date >= mStr && t.date <= sStr;
        }

        return matchesStatus && matchesAssignee;
      })
      .sort((a, b) => {
        // 1. Unfinished tasks first, Done tasks next
        const swA = statusWeight[a.status] || 2;
        const swB = statusWeight[b.status] || 2;
        if (swA !== swB) return swA - swB;

        // 2. Urgent & High priority first
        const pwA = priorityWeight[a.priority] || 3;
        const pwB = priorityWeight[b.priority] || 3;
        if (pwA !== pwB) return pwA - pwB;

        // 3. Date ascending (closer due date first)
        if (a.date !== b.date) return a.date.localeCompare(b.date);

        // 4. Start time ascending
        return (a.startTime || '').localeCompare(b.startTime || '');
      });
  }, [tasks, selectedStatus, selectedAssignee, viewMode, activeDate]);

  // Navigate active date
  const changeDate = (days: number) => {
    const d = new Date(activeDate);
    d.setDate(d.getDate() + days);
    setActiveDate(d.toISOString().slice(0, 10));
  };

  const getPriorityBadge = (p: TaskPriority) => {
    switch (p) {
      case 'Urgent':
        return 'bg-rose-100 text-rose-800 border-rose-300';
      case 'High':
        return 'bg-amber-100 text-amber-900 border-amber-300';
      case 'Medium':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      default:
        return 'bg-stone-100 text-stone-700 border-stone-200';
    }
  };

  const getStatusBadge = (s: TaskStatus) => {
    switch (s) {
      case 'Done':
        return 'bg-emerald-100 text-emerald-800 border-emerald-300';
      case 'In progress':
        return 'bg-blue-100 text-blue-800 border-blue-300';
      case 'Missed':
        return 'bg-red-100 text-red-800 border-red-300';
      default:
        return 'bg-amber-50 text-amber-900 border-amber-200';
    }
  };

  return (
    <div className="space-y-6">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-[#881337] text-white px-4 py-3 rounded-xl shadow-xl flex items-center gap-2 text-sm font-medium animate-bounce">
          <CheckCircle2 className="w-4 h-4 text-amber-300" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-stone-200">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold font-display text-stone-900 tracking-tight">
              Tasks, Follow-ups & Calendar
            </h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-[#881337]/10 text-[#881337]">
              {tasks.length} total
            </span>
          </div>
          <p className="text-xs text-stone-700 mt-1">
            Schedule pooja shop visits, follow-up calls, recurring tasks, and bulk batch outreach for sales reps.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Bulk Task Generator Button */}
          <button
            onClick={() => setShowBulkModal(true)}
            className="px-3 py-2 text-xs font-semibold rounded-lg border border-amber-300 bg-amber-50 text-amber-900 hover:bg-amber-100 flex items-center gap-1.5 transition-colors shadow-xs"
          >
            <Layers className="w-3.5 h-3.5 text-amber-700" />
            Bulk Task Generator
          </button>

          {/* New Task Button */}
          <button
            onClick={() => setShowAddModal(true)}
            className="px-4 py-2 text-xs font-bold rounded-lg bg-[#881337] text-white hover:bg-[#70102e] flex items-center gap-1.5 shadow-sm transition-colors"
          >
            <Plus className="w-4 h-4" />
            New Task
          </button>
        </div>
      </div>

      {/* Date Navigation & Controls */}
      <div className="bg-white p-3.5 rounded-xl border border-stone-200 shadow-xs flex flex-wrap items-center justify-between gap-3">
        {/* Date Stepper */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => changeDate(-1)}
            className="p-1.5 rounded-lg border border-stone-200 hover:bg-stone-100 text-stone-600 transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>

          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-stone-50 border border-stone-200">
            <CalendarIcon className="w-4 h-4 text-[#881337]" />
            <input
              type="date"
              value={activeDate}
              onChange={(e) => setActiveDate(e.target.value)}
              className="text-xs font-bold text-stone-800 bg-transparent focus:outline-hidden"
            />
          </div>

          <button
            onClick={() => changeDate(1)}
            className="p-1.5 rounded-lg border border-stone-200 hover:bg-stone-100 text-stone-600 transition-colors"
          >
            <ChevronRight className="w-4 h-4" />
          </button>

          <button
            onClick={() => setActiveDate(new Date().toISOString().slice(0, 10))}
            className="px-2.5 py-1 text-xs font-semibold rounded-md bg-stone-100 hover:bg-stone-200 text-stone-700 transition-colors"
          >
            Today
          </button>
        </div>

        {/* View Mode & Filters */}
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <div className="flex items-center gap-1 bg-stone-50 px-2 py-1.5 rounded-lg border border-stone-200">
            <Filter className="w-3.5 h-3.5 text-stone-500" />
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="bg-transparent font-medium text-stone-700 focus:outline-hidden text-xs"
            >
              <option value="All">All Statuses</option>
              <option value="Pending">Pending</option>
              <option value="In progress">In progress</option>
              <option value="Done">Done</option>
              <option value="Missed">Missed</option>
            </select>
          </div>

          <div className="flex items-center border border-stone-200 rounded-lg p-0.5 bg-stone-100">
            {(['daily', 'weekly', 'agenda'] as const).map((mode) => (
              <button
                key={mode}
                onClick={() => setViewMode(mode)}
                className={`px-3 py-1 rounded-md font-semibold capitalize transition-colors ${
                  viewMode === mode ? 'bg-white shadow-xs text-stone-900' : 'text-stone-700 hover:text-stone-900'
                }`}
              >
                {mode}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={() => setShowMetaAdsLayer(prev => !prev)}
            className={`px-2.5 py-1 text-xs font-semibold rounded-lg border transition-colors flex items-center gap-1.5 ${
              showMetaAdsLayer
                ? 'bg-amber-50 border-amber-300 text-amber-900 shadow-2xs'
                : 'bg-stone-50 border-stone-200 text-stone-600 hover:bg-stone-100'
            }`}
            title="Toggle Meta Ads and Panchangam festival calendar layer in task view"
          >
            <Layers className="w-3.5 h-3.5 text-amber-700" />
            <span>Meta Ads Layer: {showMetaAdsLayer ? 'ON' : 'OFF'}</span>
          </button>
        </div>
      </div>

      {/* Meta Ads & Festival Calendar Overlay Layer */}
      {showMetaAdsLayer && (
        (() => {
          const matchingFestivals = festivalEvents.filter(f => !f.isDeleted && f.date === activeDate);
          const activeAdsOnDate = metaAds.filter(ad => {
            if (!ad.plannedStart) return false;
            const start = ad.plannedStart.slice(0, 10);
            const end = ad.plannedEnd ? ad.plannedEnd.slice(0, 10) : start;
            return activeDate >= start && activeDate <= end;
          });

          if (matchingFestivals.length === 0 && activeAdsOnDate.length === 0) {
            return null;
          }

          return (
            <div className="p-3 bg-amber-50/70 border border-amber-200 rounded-xl space-y-2 text-xs">
              <div className="flex items-center justify-between font-bold text-amber-950">
                <span className="flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-amber-700" />
                  Meta Ads &amp; Panchangam Calendar Layer ({activeDate})
                </span>
                <span className="text-[10px] text-amber-800 font-mono">
                  {activeAdsOnDate.length} Active Ad(s) · {matchingFestivals.length} Festival(s)
                </span>
              </div>

              <div className="flex flex-wrap gap-2">
                {matchingFestivals.map(fest => (
                  <span
                    key={fest.id}
                    className="px-2.5 py-1 bg-rose-100 text-rose-900 font-semibold rounded-lg flex items-center gap-1 shadow-2xs"
                  >
                    🪔 {fest.name}
                  </span>
                ))}

                {activeAdsOnDate.map(ad => (
                  <span
                    key={ad.id}
                    className={`px-2.5 py-1 rounded-lg font-semibold flex items-center gap-1.5 shadow-2xs ${
                      ad.stage === 'Published'
                        ? 'bg-blue-600 text-white'
                        : ad.stage === 'Pending'
                        ? 'bg-amber-600 text-white'
                        : ad.stage === 'Waiting for result'
                        ? 'bg-purple-600 text-white'
                        : 'bg-emerald-600 text-white'
                    }`}
                  >
                    <span>Meta Ad: {ad.name}</span>
                    <span className="text-[10px] opacity-80">({ad.stage})</span>
                  </span>
                ))}
              </div>
            </div>
          );
        })()
      )}

      {/* Task List / Agenda */}
      {loadingTasks ? (
        <div className="p-12 text-center bg-white rounded-xl border border-stone-200">
          <Loader2 className="w-8 h-8 animate-spin text-[#881337] mx-auto mb-3" />
          <p className="text-xs font-semibold text-stone-700">Loading schedule from Firestore...</p>
        </div>
      ) : filteredTasks.length === 0 ? (
        <div className="bg-white rounded-2xl border border-dashed border-stone-300 p-12 text-center">
          <div className="w-12 h-12 bg-amber-50 rounded-2xl flex items-center justify-center mx-auto text-amber-700 mb-3 shadow-xs">
            <CheckSquare className="w-6 h-6" />
          </div>
          <h3 className="text-base font-bold text-stone-800 mb-1">No tasks scheduled</h3>
          <p className="text-xs text-stone-700 max-w-sm mx-auto mb-4">
            Schedule a customer follow-up call, factory delivery, or use the bulk generator for your city leads.
          </p>
          <button
            onClick={() => setShowAddModal(true)}
            className="px-4 py-2 text-xs font-bold rounded-lg bg-[#881337] text-white hover:bg-[#70102e] shadow-sm"
          >
            Create Task
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredTasks.map((t) => {
            const isCompleted = t.status === 'Done';
            const matchedCustomer = customers.find((c) => c.id === t.customerId);

            return (
              <div
                key={t.id}
                className={`p-4 rounded-xl border transition-all bg-white flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs ${
                  isCompleted ? 'border-emerald-200 bg-emerald-50/20 opacity-80' : 'border-stone-200 hover:border-amber-300'
                }`}
              >
                <div className="flex items-start gap-3">
                  <button
                    onClick={() => {
                      if (!isCompleted) {
                        setCompletionTask(t);
                      }
                    }}
                    className={`mt-0.5 w-5 h-5 rounded-md border flex items-center justify-center transition-colors ${
                      isCompleted
                        ? 'bg-emerald-600 border-emerald-600 text-white'
                        : 'border-stone-300 hover:border-[#881337]'
                    }`}
                  >
                    {isCompleted && <Check className="w-3.5 h-3.5" />}
                  </button>

                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${getPriorityBadge(t.priority)}`}>
                        {t.priority}
                      </span>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${getStatusBadge(t.status)}`}>
                        {t.status}
                      </span>
                      <span className="text-[10px] font-medium px-2 py-0.5 rounded-md bg-stone-100 text-stone-600">
                        {t.type}
                      </span>
                      {t.isAutomation && (
                        <span
                          className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-amber-50 text-amber-800 flex items-center gap-1 border border-amber-300 shadow-2xs"
                          title={`Created by automation (${t.automationRuleId || 'Rule 1'})`}
                        >
                          <Zap className="w-3 h-3 text-amber-600" />
                          <span>Automation</span>
                        </span>
                      )}
                      {t.repeat !== 'None' && (
                        <span className="text-[10px] font-medium px-2 py-0.5 rounded-md bg-purple-50 text-purple-700 flex items-center gap-1 border border-purple-200">
                          <Repeat className="w-3 h-3" />
                          {t.repeat}
                        </span>
                      )}
                    </div>

                    <h4 className={`text-sm font-bold text-stone-900 ${isCompleted ? 'line-through text-stone-500' : ''}`}>
                      {t.title}
                    </h4>

                    {t.description && <p className="text-xs text-stone-600">{t.description}</p>}

                    <div className="flex flex-wrap items-center gap-3 text-[11px] text-stone-500 pt-1">
                      <span className="flex items-center gap-1 font-medium text-stone-700">
                        <Clock className="w-3 h-3 text-stone-400" />
                        {t.date} · {t.startTime} – {t.endTime}
                      </span>

                      {t.customerName && (
                        <span className="flex items-center gap-1 text-[#881337] font-semibold">
                          <Users className="w-3 h-3" />
                          {t.customerName}
                        </span>
                      )}

                      <span>Assignee: {t.assignedTo.split('@')[0]}</span>
                    </div>

                    {t.completionNote && (
                      <div className="text-[11px] bg-emerald-50 text-emerald-800 p-2 rounded-lg border border-emerald-200 mt-1.5">
                        <span className="font-semibold">Note:</span> {t.completionNote}
                      </div>
                    )}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                  {matchedCustomer && (
                    <>
                      <a
                        href={getTelLink(matchedCustomer.phone)}
                        className="p-1.5 rounded-lg bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200 transition-colors"
                        title="Call Customer"
                      >
                        <Phone className="w-3.5 h-3.5" />
                      </a>
                      <a
                        href={getWhatsAppLink(matchedCustomer.whatsapp || matchedCustomer.phone, 'Vanakkam')}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-1.5 rounded-lg bg-teal-50 text-teal-700 hover:bg-teal-100 border border-teal-200 transition-colors"
                        title="WhatsApp Customer"
                      >
                        <MessageSquare className="w-3.5 h-3.5" />
                      </a>
                    </>
                  )}

                  {!isCompleted && (
                    <button
                      onClick={() => setCompletionTask(t)}
                      className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold flex items-center gap-1 transition-colors shadow-xs"
                    >
                      <Check className="w-3.5 h-3.5" />
                      Done
                    </button>
                  )}

                  {t.isAutomation && t.status === 'Pending' && !t.lastEditedBy && (
                    <button
                      onClick={async () => {
                        if (!window.confirm(`Undo automated task "${t.title}" and move it to trash?`)) return;
                        try {
                          const res = await fetch('/api/automations/undo-task', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ taskId: t.id }),
                          });
                          if (!res.ok) throw new Error('Undo failed');
                          softDeleteTask(t.id);
                          showToast('Automation task undone and moved to trash.');
                        } catch (err) {
                          softDeleteTask(t.id);
                          showToast('Task moved to trash.');
                        }
                      }}
                      className="p-1.5 text-amber-600 hover:text-amber-800 hover:bg-amber-50 rounded-lg transition-colors border border-amber-200"
                      title="Undo this automation task (revert to trash)"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                    </button>
                  )}

                  <button
                    onClick={() => {
                      if (window.confirm(`Move task "${t.title}" to trash?`)) {
                        softDeleteTask(t.id);
                        showToast('Task moved to trash.');
                      }
                    }}
                    className="p-1.5 text-stone-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors border border-stone-200"
                    title="Delete task"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add Task Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/40 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-stone-200 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-stone-200 mb-4">
              <h3 className="font-bold text-base text-stone-900 font-display">Schedule New Task</h3>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-stone-400 hover:text-stone-600 text-sm font-semibold p-1"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateTask} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-semibold text-stone-700 mb-1">
                  Task Title <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Call Salem Murugan Stores for Camphor Order Quotation"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-stone-300 focus:outline-hidden focus:border-[#881337]"
                />
              </div>

              <div>
                <label className="block font-semibold text-stone-700 mb-1">Associated Customer / Pooja Shop</label>
                <select
                  value={selectedCustomerId}
                  onChange={(e) => setSelectedCustomerId(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-stone-300 focus:outline-hidden"
                >
                  <option value="">-- No specific customer (General Task) --</option>
                  {customers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.companyName} ({c.place?.city || 'Salem'})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block font-semibold text-stone-700 mb-1">Type</label>
                  <select
                    value={taskType}
                    onChange={(e) => setTaskType(e.target.value as TaskType)}
                    className="w-full px-3 py-2 rounded-lg border border-stone-300 focus:outline-hidden"
                  >
                    <option value="Call">Call</option>
                    <option value="WhatsApp">WhatsApp</option>
                    <option value="Visit">Visit</option>
                    <option value="Meta ads">Meta ads</option>
                    <option value="Packing">Packing</option>
                    <option value="Other">Other</option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-stone-700 mb-1">Priority</label>
                  <select
                    value={priority}
                    onChange={(e) => setPriority(e.target.value as TaskPriority)}
                    className="w-full px-3 py-2 rounded-lg border border-stone-300 focus:outline-hidden"
                  >
                    <option value="Low">Low</option>
                    <option value="Medium">Medium</option>
                    <option value="High">High</option>
                    <option value="Urgent">Urgent</option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-stone-700 mb-1">Recurring</label>
                  <select
                    value={repeat}
                    onChange={(e) => setRepeat(e.target.value as TaskRepeat)}
                    className="w-full px-3 py-2 rounded-lg border border-stone-300 focus:outline-hidden"
                  >
                    <option value="None">None</option>
                    <option value="Daily">Daily</option>
                    <option value="Weekly">Weekly</option>
                    <option value="Custom">Custom Days</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block font-semibold text-stone-700 mb-1">Date</label>
                  <input
                    type="date"
                    required
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-stone-300 focus:outline-hidden"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-stone-700 mb-1">Start Time</label>
                  <input
                    type="time"
                    required
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-stone-300 focus:outline-hidden"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-stone-700 mb-1">End Time</label>
                  <input
                    type="time"
                    required
                    value={endTime}
                    onChange={(e) => setEndTime(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-stone-300 focus:outline-hidden"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-stone-700 mb-1">Description / Notes</label>
                <textarea
                  rows={2}
                  placeholder="e.g. Discuss Deepam Lamp Oil festival pricing and ST Courier dispatch details..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-stone-300 focus:outline-hidden focus:border-[#881337]"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-stone-200">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 font-semibold rounded-lg border border-stone-300 hover:bg-stone-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 font-bold rounded-lg bg-[#881337] text-white hover:bg-[#70102e] shadow-sm"
                >
                  Save Task
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Complete Task Modal */}
      {completionTask && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/40 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-sm w-full p-5 shadow-2xl border border-stone-200 animate-in fade-in">
            <h3 className="font-bold text-sm text-stone-900 mb-1">Complete Task</h3>
            <p className="text-xs text-stone-600 mb-3">{completionTask.title}</p>

            <form onSubmit={handleCompleteSubmit} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1">
                  Completion Note (Optional)
                </label>
                <textarea
                  rows={2}
                  placeholder="e.g. Spoke with manager, wholesale sample pack sent..."
                  value={completionNote}
                  onChange={(e) => setCompletionNote(e.target.value)}
                  className="w-full text-xs px-3 py-2 rounded-lg border border-stone-300 focus:outline-hidden focus:border-emerald-600"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setCompletionTask(null)}
                  className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-stone-300 hover:bg-stone-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 text-xs font-bold rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 shadow-sm"
                >
                  Mark as Done
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Bulk Task Generator Modal */}
      {showBulkModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/40 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-stone-200 animate-in fade-in">
            <div className="flex items-center justify-between pb-3 border-b border-stone-200 mb-4">
              <div className="flex items-center gap-2">
                <Layers className="w-5 h-5 text-amber-600" />
                <h3 className="font-bold text-base text-stone-900">Bulk Follow-up Task Generator</h3>
              </div>
              <button
                onClick={() => setShowBulkModal(false)}
                className="text-stone-400 hover:text-stone-600 text-sm font-semibold p-1"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-stone-600 mb-4">
              Automatically generates scheduled 15-minute follow-up tasks for all leads in a specific city.
            </p>

            <div className="space-y-3 text-xs mb-5">
              <div>
                <label className="block font-semibold text-stone-700 mb-1">Target City</label>
                <select
                  value={bulkCity}
                  onChange={(e) => setBulkCity(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-stone-300 focus:outline-hidden"
                >
                  <option value="Salem">Salem</option>
                  <option value="Coimbatore">Coimbatore</option>
                  <option value="Madurai">Madurai</option>
                  <option value="Erode">Erode</option>
                  <option value="Tiruppur">Tiruppur</option>
                  <option value="All">All Cities</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold text-stone-700 mb-1">Action Type</label>
                <select
                  value={bulkType}
                  onChange={(e) => setBulkType(e.target.value as TaskType)}
                  className="w-full px-3 py-2 rounded-lg border border-stone-300 focus:outline-hidden"
                >
                  <option value="Call">Phone Call</option>
                  <option value="WhatsApp">WhatsApp Follow-up</option>
                  <option value="Visit">Shop Visit</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold text-stone-700 mb-1">Scheduled Date</label>
                <input
                  type="date"
                  value={bulkDay}
                  onChange={(e) => setBulkDay(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-stone-300 focus:outline-hidden"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-stone-200">
              <button
                onClick={() => setShowBulkModal(false)}
                className="px-4 py-2 font-semibold rounded-lg border border-stone-300 hover:bg-stone-50"
              >
                Cancel
              </button>
              <button
                onClick={handleRunBulkGenerator}
                className="px-5 py-2 font-bold rounded-lg bg-amber-600 text-white hover:bg-amber-700 shadow-sm"
              >
                Generate Tasks
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
