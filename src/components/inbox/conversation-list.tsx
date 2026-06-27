"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { cn } from "@/lib/utils";
import type { Conversation, ConversationStatus, Profile } from "@/types";
import { Search, Pin, Star, Flame, User, Plus, MessageCircle } from "lucide-react";
import { isToday, isYesterday, format } from "date-fns";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";

type FilterType = 'all' | 'unread' | 'assigned' | 'hot' | 'indiamart' | 'tradeindia' | 'exportersindia' | 'favorites' | 'pinned' | 'archived';

interface ConversationListProps {
  activeConversationId: string | null;
  onSelect: (conversation: Conversation) => void;
  conversations: Conversation[];
  onConversationsLoaded: (conversations: Conversation[]) => void;
  resyncToken?: number;
  profiles?: Profile[];
}

const STATUS_COLORS: Record<ConversationStatus, string> = {
  open: "bg-emerald-500",
  pending: "bg-amber-500",
  closed: "bg-slate-500",
};

const FILTER_BADGES: { label: string; value: FilterType }[] = [
  { label: "All", value: "all" },
  { label: "Unread", value: "unread" },
  { label: "Mine", value: "assigned" },
  { label: "🔥 Hot", value: "hot" },
  { label: "IndiaMART", value: "indiamart" },
  { label: "TradeIndia", value: "tradeindia" },
  { label: "ExportersIndia", value: "exportersindia" },
  { label: "★ Starred", value: "favorites" },
  { label: "📌 Pinned", value: "pinned" },
  { label: "Archived", value: "archived" },
];

function formatMessageTime(dateStr?: string) {
  if (!dateStr) return "";
  const date = new Date(dateStr);
  if (isToday(date)) {
    return format(date, "HH:mm");
  }
  if (isYesterday(date)) {
    return "Yesterday";
  }
  return format(date, "dd/MM/yy");
}

function isHotLead(c: Conversation): boolean {
  const lead = c.lead_conversations?.[0]?.lead;
  if (!lead) return false;
  const msg = (lead.message || '').toLowerCase();
  const isUrgent = msg.includes('urgent') || msg.includes('buy') || msg.includes('price') || msg.includes('quote') || msg.includes('bulk') || msg.includes('order');
  const isQtyHigh = parseFloat(lead.quantity || '0') >= 100;
  return isUrgent || isQtyHigh || ((lead.lead_score ?? 0) >= 80);
}

// ── Skeleton row for loading state ──
function SkeletonRow() {
  return (
    <div className="flex items-start gap-3 px-3 py-3 animate-pulse">
      <div className="h-11 w-11 rounded-full bg-[#2A3942] shrink-0" />
      <div className="flex-1 space-y-2 pt-1">
        <div className="flex justify-between">
          <div className="h-3 w-28 rounded bg-[#2A3942]" />
          <div className="h-3 w-10 rounded bg-[#2A3942]" />
        </div>
        <div className="h-2.5 w-40 rounded bg-[#2A3942]" />
        <div className="h-2 w-20 rounded bg-[#2A3942]" />
      </div>
    </div>
  );
}

export function ConversationList({
  activeConversationId,
  onSelect,
  conversations,
  onConversationsLoaded,
  resyncToken = 0,
  profiles = [],
}: ConversationListProps) {
  const { user } = useAuth();
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<FilterType>("all");
  const [loading, setLoading] = useState(true);

  const onConversationsLoadedRef = useRef(onConversationsLoaded);
  useEffect(() => {
    onConversationsLoadedRef.current = onConversationsLoaded;
  });

  useEffect(() => {
    const supabase = createClient();
    let cancelled = false;

    (async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("conversations")
        .select(`
          *,
          contact:contacts(*, blocked:blocked_contacts(id)),
          settings:conversation_settings(*),
          lead_conversations(lead:b2b_leads(*))
        `)
        .is("deleted_at", null)
        .order("last_message_at", { ascending: false });

      if (cancelled) return;

      if (error) {
        console.error("Failed to fetch conversations:", error);
        setLoading(false);
        return;
      }

      onConversationsLoadedRef.current(data ?? []);
      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [resyncToken]);

  const filteredAndSorted = useMemo(() => {
    let result = conversations;

    if (filter === "archived") {
      result = result.filter((c) => c.settings?.is_archived === true);
    } else {
      result = result.filter((c) => c.settings?.is_archived !== true);

      if (filter === "unread") {
        result = result.filter((c) => c.unread_count > 0);
      } else if (filter === "assigned") {
        result = result.filter((c) => c.assigned_agent_id === user?.id);
      } else if (filter === "favorites") {
        result = result.filter((c) => c.settings?.is_starred === true);
      } else if (filter === "pinned") {
        result = result.filter((c) => c.settings?.is_pinned === true);
      } else if (filter === "hot") {
        result = result.filter((c) => isHotLead(c));
      } else if (filter === "indiamart") {
        result = result.filter((c) => c.lead_conversations?.[0]?.lead?.platform === 'INDIAMART');
      } else if (filter === "tradeindia") {
        result = result.filter((c) => c.lead_conversations?.[0]?.lead?.platform === 'TRADEINDIA');
      } else if (filter === "exportersindia") {
        result = result.filter((c) => c.lead_conversations?.[0]?.lead?.platform === 'EXPORTERSINDIA');
      }
    }

    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter((c) => {
        const name = c.contact?.name?.toLowerCase() ?? "";
        const phone = c.contact?.phone?.toLowerCase() ?? "";
        const company = c.contact?.company?.toLowerCase() ?? "";
        const lastMsg = c.last_message_text?.toLowerCase() ?? "";
        const leadProduct = c.lead_conversations?.[0]?.lead?.product_name?.toLowerCase() ?? "";
        const leadPlatform = c.lead_conversations?.[0]?.lead?.platform?.toLowerCase() ?? "";
        return (
          name.includes(q) ||
          phone.includes(q) ||
          company.includes(q) ||
          lastMsg.includes(q) ||
          leadProduct.includes(q) ||
          leadPlatform.includes(q)
        );
      });
    }

    return [...result].sort((a, b) => {
      const aPinned = a.settings?.is_pinned ? 1 : 0;
      const bPinned = b.settings?.is_pinned ? 1 : 0;
      if (aPinned !== bPinned) return bPinned - aPinned;

      const aUnread = a.unread_count > 0 ? 1 : 0;
      const bUnread = b.unread_count > 0 ? 1 : 0;
      if (aUnread !== bUnread) return bUnread - aUnread;

      const aTime = a.last_message_at ? new Date(a.last_message_at).getTime() : 0;
      const bTime = b.last_message_at ? new Date(b.last_message_at).getTime() : 0;
      return bTime - aTime;
    });
  }, [conversations, filter, search, user?.id]);

  const handleSearchChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setSearch(e.target.value);
    },
    []
  );

  const handleSelect = useCallback(
    (conv: Conversation) => {
      onSelect(conv);
    },
    [onSelect]
  );

  const emptyMessage = useMemo(() => {
    if (search.trim()) return { title: "No results found", sub: `No chats match "${search}"` };
    if (filter === "unread") return { title: "All caught up!", sub: "No unread conversations" };
    if (filter === "assigned") return { title: "Nothing assigned to you", sub: "Leads will appear here when assigned" };
    if (filter === "hot") return { title: "No hot leads", sub: "Hot leads based on urgency signals" };
    if (filter === "pinned") return { title: "No pinned chats", sub: "Pin important conversations to find them quickly" };
    if (filter === "favorites") return { title: "No starred chats", sub: "Star conversations to find them here" };
    if (filter === "archived") return { title: "No archived chats", sub: "Archived conversations appear here" };
    return { title: "No conversations yet", sub: "Incoming leads will appear here automatically" };
  }, [search, filter]);

  return (
    <div
      className="flex h-full w-full flex-col"
      style={{ background: "#111B21" }}
    >
      {/* ── Search bar + New Chat button (BUG 5) ── */}
      <div
        className="flex items-center gap-2 px-3 py-2.5 shrink-0"
        style={{ borderBottom: "1px solid #2A3942" }}
      >
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-500" />
          <Input
            value={search}
            onChange={handleSearchChange}
            placeholder="Search or start new chat…"
            className="h-9 rounded-lg border-0 pl-9 text-[13px] text-white placeholder-slate-500 focus-visible:ring-0 focus-visible:ring-offset-0"
            style={{ background: "#2A3942" }}
          />
        </div>
        {/* New Chat button */}
        <button
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-slate-400 transition-colors hover:text-white"
          style={{ background: "#2A3942" }}
          title="New Chat"
          aria-label="Start new chat"
        >
          <Plus className="h-4 w-4" />
        </button>
      </div>

      {/* ── Filter chip row — horizontally scrollable (BUG 4) ── */}
      <div
        className="flex gap-1.5 overflow-x-auto px-3 py-2 shrink-0 scrollbar-none"
        style={{ borderBottom: "1px solid #2A3942" }}
      >
        {FILTER_BADGES.map((badge) => {
          const active = filter === badge.value;
          return (
            <button
              key={badge.value}
              onClick={() => setFilter(badge.value)}
              className={cn(
                "shrink-0 whitespace-nowrap rounded-full border text-[11px] font-medium transition-colors",
                "px-2.5 py-0.5",
                active
                  ? "border-[#00A884] bg-[#00A884]/20 text-[#00A884]"
                  : "text-slate-300 hover:text-white"
              )}
              style={!active ? { background: "#2A3942", borderColor: "#3D5463" } : {}}
            >
              {badge.label}
            </button>
          );
        })}
      </div>

      {/* ── Conversations scroll area ── */}
      <ScrollArea className="min-h-0 flex-1">
        {loading ? (
          // Skeleton loader (BUG 5)
          <div className="divide-y" style={{ borderColor: "#2A3942" }}>
            {[1, 2, 3, 4, 5].map((i) => (
              <SkeletonRow key={i} />
            ))}
          </div>
        ) : filteredAndSorted.length === 0 ? (
          // Improved empty state (BUG 5)
          <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
            <div
              className="flex h-14 w-14 items-center justify-center rounded-full mb-4"
              style={{ background: "#2A3942" }}
            >
              <MessageCircle className="h-7 w-7 text-slate-500" />
            </div>
            <p className="text-sm font-medium text-slate-300">{emptyMessage.title}</p>
            <p className="mt-1 text-xs text-slate-500 leading-relaxed">{emptyMessage.sub}</p>
          </div>
        ) : (
          <div className="flex flex-col">
            {filteredAndSorted.map((conv) => (
              <ConversationItem
                key={conv.id}
                conversation={conv}
                isActive={conv.id === activeConversationId}
                onSelect={handleSelect}
                profiles={profiles}
              />
            ))}
          </div>
        )}
      </ScrollArea>
    </div>
  );
}

interface ConversationItemProps {
  conversation: Conversation;
  isActive: boolean;
  onSelect: (conversation: Conversation) => void;
  profiles: Profile[];
}

function ConversationItem({
  conversation,
  isActive,
  onSelect,
  profiles,
}: ConversationItemProps) {
  const contact = conversation.contact;
  const displayName = contact?.name || contact?.phone || "Unknown Customer";
  const initials = displayName.charAt(0).toUpperCase();

  const settings = conversation.settings;
  const lead = conversation.lead_conversations?.[0]?.lead;
  const isHot = isHotLead(conversation);
  const isMuted = settings?.is_muted ?? false;

  const assignedAgentId = conversation.assigned_agent_id;
  const assignedTeammate = profiles.find((p) => p.user_id === assignedAgentId);

  const handleClick = useCallback(() => {
    onSelect(conversation);
  }, [onSelect, conversation]);

  const timeDisplay = useMemo(() => {
    return formatMessageTime(conversation.last_message_at || conversation.created_at);
  }, [conversation.last_message_at, conversation.created_at]);

  return (
    <button
      onClick={handleClick}
      className={cn(
        "flex w-full items-start gap-3 px-3 py-3 text-left transition-colors relative",
        isActive ? "border-r-2 border-[#00A884]" : "hover:opacity-90"
      )}
      style={{
        background: isActive ? "#2A3942" : "transparent",
        borderBottom: "1px solid rgba(42, 57, 66, 0.6)",
      }}
    >
      {/* Avatar with status indicator */}
      <div className="relative shrink-0">
        <div
          className="flex h-11 w-11 items-center justify-center rounded-full text-sm font-semibold text-white"
          style={{ background: "#2A3942" }}
        >
          {contact?.avatar_url ? (
            <img
              src={contact.avatar_url}
              alt={displayName}
              className="h-11 w-11 rounded-full object-cover"
            />
          ) : (
            initials
          )}
        </div>
        {/* Status dot */}
        <span
          className={cn(
            "absolute bottom-0 right-0 h-3 w-3 rounded-full border-2",
            STATUS_COLORS[conversation.status]
          )}
          style={{ borderColor: isActive ? "#2A3942" : "#111B21" }}
          title={`Status: ${conversation.status}`}
        />
      </div>

      {/* Main content */}
      <div className="min-w-0 flex-1">
        {/* Row 1: Name + time */}
        <div className="flex items-baseline justify-between gap-1.5">
          <div className="flex items-baseline gap-1 truncate">
            <span className="font-semibold text-slate-100 text-[13.5px] truncate">
              {displayName}
            </span>
            {contact?.company && (
              <span className="text-[11px] text-slate-400 font-normal truncate hidden sm:inline">
                · {contact.company}
              </span>
            )}
          </div>
          <span className="shrink-0 text-[10px] text-slate-500">{timeDisplay}</span>
        </div>

        {/* Row 2: Last message preview */}
        <p className="truncate text-[12px] text-slate-400 mt-0.5 pr-2 leading-relaxed">
          {isMuted && <span className="mr-1 opacity-60">🔇</span>}
          {conversation.last_message_text || "No messages yet"}
        </p>

        {/* Row 3: Badges + unread count */}
        <div className="mt-1.5 flex flex-wrap items-center gap-1">
          {/* Platform badge */}
          {lead?.platform && (
            <span className={cn(
              "rounded px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-white",
              lead.platform === "INDIAMART" && "bg-amber-600/80",
              lead.platform === "TRADEINDIA" && "bg-blue-600/80",
              lead.platform === "EXPORTERSINDIA" && "bg-emerald-600/80"
            )}>
              {lead.platform === "INDIAMART" ? "IM" : lead.platform === "TRADEINDIA" ? "TI" : "EI"}
            </span>
          )}

          {/* Assigned staff */}
          {assignedTeammate && (
            <span
              className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[9px] text-slate-300"
              style={{ background: "#2A3942", border: "1px solid #3D5463" }}
            >
              <User className="h-2.5 w-2.5" />
              {assignedTeammate.full_name?.split(" ")[0]}
            </span>
          )}

          {/* Hot lead */}
          {isHot && (
            <span className="inline-flex items-center gap-0.5 rounded text-rose-400 px-1.5 py-0.5 text-[9px] font-semibold"
              style={{ background: "rgba(239, 68, 68, 0.15)", border: "1px solid rgba(239, 68, 68, 0.25)" }}
            >
              <Flame className="h-2.5 w-2.5 fill-rose-400" />
              HOT
            </span>
          )}

          {/* Pin / Star / Unread — pushed right */}
          <div className="ml-auto flex items-center gap-1.5">
            {settings?.is_starred && (
              <Star className="h-3 w-3 text-amber-400 fill-amber-400 shrink-0" />
            )}
            {settings?.is_pinned && (
              <Pin className="h-3 w-3 text-slate-400 fill-slate-400 shrink-0 rotate-45" />
            )}
            {conversation.unread_count > 0 && (
              <span
                className="flex h-4.5 min-w-[18px] items-center justify-center rounded-full px-1 text-[10px] font-bold text-white shrink-0"
                style={{ background: "#00A884", minWidth: "18px", height: "18px" }}
              >
                {conversation.unread_count > 99 ? "99+" : conversation.unread_count}
              </span>
            )}
          </div>
        </div>
      </div>
    </button>
  );
}
