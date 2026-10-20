/**
 * Jaikrishna Industries — Today's Focus Card (Dashboard In-App Widget)
 * (src/components/dashboard/TodaysFocusCard.tsx)
 *
 * Real-time operational focus card for the 3 team members.
 * Free of push notification budget (in-app ambient attention driver).
 * Evaluates live data:
 * 1. Uncontacted leads waiting
 * 2. Follow-ups due today
 * 3. Daily plan completion status
 * 4. Orders waiting for shipment / packing
 * 5. Festival campaign lookahead
 */

import React from 'react';
import { 
  Sparkles, 
  UserPlus, 
  PhoneCall, 
  ClipboardCheck, 
  Truck, 
  Calendar, 
  ArrowRight,
  CheckCircle2
} from 'lucide-react';
import { ActiveModule } from '../../types';
import { useApp } from '../../context/AppContext';
import { useAuth } from '../../context/AuthContext';

interface TodaysFocusCardProps {
  onNavigate: (module: ActiveModule) => void;
  onOpenNewCustomer?: () => void;
}

export const TodaysFocusCard: React.FC<TodaysFocusCardProps> = ({
  onNavigate,
  onOpenNewCustomer,
}) => {
  const { customers, tasks, orders, festivalEvents } = useApp();
  const { user } = useAuth();
  const userEmail = user?.email?.toLowerCase() || '';

  const todayStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date());

  // 1. Uncontacted Leads Waiting
  const uncontactedLeads = customers.filter(
    (c) => !c.isDeleted && c.leadStage === 'New' && (!c.outreachCount || c.outreachCount === 0)
  );

  // 2. Follow-ups Due Today
  const followUpsDue = customers.filter(
    (c) => !c.isDeleted && c.nextFollowUpDate && c.nextFollowUpDate <= todayStr
  );

  // 3. Today's Pending Tasks
  const myPendingTasks = tasks.filter(
    (t) => !t.isDeleted && t.date === todayStr && (t.assignedTo === userEmail || !t.assignedTo) && t.status !== 'Completed' && t.status !== 'Done'
  );

  // 4. Orders Waiting Dispatch
  const pendingDispatch = orders.filter(
    (o) => !o.isDeleted && (o.deliveryStatus === 'Pending' || o.deliveryStatus === 'Packed')
  );

  // 5. Festival Lookahead (14 Days)
  const upcomingFestival = festivalEvents
    .filter((f) => !f.isDeleted && f.date >= todayStr)
    .sort((a, b) => a.date.localeCompare(b.date))[0];

  const allClear = 
    uncontactedLeads.length === 0 && 
    followUpsDue.length === 0 && 
    myPendingTasks.length === 0 && 
    pendingDispatch.length === 0;

  return (
    <div className="bg-gradient-to-br from-amber-500/10 via-amber-50 to-stone-50 rounded-2xl border border-amber-300/60 p-5 shadow-xs space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-[#881337] text-white flex items-center justify-center shadow-xs">
            <Sparkles className="w-4 h-4 text-amber-300" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-stone-900 font-display flex items-center gap-1.5">
              <span>Today’s High-Priority Focus</span>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-amber-200/80 text-amber-900 font-semibold">
                Live
              </span>
            </h2>
            <p className="text-[11px] text-stone-500">Key operational items requiring your attention today</p>
          </div>
        </div>

        <button
          onClick={() => onNavigate('tasks')}
          className="text-xs font-semibold text-[#881337] hover:text-[#70102e] flex items-center gap-1 transition"
        >
          <span>View All Tasks</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </button>
      </div>

      {allClear ? (
        <div className="py-4 text-center space-y-1 bg-white/70 rounded-xl border border-amber-200/40">
          <CheckCircle2 className="w-6 h-6 text-emerald-600 mx-auto" />
          <div className="text-xs font-bold text-stone-800">Operational schedule is clear!</div>
          <p className="text-[11px] text-stone-500">All follow-ups, shipments, and daily tasks are up to date.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Action 1: Uncontacted Leads */}
          <div 
            onClick={() => onNavigate('customers')}
            className="p-3 bg-white rounded-xl border border-amber-200/70 hover:border-amber-400 cursor-pointer transition shadow-xs flex flex-col justify-between group"
          >
            <div>
              <div className="flex items-center justify-between text-stone-500 mb-1">
                <span className="text-[10px] font-semibold uppercase tracking-wider">New Enquiries</span>
                <UserPlus className="w-3.5 h-3.5 text-amber-700" />
              </div>
              <div className="text-lg font-extrabold text-stone-900 font-display">
                {uncontactedLeads.length} <span className="text-xs font-normal text-stone-500">leads</span>
              </div>
              <div className="text-[11px] text-stone-600 mt-0.5 line-clamp-1">
                {uncontactedLeads.length > 0 
                  ? `${uncontactedLeads[0].companyName || uncontactedLeads[0].contactPerson || 'New lead'} awaiting call`
                  : 'All leads contacted'}
              </div>
            </div>
            <div className="text-[10px] font-bold text-[#881337] mt-3 group-hover:underline flex items-center gap-1">
              <span>Open Leads</span>
              <ArrowRight className="w-3 h-3" />
            </div>
          </div>

          {/* Action 2: Follow-ups Due */}
          <div 
            onClick={() => onNavigate('tasks')}
            className="p-3 bg-white rounded-xl border border-amber-200/70 hover:border-amber-400 cursor-pointer transition shadow-xs flex flex-col justify-between group"
          >
            <div>
              <div className="flex items-center justify-between text-stone-500 mb-1">
                <span className="text-[10px] font-semibold uppercase tracking-wider">Follow-ups Due</span>
                <PhoneCall className="w-3.5 h-3.5 text-rose-700" />
              </div>
              <div className="text-lg font-extrabold text-stone-900 font-display">
                {followUpsDue.length} <span className="text-xs font-normal text-stone-500">due</span>
              </div>
              <div className="text-[11px] text-stone-600 mt-0.5 line-clamp-1">
                {followUpsDue.length > 0 
                  ? `Scheduled calls for today` 
                  : 'No calls due today'}
              </div>
            </div>
            <div className="text-[10px] font-bold text-[#881337] mt-3 group-hover:underline flex items-center gap-1">
              <span>Open Tasks</span>
              <ArrowRight className="w-3 h-3" />
            </div>
          </div>

          {/* Action 3: Orders Awaiting Dispatch */}
          <div 
            onClick={() => onNavigate('orders')}
            className="p-3 bg-white rounded-xl border border-amber-200/70 hover:border-amber-400 cursor-pointer transition shadow-xs flex flex-col justify-between group"
          >
            <div>
              <div className="flex items-center justify-between text-stone-500 mb-1">
                <span className="text-[10px] font-semibold uppercase tracking-wider">Wholesale Dispatch</span>
                <Truck className="w-3.5 h-3.5 text-blue-700" />
              </div>
              <div className="text-lg font-extrabold text-stone-900 font-display">
                {pendingDispatch.length} <span className="text-xs font-normal text-stone-500">shipments</span>
              </div>
              <div className="text-[11px] text-stone-600 mt-0.5 line-clamp-1">
                {pendingDispatch.length > 0 
                  ? `${pendingDispatch[0].customerName || 'Order'} ready for transport`
                  : 'All shipments cleared'}
              </div>
            </div>
            <div className="text-[10px] font-bold text-[#881337] mt-3 group-hover:underline flex items-center gap-1">
              <span>Check Orders</span>
              <ArrowRight className="w-3 h-3" />
            </div>
          </div>

          {/* Action 4: Upcoming Pooja / Festival */}
          <div 
            onClick={() => onNavigate('planning')}
            className="p-3 bg-white rounded-xl border border-amber-200/70 hover:border-amber-400 cursor-pointer transition shadow-xs flex flex-col justify-between group"
          >
            <div>
              <div className="flex items-center justify-between text-stone-500 mb-1">
                <span className="text-[10px] font-semibold uppercase tracking-wider">Next Festival</span>
                <Calendar className="w-3.5 h-3.5 text-emerald-700" />
              </div>
              <div className="text-sm font-extrabold text-stone-900 font-display line-clamp-1">
                {upcomingFestival ? upcomingFestival.name : 'No Festival Soon'}
              </div>
              <div className="text-[11px] text-stone-600 mt-0.5">
                {upcomingFestival ? `Date: ${upcomingFestival.date}` : 'Wholesale inventory normal'}
              </div>
            </div>
            <div className="text-[10px] font-bold text-[#881337] mt-3 group-hover:underline flex items-center gap-1">
              <span>Operations Plan</span>
              <ArrowRight className="w-3 h-3" />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
