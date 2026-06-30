"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { cn } from "@/lib/utils";
import type { Contact, Conversation, Profile, B2BLead, ChatNote, ConversationAuditLog } from "@/types";
import {
  Phone,
  Mail,
  Copy,
  Check,
  Plus,
  Calendar,
  Clock,
  Brain,
  Trash2,
  Star,
  Pin,
  Archive,
  Ban,
  CheckCircle2,
  X
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { format, isPast } from "date-fns";
import { toast } from "sonner";

export interface FollowupTask {
  id: string;
  account_id: string;
  lead_id: string;
  title: string;
  due_at: string | null;
  status: 'pending' | 'completed';
  assigned_to?: string | null;
  assignee?: Profile | null;
  created_at?: string;
  updated_at?: string;
}

type AuditLogWithAuthor = ConversationAuditLog & {
  author?: {
    full_name: string;
  } | null;
};

interface ContactSidebarProps {
  contact: Contact | null;
  conversation: Conversation | null;
  onRefresh?: () => void;
  profiles?: Profile[];
  onClose?: () => void;
}

type TabType = "overview" | "notes" | "followups" | "history" | "insights" | "settings";

export function ContactSidebar({
  contact,
  conversation,
  onRefresh,
  profiles = [],
  onClose,
}: ContactSidebarProps) {
  const { user, accountId } = useAuth();
  const contactPhone = contact?.phone;
  const userId = user?.id;

  const [activeTab, setActiveTab] = useState<TabType>("overview");
  const [copied, setCopied] = useState(false);
  const [lead, setLead] = useState<B2BLead | null>(null);
  const [crmLead, setCrmLead] = useState<any | null>(null);

  const [timelineData, setTimelineData] = useState({
    hasEnquiry: false,
    hasQuotation: false,
    hasProforma: false,
    hasSales: false,
    hasDelivery: false,
    hasPayment: false,
    hasCompleted: false,
    quotationNo: "",
    proformaNo: "",
    salesNo: "",
  });

  useEffect(() => {
    if (!contactPhone) return;
    const supabase = createClient();
    
    (async () => {
      try {
        // 1. Check CRM Lead for stage
        const { data: crmLeadData } = await supabase
          .from('crm_leads')
          .select('id, stage')
          .eq('phone', contactPhone)
          .is('deleted_at', null)
          .limit(1)
          .maybeSingle();

        // 2. Fetch Quotations
        const { data: quots } = await supabase
          .from('quotations')
          .select('quotation_no')
          .eq('mobile', contactPhone)
          .order('created_at', { ascending: false })
          .limit(1);

        // 3. Fetch Proformas
        const { data: profs } = await supabase
          .from('proformas')
          .select('proforma_no')
          .eq('mobile', contactPhone)
          .order('created_at', { ascending: false })
          .limit(1);

        // 4. Fetch Sales Registers
        const { data: salesRegs } = await supabase
          .from('sales_registers')
          .select('sales_register_no')
          .eq('mobile', contactPhone)
          .order('created_at', { ascending: false })
          .limit(1);

        const currentStage = crmLeadData?.stage;
        
        const hasEnquiry = !!crmLeadData;
        const hasQuotation = !!(quots && quots.length > 0);
        const hasProforma = !!(profs && profs.length > 0);
        const hasSales = !!(salesRegs && salesRegs.length > 0);
        
        const hasDelivery = currentStage === 'Dispatch' || currentStage === 'Payment' || currentStage === 'Appreciation';
        const hasPayment = currentStage === 'Payment' || currentStage === 'Appreciation';
        const hasCompleted = currentStage === 'Appreciation';

        setTimelineData({
          hasEnquiry,
          hasQuotation,
          hasProforma,
          hasSales,
          hasDelivery,
          hasPayment,
          hasCompleted,
          quotationNo: quots?.[0]?.quotation_no || "",
          proformaNo: profs?.[0]?.proforma_no || "",
          salesNo: salesRegs?.[0]?.sales_register_no || "",
        });
      } catch (err) {
        console.error("Error loading customer journey timeline:", err);
      }
    })();
  }, [contactPhone, crmLead]);

  const renderTimeline = () => {
    const steps = [
      { key: "enquiry", label: "Enquiry", completed: timelineData.hasEnquiry, active: timelineData.hasEnquiry && !timelineData.hasQuotation, details: lead?.platform ? `Via ${lead.platform}` : "" },
      { key: "quotation", label: "Quotation", completed: timelineData.hasQuotation, active: timelineData.hasQuotation && !timelineData.hasProforma, details: timelineData.quotationNo ? `No: ${timelineData.quotationNo}` : "" },
      { key: "proforma", label: "Proforma", completed: timelineData.hasProforma, active: timelineData.hasProforma && !timelineData.hasSales, details: timelineData.proformaNo ? `No: ${timelineData.proformaNo}` : "" },
      { key: "sales", label: "Sales Register", completed: timelineData.hasSales, active: timelineData.hasSales && !timelineData.hasDelivery, details: timelineData.salesNo ? `No: ${timelineData.salesNo}` : "" },
      { key: "delivery", label: "Delivery", completed: timelineData.hasDelivery, active: timelineData.hasDelivery && !timelineData.hasPayment, details: crmLead?.stage === "Dispatch" ? "Dispatched" : "" },
      { key: "payment", label: "Payment", completed: timelineData.hasPayment, active: timelineData.hasPayment && !timelineData.hasCompleted, details: crmLead?.stage === "Payment" ? "Awaiting Confirmation" : "" },
      { key: "completed", label: "Completed", completed: timelineData.hasCompleted, active: timelineData.hasCompleted, details: "" },
    ];

    return (
      <div className="mt-4 border-t border-slate-800 pt-4">
        <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-3">Customer Journey Timeline</h4>
        <div className="relative pl-6 space-y-4">
          <div className="absolute left-2.5 top-1.5 bottom-1.5 w-0.5 bg-slate-800" />

          {steps.map((step, idx) => {
            const isCompleted = step.completed;
            const isActive = step.active;
            return (
              <div key={step.key} className="relative flex flex-col gap-0.5">
                <div
                  className={cn(
                    "absolute -left-6 top-1 h-5 w-5 rounded-full border-2 flex items-center justify-center transition-all bg-slate-900 z-10",
                    isCompleted
                      ? "border-emerald-500 bg-emerald-500/10 text-emerald-400"
                      : isActive
                      ? "border-blue-500 bg-blue-500/10 text-blue-450 scale-105"
                      : "border-slate-800 text-slate-600"
                  )}
                  style={{ left: "-21px", width: "18px", height: "18px" }}
                >
                  {isCompleted ? (
                    <span className="text-[8px] font-bold">✓</span>
                  ) : (
                    <span className="text-[8px] font-bold">{idx + 1}</span>
                  )}
                </div>

                <div className="flex flex-col pl-1">
                  <span
                    className={cn(
                      "text-xs font-bold transition-colors",
                      isCompleted ? "text-slate-200" : isActive ? "text-blue-455 font-extrabold" : "text-slate-500"
                    )}
                  >
                    {step.label}
                  </span>
                  {step.details && (
                    <span className="text-[9.5px] text-slate-400 mt-0.5 font-mono">
                      {step.details}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const isBlocked = useMemo(() => {
    return !!contact?.blocked && contact.blocked.length > 0;
  }, [contact?.blocked]);

  // Notes tab state
  const [notes, setNotes] = useState<(ChatNote & { author?: { full_name: string; avatar_url?: string | null } | null })[]>([]);
  const [newNoteText, setNewNoteText] = useState("");
  const [addingNote, setAddingNote] = useState(false);

  // Follow-ups state
  const [followups, setFollowups] = useState<FollowupTask[]>([]);
  const [loadingFollowups, setLoadingFollowups] = useState(false);
  const [newFollowupTitle, setNewFollowupTitle] = useState("");
  const [newFollowupDate, setNewFollowupDate] = useState("");
  const [addingFollowup, setAddingFollowup] = useState(false);

  // History state
  const [auditLogs, setAuditLogs] = useState<AuditLogWithAuthor[]>([]);

  // Fetch B2B Lead associated with the conversation
  const fetchLeadInfo = useCallback(async () => {
    if (!conversation) return;
    const supabase = createClient();
    try {
      // 1. Fetch CRM Lead
      const { data: crmLeadData } = await supabase
        .from('crm_leads')
        .select('*, assignee:profiles!assigned_to(*)')
        .eq('conversation_id', conversation.id)
        .is('deleted_at', null)
        .maybeSingle();

      if (crmLeadData) {
        setCrmLead(crmLeadData);
      } else if (contactPhone) {
        const { data: crmLeadByPhone } = await supabase
          .from('crm_leads')
          .select('*, assignee:profiles!assigned_to(*)')
          .eq('phone', contactPhone)
          .is('deleted_at', null)
          .limit(1)
          .maybeSingle();
        setCrmLead(crmLeadByPhone);
      } else {
        setCrmLead(null);
      }

      // 2. Find lead_id in lead_conversations for B2B Lead
      const { data: lc } = await supabase
        .from('lead_conversations')
        .select('lead_id')
        .eq('conversation_id', conversation.id)
        .maybeSingle();

      if (lc?.lead_id) {
        // Fetch B2B lead details
        const { data: b2bLead } = await supabase
          .from('b2b_leads')
          .select('*, assignee:profiles!assigned_to(*)')
          .eq('id', lc.lead_id)
          .is('deleted_at', null)
          .maybeSingle();

        setLead(b2bLead as B2BLead | null);
      } else {
        // Fallback: search lead by contact's phone
        if (contactPhone) {
          const { data: b2bLead } = await supabase
            .from('b2b_leads')
            .select('*, assignee:profiles!assigned_to(*)')
            .eq('mobile', contactPhone)
            .is('deleted_at', null)
            .limit(1)
            .maybeSingle();
          
          setLead(b2bLead as B2BLead | null);
        } else {
          setLead(null);
        }
      }
    } catch (err) {
      console.error("Error fetching lead info:", err);
    }
  }, [conversation, contactPhone]);

  // Fetch Chat Notes
  const fetchNotes = useCallback(async () => {
    if (!conversation) return;
    const supabase = createClient();
    const { data } = await supabase
      .from('chat_notes')
      .select('*, author:profiles!user_id(full_name, avatar_url)')
      .eq('conversation_id', conversation.id)
      .is('deleted_at', null)
      .order('is_pinned', { ascending: false })
      .order('created_at', { ascending: false });

    setNotes((data as (ChatNote & { author?: { full_name: string; avatar_url?: string | null } | null })[]) ?? []);
  }, [conversation]);

  // Fetch Follow-up tasks
  const fetchFollowups = useCallback(async () => {
    if (!lead) {
      setFollowups([]);
      return;
    }
    setLoadingFollowups(true);
    const supabase = createClient();
    const { data } = await supabase
      .from('followup_tasks')
      .select('*, assignee:profiles!assigned_to(*)')
      .eq('lead_id', lead.id)
      .order('due_at', { ascending: true });

    setFollowups((data as FollowupTask[]) ?? []);
    setLoadingFollowups(false);
  }, [lead]);

  // Fetch History Logs
  const fetchHistory = useCallback(async () => {
    if (!conversation) return;
    const supabase = createClient();
    const { data: logs } = await supabase
      .from('conversation_audit_logs')
      .select('*, author:profiles!user_id(full_name)')
      .eq('conversation_id', conversation.id)
      .order('created_at', { ascending: false });

    setAuditLogs((logs as AuditLogWithAuthor[]) ?? []);
  }, [conversation]);

  // Trigger loads on mount/updates
  useEffect(() => {
    if (conversation) {
      Promise.resolve().then(() => {
        fetchLeadInfo();
        fetchNotes();
        fetchHistory();
      });
    } else {
      Promise.resolve().then(() => {
        setLead(null);
        setNotes([]);
        setFollowups([]);
        setAuditLogs([]);
      });
    }
  }, [conversation, fetchLeadInfo, fetchNotes, fetchHistory]);

  // Fetch follow-ups once lead is resolved
  useEffect(() => {
    if (lead) {
      Promise.resolve().then(() => {
        fetchFollowups();
      });
    }
  }, [lead, fetchFollowups]);

  // Copy Phone helper
  const handleCopyPhone = useCallback(async () => {
    if (!contactPhone) return;
    await navigator.clipboard.writeText(contactPhone);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [contactPhone]);

  // Notes operations
  const handleAddNote = useCallback(async () => {
    if (!conversation || !newNoteText.trim() || !userId) return;
    setAddingNote(true);
    const supabase = createClient();

    const { data, error } = await supabase
      .from('chat_notes')
      .insert({
        conversation_id: conversation.id,
        user_id: userId,
        note_text: newNoteText.trim(),
        is_pinned: false
      })
      .select('*, author:profiles!user_id(full_name, avatar_url)')
      .single();

    if (error) {
      toast.error("Failed to add internal note");
    } else {
      setNotes(prev => [data as (ChatNote & { author?: { full_name: string; avatar_url?: string | null } | null }), ...prev]);
      setNewNoteText("");
      toast.success("Note added");
      
      // Log audit
      await supabase.from('conversation_audit_logs').insert({
        conversation_id: conversation.id,
        user_id: userId,
        action: 'note_added',
        new_value: newNoteText.trim().substring(0, 100)
      });
      fetchHistory();
    }
    setAddingNote(false);
  }, [conversation, newNoteText, userId, fetchHistory]);

  const handleTogglePinNote = useCallback(async (noteId: string, currentPin: boolean) => {
    const supabase = createClient();
    const { error } = await supabase
      .from('chat_notes')
      .update({ is_pinned: !currentPin })
      .eq('id', noteId);

    if (error) {
      toast.error("Failed to update note pin status");
    } else {
      setNotes(prev => prev.map(n => n.id === noteId ? { ...n, is_pinned: !currentPin } : n)
        .sort((a, b) => (b.is_pinned ? 1 : 0) - (a.is_pinned ? 1 : 0))
      );
      toast.success(!currentPin ? "Note pinned" : "Note unpinned");
    }
  }, []);

  const handleDeleteNote = useCallback(async (noteId: string) => {
    if (!window.confirm("Delete this note?")) return;
    const supabase = createClient();
    const { error } = await supabase
      .from('chat_notes')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', noteId);

    if (error) {
      toast.error("Failed to delete note");
    } else {
      setNotes(prev => prev.filter(n => n.id !== noteId));
      toast.success("Note deleted");
    }
  }, []);

  // Followup operations
  const handleAddFollowup = useCallback(async () => {
    if (!lead || !newFollowupTitle.trim() || !newFollowupDate || !accountId) return;
    setAddingFollowup(true);
    const supabase = createClient();

    const { data, error } = await supabase
      .from('followup_tasks')
      .insert({
        account_id: accountId,
        lead_id: lead.id,
        title: newFollowupTitle.trim(),
        due_at: new Date(newFollowupDate).toISOString(),
        status: 'pending',
        assigned_to: user?.id
      })
      .select('*, assignee:profiles!assigned_to(*)')
      .single();

    if (error) {
      toast.error("Failed to schedule follow-up");
    } else {
      setFollowups(prev => [...prev, data as FollowupTask]);
      setNewFollowupTitle("");
      setNewFollowupDate("");
      toast.success("Follow-up scheduled");

      if (conversation) {
        await supabase.from('conversation_audit_logs').insert({
          conversation_id: conversation.id,
          user_id: user?.id,
          action: 'followup_scheduled',
          new_value: newFollowupTitle.trim()
        });
        fetchHistory();
      }
    }
    setAddingFollowup(false);
  }, [lead, newFollowupTitle, newFollowupDate, accountId, user?.id, conversation, fetchHistory]);

  const handleCompleteFollowup = useCallback(async (taskId: string, currentStatus: string) => {
    const supabase = createClient();
    const nextStatus = currentStatus === 'completed' ? 'pending' : 'completed';
    const { error } = await supabase
      .from('followup_tasks')
      .update({ status: nextStatus })
      .eq('id', taskId);

    if (error) {
      toast.error("Failed to update task status");
    } else {
      setFollowups(prev => prev.map(f => f.id === taskId ? { ...f, status: nextStatus } : f));
      toast.success(nextStatus === 'completed' ? "Follow-up marked complete" : "Follow-up re-opened");
    }
  }, []);

  // CRM Settings Actions
  const handleArchiveSetting = async () => {
    if (!conversation) return;
    const supabase = createClient();
    const newArchived = !(conversation.settings?.is_archived ?? false);
    const { error } = await supabase
      .from('conversation_settings')
      .upsert({
        conversation_id: conversation.id,
        is_archived: newArchived,
        updated_at: new Date().toISOString()
      }, { onConflict: 'conversation_id' });

    if (error) toast.error("Failed to update archive setting");
    else {
      toast.success(newArchived ? "Archived conversation" : "Unarchived conversation");
      onRefresh?.();
    }
  };

  const handlePinSetting = async () => {
    if (!conversation) return;
    const supabase = createClient();
    const newPinned = !(conversation.settings?.is_pinned ?? false);
    const { error } = await supabase
      .from('conversation_settings')
      .upsert({
        conversation_id: conversation.id,
        is_pinned: newPinned,
        updated_at: new Date().toISOString()
      }, { onConflict: 'conversation_id' });

    if (error) toast.error("Failed to update pin setting");
    else {
      toast.success(newPinned ? "Pinned conversation" : "Unpinned conversation");
      onRefresh?.();
    }
  };

  const handleStarSetting = async () => {
    if (!conversation) return;
    const supabase = createClient();
    const newStarred = !(conversation.settings?.is_starred ?? false);
    const { error } = await supabase
      .from('conversation_settings')
      .upsert({
        conversation_id: conversation.id,
        is_starred: newStarred,
        updated_at: new Date().toISOString()
      }, { onConflict: 'conversation_id' });

    if (error) toast.error("Failed to update favorite setting");
    else {
      toast.success(newStarred ? "Starred conversation" : "Unstarred conversation");
      onRefresh?.();
    }
  };

  const handleBlockSetting = async () => {
    if (!conversation || !contact) return;
    const supabase = createClient();

    if (isBlocked) {
      const { error } = await supabase.from('blocked_contacts').delete().eq('contact_id', contact.id);
      if (error) toast.error("Failed to unblock contact");
      else {
        toast.success("Contact unblocked");
        onRefresh?.();
      }
    } else {
      const { error } = await supabase.from('blocked_contacts').insert({
        account_id: contact.account_id,
        contact_id: contact.id,
        blocked_by: user?.id,
        reason: "Blocked from Settings panel"
      });
      if (error) toast.error("Failed to block contact");
      else {
        toast.success("Contact blocked");
        onRefresh?.();
      }
    }
  };

  const handleToggleAISetting = async () => {
    if (!conversation) return;
    const supabase = createClient();
    const nextMode = !conversation.ai_mode;
    const { error } = await supabase
      .from('conversations')
      .update({ ai_mode: nextMode })
      .eq('id', conversation.id);

    if (error) toast.error("Failed to update AI setting");
    else {
      toast.success(nextMode ? "AI Auto-Replies Enabled" : "AI Auto-Replies Disabled");
      onRefresh?.();
    }
  };

  const handleMuteSetting = async () => {
    if (!conversation) return;
    const supabase = createClient();
    const newMuted = !(conversation.settings?.is_muted ?? false);
    const { error } = await supabase
      .from('conversation_settings')
      .upsert({
        conversation_id: conversation.id,
        is_muted: newMuted,
        updated_at: new Date().toISOString()
      }, { onConflict: 'conversation_id' });

    if (error) toast.error("Failed to update mute setting");
    else {
      toast.success(newMuted ? "Notifications muted" : "Notifications unmuted");
      onRefresh?.();
    }
  };

  const handleAssignTeammateSetting = async (agentId: string | null) => {
    if (!conversation) return;
    const supabase = createClient();
    const { error } = await supabase
      .from('conversations')
      .update({ assigned_agent_id: agentId })
      .eq('id', conversation.id);

    if (error) toast.error("Failed to update assignee");
    else {
      toast.success(agentId ? "Teammate assigned" : "Teammate unassigned");
      onRefresh?.();
    }
  };

  if (!contact) {
    return (
      <div className="flex h-full w-full items-center justify-center border-l border-slate-800 bg-slate-900 relative">
        {onClose && (
          <button
            onClick={onClose}
            className="absolute top-3 right-3 flex h-7 w-7 items-center justify-center rounded-full text-slate-500 hover:text-slate-200 hover:bg-slate-800 transition-colors"
            aria-label="Close contact panel"
          >
            <X className="h-4 w-4" />
          </button>
        )}
        <p className="text-sm text-slate-500">Select a conversation</p>
      </div>
    );
  }

  const displayName = contact.name || contact.phone || "Unknown Customer";
  const initials = displayName.charAt(0).toUpperCase();

  // AI insights mocked values derived from conversation details
  const aiInsights = {
    score: lead?.quantity ? Math.min(65 + parseInt(lead.quantity) * 2, 98) : 75,
    probability: lead?.status === 'converted' ? "100%" : lead?.status === 'rejected' ? "0%" : "68%",
    sentiment: lead?.message?.toLowerCase().includes("urgent") || lead?.message?.toLowerCase().includes("quick") ? "High Intent" : "Neutral",
    summary: lead?.message ? `Customer is interested in "${lead.product_name || "B2B Products"}". Notes in request: "${lead.message}".` : "No prior lead description available.",
    recommendation: "Send product demo video and share catalog template."
  };

  return (
    <div className="flex h-full w-full flex-col border-l border-slate-800 bg-slate-900 shrink-0">
      {/* Customer Profile Card — with close button */}
      <div className="p-4 border-b border-slate-800/80 bg-slate-900/50 shrink-0 flex flex-col items-center text-center relative">
        {onClose && (
          <button
            onClick={onClose}
            className="absolute top-3 right-3 flex h-7 w-7 items-center justify-center rounded-full text-slate-500 hover:text-slate-200 hover:bg-slate-800 transition-colors"
            aria-label="Close contact panel"
          >
            <X className="h-4 w-4" />
          </button>
        )}
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-slate-700 text-base font-semibold text-white">
          {contact.avatar_url ? (
            <img
              src={contact.avatar_url}
              alt={displayName}
              className="h-14 w-14 rounded-full object-cover"
            />
          ) : (
            initials
          )}
        </div>
        <h3 className="mt-2 text-sm font-semibold text-slate-100">{displayName}</h3>
        {contact.company && (
          <p className="text-xs text-slate-400 mt-0.5">{contact.company}</p>
        )}

        {/* Contact direct buttons */}
        <div className="mt-3 flex items-center gap-1.5 w-full">
          <button
            onClick={handleCopyPhone}
            className="flex-1 flex items-center justify-center gap-1.5 rounded bg-slate-800 px-2 py-1.5 text-xs text-slate-300 hover:bg-slate-750 transition-colors border border-slate-700/60"
          >
            <Phone className="h-3 w-3 text-slate-500" />
            <span className="truncate text-[10px]">{contact.phone}</span>
            {copied ? (
              <Check className="h-3 w-3 text-emerald-400" />
            ) : (
              <Copy className="h-2.5 w-2.5 text-slate-500" />
            )}
          </button>

          {contact.email && (
            <div className="flex-1 flex items-center justify-center gap-1.5 rounded bg-slate-850 px-2 py-1.5 text-xs text-slate-400 border border-slate-800/60 truncate">
              <Mail className="h-3 w-3 text-slate-600 shrink-0" />
              <span className="truncate text-[10px]">{contact.email}</span>
            </div>
          )}
        </div>
      </div>

      {/* Tabs list bar */}
      <div className="flex items-center gap-0.5 border-b border-slate-800 overflow-x-auto scrollbar-none bg-slate-950 px-1 py-1 shrink-0">
        {(["overview", "notes", "followups", "history", "insights", "settings"] as TabType[]).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={cn(
              "px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider rounded transition-colors whitespace-nowrap",
              activeTab === tab
                ? "bg-slate-800 text-white"
                : "text-slate-500 hover:text-slate-350"
            )}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Tab Contents Area */}
      <ScrollArea className="flex-1 min-h-0 bg-slate-900/40">
        <div className="p-3 text-slate-300">
          
          {/* TAB: OVERVIEW */}
          {activeTab === "overview" && (
            <div className="space-y-4">
              <div>
                <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-2">Lead Information</h4>
                <div className="space-y-2 text-xs bg-slate-850 p-2.5 rounded-lg border border-slate-800">
                  <div className="flex justify-between"><span className="text-slate-450">Platform:</span> <span className="font-medium text-slate-205">{lead?.platform || "Direct Contact"}</span></div>
                  <div className="flex justify-between"><span className="text-slate-455">Interested in:</span> <span className="font-medium text-slate-205 truncate max-w-[150px]">{lead?.product_name || "Not Specified"}</span></div>
                  <div className="flex justify-between"><span className="text-slate-455">Quantity:</span> <span className="font-medium text-slate-205">{lead?.quantity || "--"}</span></div>
                  <div className="flex justify-between"><span className="text-slate-455">Lead Status:</span> <span className="font-semibold text-emerald-400 capitalize">{lead?.status || "active"}</span></div>
                  {lead?.inquiry_at && (
                    <div className="flex justify-between"><span className="text-slate-455">Inquiry Date:</span> <span className="text-slate-200">{format(new Date(lead.inquiry_at), "MMM d, yyyy HH:mm")}</span></div>
                  )}
                </div>
              </div>

              {lead?.message && (
                <div>
                  <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-2">Original Message</h4>
                  <div className="bg-slate-850 p-2.5 rounded-lg border border-slate-800 text-xs italic text-slate-400 leading-relaxed">
                    &ldquo;{lead.message}&rdquo;
                  </div>
                </div>
              )}

              <div>
                <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-2">Location</h4>
                <div className="space-y-1 text-xs bg-slate-850 p-2.5 rounded-lg border border-slate-800 text-slate-200">
                  {lead?.city && <div>City: {lead.city}</div>}
                  {lead?.state && <div>State: {lead.state}</div>}
                  {lead?.country && <div>Country: {lead.country}</div>}
                  {!lead?.city && <div className="text-slate-500 italic">No location details provided</div>}
                </div>
              </div>

              {renderTimeline()}
            </div>
          )}

          {/* TAB: NOTES */}
          {activeTab === "notes" && (
            <div className="space-y-3">
              {/* Notes composer */}
              <div className="space-y-1.5">
                <textarea
                  value={newNoteText}
                  onChange={(e) => setNewNoteText(e.target.value)}
                  placeholder="Write an internal teammate note..."
                  rows={2}
                  className="w-full resize-none rounded-lg border border-slate-750 bg-slate-800 px-3 py-2 text-xs text-white placeholder-slate-500 outline-none focus:border-emerald-500/50 transition-colors"
                />
                <Button
                  size="sm"
                  className="w-full h-8 bg-emerald-600 hover:bg-emerald-500 text-white gap-1"
                  onClick={handleAddNote}
                  disabled={!newNoteText.trim() || addingNote}
                >
                  <Plus className="h-3.5 w-3.5" />
                  Add Note
                </Button>
              </div>

              {/* Notes list */}
              <div className="space-y-2.5 mt-4">
                {notes.length === 0 ? (
                  <p className="text-xs text-slate-500 text-center py-6">No internal notes added yet</p>
                ) : (
                  notes.map((note) => (
                    <div
                      key={note.id}
                      className={cn(
                        "rounded-lg bg-slate-850 border p-2.5 relative group transition-all",
                        note.is_pinned ? "border-amber-500/30" : "border-slate-800"
                      )}
                    >
                      <div className="flex items-center justify-between gap-1.5 mb-1.5">
                        <span className="text-[10px] font-bold text-slate-300">
                          {note.author?.full_name || "Teammate"}
                        </span>
                        <div className="flex items-center gap-1.5 opacity-80 lg:opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={() => handleTogglePinNote(note.id, note.is_pinned)}
                            title={note.is_pinned ? "Unpin note" : "Pin note"}
                            className="text-slate-400 hover:text-amber-400"
                          >
                            <Pin className={cn("h-3 w-3", note.is_pinned && "fill-amber-400 text-amber-400")} />
                          </button>
                          <button
                            onClick={() => handleDeleteNote(note.id)}
                            title="Delete note"
                            className="text-slate-400 hover:text-red-400"
                          >
                            <Trash2 className="h-3 w-3" />
                          </button>
                        </div>
                      </div>
                      <p className="text-xs text-slate-200 whitespace-pre-wrap leading-normal">
                        {note.note_text}
                      </p>
                      <p className="mt-2 text-[9px] text-slate-500 text-right">
                        {format(new Date(note.created_at), "MMM d, HH:mm")}
                      </p>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* TAB: FOLLOW-UPS */}
          {activeTab === "followups" && (
            <div className="space-y-4">
              {/* Add follow up form */}
              {lead ? (
                <div className="space-y-2 bg-slate-850 p-2.5 rounded-lg border border-slate-800">
                  <h5 className="text-[10.5px] font-bold uppercase tracking-wider text-slate-400">Schedule Follow-up</h5>
                  <div className="space-y-1.5">
                    <input
                      type="text"
                      value={newFollowupTitle}
                      onChange={(e) => setNewFollowupTitle(e.target.value)}
                      placeholder="Call client / Send pricing..."
                      className="w-full rounded-md border border-slate-750 bg-slate-800 px-2.5 py-1.5 text-xs text-white placeholder-slate-500 outline-none focus:border-emerald-500/50"
                    />
                    <input
                      type="datetime-local"
                      value={newFollowupDate}
                      onChange={(e) => setNewFollowupDate(e.target.value)}
                      className="w-full rounded-md border border-slate-750 bg-slate-800 px-2.5 py-1.5 text-xs text-white placeholder-slate-500 outline-none focus:border-emerald-500/50"
                    />
                    <Button
                      size="sm"
                      className="w-full h-8 bg-emerald-600 hover:bg-emerald-500 text-white"
                      onClick={handleAddFollowup}
                      disabled={!newFollowupTitle.trim() || !newFollowupDate || addingFollowup}
                    >
                      Schedule
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="text-xs text-slate-500 text-center py-4 bg-slate-850 rounded-lg border border-slate-800">
                  This contact has no associated B2B lead to schedule follow-ups.
                </div>
              )}

              {/* Lists */}
              <div>
                <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-2">Tasks List</h4>
                <div className="space-y-2">
                  {loadingFollowups ? (
                    <div className="text-center py-4 text-xs text-slate-500">Loading tasks...</div>
                  ) : followups.length === 0 ? (
                    <p className="text-xs text-slate-500 text-center py-6">No scheduled follow-up tasks</p>
                  ) : (
                    followups.map((task) => {
                      const completed = task.status === "completed";
                      const missed = !completed && task.due_at && isPast(new Date(task.due_at));
                      return (
                        <div
                          key={task.id}
                          className={cn(
                            "rounded-lg bg-slate-850 border p-2.5 flex items-start justify-between gap-3",
                            completed ? "border-emerald-500/20 bg-emerald-500/2" : missed ? "border-rose-500/20" : "border-slate-800"
                          )}
                        >
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5">
                              <span className={cn(
                                "text-xs font-semibold text-slate-200",
                                completed && "line-through text-slate-500"
                              )}>
                                {task.title}
                              </span>
                              {missed && (
                                <span className="bg-rose-500/20 text-rose-400 border border-rose-500/20 rounded px-1 text-[8.5px] font-bold">
                                  MISSED
                                </span>
                              )}
                            </div>
                            {task.due_at && (
                              <p className="text-[9.5px] text-slate-500 mt-1 flex items-center gap-1 font-mono">
                                <Calendar className="h-3 w-3 shrink-0" />
                                {format(new Date(task.due_at), "MMM d, yyyy HH:mm")}
                              </p>
                            )}
                          </div>
                          <button
                            onClick={() => handleCompleteFollowup(task.id, task.status)}
                            className="shrink-0 text-slate-400 hover:text-emerald-400 mt-0.5"
                            title={completed ? "Mark incomplete" : "Mark completed"}
                          >
                            {completed ? (
                              <CheckCircle2 className="h-4 w-4 text-emerald-400 fill-emerald-500/10" />
                            ) : (
                              <div className="h-4 w-4 rounded-full border-2 border-slate-600 hover:border-emerald-500" />
                            )}
                          </button>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </div>
          )}

          {/* TAB: HISTORY */}
          {activeTab === "history" && (
            <div className="space-y-4">
              <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">Timeline Events</h4>
              <div className="relative border-l border-slate-800 pl-4 ml-2.5 space-y-4">
                
                {/* Notes and events combined */}
                {auditLogs.map((log) => (
                  <div key={log.id} className="relative">
                    {/* Node Dot */}
                    <span className="absolute -left-[22.5px] top-1.5 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-slate-900 border border-slate-700">
                      <Clock className="h-2 w-2 text-slate-500" />
                    </span>
                    <div>
                      <p className="text-xs font-semibold text-slate-350">{log.action.replace(/_/g, ' ')}</p>
                      {log.new_value && (
                        <p className="text-[11px] text-slate-500 mt-0.5">{log.new_value}</p>
                      )}
                      <p className="text-[9px] text-slate-600 mt-0.5">
                        By {log.author?.full_name || "Teammate"} • {format(new Date(log.created_at), "MMM d, HH:mm")}
                      </p>
                    </div>
                  </div>
                ))}

                {/* Lead creation */}
                {lead && (
                  <div className="relative">
                    <span className="absolute -left-[22.5px] top-1.5 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-slate-900 border border-amber-500/40">
                      <Plus className="h-2.5 w-2.5 text-amber-500" />
                    </span>
                    <div>
                      <p className="text-xs font-semibold text-slate-300">Lead Created</p>
                      <p className="text-[11px] text-slate-500 mt-0.5">Imported from {lead.platform} marketplace</p>
                      <p className="text-[9px] text-slate-600 mt-0.5">
                        {format(new Date(lead.created_at), "MMM d, yyyy HH:mm")}
                      </p>
                    </div>
                  </div>
                )}
                
                {/* Fallback */}
                {auditLogs.length === 0 && !lead && (
                  <p className="text-xs text-slate-500 text-center py-6">No historical timeline records found</p>
                )}
              </div>
            </div>
          )}

          {/* TAB: AI INSIGHTS */}
          {activeTab === "insights" && (
            <div className="space-y-4">
              {/* Widgets row */}
              <div className="grid grid-cols-3 gap-2">
                <div className="bg-slate-850 p-2 rounded-lg border border-slate-850 text-center">
                  <div className="text-[9px] font-bold text-slate-500 uppercase">Lead Score</div>
                  <div className="text-base font-extrabold text-amber-500 mt-0.5">{aiInsights.score}</div>
                </div>
                <div className="bg-slate-850 p-2 rounded-lg border border-slate-850 text-center">
                  <div className="text-[9px] font-bold text-slate-500 uppercase">Sentiment</div>
                  <div className="text-xs font-bold text-emerald-450 mt-1 truncate">{aiInsights.sentiment}</div>
                </div>
                <div className="bg-slate-850 p-2 rounded-lg border border-slate-850 text-center">
                  <div className="text-[9px] font-bold text-slate-500 uppercase">Conversion</div>
                  <div className="text-base font-extrabold text-indigo-400 mt-0.5">{aiInsights.probability}</div>
                </div>
              </div>

              {/* AI Summary */}
              <div className="bg-emerald-500/5 border border-emerald-500/10 p-3 rounded-lg space-y-1.5">
                <h5 className="text-[10.5px] font-bold text-emerald-400 flex items-center gap-1">
                  <Brain className="h-3.5 w-3.5 fill-emerald-400/10" />
                  AI Summary
                </h5>
                <p className="text-[11.5px] text-slate-300 leading-relaxed">
                  {aiInsights.summary}
                </p>
              </div>

              {/* Recommended Next Actions */}
              <div className="bg-slate-850 p-3 rounded-lg border border-slate-800 space-y-1.5">
                <h5 className="text-[10.5px] font-bold text-slate-400">Recommended Next Actions</h5>
                <p className="text-[11.5px] text-slate-350 leading-relaxed">
                  {aiInsights.recommendation}
                </p>
              </div>
            </div>
          )}

          {/* TAB: SETTINGS */}
          {activeTab === "settings" && (
            <div className="space-y-4">
              <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-2">Operational Controls</h4>
              <div className="space-y-1.5">
                
                {/* Archive / Unarchive */}
                <button
                  onClick={handleArchiveSetting}
                  className="w-full flex items-center justify-between rounded bg-slate-850 px-3 py-2 text-xs text-slate-300 hover:bg-slate-800 border border-slate-800"
                >
                  <span>{conversation?.settings?.is_archived ? "Unarchive Chat" : "Archive Chat"}</span>
                  <Archive className="h-3.5 w-3.5 text-slate-500" />
                </button>

                {/* Pin / Unpin */}
                <button
                  onClick={handlePinSetting}
                  className="w-full flex items-center justify-between rounded bg-slate-850 px-3 py-2 text-xs text-slate-300 hover:bg-slate-800 border border-slate-800"
                >
                  <span>{conversation?.settings?.is_pinned ? "Unpin Chat" : "Pin Chat"}</span>
                  <Pin className="h-3.5 w-3.5 text-slate-500" />
                </button>

                {/* Star / Unstar */}
                <button
                  onClick={handleStarSetting}
                  className="w-full flex items-center justify-between rounded bg-slate-850 px-3 py-2 text-xs text-slate-300 hover:bg-slate-800 border border-slate-800"
                >
                  <span>{conversation?.settings?.is_starred ? "Remove from Favorites" : "Mark as Favorite"}</span>
                  <Star className="h-3.5 w-3.5 text-slate-500" />
                </button>

                {/* Block / Unblock */}
                <button
                  onClick={handleBlockSetting}
                  className={cn(
                    "w-full flex items-center justify-between rounded px-3 py-2 text-xs border",
                    isBlocked 
                      ? "bg-rose-500/10 text-rose-400 border-rose-500/20 hover:bg-rose-500/20" 
                      : "bg-slate-850 text-rose-400 border-slate-800 hover:bg-slate-800"
                  )}
                >
                  <span>{isBlocked ? "Unblock Contact" : "Block Contact"}</span>
                  <Ban className="h-3.5 w-3.5" />
                </button>

                {/* AI mode toggle */}
                <button
                  onClick={handleToggleAISetting}
                  className={cn(
                    "w-full flex items-center justify-between rounded px-3 py-2 text-xs border transition-colors",
                    conversation?.ai_mode 
                      ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/25 hover:bg-emerald-500/20"
                      : "bg-slate-850 text-slate-300 border-slate-800 hover:bg-slate-800"
                  )}
                >
                  <span>{conversation?.ai_mode ? "Disable AI Replies" : "Enable AI Replies"}</span>
                  <Brain className="h-3.5 w-3.5" />
                </button>

                {/* Mute Notifications */}
                <button
                  onClick={handleMuteSetting}
                  className="w-full flex items-center justify-between rounded bg-slate-850 px-3 py-2 text-xs text-slate-300 hover:bg-slate-800 border border-slate-800"
                >
                  <span>{conversation?.settings?.is_muted ? "Unmute Notifications" : "Mute Notifications"}</span>
                  <Clock className="h-3.5 w-3.5 text-slate-500" />
                </button>
              </div>

              {/* Assignment Selector inside settings */}
              <div>
                <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-500 mt-4 mb-2">Assign Teammate</h4>
                <select
                  value={conversation?.assigned_agent_id || ""}
                  onChange={(e) => handleAssignTeammateSetting(e.target.value || null)}
                  className="w-full rounded border border-slate-750 bg-slate-850 px-2.5 py-1.5 text-xs text-slate-300 outline-none focus:border-emerald-500/50"
                >
                  <option value="">-- Unassigned --</option>
                  {profiles.map((p) => (
                    <option key={p.id} value={p.user_id}>
                      {p.full_name} {p.user_id === user?.id ? "(Me)" : ""}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}

        </div>
      </ScrollArea>
    </div>
  );
}
