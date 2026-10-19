/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Jaikrishna Industries — Notification Center Dropdown & Bell
 * Integrates directly with the full NotificationCenter drawer and handles live badge updates.
 */

import React, { useState, useEffect } from 'react';
import { Bell } from 'lucide-react';
import { db } from '../../lib/firebase';
import { useAuth } from '../../context/AuthContext';
import { collection, query, where, limit, onSnapshot } from 'firebase/firestore';
import { AppNotification, ActiveModule } from '../../types';
import { NotificationCenter } from './NotificationCenter';

interface NotificationBellProps {
  onNavigate?: (module: ActiveModule, id?: string) => void;
}

export const NotificationBell: React.FC<NotificationBellProps> = ({ onNavigate }) => {
  const { user } = useAuth();
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  useEffect(() => {
    if (!db || !user?.email) return;

    const email = user.email.toLowerCase().trim();
    const q = query(
      collection(db, 'notifications'),
      where('recipientEmail', '==', email),
      limit(50)
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const unread = snapshot.docs.filter((d) => !d.data()?.isRead).length;
        setUnreadCount(unread);
      },
      (error) => {
        console.warn('Notifications bell count error:', error);
      }
    );

    return () => unsubscribe();
  }, [user]);

  return (
    <>
      <button
        onClick={() => setIsDrawerOpen(true)}
        className="relative p-2 text-stone-600 hover:text-stone-900 hover:bg-stone-100 rounded-lg transition-colors cursor-pointer"
        title="Open Notification Center"
        aria-label={`Notifications (${unreadCount} unread)`}
      >
        <Bell className="w-4 h-4 text-stone-700" />
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 flex h-4 w-4 items-center justify-center rounded-full bg-rose-600 text-[9px] font-bold text-white shadow-xs animate-pulse">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      <NotificationCenter
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        onNavigate={onNavigate}
      />
    </>
  );
};
