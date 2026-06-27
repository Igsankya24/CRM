'use client';

import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { ShieldCheck, ShieldAlert, Loader2, Key } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';

export function TwoFactorCard() {
  const [enabled, setEnabled] = useState(false);
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState('');
  const [verifying, setVerifying] = useState(false);

  useEffect(() => {
    try {
      const stored = localStorage.getItem('wacrm.mfa-enabled');
      if (stored === 'true') {
        Promise.resolve().then(() => {
          setEnabled(true);
        });
      }
    } catch {}
  }, []);

  const handleToggle = () => {
    if (enabled) {
      // Disable
      setEnabled(false);
      localStorage.setItem('wacrm.mfa-enabled', 'false');
      toast.success('Two-factor authentication has been disabled.');
    } else {
      // Open setup dialog
      setOpen(true);
    }
  };

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (code.length < 6) {
      toast.error('Please enter a valid 6-digit code.');
      return;
    }

    setVerifying(true);
    // Simulate API delay
    await new Promise((resolve) => setTimeout(resolve, 1000));
    setVerifying(false);

    setEnabled(true);
    localStorage.setItem('wacrm.mfa-enabled', 'true');
    setOpen(false);
    setCode('');
    toast.success('Two-factor authentication enabled successfully!');
  };

  return (
    <>
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-foreground">
            <Key className="size-4 text-primary" />
            Two-factor Authentication
          </CardTitle>
          <CardDescription className="text-muted-foreground">
            Require a verification code from your mobile authenticator app when signing in.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between p-4 rounded-lg border border-border bg-muted/20">
            <div className="flex items-center gap-3">
              {enabled ? (
                <div className="p-2 rounded-full bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
                  <ShieldCheck className="size-5" />
                </div>
              ) : (
                <div className="p-2 rounded-full bg-amber-500/10 text-amber-500 border border-amber-500/20">
                  <ShieldAlert className="size-5" />
                </div>
              )}
              <div>
                <p className="text-sm font-semibold text-foreground">
                  Status: {enabled ? 'Enabled' : 'Disabled'}
                </p>
                <p className="text-xs text-muted-foreground">
                  {enabled
                    ? 'Your account is secured with 2FA.'
                    : 'We highly recommend turning on 2FA for account safety.'}
                </p>
              </div>
            </div>
            <Button
              type="button"
              variant={enabled ? 'outline' : 'default'}
              onClick={handleToggle}
            >
              {enabled ? 'Disable 2FA' : 'Set up 2FA'}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md bg-slate-900 border-slate-800 text-white">
          <DialogHeader>
            <DialogTitle className="text-white">Set up Two-factor Authentication</DialogTitle>
            <DialogDescription className="text-slate-400">
              Scan the QR code below using Google Authenticator, Authy, or 1Password.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleVerify} className="space-y-6">
            <div className="flex flex-col items-center justify-center gap-4 py-4">
              {/* Styled Mock QR Code */}
              <div className="p-3 bg-white rounded-xl shadow-lg border border-slate-800">
                <div className="w-36 h-36 flex flex-col justify-between bg-[url('data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%22100%22 height=%22100%22 viewBox=%220 0 100 100%22><path fill=%22black%22 d=%22M0,0h40v40H0V0z M10,10v20h20V10H10z M60,0h40v40H60V0z M70,10v20h20V10H70z M0,60h40v40H0V60z M10,70v20h20V70H10z M45,45h10v10H45V45z M70,60h10v10H70V60z M80,70h10v15H80V70z M60,80h10v20H60V80z M85,85h15v15H85V85z M45,70h10v20H45V70z%22/></svg>')] bg-center bg-no-repeat bg-contain" />
              </div>
              <div className="text-center">
                <p className="text-xs text-slate-400 font-mono select-all">
                  Secret Key: WACRM2FASECRETKEY1234
                </p>
                <p className="text-[10px] text-slate-500 mt-1">
                  If you cannot scan, manually enter this key into your app.
                </p>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="mfa-code" className="text-slate-200">
                Verification Code
              </Label>
              <Input
                id="mfa-code"
                type="text"
                pattern="[0-9]*"
                inputMode="numeric"
                maxLength={6}
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                placeholder="123456"
                className="bg-slate-950 border-slate-800 text-white placeholder-slate-600 focus:border-primary focus:ring-1 focus:ring-primary text-center tracking-widest text-lg font-semibold"
                disabled={verifying}
                required
              />
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="ghost"
                onClick={() => setOpen(false)}
                disabled={verifying}
                className="text-slate-400 hover:text-white"
              >
                Cancel
              </Button>
              <Button type="submit" disabled={verifying || code.length < 6}>
                {verifying ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    Verifying…
                  </>
                ) : (
                  'Verify and Activate'
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
