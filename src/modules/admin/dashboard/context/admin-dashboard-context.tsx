"use client";

import { createContext, useContext, useMemo } from 'react';
import type { ReactNode } from 'react';
import type { AdminDashboardRepository } from '../domain/contracts/admin-dashboard-repository';
import { AdminDashboardEventBus } from '../domain/events/admin-dashboard-event-bus';
import { createAdminDashboardModule } from '../factories/admin-dashboard-factory';

export interface AdminDashboardDependencies {
  repository: AdminDashboardRepository;
  eventBus: AdminDashboardEventBus;
}

const AdminDashboardDependenciesContext = createContext<AdminDashboardDependencies | null>(null);

interface AdminDashboardProviderProps {
  children: ReactNode;
  repository?: AdminDashboardRepository;
  eventBus?: AdminDashboardEventBus;
}

export const AdminDashboardProvider = ({ children, repository, eventBus }: AdminDashboardProviderProps) => {
  const value = useMemo<AdminDashboardDependencies>(() => {
    if (repository && eventBus) {
      return { repository, eventBus };
    }
    const dashboardModule = createAdminDashboardModule();
    return {
      repository: repository ?? dashboardModule.repository,
      eventBus: eventBus ?? dashboardModule.eventBus,
    };
  }, [repository, eventBus]);

  return (
    <AdminDashboardDependenciesContext.Provider value={value}>
      {children}
    </AdminDashboardDependenciesContext.Provider>
  );
};

export const useAdminDashboardDependencies = (): AdminDashboardDependencies => {
  const context = useContext(AdminDashboardDependenciesContext);
  if (!context) {
    throw new Error('AdminDashboardDependenciesContext is not available. Wrap the tree with AdminDashboardProvider.');
  }
  return context;
};
