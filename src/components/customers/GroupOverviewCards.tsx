/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import {
  Layers,
  Users,
  TrendingUp,
  Clock,
  ShoppingBag,
  ArrowRight,
  Truck,
  Store,
  Building2,
  Landmark,
  Shield,
  Tag,
} from 'lucide-react';
import { CustomerGroup, Customer, Order, Task } from '../../types';

interface GroupOverviewCardsProps {
  groups: CustomerGroup[];
  customers: Customer[];
  orders: Order[];
  tasks: Task[];
  onSelectGroup: (groupId: string | 'all' | 'ungrouped') => void;
}

const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  Truck,
  Store,
  Building2,
  Landmark,
  Shield,
  Tag,
  Layers,
};

export const GroupOverviewCards: React.FC<GroupOverviewCardsProps> = ({
  groups,
  customers,
  orders,
  tasks,
  onSelectGroup,
}) => {
  const activeCustomers = customers.filter((c) => !c.isDeleted);
  const activeOrders = orders.filter((o) => !o.isDeleted);
  const activeTasks = tasks.filter((t) => !t.isDeleted);
  const todayStr = new Date().toISOString().slice(0, 10);

  // Ungrouped calculations
  const ungroupedCusts = activeCustomers.filter((c) => !c.groupId);

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 animate-in fade-in">
      {/* 1. All Customers Card */}
      <div
        onClick={() => onSelectGroup('all')}
        className="p-5 bg-white rounded-xl border border-stone-200 shadow-xs hover:border-[#881337] transition-all cursor-pointer space-y-3 group"
      >
        <div className="flex items-center justify-between">
          <div className="w-9 h-9 rounded-lg bg-[#881337]/10 text-[#881337] flex items-center justify-center">
            <Users className="w-5 h-5" />
          </div>
          <span className="text-xs font-semibold text-stone-500 group-hover:text-[#881337] flex items-center gap-1">
            View All <ArrowRight className="w-3.5 h-3.5" />
          </span>
        </div>

        <div>
          <h4 className="font-bold text-stone-900 text-sm font-display">All Customers</h4>
          <p className="text-xs text-stone-500">Total active CRM directory records</p>
        </div>

        <div className="grid grid-cols-2 gap-2 pt-2 border-t border-stone-100 text-xs">
          <div>
            <span className="text-[11px] text-stone-500">Total Records</span>
            <div className="font-bold text-base text-stone-900">{activeCustomers.length}</div>
          </div>
          <div>
            <span className="text-[11px] text-stone-500">Groups Configured</span>
            <div className="font-bold text-base text-stone-900">
              {groups.filter((g) => !g.isDeleted && g.isActive).length}
            </div>
          </div>
        </div>
      </div>

      {/* 2. Group Cards */}
      {groups
        .filter((g) => !g.isDeleted)
        .map((group) => {
          const groupCusts = activeCustomers.filter((c) => c.groupId === group.id);
          const newLeads = groupCusts.filter((c) => c.status === 'New customer').length;
          const oldClients = groupCusts.filter((c) => c.status === 'Old customer').length;
          
          // Tasks due
          const custIds = new Set(groupCusts.map((c) => c.id));
          const dueTasks = activeTasks.filter(
            (t) => t.customerId && custIds.has(t.customerId) && t.status !== 'Done' && t.date <= todayStr
          ).length;

          // Revenue this month
          const currentMonthPrefix = new Date().toISOString().slice(0, 7);
          const monthOrders = activeOrders.filter(
            (o) => (o.customerGroupId === group.id || custIds.has(o.customerId)) && (o.orderDate?.startsWith(currentMonthPrefix) || o.createdAt?.startsWith(currentMonthPrefix))
          );
          const monthSales = monthOrders.reduce((sum, o) => sum + (Number(o.totalAmount) || 0), 0);

          const IconComp = ICON_MAP[group.icon] || Layers;

          return (
            <div
              key={group.id}
              onClick={() => onSelectGroup(group.id)}
              className="p-5 bg-white rounded-xl border border-stone-200 shadow-xs hover:border-[#881337] transition-all cursor-pointer space-y-3 group"
            >
              <div className="flex items-center justify-between">
                <div
                  className="w-9 h-9 rounded-lg flex items-center justify-center text-white shadow-xs"
                  style={{ backgroundColor: group.color }}
                >
                  <IconComp className="w-4 h-4" />
                </div>
                <span className="text-xs font-semibold text-stone-500 group-hover:text-[#881337] flex items-center gap-1">
                  View <ArrowRight className="w-3.5 h-3.5" />
                </span>
              </div>

              <div>
                <div className="flex items-center gap-2">
                  <h4 className="font-bold text-stone-900 text-sm font-display">{group.name}</h4>
                  {group.nameTa && (
                    <span className="text-[11px] text-stone-500">({group.nameTa})</span>
                  )}
                  {group.isDefault && (
                    <span className="px-1.5 py-0.2 text-[9px] font-bold uppercase tracking-wider bg-amber-100 text-amber-800 rounded">
                      Default
                    </span>
                  )}
                </div>
                {group.description && (
                  <p className="text-xs text-stone-500 line-clamp-1 mt-0.5">{group.description}</p>
                )}
              </div>

              <div className="grid grid-cols-3 gap-2 pt-2 border-t border-stone-100 text-xs">
                <div>
                  <span className="text-[11px] text-stone-500">Customers</span>
                  <div className="font-bold text-base text-stone-900">{groupCusts.length}</div>
                  <div className="text-[10px] text-stone-400">
                    {newLeads} new · {oldClients} old
                  </div>
                </div>

                <div>
                  <span className="text-[11px] text-stone-500">Follow-ups</span>
                  <div className={`font-bold text-base ${dueTasks > 0 ? 'text-rose-600' : 'text-stone-900'}`}>
                    {dueTasks}
                  </div>
                  <div className="text-[10px] text-stone-400">due / pending</div>
                </div>

                <div>
                  <span className="text-[11px] text-stone-500">Sales (Mo)</span>
                  <div className="font-bold text-base font-mono text-stone-900">
                    ₹{monthSales > 0 ? monthSales.toLocaleString('en-IN') : '0'}
                  </div>
                  <div className="text-[10px] text-stone-400">{monthOrders.length} orders</div>
                </div>
              </div>
            </div>
          );
        })}

      {/* 3. Ungrouped Card */}
      {ungroupedCusts.length > 0 && (
        <div
          onClick={() => onSelectGroup('ungrouped')}
          className="p-5 bg-white rounded-xl border border-dashed border-amber-300 shadow-xs hover:border-amber-600 transition-all cursor-pointer space-y-3 group"
        >
          <div className="flex items-center justify-between">
            <div className="w-9 h-9 rounded-lg bg-amber-100 text-amber-800 flex items-center justify-center font-bold">
              ?
            </div>
            <span className="text-xs font-semibold text-amber-800 group-hover:text-amber-900 flex items-center gap-1">
              Classify <ArrowRight className="w-3.5 h-3.5" />
            </span>
          </div>

          <div>
            <h4 className="font-bold text-stone-900 text-sm font-display">Ungrouped Customers</h4>
            <p className="text-xs text-stone-500">Customers without an assigned group</p>
          </div>

          <div className="pt-2 border-t border-stone-100 text-xs flex items-center justify-between">
            <div>
              <span className="text-[11px] text-stone-500">Pending Assignment</span>
              <div className="font-bold text-base text-amber-700">{ungroupedCusts.length}</div>
            </div>
            <div className="text-right text-[11px] text-stone-500">
              Needs group categorization
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
