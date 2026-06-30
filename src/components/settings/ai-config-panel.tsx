'use client';

import { useEffect, useState, useCallback } from 'react';
import { toast } from 'sonner';
import { Loader2, Bot, Sparkles, Save } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/hooks/use-auth';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Switch } from '@/components/ui/switch';

const STATIC_FREE_MODELS = [
  { id: 'meta-llama/llama-3.3-70b-instruct:free', name: 'Llama 3.3 70B (Free)' },
  { id: 'meta-llama/llama-3.2-3b-instruct:free', name: 'Llama 3.2 3B (Free)' },
  { id: 'nousresearch/hermes-3-llama-3.1-405b:free', name: 'Hermes 3 405B (Free)' },
  { id: 'qwen/qwen3-coder:free', name: 'Qwen3 Coder (Free)' },
  { id: 'openai/gpt-oss-120b:free', name: 'GPT OSS 120B (Free)' },
  { id: 'google/gemma-4-31b-it:free', name: 'Gemma 4 31B (Free)' },
  { id: 'google/gemma-4-26b-a4b-it:free', name: 'Gemma 4 26B A4B (Free)' },
];

const STATIC_PAID_MODELS = [
  { id: 'anthropic/claude-3.5-sonnet', name: 'Claude 3.5 Sonnet' },
  { id: 'openai/gpt-4o', name: 'GPT-4o' },
  { id: 'openai/gpt-4o-mini', name: 'GPT-4o Mini' },
  { id: 'google/gemini-2.5-flash', name: 'Gemini 2.5 Flash' },
  { id: 'deepseek/deepseek-chat', name: 'DeepSeek V3' },
];

export function AIConfigPanel() {
  const { user, accountId, loading: authLoading, profileLoading } = useAuth();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [configId, setConfigId] = useState<string | null>(null);
  
  const [aiEnabled, setAiEnabled] = useState(true);
  const [onlyFreeModels, setOnlyFreeModels] = useState(true);
  const [aiModel, setAiModel] = useState('meta-llama/llama-3.3-70b-instruct:free');
  const [aiSystemPrompt, setAiSystemPrompt] = useState('');

  
  const [freeModels, setFreeModels] = useState<{ id: string; name: string }[]>(STATIC_FREE_MODELS);

  const loadDynamicModels = useCallback(async () => {
    try {
      const res = await fetch('/api/ai/models')
      if (res.ok) {
        const data = await res.json()
        if (data.models && Array.isArray(data.models) && data.models.length > 0) {
          setFreeModels(data.models)
        }
      }
    } catch (err) {
      console.error('Failed to load dynamic free models:', err)
    }
  }, []);

  useEffect(() => {
    Promise.resolve().then(() => {
      loadDynamicModels()
    })
  }, [loadDynamicModels]);

  const fetchConfig = useCallback(async (_acctId: string) => {
    setLoading(true);
    try {
      const res = await fetch('/api/ai/config')
      if (!res.ok) {
        throw new Error('Failed to load AI config from API')
      }
      const data = await res.json()

      if (data.config) {
        setConfigId(data.config.id);
        setAiEnabled(data.config.ai_enabled ?? true);
        setOnlyFreeModels(data.config.ai_only_free_models ?? true);
        setAiModel(data.config.ai_model ?? 'google/gemini-2.5-flash:free');
        setAiSystemPrompt(data.config.ai_system_prompt ?? '');

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
      })
      return;
    }
    Promise.resolve().then(() => {
      fetchConfig(accountId);
    })
  }, [authLoading, profileLoading, user, accountId, fetchConfig]);

  // Handle saving AI config
  async function handleSave() {
    if (!configId || !accountId) {
      toast.error('Connect your WhatsApp number in WhatsApp Config tab before updating AI settings.');
      return;
    }

    try {
      setSaving(true);

      // Enforce free model if setting is enabled
      let resolvedModel = aiModel;
      if (onlyFreeModels && !resolvedModel.endsWith(':free')) {
        resolvedModel = 'meta-llama/llama-3.3-70b-instruct:free';
        setAiModel(resolvedModel);
      }

      const payload: Record<string, unknown> = {
        ai_enabled: aiEnabled,
        ai_only_free_models: onlyFreeModels,
        ai_model: resolvedModel,
        ai_system_prompt: aiSystemPrompt.trim() || null,
      }



      const res = await fetch('/api/ai/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errData = await res.json()
        throw new Error(errData.error || 'Failed to save configuration')
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

  if (loading) {
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

  // Model list based on only free toggle
  const availableModels = onlyFreeModels ? freeModels : [...freeModels, ...STATIC_PAID_MODELS];

  return (
    <div className="space-y-6 mt-4 max-w-4xl">
      <Card className="bg-slate-900 border-slate-700">
        <CardHeader>
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-primary/10">
              <Bot className="size-5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-white">AI Auto-Reply Configuration</CardTitle>
              <CardDescription className="text-slate-400">
                Manage how the AI agent automatically replies to incoming WhatsApp messages.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Global Enable Toggle */}
          <div className="flex items-center justify-between p-4 rounded-xl bg-slate-800/40 border border-slate-800">
            <div className="space-y-0.5 pr-4">
              <Label className="text-sm font-semibold text-white">Enable AI globally</Label>
              <p className="text-xs text-slate-400">
                Toggle auto-replies on/off across all customer conversations. Individual conversations must still have their AI toggle enabled inside the Inbox to reply automatically.
              </p>
            </div>
            <Switch
              checked={aiEnabled}
              onCheckedChange={setAiEnabled}
              className="bg-slate-800"
            />
          </div>

          {/* Enforce Free Tier Toggle */}
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
              onCheckedChange={(checked) => {
                setOnlyFreeModels(checked);
                // Auto-adjust selected model if switching to free-only and currently selecting a paid model
                if (checked && !aiModel.endsWith(':free')) {
                  setAiModel('meta-llama/llama-3.3-70b-instruct:free');
                }
              }}
              className="bg-slate-800"
            />
          </div>



          {/* Model Selection Dropdown */}
          <div className="space-y-2">
            <Label className="text-slate-300">Default AI Model</Label>
            <select
              value={aiModel}
              onChange={(e) => setAiModel(e.target.value)}
              className="w-full h-10 px-3 rounded-lg border border-slate-700 bg-slate-800 text-sm text-white focus:outline-none focus:border-primary/50"
            >
              {availableModels.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
            <p className="text-xs text-slate-500">
              Select which LLM model from OpenRouter should act as the default responder.
            </p>
          </div>

          {/* Global System Prompt Textarea */}
          <div className="space-y-2">
            <Label className="text-slate-300">Global AI System Prompt</Label>
            <textarea
              value={aiSystemPrompt}
              onChange={(e) => setAiSystemPrompt(e.target.value)}
              placeholder="e.g. You are a helpful sales assistant..."
              rows={8}
              className="w-full p-4 rounded-xl border border-slate-700 bg-slate-800 text-sm text-white focus:outline-none focus:border-primary/50 resize-none font-sans"
            />
            <p className="text-xs text-slate-500 leading-relaxed">
              Describe the assistant&apos;s behavior, style, responsibilities, and boundaries. Leaving this blank defaults to the professional CRM assistant template.
            </p>
          </div>

          {/* Save Button */}
          <div className="pt-2">
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
                  Save AI Configuration
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
