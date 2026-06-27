'use client'

import { useCallback, useEffect, useState } from 'react'
import { useAuth } from '@/hooks/use-auth'
import { createClient } from '@/lib/supabase/client'
import { Package, Plus, Pencil, Trash2, Loader2, X, Save, Search, History, Upload, Download, FileSpreadsheet, FileText, ChevronDown } from 'lucide-react'
import { ImportWizard } from '@/components/shared/import-wizard'
import { ImportExportHistoryDialog } from '@/components/shared/import-export-history-dialog'
import { exportToExcel, exportToCSV, exportToPDF, downloadTemplate } from '@/lib/client-export-helper'
import { usePermissions } from '@/hooks/use-permissions'
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from '@/components/ui/dropdown-menu'

interface Product {
  id: string
  product_name: string
  category: string | null
  description: string | null
  specification: string | null
  hsn_code: string | null
  price: number | null
  discount_percent: number | null
  currency: string
  moq: number
  unit: string
  available_quantity: number | null
  delivery_time: string | null
  image_url: string | null
  catalog_url: string | null
  is_active: boolean
}

const EMPTY_PRODUCT: Omit<Product, 'id'> = {
  product_name: '',
  category: '',
  description: '',
  specification: '',
  hsn_code: '',
  price: null,
  discount_percent: null,
  currency: 'INR',
  moq: 1,
  unit: 'pcs',
  available_quantity: null,
  delivery_time: '',
  image_url: '',
  catalog_url: '',
  is_active: true,
}

export function ProductKnowledgePanel() {
  const { accountId } = useAuth()
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [editingProduct, setEditingProduct] = useState<(Partial<Product> & { product_name: string }) | null>(null)
  const [isNew, setIsNew] = useState(false)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState<string | null>(null)

  const [importOpen, setImportOpen] = useState(false)
  const [historyOpen, setHistoryOpen] = useState(false)

  const { hasPermission } = usePermissions()
  const canImport = hasPermission("data_management", "import")
  const canExport = hasPermission("data_management", "export")
  const canTemplates = hasPermission("data_management", "templates")
  const canViewHistory = hasPermission("data_management", "logs_view")

  const exportHeaders = [
    "SR NO", "PRODUCT NAME", "CATEGORY", "DESCRIPTION", "SPECIFICATION", "HSN CODE", "PRICE", "UNIT"
  ]
  const exportColWidths = [
    "8%", "20%", "15%", "25%", "15%", "10%", "12%", "10%"
  ]

  const getExportData = () => {
    return filteredProducts.map((p, idx) => [
      idx + 1,
      p.product_name,
      p.category || "",
      p.description || "",
      p.specification || "",
      p.hsn_code || "",
      p.price || 0,
      p.unit || "pcs",
    ])
  }

  const handleExportCSV = async () => {
    await exportToCSV({
      module: "product",
      headers: exportHeaders,
      data: getExportData(),
      filtersUsed: { search },
      filenamePrefix: "product_master",
    })
  }

  const handleExportExcel = async () => {
    await exportToExcel({
      module: "product",
      title: "PRODUCT MASTER REGISTER",
      headers: exportHeaders,
      colWidths: exportColWidths,
      data: getExportData(),
      filtersUsed: { search },
      filenamePrefix: "product_master",
    })
  }

  const handleExportPDF = async () => {
    await exportToPDF({
      module: "product",
      title: "PRODUCT MASTER REGISTER",
      headers: exportHeaders,
      colWidths: exportColWidths,
      data: getExportData(),
      filtersUsed: { search },
      filenamePrefix: "product_master",
    })
  }

  const supabase = createClient()

  const loadProducts = useCallback(async () => {
    if (!accountId) return
    setLoading(true)
    const { data } = await supabase
      .from('company_products')
      .select('*')
      .eq('account_id', accountId)
      .order('product_name')

    setProducts(data ?? [])
    setLoading(false)
  }, [accountId, supabase])

  useEffect(() => { loadProducts() }, [loadProducts])

  const handleAdd = () => {
    setEditingProduct({ ...EMPTY_PRODUCT })
    setIsNew(true)
  }

  const handleEdit = (product: Product) => {
    setEditingProduct({ ...product })
    setIsNew(false)
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this product?')) return
    setDeleting(id)
    await supabase.from('company_products').delete().eq('id', id)
    setProducts(prev => prev.filter(p => p.id !== id))
    setDeleting(null)
  }

  const handleSave = async () => {
    if (!accountId || !editingProduct || !editingProduct.product_name.trim()) return
    setSaving(true)

    const payload = {
      account_id: accountId,
      product_name: editingProduct.product_name,
      category: editingProduct.category || null,
      description: editingProduct.description || null,
      specification: editingProduct.specification || null,
      hsn_code: editingProduct.hsn_code || null,
      price: editingProduct.price || null,
      discount_percent: editingProduct.discount_percent || null,
      currency: editingProduct.currency || 'INR',
      moq: editingProduct.moq ?? 1,
      unit: editingProduct.unit || 'pcs',
      available_quantity: editingProduct.available_quantity ?? null,
      delivery_time: editingProduct.delivery_time || null,
      image_url: editingProduct.image_url || null,
      catalog_url: editingProduct.catalog_url || null,
      is_active: editingProduct.is_active ?? true,
    }

    if (isNew) {
      await supabase.from('company_products').insert(payload)
    } else if (editingProduct.id) {
      await supabase.from('company_products').update(payload).eq('id', editingProduct.id)
    }

    setSaving(false)
    setEditingProduct(null)
    loadProducts()
  }

  const filteredProducts = products.filter(p =>
    !search ||
    p.product_name.toLowerCase().includes(search.toLowerCase()) ||
    p.category?.toLowerCase().includes(search.toLowerCase()) ||
    p.description?.toLowerCase().includes(search.toLowerCase())
  )

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search products..."
            className="w-full rounded-lg border border-border bg-background py-2 pl-9 pr-3 text-sm text-foreground placeholder:text-muted-foreground/50 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>
        <div className="flex items-center gap-2">
          {canTemplates && (
            <button
              onClick={() => downloadTemplate("product")}
              className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-1.5 text-xs text-muted-foreground hover:bg-muted/40 hover:text-foreground transition-all cursor-pointer"
              title="Download Import Excel Template"
            >
              <Download className="h-3.5 w-3.5" />
              <span>Template</span>
            </button>
          )}
          {canImport && (
            <button
              onClick={() => setImportOpen(true)}
              className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-1.5 text-xs text-muted-foreground hover:bg-muted/40 hover:text-foreground transition-all cursor-pointer"
            >
              <Upload className="h-3.5 w-3.5" />
              <span>Import</span>
            </button>
          )}
          {canViewHistory && (
            <button
              onClick={() => setHistoryOpen(true)}
              className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-1.5 text-xs text-muted-foreground hover:bg-muted/40 hover:text-foreground transition-all cursor-pointer"
              title="View Import/Export History Logs"
            >
              <History className="h-3.5 w-3.5" />
              <span>History</span>
            </button>
          )}
          {canExport && (
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <button
                    type="button"
                    className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-1.5 text-xs text-muted-foreground hover:bg-muted/40 hover:text-foreground transition-all cursor-pointer"
                  >
                    <Download className="h-3.5 w-3.5" />
                    <span>Export</span>
                    <ChevronDown className="h-3 w-3 text-muted-foreground" />
                  </button>
                }
              />
              <DropdownMenuContent align="end" className="bg-slate-900 border-slate-700 min-w-[120px]">
                <DropdownMenuItem onClick={handleExportExcel} className="text-slate-300 focus:bg-slate-800 focus:text-white flex items-center gap-1.5 cursor-pointer">
                  <FileSpreadsheet className="h-4 w-4 text-emerald-400" />
                  <span>Excel</span>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleExportCSV} className="text-slate-300 focus:bg-slate-800 focus:text-white flex items-center gap-1.5 cursor-pointer">
                  <FileText className="h-4 w-4 text-blue-400" />
                  <span>CSV</span>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleExportPDF} className="text-slate-300 focus:bg-slate-800 focus:text-white flex items-center gap-1.5 cursor-pointer">
                  <FileText className="h-4 w-4 text-red-400" />
                  <span>PDF</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
          <button
            onClick={handleAdd}
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90 transition-colors"
          >
            <Plus className="h-4 w-4" /> Add Product
          </button>
        </div>
      </div>

      {/* Info */}
      <div className="rounded-lg border border-blue-500/20 bg-blue-500/5 p-3">
        <p className="text-xs text-blue-400">
          <Package className="mr-1.5 inline h-3.5 w-3.5" />
          Products listed here are used by the AI assistant to answer customer queries about pricing, availability, MOQ, and delivery times.
        </p>
      </div>

      {/* Product List */}
      {filteredProducts.length === 0 ? (
        <div className="rounded-xl border border-border bg-card p-12 text-center">
          <Package className="mx-auto h-10 w-10 text-muted-foreground/40" />
          <p className="mt-3 text-sm text-muted-foreground">
            {search ? 'No products match your search.' : 'No products added yet. Add your first product to enable AI product knowledge.'}
          </p>
        </div>
      ) : (
        <div className="rounded-xl border border-border overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Product</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground hidden sm:table-cell">Category</th>
                <th className="px-4 py-3 text-right font-medium text-muted-foreground hidden md:table-cell">Price</th>
                <th className="px-4 py-3 text-right font-medium text-muted-foreground hidden md:table-cell">MOQ</th>
                <th className="px-4 py-3 text-center font-medium text-muted-foreground hidden lg:table-cell">Status</th>
                <th className="px-4 py-3 text-right font-medium text-muted-foreground">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredProducts.map(p => (
                <tr key={p.id} className="border-b border-border last:border-0 hover:bg-muted/10 transition-colors">
                  <td className="px-4 py-3">
                    <div className="font-medium text-foreground">{p.product_name}</div>
                    {p.description && (
                      <div className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{p.description}</div>
                    )}
                  </td>
                  <td className="px-4 py-3 hidden sm:table-cell">
                    {p.category ? (
                      <span className="inline-block rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary">{p.category}</span>
                    ) : (
                      <span className="text-muted-foreground/50">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right hidden md:table-cell">
                    {p.price != null ? (
                      <span className="font-medium text-foreground">
                        {p.currency ?? '₹'} {p.price.toLocaleString()}
                        {p.discount_percent && p.discount_percent > 0 && (
                          <span className="ml-1 text-xs text-emerald-500">-{p.discount_percent}%</span>
                        )}
                      </span>
                    ) : (
                      <span className="text-muted-foreground/50">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right hidden md:table-cell text-muted-foreground">
                    {p.moq} {p.unit}
                  </td>
                  <td className="px-4 py-3 text-center hidden lg:table-cell">
                    <span className={`inline-block h-2 w-2 rounded-full ${p.is_active ? 'bg-emerald-500' : 'bg-slate-500'}`} />
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => handleEdit(p)}
                        className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                        title="Edit"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => handleDelete(p.id)}
                        disabled={deleting === p.id}
                        className="rounded-md p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors disabled:opacity-50"
                        title="Delete"
                      >
                        {deleting === p.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Edit / Add Modal */}
      {editingProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl border border-border bg-card p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-lg font-semibold text-foreground">
                {isNew ? 'Add Product' : 'Edit Product'}
              </h3>
              <button onClick={() => setEditingProduct(null)} className="rounded-md p-1 hover:bg-muted transition-colors">
                <X className="h-5 w-5 text-muted-foreground" />
              </button>
            </div>

            <div className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Product Name *" value={editingProduct.product_name} onChange={v => setEditingProduct(prev => prev ? { ...prev, product_name: v } : prev)} placeholder="CNC Machine" />
                <Field label="Category" value={editingProduct.category ?? ''} onChange={v => setEditingProduct(prev => prev ? { ...prev, category: v } : prev)} placeholder="Machinery" />
              </div>
              <Field label="Description" value={editingProduct.description ?? ''} onChange={v => setEditingProduct(prev => prev ? { ...prev, description: v } : prev)} placeholder="Brief product description..." textarea />
              <Field label="Specification" value={editingProduct.specification ?? ''} onChange={v => setEditingProduct(prev => prev ? { ...prev, specification: v } : prev)} placeholder="Size: 500x300mm, Weight: 50kg, Material: SS304" textarea />
              <div className="grid gap-4 sm:grid-cols-3">
                <Field label="Price" value={editingProduct.price != null ? String(editingProduct.price) : ''} onChange={v => setEditingProduct(prev => prev ? { ...prev, price: v ? parseFloat(v) : null } : prev)} type="number" placeholder="15000" />
                <Field label="Discount %" value={editingProduct.discount_percent != null ? String(editingProduct.discount_percent) : ''} onChange={v => setEditingProduct(prev => prev ? { ...prev, discount_percent: v ? parseFloat(v) : null } : prev)} type="number" placeholder="10" />
                <Field label="Currency" value={editingProduct.currency ?? 'INR'} onChange={v => setEditingProduct(prev => prev ? { ...prev, currency: v } : prev)} placeholder="INR" />
              </div>
              <div className="grid gap-4 sm:grid-cols-3">
                <Field label="MOQ" value={String(editingProduct.moq ?? 1)} onChange={v => setEditingProduct(prev => prev ? { ...prev, moq: parseInt(v) || 1 } : prev)} type="number" placeholder="1" />
                <Field label="Unit" value={editingProduct.unit ?? 'pcs'} onChange={v => setEditingProduct(prev => prev ? { ...prev, unit: v } : prev)} placeholder="pcs" />
                <Field label="Available Qty" value={editingProduct.available_quantity != null ? String(editingProduct.available_quantity) : ''} onChange={v => setEditingProduct(prev => prev ? { ...prev, available_quantity: v ? parseInt(v) : null } : prev)} type="number" placeholder="500" />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="HSN Code" value={editingProduct.hsn_code ?? ''} onChange={v => setEditingProduct(prev => prev ? { ...prev, hsn_code: v } : prev)} placeholder="84798999" />
                <Field label="Delivery Time" value={editingProduct.delivery_time ?? ''} onChange={v => setEditingProduct(prev => prev ? { ...prev, delivery_time: v } : prev)} placeholder="3-5 business days" />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Image URL" value={editingProduct.image_url ?? ''} onChange={v => setEditingProduct(prev => prev ? { ...prev, image_url: v } : prev)} placeholder="https://..." />
                <Field label="Catalog/Datasheet URL" value={editingProduct.catalog_url ?? ''} onChange={v => setEditingProduct(prev => prev ? { ...prev, catalog_url: v } : prev)} placeholder="https://..." />
              </div>
              <label className="flex items-center gap-2 text-sm text-foreground cursor-pointer">
                <input
                  type="checkbox"
                  checked={editingProduct.is_active ?? true}
                  onChange={e => setEditingProduct(prev => prev ? { ...prev, is_active: e.target.checked } : prev)}
                  className="rounded border-border"
                />
                Active (visible to AI)
              </label>
            </div>

            <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-border">
              <button onClick={() => setEditingProduct(null)} className="rounded-lg border border-border px-4 py-2 text-sm text-muted-foreground hover:bg-muted transition-colors">
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving || !editingProduct.product_name.trim()}
                className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90 disabled:opacity-50 transition-colors"
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                {saving ? 'Saving...' : 'Save Product'}
              </button>
            </div>
          </div>
        </div>
      )}
      <ImportWizard
        open={importOpen}
        onOpenChange={setImportOpen}
        module="product"
        onImportCompleted={loadProducts}
      />
      <ImportExportHistoryDialog
        open={historyOpen}
        onOpenChange={setHistoryOpen}
        module="product"
      />
    </div>
  )
}

function Field({ label, value, onChange, placeholder, type = 'text', textarea }: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string; type?: string; textarea?: boolean
}) {
  const cls = "w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/50 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary transition-colors"
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-medium text-muted-foreground">{label}</label>
      {textarea ? (
        <textarea value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} rows={2} className={`${cls} resize-y`} />
      ) : (
        <input type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} className={cls} />
      )}
    </div>
  )
}
