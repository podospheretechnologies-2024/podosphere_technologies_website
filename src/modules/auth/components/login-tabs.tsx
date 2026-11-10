'use client';

import { useState } from 'react';
import { SegmentedControl } from '@/shared/components/ui/segmented-control';
import { AuthForm } from './auth-form';
import { ClientLoginForm } from './client-login-form';

type LoginTab = 'workspace' | 'client';

export function LoginTabs() {
  const [tab, setTab] = useState<LoginTab>('workspace');

  return (
    <div className="space-y-6">
      <SegmentedControl
        label="Login type"
        options={[
          { value: 'workspace', label: 'Workspace' },
          { value: 'client', label: 'Client login' },
        ]}
        value={tab}
        onChange={setTab}
      />

      {tab === 'workspace' ? (
        <>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Welcome back</h1>
            <p className="text-muted-foreground mt-1 text-sm">Log in to your Podo Social workspace.</p>
          </div>
          <AuthForm mode="login" />
        </>
      ) : (
        <>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Client portal</h1>
            <p className="text-muted-foreground mt-1 text-sm">
              Log in with the email and password your agency gave you.
            </p>
          </div>
          <ClientLoginForm />
        </>
      )}
    </div>
  );
}
