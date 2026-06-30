"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { cn } from "@/lib/utils";
import type {
  Conversation,
  Message,
  MessageReaction,
  Contact,
  ConversationStatus,
  MessageTemplate,
  Profile,
} from "@/types";
import {
  MessageSquare,
  ChevronDown,
  UserPlus,
  Check,
  Clock,
  ArrowLeft,
  RefreshCw,
  Phone,
  Share2,
  Star,
  MoreVertical,
  Download,
  User,
  ArrowDown,
  Zap,
  Users,
  UserRound,
} from "lucide-react";
import { format, isToday, isYesterday, differenceInHours } from "date-fns";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ScrollArea } from "@/components/ui/scroll-area";
import { MessageBubble } from "./message-bubble";
import { MessageActions } from "./message-actions";
import { MessageComposer } from "./message-composer";
import { TemplatePicker } from "./template-picker";
import { buildReplyPreview } from "./reply-quote";
import { toast } from "sonner";

interface ReplyDraft {
  id: string;
  authorLabel: string;
  preview: string;
}

function renderTemplateBody(body: string, params: string[]): string {
  return body.replace(/\{\{(\d+)\}\}/g, (_, raw) => {
    const idx = Number(raw) - 1;
    return params[idx] ?? `{{${raw}}}`;
  });
}

interface MessageThreadProps {
  conversation: Conversation | null;
  contact: Contact | null;
  messages: Message[];
  onMessagesLoaded: (messages: Message[]) => void;
  onNewMessage: (message: Message) => void;
  onUpdateMessage: (id: string, updates: Partial<Message>) => void;
  onStatusChange: (conversationId: string, status: ConversationStatus) => void;
  onAssignChange: (
    conversationId: string,
    assignedAgentId: string | null,
  ) => void;
  /**
   * On mobile, the thread is shown full-screen with the conversation list
   * hidden. This callback lets the page deselect the active conversation
   * and reveal the list again. Rendered as a back-arrow in the header on
   * mobile only.
   */
  onBack?: () => void;
  /**
   * Increment to force the messages + reactions fetch effects to refire.
   * Parent bumps this on realtime reconnect / tab visibility → visible
   * so the open thread catches up on any events sent while the WS was
   * disconnected or the tab was throttled. Optional so existing callers
   * keep working.
   */
  resyncToken?: number;
  /**
   * Fired by the manual-refresh button in the thread header. The parent
   * typically bumps the same `resyncToken` it controls — this gives the
   * user a way to force a refetch when they suspect realtime missed an
   * event (or they're impatient). Optional so existing callers keep
   * working; the button is only rendered when this is provided.
   */
  onRefresh?: () => void;
  /**
   * Fired when the AI auto-reply mode is toggled for this conversation.
   */
  onToggleAI?: (conversationId: string, aiMode: boolean) => void;
  /**
   * Fired when the conversation is soft-deleted.
   */
  onDelete?: (conversationId: string) => void;
  /**
   * Opens the right-hand contact details panel. Called when the user
   * clicks the avatar or customer name in the chat header.
   */
  onOpenContactPanel?: () => void;
}

function formatDateSeparator(dateStr: string): string {
  const date = new Date(dateStr);
  if (isToday(date)) return "Today";
  if (isYesterday(date)) return "Yesterday";
  return format(date, "MMMM d, yyyy");
}

function groupMessagesByDate(messages: Message[]) {
  const groups: { date: string; messages: Message[] }[] = [];
  let currentDate = "";

  for (const msg of messages) {
    const day = format(new Date(msg.created_at), "yyyy-MM-dd");
    if (day !== currentDate) {
      currentDate = day;
      groups.push({ date: msg.created_at, messages: [msg] });
    } else {
      groups[groups.length - 1].messages.push(msg);
    }
  }

  return groups;
}

const STATUS_OPTIONS: { label: string; value: ConversationStatus; color: string }[] = [
  { label: "Open", value: "open", color: "text-primary" },
  { label: "Pending", value: "pending", color: "text-amber-400" },
  { label: "Closed", value: "closed", color: "text-slate-400" },
];

/**
 * WhatsApp-style doodle background applied to the chat area (both the
 * active thread and the empty state). Uses the true WhatsApp dark colour
 * #0B141A as the base with the SVG tile for texture.
 *
 * Defined once at module scope so the two render paths can't drift.
 */
const DOODLE_BG_CLASSES = "bg-[#0B141A] bg-[url('/inbox-doodle.svg')] bg-repeat";

export function MessageThread({
  conversation,
  contact,
  messages,
  onMessagesLoaded,
  onNewMessage,
  onUpdateMessage,
  onStatusChange,
  onAssignChange,
  onBack,
  resyncToken = 0,
  onRefresh,
  onToggleAI,
  onDelete,
  onOpenContactPanel,
}: MessageThreadProps) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [templateModalOpen, setTemplateModalOpen] = useState(false);
  // Scroll-to-bottom FAB state (BUG 10)
  const [showScrollBtn, setShowScrollBtn] = useState(false);

  const handleScrollMessages = useCallback(() => {
    if (!scrollRef.current) return;
    const el = scrollRef.current;
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    setShowScrollBtn(distanceFromBottom > 120);
  }, []);

  const scrollToBottom = useCallback(() => {
    if (!scrollRef.current) return;
    scrollRef.current.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, []);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [reactions, setReactions] = useState<MessageReaction[]>([]);
  const [togglingAI, setTogglingAI] = useState(false);

  const handleToggleAI = useCallback(async () => {
    if (!conversation || togglingAI) return;
    setTogglingAI(true);
    const newMode = !conversation.ai_mode;
    try {
      const supabase = createClient();
      const { error } = await supabase
        .from("conversations")
        .update({ ai_mode: newMode })
        .eq("id", conversation.id);

      if (error) {
        toast.error("Failed to toggle AI mode");
        console.error(error);
      } else {
        if (onToggleAI) {
          onToggleAI(conversation.id, newMode);
        }
        toast.success(`AI auto-reply ${newMode ? "enabled" : "disabled"}`);
      }
    } catch (err) {
      console.error(err);
      toast.error("An error occurred");
    } finally {
      setTogglingAI(false);
    }
  }, [conversation, togglingAI, onToggleAI]);

  // Purely visual spin state for the manual-refresh button. The actual
  // refetch is fire-and-forget through `onRefresh` (which bumps the
  // parent's resyncToken); the 700ms spin is just feedback so the click
  // doesn't feel like a no-op. Cleared via the timer ref on unmount.
  const [isRefreshing, setIsRefreshing] = useState(false);
  const refreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    return () => {
      if (refreshTimerRef.current !== null) {
        clearTimeout(refreshTimerRef.current);
      }
    };
  }, []);
  const handleRefreshClick = useCallback(() => {
    if (isRefreshing || !onRefresh) return;
    setIsRefreshing(true);
    onRefresh();
    refreshTimerRef.current = setTimeout(() => {
      setIsRefreshing(false);
      refreshTimerRef.current = null;
    }, 700);
  }, [isRefreshing, onRefresh]);
  const [replyTo, setReplyTo] = useState<ReplyDraft | null>(null);

  const [isDeleting, setIsDeleting] = useState(false);
  const handleDeleteClick = useCallback(async () => {
    if (!conversation || isDeleting) return;
    if (
      !window.confirm(
        "Are you sure you want to delete this conversation? This will hide it from the inbox."
      )
    ) {
      return;
    }
    setIsDeleting(true);
    try {
      const supabase = createClient();
      const { error } = await supabase
        .from("conversations")
        .update({ deleted_at: new Date().toISOString() })
        .eq("id", conversation.id);

      if (error) {
        console.error("Failed to delete conversation:", error);
        toast.error("Failed to delete conversation");
      } else {
        toast.success("Conversation deleted");
        if (onDelete) {
          onDelete(conversation.id);
        }
      }
    } catch (err) {
      console.error(err);
      toast.error("An error occurred");
    } finally {
      setIsDeleting(false);
    }
  }, [conversation, isDeleting, onDelete]);

  const handleToggleStar = useCallback(async () => {
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

    if (error) {
      toast.error("Failed to update favorite status");
    } else {
      toast.success(newStarred ? "Added to favorites" : "Removed from favorites");
      onRefresh?.();
    }
  }, [conversation, onRefresh]);

  const handleToggleMute = useCallback(async () => {
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

    if (error) {
      toast.error("Failed to update mute status");
    } else {
      toast.success(newMuted ? "Conversation muted" : "Conversation unmuted");
      onRefresh?.();
    }
  }, [conversation, onRefresh]);

  const handleToggleArchive = useCallback(async () => {
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

    if (error) {
      toast.error("Failed to update archive status");
    } else {
      toast.success(newArchived ? "Conversation archived" : "Conversation unarchived");
      onRefresh?.();
    }
  }, [conversation, onRefresh]);

  const handleToggleBlock = useCallback(async () => {
    if (!conversation || !contact) return;
    const supabase = createClient();
    const isBlocked = !!contact.blocked && contact.blocked.length > 0;

    if (isBlocked) {
      const { error } = await supabase
        .from('blocked_contacts')
        .delete()
        .eq('contact_id', contact.id);

      if (error) {
        toast.error("Failed to unblock contact");
      } else {
        toast.success("Contact unblocked");
        onRefresh?.();
      }
    } else {
      const { error } = await supabase
        .from('blocked_contacts')
        .insert({
          account_id: contact.account_id,
          contact_id: contact.id,
          blocked_by: user?.id,
          reason: "Blocked by agent"
        });

      if (error) {
        toast.error("Failed to block contact");
      } else {
        toast.success("Contact blocked");
        onRefresh?.();
      }
    }
  }, [conversation, contact, user?.id, onRefresh]);

  const handleExportChat = useCallback(() => {
    if (!messages.length) {
      toast.error("No messages to export");
      return;
    }
    const headers = ["Timestamp", "Sender", "Type", "Content"];
    const rows = messages.map(m => [
      m.created_at,
      m.sender_type,
      m.content_type,
      m.content_text || m.media_url || ''
    ]);
    const csvContent = "data:text/csv;charset=utf-8," 
      + [headers.join(","), ...rows.map(r => r.map(val => `"${String(val).replace(/"/g, '""')}"`).join(","))].join("\n");
    
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `chat_export_${conversation?.id}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success("Chat exported as CSV");
  }, [messages, conversation?.id]);

  // Profiles are bounded by RLS to rows the current user is allowed to
  // see — today that's just the current user, but the dropdown keeps the
  // shape ready for shared-team workspaces without a refactor.
  useEffect(() => {
    let cancelled = false;
    const supabase = createClient();
    supabase
      .from("profiles")
      .select("*")
      .order("full_name")
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) {
          console.error("Failed to fetch profiles:", error);
          return;
        }
        setProfiles((data as Profile[]) ?? []);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // 24-hour session timer
  const sessionInfo = useMemo(() => {
    if (!messages.length) return { expired: false, remaining: "" };

    // Find last customer message
    const lastCustomerMsg = [...messages]
      .reverse()
      .find((m) => m.sender_type === "customer");

    if (!lastCustomerMsg) return { expired: false, remaining: "" };

    const hoursSince = differenceInHours(new Date(), new Date(lastCustomerMsg.created_at));
    const expired = hoursSince >= 24;

    if (expired) {
      return { expired: true, remaining: "Expired" };
    }

    const hoursLeft = 24 - hoursSince;
    const remaining =
      hoursLeft >= 1
        ? `${Math.floor(hoursLeft)}h remaining`
        : `${Math.floor(hoursLeft * 60)}m remaining`;

    return { expired, remaining };
  }, [messages]);

  // Store latest callback in a ref so fetchMessages doesn't need to
  // depend on `onMessagesLoaded` — otherwise parent re-renders cause
  // fetchMessages to change → useEffect re-fires → refetch → realtime
  // UPDATE on conversations.unread_count → parent re-renders → LOOP.
  // The ref is written inside an effect so the mutation doesn't happen
  // during render (React 19 refs rule); consumers only read `.current`
  // inside the async fetch completion, which runs after the render.
  const onMessagesLoadedRef = useRef(onMessagesLoaded);
  useEffect(() => {
    onMessagesLoadedRef.current = onMessagesLoaded;
  });

  const conversationId = conversation?.id;
  const hasUnread = (conversation?.unread_count ?? 0) > 0;

  // Fetch messages whenever the selected conversation changes. Kept
  // separate from the unread-reset effect so that incoming messages
  // arriving while the thread is open don't trigger a full refetch —
  // they only flip hasUnread, which only the reset effect listens to.
  useEffect(() => {
    if (!conversationId) return;

    const supabase = createClient();
    let cancelled = false;

    (async () => {
      setLoading(true);

      const { data, error } = await supabase
        .from("messages")
        .select("*")
        .eq("conversation_id", conversationId)
        .order("created_at", { ascending: true });

      if (cancelled) return;

      if (error) {
        console.error("Failed to fetch messages:", error);
      } else {
        onMessagesLoadedRef.current(data ?? []);
      }

      if (!cancelled) setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
    // `resyncToken` is included so the parent can force a refetch when
    // the realtime channel reconnects or the tab regains focus —
    // realtime is best-effort and any message events sent while the WS
    // was disconnected or throttled are otherwise lost.
  }, [conversationId, resyncToken]);

  // Reactions fetch — pulls the current state from the DB. Kept separate
  // from the channel subscription below so a `resyncToken` bump just
  // refetches the rows without also tearing down and rebuilding the
  // realtime channel.
  useEffect(() => {
    if (!conversationId) {
      Promise.resolve().then(() => setReactions([]));
      return;
    }
    const supabase = createClient();
    let cancelled = false;

    (async () => {
      const { data, error } = await supabase
        .from("message_reactions")
        .select("*")
        .eq("conversation_id", conversationId);
      if (cancelled) return;
      if (error) {
        console.error("Failed to fetch reactions:", error);
        return;
      }
      setReactions((data as MessageReaction[]) ?? []);
    })();

    return () => {
      cancelled = true;
    };
  }, [conversationId, resyncToken]);

  // Reactions realtime subscription per conversation. Subscribing here
  // (not at the page level) keeps the channel scoped to the visible
  // conversation and avoids cross-conversation chatter on a busy inbox.
  useEffect(() => {
    if (!conversationId) return;
    const supabase = createClient();

    const channel = supabase
      .channel(`reactions:${conversationId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "message_reactions",
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload) => {
          const row = payload.new as MessageReaction;
          setReactions((prev) => {
            if (prev.some((r) => r.id === row.id)) return prev;
            // Swap any matching optimistic temp row for the real one so
            // the pill doesn't double up after a successful POST.
            const tempIdx = prev.findIndex(
              (r) =>
                r.id.startsWith("temp-") &&
                r.message_id === row.message_id &&
                r.actor_type === row.actor_type &&
                r.actor_id === row.actor_id,
            );
            if (tempIdx >= 0) {
              const copy = prev.slice();
              copy[tempIdx] = row;
              return copy;
            }
            return [...prev, row];
          });
        },
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "message_reactions",
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload) => {
          const row = payload.new as MessageReaction;
          setReactions((prev) => prev.map((r) => (r.id === row.id ? row : r)));
        },
      )
      .on(
        "postgres_changes",
        {
          event: "DELETE",
          schema: "public",
          table: "message_reactions",
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload) => {
          const old = payload.old as Partial<MessageReaction>;
          if (!old?.id) return;
          setReactions((prev) => prev.filter((r) => r.id !== old.id));
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [conversationId]);

  // Clear any in-progress reply draft when the active conversation changes —
  // a quote pulled from conversation A shouldn't bleed into conversation B.
  useEffect(() => {
    Promise.resolve().then(() => setReplyTo(null));
  }, [conversationId]);

  // Reset the server-side unread_count to 0 whenever an unread count
  // surfaces on the active conversation — covers both (a) opening a
  // conversation that had unread messages and (b) new messages arriving
  // while the user is already viewing the thread (webhook server-bumps
  // unread_count to N+1; the realtime UPDATE propagates it into the
  // client, which re-runs this effect and flips it back to 0).
  //
  // Guarding on hasUnread prevents the eq-update loop: once unread_count
  // is 0 the condition is false, so no further UPDATE is issued.
  useEffect(() => {
    if (!conversationId || !hasUnread) return;
    const supabase = createClient();
    supabase
      .from("conversations")
      .update({ unread_count: 0 })
      .eq("id", conversationId)
      .then(({ error }) => {
        if (error) console.error("Failed to reset unread_count:", error);
      });
  }, [conversationId, hasUnread]);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (scrollRef.current) {
      const el = scrollRef.current;
      el.scrollTop = el.scrollHeight;
    }
  }, [messages]);

  const handleSend = useCallback(
    async (text: string, replyToId?: string, attachment?: { file: File; type: 'image' | 'video' | 'audio' | 'document'; previewUrl: string } | null) => {
      if (!conversation) return;

      const tempId = `temp-${Date.now()}`;
      const contentType = attachment ? attachment.type : "text";
      const mediaUrl = attachment ? attachment.previewUrl : undefined;

      // Optimistic update — shows the message immediately with "sending" status
      const optimisticMsg: Message = {
        id: tempId,
        conversation_id: conversation.id,
        sender_type: "agent",
        content_type: contentType,
        content_text: text || (attachment ? attachment.file.name : ""),
        media_url: mediaUrl,
        status: "sending",
        created_at: new Date().toISOString(),
        reply_to_message_id: replyToId,
      };
      onNewMessage(optimisticMsg);
      setReplyTo(null);

      try {
        if (attachment) {
          const supabase = createClient();
          const { data: { session } } = await supabase.auth.getSession();
          const user = session?.user;
          let accountId = (conversation as any).account_id || "default";
          if (user) {
            const { data: profile } = await supabase
              .from("profiles")
              .select("account_id")
              .eq("user_id", user.id)
              .maybeSingle();
            if (profile?.account_id) {
              accountId = profile.account_id;
            }
          }

          const ext = attachment.file.name.split(".").pop()?.toLowerCase() ?? "bin";
          const safeBase = attachment.file.name
            .replace(/\.[^.]+$/, "")
            .replace(/[^a-zA-Z0-9_-]+/g, "_")
            .slice(0, 40) || "file";
          const path = `account-${accountId}/${Date.now()}-${safeBase}.${ext}`;

          const { error: upErr } = await supabase.storage
            .from("flow-media")
            .upload(path, attachment.file, {
              cacheControl: "3600",
              upsert: false,
              contentType: attachment.file.type,
            });

          if (upErr) {
            throw new Error(`Storage upload failed: ${upErr.message}`);
          }

          const { data: { publicUrl } } = supabase.storage
            .from("flow-media")
            .getPublicUrl(path);

          const res = await fetch("/api/whatsapp/send", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              conversation_id: conversation.id,
              message_type: attachment.type,
              media_url: publicUrl,
              content_text: text || attachment.file.name,
              reply_to_message_id: replyToId,
            }),
          });

          const payload = await res.json().catch(() => ({}));
          if (!res.ok) {
            const reason = payload?.error || `HTTP ${res.status}`;
            throw new Error(reason);
          }

          onUpdateMessage(tempId, { status: "sent", media_url: publicUrl });
          return;
        }

        const res = await fetch("/api/whatsapp/send", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            conversation_id: conversation.id,
            message_type: "text",
            content_text: text,
            reply_to_message_id: replyToId,
          }),
        });

        const payload = await res.json().catch(() => ({}));

        if (!res.ok) {
          const reason = payload?.error || `HTTP ${res.status}`;
          console.error("Failed to send message:", reason);
          toast.error(`Failed to send: ${reason}`);
          // Mark the optimistic bubble as failed so the user sees what happened
          onUpdateMessage(tempId, { status: "failed" });
          return;
        }

        // Success — the realtime INSERT event will replace the temp bubble
        // with the real DB row. If realtime hasn't arrived yet, at least
        // flip status to 'sent' so the UI stops showing "sending".
        onUpdateMessage(tempId, { status: "sent" });
      } catch (err) {
        console.error("Failed to send message:", err);
        const reason = err instanceof Error ? err.message : "network error";
        toast.error(`Failed to send: ${reason}`);
        onUpdateMessage(tempId, { status: "failed" });
      }
    },
    [conversation, onNewMessage, onUpdateMessage]
  );

  const handleStatusChange = useCallback(
    async (status: ConversationStatus) => {
      if (!conversation) return;

      const supabase = createClient();
      await supabase
        .from("conversations")
        .update({ status })
        .eq("id", conversation.id);

      onStatusChange(conversation.id, status);
    },
    [conversation, onStatusChange]
  );

  const handleOpenTemplates = useCallback(() => {
    setTemplateModalOpen(true);
  }, []);

  const handleSendTemplate = useCallback(
    async (
      template: MessageTemplate,
      values: {
        body: string[];
        headerText?: string;
        buttonParams?: Record<number, string>;
      },
    ) => {
      if (!conversation) return;

      const renderedBody = renderTemplateBody(template.body_text, values.body);
      const tempId = `temp-${Date.now()}`;

      const optimisticMsg: Message = {
        id: tempId,
        conversation_id: conversation.id,
        sender_type: "agent",
        content_type: "template",
        content_text: renderedBody,
        template_name: template.name,
        status: "sending",
        created_at: new Date().toISOString(),
      };
      onNewMessage(optimisticMsg);

      try {
        const res = await fetch("/api/whatsapp/send", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            conversation_id: conversation.id,
            message_type: "template",
            template_name: template.name,
            template_language: template.language,
            // Structured params drive the new send-builder path
            // (header media + URL button substitution). Body values
            // are mirrored under both shapes so the route can fall
            // back if the template row isn't found locally.
            template_message_params: {
              body: values.body,
              headerText: values.headerText,
              buttonParams: values.buttonParams,
            },
            template_params: values.body,
            content_text: renderedBody,
          }),
        });

        const payload = await res.json().catch(() => ({}));

        if (!res.ok) {
          const reason = payload?.error || `HTTP ${res.status}`;
          console.error("Failed to send template:", reason);
          toast.error(`Failed to send template: ${reason}`);
          onUpdateMessage(tempId, { status: "failed" });
          return;
        }

        onUpdateMessage(tempId, { status: "sent" });
      } catch (err) {
        console.error("Failed to send template:", err);
        const reason = err instanceof Error ? err.message : "network error";
        toast.error(`Failed to send template: ${reason}`);
        onUpdateMessage(tempId, { status: "failed" });
      }
    },
    [conversation, onNewMessage, onUpdateMessage],
  );

  // Build a quick id → Message map so reply quotes can be rendered without
  // an extra fetch — the thread already holds the full conversation.
  const messagesById = useMemo(() => {
    const map = new Map<string, Message>();
    for (const m of messages) map.set(m.id, m);
    return map;
  }, [messages]);

  // Bucket reactions by their target message_id for O(1) per-bubble lookup.
  const reactionsByMessageId = useMemo(() => {
    const map = new Map<string, MessageReaction[]>();
    for (const r of reactions) {
      const bucket = map.get(r.message_id);
      if (bucket) bucket.push(r);
      else map.set(r.message_id, [r]);
    }
    return map;
  }, [reactions]);

  const contactDisplayName = contact?.name || contact?.phone || "Customer";

  // Author label for a quoted message: "You" when we sent the parent,
  // contact name when the customer sent it.
  const authorLabelFor = useCallback(
    (m: Message): string => {
      const isAgentMsg =
        m.sender_type === "agent" || m.sender_type === "bot";
      return isAgentMsg ? "You" : contactDisplayName;
    },
    [contactDisplayName],
  );

  const handleStartReply = useCallback(
    (msg: Message) => {
      setReplyTo({
        id: msg.id,
        authorLabel: authorLabelFor(msg),
        preview: buildReplyPreview(msg),
      });
    },
    [authorLabelFor],
  );

  // Single reaction-set primitive. emoji === "" removes; otherwise adds/swaps.
  // The "toggle" semantic (pill click) is computed at the call site where the
  // current reactions for the bubble are already in scope — keeps this
  // function dependency-free w.r.t. the reaction list.
  const postReaction = useCallback(
    async (messageId: string, emoji: string) => {
      if (!user?.id || !conversation) {
        console.warn("[reactions] missing user or conversation");
        return;
      }
      if (messageId.startsWith("temp-")) {
        toast.error("Wait for the message to finish sending");
        return;
      }

      const convId = conversation.id;
      const userId = user.id;
      let snapshot: MessageReaction[] = [];

      // Functional updater — captures the freshest reactions list, never a
      // stale closure. Snapshot stored for rollback on POST failure.
      setReactions((prev) => {
        snapshot = prev;
        const own = prev.find(
          (r) =>
            r.message_id === messageId &&
            r.actor_type === "agent" &&
            r.actor_id === userId,
        );
        if (emoji === "") return own ? prev.filter((r) => r !== own) : prev;
        if (own) return prev.map((r) => (r === own ? { ...own, emoji } : r));
        return [
          ...prev,
          {
            id: `temp-${Date.now()}`,
            message_id: messageId,
            conversation_id: convId,
            actor_type: "agent",
            actor_id: userId,
            emoji,
            created_at: new Date().toISOString(),
          },
        ];
      });

      try {
        const res = await fetch("/api/whatsapp/react", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message_id: messageId, emoji }),
        });
        if (!res.ok) {
          const payload = await res.json().catch(() => ({}));
          throw new Error(payload?.error || `HTTP ${res.status}`);
        }
      } catch (err) {
        const reason = err instanceof Error ? err.message : "network error";
        toast.error(`Reaction failed: ${reason}`);
        setReactions(snapshot);
      }
    },
    [conversation, user],
  );

  const handleAssignChange = useCallback(
    async (agentId: string | null) => {
      if (!conversation) return;

      const supabase = createClient();
      const { error } = await supabase
        .from("conversations")
        .update({ assigned_agent_id: agentId })
        .eq("id", conversation.id);

      if (error) {
        console.error("Failed to update assignment:", error);
        toast.error("Failed to update assignment");
        return;
      }

      onAssignChange(conversation.id, agentId);
    },
    [conversation, onAssignChange],
  );

  // Empty state — WhatsApp-style background with an illustration and
  // helpful quick-action hints. Never shows as a pure black screen.
  if (!conversation || !contact) {
    return (
      <div className={cn("flex flex-1 flex-col items-center justify-center gap-0", DOODLE_BG_CLASSES)}>
        {/* Glassmorphism card */}
        <div
          className="flex flex-col items-center gap-4 rounded-2xl px-8 py-10 text-center max-w-xs"
          style={{ background: "rgba(32, 44, 51, 0.85)", border: "1px solid rgba(42, 57, 66, 0.8)", backdropFilter: "blur(12px)" }}
        >
          {/* Icon circle */}
          <div
            className="flex h-20 w-20 items-center justify-center rounded-full"
            style={{ background: "rgba(0, 168, 132, 0.15)", border: "2px solid rgba(0, 168, 132, 0.25)" }}
          >
            <MessageSquare className="h-10 w-10" style={{ color: "#00A884" }} />
          </div>

          <div>
            <h3 className="text-base font-semibold text-slate-200">
              Select a conversation
            </h3>
            <p className="mt-1.5 text-[13px] text-slate-400 leading-relaxed">
              Choose a chat from the left panel to start messaging your contacts.
            </p>
          </div>

          {/* Quick action hints */}
          <div className="w-full space-y-2 pt-1">
            <div
              className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-left text-[12px] text-slate-400"
              style={{ background: "rgba(42, 57, 66, 0.6)" }}
            >
              <Zap className="h-3.5 w-3.5 text-amber-400 shrink-0" />
              Hot leads are highlighted with a 🔥 badge
            </div>
            <div
              className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-left text-[12px] text-slate-400"
              style={{ background: "rgba(42, 57, 66, 0.6)" }}
            >
              <Users className="h-3.5 w-3.5 shrink-0" style={{ color: "#00A884" }} />
              Assign conversations to team members
            </div>
          </div>
        </div>

        {/* End-to-end encryption note (WhatsApp style) */}
        <p className="mt-6 flex items-center gap-1.5 text-[11px] text-slate-600">
          <span className="text-[#00A884] text-xs">🔒</span>
          End-to-end encrypted · Powered by WhatsApp Business API
        </p>
      </div>
    );
  }

  const displayName = contact.name || contact.phone;
  const messageGroups = groupMessagesByDate(messages);
  const currentStatus = STATUS_OPTIONS.find(
    (s) => s.value === conversation.status
  );
  const assignedAgentId = conversation.assigned_agent_id ?? null;
  const currentAssignee = profiles.find((p) => p.user_id === assignedAgentId);
  const assignLabel = assignedAgentId
    ? (currentAssignee?.full_name ?? "Assigned")
    : "Assign";

  const isBlocked = !!contact.blocked && contact.blocked.length > 0;

  return (
    <div className={cn("flex flex-1 flex-col overflow-hidden", DOODLE_BG_CLASSES)}>
      {/* Header — WhatsApp Web style (BUG 8, BUG 11) */}
      <div
        className="flex items-center justify-between gap-2 px-3 py-2.5 sm:px-4 shrink-0 overflow-hidden"
        style={{ background: "#202C33", borderBottom: "1px solid #2A3942" }}
      >
        <div className="flex min-w-0 items-center gap-2 sm:gap-3">
          {onBack && (
            <button
              type="button"
              onClick={onBack}
              aria-label="Back to conversations"
              className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-md text-slate-300 hover:bg-slate-800 hover:text-white lg:hidden"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
          )}
          {/* Clickable avatar — opens contact details panel */}
          <button
            type="button"
            onClick={onOpenContactPanel}
            aria-label="View contact details"
            className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-slate-700 text-sm font-medium text-white relative cursor-pointer transition-all hover:ring-2 hover:ring-primary/60 hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-primary/60"
          >
            {contact.avatar_url ? (
              <img
                src={contact.avatar_url}
                alt={displayName}
                className="h-10 w-10 rounded-full object-cover"
              />
            ) : (
              displayName.charAt(0).toUpperCase()
            )}
            {/* Green Online presence dot mock */}
            <span className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full bg-emerald-500 border border-slate-900 pointer-events-none" />
          </button>
          <div className="min-w-0">
            <div className="flex items-baseline gap-1.5">
              {/* Clickable name — opens contact details panel */}
              <button
                type="button"
                onClick={onOpenContactPanel}
                className="truncate text-sm font-semibold text-slate-100 hover:text-white hover:underline underline-offset-2 transition-colors cursor-pointer bg-transparent border-0 p-0 text-left"
                aria-label="View contact details"
              >
                {displayName}
              </button>
              {contact.company && (
                <span className="truncate text-[11px] text-slate-400">({contact.company})</span>
              )}
            </div>
            <div className="flex items-center gap-2 mt-0.5">
              <p className="truncate text-[11px] text-slate-400 font-mono">{contact.phone}</p>
              <span className="text-[10px] text-emerald-400 font-semibold">• Online</span>
            </div>
          </div>
          <Badge
            variant="outline"
            className={cn(
              "ml-1 hidden gap-1 border-slate-700 text-[10px] sm:inline-flex sm:ml-2",
              sessionInfo.expired ? "text-red-400" : "text-emerald-400"
            )}
          >
            <Clock className="h-3 w-3" />
            {sessionInfo.remaining}
          </Badge>
        </div>

        <div className="flex items-center gap-1.5">
          {/* Contact Info — opens the contact details panel */}
          <button
            type="button"
            onClick={onOpenContactPanel}
            className="inline-flex h-8 w-8 items-center justify-center rounded-md text-slate-400 transition-colors hover:bg-slate-800 hover:text-white"
            title="Contact Details"
            aria-label="Open contact details"
          >
            <UserRound className="h-4 w-4" />
          </button>

          {/* Quick Call */}
          <a
            href={`tel:${contact.phone}`}
            className="inline-flex h-8 w-8 items-center justify-center rounded-md text-slate-400 transition-colors hover:bg-slate-800 hover:text-white"
            title="Call Contact"
          >
            <Phone className="h-4 w-4" />
          </a>

          {/* Quick WhatsApp */}
          <button
            type="button"
            onClick={() => {
              const el = document.getElementById("message-textarea");
              if (el) el.focus();
            }}
            className="inline-flex h-8 w-8 items-center justify-center rounded-md text-slate-400 transition-colors hover:bg-slate-800 hover:text-white"
            title="Focus message composer"
          >
            <Share2 className="h-4 w-4" />
          </button>

          {/* Quick Star/Favorite */}
          <button
            type="button"
            onClick={handleToggleStar}
            className={cn(
              "inline-flex h-8 w-8 items-center justify-center rounded-md transition-colors hover:bg-slate-800",
              conversation.settings?.is_starred ? "text-amber-400 hover:text-amber-300" : "text-slate-400 hover:text-white"
            )}
            title={conversation.settings?.is_starred ? "Unstar Chat" : "Star Chat"}
          >
            <Star className={cn("h-4 w-4", conversation.settings?.is_starred && "fill-amber-400")} />
          </button>
          {/* Status dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger className={cn(
                  "inline-flex items-center justify-center h-8 gap-1 px-2.5 text-xs rounded-md hover:bg-slate-800 transition-colors border border-slate-700/60",
                  currentStatus?.color ?? "text-slate-400"
                )}>
                {currentStatus?.label ?? "Status"}
                <ChevronDown className="h-3.5 w-3.5" />
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="end"
              className="border-slate-700 bg-slate-800 text-slate-200"
            >
              {STATUS_OPTIONS.map((opt) => (
                <DropdownMenuItem
                  key={opt.value}
                  onClick={() => handleStatusChange(opt.value)}
                  className={cn("text-xs", opt.color)}
                >
                  {opt.label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Assign dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger
              className={cn(
                "inline-flex items-center justify-center h-8 gap-1.5 px-2.5 text-xs rounded-md hover:bg-slate-800 transition-colors border border-slate-700/60",
                assignedAgentId ? "text-emerald-400 border-emerald-500/20 bg-emerald-500/5" : "text-slate-400"
              )}
            >
              <UserPlus className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">{assignLabel}</span>
              <ChevronDown className="h-3.5 w-3.5" />
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="end"
              className="border-slate-700 bg-slate-800 text-slate-200"
            >
              {profiles.length === 0 ? (
                <DropdownMenuItem disabled className="text-xs text-slate-500">
                  No teammates available
                </DropdownMenuItem>
              ) : (
                profiles.map((p) => {
                  const isSelected = p.user_id === assignedAgentId;
                  return (
                    <DropdownMenuItem
                      key={p.id}
                      onClick={() => handleAssignChange(p.user_id)}
                      className={cn(
                        "text-xs",
                        isSelected ? "text-emerald-400" : "text-slate-300"
                      )}
                    >
                      <span className="flex-1">
                        {p.full_name}
                        {p.user_id === user?.id ? " (me)" : ""}
                      </span>
                      {isSelected && <Check className="ml-2 h-3.5 w-3.5" />}
                    </DropdownMenuItem>
                  );
                })
              )}
              {assignedAgentId && (
                <>
                  <DropdownMenuSeparator className="bg-slate-700" />
                  <DropdownMenuItem
                    onClick={() => handleAssignChange(null)}
                    className="text-xs text-rose-400 focus:text-rose-400"
                  >
                    Unassign
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* AI Auto-Reply Switch */}
          <div className="flex items-center gap-1.5 border-l border-slate-800 pl-2 shrink-0">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              AI
            </span>
            <button
              id={`ai-toggle-${conversation.id}`}
              onClick={handleToggleAI}
              disabled={togglingAI}
              aria-label={conversation.ai_mode ? "Disable AI auto-reply" : "Enable AI auto-reply"}
              className={cn(
                "relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:ring-offset-1 disabled:opacity-50",
                conversation.ai_mode ? "bg-emerald-500" : "bg-slate-700"
              )}
            >
              <span
                className={cn(
                  "pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out",
                  conversation.ai_mode ? "translate-x-4" : "translate-x-0"
                )}
              />
            </button>
          </div>

          {/* MoreVertical dropdown with CRM Settings */}
          <DropdownMenu>
            <DropdownMenuTrigger className="inline-flex h-8 w-8 items-center justify-center rounded-md text-slate-400 transition-colors hover:bg-slate-800 hover:text-white border border-slate-700/60 shrink-0">
              <MoreVertical className="h-4 w-4" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="border-slate-700 bg-slate-800 text-slate-200 w-44">
              <DropdownMenuItem onClick={handleToggleMute} className="text-xs">
                {conversation.settings?.is_muted ? "Unmute Notifications" : "Mute Notifications"}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleToggleArchive} className="text-xs">
                {conversation.settings?.is_archived ? "Unarchive Chat" : "Archive Chat"}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleToggleBlock} className="text-xs text-rose-400 focus:text-rose-400">
                {isBlocked ? "Unblock Contact" : "Block Contact"}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleExportChat} className="text-xs">
                <Download className="mr-1.5 h-3.5 w-3.5 inline" />
                Export Chat
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleRefreshClick} className="text-xs">
                <RefreshCw className={cn("mr-1.5 h-3.5 w-3.5 inline", isRefreshing && "animate-spin")} />
                Sync/Refresh Chat
              </DropdownMenuItem>
              <DropdownMenuSeparator className="bg-slate-700" />
              <DropdownMenuItem onClick={handleDeleteClick} className="text-xs text-rose-500 focus:text-rose-500">
                Delete Conversation (Soft)
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Messages Area + Scroll-to-bottom FAB (BUG 7, BUG 10) */}
      <div className="relative flex-1 min-h-0 overflow-hidden">
        <div
          ref={scrollRef}
          onScroll={handleScrollMessages}
          className="h-full overflow-y-auto px-4 py-4"
        >
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-[#00A884] border-t-transparent" />
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12">
            <p className="text-sm text-slate-500">No messages yet</p>
            <p className="text-xs text-slate-600">
              Send a template to start the conversation
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {messageGroups.map((group) => (
              <div key={group.date}>
                {/* Date separator */}
                <div className="mb-4 flex items-center justify-center">
                  <span className="rounded-full bg-slate-800 px-3 py-1 text-[10px] font-medium text-slate-400">
                    {formatDateSeparator(group.date)}
                  </span>
                </div>
                {/* Messages */}
                <div className="space-y-2">
                  {group.messages.map((msg) => {
                    const parent = msg.reply_to_message_id
                      ? messagesById.get(msg.reply_to_message_id)
                      : null;
                    const reply = parent
                      ? {
                          authorLabel: authorLabelFor(parent),
                          preview: buildReplyPreview(parent),
                        }
                      : null;
                    const msgReactions = reactionsByMessageId.get(msg.id);
                    // Toggle is computed at the call site — `msgReactions`
                    // and `user?.id` are already in scope, no extra hook.
                    const handlePillToggle = (emoji: string) => {
                      const own = msgReactions?.find(
                        (r) =>
                          r.actor_type === "agent" &&
                          r.actor_id === user?.id,
                      );
                      const next = own?.emoji === emoji ? "" : emoji;
                      void postReaction(msg.id, next);
                    };
                    return (
                      <MessageActions
                        key={msg.id}
                        message={msg}
                        onReply={() => handleStartReply(msg)}
                        onReact={(emoji) => {
                          if (emoji) void postReaction(msg.id, emoji);
                        }}
                      >
                        <MessageBubble
                          message={msg}
                          reply={reply}
                          reactions={msgReactions}
                          currentUserId={user?.id}
                          onToggleReaction={handlePillToggle}
                        />
                      </MessageActions>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
        </div>

        {/* Scroll-to-bottom FAB */}
        {showScrollBtn && (
          <button
            onClick={scrollToBottom}
            className="absolute bottom-4 right-4 flex h-10 w-10 items-center justify-center rounded-full shadow-lg transition-all hover:scale-105 active:scale-95 z-10"
            style={{ background: "#202C33", border: "1px solid #2A3942" }}
            aria-label="Scroll to latest message"
          >
            <ArrowDown className="h-5 w-5" style={{ color: "#00A884" }} />
          </button>
        )}
      </div>

      {/* Composer */}
      <MessageComposer
        conversationId={conversation.id}
        sessionExpired={sessionInfo.expired}
        onSend={handleSend}
        onOpenTemplates={handleOpenTemplates}
        replyTo={replyTo}
        onClearReply={() => setReplyTo(null)}
        aiMode={conversation.ai_mode}
        prefillContext={(conversation as any).prefillContext}
      />

      <TemplatePicker
        open={templateModalOpen}
        onOpenChange={setTemplateModalOpen}
        onSelect={handleSendTemplate}
      />
    </div>
  );
}
