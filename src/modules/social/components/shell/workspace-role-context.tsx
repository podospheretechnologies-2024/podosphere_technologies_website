'use client';

import { createContext, useContext, type ReactNode } from 'react';

export type WorkspaceRole = 'OWNER' | 'ADMIN' | 'MEMBER';

interface WorkspaceRoleValue {
  role: WorkspaceRole;
  /** OWNER/ADMIN: connect channels, create/edit posts, full Ads. */
  canManageCampaigns: boolean;
}

const WorkspaceRoleContext = createContext<WorkspaceRoleValue>({
  role: 'MEMBER',
  canManageCampaigns: false,
});

export function WorkspaceRoleProvider({
  role,
  children,
}: {
  role: WorkspaceRole;
  children: ReactNode;
}) {
  const value: WorkspaceRoleValue = {
    role,
    canManageCampaigns: role === 'OWNER' || role === 'ADMIN',
  };
  return (
    <WorkspaceRoleContext.Provider value={value}>{children}</WorkspaceRoleContext.Provider>
  );
}

export function useWorkspaceRole(): WorkspaceRoleValue {
  return useContext(WorkspaceRoleContext);
}
