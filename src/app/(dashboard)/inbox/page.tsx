"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { Conversation, Message, Contact, ConversationStatus, Profile } from "@/types";
import { useRealtime } from "@/hooks/use-realtime";
import { ConversationList } from "@/components/inbox/conversation-list";
import { MessageThread } from "@/components/inbox/message-thread";
import { ContactSidebar } from "@/components/inbox/contact-sidebar";
import { toast } from "sonner";
import { WifiOff, X, ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";


export default function InboxPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  /**
   * `?c=<id>` deep-link support. Used when landing here from the
   * dashboard's recent-conversations list so the right thread opens
   * automatically instead of showing the empty center panel.
   */
  const deepLinkConvId = searchParams.get("c");

  const phoneParam = searchParams.get("phone");
  const nameParam = searchParams.get("name");
  const docTypeParam = searchParams.get("docType");
  const docIdParam = searchParams.get("docId");
  const docNoParam = searchParams.get("docNo");

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConversation, setActiveConversation] =
    useState<Conversation | null>(null);
  const [activeContact, setActiveContact] = useState<Contact | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [whatsappConnected, setWhatsappConnected] = useState<boolean | null>(
    null
  );
  const [bannerDismissed, setBannerDismissed] = useState(false);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  /**
   * Bumped whenever we want children (ConversationList, MessageThread)
   * to refetch from the DB — used as a safety net against missed
   * realtime events. Bumped on WS reconnect and on tab visibility →
   * visible. The initial mount fetches don't depend on this; they fire
   * once on conversationId-change as usual.
   */
  const [resyncToken, setResyncToken] = useState(0);

  // Fire the deep-link auto-select exactly once per URL — subsequent
  // list refreshes (realtime, manual refetch) must not snap the user
  // back to the deep-linked conversation if they've already clicked
  // elsewhere.
  const autoSelectedForDeepLinkRef = useRef<string | null>(null);

  // Tracks conversations whose hydrate fetch is currently in flight.
  const hydratingConvIdsRef = useRef<Set<string>>(new Set());

  /**
   * Synchronous mirror of the conversation ids currently in `conversations`
   * state. Event handlers need to know "do we already have this conv?"
   * without waiting for a setState updater to run.
   */
  const knownConvIdsRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    const next = new Set<string>();
    for (const c of conversations) next.add(c.id);
    knownConvIdsRef.current = next;
  }, [conversations]);

  // Mobile "back" — deselect the conversation so the list pane comes back.
  const handleCloseConversation = useCallback(() => {
    setActiveConversation(null);
    setActiveContact(null);
    setMessages([]);
    autoSelectedForDeepLinkRef.current = null;
    router.replace("/inbox", { scroll: false });
  }, [router]);

  const handleDeleteConversation = useCallback(
    (conversationId: string) => {
      if (activeConversation?.id === conversationId) {
        handleCloseConversation();
      }
      setConversations((prev) => prev.filter((c) => c.id !== conversationId));
    },
    [activeConversation?.id, handleCloseConversation]
  );

  const hydrateConversation = useCallback(async (convId: string) => {
    if (hydratingConvIdsRef.current.has(convId)) return;
    hydratingConvIdsRef.current.add(convId);
    try {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("conversations")
        .select("*, contact:contacts(*)")
        .eq("id", convId)
        .maybeSingle();
      if (error) {
        console.error("Failed to hydrate conversation:", {
          message: error.message,
          details: error.details,
          hint: error.hint,
          code: error.code,
        });
        return;
      }
      if (!data) return;
      const fetched = data as Conversation;
      setConversations((prev) => {
        const existing = prev.find((c) => c.id === fetched.id);
        if (existing) {
          return prev.map((c) =>
            c.id === fetched.id
              ? { ...c, contact: c.contact ?? fetched.contact }
              : c,
          );
        }
        return [fetched, ...prev];
      });
    } finally {
      hydratingConvIdsRef.current.delete(convId);
    }
  }, []);

  // Deep link with document context and auto-conversation creation
  const deepLinkHandledRef = useRef<string | null>(null);

  useEffect(() => {
    const handleDeepLink = async () => {
      if (!phoneParam) return;
      const paramKey = `${phoneParam}-${docIdParam}-${docNoParam}`;
      if (deepLinkHandledRef.current === paramKey) return;
      deepLinkHandledRef.current = paramKey;

      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      const user = session?.user;
      if (!user) return;

      const { data: profile } = await supabase
        .from("profiles")
        .select("account_id")
        .eq("user_id", user.id)
        .maybeSingle();

      const accountId = profile?.account_id;
      if (!accountId) return;

      // Clean/Normalize the phone number for search
      const cleanPhone = phoneParam.replace(/[^0-9+]/g, "");

      // 1. Find or create contact
      let contact: Contact | null = null;
      const { data: existingContacts } = await supabase
        .from("contacts")
        .select("*")
        .eq("account_id", accountId)
        .or(`phone.eq.${cleanPhone},phone.eq.${cleanPhone.replace("+", "")},phone.eq.+${cleanPhone}`);

      if (existingContacts && existingContacts.length > 0) {
        contact = existingContacts[0] as Contact;
      } else {
        // Create new contact
        const { data: newContact, error: createContactErr } = await supabase
          .from("contacts")
          .insert({
            account_id: accountId,
            user_id: user.id,
            phone: cleanPhone,
            name: nameParam || "New Customer",
            company: docTypeParam ? `${docTypeParam.toUpperCase()} Customer` : "Customer"
          })
          .select()
          .single();

        if (createContactErr) {
          console.error("Failed to create contact for deep link:", createContactErr);
          toast.error("Failed to initialize contact.");
          return;
        }
        contact = newContact as Contact;
      }

      if (!contact) return;

      // 2. Find or create conversation
      let conversation: Conversation | null = null;
      const { data: existingConvs } = await supabase
        .from("conversations")
        .select("*, contact:contacts(*)")
        .eq("account_id", accountId)
        .eq("contact_id", contact.id)
        .is("deleted_at", null)
        .limit(1);

      // Pre-fill text block
      let prefillText = "";
      if (docTypeParam === "quotation") {
        prefillText = `Hello ${nameParam || "Customer"},\n\nYour quotation *${docNoParam}* is ready.\n\nPlease review it.\n\nIf you have any questions, feel free to reply here.\n\nRegards,\nPhoenix Products`;
      } else if (docTypeParam === "proforma") {
        prefillText = `Hello ${nameParam || "Customer"},\n\nYour Proforma Invoice *${docNoParam}* is ready.\n\nPlease review it.\n\nThank you.`;
      } else if (docTypeParam === "sales") {
        prefillText = `Hello ${nameParam || "Customer"},\n\nYour Sales Order/Invoice *${docNoParam}* has been generated.\n\nPlease contact us if you need any assistance.`;
      }

      const docUpdate = {
        last_opened_document: docTypeParam ? `${docTypeParam.toUpperCase()}: ${docNoParam}` : null,
        document_type: docTypeParam || null,
        document_id: docIdParam || null,
        chat_context: docTypeParam ? {
          docType: docTypeParam,
          docId: docIdParam,
          docNo: docNoParam,
          name: nameParam,
        } : null,
      };

      if (existingConvs && existingConvs.length > 0) {
        conversation = existingConvs[0] as Conversation;
        // Update the conversation's active document context in database
        await supabase
          .from("conversations")
          .update(docUpdate)
          .eq("id", conversation.id);
        
        conversation = {
          ...conversation,
          ...docUpdate,
        };
      } else {
        // Create new conversation
        const { data: newConv, error: createConvErr } = await supabase
          .from("conversations")
          .insert({
            account_id: accountId,
            user_id: user.id,
            contact_id: contact.id,
            status: "open",
            ...docUpdate,
          })
          .select()
          .single();

        if (createConvErr) {
          console.error("Failed to create conversation for deep link:", createConvErr);
          toast.error("Failed to initialize conversation.");
          return;
        }
        conversation = {
          ...(newConv as Conversation),
          contact
        };
      }

      if (conversation) {
        // Set prefill text state
        if (prefillText) {
          (conversation as any).prefillContext = {
            text: prefillText,
            docType: docTypeParam,
            docId: docIdParam,
            docNo: docNoParam,
          };
        }

        // Trigger manual refresh/resync to make sure list updates
        setResyncToken(r => r + 1);

        // Select the conversation
        setActiveConversation(conversation);
        setActiveContact(contact);
        setMessages([]);
        router.replace(`/inbox?c=${conversation.id}`, { scroll: false });
      }
    };

    handleDeepLink();
  }, [phoneParam, nameParam, docTypeParam, docIdParam, docNoParam, router]);

  // Fetch profiles on mount
  useEffect(() => {
    const supabase = createClient();
    supabase
      .from("profiles")
      .select("*")
      .order("full_name")
      .then(({ data }) => {
        if (data) setProfiles(data as Profile[]);
      });
  }, []);

  // Check WhatsApp connection status on mount
  useEffect(() => {
    const checkConnection = async () => {
      const supabase = createClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const user = session?.user;
      if (!user) return;

      const { data: profile } = await supabase
        .from("profiles")
        .select("account_id")
        .eq("user_id", user.id)
        .maybeSingle();
      const accountId = profile?.account_id as string | undefined;
      if (!accountId) {
        setWhatsappConnected(false);
        return;
      }

      const { data } = await supabase
        .from("whatsapp_config")
        .select("status")
        .eq("account_id", accountId)
        .maybeSingle();

      setWhatsappConnected(data?.status === "connected");
    };

    checkConnection();
  }, []);

  // Handle realtime message events
  const handleMessageEvent = useCallback(
    (event: { eventType: string; new: Message; old: Partial<Message> }) => {
      const newMsg = event.new;

      if (event.eventType === "INSERT") {
        if (
          activeConversation &&
          newMsg.conversation_id === activeConversation.id
        ) {
          setMessages((prev) => {
            if (prev.some((m) => m.id === newMsg.id)) return prev;
            const withoutOptimistic = prev.filter(
              (m) => !m.id.startsWith("temp-")
            );
            return [...withoutOptimistic, newMsg];
          });
        }

        if (knownConvIdsRef.current.has(newMsg.conversation_id)) {
          setConversations((prev) =>
            prev.map((c) =>
              c.id === newMsg.conversation_id
                ? {
                    ...c,
                    last_message_text: newMsg.content_text ?? "",
                    last_message_at: newMsg.created_at,
                    unread_count:
                      activeConversation?.id === newMsg.conversation_id
                        ? 0
                        : c.unread_count + 1,
                  }
                : c,
            ),
          );
        } else {
          hydrateConversation(newMsg.conversation_id);
        }
      }

      if (event.eventType === "UPDATE") {
        setMessages((prev) =>
          prev.map((m) => (m.id === newMsg.id ? { ...m, ...newMsg } : m))
        );
      }
    },
    [activeConversation, hydrateConversation]
  );

  // Handle realtime conversation events
  const handleConversationEvent = useCallback(
    (event: {
      eventType: string;
      new: Conversation;
      old: Partial<Conversation>;
    }) => {
      const conv = event.new;

      if (event.eventType === "INSERT") {
        if (!knownConvIdsRef.current.has(conv.id)) {
          setConversations((prev) => {
            if (prev.some((c) => c.id === conv.id)) return prev;
            return [conv, ...prev];
          });
          hydrateConversation(conv.id);
        }
      }

      if (event.eventType === "UPDATE") {
        if (conv.deleted_at) {
          setConversations((prev) => prev.filter((c) => c.id !== conv.id));
          if (activeConversation?.id === conv.id) {
            handleCloseConversation();
          }
          return;
        }

        if (knownConvIdsRef.current.has(conv.id)) {
          const isActive = activeConversation?.id === conv.id;
          setConversations((prev) =>
              prev.map((c) =>
                c.id === conv.id
                  ? {
                      ...c,
                      ...conv,
                      unread_count: isActive ? 0 : conv.unread_count,
                    }
                  : c,
              ),
          );
        } else {
          hydrateConversation(conv.id);
        }

        if (activeConversation && conv.id === activeConversation.id) {
          setActiveConversation((prev) =>
            prev ? { ...prev, ...conv } : prev
          );
        }
      }
    },
    [activeConversation, hydrateConversation, handleCloseConversation]
  );

  const { isConnected } = useRealtime({
    channelName: "inbox-realtime",
    onMessageEvent: handleMessageEvent,
    onConversationEvent: handleConversationEvent,
    enabled: true,
  });

  const wasConnectedRef = useRef(false);
  const initialConnectDoneRef = useRef(false);
  useEffect(() => {
    if (isConnected && !wasConnectedRef.current) {
      if (initialConnectDoneRef.current) {
        setResyncToken((n) => n + 1);
      } else {
        initialConnectDoneRef.current = true;
      }
    }
    wasConnectedRef.current = isConnected;
  }, [isConnected]);

  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        setResyncToken((n) => n + 1);
      }
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  const handleManualRefresh = useCallback(() => {
    setResyncToken((n) => n + 1);
  }, []);

  const handleConversationsLoaded = useCallback(
    (loaded: Conversation[]) => {
      setConversations(loaded);
      if (
        deepLinkConvId &&
        autoSelectedForDeepLinkRef.current !== deepLinkConvId &&
        loaded.length > 0
      ) {
        autoSelectedForDeepLinkRef.current = deepLinkConvId;
        if (activeConversation?.id === deepLinkConvId) return;
        const match = loaded.find((c) => c.id === deepLinkConvId);
        if (match) {
          setActiveConversation(match);
          setActiveContact(match.contact ?? null);
          setMessages([]);
          if (match.unread_count > 0) {
            setConversations((prev) =>
              prev.map((c) =>
                c.id === match.id ? { ...c, unread_count: 0 } : c,
              ),
            );
          }
        }
      }
    },
    [deepLinkConvId, activeConversation?.id]
  );

  const handleSelectConversation = useCallback(
    (conv: Conversation) => {
      if (activeConversation?.id === conv.id) return;
      setActiveConversation(conv);
      setActiveContact(conv.contact ?? null);
      setMessages([]);
      setConversations((prev) =>
        prev.map((c) =>
          c.id === conv.id && c.unread_count > 0
            ? { ...c, unread_count: 0 }
            : c,
        ),
      );
      autoSelectedForDeepLinkRef.current = conv.id;
      router.replace(`/inbox?c=${conv.id}`, { scroll: false });
    },
    [activeConversation?.id, router]
  );

  const handleMessagesLoaded = useCallback((loaded: Message[]) => {
    setMessages(loaded);
  }, []);

  const handleNewMessage = useCallback((msg: Message) => {
    setMessages((prev) => {
      if (prev.some((m) => m.id === msg.id)) return prev;
      return [...prev, msg];
    });
  }, []);

  const handleUpdateMessage = useCallback(
    (id: string, updates: Partial<Message>) => {
      setMessages((prev) =>
        prev.map((m) => (m.id === id ? { ...m, ...updates } : m))
      );
    },
    []
  );

  const handleStatusChange = useCallback(
    (conversationId: string, status: ConversationStatus) => {
      setConversations((prev) =>
        prev.map((c) => (c.id === conversationId ? { ...c, status } : c))
      );
      if (activeConversation?.id === conversationId) {
        setActiveConversation((prev) => (prev ? { ...prev, status } : prev));
      }
    },
    [activeConversation]
  );

  const handleAssignChange = useCallback(
    (conversationId: string, assignedAgentId: string | null) => {
      setConversations((prev) =>
        prev.map((c) =>
          c.id === conversationId
            ? { ...c, assigned_agent_id: assignedAgentId ?? undefined }
            : c
        )
      );
      if (activeConversation?.id === conversationId) {
        setActiveConversation((prev) =>
          prev
            ? { ...prev, assigned_agent_id: assignedAgentId ?? undefined }
            : prev
        );
      }
    },
    [activeConversation]
  );

  const handleToggleAIMode = useCallback(
    (conversationId: string, aiMode: boolean) => {
      setConversations((prev) =>
        prev.map((c) =>
          c.id === conversationId
            ? { ...c, ai_mode: aiMode }
            : c
        )
      );
      if (activeConversation?.id === conversationId) {
        setActiveConversation((prev) =>
          prev ? { ...prev, ai_mode: aiMode } : prev
        );
      }
    },
    [activeConversation]
  );

  const hasActiveConv = !!activeConversation;
  const showBanner = whatsappConnected === false && !bannerDismissed;

  return (
    // Root: full height, WhatsApp dark background, flex column
    <div
      className="-m-4 flex h-[calc(100vh-3.5rem)] flex-col overflow-hidden sm:-m-6"
      style={{ background: "#0B141A" }}
    >
      {/* ── Compact WhatsApp connection banner (BUG 6) ── */}
      {showBanner && (
        <div
          className="flex h-10 shrink-0 items-center justify-between gap-2 px-4"
          style={{ background: "rgba(234, 179, 8, 0.12)", borderBottom: "1px solid rgba(234, 179, 8, 0.2)" }}
        >
          <div className="flex items-center gap-2">
            <WifiOff className="h-3.5 w-3.5 text-amber-400 shrink-0" />
            <p className="text-xs text-amber-300">
              WhatsApp® is not connected.
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => router.push("/settings")}
              className="flex items-center gap-1 rounded-md bg-amber-500/20 border border-amber-500/30 px-2.5 py-1 text-[11px] font-medium text-amber-300 hover:bg-amber-500/30 transition-colors"
            >
              <ExternalLink className="h-3 w-3" />
              Connect WhatsApp
            </button>
            <button
              onClick={() => setBannerDismissed(true)}
              className="flex h-6 w-6 items-center justify-center rounded text-amber-400/60 hover:text-amber-400 hover:bg-amber-500/10 transition-colors"
              aria-label="Dismiss"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* ── 3-Panel Grid Layout (BUG 1, 3, 9, 11) ── */}
      {/*
        Desktop (lg+):  320px | 1fr | 360px
        Tablet  (md–lg): 320px | 1fr  (right panel hidden)
        Mobile  (<md):   1 column — list OR thread (sliding)
      */}
      <div
        className={cn(
          "flex-1 overflow-hidden",
          // Mobile: flex column, show list or thread
          "flex flex-col",
          // Desktop: CSS grid with fixed sidebar widths
          "lg:grid lg:grid-cols-[320px_minmax(0,1fr)_360px]",
          // Tablet: 2-column grid, right panel hidden via conditional render
          "md:grid md:grid-cols-[320px_minmax(0,1fr)] lg:grid-cols-[320px_minmax(0,1fr)_360px]",
        )}
        style={{ background: "#0B141A" }}
      >
        {/* ── LEFT: Conversation List ── */}
        {/* Mobile: hidden when a conversation is selected */}
        <div
          className={cn(
            "h-full overflow-hidden",
            // Mobile single-column behavior
            hasActiveConv ? "hidden md:block" : "flex flex-col flex-1 md:block",
          )}
          style={{ background: "#111B21", borderRight: "1px solid #2A3942" }}
        >
          <ConversationList
            activeConversationId={activeConversation?.id ?? null}
            onSelect={handleSelectConversation}
            conversations={conversations}
            onConversationsLoaded={handleConversationsLoaded}
            resyncToken={resyncToken}
            profiles={profiles}
          />
        </div>

        {/* ── CENTER: Message Thread ── */}
        {/* `min-w-0` is load-bearing: prevents wide content blowing out the grid cell */}
        <div
          className={cn(
            "h-full min-w-0 overflow-hidden",
            // Mobile: show only when a conversation is active
            hasActiveConv ? "flex flex-col flex-1" : "hidden md:flex md:flex-col",
          )}
        >
          <MessageThread
            conversation={activeConversation}
            contact={activeContact}
            messages={messages}
            onMessagesLoaded={handleMessagesLoaded}
            onNewMessage={handleNewMessage}
            onUpdateMessage={handleUpdateMessage}
            onStatusChange={handleStatusChange}
            onAssignChange={handleAssignChange}
            onBack={handleCloseConversation}
            resyncToken={resyncToken}
            onRefresh={handleManualRefresh}
            onToggleAI={handleToggleAIMode}
            onDelete={handleDeleteConversation}
          />
        </div>

        {/* ── RIGHT: Contact / CRM Sidebar — desktop only (BUG 3) ── */}
        <div
          className="hidden lg:flex lg:flex-col h-full overflow-hidden"
          style={{
            background: "#202C33",
            borderLeft: "1px solid #2A3942",
            minWidth: "340px",
            maxWidth: "400px",
          }}
        >
          <ContactSidebar
            contact={activeContact}
            conversation={activeConversation}
            onRefresh={handleManualRefresh}
            profiles={profiles}
          />
        </div>
      </div>
    </div>
  );
}
