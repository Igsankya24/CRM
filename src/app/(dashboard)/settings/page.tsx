'use client';

import { useSearchParams } from 'next/navigation';
import { usePermissions } from '@/hooks/use-permissions';
import { useCan } from '@/hooks/use-can';

import { WhatsAppConfig } from '@/components/settings/whatsapp-config';
import { TemplateManager } from '@/components/settings/template-manager';
import { TagManager } from '@/components/settings/tag-manager';
import { AppearancePanel } from '@/components/settings/appearance-panel';
import { DealsSettings } from '@/components/settings/deals-settings';
import { CustomFieldsSettings } from '@/components/settings/custom-fields-settings';
import { AIConfigPanel } from '@/components/settings/ai-config-panel';
import { CredentialsPanel } from '@/components/settings/credentials-panel';
import { B2BIntegrationsPanel } from '@/components/settings/b2b-integrations-panel';
import { UserManagementPanel } from '@/components/settings/user-management-panel';
import { NotificationsSettings } from '@/components/settings/notifications-settings';
import { SecuritySettings } from '@/components/settings/security-settings';
import { CompanySettingsPanel } from '@/components/settings/company-settings-panel';
import { ProductKnowledgePanel } from '@/components/settings/product-knowledge-panel';
import { FaqKnowledgePanel } from '@/components/settings/faq-knowledge-panel';

const VALID_TABS = [
  'general',
  'users',
  'roles',
  'permissions',
  'notifications',
  'whatsapp',
  'integrations',
  'ai',
  'b2b',
  'company',
  'products',
  'faq',
  'appearance',
  'security',
  'audit-logs',
] as const;

type ValidTab = (typeof VALID_TABS)[number];

function isValidTab(v: string | null): v is ValidTab {
  return !!v && (VALID_TABS as readonly string[]).includes(v);
}

export default function SettingsPage() {
  const searchParams = useSearchParams();
  const { hasPermission, isSuperAdmin } = usePermissions();
  const canEditSettings = useCan('edit-settings');
  const canViewUserManagement = hasPermission('user_management', 'view');

  const rawTab = searchParams.get('tab');
  const activeTab: ValidTab = isValidTab(rawTab) ? rawTab : 'general';

  const isAuthorized = () => {
    if (isSuperAdmin) return true;

    // Admin is only allowed to access users and notifications tabs
    if (activeTab === 'users') {
      return canViewUserManagement;
    }
    if (activeTab === 'notifications') {
      return true;
    }

    return false;
  };

  if (!isAuthorized()) {
    return (
      <div className="flex h-[calc(100vh-8rem)] items-center justify-center">
        <div className="w-full max-w-md border border-border bg-card p-6 rounded-2xl text-center space-y-4">
          <h2 className="text-xl font-bold text-foreground">Access Denied</h2>
          <p className="text-sm text-muted-foreground">
            You do not have the required permissions to view this settings tab. Please contact your system administrator.
          </p>
        </div>
      </div>
    );
  }

  const getTitle = () => {
    switch (activeTab) {
      case 'general':
        return 'General Settings';
      case 'users':
        return 'User Management';
      case 'roles':
        return 'Roles Configuration';
      case 'permissions':
        return 'Permissions Matrix';
      case 'notifications':
        return 'Notifications Config';
      case 'whatsapp':
        return 'WhatsApp® Settings';
      case 'integrations':
        return 'Third-party Integrations';
      case 'ai':
        return 'AI Assistant Configuration';
      case 'b2b':
        return 'B2B Marketplace Config';
      case 'company':
        return 'Company Profile';
      case 'products':
        return 'Product Knowledge Base';
      case 'faq':
        return 'FAQ Knowledge Base';
      case 'appearance':
        return 'Appearance & Branding';
      case 'security':
        return 'Workspace Security';
      case 'audit-logs':
        return 'System Audit Logs';
      default:
        return 'Settings';
    }
  };

  const getDescription = () => {
    switch (activeTab) {
      case 'general':
        return 'Configure deals, tag managers, and custom contact fields.';
      case 'users':
        return 'Add, modify, activate or disable system user accounts.';
      case 'roles':
        return 'Define and customize account security roles.';
      case 'permissions':
        return 'Map module privileges to defined access tiers.';
      case 'notifications':
        return 'Manage email digest, system pings, and notification settings.';
      case 'whatsapp':
        return 'Connect WhatsApp® accounts, sync templates, and manage numbers.';
      case 'integrations':
        return 'Configure global API keys and webhooks integrations.';
      case 'ai':
        return 'Set default language models, instructions, and prompt strategies.';
      case 'b2b':
        return 'Configure Indiamart, Tradeindia, and Exportersindia endpoints.';
      case 'company':
        return 'Set up company profile, contact info, and business policies for the AI assistant.';
      case 'products':
        return 'Manage your product catalog — pricing, specifications, and availability for AI responses.';
      case 'faq':
        return 'Add frequently asked questions so the AI can quickly answer common customer queries.';
      case 'appearance':
        return 'Customize system theme, accent colors, and dark/light settings.';
      case 'security':
        return 'Enforce organization-wide MFA, password criteria, and session timeouts.';
      case 'audit-logs':
        return 'View complete audit trails for administrative actions.';
      default:
        return 'Configure workspace settings.';
    }
  };

  return (
    <div className="space-y-6 pb-10">
      <div>
        <h1 className="text-2xl font-bold text-foreground">{getTitle()}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{getDescription()}</p>
      </div>

      <div className="mt-6">
        {activeTab === 'general' && (
          <div className="space-y-6">
            <DealsSettings />
            <CustomFieldsSettings />
            <TagManager />
          </div>
        )}

        {activeTab === 'users' && <UserManagementPanel defaultTab="users" />}

        {activeTab === 'roles' && <UserManagementPanel defaultTab="roles" />}

        {activeTab === 'permissions' && <UserManagementPanel defaultTab="roles" />}

        {activeTab === 'notifications' && <NotificationsSettings />}

        {activeTab === 'whatsapp' && (
          <div className="space-y-6">
            <WhatsAppConfig />
            <TemplateManager />
          </div>
        )}

        {activeTab === 'integrations' && <CredentialsPanel />}

        {activeTab === 'ai' && <AIConfigPanel />}

        {activeTab === 'b2b' && <B2BIntegrationsPanel />}

        {activeTab === 'company' && <CompanySettingsPanel />}

        {activeTab === 'products' && <ProductKnowledgePanel />}

        {activeTab === 'faq' && <FaqKnowledgePanel />}

        {activeTab === 'appearance' && <AppearancePanel />}

        {activeTab === 'security' && <SecuritySettings />}

        {activeTab === 'audit-logs' && <UserManagementPanel defaultTab="audit" />}
      </div>
    </div>
  );
}
