"use client"

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/hooks/use-auth'
import { toast } from 'sonner'
import {
  Building,
  MapPin,
  ExternalLink,
  UserCheck,
  Calendar,
  Loader2,
  Clock,
  Sparkles,
  Phone
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import type { B2BLead, Profile } from '@/types'

function formatInquiryDate(dateStr: string | null | undefined): { dateFormatted: string; timeFormatted: string; relativeTime: string } | null {
  if (!dateStr) return null;
  const dateObj = new Date(dateStr);
  if (isNaN(dateObj.getTime())) return null;

  const day = dateObj.getDate();
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const month = months[dateObj.getMonth()];
  const year = dateObj.getFullYear();

  let hours = dateObj.getHours();
  const minutes = String(dateObj.getMinutes()).padStart(2, '0');
  const ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12;
  hours = hours ? hours : 12;
  const formattedHours = String(hours).padStart(2, '0');

  const dateFormatted = `${day} ${month} ${year}`;
  const timeFormatted = `${formattedHours}:${minutes} ${ampm}`;

  const now = new Date();
  const diffMs = now.getTime() - dateObj.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  let relativeTime = '';
  if (diffMins < 1) {
    relativeTime = 'just now';
  } else if (diffMins < 60) {
    relativeTime = `${diffMins} minute${diffMins > 1 ? 's' : ''} ago`;
  } else if (diffHours < 24) {
    relativeTime = `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
  } else if (diffDays === 1) {
    relativeTime = 'Yesterday';
  } else {
    relativeTime = `${diffDays} days ago`;
  }

  return { dateFormatted, timeFormatted, relativeTime };
}

export function RealtimeLeadFeed({ activePlatform = 'all' }: { activePlatform?: string }) {
  const router = useRouter()
  const supabase = createClient()
  const { accountId } = useAuth()

  const [leads, setLeads] = useState<B2BLead[]>([])
  const [staff, setStaff] = useState<Profile[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedLead, setSelectedLead] = useState<B2BLead | null>(null)
  
  // Follow-up form state
  const [followupLeadId, setFollowupLeadId] = useState<string | null>(null)
  const [followupTitle, setFollowupTitle] = useState('')
  const [followupDue, setFollowupDue] = useState('')
  const [creatingFollowup, setCreatingFollowup] = useState(false)

  // Fetch initial leads
  const fetchLeads = useCallback(async () => {
    if (!accountId) return
    try {
      let query = supabase
        .from('b2b_leads')
        .select(`
          *,
          assignee:profiles!b2b_leads_assigned_to_fkey(*)
        `)
        .eq('account_id', accountId)
        .is('deleted_at', null)
        .order('inquiry_at', { ascending: false, nullsFirst: false })
        .limit(20)

      if (activePlatform !== 'all') {
        query = query.eq('platform', activePlatform)
      }

      const { data, error } = await query
      if (error) throw error

      setLeads((data as B2BLead[]) || [])
    } catch (err) {
      console.error('Error fetching real-time leads:', err)
    } finally {
      setLoading(false)
    }
  }, [accountId, activePlatform, supabase])

  // Fetch staff list
  const fetchStaff = useCallback(async () => {
    if (!accountId) return
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('account_id', accountId)
        .in('account_role', ['owner', 'admin', 'agent'])

      if (error) throw error
      setStaff((data as Profile[]) || [])
    } catch (err) {
      console.error('Error fetching staff:', err)
    }
  }, [accountId, supabase])

  useEffect(() => {
    Promise.resolve().then(() => {
      fetchLeads()
      fetchStaff()
    })
  }, [fetchLeads, fetchStaff])

  // Real-time subscription
  useEffect(() => {
    if (!accountId) return

    const channel = supabase
      .channel('realtime_lead_feed_chan')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'b2b_leads', filter: `account_id=eq.${accountId}` },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            const newLead = payload.new as B2BLead
            
            // Check if active filter matches platform
            if (activePlatform === 'all' || newLead.platform === activePlatform) {
              setLeads((prev) => [newLead, ...prev.slice(0, 19)])
              toast.info(`🔔 New ${newLead.platform} Lead`, {
                description: `${newLead.buyer_name || 'Buyer'} • ${newLead.product_name || 'Enquiry'}`,
                duration: 5000
              })
            }
          } else if (payload.eventType === 'UPDATE') {
            const updated = payload.new as B2BLead
            setLeads((prev) =>
              prev.map((l) => (l.id === updated.id ? { ...l, ...updated } : l))
            )
          } else if (payload.eventType === 'DELETE') {
            const deleted = payload.old as { id: string }
            setLeads((prev) => prev.filter((l) => l.id !== deleted.id))
          }
        }
      )
      .subscribe()

    return () => {
      void supabase.removeChannel(channel)
    }
  }, [accountId, activePlatform, supabase])

  // Handle lead assignment update
  const handleAssign = async (leadId: string, staffId: string | null) => {
    try {
      const res = await fetch('/api/integrations/leads/assign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ leadId, staffId })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to update assignment')
      
      toast.success(data.message || 'Assignee updated')
      fetchLeads()
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err)
      toast.error(errorMsg || 'Failed to assign lead')
    }
  }

  // Handle follow-up task creation
  const handleCreateFollowup = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!followupLeadId || !followupTitle || !followupDue || !accountId) return
    setCreatingFollowup(true)

    try {
      const { error } = await supabase
        .from('followup_tasks')
        .insert({
          account_id: accountId,
          lead_id: followupLeadId,
          title: followupTitle,
          due_at: new Date(followupDue).toISOString(),
          status: 'pending'
        })

      if (error) throw error

      toast.success('Follow-up task created successfully!')
      setFollowupLeadId(null)
      setFollowupTitle('')
      setFollowupDue('')
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err)
      toast.error(errorMsg || 'Failed to create follow-up task')
    } finally {
      setCreatingFollowup(false)
    }
  }

  // Helper to calculate score deterministically based on message and length
  const getScore = (lead: B2BLead) => {
    let score = 50
    if (!lead.message) return score
    
    const text = lead.message.toLowerCase()
    if (text.includes('urgent') || text.includes('immediately')) score += 20
    if (text.includes('price') || text.includes('quote') || text.includes('rate')) score += 15
    if (text.includes('buy') || text.includes('purchase') || text.includes('bulk')) score += 15
    if (lead.quantity && parseFloat(lead.quantity) >= 50) score += 10
    
    return Math.min(score, 99)
  }

  const getPlatformStyle = (platform: string) => {
    switch (platform) {
      case 'INDIAMART':
        return 'bg-sky-500/10 text-sky-500 dark:text-sky-400 border-sky-500/20'
      case 'TRADEINDIA':
        return 'bg-amber-500/10 text-amber-500 dark:text-amber-400 border-amber-500/20'
      case 'EXPORTERSINDIA':
        return 'bg-teal-500/10 text-teal-500 dark:text-teal-400 border-teal-500/20'
      default:
        return 'bg-slate-500/10 text-slate-500 dark:text-slate-400 border-slate-500/20'
    }
  }

  const getStatusStyle = (status: string) => {
    switch (status) {
      case 'converted':
        return 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20'
      case 'rejected':
        return 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20'
      case 'pending':
        return 'bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-500/20'
      default:
        return 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20'
    }
  }

  if (loading) {
    return (
      <div className="flex h-48 items-center justify-center rounded-xl border border-border bg-card">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
        <span className="ml-2 text-sm text-muted-foreground">Loading realtime lead feed...</span>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Real-time Lead Activity</h3>
          <p className="text-xs text-muted-foreground mt-0.5">Live marketplace streams showing new incoming requests</p>
        </div>
        <Badge className="bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 flex items-center gap-1.5 py-1">
          <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
          Live Connected
        </Badge>
      </div>

      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-foreground">
            <thead className="bg-muted text-muted-foreground font-semibold border-b border-border uppercase tracking-wider text-[10px]">
              <tr>
                <th className="px-5 py-3.5">Platform</th>
                <th className="px-5 py-3.5">Buyer</th>
                <th className="px-5 py-3.5">Requirement</th>
                <th className="px-5 py-3.5">Intent Score</th>
                <th className="px-5 py-3.5">Inquiry Date</th>
                <th className="px-5 py-3.5">Status</th>
                <th className="px-5 py-3.5 text-right">Quick Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {leads.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-5 py-12 text-center text-muted-foreground">
                    No leads received yet. Setup integrations to begin receiving live leads.
                  </td>
                </tr>
              ) : (
                leads.map((lead) => {
                  const score = getScore(lead)
                  const scoreColor = score >= 75 ? 'text-rose-500' : score >= 55 ? 'text-amber-500' : 'text-slate-400'
                  const info = formatInquiryDate(lead.inquiry_at)
                  
                  return (
                    <tr key={lead.id} className="hover:bg-muted/40 transition align-middle">
                      {/* Platform */}
                      <td className="px-5 py-4">
                        <span className={`inline-flex items-center border px-2 py-0.5 rounded text-[10px] font-bold ${getPlatformStyle(lead.platform)}`}>
                          {lead.platform}
                        </span>
                      </td>

                      {/* Buyer */}
                      <td className="px-5 py-4">
                        <div className="font-semibold text-foreground">{lead.buyer_name || 'Anonymous'}</div>
                        {lead.company_name && (
                          <div className="text-[10px] text-muted-foreground flex items-center gap-1 mt-0.5">
                            <Building className="h-3 w-3" />
                            {lead.company_name}
                          </div>
                        )}
                        <div className="text-[10px] text-muted-foreground flex items-center gap-1 mt-0.5">
                          <MapPin className="h-3 w-3" />
                          {[lead.city, lead.state].filter(Boolean).join(', ') || 'India'}
                        </div>
                      </td>

                      {/* Requirement */}
                      <td className="px-5 py-4 max-w-[200px]">
                        <div className="font-semibold text-foreground truncate">{lead.product_name || 'General Enquiry'}</div>
                        <p className="text-[10px] text-muted-foreground line-clamp-1 mt-0.5" title={lead.message || ''}>
                          {lead.message || 'No description provided'}
                        </p>
                      </td>

                      {/* Intent Score */}
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-1 font-bold text-sm">
                          <Sparkles className={`h-3.5 w-3.5 ${scoreColor}`} />
                          <span className={scoreColor}>{score}</span>
                        </div>
                      </td>

                      {/* Inquiry Date */}
                      <td className="px-5 py-4 text-muted-foreground whitespace-nowrap leading-relaxed">
                        {info ? (
                          <>
                            <div className="font-semibold text-foreground">{info.dateFormatted}</div>
                            <div className="text-[11px] text-muted-foreground">{info.timeFormatted}</div>
                            <div className="text-[10px] text-slate-500 mt-0.5 flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {info.relativeTime}
                            </div>
                          </>
                        ) : '--'}
                      </td>

                      {/* Status */}
                      <td className="px-5 py-4">
                        <span className={`inline-flex items-center border px-2 py-0.5 rounded text-[10px] font-semibold ${getStatusStyle(lead.status)}`}>
                          {lead.status}
                        </span>
                      </td>

                      {/* Quick Actions */}
                      <td className="px-5 py-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* Open Dialog */}
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setSelectedLead(lead)}
                            className="h-7 w-7 p-0 hover:bg-muted text-muted-foreground hover:text-foreground"
                            title="Open Lead"
                          >
                            <ExternalLink className="h-3.5 w-3.5" />
                          </Button>

                          {/* Assign Inline */}
                          <div className="relative group/assign">
                            <select
                              value={lead.assigned_to || ''}
                              onChange={(e) => handleAssign(lead.id, e.target.value || null)}
                              className="appearance-none rounded border border-border bg-background py-1 pl-2 pr-6 text-[10px] font-semibold text-muted-foreground focus:outline-none hover:bg-muted cursor-pointer"
                            >
                              <option value="">Unassigned</option>
                              {staff.map((s) => (
                                <option key={s.id} value={s.id}>
                                  {s.full_name}
                                </option>
                              ))}
                            </select>
                            <UserCheck className="absolute right-1.5 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground pointer-events-none" />
                          </div>

                          {/* WhatsApp link */}
                          {lead.mobile && (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => router.push(`/inbox?phone=${encodeURIComponent(lead.mobile || '')}&name=${encodeURIComponent(lead.buyer_name || '')}&docType=enquiry&docId=${lead.id}`)}
                              className="h-7 w-7 p-0 hover:bg-emerald-500/10 text-emerald-500"
                              title="Chat on WhatsApp"
                            >
                              <Phone className="h-3.5 w-3.5" />
                            </Button>
                          )}

                          {/* Follow-up button */}
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setFollowupLeadId(lead.id)}
                            className="h-7 w-7 p-0 hover:bg-primary/10 text-primary"
                            title="Schedule Follow-up"
                          >
                            <Calendar className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Follow-up schedule dialog */}
      {followupLeadId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-sm rounded-xl border border-border bg-card p-6 shadow-xl">
            <h3 className="text-sm font-bold text-foreground flex items-center gap-1.5">
              <Calendar className="h-4 w-4 text-primary" />
              Schedule Follow-up
            </h3>
            <p className="text-xs text-muted-foreground mt-1">Create a reminder task for this marketplace lead.</p>
            
            <form onSubmit={handleCreateFollowup} className="mt-4 space-y-3">
              <div>
                <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block mb-1">
                  Task Title
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Call client for price quote"
                  value={followupTitle}
                  onChange={(e) => setFollowupTitle(e.target.value)}
                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-xs text-foreground placeholder-muted-foreground focus:outline-none focus:border-primary"
                />
              </div>

              <div>
                <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block mb-1">
                  Due Date & Time
                </label>
                <input
                  type="datetime-local"
                  required
                  value={followupDue}
                  onChange={(e) => setFollowupDue(e.target.value)}
                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-xs text-foreground focus:outline-none focus:border-primary"
                />
              </div>

              <div className="flex gap-2 justify-end pt-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setFollowupLeadId(null)}
                  className="text-xs text-muted-foreground hover:bg-muted"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  disabled={creatingFollowup}
                  className="text-xs bg-primary hover:bg-primary/90 text-primary-foreground"
                >
                  {creatingFollowup ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : null}
                  Schedule Reminders
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Details Dialog */}
      {selectedLead && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-xl border border-border bg-card p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <h3 className="text-sm font-bold text-foreground">Lead Details</h3>
              <Badge className={getPlatformStyle(selectedLead.platform)}>
                {selectedLead.platform}
              </Badge>
            </div>

            <div className="grid grid-cols-2 gap-3.5 text-xs">
              <div>
                <span className="text-[10px] uppercase font-bold text-muted-foreground block">Buyer Name</span>
                <span className="font-semibold text-foreground">{selectedLead.buyer_name || 'N/A'}</span>
              </div>
              <div>
                <span className="text-[10px] uppercase font-bold text-muted-foreground block">Company</span>
                <span className="font-semibold text-foreground">{selectedLead.company_name || 'N/A'}</span>
              </div>
              <div>
                <span className="text-[10px] uppercase font-bold text-muted-foreground block">Email</span>
                <span className="text-foreground">{selectedLead.email || 'N/A'}</span>
              </div>
              <div>
                <span className="text-[10px] uppercase font-bold text-muted-foreground block">Phone</span>
                <span className="text-foreground">{selectedLead.mobile || 'N/A'}</span>
              </div>
              <div className="col-span-2">
                <span className="text-[10px] uppercase font-bold text-muted-foreground block">Product demanded</span>
                <span className="font-semibold text-foreground">{selectedLead.product_name || 'N/A'} (Qty: {selectedLead.quantity || 'N/A'})</span>
              </div>
              <div className="col-span-2 border-t border-border pt-3">
                <span className="text-[10px] uppercase font-bold text-muted-foreground block">Requirement Message</span>
                <p className="text-muted-foreground mt-1 leading-relaxed bg-muted/40 p-2.5 rounded border border-border/50 text-[11px]">
                  {selectedLead.message || 'No requirement description was provided by the buyer.'}
                </p>
              </div>
            </div>

            <div className="flex justify-end gap-2 border-t border-border pt-3">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setSelectedLead(null)}
                className="text-xs"
              >
                Close details
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
