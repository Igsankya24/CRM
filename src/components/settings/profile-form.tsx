'use client';

import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { Loader2, Upload, Trash2, Mail, CircleAlert } from 'lucide-react';

import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/hooks/use-auth';
import { usePermissions } from '@/hooks/use-permissions';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from '@/components/ui/avatar';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';

const MAX_AVATAR_BYTES = 2 * 1024 * 1024;
const ALLOWED_MIME = new Set([
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/gif',
]);

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const DEPARTMENTS = [
  "Sales Department",
  "Accounts Department",
  "Production Department",
  "Management Department",
];

export function ProfileForm() {
  const { user, profile, accountRole, refreshProfile } = useAuth();
  const { isSuperAdmin } = usePermissions();
  const supabase = createClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [mobile, setMobile] = useState('');
  const [department, setDepartment] = useState('');
  const [designation, setDesignation] = useState('');
  const [pendingAvatar, setPendingAvatar] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [removeAvatar, setRemoveAvatar] = useState(false);
  const [saving, setSaving] = useState(false);
  const [emailChangePending, setEmailChangePending] = useState(false);
  const [lastLogin, setLastLogin] = useState<string | null>(null);

  // Seed form state once the profile loads.
  useEffect(() => {
    if (!profile) return;
    Promise.resolve().then(() => {
      setFullName(profile.full_name ?? '');
      setEmail(profile.email ?? '');
      setMobile(profile.mobile ?? '');
      setDepartment(profile.department ?? '');
      setDesignation(profile.designation ?? '');
    });
  }, [profile]);

  useEffect(() => {
    if (!user) return;
    const fetchLastLogin = async () => {
      try {
        const { data, error } = await supabase
          .from('user_login_logs')
          .select('login_time')
          .eq('user_id', user.id)
          .order('login_time', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (error) throw error;
        if (data?.login_time) {
          setLastLogin(data.login_time);
        }
      } catch (err) {
        console.error('Error fetching last login time:', err);
      }
    };
    fetchLastLogin();
  }, [user, supabase]);

  // Cleanup object URLs to avoid leaks.
  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  const currentAvatar =
    previewUrl ?? (!removeAvatar ? profile?.avatar_url ?? null : null);

  const initial = (fullName || profile?.full_name || profile?.email || 'U')
    .charAt(0)
    .toUpperCase();

  const onPickFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ''; // reset so the same file can be re-picked
    if (!file) return;

    if (!ALLOWED_MIME.has(file.type)) {
      toast.error('Unsupported image type', {
        description: 'Use PNG, JPG, WebP, or GIF.',
      });
      return;
    }
    if (file.size > MAX_AVATAR_BYTES) {
      toast.error('Image is too large', {
        description: 'Maximum 2 MB.',
      });
      return;
    }

    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPendingAvatar(file);
    setPreviewUrl(URL.createObjectURL(file));
    setRemoveAvatar(false);
  };

  const onRemoveAvatar = () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPendingAvatar(null);
    setPreviewUrl(null);
    setRemoveAvatar(true);
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !profile) return;

    const trimmedName = fullName.trim();
    if (!trimmedName) {
      toast.error('Display name is required');
      return;
    }
    const trimmedEmail = email.trim();
    if (!EMAIL_RE.test(trimmedEmail)) {
      toast.error('Enter a valid email address');
      return;
    }

    setSaving(true);
    try {
      let nextAvatarUrl: string | null = profile.avatar_url ?? null;

      // Upload a newly-staged image, if any.
      if (pendingAvatar) {
        const ext =
          pendingAvatar.name.split('.').pop()?.toLowerCase() || 'png';
        const path = `${user.id}/avatar-${Date.now()}.${ext}`;
        const { error: uploadError } = await supabase.storage
          .from('avatars')
          .upload(path, pendingAvatar, {
            cacheControl: '3600',
            upsert: true,
            contentType: pendingAvatar.type,
          });
        if (uploadError) {
          throw new Error(`Upload failed: ${uploadError.message}`);
        }
        const {
          data: { publicUrl },
        } = supabase.storage.from('avatars').getPublicUrl(path);
        nextAvatarUrl = publicUrl;
      } else if (removeAvatar) {
        nextAvatarUrl = null;
      }

      // Persist name + avatar + mobile + department + designation to profiles.
      const { error: updateError } = await supabase
        .from('profiles')
        .update({
          full_name: trimmedName,
          avatar_url: nextAvatarUrl,
          mobile: mobile.trim() || null,
          department: department.trim() || null,
          designation: designation.trim() || null,
        })
        .eq('user_id', user.id);
      if (updateError) {
        throw new Error(`Save failed: ${updateError.message}`);
      }

      // Email change goes through Supabase Auth, which emails a
      // confirmation to both the old and new addresses.
      let emailSent = false;
      if (trimmedEmail.toLowerCase() !== profile.email.toLowerCase()) {
        const { error: emailError } = await supabase.auth.updateUser({
          email: trimmedEmail,
        });
        if (emailError) {
          toast.success('Profile saved');
          toast.error(`Email change failed: ${emailError.message}`);
          setSaving(false);
          await refreshProfile();
          return;
        }
        emailSent = true;
      }

      setEmailChangePending(emailSent);
      setPendingAvatar(null);
      setPreviewUrl(null);
      setRemoveAvatar(false);
      await refreshProfile();

      toast.success(
        emailSent
          ? 'Profile saved — check your email to confirm the address change'
          : 'Profile saved',
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  const dirty =
    !!profile &&
    (fullName.trim() !== (profile.full_name ?? '') ||
      email.trim().toLowerCase() !== (profile.email ?? '').toLowerCase() ||
      mobile.trim() !== (profile.mobile ?? '') ||
      department.trim() !== (profile.department ?? '') ||
      designation.trim() !== (profile.designation ?? '') ||
      pendingAvatar !== null ||
      removeAvatar);

  const joined = user?.created_at
    ? new Date(user.created_at).toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })
    : '—';

  return (
    <Card className="bg-card border-border">
      <CardHeader>
        <CardTitle className="text-foreground">Personal Information</CardTitle>
        <CardDescription className="text-muted-foreground">
          Update your profile avatar, contact number, department, and display name.
        </CardDescription>
      </CardHeader>

      <CardContent>
        <form onSubmit={onSubmit} className="space-y-6">
          {/* Avatar row */}
          <div className="flex flex-wrap items-center gap-5">
            <Avatar size="lg" className="size-16">
              {currentAvatar ? (
                <AvatarImage src={currentAvatar} alt={fullName || 'Avatar'} />
              ) : null}
              <AvatarFallback className="bg-primary/10 text-base text-primary">
                {initial}
              </AvatarFallback>
            </Avatar>

            <div className="flex flex-wrap gap-2">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp,image/gif"
                className="hidden"
                onChange={onPickFile}
              />
              <Button
                type="button"
                variant="outline"
                onClick={() => fileInputRef.current?.click()}
                disabled={saving}
              >
                <Upload className="size-4" />
                {currentAvatar ? 'Change photo' : 'Upload photo'}
              </Button>
              {currentAvatar && (
                <Button
                  type="button"
                  variant="ghost"
                  onClick={onRemoveAvatar}
                  disabled={saving}
                  className="text-muted-foreground hover:text-foreground"
                >
                  <Trash2 className="size-4" />
                  Remove
                </Button>
              )}
              <p className="w-full text-xs text-muted-foreground">
                PNG, JPG, WebP, or GIF. Up to 2 MB.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            {/* Name */}
            <div className="space-y-2">
              <Label htmlFor="profile-full-name" className="text-foreground">
                Display name
              </Label>
              <Input
                id="profile-full-name"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Ada Lovelace"
                maxLength={120}
                disabled={saving}
                required
              />
            </div>

            {/* Email */}
            <div className="space-y-2">
              <Label htmlFor="profile-email" className="text-foreground">
                Email
              </Label>
              <Input
                id="profile-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={saving}
                required
              />
              {emailChangePending && (
                <p className="flex items-start gap-2 rounded-md border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-xs text-amber-300">
                  <Mail className="mt-0.5 size-3.5 shrink-0" />
                  <span>
                    Check the inbox for <strong>{profile?.email}</strong> and{' '}
                    <strong>{email}</strong> — both need to confirm before the
                    change takes effect.
                  </span>
                </p>
              )}
            </div>

            {/* Phone Number */}
            <div className="space-y-2">
              <Label htmlFor="profile-mobile" className="text-foreground">
                Phone number
              </Label>
              <Input
                id="profile-mobile"
                value={mobile}
                onChange={(e) => setMobile(e.target.value)}
                placeholder="+1 (555) 000-0000"
                disabled={saving}
              />
            </div>

            {/* Department */}
            <div className="space-y-2">
              <Label htmlFor="profile-department" className="text-foreground">
                Department
              </Label>
              <select
                id="profile-department"
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
                disabled={saving}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 text-foreground"
              >
                <option value="" className="bg-popover text-popover-foreground">Select Department</option>
                {DEPARTMENTS.map((dept) => (
                  <option key={dept} value={dept} className="bg-popover text-popover-foreground">
                    {dept}
                  </option>
                ))}
              </select>
            </div>

            {/* Designation */}
            <div className="space-y-2">
              <Label htmlFor="profile-designation" className="text-foreground">
                Designation
              </Label>
              <Input
                id="profile-designation"
                value={designation}
                onChange={(e) => setDesignation(e.target.value)}
                placeholder="Sales Associate"
                disabled={saving}
              />
            </div>
          </div>

          {/* Read-only block */}
          <div className="rounded-lg border border-border bg-muted/30 p-4">
            <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Account details
            </p>
            <dl className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-muted-foreground">Role</dt>
                <dd className="mt-1 flex items-center gap-2">
                  {isSuperAdmin ? (
                    <Badge className="border-purple-500/30 bg-purple-500/10 text-purple-400 font-semibold uppercase tracking-wider text-[10px]">
                      SUPER ADMIN
                    </Badge>
                  ) : (
                    <span className="font-mono text-foreground capitalize">
                      {accountRole ?? 'user'}
                    </span>
                  )}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Status</dt>
                <dd className="mt-1 flex items-center gap-2">
                  {profile?.is_active ? (
                    <Badge className="border-emerald-500/30 bg-emerald-500/10 text-emerald-400 font-semibold uppercase tracking-wider text-[10px]">
                      ACTIVE
                    </Badge>
                  ) : (
                    <Badge className="border-red-500/30 bg-red-500/10 text-red-400 font-semibold uppercase tracking-wider text-[10px]">
                      DISABLED
                    </Badge>
                  )}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Last Login</dt>
                <dd className="mt-1 text-foreground text-sm font-medium">
                  {lastLogin ? new Date(lastLogin).toLocaleString() : '—'}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Joined</dt>
                <dd className="mt-1 text-foreground text-sm">{joined}</dd>
              </div>
              <div className="sm:col-span-2">
                <dt className="text-muted-foreground">User ID</dt>
                <dd className="mt-0.5 break-all font-mono text-xs text-muted-foreground">
                  {user?.id ?? '—'}
                </dd>
              </div>
            </dl>
          </div>

          {!profile && (
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <CircleAlert className="size-4" />
              Loading your profile…
            </p>
          )}

          <div className="flex justify-end">
            <Button type="submit" disabled={saving || !dirty || !profile}>
              {saving ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Saving…
                </>
              ) : (
                'Save changes'
              )}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
