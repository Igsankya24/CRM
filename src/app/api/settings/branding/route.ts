import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getAdminClient } from '@/lib/supabase/admin';

const ALLOWED_LOGO_TYPES = new Set(['image/png', 'image/jpeg', 'image/svg+xml', 'image/webp']);
const ALLOWED_FAVICON_TYPES = new Set(['image/png', 'image/x-icon', 'image/vnd.microsoft.icon', 'image/svg+xml']);
const MAX_FILE_SIZE = 2 * 1024 * 1024; // 2MB

// Helper to check if a user is an Owner or Admin or has settings permission
async function checkPermissions(supabase: Awaited<ReturnType<typeof createClient>>, userId: string) {
  // First, check permission-based system
  const { data: hasPerm } = await supabase.rpc('has_permission', {
    p_module: 'settings',
    p_action: 'view',
  });
  if (hasPerm) return true;

  const { data: profile, error } = await supabase
    .from('profiles')
    .select('role, account_role')
    .eq('user_id', userId)
    .maybeSingle();

  if (error || !profile) return false;

  const isSuperAdmin = profile.role === 'Super Admin';
  const isAdminOrOwner = profile.account_role === 'owner' || profile.account_role === 'admin';

  return isSuperAdmin || isAdminOrOwner;
}

// Ensure storage bucket "branding" exists
async function ensureBrandingBucket(adminSupabase: ReturnType<typeof getAdminClient>) {
  try {
    const { data: buckets, error: listError } = await adminSupabase.storage.listBuckets();
    if (listError) throw listError;

    const hasBranding = buckets?.some((b) => b.name === 'branding');
    if (!hasBranding) {
      const { error: createError } = await adminSupabase.storage.createBucket('branding', {
        public: true,
        allowedMimeTypes: ['image/png', 'image/jpeg', 'image/svg+xml', 'image/webp', 'image/x-icon'],
        fileSizeLimit: MAX_FILE_SIZE,
      });
      if (createError) {
        console.warn('[api/settings/branding] Failed to create branding bucket:', createError.message);
      }
    }
  } catch (err) {
    console.error('[api/settings/branding] Error ensuring branding bucket:', err);
  }
}

/**
 * GET /api/settings/branding
 * Retrieves app branding settings and ensures storage is initialized.
 */
export async function GET() {
  try {
    const adminSupabase = getAdminClient();
    await ensureBrandingBucket(adminSupabase);

    // Retrieve settings
    const { data: settings, error } = await adminSupabase
      .from('app_settings')
      .select('*')
      .limit(1)
      .maybeSingle();

    if (error && error.code !== 'PGRST205') {
      console.error('[api/settings/branding GET] Database error:', error);
      return NextResponse.json({ error: 'Database error' }, { status: 500 });
    }

    return NextResponse.json({ settings: settings || null });
  } catch (error) {
    console.error('[api/settings/branding GET] Unexpected error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * POST /api/settings/branding
 * Saves settings, handling logo and favicon uploads.
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const hasPermission = await checkPermissions(supabase, user.id);
    if (!hasPermission) {
      return NextResponse.json({ error: 'Forbidden: Insufficient privileges' }, { status: 403 });
    }

    const formData = await request.formData();
    const appName = (formData.get('appName') as string | null)?.trim();
    const logoFile = formData.get('logo') as File | null;
    const faviconFile = formData.get('favicon') as File | null;
    const removeLogo = formData.get('removeLogo') === 'true';
    const removeFavicon = formData.get('removeFavicon') === 'true';

    if (!appName) {
      return NextResponse.json({ error: 'Application Name is required.' }, { status: 400 });
    }
    if (appName.length > 50) {
      return NextResponse.json({ error: 'Application Name cannot exceed 50 characters.' }, { status: 400 });
    }

    const adminSupabase = getAdminClient();
    await ensureBrandingBucket(adminSupabase);

    // Fetch existing settings
    const { data: existing, error: fetchError } = await adminSupabase
      .from('app_settings')
      .select('*')
      .limit(1)
      .maybeSingle();

    if (fetchError && fetchError.code !== 'PGRST205') {
      console.error('[api/settings/branding POST] Fetch error:', fetchError);
      return NextResponse.json({ error: 'Database error' }, { status: 500 });
    }

    let logoUrl = existing?.logo_url || null;
    let faviconUrl = existing?.favicon_url || null;

    // Handle logo removal/upload
    if (removeLogo) {
      logoUrl = null;
    } else if (logoFile && logoFile.size > 0) {
      if (!ALLOWED_LOGO_TYPES.has(logoFile.type)) {
        return NextResponse.json({ error: 'Unsupported logo format. PNG, JPG, SVG, and WebP are supported.' }, { status: 400 });
      }
      if (logoFile.size > MAX_FILE_SIZE) {
        return NextResponse.json({ error: 'Logo size exceeds 2 MB.' }, { status: 400 });
      }

      const ext = logoFile.name.split('.').pop() || 'png';
      const path = `logo/logo-${Date.now()}.${ext}`;

      const { error: uploadError } = await adminSupabase.storage
        .from('branding')
        .upload(path, logoFile, {
          cacheControl: '3600',
          upsert: true,
          contentType: logoFile.type,
        });

      if (uploadError) {
        console.error('[api/settings/branding POST] Logo upload error:', uploadError);
        return NextResponse.json({ error: 'Logo upload failed.' }, { status: 500 });
      }

      const { data: { publicUrl } } = adminSupabase.storage.from('branding').getPublicUrl(path);
      logoUrl = publicUrl;
    }

    // Handle favicon removal/upload
    if (removeFavicon) {
      faviconUrl = null;
    } else if (faviconFile && faviconFile.size > 0) {
      // Allow image/x-icon, image/png, image/svg+xml, image/vnd.microsoft.icon
      if (!ALLOWED_FAVICON_TYPES.has(faviconFile.type)) {
        return NextResponse.json({ error: 'Unsupported favicon format. PNG, ICO, and SVG are supported.' }, { status: 400 });
      }
      if (faviconFile.size > MAX_FILE_SIZE) {
        return NextResponse.json({ error: 'Favicon size exceeds 2 MB.' }, { status: 400 });
      }

      const ext = faviconFile.name.split('.').pop() || 'png';
      const path = `logo/favicon-${Date.now()}.${ext}`;

      const { error: uploadError } = await adminSupabase.storage
        .from('branding')
        .upload(path, faviconFile, {
          cacheControl: '3600',
          upsert: true,
          contentType: faviconFile.type,
        });

      if (uploadError) {
        console.error('[api/settings/branding POST] Favicon upload error:', uploadError);
        return NextResponse.json({ error: 'Favicon upload failed.' }, { status: 500 });
      }

      const { data: { publicUrl } } = adminSupabase.storage.from('branding').getPublicUrl(path);
      faviconUrl = publicUrl;
    }

    const updateData = {
      app_name: appName,
      logo_url: logoUrl,
      favicon_url: faviconUrl,
      updated_at: new Date().toISOString(),
    };

    if (existing) {
      const { error: updateError } = await adminSupabase
        .from('app_settings')
        .update(updateData)
        .eq('id', existing.id);

      if (updateError) {
        console.error('[api/settings/branding POST] Update error:', updateError);
        return NextResponse.json({ error: 'Failed to update branding settings.' }, { status: 500 });
      }
    } else {
      const { error: insertError } = await adminSupabase
        .from('app_settings')
        .insert(updateData);

      if (insertError) {
        console.error('[api/settings/branding POST] Insert error:', insertError);
        return NextResponse.json({ error: 'Failed to insert branding settings.' }, { status: 500 });
      }
    }

    return NextResponse.json({ success: true, settings: updateData });
  } catch (error) {
    console.error('[api/settings/branding POST] Unexpected error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
