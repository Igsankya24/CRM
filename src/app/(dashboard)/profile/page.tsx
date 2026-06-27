'use client';

import { ProfileForm } from '@/components/settings/profile-form';
import { PasswordForm } from '@/components/settings/password-form';
import { TwoFactorCard } from '@/components/settings/two-factor-card';
import { SessionsCard } from '@/components/settings/sessions-card';
import { LoginHistoryCard } from '@/components/settings/login-history-card';

export default function ProfilePage() {
  return (
    <div className="space-y-6 max-w-4xl mx-auto pb-10">
      <div>
        <h1 className="text-2xl font-bold text-foreground">My Profile</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Manage your personal information, security preferences, and active sessions.
        </p>
      </div>

      <div className="space-y-6">
        <ProfileForm />
        <PasswordForm />
        <TwoFactorCard />
        <SessionsCard />
        <LoginHistoryCard />
      </div>
    </div>
  );
}
