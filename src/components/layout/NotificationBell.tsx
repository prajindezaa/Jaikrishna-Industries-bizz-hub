/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Jaikrishna Industries — Notification Center Dropdown & Bell
 * Displays real-time notifications with filter tabs (All, Unread),
 * "Mark all as read", snooze action, and deep-link routing.
 */

import React, { useState, useEffect } from 'react';
import { Bell, Check, ExternalLink, X, Clock, CheckCheck, Trash2 } from 'lucide-react';
import { db } from '../../lib/firebase';
import { useAuth } from '../../context/AuthContext';
import {
  collection,
  query,
  where,
  limit,
  onSnapshot,
  doc,
  updateDoc,
  writeBatch,
} from 'firebase/firestore';
import { AppNotification } from '../../types';

interface NotificationBellProps {
  onNavigate?: (module: any) => void;
}

export const NotificationBell: React.FC<NotificationBellProps> = ({ onNavigate }) => {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [filter, setFilter] = useState<'all' | 'unread'>('all');
  const [snoozeActive, setSnoozeActive] = useState(false);

  useEffect(() => {
    if (!db || !user?.email) return;

    const email = user.email.toLowerCase();
    const q = query(
      collection(db, 'notifications'),
      where('recipientEmail', '==', email),
      limit(50)
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const items = snapshot.docs.map((docSnap) => ({
          id: docSnap.id,
          ...docSnap.data(),
        })) as AppNotification[];

        // Client-side sort by newest first
        items.sort((a, b) => {
          const tA = (a.createdAt as any)?.toMillis ? (a.createdAt as any).toMillis() : new Date(a.createdAt || 0).getTime();
          const tB = (b.createdAt as any)?.toMillis ? (b.createdAt as any).toMillis() : new Date(b.createdAt || 0).getTime();
          return tB - tA;
        });

        setNotifications(items);
      },
      (error) => {
        console.warn('Notifications snapshot error:', error);
      }
    );

    return () => unsubscribe();
  }, [user]);

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  const markAsRead = async (id: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (!db) return;
    try {
      await updateDoc(doc(db, 'notifications', id), { isRead: true });
    } catch (err) {
      console.warn('Could not mark notification as read:', err);
    }
  };

  const markAllAsRead = async () => {
    if (!db || unreadCount === 0) return;
    const firestoreDb = db;
    try {
      const batch = writeBatch(firestoreDb);
      notifications.filter((n) => !n.isRead).forEach((n) => {
        batch.update(doc(firestoreDb, 'notifications', n.id), { isRead: true });
      });
      await batch.commit();
    } catch (err) {
      console.warn('Could not mark all notifications as read:', err);
    }
  };

  const handleSnooze = async (hours: number) => {
    if (!db || !user?.email) return;
    try {
      const snoozeUntil = new Date(Date.now() + hours * 60 * 60 * 1000).toISOString();
      await updateDoc(doc(db, 'team_members', user.email.toLowerCase()), {
        'notificationPreferences.snoozeUntil': snoozeUntil,
      });
      setSnoozeActive(true);
      setTimeout(() => setSnoozeActive(false), 3000);
    } catch (err) {
      console.warn('Could not set snooze:', err);
    }
  };

  const handleNotificationClick = async (notif: AppNotification) => {
    await markAsRead(notif.id);
    setIsOpen(false);
    if (notif.deepLink && onNavigate) {
      if (notif.deepLink.startsWith('/tasks')) {
        onNavigate('tasks');
      } else if (notif.deepLink.startsWith('/customers')) {
        onNavigate('customers');
      } else if (notif.deepLink.startsWith('/planning')) {
        onNavigate('planning');
      } else if (notif.deepLink.startsWith('/automations')) {
        onNavigate('automations');
      } else if (notif.deepLink.startsWith('/settings')) {
        onNavigate('settings');
      }
    }
  };

  const displayedNotifications = filter === 'unread'
    ? notifications.filter((n) => !n.isRead)
    : notifications;

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 text-stone-600 hover:text-stone-900 hover:bg-stone-100 rounded-lg transition-colors cursor-pointer"
        title="Notifications"
      >
        <Bell className="w-4 h-4 text-stone-700" />
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 flex h-4 w-4 items-center justify-center rounded-full bg-rose-600 text-[9px] font-bold text-white shadow-xs animate-pulse">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setIsOpen(false)}
          />
          <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white rounded-2xl shadow-xl border border-stone-200 z-50 overflow-hidden animate-in fade-in slide-in-from-top-2">
            {/* Header */}
            <div className="px-4 py-3 bg-stone-50 border-b border-stone-200 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="font-bold text-xs text-stone-900 font-display">Notification Center</span>
                {unreadCount > 0 && (
                  <span className="px-1.5 py-0.5 rounded-full bg-rose-100 text-rose-800 text-[10px] font-bold">
                    {unreadCount} unread
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1.5">
                {unreadCount > 0 && (
                  <button
                    onClick={markAllAsRead}
                    title="Mark all as read"
                    className="p-1 text-stone-500 hover:text-stone-800 text-xs flex items-center gap-1 rounded hover:bg-stone-200/60 transition"
                  >
                    <CheckCheck className="w-3.5 h-3.5" />
                  </button>
                )}
                <button
                  onClick={() => setIsOpen(false)}
                  className="text-stone-400 hover:text-stone-600 p-1 rounded-md"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Filter Tabs & Quick Snooze Bar */}
            <div className="px-4 py-2 bg-stone-100/60 border-b border-stone-200/80 flex items-center justify-between text-xs">
              <div className="flex gap-2">
                <button
                  onClick={() => setFilter('all')}
                  className={`px-2 py-0.5 rounded-md text-[11px] font-semibold transition ${
                    filter === 'all' ? 'bg-white shadow-xs text-stone-900' : 'text-stone-500 hover:text-stone-800'
                  }`}
                >
                  All ({notifications.length})
                </button>
                <button
                  onClick={() => setFilter('unread')}
                  className={`px-2 py-0.5 rounded-md text-[11px] font-semibold transition ${
                    filter === 'unread' ? 'bg-white shadow-xs text-stone-900' : 'text-stone-500 hover:text-stone-800'
                  }`}
                >
                  Unread ({unreadCount})
                </button>
              </div>

              {/* Snooze drop trigger */}
              <div className="flex items-center gap-1 text-[11px] text-stone-500">
                <Clock className="w-3 h-3 text-stone-400" />
                <span>Snooze:</span>
                <button
                  onClick={() => handleSnooze(1)}
                  className="px-1.5 py-0.5 rounded bg-white hover:bg-stone-200 text-stone-700 text-[10px] font-medium border border-stone-200"
                >
                  1h
                </button>
                <button
                  onClick={() => handleSnooze(4)}
                  className="px-1.5 py-0.5 rounded bg-white hover:bg-stone-200 text-stone-700 text-[10px] font-medium border border-stone-200"
                >
                  4h
                </button>
              </div>
            </div>

            {snoozeActive && (
              <div className="bg-emerald-50 px-4 py-1.5 text-center text-xs text-emerald-800 border-b border-emerald-200">
                Notifications snoozed successfully!
              </div>
            )}

            {/* Notification List */}
            <div className="max-h-80 overflow-y-auto divide-y divide-stone-100">
              {displayedNotifications.length === 0 ? (
                <div className="py-10 text-center text-xs text-stone-400">
                  {filter === 'unread' ? 'No unread notifications.' : 'No notifications yet.'}
                </div>
              ) : (
                displayedNotifications.map((n) => (
                  <div
                    key={n.id}
                    onClick={() => handleNotificationClick(n)}
                    className={`p-3.5 hover:bg-stone-50 transition-colors cursor-pointer flex items-start gap-3 ${
                      !n.isRead ? 'bg-amber-50/40' : ''
                    }`}
                  >
                    <div
                      className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${
                        !n.isRead ? 'bg-amber-600' : 'bg-stone-300'
                      }`}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1">
                        <h4 className="text-xs font-bold text-stone-900 truncate">
                          {n.title}
                        </h4>
                        {!n.isRead && (
                          <button
                            onClick={(e) => markAsRead(n.id, e)}
                            title="Mark as read"
                            className="text-stone-400 hover:text-stone-600 p-0.5"
                          >
                            <Check className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                      <p className="text-[11px] text-stone-600 mt-0.5 leading-relaxed">
                        {n.body}
                      </p>
                      {n.deepLink && (
                        <div className="flex items-center gap-1 mt-1 text-[10px] font-semibold text-[#881337]">
                          <span>Open link</span>
                          <ExternalLink className="w-2.5 h-2.5" />
                        </div>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
};
