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
import { OrdersView } from './views/OrdersView';
import { TrashView } from './views/TrashView';
import { SettingsView } from './views/SettingsView';
import { AssistantView } from './views/AssistantView';

const MainAppContent: React.FC = () => {
  const { isConfigured, user, loading } = useAuth();
  const [currentModule, setCurrentModule] = useState<ActiveModule>('dashboard');

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
      {currentModule === 'dashboard' && <DashboardView onNavigate={setCurrentModule} />}
      {currentModule === 'customers' && <CustomersView />}
      {currentModule === 'tasks' && <TasksView />}
      {currentModule === 'planning' && <PlanningView />}
      {currentModule === 'orders' && <OrdersView />}
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

