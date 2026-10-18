/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Jaikrishna Industries — Notification Bell & Dropdown
 * Displays real-time notifications for the current user with deep links.
 */

import React, { useState, useEffect } from 'react';
import { Bell, Check, ExternalLink, X } from 'lucide-react';
import { db } from '../../lib/firebase';
import { useAuth } from '../../context/AuthContext';
import {
  collection,
  query,
  where,
  orderBy,
  limit,
  onSnapshot,
  doc,
  updateDoc,
} from 'firebase/firestore';

interface AppNotification {
  id: string;
  recipientEmail: string;
  title: string;
  body: string;
  type: string;
  deepLink?: string;
  isRead: boolean;
  createdAt: any;
}

interface NotificationBellProps {
  onNavigate?: (module: any) => void;
}

export const NotificationBell: React.FC<NotificationBellProps> = ({ onNavigate }) => {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    if (!db || !user?.email) return;

    const email = user.email.toLowerCase();
    // In emulator / development, query without compound order to avoid index requirements
    const q = query(
      collection(db, 'notifications'),
      where('recipientEmail', '==', email),
      limit(25)
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const items = snapshot.docs.map((docSnap) => ({
          id: docSnap.id,
          ...docSnap.data(),
        })) as AppNotification[];
        // Sort in client
        items.sort((a, b) => {
          const tA = a.createdAt?.toMillis ? a.createdAt.toMillis() : new Date(a.createdAt || 0).getTime();
          const tB = b.createdAt?.toMillis ? b.createdAt.toMillis() : new Date(b.createdAt || 0).getTime();
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
      }
    }
  };

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
            <div className="px-4 py-3 bg-stone-50 border-b border-stone-200 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="font-bold text-xs text-stone-900 font-display">Notifications</span>
                {unreadCount > 0 && (
                  <span className="px-1.5 py-0.5 rounded-full bg-rose-100 text-rose-800 text-[10px] font-bold">
                    {unreadCount} new
                  </span>
                )}
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="text-stone-400 hover:text-stone-600 p-1 rounded-md"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="max-h-80 overflow-y-auto divide-y divide-stone-100">
              {notifications.length === 0 ? (
                <div className="py-8 text-center text-xs text-stone-400">
                  No notifications yet.
                </div>
              ) : (
                notifications.map((n) => (
                  <div
                    key={n.id}
                    onClick={() => handleNotificationClick(n)}
                    className={`p-3.5 hover:bg-stone-50 transition-colors cursor-pointer flex items-start gap-3 ${
                      !n.isRead ? 'bg-amber-50/40' : ''
                    }`}
                  >
                    <div className="w-2 h-2 rounded-full bg-amber-600 mt-1.5 shrink-0" />
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
