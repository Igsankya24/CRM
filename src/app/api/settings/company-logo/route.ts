import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getAdminClient } from '@/lib/supabase/admin';

const ALLOWED_LOGO_TYPES = new Set(['image/png', 'image/jpeg', 'image/jpg', 'image/svg+xml', 'image/webp']);
const MAX_FILE_SIZE = 2 * 1024 * 1024; // 2MB

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('account_id, role, account_role')
      .eq('user_id', user.id)
      .maybeSingle();

    if (!profile?.account_id) {
      return NextResponse.json({ error: 'Forbidden: No account tenancy' }, { status: 403 });
    }

    // Check permissions (Admin or Owner or Super Admin or company_settings.view permission)
    const { data: hasCompPerm } = await supabase.rpc('has_permission', {
      p_module: 'company_settings',
      p_action: 'view',
    });
    const { data: hasSettPerm } = await supabase.rpc('has_permission', {
      p_module: 'settings',
      p_action: 'view',
    });

    const isSuperAdmin = profile.role === 'Super Admin';
    const isAdminOrOwner = profile.account_role === 'owner' || profile.account_role === 'admin';
    if (!isSuperAdmin && !isAdminOrOwner && !hasCompPerm && !hasSettPerm) {
      return NextResponse.json({ error: 'Forbidden: Insufficient privileges' }, { status: 403 });
    }

    const formData = await request.formData();
    const logoFile = formData.get('logo') as File | null;
    const removeLogo = formData.get('removeLogo') === 'true';

    const adminSupabase = getAdminClient();

    // Ensure bucket exists
    try {
      const { data: buckets } = await adminSupabase.storage.listBuckets();
      const hasBranding = buckets?.some((b) => b.name === 'branding');
      if (!hasBranding) {
        await adminSupabase.storage.createBucket('branding', {
          public: true,
          allowedMimeTypes: ['image/png', 'image/jpeg', 'image/svg+xml', 'image/webp'],
          fileSizeLimit: MAX_FILE_SIZE,
        });
      }
    } catch (err) {
      console.warn('Bucket ensure failed', err);
    }

    let logoUrl = null;

    if (!removeLogo && logoFile && logoFile.size > 0) {
      if (!ALLOWED_LOGO_TYPES.has(logoFile.type)) {
        return NextResponse.json({ error: 'Unsupported format. PNG, JPG, JPEG, SVG, and WebP are supported.' }, { status: 400 });
      }
      if (logoFile.size > MAX_FILE_SIZE) {
        return NextResponse.json({ error: 'Logo size exceeds 2 MB.' }, { status: 400 });
      }

      const ext = logoFile.name.split('.').pop() || 'png';
      const path = `company-logos/logo-${profile.account_id}-${Date.now()}.${ext}`;

      const { error: uploadError } = await adminSupabase.storage
        .from('branding')
        .upload(path, logoFile, {
          cacheControl: '3600',
          upsert: true,
          contentType: logoFile.type,
        });

      if (uploadError) {
        console.error('Logo upload error:', uploadError);
        return NextResponse.json({ error: 'Logo upload failed.' }, { status: 500 });
      }

      const { data: { publicUrl } } = adminSupabase.storage.from('branding').getPublicUrl(path);
      logoUrl = publicUrl;
    }

    // Check if company settings exists
    const { data: existing } = await adminSupabase
      .from('company_settings')
      .select('id, logo_url')
      .eq('account_id', profile.account_id)
      .maybeSingle();

    // If we're not removing, and no new file was uploaded, keep existing logo_url
    if (!removeLogo && (!logoFile || logoFile.size === 0)) {
      logoUrl = existing?.logo_url || null;
    }

    if (existing) {
      const { error: updateError } = await adminSupabase
        .from('company_settings')
        .update({ logo_url: logoUrl, updated_at: new Date().toISOString() })
        .eq('account_id', profile.account_id);

      if (updateError) {
        console.error('Database update error:', updateError);
        return NextResponse.json({ error: 'Failed to save logo to settings.' }, { status: 500 });
      }
    } else {
      const { error: insertError } = await adminSupabase
        .from('company_settings')
        .insert({ account_id: profile.account_id, logo_url: logoUrl });

      if (insertError) {
        console.error('Database insert error:', insertError);
        return NextResponse.json({ error: 'Failed to insert company settings.' }, { status: 500 });
      }
    }

    return NextResponse.json({ success: true, logo_url: logoUrl });
  } catch (error) {
    console.error('Unexpected error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
