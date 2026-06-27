'use client';

import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { Shield, Lock, Clock, Plus, Trash2, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';

export function SecuritySettings() {
  const [mfaEnforced, setMfaEnforced] = useState(false);
  const [strictPassword, setStrictPassword] = useState(true);
  const [sessionTimeout, setSessionTimeout] = useState('12h');
  const [ipRanges, setIpRanges] = useState<string[]>([]);
  const [newIp, setNewIp] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    try {
      const stored = localStorage.getItem('wacrm.security-pref');
      if (stored) {
        const parsed = JSON.parse(stored);
        Promise.resolve().then(() => {
          setMfaEnforced(parsed.mfaEnforced ?? false);
          setStrictPassword(parsed.strictPassword ?? true);
          setSessionTimeout(parsed.sessionTimeout ?? '12h');
          setIpRanges(parsed.ipRanges ?? []);
        });
      }
    } catch {}
  }, []);

  const saveSettings = async (updatedFields: Record<string, unknown>) => {
    const next = {
      mfaEnforced,
      strictPassword,
      sessionTimeout,
      ipRanges,
      ...updatedFields,
    };
    try {
      localStorage.setItem('wacrm.security-pref', JSON.stringify(next));
    } catch {}
  };

  const handleAddIp = () => {
    if (!newIp.trim()) return;
    const nextList = [...ipRanges, newIp.trim()];
    setIpRanges(nextList);
    setNewIp('');
    saveSettings({ ipRanges: nextList });
    toast.success('IP Range added.');
  };

  const handleRemoveIp = (idx: number) => {
    const nextList = ipRanges.filter((_, i) => i !== idx);
    setIpRanges(nextList);
    saveSettings({ ipRanges: nextList });
    toast.success('IP Range removed.');
  };

  const handleSaveAll = async () => {
    setSaving(true);
    await new Promise((resolve) => setTimeout(resolve, 800));
    setSaving(false);
    toast.success('Security settings saved successfully.');
  };

  return (
    <Card className="bg-card border-border">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-foreground">
          <Shield className="size-4 text-primary" />
          Organization Security Settings
        </CardTitle>
        <CardDescription className="text-muted-foreground">
          Configure security baselines, access controls, and session limits for all members of this organization.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Authentication Policies */}
        <div className="space-y-4">
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-2 border-b border-border pb-2">
            <Lock className="size-4 text-muted-foreground" />
            Authentication Policies
          </h3>
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label className="text-sm text-foreground">Enforce Multi-Factor Authentication (MFA)</Label>
              <p className="text-xs text-muted-foreground">Force all team members to set up and use Two-factor Authentication before accessing workspace data.</p>
            </div>
            <Switch
              checked={mfaEnforced}
              onCheckedChange={(val) => {
                setMfaEnforced(val);
                saveSettings({ mfaEnforced: val });
              }}
            />
          </div>
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label className="text-sm text-foreground">Strict Password Rules</Label>
              <p className="text-xs text-muted-foreground">Require user passwords to have a minimum length of 10 characters and contain letters, numbers, and symbols.</p>
            </div>
            <Switch
              checked={strictPassword}
              onCheckedChange={(val) => {
                setStrictPassword(val);
                saveSettings({ strictPassword: val });
              }}
            />
          </div>
        </div>

        {/* Session Inactivity Limits */}
        <div className="space-y-4 pt-4">
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-2 border-b border-border pb-2">
            <Clock className="size-4 text-muted-foreground" />
            Session Constraints
          </h3>
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label className="text-sm text-foreground">Inactivity Timeout Limit</Label>
              <p className="text-xs text-muted-foreground">Automatically sign out team members after a specific period of keyboard and mouse inactivity.</p>
            </div>
            <select
              value={sessionTimeout}
              onChange={(e) => {
                setSessionTimeout(e.target.value);
                saveSettings({ sessionTimeout: e.target.value });
              }}
              className="flex h-9 rounded-md border border-input bg-background px-3 py-1 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 w-36"
            >
              <option value="15m" className="bg-popover text-popover-foreground">15 Minutes</option>
              <option value="30m" className="bg-popover text-popover-foreground">30 Minutes</option>
              <option value="1h" className="bg-popover text-popover-foreground">1 Hour</option>
              <option value="12h" className="bg-popover text-popover-foreground">12 Hours</option>
              <option value="24h" className="bg-popover text-popover-foreground">24 Hours</option>
              <option value="never" className="bg-popover text-popover-foreground">Never</option>
            </select>
          </div>
        </div>

        {/* IP Restriction */}
        <div className="space-y-4 pt-4">
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-2 border-b border-border pb-2">
            <Shield className="size-4 text-muted-foreground" />
            IP Restrictions (Allowlist)
          </h3>
          <p className="text-xs text-muted-foreground">Only allow access to the platform from designated office IP addresses. Leave empty to allow logins from anywhere.</p>
          
          <div className="flex gap-2">
            <Input
              value={newIp}
              onChange={(e) => setNewIp(e.target.value)}
              placeholder="e.g. 192.168.1.1 or 203.0.113.0/24"
              className="max-w-xs text-xs"
            />
            <Button type="button" variant="outline" onClick={handleAddIp}>
              <Plus className="size-4 mr-1" /> Add IP
            </Button>
          </div>

          {ipRanges.length > 0 && (
            <div className="border border-border rounded-lg p-2 bg-muted/10 max-w-md space-y-1">
              {ipRanges.map((ip, idx) => (
                <div key={idx} className="flex justify-between items-center text-xs font-mono px-2 py-1 rounded bg-muted/30">
                  <span className="text-foreground">{ip}</span>
                  <button
                    type="button"
                    onClick={() => handleRemoveIp(idx)}
                    className="text-muted-foreground hover:text-destructive transition-colors"
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex justify-end pt-4 border-t border-border">
          <Button onClick={handleSaveAll} disabled={saving}>
            {saving ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                Saving Config…
              </>
            ) : (
              'Save Security Config'
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
