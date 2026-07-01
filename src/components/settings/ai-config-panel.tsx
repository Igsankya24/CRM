'use client';

import { useEffect, useState, useCallback } from 'react';
import { toast } from 'sonner';
import {
  Loader2,
  Bot,
  Sparkles,
  Save,
  RefreshCw,
  Play,
  CheckCircle2,
  XCircle,
  AlertCircle,
  ShieldCheck,
} from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import { usePermissions } from '@/hooks/use-permissions';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Switch } from '@/components/ui/switch';

const STATIC_FREE_MODELS = [
  { id: 'meta-llama/llama-3.3-70b-instruct:free', name: 'Llama 3.3 70B (Free)', provider: 'meta-llama', usable: true, pricing: { prompt: 0, completion: 0 } },
  { id: 'meta-llama/llama-3.2-3b-instruct:free', name: 'Llama 3.2 3B (Free)', provider: 'meta-llama', usable: true, pricing: { prompt: 0, completion: 0 } },
  { id: 'nousresearch/hermes-3-llama-3.1-405b:free', name: 'Hermes 3 405B (Free)', provider: 'nousresearch', usable: true, pricing: { prompt: 0, completion: 0 } },
  { id: 'qwen/qwen3-coder:free', name: 'Qwen3 Coder (Free)', provider: 'qwen', usable: true, pricing: { prompt: 0, completion: 0 } },
  { id: 'openai/gpt-oss-120b:free', name: 'GPT OSS 120B (Free)', provider: 'openai', usable: true, pricing: { prompt: 0, completion: 0 } },
  { id: 'google/gemma-4-31b-it:free', name: 'Gemma 4 31B (Free)', provider: 'google', usable: true, pricing: { prompt: 0, completion: 0 } },
  { id: 'google/gemma-4-26b-a4b-it:free', name: 'Gemma 4 26B A4B (Free)', provider: 'google', usable: true, pricing: { prompt: 0, completion: 0 } },
];

const STATIC_GEMINI_MODELS = [
  { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash', provider: 'google', usable: true, pricing: { prompt: 0, completion: 0 } },
  { id: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro', provider: 'google', usable: true, pricing: { prompt: 0, completion: 0 } },
  { id: 'gemini-2.0-flash', name: 'Gemini 2.0 Flash', provider: 'google', usable: true, pricing: { prompt: 0, completion: 0 } },
];

export function AIConfigPanel() {
  const { user, accountId, loading: authLoading, profileLoading } = useAuth();
  const { isSuperAdmin, loading: permissionLoading } = usePermissions();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [configId, setConfigId] = useState<string | null>(null);

  const [aiEnabled, setAiEnabled] = useState(true);
  const [onlyFreeModels, setOnlyFreeModels] = useState(true);
  const [aiProvider, setAiProvider] = useState('gemini');
  const [aiModel, setAiModel] = useState('gemini-2.5-flash');
  const [aiSystemPrompt, setAiSystemPrompt] = useState('');

  // Fallover State
  const [aiFallbackEnabled, setAiFallbackEnabled] = useState(true);
  const [aiModelStatus, setAiModelStatus] = useState('healthy');
  const [aiLastError, setAiLastError] = useState<string | null>(null);
  const [aiLastSuccessAt, setAiLastSuccessAt] = useState<string | null>(null);
  const [availableModelsList, setAvailableModelsList] = useState<any[]>([]);

  // Action State
  const [refreshingModels, setRefreshingModels] = useState(false);
  const [testingModel, setTestingModel] = useState(false);
  const [testResult, setTestResult] = useState<any | null>(null);

  const loadDynamicModels = useCallback(async () => {
    try {
      const res = await fetch(`/api/ai/models?provider=${aiProvider}`);
      if (res.ok) {
        const data = await res.json();
        if (data.models && Array.isArray(data.models) && data.models.length > 0) {
          setAvailableModelsList(data.models);
        } else {
          setAvailableModelsList([]);
        }
      }
    } catch (err) {
      console.error('Failed to load dynamic models:', err);
    }
  }, [aiProvider]);

  useEffect(() => {
    if (authLoading || profileLoading || permissionLoading) return;
    if (!user || !accountId) return;
    Promise.resolve().then(() => {
      loadDynamicModels();
    });
  }, [authLoading, profileLoading, permissionLoading, user, accountId, loadDynamicModels]);

  const fetchConfig = useCallback(async (_acctId: string) => {
    setLoading(true);
    try {
      const res = await fetch('/api/ai/config');
      if (!res.ok) {
        throw new Error('Failed to load AI config from API');
      }
      const data = await res.json();

      if (data.config) {
        setConfigId(data.config.id);
        setAiEnabled(data.config.ai_enabled ?? true);
        setOnlyFreeModels(data.config.ai_only_free_models ?? true);
        setAiProvider(data.config.ai_provider ?? 'gemini');
        setAiModel(data.config.ai_model ?? 'gemini-2.5-flash');
        setAiSystemPrompt(data.config.ai_system_prompt ?? '');
        setAiFallbackEnabled(data.config.ai_fallback_enabled ?? true);
        setAiModelStatus(data.config.ai_model_status ?? 'healthy');
        setAiLastError(data.config.ai_last_error ?? null);
        setAiLastSuccessAt(data.config.ai_last_success_at ?? null);
        if (data.config.ai_available_models && Array.isArray(data.config.ai_available_models.models)) {
          setAvailableModelsList(data.config.ai_available_models.models);
        }
      } else {
        setConfigId(null);
      }
    } catch (err) {
      console.error('fetchConfig error in AI Config:', err);
      toast.error('Failed to load AI configuration');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (authLoading || profileLoading) return;
    if (!user || !accountId) {
      Promise.resolve().then(() => {
        setLoading(false);
      });
      return;
    }
    Promise.resolve().then(() => {
      fetchConfig(accountId);
    });
  }, [authLoading, profileLoading, user, accountId, fetchConfig]);

  const handleRefreshModels = async () => {
    setRefreshingModels(true);
    try {
      const res = await fetch(`/api/ai/models?provider=${aiProvider}`, { method: 'POST' });
      if (!res.ok) throw new Error('Failed to refresh models list');
      const data = await res.json();
      if (data.models) {
        setAvailableModelsList(data.models);
        toast.success(`Available models list for ${aiProvider === 'gemini' ? 'Gemini' : 'OpenRouter'} refreshed dynamically`);
      }
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || 'Failed to refresh models');
    } finally {
      setRefreshingModels(false);
    }
  };

  const handleTestModel = async () => {
    setTestingModel(true);
    setTestResult(null);
    try {
      const res = await fetch('/api/ai/models/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: aiModel }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to run connection test');
      }
      const data = await res.json();
      setTestResult(data);
      if (data.connected) {
        toast.success(`Test success! Connection latency: ${data.latency}ms`);
      } else {
        toast.error(`Test failed: ${data.errorMessage}`);
      }
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || 'Failed to test connection');
      setTestResult({
        connected: false,
        failed: true,
        latency: 0,
        errorMessage: err.message || String(err),
      });
    } finally {
      setTestingModel(false);
    }
  };

  // Handle saving AI config
  async function handleSave() {
    if (!configId || !accountId) {
      toast.error('Connect your WhatsApp number in WhatsApp Config tab before updating AI settings.');
      return;
    }

    try {
      setSaving(true);

      const payload: Record<string, unknown> = {
        ai_enabled: aiEnabled,
        ai_only_free_models: onlyFreeModels,
        ai_provider: aiProvider,
        ai_model: aiModel,
        ai_system_prompt: aiSystemPrompt.trim() || null,
        ai_fallback_enabled: aiFallbackEnabled,
      };

      const res = await fetch('/api/ai/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'Failed to save configuration');
      }

      toast.success('AI settings updated successfully');
      if (accountId) await fetchConfig(accountId);
    } catch (err) {
      console.error('Save AI Config error:', err);
      toast.error(err instanceof Error ? err.message : 'An unexpected error occurred while saving.');
    } finally {
      setSaving(false);
    }
  }

  if (loading || permissionLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="size-6 animate-spin text-primary" />
      </div>
    );
  }

  if (!configId) {
    return (
      <div className="mt-4">
        <Alert className="bg-slate-900 border-slate-700">
          <Bot className="size-5 text-primary shrink-0" />
          <div className="ml-2">
            <AlertTitle className="text-white">WhatsApp Integration Required</AlertTitle>
            <AlertDescription className="text-slate-400">
              Please connect and verify your WhatsApp credentials in the{' '}
              <strong className="text-white">WhatsApp Config</strong> tab before configuring the AI agent.
            </AlertDescription>
          </div>
        </Alert>
      </div>
    );
  }

  // Determine fallback defaults when available models list is empty
  const defaultStaticList = aiProvider === 'gemini' ? STATIC_GEMINI_MODELS : STATIC_FREE_MODELS;
  const modelSelectionOptions = availableModelsList.length > 0 ? availableModelsList : defaultStaticList;

  // Filter dropdown choices
  const dropdownModels = onlyFreeModels && aiProvider === 'openrouter'
    ? modelSelectionOptions.filter((m: any) => m.usable && (m.id.endsWith(':free') || (m.pricing?.prompt === 0 && m.pricing?.completion === 0)))
    : modelSelectionOptions.filter((m: any) => m.usable);

  const selectedModelMeta = modelSelectionOptions.find((m: any) => m.id === aiModel) || {
    id: aiModel,
    provider: aiModel.split('/')[0] || (aiProvider === 'gemini' ? 'google' : 'openrouter'),
    status: 'healthy',
  };

  return (
    <div className="space-y-6 mt-4 max-w-4xl">
      {/* AI Failover Status Panel */}
      <Card className="bg-slate-900 border-slate-700">
        <CardHeader>
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-emerald-500/10">
              <Sparkles className="size-5 text-emerald-400" />
            </div>
            <div>
              <CardTitle className="text-white text-base">Model Health & Integration Status</CardTitle>
              <CardDescription className="text-slate-400 text-xs">
                Real-time connection status and metrics for the primary responder.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 rounded-xl bg-slate-800/40 border border-slate-800 space-y-1">
              <span className="text-xs text-slate-400 block font-medium">RESPONDER MODEL</span>
              <span className="text-sm font-semibold text-white block truncate">{aiModel.split('/').pop()}</span>
              <span className="text-[10px] text-slate-500 font-mono block truncate">{aiModel}</span>
            </div>
            <div className="p-4 rounded-xl bg-slate-800/40 border border-slate-800 space-y-1">
              <span className="text-xs text-slate-400 block font-medium">PROVIDER</span>
              <span className="text-sm font-semibold text-white block capitalize">{selectedModelMeta.provider}</span>
              <span className="text-[10px] text-slate-500 block">
                {aiProvider === 'gemini' ? 'Direct Google Gemini API' : 'OpenRouter Integration'}
              </span>
            </div>
            <div className="p-4 rounded-xl bg-slate-800/40 border border-slate-800 space-y-1">
              <span className="text-xs text-slate-400 block font-medium">HEALTH STATUS</span>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className={`size-2.5 rounded-full animate-pulse ${
                  aiModelStatus === 'healthy' ? 'bg-emerald-500' :
                  aiModelStatus === 'degraded' ? 'bg-amber-500' : 'bg-red-500'
                }`} />
                <span className={`text-sm font-semibold capitalize ${
                  aiModelStatus === 'healthy' ? 'text-emerald-400' :
                  aiModelStatus === 'degraded' ? 'text-amber-400' : 'text-red-400'
                }`}>
                  {aiModelStatus}
                </span>
              </div>
              <span className="text-[10px] text-slate-500 block truncate">
                {aiLastSuccessAt ? `Last active: ${new Date(aiLastSuccessAt).toLocaleTimeString()}` : 'No successful calls yet'}
              </span>
            </div>
          </div>

          {/* Last Error Display */}
          {aiLastError && (
            <Alert className="bg-red-500/10 border-red-500/20 text-red-200">
              <AlertCircle className="size-4 text-red-400 shrink-0" />
              <div className="ml-2">
                <AlertTitle className="text-red-400 text-xs font-semibold">Last Outage Report</AlertTitle>
                <AlertDescription className="text-slate-300 text-xs mt-0.5 font-mono break-all">
                  {aiLastError}
                </AlertDescription>
              </div>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Configuration Panel */}
      <Card className="bg-slate-900 border-slate-700">
        <CardHeader>
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-primary/10">
              <Bot className="size-5 text-primary" />
            </div>
            <div className="flex-1">
              <div className="flex items-center justify-between">
                <CardTitle className="text-white">AI Auto-Reply Configuration</CardTitle>
                {isSuperAdmin ? (
                  <span className="text-xs text-emerald-400 flex items-center gap-1 font-medium bg-emerald-500/5 px-2 py-0.5 rounded border border-emerald-500/10">
                    <ShieldCheck className="size-3.5" /> Super Admin Editor
                  </span>
                ) : (
                  <span className="text-xs text-amber-500 flex items-center gap-1 font-medium bg-amber-500/5 px-2 py-0.5 rounded border border-amber-500/10">
                    <AlertCircle className="size-3.5" /> View Only Mode
                  </span>
                )}
              </div>
              <CardDescription className="text-slate-400">
                Manage how the AI agent automatically replies to incoming WhatsApp messages.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Permission warning alert */}
          {!isSuperAdmin && (
            <Alert className="bg-amber-500/10 border-amber-500/20 text-amber-200">
              <AlertCircle className="size-4 text-amber-400 shrink-0" />
              <div className="ml-2">
                <AlertTitle className="text-amber-400 text-xs font-semibold">Access Restricted</AlertTitle>
                <AlertDescription className="text-slate-300 text-xs mt-0.5">
                  Only users with the role <strong>Super Admin</strong> can save configuration changes, choose AI provider, or modify models.
                </AlertDescription>
              </div>
            </Alert>
          )}

          {/* Global Enable Toggle */}
          <div className="flex items-center justify-between p-4 rounded-xl bg-slate-800/40 border border-slate-800">
            <div className="space-y-0.5 pr-4">
              <Label className="text-sm font-semibold text-white">Enable AI globally</Label>
              <p className="text-xs text-slate-400">
                Toggle auto-replies on/off across all customer conversations.
              </p>
            </div>
            <Switch
              checked={aiEnabled}
              onCheckedChange={setAiEnabled}
              disabled={!isSuperAdmin}
              className="bg-slate-800"
            />
          </div>

          {/* AI Provider selector */}
          <div className="space-y-2">
            <Label className="text-slate-300">AI LLM Provider</Label>
            <select
              value={aiProvider}
              onChange={(e) => {
                const newProvider = e.target.value;
                setAiProvider(newProvider);
                // Reset model default to match provider
                if (newProvider === 'gemini') {
                  setAiModel('gemini-2.5-flash');
                } else {
                  setAiModel('google/gemini-2.5-flash:free');
                }
              }}
              disabled={!isSuperAdmin}
              className="w-full h-10 px-3 rounded-lg border border-slate-700 bg-slate-800 text-sm text-white focus:outline-none focus:border-primary/50 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              <option value="openrouter">OpenRouter AI (Full Catalog)</option>
              <option value="gemini">Google Gemini API (Direct Connection)</option>
            </select>
            <p className="text-xs text-slate-500">
              Choose between using OpenRouter gateway or connecting directly to Google Gemini.
            </p>
          </div>

          {/* Enforce Free Tier Toggle */}
          {aiProvider === 'openrouter' && (
            <div className="flex items-center justify-between p-4 rounded-xl bg-slate-800/40 border border-slate-800">
              <div className="space-y-0.5 pr-4">
                <Label className="text-sm font-semibold text-white flex items-center gap-1">
                  <Sparkles className="size-3.5 text-amber-400" />
                  Only run using OpenRouter free models
                </Label>
                <p className="text-xs text-slate-400">
                  Restrict LLM execution to free tier models on OpenRouter to prevent usage charges.
                </p>
              </div>
              <Switch
                checked={onlyFreeModels}
                disabled={!isSuperAdmin}
                onCheckedChange={(checked) => {
                  setOnlyFreeModels(checked);
                  if (checked && !aiModel.endsWith(':free')) {
                    const firstFree = dropdownModels[0]?.id || 'meta-llama/llama-3.3-70b-instruct:free';
                    setAiModel(firstFree);
                  }
                }}
                className="bg-slate-800"
              />
            </div>
          )}

          {/* Automatic Fallover Toggle */}
          <div className="flex items-center justify-between p-4 rounded-xl bg-slate-800/40 border border-slate-800">
            <div className="space-y-0.5 pr-4">
              <Label className="text-sm font-semibold text-white flex items-center gap-1">
                Enable automatic failover fallback
              </Label>
              <p className="text-xs text-slate-400">
                Automatically try other compatible models (including cross-provider) if the preferred model suffers outages.
              </p>
            </div>
            <Switch
              checked={aiFallbackEnabled}
              onCheckedChange={setAiFallbackEnabled}
              disabled={!isSuperAdmin}
              className="bg-slate-800"
            />
          </div>

          {/* Model Selection Dropdown & Testing */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-slate-300">Default AI Model (Preferred)</Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleRefreshModels}
                disabled={refreshingModels || !isSuperAdmin}
                className="h-8 px-2 bg-slate-800 border-slate-700 hover:bg-slate-700 text-slate-300 gap-1 disabled:opacity-50"
              >
                <RefreshCw className={`size-3 ${refreshingModels ? 'animate-spin' : ''}`} />
                Refresh list
              </Button>
            </div>
            <div className="flex gap-2">
              <select
                value={aiModel}
                onChange={(e) => setAiModel(e.target.value)}
                disabled={!isSuperAdmin}
                className="flex-1 h-10 px-3 rounded-lg border border-slate-700 bg-slate-800 text-sm text-white focus:outline-none focus:border-primary/50 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {dropdownModels.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name || m.id}
                  </option>
                ))}
              </select>
              <Button
                type="button"
                variant="outline"
                onClick={handleTestModel}
                disabled={testingModel || !isSuperAdmin}
                className="h-10 px-3 bg-slate-800 border-slate-700 hover:bg-slate-700 text-slate-300 gap-1 shrink-0 disabled:opacity-50"
              >
                {testingModel ? <Loader2 className="size-4 animate-spin" /> : <Play className="size-4 text-emerald-400 fill-emerald-400/20" />}
                Test Model
              </Button>
            </div>
            <p className="text-xs text-slate-500">
              Select which LLM model from the chosen provider should act as the default responder.
            </p>
          </div>

          {/* Test connection report */}
          {testResult && (
            <div className={`p-4 rounded-xl border ${
              testResult.connected
                ? 'bg-emerald-500/5 border-emerald-500/20 text-emerald-400'
                : 'bg-red-500/5 border-red-500/20 text-red-400'
            }`}>
              <div className="flex items-center gap-2">
                {testResult.connected ? (
                  <CheckCircle2 className="size-4 text-emerald-400" />
                ) : (
                  <XCircle className="size-4 text-red-400" />
                )}
                <span className="font-semibold text-sm">
                  {testResult.connected ? 'Connected successfully' : 'Connection failed'}
                </span>
              </div>
              <div className="mt-2 text-xs font-mono space-y-1 text-slate-300">
                <div>Model: <span className="text-white">{testResult.modelName}</span></div>
                {testResult.connected && <div>Latency: <span className="text-white">{testResult.latency}ms</span></div>}
                {!testResult.connected && <div className="text-red-300 mt-1 break-words">{testResult.errorMessage}</div>}
              </div>
            </div>
          )}

          {/* Global System Prompt Textarea */}
          <div className="space-y-2">
            <Label className="text-slate-300">Global AI System Prompt</Label>
            <textarea
              value={aiSystemPrompt}
              onChange={(e) => setAiSystemPrompt(e.target.value)}
              disabled={!isSuperAdmin}
              placeholder="e.g. You are a helpful sales assistant..."
              rows={8}
              className="w-full p-4 rounded-xl border border-slate-700 bg-slate-800 text-sm text-white focus:outline-none focus:border-primary/50 resize-none font-sans disabled:opacity-60 disabled:cursor-not-allowed"
            />
            <p className="text-xs text-slate-500 leading-relaxed">
              Describe the assistant&apos;s behavior, style, responsibilities, and boundaries.
            </p>
          </div>

          {/* Save Button */}
          <div className="pt-2">
            <Button
              onClick={handleSave}
              disabled={saving || !isSuperAdmin}
              className="bg-primary hover:bg-primary/95 text-primary-foreground flex items-center gap-1.5 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="size-4" />
                  Save AI Configuration
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Available Models Dynamic Table */}
      {availableModelsList.length > 0 && (
        <Card className="bg-slate-900 border-slate-700">
          <CardHeader>
            <CardTitle className="text-white text-base">Dynamically Fetched Models</CardTitle>
            <CardDescription className="text-slate-400 text-xs">
              List of available {aiProvider === 'gemini' ? 'Gemini' : 'OpenRouter'} models accessible under the configured account.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto max-h-96 overflow-y-auto border border-slate-800 rounded-xl">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-slate-800/80 text-slate-400 font-semibold sticky top-0 border-b border-slate-800">
                  <tr>
                    <th className="p-3">Model ID</th>
                    <th className="p-3">Provider</th>
                    <th className="p-3 text-right">Context</th>
                    <th className="p-3 text-right">Pricing (Prompt/Comp)</th>
                    <th className="p-3 text-center">Usable</th>
                    <th className="p-3 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/40 text-slate-300">
                  {availableModelsList.map((m: any) => {
                    const isFree = m.pricing?.prompt === 0 && m.pricing?.completion === 0 || m.id.endsWith(':free');
                    return (
                      <tr key={m.id} className="hover:bg-slate-800/20">
                        <td className="p-3 font-mono text-[11px] truncate max-w-xs">{m.id}</td>
                        <td className="p-3 capitalize">{m.provider}</td>
                        <td className="p-3 text-right font-mono">{m.context_length ? m.context_length.toLocaleString() : '-'}</td>
                        <td className="p-3 text-right font-mono">
                          {isFree ? (
                            <span className="text-emerald-400 font-semibold">Free</span>
                          ) : (
                            <span>
                              ${Number(m.pricing?.prompt || 0).toFixed(6)} / ${Number(m.pricing?.completion || 0).toFixed(6)}
                            </span>
                          )}
                        </td>
                        <td className="p-3 text-center">
                          <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] ${
                            m.usable
                              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                              : 'bg-red-500/10 text-red-400 border border-red-500/20'
                          }`}>
                            {m.usable ? 'Yes' : 'No'}
                          </span>
                        </td>
                        <td className="p-3 text-center">
                          <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] ${
                            m.status === 'healthy'
                              ? 'bg-slate-800 text-slate-300 border border-slate-700'
                              : 'bg-red-500/10 text-red-400 border border-red-500/20'
                          }`}>
                            {m.status}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
