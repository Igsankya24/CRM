'use client';

import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { Bell, Mail, MessageSquare, AlertCircle, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';

export function NotificationsSettings() {
  const [preferences, setPreferences] = useState({
    emailNewLead: true,
    emailDailyReport: false,
    whatsappAlert: true,
    whatsappUnread: true,
    systemSound: false,
    systemDesktop: true,
  });

  const [saving, setSaving] = useState(false);

  useEffect(() => {
    try {
      const stored = localStorage.getItem('wacrm.notifications-pref');
      if (stored) {
        Promise.resolve().then(() => {
          setPreferences(JSON.parse(stored));
        });
      }
    } catch {}
  }, []);

  const handleChange = (key: keyof typeof preferences, val: boolean) => {
    const next = { ...preferences, [key]: val };
    setPreferences(next);
    try {
      localStorage.setItem('wacrm.notifications-pref', JSON.stringify(next));
    } catch {}
  };

  const handleSave = async () => {
    setSaving(true);
    // Simulate API delay
    await new Promise((resolve) => setTimeout(resolve, 800));
    setSaving(false);
    toast.success('Notification preferences saved successfully.');
  };

  return (
    <Card className="bg-card border-border">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-foreground">
          <Bell className="size-4 text-primary" />
          Notification Preferences
        </CardTitle>
        <CardDescription className="text-muted-foreground">
          Control how you receive notifications and alerts from the platform.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Email Alerts */}
        <div className="space-y-4">
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-2 border-b border-border pb-2">
            <Mail className="size-4 text-muted-foreground" />
            Email Notifications
          </h3>
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label className="text-sm text-foreground">New Lead Assignment</Label>
              <p className="text-xs text-muted-foreground">Receive an email immediately when a B2B or manual lead is assigned to you.</p>
            </div>
            <Switch
              checked={preferences.emailNewLead}
              onCheckedChange={(val) => handleChange('emailNewLead', val)}
            />
          </div>
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label className="text-sm text-foreground">Daily Activity Report</Label>
              <p className="text-xs text-muted-foreground">Receive a summary of conversations, leads, and conversion metrics every morning.</p>
            </div>
            <Switch
              checked={preferences.emailDailyReport}
              onCheckedChange={(val) => handleChange('emailDailyReport', val)}
            />
          </div>
        </div>

        {/* WhatsApp Alerts */}
        <div className="space-y-4 pt-4">
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-2 border-b border-border pb-2">
            <MessageSquare className="size-4 text-muted-foreground" />
            WhatsApp alerts
          </h3>
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label className="text-sm text-foreground">System Alerts via WhatsApp</Label>
              <p className="text-xs text-muted-foreground">Receive critical system alerts and integration reports directly on your WhatsApp number.</p>
            </div>
            <Switch
              checked={preferences.whatsappAlert}
              onCheckedChange={(val) => handleChange('whatsappAlert', val)}
            />
          </div>
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label className="text-sm text-foreground">Unread Messages Reminders</Label>
              <p className="text-xs text-muted-foreground">Receive WhatsApp ping alerts if you have unread inbox chats for over 15 minutes.</p>
            </div>
            <Switch
              checked={preferences.whatsappUnread}
              onCheckedChange={(val) => handleChange('whatsappUnread', val)}
            />
          </div>
        </div>

        {/* System & Push */}
        <div className="space-y-4 pt-4">
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-2 border-b border-border pb-2">
            <AlertCircle className="size-4 text-muted-foreground" />
            Browser Notifications
          </h3>
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label className="text-sm text-foreground">Desktop Push Notifications</Label>
              <p className="text-xs text-muted-foreground">Show native browser banner alerts when new chats arrive in your inbox.</p>
            </div>
            <Switch
              checked={preferences.systemDesktop}
              onCheckedChange={(val) => handleChange('systemDesktop', val)}
            />
          </div>
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label className="text-sm text-foreground">Incoming Message Sound</Label>
              <p className="text-xs text-muted-foreground">Play a soft alert sound when a new message is received in the active window.</p>
            </div>
            <Switch
              checked={preferences.systemSound}
              onCheckedChange={(val) => handleChange('systemSound', val)}
            />
          </div>
        </div>

        <div className="flex justify-end pt-4 border-t border-border">
          <Button onClick={handleSave} disabled={saving}>
            {saving ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                Saving Preferences…
              </>
            ) : (
              'Save Preferences'
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
