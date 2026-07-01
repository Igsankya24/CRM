'use client';

import { useEffect, useState, useCallback } from 'react';
import { toast } from 'sonner';
import { Loader2, Key, Save, Eye, EyeOff, AlertTriangle, ShieldCheck } from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import { usePermissions } from '@/hooks/use-permissions';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

const MASKED_TOKEN = '••••••••••••••••';

export function CredentialsPanel() {
  const { user, accountId, loading: authLoading, profileLoading } = useAuth();
  const { isSuperAdmin, loading: permissionLoading } = usePermissions();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [configId, setConfigId] = useState<string | null>(null);

  const [appSecret, setAppSecret] = useState('');
  const [showAppSecret, setShowAppSecret] = useState(false);
  const [appSecretEdited, setAppSecretEdited] = useState(false);

  const [openrouterApiKey, setOpenrouterApiKey] = useState('');
  const [showApiKey, setShowApiKey] = useState(false);
  const [apiKeyEdited, setApiKeyEdited] = useState(false);

  const [geminiApiKey, setGeminiApiKey] = useState('');
  const [showGeminiKey, setShowGeminiKey] = useState(false);
  const [geminiKeyEdited, setGeminiKeyEdited] = useState(false);

  const [testingConnection, setTestingConnection] = useState(false);
  const [testResult, setTestResult] = useState<{
    success: boolean;
    latency?: number;
    errorType?: string;
    errorMessage?: string;
  } | null>(null);

  const fetchCredentials = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/settings/credentials');
      if (!res.ok) {
        throw new Error('Failed to load credentials from API');
      }
      const data = await res.json();

      if (data.config) {
        setConfigId(data.config.id);
        setAppSecret(data.config.app_secret || '');
        setOpenrouterApiKey(data.config.openrouter_api_key || '');
        setGeminiApiKey(data.config.gemini_api_key || '');
        setAppSecretEdited(false);
        setApiKeyEdited(false);
        setGeminiKeyEdited(false);
      } else {
        setConfigId(null);
      }
    } catch (err) {
      console.error('fetchCredentials error:', err);
      toast.error('Failed to load API keys and credentials');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (authLoading || profileLoading) return;
    if (!user || !accountId) {
      Promise.resolve().then(() => setLoading(false));
      return;
    }
    Promise.resolve().then(() => {
      fetchCredentials();
    });
  }, [authLoading, profileLoading, user, accountId, fetchCredentials]);

  async function handleSave() {
    if (!accountId) {
      toast.error('Account ID not found. Please log in.');
      return;
    }

    try {
      setSaving(true);

      const payload: Record<string, unknown> = {};

      if (appSecretEdited) {
        payload.app_secret = appSecret.trim();
      }
      if (apiKeyEdited) {
        payload.openrouter_api_key = openrouterApiKey.trim();
      }
      if (geminiKeyEdited) {
        payload.gemini_api_key = geminiApiKey.trim();
      }

      if (Object.keys(payload).length === 0) {
        toast.info('No changes to save');
        setSaving(false);
        return;
      }

      const res = await fetch('/api/settings/credentials', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'Failed to save credentials');
      }

      toast.success('Credentials updated successfully');
      await fetchCredentials();
    } catch (err) {
      console.error('Save credentials error:', err);
      toast.error(err instanceof Error ? err.message : 'An unexpected error occurred while saving.');
    } finally {
      setSaving(false);
    }
  }

  async function testGeminiConnection() {
    try {
      setTestingConnection(true);
      setTestResult(null);

      const keyToTest = geminiApiKey.trim();
      if (!keyToTest) {
        toast.error('Please enter a Gemini API Key to test');
        return;
      }

      const res = await fetch('/api/settings/credentials/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: keyToTest }),
      });

      if (!res.ok) {
        throw new Error('Server error testing connection');
      }

      const data = await res.json();
      if (data.connected) {
        setTestResult({ success: true, latency: data.latency });
        toast.success(`Connected! Latency: ${data.latency}ms`);
      } else {
        setTestResult({
          success: false,
          errorType: data.errorType,
          errorMessage: data.errorMessage,
        });
        toast.error(`Connection failed: ${data.errorMessage || 'Unknown error'}`);
      }
    } catch (err) {
      console.error('Test connection error:', err);
      setTestResult({
        success: false,
        errorMessage: err instanceof Error ? err.message : String(err),
      });
      toast.error('Failed to test connection');
    } finally {
      setTestingConnection(false);
    }
  }

  if (loading || permissionLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="size-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6 mt-4 max-w-4xl">
      <Card className="bg-slate-900 border-slate-700">
        <CardHeader>
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-primary/10">
              <Key className="size-5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-white">API Keys & Secrets</CardTitle>
              <CardDescription className="text-slate-400">
                Manage your credentials for external APIs and integrations in one secure place.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Meta App Secret */}
          <div className="space-y-2">
            <Label className="text-slate-300">Meta App Secret</Label>
            <div className="relative">
              <Input
                type={showAppSecret ? 'text' : 'password'}
                value={appSecret}
                onChange={(e) => {
                  setAppSecret(e.target.value);
                  setAppSecretEdited(true);
                }}
                onFocus={() => {
                  if (appSecret === MASKED_TOKEN) {
                    setAppSecret('');
                    setAppSecretEdited(true);
                  }
                }}
                placeholder="Enter your Meta App Secret"
                className="w-full h-10 pl-3 pr-10 rounded-lg border border-slate-700 bg-slate-800 text-sm text-white focus:outline-none focus:border-primary/50 font-sans"
              />
              <button
                type="button"
                onClick={() => setShowAppSecret(!showAppSecret)}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-white"
              >
                {showAppSecret ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </button>
            </div>
            <p className="text-xs text-slate-500">
              Used to verify WhatsApp webhook signatures. Located in Meta App Dashboard under App Settings &gt; Basic.
            </p>
          </div>

          {/* OpenRouter API Key */}
          <div className="space-y-2">
            <Label className="text-slate-300">OpenRouter API Key</Label>
            <div className="relative">
              <Input
                type={showApiKey ? 'text' : 'password'}
                value={openrouterApiKey}
                onChange={(e) => {
                  setOpenrouterApiKey(e.target.value);
                  setApiKeyEdited(true);
                }}
                onFocus={() => {
                  if (openrouterApiKey === MASKED_TOKEN) {
                    setOpenrouterApiKey('');
                    setApiKeyEdited(true);
                  }
                }}
                placeholder="sk-or-v1-..."
                className="w-full h-10 pl-3 pr-10 rounded-lg border border-slate-700 bg-slate-800 text-sm text-white focus:outline-none focus:border-primary/50 font-sans"
              />
              <button
                type="button"
                onClick={() => setShowApiKey(!showApiKey)}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-white"
              >
                {showApiKey ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </button>
            </div>
            <p className="text-xs text-slate-500">
              Used to query AI models. Leave blank to fallback to the server default OpenRouter key.
            </p>
          </div>

          {/* Google Gemini API Key */}
          <div className="space-y-2 pt-2 border-t border-slate-800">
            <div className="flex items-center justify-between">
              <Label className="text-slate-300 flex items-center gap-1.5">
                Google Gemini API Key
                {!isSuperAdmin && <span className="text-xs text-amber-500 font-normal flex items-center gap-1"><AlertTriangle className="size-3" /> View Only</span>}
              </Label>
              {isSuperAdmin && (
                <span className="text-xs text-emerald-400 flex items-center gap-1 font-normal">
                  <ShieldCheck className="size-3" /> Authorized Editor
                </span>
              )}
            </div>
            <div className="relative">
              <Input
                type={showGeminiKey ? 'text' : 'password'}
                value={geminiApiKey}
                onChange={(e) => {
                  if (!isSuperAdmin) return;
                  setGeminiApiKey(e.target.value);
                  setGeminiKeyEdited(true);
                }}
                onFocus={() => {
                  if (!isSuperAdmin) return;
                  if (geminiApiKey === MASKED_TOKEN) {
                    setGeminiApiKey('');
                    setGeminiKeyEdited(true);
                  }
                }}
                disabled={!isSuperAdmin}
                placeholder={isSuperAdmin ? "Enter Google Gemini API Key" : "Access restricted to Super Admins"}
                className={`w-full h-10 pl-3 pr-10 rounded-lg border border-slate-700 bg-slate-800 text-sm text-white focus:outline-none focus:border-primary/50 font-sans ${!isSuperAdmin ? 'opacity-60 cursor-not-allowed' : ''}`}
              />
              <button
                type="button"
                onClick={() => setShowGeminiKey(!showGeminiKey)}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-white"
              >
                {showGeminiKey ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </button>
            </div>
            <p className="text-xs text-slate-500">
              Used to query Google Gemini API directly. Allows leveraging native Google models with direct credentials.
            </p>

            {/* Test Connection Button */}
            <div className="flex items-center gap-3 pt-1">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={testGeminiConnection}
                disabled={testingConnection || !geminiApiKey}
                className="border-slate-700 bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white text-xs h-8"
              >
                {testingConnection ? (
                  <>
                    <Loader2 className="size-3 animate-spin mr-1.5" />
                    Testing...
                  </>
                ) : (
                  'Test Connection'
                )}
              </Button>
              {testResult && (
                <div className="text-xs">
                  {testResult.success ? (
                    <span className="text-emerald-400 flex items-center gap-1 font-medium">
                      ● Connected (Latency: {testResult.latency}ms)
                    </span>
                  ) : (
                    <span className="text-red-400 flex items-center gap-1 font-medium">
                      ● Failed: {testResult.errorMessage || 'Invalid API Key'}
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Save Button */}
          <div className="pt-4 border-t border-slate-800">
            <Button
              onClick={handleSave}
              disabled={saving}
              className="bg-primary hover:bg-primary/95 text-primary-foreground flex items-center gap-1.5"
            >
              {saving ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="size-4" />
                  Save Credentials
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
