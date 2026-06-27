'use client'

import { useCallback, useEffect, useState, useRef } from 'react'
import { useAuth } from '@/hooks/use-auth'
import { createClient } from '@/lib/supabase/client'
import { Building2, Globe, Phone, Mail, Clock, MapPin, FileText, Save, Loader2, CheckCircle2, Landmark, Upload, Trash2, Plus, Star, Check } from 'lucide-react'
import type { CompanyBankAccount } from '@/types'
import { toast } from 'sonner'
import { safeUUID } from '@/lib/utils'

interface CompanySettingsData {
  company_name: string
  company_description: string
  tagline: string
  address: string
  city: string
  state: string
  country: string
  pincode: string
  phone: string
  alternate_phone: string
  email: string
  website: string
  gst_number: string
  pan_number: string
  working_hours: string
  established_year: number | ''
  logo_url: string
  catalog_pdf_url: string
  terms_and_conditions: string
  shipping_policy: string
  return_policy: string
  payment_terms: string
  warranty_policy: string
  bank_account_name: string
  bank_account_type: string
  bank_account_number: string
  bank_name: string
  bank_ifsc: string
  // Quotation-specific
  manager_name: string
  manager_designation: string
  quotation_terms_text: string
  proforma_terms_text: string
  sales_register_terms_text: string
  contact_numbers: string
  email_details: string
  jurisdiction: string
  footer_text: string
  seal_url: string
  logo_alignment: 'left' | 'right'
  social_media: {
    instagram: string
    facebook: string
    linkedin: string
    youtube: string
    twitter: string
  }
}

const INITIAL: CompanySettingsData = {
  company_name: '',
  company_description: '',
  tagline: '',
  address: '',
  city: '',
  state: '',
  country: '',
  pincode: '',
  phone: '',
  alternate_phone: '',
  email: '',
  website: '',
  gst_number: '',
  pan_number: '',
  working_hours: '',
  established_year: '',
  logo_url: '',
  catalog_pdf_url: '',
  terms_and_conditions: '',
  shipping_policy: '',
  return_policy: '',
  payment_terms: '',
  warranty_policy: '',
  bank_account_name: '',
  bank_account_type: 'Current',
  bank_account_number: '',
  bank_name: '',
  bank_ifsc: '',
  // Quotation-specific
  manager_name: '',
  manager_designation: 'Manager',
  quotation_terms_text: '',
  proforma_terms_text: '',
  sales_register_terms_text: '',
  contact_numbers: '',
  email_details: '',
  jurisdiction: 'Belagavi Jurisdiction (Karnataka, India).',
  footer_text: '',
  seal_url: '',
  logo_alignment: 'right',
  social_media: { instagram: '', facebook: '', linkedin: '', youtube: '', twitter: '' },
}

export function CompanySettingsPanel() {
  const { accountId } = useAuth()
  const [form, setForm] = useState<CompanySettingsData>(INITIAL)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [bankAccounts, setBankAccounts] = useState<CompanyBankAccount[]>([])
  const [deletedBankIds, setDeletedBankIds] = useState<string[]>([])
  const [showAddBank, setShowAddBank] = useState(false)
  const [newBank, setNewBank] = useState({
    account_name: '',
    account_type: 'Current',
    account_number: '',
    bank_name: '',
    bank_ifsc: '',
    is_default: false
  })

  const supabase = createClient()

  // Company logo upload state
  const logoInputRef = useRef<HTMLInputElement>(null)
  const [logoFile, setLogoFile] = useState<File | null>(null)
  const [logoPreview, setLogoPreview] = useState<string | null>(null)
  const [removeLogo, setRemoveLogo] = useState(false)

  // Signature image upload state
  const signatureInputRef = useRef<HTMLInputElement>(null)
  const [signatureFile, setSignatureFile] = useState<File | null>(null)
  const [signaturePreview, setSignaturePreview] = useState<string | null>(null)
  const [removeSignature, setRemoveSignature] = useState(false)

  // Seal image upload state
  const sealInputRef = useRef<HTMLInputElement>(null)
  const [sealFile, setSealFile] = useState<File | null>(null)
  const [sealPreview, setSealPreview] = useState<string | null>(null)
  const [removeSeal, setRemoveSeal] = useState(false)



  // Clean up object URLs to avoid memory leaks
  useEffect(() => {
    return () => {
      if (logoPreview && logoPreview.startsWith('blob:')) URL.revokeObjectURL(logoPreview)
      if (signaturePreview && signaturePreview.startsWith('blob:')) URL.revokeObjectURL(signaturePreview)
      if (sealPreview && sealPreview.startsWith('blob:')) URL.revokeObjectURL(sealPreview)
    }
  }, [logoPreview, signaturePreview, sealPreview])

  // Load existing settings
  const loadSettings = useCallback(async () => {
    if (!accountId) return
    setLoading(true)


    const { data } = await supabase
      .from('company_settings')
      .select('*')
      .eq('account_id', accountId)
      .maybeSingle()

    if (data) {
      setForm({
        company_name: data.company_name ?? '',
        company_description: data.company_description ?? '',
        tagline: data.tagline ?? '',
        address: data.address ?? '',
        city: data.city ?? '',
        state: data.state ?? '',
        country: data.country ?? '',
        pincode: data.pincode ?? '',
        phone: data.phone ?? '',
        alternate_phone: data.alternate_phone ?? '',
        email: data.email ?? '',
        website: data.website ?? '',
        gst_number: data.gst_number ?? '',
        pan_number: data.pan_number ?? '',
        working_hours: data.working_hours ?? '',
        established_year: data.established_year ?? '',
        logo_url: data.logo_url ?? '',
        catalog_pdf_url: data.catalog_pdf_url ?? '',
        terms_and_conditions: data.terms_and_conditions ?? '',
        shipping_policy: data.shipping_policy ?? '',
        return_policy: data.return_policy ?? '',
        payment_terms: data.payment_terms ?? '',
        warranty_policy: data.warranty_policy ?? '',
        bank_account_name: data.bank_account_name ?? '',
        bank_account_type: data.bank_account_type ?? 'Current',
        bank_account_number: data.bank_account_number ?? '',
        bank_name: data.bank_name ?? '',
        bank_ifsc: data.bank_ifsc ?? '',
        // Quotation-specific
        manager_name: data.manager_name ?? '',
        manager_designation: data.manager_designation ?? 'Manager',
        quotation_terms_text: data.quotation_terms_text ?? '',
        proforma_terms_text: data.proforma_terms_text ?? '',
        sales_register_terms_text: data.sales_register_terms_text ?? '',
        contact_numbers: data.contact_numbers ?? '',
        email_details: data.email_details ?? '',
        jurisdiction: data.jurisdiction ?? 'Belagavi Jurisdiction (Karnataka, India).',
        footer_text: data.footer_text ?? '',
        seal_url: data.seal_url ?? '',
        logo_alignment: data.logo_alignment ?? 'right',
        social_media: {
          instagram: data.social_media?.instagram ?? '',
          facebook: data.social_media?.facebook ?? '',
          linkedin: data.social_media?.linkedin ?? '',
          youtube: data.social_media?.youtube ?? '',
          twitter: data.social_media?.twitter ?? '',
        },
      })
      setLogoPreview(data.logo_url ?? null)
      setSignaturePreview(data.signature_url ?? null)
      setSealPreview(data.seal_url ?? null)
    }

    const { data: bankData } = await supabase
      .from('company_bank_accounts')
      .select('*')
      .eq('account_id', accountId)
      .order('created_at', { ascending: true })

    if (bankData) {
      setBankAccounts(bankData as CompanyBankAccount[])
    } else {
      setBankAccounts([])
    }
    setDeletedBankIds([])

    setLoading(false)
  }, [accountId, supabase])

  useEffect(() => { loadSettings() }, [loadSettings])

  const handleLogoPick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const allowedTypes = new Set(['image/png', 'image/jpeg', 'image/jpg', 'image/svg+xml', 'image/webp'])
    if (!allowedTypes.has(file.type)) {
      alert('Unsupported logo format. PNG, JPG, JPEG, SVG, and WebP are supported.')
      return
    }
    if (file.size > 2 * 1024 * 1024) {
      alert('File is too large. Maximum size is 2 MB.')
      return
    }

    if (logoPreview && logoPreview.startsWith('blob:')) {
      URL.revokeObjectURL(logoPreview)
    }
    setLogoFile(file)
    setLogoPreview(URL.createObjectURL(file))
    setRemoveLogo(false)
  }

  const handleRemoveLogo = () => {
    if (logoPreview && logoPreview.startsWith('blob:')) {
      URL.revokeObjectURL(logoPreview)
    }
    setLogoFile(null)
    setLogoPreview(null)
    setRemoveLogo(true)
  }


  const handleSignaturePick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const allowedTypes = new Set(['image/png', 'image/jpeg', 'image/jpg', 'image/webp'])
    if (!allowedTypes.has(file.type)) {
      alert('Unsupported signature format. PNG, JPG, or WebP are supported.')
      return
    }
    if (file.size > 2 * 1024 * 1024) {
      alert('File is too large. Maximum size is 2 MB.')
      return
    }
    if (signaturePreview && signaturePreview.startsWith('blob:')) URL.revokeObjectURL(signaturePreview)
    setSignatureFile(file)
    setSignaturePreview(URL.createObjectURL(file))
    setRemoveSignature(false)
  }

  const handleRemoveSignature = () => {
    if (signaturePreview && signaturePreview.startsWith('blob:')) URL.revokeObjectURL(signaturePreview)
    setSignatureFile(null)
    setSignaturePreview(null)
    setRemoveSignature(true)
  }

  const handleSealPick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const allowedTypes = new Set(['image/png', 'image/jpeg', 'image/jpg', 'image/webp'])
    if (!allowedTypes.has(file.type)) {
      alert('Unsupported seal format. PNG, JPG, or WebP are supported.')
      return
    }
    if (file.size > 2 * 1024 * 1024) {
      alert('File is too large. Maximum size is 2 MB.')
      return
    }
    if (sealPreview && sealPreview.startsWith('blob:')) URL.revokeObjectURL(sealPreview)
    setSealFile(file)
    setSealPreview(URL.createObjectURL(file))
    setRemoveSeal(false)
  }

  const handleRemoveSeal = () => {
    if (sealPreview && sealPreview.startsWith('blob:')) URL.revokeObjectURL(sealPreview)
    setSealFile(null)
    setSealPreview(null)
    setRemoveSeal(true)
  }

  const handleSave = async () => {
    if (!accountId) return
    setSaving(true)
    setSaved(false)

    // 1. Save company logo if changed
    let finalLogoUrl = form.logo_url
    if (logoFile || removeLogo) {
      try {
        const formData = new FormData()
        formData.append('removeLogo', String(removeLogo))
        if (logoFile) formData.append('logo', logoFile)
        const logoRes = await fetch('/api/settings/company-logo', { method: 'POST', body: formData })
        if (logoRes.ok) {
          const logoData = await logoRes.json()
          finalLogoUrl = logoData.logo_url ?? ''
          setForm(prev => ({ ...prev, logo_url: finalLogoUrl }))
        } else {
          const errData = await logoRes.json()
          alert(errData.error || 'Failed to upload logo')
        }
      } catch (err) {
        console.error('Logo upload failed:', err)
      }
    }

    // 3. Upload signature image if changed
    let finalSignatureUrl: string | null = removeSignature ? null : (signaturePreview && !signaturePreview.startsWith('blob:') ? signaturePreview : null)
    if (signatureFile) {
      try {
        const supabaseClient = createClient()
        const ext = signatureFile.name.split('.').pop() ?? 'png'
        const path = `signatures/${accountId}/signature.${ext}`
        const { error: uploadErr } = await supabaseClient.storage
          .from('company-assets')
          .upload(path, signatureFile, { upsert: true, contentType: signatureFile.type })
        if (!uploadErr) {
          const { data: urlData } = supabaseClient.storage.from('company-assets').getPublicUrl(path)
          finalSignatureUrl = urlData.publicUrl + '?t=' + Date.now()
        } else {
          console.error('Signature upload failed:', uploadErr.message)
        }
      } catch (err) {
        console.error('Signature upload threw:', err)
      }
    }

    // 4. Upload company seal image if changed
    let finalSealUrl: string | null = removeSeal ? null : (sealPreview && !sealPreview.startsWith('blob:') ? sealPreview : null)
    if (sealFile) {
      try {
        const supabaseClient = createClient()
        const ext = sealFile.name.split('.').pop() ?? 'png'
        const path = `seals/${accountId}/seal.${ext}`
        const { error: uploadErr } = await supabaseClient.storage
          .from('company-assets')
          .upload(path, sealFile, { upsert: true, contentType: sealFile.type })
        if (!uploadErr) {
          const { data: urlData } = supabaseClient.storage.from('company-assets').getPublicUrl(path)
          finalSealUrl = urlData.publicUrl + '?t=' + Date.now()
        } else {
          console.error('Seal upload failed:', uploadErr.message)
        }
      } catch (err) {
        console.error('Seal upload threw:', err)
      }
    }

    // Save bank accounts to DB
    if (deletedBankIds.length > 0) {
      const { error: delErr } = await supabase
        .from('company_bank_accounts')
        .delete()
        .in('id', deletedBankIds)
      if (delErr) {
        console.error('Failed to delete bank accounts:', delErr.message)
      }
    }

    const bankPayloads = bankAccounts.map(ba => {
      const { id, account_id, created_at, updated_at, ...rest } = ba
      if (id.startsWith('temp_')) {
        return {
          id: safeUUID(),
          account_id: accountId,
          ...rest
        }
      }
      return {
        id,
        account_id: accountId,
        ...rest
      }
    })

    if (bankPayloads.length > 0) {
      const { error: bankErr } = await supabase
        .from('company_bank_accounts')
        .upsert(bankPayloads)
      if (bankErr) {
        console.error('Failed to save bank accounts:', bankErr.message)
      }
    }

    // Refresh bank accounts from DB to get actual IDs
    const { data: refreshedBankData } = await supabase
      .from('company_bank_accounts')
      .select('*')
      .eq('account_id', accountId)
      .order('created_at', { ascending: true })

    const finalBankAccounts = refreshedBankData ? (refreshedBankData as CompanyBankAccount[]) : bankAccounts
    setBankAccounts(finalBankAccounts)
    setDeletedBankIds([])

    const defaultBank = finalBankAccounts.find(ba => ba.is_default) || finalBankAccounts[0]

    const payload = {
      account_id: accountId,
      ...form,
      logo_url: finalLogoUrl,
      signature_url: finalSignatureUrl,
      seal_url: finalSealUrl,
      established_year: form.established_year || null,
      social_media: form.social_media,
      // Mirror the default bank details for legacy support
      bank_account_name: defaultBank ? defaultBank.account_name : '',
      bank_account_type: defaultBank ? defaultBank.account_type : 'Current',
      bank_account_number: defaultBank ? defaultBank.account_number : '',
      bank_name: defaultBank ? defaultBank.bank_name : '',
      bank_ifsc: defaultBank ? defaultBank.bank_ifsc : '',
    }

    await supabase.from('company_settings').upsert(payload, { onConflict: 'account_id' })

    // Update state form to reflect mirrored bank details
    setForm(prev => ({
      ...prev,
      bank_account_name: defaultBank ? defaultBank.account_name : '',
      bank_account_type: defaultBank ? defaultBank.account_type : 'Current',
      bank_account_number: defaultBank ? defaultBank.account_number : '',
      bank_name: defaultBank ? defaultBank.bank_name : '',
      bank_ifsc: defaultBank ? defaultBank.bank_ifsc : '',
    }))

    setSaving(false)
    setSaved(true)
    setLogoFile(null)
    setRemoveLogo(false)
    setSignatureFile(null)
    setRemoveSignature(false)
    setSealFile(null)
    setRemoveSeal(false)

    setTimeout(() => setSaved(false), 3000)
  }

  const updateField = (field: keyof CompanySettingsData, value: string | number) => {
    setForm(prev => ({ ...prev, [field]: value }))
  }

  const updateSocial = (field: keyof CompanySettingsData['social_media'], value: string) => {
    setForm(prev => ({
      ...prev,
      social_media: { ...prev.social_media, [field]: value },
    }))
  }

  const handleAddBank = () => {
    if (!newBank.account_name.trim()) {
      alert('Account Name is required')
      return
    }
    if (!newBank.account_number.trim()) {
      alert('Account Number is required')
      return
    }
    if (!newBank.bank_name.trim()) {
      alert('Bank Name is required')
      return
    }
    if (!newBank.bank_ifsc.trim()) {
      alert('IFSC Code is required')
      return
    }

    const tempId = `temp_${Date.now()}`
    const item: CompanyBankAccount = {
      id: tempId,
      account_id: accountId || '',
      account_name: newBank.account_name.trim(),
      account_type: newBank.account_type,
      account_number: newBank.account_number.trim(),
      bank_name: newBank.bank_name.trim(),
      bank_ifsc: newBank.bank_ifsc.trim().toUpperCase(),
      is_default: newBank.is_default || bankAccounts.length === 0
    }

    setBankAccounts(prev => {
      let list = [...prev]
      if (item.is_default) {
        list = list.map(b => ({ ...b, is_default: false }))
      }
      return [...list, item]
    })

    setNewBank({
      account_name: '',
      account_type: 'Current',
      account_number: '',
      bank_name: '',
      bank_ifsc: '',
      is_default: false
    })
    setShowAddBank(false)
  }

  const handleSetDefaultBank = (id: string) => {
    setBankAccounts(prev =>
      prev.map(b => ({
        ...b,
        is_default: b.id === id
      }))
    )
  }

  const handleDeleteBank = async (id: string) => {
    if (id.startsWith('temp_')) {
      setBankAccounts(prev => {
        const remaining = prev.filter(b => b.id !== id)
        if (prev.find(b => b.id === id)?.is_default && remaining.length > 0) {
          remaining[0].is_default = true
        }
        return remaining
      })
      toast.success('Temp bank account removed')
      return
    }

    if (!confirm('Are you sure you want to delete this bank account permanently?')) return

    try {
      const { error } = await supabase
        .from('company_bank_accounts')
        .delete()
        .eq('id', id)

      if (error) throw error

      setBankAccounts(prev => {
        const remaining = prev.filter(b => b.id !== id)
        if (prev.find(b => b.id === id)?.is_default && remaining.length > 0) {
          remaining[0].is_default = true
        }
        return remaining
      })
      toast.success('Bank account permanently deleted')
    } catch (err: any) {
      console.error(err)
      toast.error('Failed to delete bank account: ' + err.message)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="space-y-8">

      {/* Company Identity */}
      <Section icon={<Building2 className="h-5 w-5" />} title="Company Identity" description="Basic company information used by the AI assistant to introduce your business.">
        {/* Logo Upload Row */}
        <div className="flex flex-col gap-3 pb-4 border-b border-border">
          <label className="text-xs font-medium text-muted-foreground">Company Logo</label>
          <div className="flex items-center gap-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-lg border border-border bg-slate-900 overflow-hidden">
              {logoPreview ? (
                <img src={logoPreview} alt="Company Logo" className="h-full w-full object-contain" />
              ) : (
                <Building2 className="h-8 w-8 text-muted-foreground/40" />
              )}
            </div>
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-2">
                <input
                  type="file"
                  ref={logoInputRef}
                  onChange={handleLogoPick}
                  accept="image/png, image/jpeg, image/jpg, image/svg+xml, image/webp"
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => logoInputRef.current?.click()}
                  className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium hover:bg-slate-800 text-foreground transition-colors"
                >
                  Change Logo
                </button>
                {logoPreview && (
                  <button
                    type="button"
                    onClick={handleRemoveLogo}
                    className="rounded-lg border border-red-500/20 text-red-400 px-3 py-1.5 text-xs font-medium hover:bg-red-500/10 transition-colors"
                  >
                    Remove
                  </button>
                )}
              </div>
              <p className="text-[10px] text-muted-foreground">
                PNG, JPG, SVG or WebP. Max 2MB.
              </p>
            </div>
          </div>
          {/* Logo Alignment */}
          <div className="flex flex-col gap-1.5 mt-2">
            <label className="text-xs font-medium text-muted-foreground">Logo Alignment in Document Header</label>
            <select
              value={form.logo_alignment}
              onChange={e => updateField('logo_alignment', e.target.value)}
              className="w-full sm:w-48 rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary transition-colors"
            >
              <option value="right">Right Aligned</option>
              <option value="left">Left Aligned</option>
            </select>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <InputField label="Company Name" value={form.company_name} onChange={v => updateField('company_name', v)} placeholder="Your Company Pvt. Ltd." />
          <InputField label="Tagline" value={form.tagline} onChange={v => updateField('tagline', v)} placeholder="Quality products since 1990" />
        </div>
        <TextareaField label="Company Description" value={form.company_description} onChange={v => updateField('company_description', v)} placeholder="Brief description of your company, products, and expertise..." rows={3} />
        <InputField label="Year Established" value={String(form.established_year)} onChange={v => updateField('established_year', v ? parseInt(v) : '')} type="number" placeholder="1990" />
      </Section>

      {/* Contact Information */}
      <Section icon={<Phone className="h-5 w-5" />} title="Contact Information" description="Phone, email, and website details shared by the AI with customers.">
        <div className="grid gap-4 sm:grid-cols-2">
          <InputField label="Phone" value={form.phone} onChange={v => updateField('phone', v)} placeholder="+91 9876543210" />
          <InputField label="Alternate Phone" value={form.alternate_phone} onChange={v => updateField('alternate_phone', v)} placeholder="+91 1234567890" />
          <InputField label="Email" value={form.email} onChange={v => updateField('email', v)} type="email" placeholder="info@company.com" />
          <InputField label="Website" value={form.website} onChange={v => updateField('website', v)} placeholder="https://www.company.com" />
        </div>
      </Section>

      {/* Address */}
      <Section icon={<MapPin className="h-5 w-5" />} title="Address" description="Company address information.">
        <TextareaField label="Full Address" value={form.address} onChange={v => updateField('address', v)} placeholder="123, Industrial Area, Phase-2" rows={2} />
        <div className="grid gap-4 sm:grid-cols-4">
          <InputField label="City" value={form.city} onChange={v => updateField('city', v)} placeholder="Mumbai" />
          <InputField label="State" value={form.state} onChange={v => updateField('state', v)} placeholder="Maharashtra" />
          <InputField label="Country" value={form.country} onChange={v => updateField('country', v)} placeholder="India" />
          <InputField label="Pincode" value={form.pincode} onChange={v => updateField('pincode', v)} placeholder="400001" />
        </div>
      </Section>

      {/* Legal & Tax */}
      <Section icon={<FileText className="h-5 w-5" />} title="Legal & Tax" description="GST and PAN details (shared with customers on request).">
        <div className="grid gap-4 sm:grid-cols-2">
          <InputField label="GST Number" value={form.gst_number} onChange={v => updateField('gst_number', v)} placeholder="22AAAAA0000A1Z5" />
          <InputField label="PAN Number" value={form.pan_number} onChange={v => updateField('pan_number', v)} placeholder="AAAAA0000A" />
        </div>
      </Section>

      {/* Operations */}
      <Section icon={<Clock className="h-5 w-5" />} title="Operations" description="Working hours and product catalog for AI to reference.">
        <div className="grid gap-4 sm:grid-cols-2">
          <InputField label="Working Hours" value={form.working_hours} onChange={v => updateField('working_hours', v)} placeholder="Mon-Sat 9:00 AM - 6:00 PM" />
          <InputField label="Product Catalog PDF URL" value={form.catalog_pdf_url} onChange={v => updateField('catalog_pdf_url', v)} placeholder="https://example.com/catalog.pdf" />
        </div>
      </Section>

      {/* Policies */}
      <Section icon={<FileText className="h-5 w-5" />} title="Policies" description="Business policies the AI assistant uses to answer customer questions.">
        <TextareaField label="Payment Terms" value={form.payment_terms} onChange={v => updateField('payment_terms', v)} placeholder="50% advance, 50% before dispatch. Accept NEFT/RTGS/UPI." rows={3} />
        <TextareaField label="Shipping Policy" value={form.shipping_policy} onChange={v => updateField('shipping_policy', v)} placeholder="Free shipping on orders above ₹50,000. Transit time: 5-7 business days." rows={3} />
        <TextareaField label="Warranty Policy" value={form.warranty_policy} onChange={v => updateField('warranty_policy', v)} placeholder="1 year warranty on all products." rows={2} />
        <TextareaField label="Return Policy" value={form.return_policy} onChange={v => updateField('return_policy', v)} placeholder="Returns accepted within 7 days of delivery." rows={2} />
        <TextareaField label="Terms & Conditions" value={form.terms_and_conditions} onChange={v => updateField('terms_and_conditions', v)} placeholder="General terms and conditions..." rows={4} />
      </Section>

      {/* Bank Details */}
      <Section
        icon={<Landmark className="h-5 w-5" />}
        title="Bank Details"
        description="Bank account details printed on quotations and invoices."
      >
        {/* Existing Accounts List */}
        <div className="space-y-3">
          {bankAccounts.length === 0 ? (
            <div className="text-sm text-muted-foreground p-4 text-center border border-dashed border-border rounded-lg bg-card/30">
              No bank accounts configured yet. Click the "+" button below to add one.
            </div>
          ) : (
            <div className="grid gap-3">
              {bankAccounts.map((ba) => (
                <div
                  key={ba.id}
                  className={`flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-xl border bg-card/50 transition-colors ${
                    ba.is_default ? "border-primary bg-primary/5" : "border-border"
                  }`}
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-foreground text-sm">
                        {ba.account_name}
                      </span>
                      <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded bg-muted text-muted-foreground">
                        {ba.account_type}
                      </span>
                      {ba.is_default && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold text-primary px-2 py-0.5 rounded bg-primary/10">
                          <Check className="h-3 w-3" /> Default
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1">
                      <div><span className="font-medium text-foreground/75">Acc:</span> {ba.account_number}</div>
                      <div><span className="font-medium text-foreground/75">Bank:</span> {ba.bank_name}</div>
                      <div><span className="font-medium text-foreground/75">IFSC:</span> {ba.bank_ifsc}</div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 self-end sm:self-center">
                    {!ba.is_default && (
                      <button
                        type="button"
                        onClick={() => handleSetDefaultBank(ba.id)}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs text-muted-foreground hover:bg-slate-800 hover:text-foreground transition-colors"
                      >
                        <Star className="h-3 w-3" /> Make Default
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => handleDeleteBank(ba.id)}
                      className="rounded-lg border border-red-500/20 text-red-400 p-2 hover:bg-red-500/10 transition-colors"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Add Bank Account Section */}
        {showAddBank ? (
          <div className="p-4 border border-border rounded-xl bg-card space-y-4 pt-4 mt-2">
            <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">New Bank Account</h4>
            <div className="grid gap-4 sm:grid-cols-2">
              <InputField
                label="Account Name"
                value={newBank.account_name}
                onChange={v => setNewBank(prev => ({ ...prev, account_name: v }))}
                placeholder="Phoenix Products"
              />
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Account Type</label>
                <select
                  value={newBank.account_type}
                  onChange={e => setNewBank(prev => ({ ...prev, account_type: e.target.value }))}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary transition-colors"
                >
                  <option value="Current">Current</option>
                  <option value="Savings">Savings</option>
                  <option value="CC">Cash Credit (CC)</option>
                  <option value="OD">Overdraft (OD)</option>
                </select>
              </div>
              <InputField
                label="Account Number"
                value={newBank.account_number}
                onChange={v => setNewBank(prev => ({ ...prev, account_number: v }))}
                placeholder="05491400000090"
              />
              <InputField
                label="Bank Name"
                value={newBank.bank_name}
                onChange={v => setNewBank(prev => ({ ...prev, bank_name: v }))}
                placeholder="Canara Bank ( Branch: Bhagyanagar )"
              />
              <InputField
                label="IFSC Code"
                value={newBank.bank_ifsc}
                onChange={v => setNewBank(prev => ({ ...prev, bank_ifsc: v.toUpperCase() }))}
                placeholder="CNRB0010549"
              />
              <div className="flex items-center gap-2 pt-6">
                <input
                  type="checkbox"
                  id="new_bank_default"
                  checked={newBank.is_default}
                  onChange={e => setNewBank(prev => ({ ...prev, is_default: e.target.checked }))}
                  className="rounded border-border text-primary focus:ring-primary bg-background h-4 w-4"
                />
                <label htmlFor="new_bank_default" className="text-xs font-medium text-muted-foreground select-none cursor-pointer">
                  Set as Default Bank Account
                </label>
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowAddBank(false)}
                className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium hover:bg-slate-800 text-foreground transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleAddBank}
                className="rounded-lg bg-primary px-4 py-1.5 text-xs font-medium text-white hover:bg-primary/90 transition-colors"
              >
                Add Account
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setShowAddBank(true)}
            className="inline-flex items-center gap-2 rounded-lg border border-dashed border-border px-4 py-2.5 text-sm text-muted-foreground hover:border-primary hover:text-primary transition-colors w-full justify-center"
          >
            <Plus className="h-4 w-4" /> Add Bank Account
          </button>
        )}
      </Section>

      {/* Document Settings */}
      <Section icon={<FileText className="h-5 w-5" />} title="Document Settings" description="Configure manager details, signatures, seals, and standard footer text for PDF generation.">
        <div className="grid gap-4 sm:grid-cols-2">
          <InputField label="Manager Name" value={form.manager_name} onChange={v => updateField('manager_name', v)} placeholder="Dharshan Ladi" />
          <InputField label="Manager Designation" value={form.manager_designation} onChange={v => updateField('manager_designation', v)} placeholder="Manager" />
          <InputField label="Jurisdiction" value={form.jurisdiction} onChange={v => updateField('jurisdiction', v)} placeholder="Belagavi Jurisdiction (Karnataka, India)." />
        </div>
        <TextareaField
          label="Contact Numbers (shown on Page 3)"
          value={form.contact_numbers}
          onChange={v => updateField('contact_numbers', v)}
          placeholder="9449819832 / 9242874544 / 9482090724 / 9448480724"
          rows={2}
        />
        <TextareaField
          label="Email Details (shown on Page 3)"
          value={form.email_details}
          onChange={v => updateField('email_details', v)}
          placeholder="phoenixproductscustomercare@gmail.com, phoenix_bgm@hotmail.com"
          rows={2}
        />

        <div className="grid gap-6 sm:grid-cols-2 pt-2">
          {/* Signature Image Upload */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Manager Signature Image</label>
            <div className="flex items-start gap-4">
              {signaturePreview ? (
                <div className="relative">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={signaturePreview} alt="Signature" className="h-16 w-32 object-contain rounded border border-border bg-white p-1" />
                  <button
                    type="button"
                    onClick={handleRemoveSignature}
                    className="absolute -top-2 -right-2 flex h-5 w-5 items-center justify-center rounded-full bg-destructive text-white text-xs hover:bg-destructive/80"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              ) : (
                <div className="flex h-16 w-32 items-center justify-center rounded border-2 border-dashed border-border text-muted-foreground text-xs text-center">
                  No signature
                </div>
              )}
              <div className="flex flex-col gap-2">
                <input ref={signatureInputRef} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={handleSignaturePick} />
                <button
                  type="button"
                  onClick={() => signatureInputRef.current?.click()}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs text-foreground hover:bg-accent transition-colors"
                >
                  <Upload className="h-3.5 w-3.5" />
                  {signaturePreview ? 'Change' : 'Upload'}
                </button>
                <p className="text-[10px] text-muted-foreground">PNG, JPG or WebP. Max 2 MB.</p>
              </div>
            </div>
          </div>

          {/* Company Seal Image Upload */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Company Seal Image</label>
            <div className="flex items-start gap-4">
              {sealPreview ? (
                <div className="relative">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={sealPreview} alt="Company Seal" className="h-16 w-32 object-contain rounded border border-border bg-white p-1" />
                  <button
                    type="button"
                    onClick={handleRemoveSeal}
                    className="absolute -top-2 -right-2 flex h-5 w-5 items-center justify-center rounded-full bg-destructive text-white text-xs hover:bg-destructive/80"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              ) : (
                <div className="flex h-16 w-32 items-center justify-center rounded border-2 border-dashed border-border text-muted-foreground text-xs text-center">
                  No seal
                </div>
              )}
              <div className="flex flex-col gap-2">
                <input ref={sealInputRef} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={handleSealPick} />
                <button
                  type="button"
                  onClick={() => sealInputRef.current?.click()}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs text-foreground hover:bg-accent transition-colors"
                >
                  <Upload className="h-3.5 w-3.5" />
                  {sealPreview ? 'Change' : 'Upload'}
                </button>
                <p className="text-[10px] text-muted-foreground">PNG, JPG or WebP. Max 2 MB.</p>
              </div>
            </div>
          </div>
        </div>

        <div className="pt-2">
          <TextareaField
            label="Default Document Footer Text"
            value={form.footer_text}
            onChange={v => updateField('footer_text', v)}
            placeholder="Phoenix Products. All rights reserved. GSTIN: 29APLPK9053K1Z7. Address: D-88, Industrial Estate, Udyambag Belgaum-590008."
            rows={2}
          />
        </div>
      </Section>

      {/* Quotation Terms & Conditions */}
      <Section icon={<FileText className="h-5 w-5" />} title="Default Quotation Terms & Conditions" description="This text is pre-filled in new quotations. You can edit per-quotation in the quotation form.">
        <TextareaField
          label="Terms & Conditions Text"
          value={form.quotation_terms_text}
          onChange={v => updateField('quotation_terms_text', v)}
          placeholder={`1) PRICES : Ex-works, Belgaum.\n\n2) DELIVERY : 30 days after receipt of your confirm order and 100% Advance\n\n3) PACKING : Including\n\n...`}
          rows={10}
        />
      </Section>

      {/* Proforma Terms & Conditions */}
      <Section icon={<FileText className="h-5 w-5" />} title="Default Proforma Invoice Terms & Conditions" description="This text is pre-filled in new proforma invoices. You can edit per-proforma in the form.">
        <TextareaField
          label="Terms & Conditions Text"
          value={form.proforma_terms_text}
          onChange={v => updateField('proforma_terms_text', v)}
          placeholder={`1) PRICES : Ex-works, Belgaum.\n\n2) DELIVERY : 30 days after receipt of your confirm order and 100% Advance\n\n3) PACKING : Including\n\n...`}
          rows={10}
        />
      </Section>

      {/* Sales Register Terms & Conditions */}
      <Section icon={<FileText className="h-5 w-5" />} title="Default Sales Register Terms & Conditions" description="This text is pre-filled in new sales registers. You can edit per-register in the form.">
        <TextareaField
          label="Terms & Conditions Text"
          value={form.sales_register_terms_text}
          onChange={v => updateField('sales_register_terms_text', v)}
          placeholder={`1) PRICES : Ex-works, Belgaum.\n\n2) DELIVERY : 30 days after receipt of your confirm order and 100% Advance\n\n3) PACKING : Including\n\n...`}
          rows={10}
        />
      </Section>

      {/* Social Media */}
      <Section icon={<Globe className="h-5 w-5" />} title="Social Media" description="Social media links shared by the AI with customers.">
        <div className="grid gap-4 sm:grid-cols-2">
          <InputField label="Instagram" value={form.social_media.instagram} onChange={v => updateSocial('instagram', v)} placeholder="https://instagram.com/yourcompany" />
          <InputField label="Facebook" value={form.social_media.facebook} onChange={v => updateSocial('facebook', v)} placeholder="https://facebook.com/yourcompany" />
          <InputField label="LinkedIn" value={form.social_media.linkedin} onChange={v => updateSocial('linkedin', v)} placeholder="https://linkedin.com/company/yourcompany" />
          <InputField label="YouTube" value={form.social_media.youtube} onChange={v => updateSocial('youtube', v)} placeholder="https://youtube.com/@yourcompany" />
          <InputField label="Twitter / X" value={form.social_media.twitter} onChange={v => updateSocial('twitter', v)} placeholder="https://x.com/yourcompany" />
        </div>
      </Section>

      {/* Save Button */}
      <div className="flex items-center gap-3 pt-2">
        <button
          onClick={handleSave}
          disabled={saving}
          className="inline-flex items-center gap-2 rounded-lg bg-primary px-6 py-2.5 text-sm font-medium text-white transition-colors hover:bg-primary/90 disabled:opacity-50"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          {saving ? 'Saving...' : 'Save Settings'}
        </button>
        {saved && (
          <span className="inline-flex items-center gap-1.5 text-sm text-emerald-500">
            <CheckCircle2 className="h-4 w-4" /> Saved successfully
          </span>
        )}
      </div>
    </div>
  )
}

// ─── Reusable Form Components ──────────────────────────────────────────

function Section({ icon, title, description, children }: {
  icon: React.ReactNode
  title: string
  description: string
  children: React.ReactNode
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-6 space-y-4">
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
          {icon}
        </div>
        <div>
          <h3 className="text-sm font-semibold text-foreground">{title}</h3>
          <p className="text-xs text-muted-foreground">{description}</p>
        </div>
      </div>
      <div className="space-y-4 pt-1">{children}</div>
    </div>
  )
}

function InputField({ label, value, onChange, placeholder, type = 'text' }: {
  label: string
  value: string
  onChange: (v: string) => void
  placeholder?: string
  type?: string
}) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-medium text-muted-foreground">{label}</label>
      <input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/50 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary transition-colors"
      />
    </div>
  )
}

function TextareaField({ label, value, onChange, placeholder, rows = 3 }: {
  label: string
  value: string
  onChange: (v: string) => void
  placeholder?: string
  rows?: number
}) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-medium text-muted-foreground">{label}</label>
      <textarea
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        rows={rows}
        className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/50 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary transition-colors resize-y"
      />
    </div>
  )
}

// EOF comment to trigger Next.js compilation
