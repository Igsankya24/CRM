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
import { findExistingContact } from "@/lib/contacts/dedupe";
import { normalizePhoneForCRM } from "@/lib/whatsapp/phone-utils";



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
  /** Controls the slide-in contact details panel on the right */
  const [showContactPanel, setShowContactPanel] = useState(false);
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
    setShowContactPanel(false);
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
        .select(`
          *,
          contact:contacts(*, blocked:blocked_contacts(id)),
          settings:conversation_settings(*),
          lead_conversations(lead:b2b_leads(*))
        `)
        .eq("id", convId)
        .maybeSingle();
      if (error) {
        console.error("[Inbox] Failed to hydrate conversation:", {
          message: error.message,
          details: error.details,
          hint: error.hint,
          code: error.code,
        });
        return;
      }
      if (!data) return;
      const fetched = data as Conversation;
      console.log("[Inbox] Hydrated conversation:", fetched.id, "last_message_text:", fetched.last_message_text);
      setConversations((prev) => {
        const existing = prev.find((c) => c.id === fetched.id);
        if (existing) {
          // Merge fetched data fully (last_message_text, unread_count, etc.)
          // but preserve any local overrides already applied (e.g. unread_count=0
          // if the user has this conversation open)
          return prev.map((c) =>
            c.id === fetched.id
              ? {
                  ...fetched,
                  // Keep contact if already hydrated (avoid flicker)
                  contact: c.contact ?? fetched.contact,
                  settings: c.settings ?? fetched.settings,
                  lead_conversations: c.lead_conversations ?? fetched.lead_conversations,
                }
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

      // Normalize phone number
      const normalizedPhoneInput = normalizePhoneForCRM(phoneParam);
      if (!normalizedPhoneInput) return;

      // 1. Find or create contact using deduplication helper
      let contact: Contact | null = null;
      contact = await findExistingContact(supabase, accountId, normalizedPhoneInput) as Contact | null;

      if (!contact) {
        // Create new contact
        const { data: newContact, error: createContactErr } = await supabase
          .from("contacts")
          .insert({
            account_id: accountId,
            user_id: user.id,
            phone: normalizedPhoneInput,
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

      // Fetch whatsapp config to get default AI behavior
      const { data: config } = await supabase
        .from("whatsapp_config")
        .select("status, ai_enabled")
        .eq("account_id", accountId)
        .maybeSingle();

      // Find related CRM Lead for assigned user and linking
      let relatedCrmLead: any = null;
      if (docTypeParam === "enquiry" && docIdParam) {
        const { data: leadById } = await supabase
          .from("crm_leads")
          .select("*, b2b_leads(*)")
          .or(`id.eq.${docIdParam},b2b_lead_id.eq.${docIdParam}`)
          .maybeSingle();
        relatedCrmLead = leadById;
      }
      
      if (!relatedCrmLead && contact) {
        const { data: leadByContact } = await supabase
          .from("crm_leads")
          .select("*, b2b_leads(*)")
          .or(`contact_id.eq.${contact.id},phone.eq.${contact.phone}`)
          .is("deleted_at", null)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        relatedCrmLead = leadByContact;
      }

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
            ai_mode: config?.ai_enabled ?? false,
            assigned_agent_id: relatedCrmLead?.assigned_to || null,
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
        // Update CRM Lead linking if available
        if (relatedCrmLead) {
          await supabase
            .from("crm_leads")
            .update({ conversation_id: conversation.id })
            .eq("id", relatedCrmLead.id);

          if (relatedCrmLead.b2b_lead_id) {
            const { data: existingLC } = await supabase
              .from("lead_conversations")
              .select("id")
              .eq("lead_id", relatedCrmLead.b2b_lead_id)
              .eq("conversation_id", conversation.id)
              .maybeSingle();
              
            if (!existingLC) {
              await supabase
                .from("lead_conversations")
                .insert({
                  account_id: accountId,
                  lead_id: relatedCrmLead.b2b_lead_id,
                  conversation_id: conversation.id
                });
            }
          }
        }

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
      console.log("[Inbox] handleMessageEvent:", event.eventType, "conv:", newMsg.conversation_id, "text:", newMsg.content_text);

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
          setConversations((prev) => {
            const updated = prev.map((c) =>
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
            );
            // Bubble updated conversation to top
            const idx = updated.findIndex((c) => c.id === newMsg.conversation_id);
            if (idx > 0) {
              const [moved] = updated.splice(idx, 1);
              return [moved, ...updated];
            }
            return updated;
          });
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
      console.log("[Inbox] handleConversationEvent:", event.eventType, conv.id, "last_message_text:", conv.last_message_text);

      if (event.eventType === "INSERT") {
        if (!knownConvIdsRef.current.has(conv.id)) {
          // Always hydrate so we get contact + settings + lead_conversations
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
                      // Preserve joined fields that realtime payload won't include
                      ...c,
                      // Spread only the scalar columns from the realtime payload
                      last_message_text: conv.last_message_text ?? c.last_message_text,
                      last_message_at: conv.last_message_at ?? c.last_message_at,
                      unread_count: isActive ? 0 : (conv.unread_count ?? c.unread_count),
                      status: conv.status ?? c.status,
                      ai_mode: conv.ai_mode ?? c.ai_mode,
                      assigned_agent_id: conv.assigned_agent_id ?? c.assigned_agent_id,
                      updated_at: conv.updated_at ?? c.updated_at,
                    }
                  : c,
              ),
          );
        } else {
          hydrateConversation(conv.id);
        }

        if (activeConversation && conv.id === activeConversation.id) {
          setActiveConversation((prev) =>
            prev ? {
              ...prev,
              last_message_text: conv.last_message_text ?? prev.last_message_text,
              last_message_at: conv.last_message_at ?? prev.last_message_at,
              status: conv.status ?? prev.status,
              ai_mode: conv.ai_mode ?? prev.ai_mode,
              assigned_agent_id: conv.assigned_agent_id ?? prev.assigned_agent_id,
            } : prev
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

  const handleOpenContactPanel = useCallback(() => {
    setShowContactPanel(true);
  }, []);

  const handleCloseContactPanel = useCallback(() => {
    setShowContactPanel(false);
  }, []);

  return (
    // Root: full height, WhatsApp dark background, flex column
    <div
      className="-m-4 flex h-[calc(100vh-3.5rem)] flex-col overflow-hidden sm:-m-6"
      style={{ background: "#0B141A" }}
    >
      {/* ── Compact WhatsApp connection banner ── */}
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

      {/*
        ── 2-Panel Grid Layout ──
        Desktop (md+):  350px sidebar | remaining chat area
        Mobile (<md):   1 column — list OR thread (sliding)
        Contact details panel is a right-edge overlay, hidden by default,
        slides in when avatar/name is clicked.
      */}
      <div
        className={cn(
          "flex-1 overflow-hidden",
          "flex flex-col",
          "md:grid md:grid-cols-[350px_minmax(0,1fr)]",
        )}
        style={{ background: "#0B141A" }}
      >
        {/* ── LEFT: Conversation List ── */}
        <div
          className={cn(
            "h-full overflow-hidden",
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

        {/* ── CENTER: Message Thread (takes all remaining width) ── */}
        {/* `min-w-0` prevents wide content blowing out the grid cell */}
        <div
          className={cn(
            "relative h-full min-w-0 overflow-hidden",
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
            onOpenContactPanel={handleOpenContactPanel}
          />

          {/*
            ── RIGHT: Contact Details Overlay Panel ──
            Hidden by default. Slides in from the right when the user
            clicks the avatar or customer name in the chat header.
            On desktop: overlays the right portion of the chat.
            On mobile:  full-width slide-in drawer with dark backdrop.
          */}

          {/* Mobile backdrop */}
          {showContactPanel && (
            <div
              className="absolute inset-0 z-20 md:hidden"
              style={{ background: "rgba(0,0,0,0.5)", backdropFilter: "blur(2px)" }}
              onClick={handleCloseContactPanel}
              aria-hidden="true"
            />
          )}

          {/* Sliding panel */}
          <div
            className={cn(
              "absolute top-0 right-0 h-full z-30 flex flex-col",
              "transition-transform duration-300 ease-in-out",
              "w-full md:w-[350px]",
              showContactPanel ? "translate-x-0" : "translate-x-full",
            )}
            style={{
              boxShadow: showContactPanel ? "-4px 0 24px rgba(0,0,0,0.4)" : "none",
            }}
          >
            <ContactSidebar
              contact={activeContact}
              conversation={activeConversation}
              onRefresh={handleManualRefresh}
              profiles={profiles}
              onClose={handleCloseContactPanel}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
