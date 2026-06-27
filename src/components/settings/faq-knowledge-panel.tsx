'use client'

import { useCallback, useEffect, useState } from 'react'
import { useAuth } from '@/hooks/use-auth'
import { createClient } from '@/lib/supabase/client'
import { HelpCircle, Plus, Pencil, Trash2, Loader2, X, Save, Search, GripVertical } from 'lucide-react'

interface FaqItem {
  id: string
  question: string
  answer: string
  category: string | null
  priority: number
  is_active: boolean
}

export function FaqKnowledgePanel() {
  const { accountId } = useAuth()
  const [faqs, setFaqs] = useState<FaqItem[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [editingFaq, setEditingFaq] = useState<Partial<FaqItem> | null>(null)
  const [isNew, setIsNew] = useState(false)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState<string | null>(null)

  const supabase = createClient()

  const loadFaqs = useCallback(async () => {
    if (!accountId) return
    setLoading(true)
    const { data } = await supabase
      .from('company_faq')
      .select('*')
      .eq('account_id', accountId)
      .order('priority', { ascending: false })

    setFaqs(data ?? [])
    setLoading(false)
  }, [accountId, supabase])

  useEffect(() => { loadFaqs() }, [loadFaqs])

  const handleAdd = () => {
    setEditingFaq({ question: '', answer: '', category: '', priority: 0, is_active: true })
    setIsNew(true)
  }

  const handleEdit = (faq: FaqItem) => {
    setEditingFaq({ ...faq })
    setIsNew(false)
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this FAQ?')) return
    setDeleting(id)
    await supabase.from('company_faq').delete().eq('id', id)
    setFaqs(prev => prev.filter(f => f.id !== id))
    setDeleting(null)
  }

  const handleSave = async () => {
    if (!accountId || !editingFaq?.question?.trim() || !editingFaq?.answer?.trim()) return
    setSaving(true)

    const payload = {
      account_id: accountId,
      question: editingFaq.question!.trim(),
      answer: editingFaq.answer!.trim(),
      category: editingFaq.category?.trim() || null,
      priority: editingFaq.priority ?? 0,
      is_active: editingFaq.is_active ?? true,
    }

    if (isNew) {
      await supabase.from('company_faq').insert(payload)
    } else if (editingFaq.id) {
      await supabase.from('company_faq').update(payload).eq('id', editingFaq.id)
    }

    setSaving(false)
    setEditingFaq(null)
    loadFaqs()
  }

  const filteredFaqs = faqs.filter(f =>
    !search ||
    f.question.toLowerCase().includes(search.toLowerCase()) ||
    f.answer.toLowerCase().includes(search.toLowerCase()) ||
    f.category?.toLowerCase().includes(search.toLowerCase())
  )

  // Get unique categories
  const categories = [...new Set(faqs.map(f => f.category).filter(Boolean))] as string[]

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
            placeholder="Search FAQs..."
            className="w-full rounded-lg border border-border bg-background py-2 pl-9 pr-3 text-sm text-foreground placeholder:text-muted-foreground/50 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>
        <button
          onClick={handleAdd}
          className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90 transition-colors"
        >
          <Plus className="h-4 w-4" /> Add FAQ
        </button>
      </div>

      {/* Info */}
      <div className="rounded-lg border border-blue-500/20 bg-blue-500/5 p-3">
        <p className="text-xs text-blue-400">
          <HelpCircle className="mr-1.5 inline h-3.5 w-3.5" />
          FAQs are used by the AI assistant to quickly answer common customer questions. Higher priority FAQs are referenced first.
        </p>
      </div>

      {/* FAQ List */}
      {filteredFaqs.length === 0 ? (
        <div className="rounded-xl border border-border bg-card p-12 text-center">
          <HelpCircle className="mx-auto h-10 w-10 text-muted-foreground/40" />
          <p className="mt-3 text-sm text-muted-foreground">
            {search ? 'No FAQs match your search.' : 'No FAQs added yet. Add common questions to help the AI assist your customers.'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {/* Category filter chips */}
          {categories.length > 0 && (
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setSearch('')}
                className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${!search ? 'bg-primary text-white' : 'bg-muted text-muted-foreground hover:bg-muted/80'}`}
              >
                All
              </button>
              {categories.map(cat => (
                <button
                  key={cat}
                  onClick={() => setSearch(cat)}
                  className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${search === cat ? 'bg-primary text-white' : 'bg-muted text-muted-foreground hover:bg-muted/80'}`}
                >
                  {cat}
                </button>
              ))}
            </div>
          )}

          {filteredFaqs.map(faq => (
            <div key={faq.id} className="group rounded-xl border border-border bg-card p-4 hover:border-primary/30 transition-colors">
              <div className="flex items-start gap-3">
                <GripVertical className="mt-0.5 h-4 w-4 text-muted-foreground/30 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <h4 className="text-sm font-medium text-foreground">{faq.question}</h4>
                        {!faq.is_active && (
                          <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">Inactive</span>
                        )}
                      </div>
                      <p className="mt-1 text-sm text-muted-foreground leading-relaxed">{faq.answer}</p>
                      <div className="mt-2 flex items-center gap-3">
                        {faq.category && (
                          <span className="inline-block rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary">
                            {faq.category}
                          </span>
                        )}
                        <span className="text-[10px] text-muted-foreground/60">Priority: {faq.priority}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                      <button
                        onClick={() => handleEdit(faq)}
                        className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                        title="Edit"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => handleDelete(faq.id)}
                        disabled={deleting === faq.id}
                        className="rounded-md p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors disabled:opacity-50"
                        title="Delete"
                      >
                        {deleting === faq.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Edit / Add Modal */}
      {editingFaq && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-lg rounded-2xl border border-border bg-card p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-lg font-semibold text-foreground">
                {isNew ? 'Add FAQ' : 'Edit FAQ'}
              </h3>
              <button onClick={() => setEditingFaq(null)} className="rounded-md p-1 hover:bg-muted transition-colors">
                <X className="h-5 w-5 text-muted-foreground" />
              </button>
            </div>

            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Question *</label>
                <input
                  type="text"
                  value={editingFaq.question ?? ''}
                  onChange={e => setEditingFaq(prev => prev ? { ...prev, question: e.target.value } : prev)}
                  placeholder="What is your MOQ?"
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/50 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Answer *</label>
                <textarea
                  value={editingFaq.answer ?? ''}
                  onChange={e => setEditingFaq(prev => prev ? { ...prev, answer: e.target.value } : prev)}
                  placeholder="Our minimum order quantity varies by product..."
                  rows={4}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/50 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary resize-y"
                />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground">Category</label>
                  <input
                    type="text"
                    value={editingFaq.category ?? ''}
                    onChange={e => setEditingFaq(prev => prev ? { ...prev, category: e.target.value } : prev)}
                    placeholder="Shipping, Payment, etc."
                    list="faq-categories"
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/50 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                  <datalist id="faq-categories">
                    {categories.map(c => <option key={c} value={c} />)}
                  </datalist>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground">Priority (higher = first)</label>
                  <input
                    type="number"
                    value={editingFaq.priority ?? 0}
                    onChange={e => setEditingFaq(prev => prev ? { ...prev, priority: parseInt(e.target.value) || 0 } : prev)}
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>
              </div>
              <label className="flex items-center gap-2 text-sm text-foreground cursor-pointer">
                <input
                  type="checkbox"
                  checked={editingFaq.is_active ?? true}
                  onChange={e => setEditingFaq(prev => prev ? { ...prev, is_active: e.target.checked } : prev)}
                  className="rounded border-border"
                />
                Active (visible to AI)
              </label>
            </div>

            <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-border">
              <button onClick={() => setEditingFaq(null)} className="rounded-lg border border-border px-4 py-2 text-sm text-muted-foreground hover:bg-muted transition-colors">
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving || !editingFaq.question?.trim() || !editingFaq.answer?.trim()}
                className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90 disabled:opacity-50 transition-colors"
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                {saving ? 'Saving...' : 'Save FAQ'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
