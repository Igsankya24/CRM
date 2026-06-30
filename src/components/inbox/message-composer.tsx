"use client";

import { useState, useRef, useCallback, KeyboardEvent, useEffect, createElement } from "react";
import {
  Send,
  LayoutTemplate,
  Bot,
  Smile,
  Paperclip,
  Mic,
  X,
  Trash2,
  Check,
  Sparkles,
  FileText,
  Image as ImageIcon,
  Headphones,
  Video,
  File,
  Loader2,
  Zap
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { GatedButton } from "@/components/ui/gated-button";
import { useCan } from "@/hooks/use-can";
import { cn } from "@/lib/utils";
import { ReplyQuote } from "./reply-quote";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { createClient } from "@/lib/supabase/client";

interface ReplyDraft {
  id: string;
  authorLabel: string;
  preview: string;
}

interface SelectedAttachment {
  file: globalThis.File;
  type: "image" | "video" | "audio" | "document";
  previewUrl: string;
}

interface MessageComposerProps {
  conversationId: string;
  sessionExpired: boolean;
  onSend: (
    text: string,
    replyToId?: string,
    attachment?: SelectedAttachment | null
  ) => void;
  onOpenTemplates: () => void;
  replyTo?: ReplyDraft | null;
  onClearReply?: () => void;
  aiMode?: boolean;
  prefillContext?: {
    text: string;
    docType: string | null;
    docId: string | null;
    docNo: string | null;
  } | null;
}

const EMOJI_CATEGORIES = [
  {
    name: "Smileys",
    emojis: ["😀", "😃", "😄", "😁", "😆", "😅", "😂", "🤣", "😊", "😇", "🙂", "🙃", "😉", "😌", "😍", "🥰", "😘", "😋", "😛", "😜", "😎", "🤩", "🥳", "🤔", "🤫", "😴", "🤮", "🥵", "🥶", "🤯"]
  },
  {
    name: "Gestures",
    emojis: ["👍", "👎", "👊", "✊", "🤛", "🤜", "🤝", "👏", "🙌", "👐", "🙏", "✌️", "🤘", "👌", "🤌", "👈", "👉", "👆", "👇", "👋", "✍️", "💪", "🤳"]
  },
  {
    name: "Hearts & Stars",
    emojis: ["❤️", "🧡", "💛", "💚", "💙", "💜", "🖤", "🤍", "🤎", "💔", "❣️", "💕", "💞", "💓", "💗", "💖", "💘", "💝", "🔥", "✨", "⭐", "🌟", "💥", "💯"]
  },
  {
    name: "Office",
    emojis: ["💻", "📱", "📞", "☎️", "✉️", "📦", "💼", "📈", "📅", "📊", "📋", "📁", "📎", "🔒", "🔑", "💡", "💰", "💵", "✅", "❌", "⚠️", "ℹ️", "🚀", "🚨"]
  }
];

const TRANSLATED_SUGGESTIONS: Record<string, Record<string, string[]>> = {
  INDIAMART: {
    English: [
      "We received your inquiry via IndiaMART. May we know your required quantity?",
      "I'm sending the requested product brochure. Let us know if you need a quote.",
      "Can we connect for a quick 5-minute call to discuss your specifications?"
    ],
    Hindi: [
      "हमें इंडियामार्ट के माध्यम से आपका अनुरोध प्राप्त हुआ है। क्या हम आपकी आवश्यक मात्रा जान सकते हैं?",
      "मैं अनुरोधित उत्पाद विवरणिका भेज रहा हूँ। यदि आपको कोटेशन की आवश्यकता हो तो हमें बताएं।",
      "क्या हम आपकी विशिष्टताओं पर चर्चा करने के लिए 5 मिनट की त्वरित कॉल पर जुड़ सकते हैं?"
    ],
    Hinglish: [
      "Humein IndiaMART ke zariye aapka inquiry mila hai. Kya hum aapki required quantity jaan sakte hain?",
      "Main requested product brochure bhej raha hoon. Agar aapko quotation chahiye toh bataiye.",
      "Kya hum specs discuss karne ke liye ek quick 5-minute call pe connect kar sakte hain?"
    ],
    Marathi: [
      "आम्हाला इंडियामार्ट द्वारे तुमची विचारणा मिळाली आहे. आम्हाला तुमची आवश्यक प्रमाण कळू शकेल का?",
      "मी विनंती केलेले उत्पादन माहितीपत्रक पाठवत आहे. तुम्हाला कोटेशन हवे असल्यास आम्हाला सांगा.",
      "तुमच्या गरजेनुसार चर्चा करण्यासाठी आपण ५ मिनिटांच्या कॉलवर बोलू शकतो का?"
    ],
    "Roman Marathi": [
      "Amhala IndiaMART kadun tumchi enquiry bhetli ahe. Tumhala kiti quantity pahije sangu shakta ka?",
      "Mi product brochure pathvat ahe. Quotation lagnar asel tar nakki sanga.",
      "Garajenusar charcha karnyasathi apan ek quick 5-minute call var boluya ka?"
    ],
    Kannada: [
      "ನಮಗೆ ಇಂಡಿಯಾಮಾರ್ಟ್ ಮೂಲಕ ನಿಮ್ಮ ವಿಚಾರಣೆ ಬಂದಿದೆ. ನಿಮ್ಮ ಪ್ರಮಾಣ ಎಷ್ಟು ಬೇಕು ಎಂದು ತಿಳಿಸಬಹುದೇ?",
      "ನಾನು ಉತ್ಪನ್ನದ ಬ್ರೋಷರ್ ಕಳುಹಿಸುತ್ತಿದ್ದೇನೆ. ನಿಮಗೆ ಕೊಟೇಶನ್ ಬೇಕಾದರೆ ದಯವಿಟ್ಟು ತಿಳಿಸಿ.",
      "ನಿಮ್ಮ ಅಗತ್ಯಗಳ ಬಗ್ಗೆ ಮಾತನಾಡಲು ನಾವು 5 ನಿಮಿಷಗಳ ಕಾಲ ಫೋನ್ ಕರೆಯಲ್ಲಿ ಮಾತನಾಡಬಹುದೇ?"
    ],
    "Roman Kannada": [
      "Namage IndiaMART inda nimma enquiry bandide. Nimage yestu quantity beku anta helabahude?",
      "Nanu product brochure kalusuttiddene. Quotation beku adre namma jothe heli.",
      "Nimma specs bagge mathadalu navu fast agi 5-minute call nalli connect agabahude?"
    ]
  },
  TRADEINDIA: {
    English: [
      "Thanks for reaching out on TradeIndia! What is your delivery location?",
      "Sure, I will share the price list and catalogs shortly.",
      "Would you like us to schedule a callback with our product experts?"
    ],
    Hindi: [
      "ट्रेडइंडिया पर हमसे संपर्क करने के लिए धन्यवाद! आपका डिलीवरी स्थान क्या है?",
      "ज़रूर, मैं जल्द ही मूल्य सूची और कैटलॉग साझा करूँगा।",
      "क्या आप चाहेंगे कि हम अपने उत्पाद विशेषज्ञों के साथ एक कॉल शेड्यूल करें?"
    ],
    Hinglish: [
      "TradeIndia par reach out karne ke liye thanks! Aapka delivery location kya hai?",
      "Sure, main price list aur catalogs jaldi hi share karunga.",
      "Kya aap chahenge ki hum apne product experts ke saath ek callback schedule karein?"
    ],
    Marathi: [
      "ट्रेडइंडियावर संपर्क साधल्याबद्दल धन्यवाद! तुमचे डिलिव्हरीचे ठिकाण काय आहे?",
      "नक्कीच, मी लवकरच किंमत सूची आणि कॅटलॉग सामायिक करेन.",
      "तुम्हाला आमच्या उत्पादन तज्ञांसोबत कॉल शेड्यूल करायला आवडेल का?"
    ],
    "Roman Marathi": [
      "TradeIndia var contact kelyabaddal thanks! Tumche delivery location konte ahe?",
      "Nakkich, mi lavkarach price list ani catalogue share karto.",
      "Tumhi amchya product expert sobat bolnyasathi callback schedule karu ichhita ka?"
    ],
    Kannada: [
      "ಟ್ರೇಡ್‌ಇಂಡಿಯಾದಲ್ಲಿ ಸಂಪರ್ಕಿಸಿದ್ದಕ್ಕಾಗಿ ಧನ್ಯವಾದಗಳು! ನಿಮ್ಮ ವಿತರಣಾ ಸ್ಥಳ ಯಾವುದು?",
      "ಖಂಡಿತ, ನಾನು ಶೀಘ್ರದಲ್ಲೇ ಬೆಲೆ ಪಟ್ಟಿ ಮತ್ತು ಕ್ಯಾಟಲಾಗ್‌ಗಳನ್ನು ಹಂಚಿಕೊಳ್ಳುತ್ತೇನೆ.",
      "ನಮ್ಮ ಉತ್ಪನ್ನ ತಜ್ಞರೊಂದಿಗೆ ಫೋನ್ ಕರೆಯನ್ನು ನಿಗದಿಪಡಿಸಲು ನೀವು ಬಯಸುವಿರಾ?"
    ],
    "Roman Kannada": [
      "TradeIndia dalli contact madiddakke dhanyavadagalu! Nimma delivery location yavudu?",
      "Khanditha, nanu price list mattu catalogue kalusuttene.",
      "Namma product experts jothe callback schedule madalu nimage istavideya?"
    ]
  },
  EXPORTERSINDIA: {
    English: [
      "Thank you for contacting us on ExportersIndia. What is your timeline?",
      "Yes, we support bulk exports. Let me send our global export catalog.",
      "Could you share your direct WhatsApp number or email address?"
    ],
    Hindi: [
      "एक्सपोर्टर्सइंडिया पर हमसे संपर्क करने के लिए धन्यवाद। आपकी समयसीमा क्या है?",
      "हाँ, हम थोक निर्यात का समर्थन करते हैं। मुझे अपना वैश्विक निर्यात कैटलॉग भेजने दें।",
      "क्या आप अपना सीधा व्हाट्सएप नंबर या ईमेल पता साझा कर सकते हैं?"
    ],
    Hinglish: [
      "ExportersIndia par humse contact karne ke liye thanks. Aapki timeline kya hai?",
      "Haan, hum bulk exports support karte hain. Main hamara global export catalog bhejta hoon.",
      "Kya aap apna direct WhatsApp number ya email address share kar sakte hain?"
    ],
    Marathi: [
      "एक्सपोर्टर्सइंडियावर आमच्याशी संपर्क साधल्याबद्दल धन्यवाद. तुमची वेळमर्यादा काय आहे?",
      "होय, आम्ही घाऊक निर्यातीला पाठिंबा देतो. मला आमचे जागतिक निर्यात कॅटलॉग पाठवू द्या.",
      "तुम्ही तुमचा थेट व्हॉट्सॲप नंबर किंवा ईमेल पत्ता शेअर करू शकता का?"
    ],
    "Roman Marathi": [
      "ExportersIndia var contact kelyabaddal thanks. Tumche timeline kay ahe?",
      "Hoy, amhi bulk export support karto. Mi amcha global export catalogue pathvato.",
      "Tumhi tumcha direct WhatsApp number kinva email share karu shakto ka?"
    ],
    Kannada: [
      "ಎಕ್ಸ್‌ಪೋರ್ಟರ್ಸ್‌ಇಂಡಿಯಾದಲ್ಲಿ ನಮ್ಮನ್ನು ಸಂಪರ್ಕಿಸಿದ್ದಕ್ಕಾಗಿ ಧನ್ಯವಾದಗಳು. ನಿಮ್ಮ ಸಮಯದ ಮಿತಿ ಏನು?",
      "ಹೌದು, ನಾವು ಸಗಟು ರಫ್ತುಗಳನ್ನು ಬೆಂಬಲಿಸುತ್ತೇವೆ. ನಮ್ಮ ಜಾಗತಿಕ ರಫ್ತು ಕ್ಯಾಟಲಾಗ್ ಕಳುಹಿಸಲು ನನಗೆ ಅನುಮतಿಸಿ.",
      "ನಿಮ್ಮ ನೇರ ವಾಟ್ಸಾಪ್ ಸಂಖ್ಯೆ ಅಥವಾ ಇಮೇಲ್ ವಿಳಾಸವನ್ನು ಹಂಚಿಕೊಳ್ಳಬಹುದೇ?"
    ],
    "Roman Kannada": [
      "ExportersIndia dalli contact madiddakke dhanyavadagalu. Nimma timeline yavudu?",
      "Houdu, navu bulk export support maduttene. Nanu global export catalogue kalusuttene.",
      "Nimma direct WhatsApp number athava email address share madabahude?"
    ]
  },
  OTHER: {
    English: [
      "Hello! Sure, I will send the catalog details right away.",
      "Could you please share your email address for sending the proposal?",
      "I have scheduled a follow-up call. We'll speak soon."
    ],
    Hindi: [
      "नमस्ते! ज़रूर, मैं तुरंत कैटलॉग विवरण भेज दूँगा।",
      "प्रस्ताव भेजने के लिए क्या आप कृपया अपना ईमेल पता साझा कर सकते हैं?",
      "मैंने एक अनुवर्ती कॉल शेड्यूल की है। हम जल्द ही बात करेंगे।"
    ],
    Hinglish: [
      "Hello! Sure, main catalog details abhi bhej deta hoon.",
      "Proposal bhejne ke liye kya aap please apna email address share करेंगे?",
      "Maine ek follow-up call schedule kiya hai. Hum jaldi baat karenge."
    ],
    Marathi: [
      "नमस्कार! नक्कीच, मी ताबडतोब कॅटलॉग तपशील पाठवीन.",
      "प्रस्ताव पाठवण्यासाठी तुम्ही कृपया तुमचा ईमेल पत्ता शेअर करू शकता का?",
      "मी फॉलो-अप कॉल शेड्यूल केला आहे. आपण लवकरच बोलू."
    ],
    "Roman Marathi": [
      "Hello! Nakkich, mi catalogue details lagech pathvato.",
      "Proposal pathvnyasathi tumhi tumcha email address share karu shakto ka?",
      "Mi ek follow-up call schedule kela ahe. Apan lavkarach bolu."
    ],
    Kannada: [
      "ನಮಸ್ಕಾರ! ಖಂಡಿತ, ನಾನು ಕ್ಯಾಟಲಾಗ್ ವಿವರಗಳನ್ನು ತಕ್ಷಣವೇ ಕಳುಹಿಸುತ್ತೇನೆ.",
      "ಪ್ರಸ್ತಾವನೆಯನ್ನು ಕಳುಹಿಸಲು ದಯವಿಟ್ಟು ನಿಮ್ಮ ಇಮೇಲ್ ವಿಳಾಸವನ್ನು ಹಂಚಿಕೊಳ್ಳಬಹುದೇ?",
      "ನಾನು ಫಾಲೋ-ಅಪ್ ಕರೆಯನ್ನು ನಿಗದಿಪಡಿಸಿದ್ದೇನೆ. ನಾವು ಶೀಘ್ರದಲ್ಲೇ ಮಾತನಾಡುತ್ತೇವೆ."
    ],
    "Roman Kannada": [
      "Hello! Sure, nanu catalogue details thakshana kalusuttene.",
      "Proposal kalusuttadakke dayavittu nimma email address share madabahude?",
      "Nanu ondu follow-up call schedule madiddene. Navu bega mathadonu."
    ]
  }
};

export function MessageComposer({
  conversationId,
  sessionExpired,
  onSend,
  onOpenTemplates,
  replyTo,
  onClearReply,
  aiMode,
  prefillContext,
}: MessageComposerProps) {
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [activeEmojiTab, setActiveEmojiTab] = useState("Smileys");
  const [attachment, setAttachment] = useState<SelectedAttachment | null>(null);
  const [defaultBank, setDefaultBank] = useState<any | null>(null);

  const [generatingPrefillPdf, setGeneratingPrefillPdf] = useState(false);
  const [latestDocs, setLatestDocs] = useState<{
    quotation: { id: string; no: string } | null;
    proforma: { id: string; no: string } | null;
    sales: { id: string; no: string } | null;
  }>({ quotation: null, proforma: null, sales: null });

  // Fetch latest documents & default bank details for the active conversation
  useEffect(() => {
    if (!conversationId) return;
    const supabase = createClient();
    
    (async () => {
      try {
        const { data: conv } = await supabase
          .from("conversations")
          .select("*, contact:contacts(*)")
          .eq("id", conversationId)
          .maybeSingle();

        if (conv?.account_id) {
          const { data: bankAccounts } = await supabase
            .from("company_bank_accounts")
            .select("*")
            .eq("account_id", conv.account_id);

          const defaultAcc = bankAccounts?.find(b => b.is_default) || bankAccounts?.[0] || null;
          setDefaultBank(defaultAcc);
        } else {
          setDefaultBank(null);
        }

        const phone = conv?.contact?.phone;
        if (phone) {
          const { data: quots } = await supabase
            .from("quotations")
            .select("id, quotation_no")
            .eq("mobile", phone)
            .order("created_at", { ascending: false })
            .limit(1);

          const { data: profs } = await supabase
            .from("proformas")
            .select("id, proforma_no")
            .eq("mobile", phone)
            .order("created_at", { ascending: false })
            .limit(1);

          const { data: salesRegs } = await supabase
            .from("sales_registers")
            .select("id, sales_register_no")
            .eq("mobile", phone)
            .order("created_at", { ascending: false })
            .limit(1);

          setLatestDocs({
            quotation: quots?.[0] ? { id: quots[0].id, no: quots[0].quotation_no } : null,
            proforma: profs?.[0] ? { id: profs[0].id, no: profs[0].proforma_no } : null,
            sales: salesRegs?.[0] ? { id: salesRegs[0].id, no: salesRegs[0].sales_register_no } : null,
          });
        }
      } catch (err) {
        console.error("Failed to load customer latest documents and bank details:", err);
      }
    })();
  }, [conversationId]);

  const generatePrefilledPdf = useCallback(async (docType: string, docId: string, docNo: string) => {
    setGeneratingPrefillPdf(true);
    try {
      let finalLogoBase64: string | null = null;
      
      const { pdf } = await import("@react-pdf/renderer");

      const getBase64Image = async (url: string | null | undefined): Promise<string | null> => {
        if (!url) return null;
        try {
          const res = await fetch(url);
          if (!res.ok) return url;
          const blob = await res.blob();
          return new Promise((resolve) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result as string);
            reader.onerror = () => resolve(url);
            reader.readAsDataURL(blob);
          });
        } catch {
          return url;
        }
      };

      if (docType === "quotation") {
        const fetchRes = await fetch(`/api/quotations/${docId}`);
        if (!fetchRes.ok) throw new Error("Failed to fetch quotation details");
        const resJson = await fetchRes.json();
        let quotation = resJson.quotation;
        if (!quotation) throw new Error("Quotation not found");

        const targetLogoUrl = quotation.company_logo_url || (typeof window !== "undefined" ? window.location.origin + "/logo.png" : "/logo.png");
        if (targetLogoUrl) {
          finalLogoBase64 = await getBase64Image(targetLogoUrl);
        }
        if (quotation.company_details?.signature_url) {
          const signatureBase64 = await getBase64Image(quotation.company_details.signature_url);
          quotation = {
            ...quotation,
            company_details: {
              ...quotation.company_details,
              signature_url: signatureBase64,
            },
          };
        }

        const { QuotationPDFDocument } = await import("../quotations/quotation-pdf-document");
        const blob = await pdf(
          createElement(QuotationPDFDocument, { quotation, logoUrl: finalLogoBase64 }) as any
        ).toBlob();
        const file = new globalThis.File([blob], `${docNo}.pdf`, { type: "application/pdf" });
        setAttachment({
          file,
          type: "document",
          previewUrl: URL.createObjectURL(file),
        });
        toast.success(`Attached Quotation PDF: ${docNo}.pdf`);
      } else if (docType === "proforma") {
        const fetchRes = await fetch(`/api/proformas/${docId}`);
        if (!fetchRes.ok) throw new Error("Failed to fetch proforma details");
        const resJson = await fetchRes.json();
        let proforma = resJson.proforma;
        if (!proforma) throw new Error("Proforma not found");

        const targetLogoUrl = proforma.company_logo_url || (typeof window !== "undefined" ? window.location.origin + "/logo.png" : "/logo.png");
        if (targetLogoUrl) {
          finalLogoBase64 = await getBase64Image(targetLogoUrl);
        }
        if (proforma.company_details?.signature_url) {
          const signatureBase64 = await getBase64Image(proforma.company_details.signature_url);
          proforma = {
            ...proforma,
            company_details: {
              ...proforma.company_details,
              signature_url: signatureBase64,
            },
          };
        }

        const { ProformaPDFDocument } = await import("../proformas/proforma-pdf-document");
        const blob = await pdf(
          createElement(ProformaPDFDocument, { proforma, logoUrl: finalLogoBase64 }) as any
        ).toBlob();
        const file = new globalThis.File([blob], `${docNo}.pdf`, { type: "application/pdf" });
        setAttachment({
          file,
          type: "document",
          previewUrl: URL.createObjectURL(file),
        });
        toast.success(`Attached Proforma PDF: ${docNo}.pdf`);
      } else if (docType === "sales") {
        const fetchRes = await fetch(`/api/sales-registers/${docId}`);
        if (!fetchRes.ok) throw new Error("Failed to fetch sales details");
        const resJson = await fetchRes.json();
        let salesRegister = resJson.salesRegister;
        if (!salesRegister) throw new Error("Sales order not found");

        const targetLogoUrl = salesRegister.company_logo_url || (typeof window !== "undefined" ? window.location.origin + "/logo.png" : "/logo.png");
        if (targetLogoUrl) {
          finalLogoBase64 = await getBase64Image(targetLogoUrl);
        }
        if (salesRegister.company_details?.signature_url) {
          const signatureBase64 = await getBase64Image(salesRegister.company_details.signature_url);
          salesRegister = {
            ...salesRegister,
            company_details: {
              ...salesRegister.company_details,
              signature_url: signatureBase64,
            },
          };
        }

        const { SalesRegisterPDFDocument } = await import("../sales-registers/sales-register-pdf-document");
        const blob = await pdf(
          createElement(SalesRegisterPDFDocument, { salesRegister, logoUrl: finalLogoBase64 }) as any
        ).toBlob();
        const file = new globalThis.File([blob], `${docNo}.pdf`, { type: "application/pdf" });
        setAttachment({
          file,
          type: "document",
          previewUrl: URL.createObjectURL(file),
        });
        toast.success(`Attached Sales PDF: ${docNo}.pdf`);
      }
    } catch (err) {
      console.error("Auto prefill PDF compilation failed:", err);
      toast.error("Failed to auto-compile PDF attachment.");
    } finally {
      setGeneratingPrefillPdf(false);
    }
  }, [conversationId]);

  // Handle prefill context load
  useEffect(() => {
    if (prefillContext?.text) {
      setText(prefillContext.text);
      if (prefillContext.docType && prefillContext.docId && prefillContext.docNo) {
        generatePrefilledPdf(prefillContext.docType, prefillContext.docId, prefillContext.docNo);
      }
      setTimeout(() => {
        if (textareaRef.current) {
          textareaRef.current.focus();
          textareaRef.current.setSelectionRange(prefillContext.text.length, prefillContext.text.length);
        }
      }, 200);
    }
  }, [prefillContext, generatePrefilledPdf]);

  // Autofocus input on conversation switch
  useEffect(() => {
    if (conversationId && textareaRef.current) {
      setTimeout(() => {
        textareaRef.current?.focus();
      }, 100);
    }
  }, [conversationId]);

  const [generatingAiReply, setGeneratingAiReply] = useState(false);

  const handleGenerateAiReply = async () => {
    if (generatingAiReply) return;
    setGeneratingAiReply(true);
    try {
      const res = await fetch("/api/ai/suggest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conversation_id: conversationId }),
      });
      const data = await res.json();
      if (res.ok && data.reply) {
        setText(data.reply);
        if (textareaRef.current) {
          setTimeout(() => {
            textareaRef.current?.focus();
            adjustHeight();
          }, 50);
        }
      } else {
        toast.error(data.error || "Failed to generate AI reply suggestion.");
      }
    } catch (err) {
      console.error(err);
      toast.error("Error generating AI reply suggestion.");
    } finally {
      setGeneratingAiReply(false);
    }
  };
  
  // Voice recording simulation states
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const recordingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  
  // Dynamic AI reply suggestions
  const [aiSuggestions, setAiSuggestions] = useState<string[]>([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [fileAccept, setFileAccept] = useState("*/*");

  const canSend = useCan("send-messages");
  const readOnly = !canSend;

  // Auto-grow textarea logic
  const adjustHeight = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
  }, []);

  // Fetch dynamic context-aware suggestions
  useEffect(() => {
    if (!conversationId) return;
    Promise.resolve().then(() => setLoadingSuggestions(true));
    const supabase = createClient();
    
    (async () => {
      try {
        // Resolve platform of the associated lead to make suggestions context-aware
        const { data: lc } = await supabase
          .from("lead_conversations")
          .select("lead:b2b_leads(platform)")
          .eq("conversation_id", conversationId)
          .maybeSingle();

        const leadData = lc?.lead;
        const platform = Array.isArray(leadData)
          ? (leadData[0] as { platform: string } | undefined)?.platform
          : (leadData as unknown as { platform: string } | null)?.platform;

        // Resolve preferred language from ai_conversation_memory
        const { data: convMem } = await supabase
          .from("ai_conversation_memory")
          .select("preferred_language")
          .eq("conversation_id", conversationId)
          .maybeSingle();

        const preferredLanguage = convMem?.preferred_language || "English";
        const pf = (platform === "INDIAMART" || platform === "TRADEINDIA" || platform === "EXPORTERSINDIA") ? platform : "OTHER";
        const langKey = TRANSLATED_SUGGESTIONS[pf][preferredLanguage] ? preferredLanguage : "English";
        const suggestions = TRANSLATED_SUGGESTIONS[pf][langKey] || TRANSLATED_SUGGESTIONS[pf]["English"];

        setAiSuggestions(suggestions);
      } catch (err) {
        console.error(err);
      } finally {
        setLoadingSuggestions(false);
      }
    })();
  }, [conversationId]);

  // Recording Timer Effect
  useEffect(() => {
    if (isRecording) {
      Promise.resolve().then(() => setRecordingSeconds(0));
      recordingTimerRef.current = setInterval(() => {
        setRecordingSeconds((prev) => prev + 1);
      }, 1000);
    } else {
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current);
      }
    }
    return () => {
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current);
      }
    };
  }, [isRecording]);

  const handleSend = useCallback(async () => {
    const trimmed = text.trim();
    if ((!trimmed && !attachment) || sending || sessionExpired) return;

    setSending(true);
    try {
      onSend(trimmed, replyTo?.id, attachment);
      setText("");
      setAttachment(null);
      if (textareaRef.current) {
        textareaRef.current.style.height = "auto";
      }
    } finally {
      setSending(false);
    }
  }, [text, sending, sessionExpired, onSend, replyTo?.id, attachment]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend]
  );

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      setText(e.target.value);
      adjustHeight();
    },
    [adjustHeight]
  );

  // Emojis popover insertion
  const handleEmojiClick = useCallback((emoji: string) => {
    const el = textareaRef.current;
    if (!el) return;
    const start = el.selectionStart;
    const end = el.selectionEnd;
    const nextText = text.substring(0, start) + emoji + text.substring(end);
    setText(nextText);
    adjustHeight();
    
    // Focus back and set cursor position after emoji
    setTimeout(() => {
      el.focus();
      el.setSelectionRange(start + emoji.length, start + emoji.length);
    }, 10);
  }, [text, adjustHeight]);

  // Trigger file attachment dialog
  const handleAttachmentClick = (type: "image" | "video" | "audio" | "document") => {
    if (readOnly) return;
    if (type === "image" || type === "video") {
      setFileAccept("image/*,video/*");
    } else if (type === "audio") {
      setFileAccept("audio/*");
    } else {
      setFileAccept(".pdf,.doc,.docx,.xls,.xlsx,.txt");
    }
    setTimeout(() => {
      fileInputRef.current?.click();
    }, 50);
  };

  // Handle actual file choosing
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const fileType = file.type.split("/")[0];
    let category: SelectedAttachment["type"] = "document";
    if (fileType === "image") category = "image";
    else if (fileType === "video") category = "video";
    else if (fileType === "audio") category = "audio";

    setAttachment({
      file,
      type: category,
      previewUrl: URL.createObjectURL(file),
    });
  };

  // Remove attachment preview
  const handleClearAttachment = () => {
    if (attachment) {
      URL.revokeObjectURL(attachment.previewUrl);
    }
    setAttachment(null);
  };

  // Start voice recording simulation
  const handleStartRecording = () => {
    if (readOnly) return;
    setIsRecording(true);
  };

  // Cancel voice recording simulation
  const handleCancelRecording = () => {
    setIsRecording(false);
  };

  // Send simulated voice note
  const handleSendVoiceRecording = () => {
    // Silent 1-sec WAV base64 data to play locally
    const base64Audio = "data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA";
    const minutes = Math.floor(recordingSeconds / 60);
    const secs = recordingSeconds % 60;
    const durationLabel = `Voice Note (${minutes}:${secs < 10 ? "0" : ""}${secs})`;

    // Create a mock Audio File object
    const file = new globalThis.File([], "voice_note.wav", { type: "audio/wav" });
    const voiceAttachment: SelectedAttachment = {
      file,
      type: "audio",
      previewUrl: base64Audio
    };

    onSend(durationLabel, replyTo?.id, voiceAttachment);
    setIsRecording(false);
  };

  const formatTime = (totalSecs: number) => {
    const mins = Math.floor(totalSecs / 60);
    const secs = totalSecs % 60;
    return `${mins}:${secs < 10 ? "0" : ""}${secs}`;
  };

  const dynamicQuickReplies = [
    { label: "Greeting", text: "Hello! Welcome to Phoenix Products. How can we help you today?" },
    { label: "Follow-up", text: "Hi! Just following up on our previous conversation. Let us know if you have any questions." },
    {
      label: "Payment Details",
      text: defaultBank
        ? `Please find our bank details:\n\nBank Name:\n${defaultBank.bank_name || ""}\n\nBranch:\n${defaultBank.branch_name || ""}\n\nAccount Name:\n${defaultBank.account_name || ""}\n\nAccount Number:\n${defaultBank.account_number || ""}\n\nAccount Type:\n${defaultBank.account_type || ""}\n\nIFSC Code:\n${defaultBank.bank_ifsc || ""}\n\nUPI:\n${defaultBank.upi_id || ""}\n\nThank you.`
        : "Please configure bank details in Settings > Company Profile > Bank Details."
    },
    { label: "Thank You", text: "Thank you for contacting Phoenix Products. We appreciate your business!" },
  ];

  return (
    <div className="border-t border-slate-800 bg-slate-900 p-3 select-none flex flex-col gap-2 shrink-0">
      {/* Hidden input file tag */}
      <input
        type="file"
        ref={fileInputRef}
        className="hidden"
        accept={fileAccept}
        onChange={handleFileChange}
      />

      {/* QUICK B2B ACTIONS TOOLBAR */}
      {!readOnly && !isRecording && (
        <div className="flex items-center gap-1.5 flex-wrap pb-1 border-b border-slate-805 mb-1.5">
          {/* AI REPLY BUTTON */}
          <button
            type="button"
            onClick={handleGenerateAiReply}
            disabled={generatingAiReply}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/20 text-[10px] font-bold text-emerald-400 uppercase tracking-wider transition-colors disabled:opacity-50"
            title="Generate AI response suggestion using knowledge base"
          >
            <Sparkles className={cn("h-3.5 w-3.5 fill-emerald-500/10", generatingAiReply && "animate-spin")} />
            {generatingAiReply ? "Thinking..." : "AI Reply"}
          </button>

          {/* QUICK REPLIES DROPDOWN */}
          <DropdownMenu>
            <DropdownMenuTrigger className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-750 border border-slate-700/60 text-[10px] font-bold text-slate-300 uppercase tracking-wider transition-colors">
              <Zap className="h-3.5 w-3.5 text-amber-400 fill-amber-400/10" />
              Quick Replies
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" side="top" className="border-slate-700 bg-slate-800 text-slate-200 w-56 max-h-64 overflow-y-auto">
              {dynamicQuickReplies.map((qr) => (
                <DropdownMenuItem
                  key={qr.label}
                  onClick={() => {
                    setText(qr.text);
                    setTimeout(() => textareaRef.current?.focus(), 50);
                    adjustHeight();
                  }}
                  className="text-xs py-2 flex flex-col items-start gap-1 cursor-pointer focus:bg-slate-700 focus:text-white"
                >
                  <span className="font-bold text-slate-200">{qr.label}</span>
                  <span className="text-[10px] text-slate-400 truncate w-full leading-normal text-left">{qr.text}</span>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* TEMPLATES BUTTON */}
          <button
            type="button"
            onClick={onOpenTemplates}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-750 border border-slate-700/60 text-[10px] font-bold text-slate-300 uppercase tracking-wider transition-colors"
          >
            <LayoutTemplate className="h-3.5 w-3.5 text-blue-400" />
            Templates
          </button>

          {/* ATTACH QUOTATION PDF BUTTON */}
          {latestDocs.quotation && (
            <button
              type="button"
              onClick={() => generatePrefilledPdf("quotation", latestDocs.quotation!.id, latestDocs.quotation!.no)}
              disabled={generatingPrefillPdf}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/20 text-[10px] font-bold text-blue-400 uppercase tracking-wider transition-colors disabled:opacity-50"
              title="Attach Latest Quotation PDF"
            >
              {generatingPrefillPdf ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin text-blue-400" />
              ) : (
                <File className="h-3.5 w-3.5 text-blue-400" />
              )}
              Quotation PDF
            </button>
          )}

          {/* ATTACH PROFORMA PDF BUTTON */}
          {latestDocs.proforma && (
            <button
              type="button"
              onClick={() => generatePrefilledPdf("proforma", latestDocs.proforma!.id, latestDocs.proforma!.no)}
              disabled={generatingPrefillPdf}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/20 text-[10px] font-bold text-blue-400 uppercase tracking-wider transition-colors disabled:opacity-50"
              title="Attach Latest Proforma PDF"
            >
              {generatingPrefillPdf ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin text-blue-400" />
              ) : (
                <File className="h-3.5 w-3.5 text-blue-400" />
              )}
              Proforma PDF
            </button>
          )}

          {/* ATTACH SALES PDF BUTTON */}
          {latestDocs.sales && (
            <button
              type="button"
              onClick={() => generatePrefilledPdf("sales", latestDocs.sales!.id, latestDocs.sales!.no)}
              disabled={generatingPrefillPdf}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/20 text-[10px] font-bold text-blue-400 uppercase tracking-wider transition-colors disabled:opacity-50"
              title="Attach Latest Sales PDF"
            >
              {generatingPrefillPdf ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin text-blue-400" />
              ) : (
                <File className="h-3.5 w-3.5 text-blue-400" />
              )}
              Sales PDF
            </button>
          )}

          {/* ATTACH FILE DROPDOWN SHORTCUTS */}
          <button
            type="button"
            onClick={() => handleAttachmentClick("document")}
            className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg hover:bg-slate-800 text-[10px] font-bold text-slate-400 hover:text-slate-200 transition-colors"
          >
            <Paperclip className="h-3.5 w-3.5" />
            Attach File
          </button>
        </div>
      )}

      {/* AI SUGGESTIONS ROW */}
      {!readOnly && !isRecording && aiSuggestions.length > 0 && (
        <div className="flex flex-col gap-1.5 pb-1">
          <div className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-emerald-500">
            <Sparkles className="h-3 w-3 fill-emerald-500/20" />
            <span>AI Suggested Replies</span>
          </div>
          <div className="flex items-center gap-1.5 overflow-x-auto py-1 scrollbar-none">
            {aiSuggestions.map((sug, i) => (
              <button
                key={i}
                onClick={() => {
                  setText(sug);
                  setTimeout(() => textareaRef.current?.focus(), 50);
                  adjustHeight();
                }}
                className="shrink-0 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/20 text-xs text-emerald-400 font-medium px-3 py-1.5 transition-colors max-w-[260px] truncate"
              >
                {sug}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* AI TYPING INDICATOR (PULSING ENGAGEMENT BANNER) */}
      {aiMode && !isRecording && (
        <div className="flex items-center gap-2 text-[10.5px] text-emerald-400/80 bg-emerald-500/5 px-2.5 py-1 rounded border border-emerald-500/10 self-start">
          <div className="flex gap-1 items-center">
            <span className="h-1.5 w-1.5 bg-emerald-400 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
            <span className="h-1.5 w-1.5 bg-emerald-400 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
            <span className="h-1.5 w-1.5 bg-emerald-400 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
          </div>
          <span className="font-semibold">AI Copilot mode active</span>
        </div>
      )}

      {/* ATTACHMENT CARD PREVIEW */}
      {attachment && (
        <div className="flex items-center gap-3 bg-slate-850 p-2 rounded-xl border border-slate-800 self-start max-w-[320px] shadow-lg animate-in fade-in slide-in-from-bottom-2 duration-200">
          {attachment.type === "image" ? (
            <img
              src={attachment.previewUrl}
              alt="attachment preview"
              className="h-12 w-12 rounded object-cover border border-slate-700"
            />
          ) : attachment.type === "video" ? (
            <div className="h-12 w-12 rounded bg-slate-800 flex items-center justify-center border border-slate-700">
              <Video className="h-5 w-5 text-slate-400" />
            </div>
          ) : attachment.type === "audio" ? (
            <div className="h-12 w-12 rounded bg-slate-800 flex items-center justify-center border border-slate-700">
              <Headphones className="h-5 w-5 text-slate-400" />
            </div>
          ) : (
            <div className="h-12 w-12 rounded bg-slate-800 flex items-center justify-center border border-slate-700">
              <FileText className="h-5 w-5 text-slate-400" />
            </div>
          )}
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold text-slate-200 truncate">{attachment.file.name}</p>
            <p className="text-[10px] text-slate-500">{(attachment.file.size / 1024).toFixed(1)} KB • {attachment.type}</p>
          </div>
          <button
            onClick={handleClearAttachment}
            className="h-7 w-7 flex items-center justify-center rounded-full bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-rose-400 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* REPLY BANNER */}
      {replyTo && (
        <div className="mb-1">
          <ReplyQuote
            authorLabel={replyTo.authorLabel}
            preview={replyTo.preview}
            onDismiss={onClearReply}
          />
        </div>
      )}

      {/* SESSION EXPIRED BANNER */}
      {sessionExpired && (
        <div className="flex items-center justify-between rounded-lg bg-amber-500/10 px-3 py-2">
          <p className="text-xs text-amber-400">
            24-hour session expired. Use a template to re-engage.
          </p>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs text-amber-400 hover:text-amber-300"
            onClick={onOpenTemplates}
          >
            <LayoutTemplate className="mr-1 h-3 w-3" />
            Templates
          </Button>
        </div>
      )}

      {/* COMPOSER PRIMARY ROW */}
      <div className="flex items-end gap-2.5">
        
        {/* LEFT BUTTONS: EMOJI & ATTACHMENT */}
        {!readOnly && !isRecording && (
          <div className="flex items-center gap-1 shrink-0 mb-0.5">
            {/* EMOJI PICKER POPOVER */}
            <Popover>
              <PopoverTrigger
                title="Insert emoji"
                className="h-9 w-9 flex items-center justify-center rounded-full text-slate-400 hover:bg-slate-800 hover:text-white transition-colors"
              >
                <Smile className="h-5 w-5" />
              </PopoverTrigger>
              <PopoverContent
                align="start"
                side="top"
                className="w-64 border-slate-700 bg-slate-850 p-2.5 text-slate-200 shadow-xl"
              >
                {/* Category selectors */}
                <div className="flex justify-between border-b border-slate-700 pb-1 mb-2 overflow-x-auto scrollbar-none gap-1">
                  {EMOJI_CATEGORIES.map((cat) => (
                    <button
                      key={cat.name}
                      onClick={() => setActiveEmojiTab(cat.name)}
                      className={cn(
                        "text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded transition-colors whitespace-nowrap",
                        activeEmojiTab === cat.name
                          ? "bg-slate-800 text-emerald-400"
                          : "text-slate-500 hover:text-slate-350"
                      )}
                    >
                      {cat.name.split(" ")[0]}
                    </button>
                  ))}
                </div>
                {/* Category emojis list */}
                <div className="grid grid-cols-6 gap-1.5 max-h-[160px] overflow-y-auto pr-1">
                  {EMOJI_CATEGORIES.find((cat) => cat.name === activeEmojiTab)
                    ?.emojis.map((emoji) => (
                      <button
                        key={emoji}
                        onClick={() => handleEmojiClick(emoji)}
                        className="text-lg hover:bg-slate-800 rounded p-1 transition-colors flex items-center justify-center"
                      >
                        {emoji}
                      </button>
                    ))}
                </div>
              </PopoverContent>
            </Popover>

            {/* ATTACHMENT DROPDOWN */}
            <DropdownMenu>
              <DropdownMenuTrigger
                title="Attach file"
                className="h-9 w-9 flex items-center justify-center rounded-full text-slate-400 hover:bg-slate-800 hover:text-white transition-colors"
              >
                <Paperclip className="h-5 w-5" />
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="start"
                side="top"
                className="border-slate-700 bg-slate-800 text-slate-200 w-40"
              >
                <DropdownMenuItem
                  onClick={() => handleAttachmentClick("image")}
                  className="text-xs gap-2 py-2"
                >
                  <ImageIcon className="h-3.5 w-3.5 text-emerald-400" />
                  Photos & Videos
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => handleAttachmentClick("audio")}
                  className="text-xs gap-2 py-2"
                >
                  <Headphones className="h-3.5 w-3.5 text-blue-400" />
                  Audio
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => handleAttachmentClick("document")}
                  className="text-xs gap-2 py-2"
                >
                  <FileText className="h-3.5 w-3.5 text-amber-400" />
                  Document / PDF
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            {/* VOICE RECORDER START BUTTON */}
            <button
              onClick={handleStartRecording}
              type="button"
              title="Record voice note"
              className="h-9 w-9 flex items-center justify-center rounded-full text-slate-400 hover:bg-slate-800 hover:text-white transition-colors"
            >
              <Mic className="h-5 w-5" />
            </button>
          </div>
        )}

        {/* CENTER INPUT / RECORDING BAR */}
        {isRecording ? (
          /* VOICE RECORDING SIMULATOR PANEL */
          <div className="flex-1 flex items-center justify-between bg-slate-800 rounded-xl px-4 py-2 border border-emerald-500/25 gap-3 animate-in fade-in duration-200 h-10">
            <div className="flex items-center gap-2.5">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-rose-500"></span>
              </span>
              <span className="text-xs font-semibold text-slate-300">Recording</span>
              <span className="text-xs font-mono text-emerald-400 font-bold bg-slate-900/40 px-1.5 py-0.5 rounded border border-slate-700/30">
                {formatTime(recordingSeconds)}
              </span>
            </div>

            {/* Simulated bouncing audio bars */}
            <div className="flex items-center gap-0.5 flex-1 max-w-[120px] justify-center">
              {[0.4, 0.8, 0.5, 0.9, 0.6, 0.3, 0.7, 0.5].map((val, i) => (
                <span
                  key={i}
                  className="w-1 bg-emerald-500 rounded-full h-3 animate-pulse"
                  style={{
                    animationDuration: `${val + 0.4}s`,
                    animationDelay: `${i * 100}ms`
                  }}
                />
              ))}
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={handleCancelRecording}
                className="text-xs font-bold text-rose-400 hover:text-rose-300 flex items-center gap-1 border border-rose-500/20 bg-rose-500/10 px-2.5 py-1 rounded hover:bg-rose-500/20 transition-all h-8"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Cancel
              </button>
              <button
                onClick={handleSendVoiceRecording}
                className="text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-500 flex items-center gap-1 px-3 py-1 rounded transition-all h-8"
              >
                <Check className="h-3.5 w-3.5" />
                Send Voice
              </button>
            </div>
          </div>
        ) : (
          /* NORMAL INPUT AREA WITH TEXTAREA */
          <div className="flex-1 relative">
            <textarea
              id="message-textarea"
              ref={textareaRef}
              value={text}
              onChange={handleChange}
              onKeyDown={handleKeyDown}
              placeholder={
                readOnly
                  ? "Read-only — viewers can browse but not reply"
                  : sessionExpired
                    ? "Session expired - use a template"
                    : "Type a message... (Shift+Enter for new line)"
              }
              disabled={sessionExpired || readOnly}
              rows={1}
              title={readOnly ? "Read-only — your role can't send messages" : undefined}
              className={cn(
                "w-full resize-none rounded-xl border border-slate-700 bg-slate-800 px-4 py-2.5 text-sm text-white placeholder-slate-500 outline-none transition-colors focus:border-emerald-500/50 block min-h-[38px] max-h-[120px] scrollbar-none",
                (sessionExpired || readOnly) && "cursor-not-allowed opacity-50"
              )}
            />
          </div>
        )}

        {/* RIGHT BUTTON: SEND */}
        {!isRecording && (
          <GatedButton
            size="sm"
            canAct={!readOnly}
            gateReason="send messages"
            disabled={(!text.trim() && !attachment) || sessionExpired || sending}
            onClick={handleSend}
            className="h-[38px] w-[38px] shrink-0 bg-emerald-600 p-0 hover:bg-emerald-500 rounded-xl disabled:opacity-40 flex items-center justify-center text-white"
          >
            <Send className="h-4 w-4" />
          </GatedButton>
        )}
      </div>

      {/* HINT FOOTER */}
      {!isRecording && (
        <div className="flex items-center justify-between px-1.5 mt-0.5">
          <p className="text-[10px] text-slate-500">
            Type &apos;/&apos; for templates
          </p>
          {readOnly && (
            <p className="text-[10px] text-rose-400 font-medium">
              Viewer access: Read-Only mode
            </p>
          )}
        </div>
      )}
    </div>
  );
}
