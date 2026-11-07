/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { LanguageProvider } from './context/LanguageContext';
import { FirebaseSetupGuide } from './components/FirebaseSetupGuide';
import { LoginScreen } from './components/LoginScreen';
import { AppShell } from './components/AppShell';
import { ActiveModule } from './types';
import { DashboardView } from './views/DashboardView';
import { CustomersView } from './views/CustomersView';
import { TasksView } from './views/TasksView';
import { PlanningView } from './views/PlanningView';
import { MetaAdsView } from './views/MetaAdsView';
import { OrdersView } from './views/OrdersView';
import { TrashView } from './views/TrashView';
import { SettingsView } from './views/SettingsView';
import { AssistantView } from './views/AssistantView';
import { AutomationRulesView } from './views/AutomationRulesView';

import { setupForegroundMessageListener, getFcmToken, syncDeviceWithServer, getNotificationPermissionState } from './lib/fcm';

const MainAppContent: React.FC = () => {
  const { isConfigured, user, loading } = useAuth();
  const [currentModule, setCurrentModule] = useState<ActiveModule>('dashboard');
  const [foregroundToast, setForegroundToast] = useState<{ title: string; body: string } | null>(null);

  React.useEffect(() => {
    if (!user) return;

    // 1. If permission is already granted, ensure token is refreshed and synced with server
    if (getNotificationPermissionState() === 'granted') {
      user.getIdToken().then(async (idToken) => {
        const token = await getFcmToken();
        await syncDeviceWithServer(idToken, token);
      }).catch(console.error);
    }

    // 2. Setup foreground listener (suppress OS notification, show friendly in-app toast)
    const unsubscribe = setupForegroundMessageListener((payload) => {
      const title = payload.notification?.title || payload.data?.title || 'Jaikrishna Industries';
      const body = payload.notification?.body || payload.data?.body || 'New alert received';
      setForegroundToast({ title, body });
      setTimeout(() => setForegroundToast(null), 5000);
    });

    // 3. Deep Link Hydration on Mount & Popstate
    const handleUrlRoute = () => {
      const searchParams = new URLSearchParams(window.location.search);
      const mod = searchParams.get('module') as ActiveModule | null;
      if (mod && ['dashboard', 'customers', 'tasks', 'planning', 'orders', 'automations', 'trash', 'settings', 'assistant'].includes(mod)) {
        setCurrentModule(mod);
      }
    };

    handleUrlRoute();
    window.addEventListener('popstate', handleUrlRoute);

    return () => {
      if (unsubscribe) unsubscribe();
      window.removeEventListener('popstate', handleUrlRoute);
    };
  }, [user]);

  // 1. Strict Firebase Configuration Guard
  if (!isConfigured) {
    return <FirebaseSetupGuide />;
  }

  // 2. Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-[#FAF8F5] flex flex-col items-center justify-center p-4">
        <div className="w-12 h-12 rounded-2xl bg-[#881337] flex items-center justify-center p-2 shadow-md animate-pulse">
          <img src="/icon.svg" alt="Jaikrishna Industries" className="w-full h-full object-contain" />
        </div>
        <div className="mt-4 text-xs font-semibold text-stone-700 tracking-wide font-display">
          Verifying Jaikrishna Industries Credentials...
        </div>
      </div>
    );
  }

  // 3. Unauthenticated state -> Show 3-member Login Screen
  if (!user) {
    return <LoginScreen />;
  }

  // 4. Authenticated & Authorized -> Render AppShell with active module
  return (
    <AppShell currentModule={currentModule} onNavigate={setCurrentModule}>
      {foregroundToast && (
        <div className="fixed top-4 right-4 z-50 max-w-sm bg-stone-900 text-white p-4 rounded-xl shadow-2xl border border-amber-500/30 flex items-start gap-3 animate-in fade-in slide-in-from-top-2">
          <div className="w-2 h-2 rounded-full bg-amber-400 mt-2 shrink-0 animate-ping" />
          <div className="flex-1">
            <h4 className="text-xs font-bold text-amber-300 font-display">{foregroundToast.title}</h4>
            <p className="text-xs text-stone-300 mt-0.5">{foregroundToast.body}</p>
          </div>
          <button
            onClick={() => setForegroundToast(null)}
            className="text-stone-400 hover:text-white text-xs p-1"
          >
            ✕
          </button>
        </div>
      )}
      {currentModule === 'dashboard' && <DashboardView onNavigate={setCurrentModule} />}
      {currentModule === 'customers' && <CustomersView />}
      {currentModule === 'tasks' && <TasksView />}
      {currentModule === 'planning' && <PlanningView />}
      {currentModule === 'meta_ads' && <MetaAdsView />}
      {currentModule === 'orders' && <OrdersView />}
      {currentModule === 'automations' && <AutomationRulesView />}
      {currentModule === 'trash' && <TrashView />}
      {currentModule === 'settings' && <SettingsView />}
      {currentModule === 'assistant' && <AssistantView />}
    </AppShell>
  );
};

import { AppProvider } from './context/AppContext';

export default function App() {
  return (
    <LanguageProvider>
      <AuthProvider>
        <AppProvider>
          <MainAppContent />
        </AppProvider>
      </AuthProvider>
    </LanguageProvider>
  );
}

