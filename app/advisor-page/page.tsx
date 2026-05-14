"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";

// ─── Easing ───────────────────────────────────────────────────────────────────
const EASE: [number, number, number, number] = [0.22, 1, 0.36, 1];

// ─── Types ────────────────────────────────────────────────────────────────────
type Role = "user" | "assistant";
type MsgStatus = "streaming" | "done" | "error";

interface Message {
  id: string;
  role: Role;
  content: string;
  status: MsgStatus;
  timestamp: Date;
  tags?: string[]; // risk tags extracted from AI reply
}

interface TokenContext {
  symbol: string;
  name: string;
  price: string;
  change24h: number;
  liquidity: number;
  volume24h: number;
  riskScore: number;
  riskLevel: string;
  chain: string;
}

// ─── System Prompt ────────────────────────────────────────────────────────────
const SYSTEM_PROMPT = `You are TokenShield AI Trade Advisor — a specialist in crypto safety, on-chain risk analysis, and behavioral trading psychology. You help traders make smarter, safer decisions before they execute trades.

Your role:
- Evaluate trade decisions for risk before execution
- Explain complex on-chain concepts in plain, simple English
- Detect emotional or FOMO-driven reasoning in the user's messages
- Suggest safer alternatives or position sizing when appropriate
- Explain why trades fail (slippage, liquidity issues, honeypots, gas)
- Never guarantee profits or give specific financial advice
- Be direct, honest, and occasionally firm — user protection is priority #1

Your personality:
- Like a sharp, experienced trader friend who keeps it real
- Warm but direct — you won't sugarcoat danger
- Use concrete numbers when available
- Keep responses concise (3–5 sentences unless deep analysis is needed)
- Use line breaks to separate key points for readability
- Flag emotional language immediately (words like "sure thing", "can't lose", "going to moon", "everyone is buying")

Format rules:
- Use ⚠ for warnings, ✓ for safe signals, 🚨 for critical danger, 💡 for tips
- Bold key terms with **term**
- Never reproduce promotional content about tokens
- Always end risky-trade discussions with a disclaimer
- If token context is provided, reference the actual numbers in your analysis`;

// ─── Starter prompts ──────────────────────────────────────────────────────────
const STARTERS = [
  { icon: "🤔", label: "Should I buy this token?",          msg: "I'm thinking of buying a token I saw trending. How do I know if it's safe?" },
  { icon: "💸", label: "Why did my trade fail?",            msg: "My transaction failed and I lost gas fees. It said 'insufficient output amount'. What happened?" },
  { icon: "🍯", label: "What is a honeypot token?",         msg: "What exactly is a honeypot token and how do I detect one before buying?" },
  { icon: "💧", label: "Low liquidity explained",           msg: "Can you explain what low liquidity means and why it's dangerous for my trade?" },
  { icon: "📊", label: "How to size positions safely",      msg: "How should I decide how much of my portfolio to put into a new altcoin?" },
  { icon: "🏃", label: "How to spot a rug pull early",      msg: "What are the earliest warning signs that a token is about to rug pull?" },
];

// ─── Quick context tokens ──────────────────────────────────────────────────────
const MOCK_TOKENS: TokenContext[] = [
  { symbol: "PEPE",  name: "Pepe Coin",  price: "$0.0000134", change24h: -8.2,  liquidity: 122000000, volume24h: 680000000, riskScore: 74, riskLevel: "High",     chain: "ethereum" },
  { symbol: "SOL",   name: "Solana",     price: "$178",       change24h: 5.7,   liquidity: 3800000000, volume24h: 2900000000, riskScore: 38, riskLevel: "Medium",  chain: "solana"   },
  { symbol: "WIF",   name: "dogwifhat",  price: "$2.31",      change24h: -12.4, liquidity: 45000000,  volume24h: 320000000,  riskScore: 68, riskLevel: "High",     chain: "solana"   },
  { symbol: "BTC",   name: "Bitcoin",    price: "$67,420",    change24h: 2.4,   liquidity: 42100000000, volume24h: 28300000000, riskScore: 6, riskLevel: "Safe",  chain: "bitcoin"  },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────
function uid() { return Math.random().toString(36).slice(2, 10); }

function fmt(n: number): string {
  if (n >= 1e9) return `$${(n / 1e9).toFixed(1)}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(1)}M`;
  if (n >= 1e3) return `$${(n / 1e3).toFixed(1)}K`;
  return `$${n}`;
}

function riskColor(level: string) {
  return level === "Safe" ? "text-emerald-600 bg-emerald-50 border-emerald-200"
    : level === "Low"    ? "text-teal-600 bg-teal-50 border-teal-200"
    : level === "Medium" ? "text-amber-600 bg-amber-50 border-amber-200"
    : level === "High"   ? "text-orange-600 bg-orange-50 border-orange-200"
    : "text-red-600 bg-red-50 border-red-200";
}

function riskBar(score: number) {
  return score <= 15 ? "bg-emerald-500"
    : score <= 35 ? "bg-teal-400"
    : score <= 55 ? "bg-amber-500"
    : score <= 75 ? "bg-orange-500"
    : "bg-red-500";
}

function formatTime(d: Date) {
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

// Parse markdown-like formatting into JSX-safe HTML
function parseContent(text: string): string {
  return text
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\n/g, '<br/>');
}

// ─── Icons ────────────────────────────────────────────────────────────────────
function ShieldIcon({ className = "" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="M9 12l2 2 4-4"/>
    </svg>
  );
}

function SendIcon({ className = "" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 2L11 13"/><path d="M22 2L15 22l-4-9-9-4 20-7z"/>
    </svg>
  );
}

function BotAvatar() {
  return (
    <div className="w-8 h-8 rounded-xl bg-emerald-600 flex items-center justify-center flex-shrink-0 shadow-sm shadow-emerald-100">
      <ShieldIcon className="w-4 h-4 text-white" />
    </div>
  );
}

function UserAvatar() {
  return (
    <div className="w-8 h-8 rounded-xl bg-gray-800 flex items-center justify-center flex-shrink-0">
      <svg className="w-4 h-4 text-gray-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/>
      </svg>
    </div>
  );
}

// ─── Typing Indicator ─────────────────────────────────────────────────────────
function TypingDots() {
  return (
    <div className="flex gap-1 items-center py-1">
      {[0, 1, 2].map(i => (
        <motion.div key={i} className="w-1.5 h-1.5 rounded-full bg-gray-400"
          animate={{ y: [0, -4, 0], opacity: [0.4, 1, 0.4] }}
          transition={{ duration: 0.8, delay: i * 0.15, repeat: Infinity }} />
      ))}
    </div>
  );
}

// ─── Message Bubble ───────────────────────────────────────────────────────────
function MessageBubble({ msg }: { msg: Message }) {
  const isUser = msg.role === "user";

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: EASE }}
      className={`flex gap-3 ${isUser ? "flex-row-reverse" : "flex-row"}`}
    >
      {isUser ? <UserAvatar /> : <BotAvatar />}

      <div className={`flex flex-col gap-1 max-w-[78%] ${isUser ? "items-end" : "items-start"}`}>
        <div className={`px-4 py-3 rounded-2xl text-sm leading-relaxed font-sans ${
          isUser
            ? "bg-gray-900 text-white rounded-tr-sm"
            : "bg-white border border-gray-100 text-gray-800 rounded-tl-sm shadow-sm"
        }`}>
          {msg.status === "streaming" && msg.content === "" ? (
            <TypingDots />
          ) : (
            <span dangerouslySetInnerHTML={{ __html: parseContent(msg.content) }} />
          )}
          {msg.status === "streaming" && msg.content !== "" && (
            <motion.span animate={{ opacity: [1, 0] }} transition={{ duration: 0.6, repeat: Infinity }}
              className="inline-block w-0.5 h-3.5 bg-gray-400 ml-0.5 align-middle" />
          )}
        </div>

        {/* Tags */}
        {msg.tags && msg.tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {msg.tags.map(tag => (
              <span key={tag} className="font-sans text-[10px] font-semibold px-2 py-0.5 rounded-full bg-gray-100 text-gray-500 border border-gray-200">
                {tag}
              </span>
            ))}
          </div>
        )}

        <span className="font-sans text-[10px] text-gray-400 px-1">{formatTime(msg.timestamp)}</span>
      </div>
    </motion.div>
  );
}

// ─── Token Context Card ───────────────────────────────────────────────────────
function TokenContextCard({ token, onRemove }: { token: TokenContext; onRemove: () => void }) {
  const rc = riskColor(token.riskLevel);
  return (
    <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
      transition={{ ease: EASE }}
      className="bg-white border border-gray-100 rounded-2xl p-4 mb-3 shadow-sm">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2.5">
          <div className={`w-9 h-9 rounded-xl flex items-center justify-center font-mono font-bold text-xs border ${rc}`}>
            {token.symbol.slice(0, 3)}
          </div>
          <div>
            <p className="font-display font-bold text-gray-900 text-sm">{token.name}</p>
            <p className="font-sans text-xs text-gray-400 capitalize">{token.chain} · {token.price}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className={`font-sans text-xs font-bold px-2.5 py-1 rounded-full border ${rc}`}>
            {token.riskLevel}
          </span>
          <button onClick={onRemove} className="text-gray-300 hover:text-gray-500 transition-colors">
            <svg className="w-4 h-4" viewBox="0 0 16 16" fill="none"><path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2 mb-3">
        {[
          { l: "Liquidity",  v: fmt(token.liquidity) },
          { l: "24h Volume", v: fmt(token.volume24h) },
          { l: "24h Change", v: `${token.change24h >= 0 ? "+" : ""}${token.change24h}%` },
        ].map(s => (
          <div key={s.l} className="bg-gray-50 rounded-lg p-2 text-center">
            <p className="font-sans text-[9px] uppercase tracking-wide text-gray-400 mb-0.5">{s.l}</p>
            <p className={`font-mono text-xs font-bold ${s.l === "24h Change" ? token.change24h >= 0 ? "text-emerald-600" : "text-red-500" : "text-gray-700"}`}>{s.v}</p>
          </div>
        ))}
      </div>

      {/* Risk score bar */}
      <div>
        <div className="flex justify-between mb-1">
          <span className="font-sans text-[10px] text-gray-400">Risk score</span>
          <span className="font-mono text-[10px] font-bold text-gray-600">{token.riskScore}/100</span>
        </div>
        <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
          <motion.div initial={{ width: 0 }} animate={{ width: `${token.riskScore}%` }}
            transition={{ duration: 0.8, ease: EASE }}
            className={`h-full rounded-full ${riskBar(token.riskScore)}`} />
        </div>
      </div>

      <p className="font-sans text-[10px] text-emerald-600 mt-2.5 flex items-center gap-1">
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse inline-block" />
        Token context loaded — AI will reference this data
      </p>
    </motion.div>
  );
}

// ─── Sidebar panels ───────────────────────────────────────────────────────────
function SidebarCapabilities() {
  const caps = [
    { icon: "🔍", title: "Trade evaluation",     desc: "Tell the AI what you want to buy — it will assess the risk" },
    { icon: "💧", title: "Liquidity analysis",   desc: "Understand pool depth, slippage, and exit risk" },
    { icon: "🍯", title: "Scam detection",        desc: "Learn to identify honeypots, rug pulls, and wash trading" },
    { icon: "📐", title: "Position sizing",       desc: "Get guidance on how much capital to risk per trade" },
    { icon: "🧠", title: "FOMO detection",        desc: "The AI will flag emotional reasoning in your messages" },
    { icon: "❌", title: "Trade failure explainer", desc: "Understand why your transaction failed and how to fix it" },
  ];

  return (
    <div className="bg-white border border-gray-100 rounded-2xl p-5">
      <h3 className="font-display font-bold text-gray-900 text-sm mb-4">What I can help with</h3>
      <div className="flex flex-col gap-3">
        {caps.map((c, i) => (
          <motion.div key={c.title} initial={{ opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.1 + i * 0.06, ease: EASE }}
            className="flex items-start gap-2.5">
            <span className="text-base flex-shrink-0 mt-0.5">{c.icon}</span>
            <div>
              <p className="font-sans text-xs font-semibold text-gray-700">{c.title}</p>
              <p className="font-sans text-xs text-gray-400 leading-relaxed">{c.desc}</p>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

function SidebarDisclaimer() {
  return (
    <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4">
      <div className="flex items-center gap-2 mb-2">
        <span>⚠️</span>
        <p className="font-display font-bold text-amber-900 text-xs">Important disclaimer</p>
      </div>
      <p className="font-sans text-xs text-amber-700 leading-relaxed">
        TokenShield AI provides safety analysis only — not financial advice. Never invest more than you can afford to lose. Always verify independently.
      </p>
    </div>
  );
}

// ─── Token Picker Modal ───────────────────────────────────────────────────────
function TokenPickerModal({ onSelect, onClose }: { onSelect: (t: TokenContext) => void; onClose: () => void }) {
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/20 backdrop-blur-sm"
      onClick={onClose}>
      <motion.div initial={{ opacity: 0, y: 20, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 20 }} transition={{ ease: EASE }}
        className="bg-white rounded-3xl border border-gray-100 p-6 w-full max-w-sm shadow-2xl"
        onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-display font-bold text-gray-900 text-base">Load token context</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            <svg className="w-5 h-5" viewBox="0 0 20 20" fill="none"><path d="M5 5l10 10M15 5l-10 10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
          </button>
        </div>
        <p className="font-sans text-xs text-gray-400 mb-4 leading-relaxed">
          Select a token to give the AI real market data during your conversation.
        </p>
        <div className="flex flex-col gap-2.5">
          {MOCK_TOKENS.map(t => {
            const rc = riskColor(t.riskLevel);
            return (
              <button key={t.symbol} onClick={() => { onSelect(t); onClose(); }}
                className="flex items-center gap-3 p-3 rounded-xl border border-gray-100 hover:border-gray-200 hover:bg-gray-50 transition-all text-left w-full group">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-mono font-bold text-xs border flex-shrink-0 ${rc}`}>
                  {t.symbol.slice(0, 3)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-sans text-sm font-semibold text-gray-800">{t.name}</p>
                  <p className="font-sans text-xs text-gray-400">{t.price} · {t.chain}</p>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <span className={`font-sans text-xs font-bold px-2 py-0.5 rounded-full border ${rc}`}>{t.riskLevel}</span>
                  <span className="font-mono text-xs text-gray-400">{t.riskScore}/100</span>
                </div>
              </button>
            );
          })}
        </div>
        <p className="font-sans text-xs text-gray-400 text-center mt-4">
          Or search any token in the <a href="/analyze" className="text-emerald-600 hover:underline">Token Analyzer</a>
        </p>
      </motion.div>
    </motion.div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function AdvisorPage() {
  const [messages, setMessages]         = useState<Message[]>([]);
  const [input, setInput]               = useState("");
  const [isStreaming, setIsStreaming]   = useState(false);
  const [tokenCtx, setTokenCtx]         = useState<TokenContext | null>(null);
  const [showPicker, setShowPicker]     = useState(false);
  const [showStarters, setShowStarters] = useState(true);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef  = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Auto-resize textarea
  function handleInputChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    setInput(e.target.value);
    e.target.style.height = "auto";
    e.target.style.height = Math.min(e.target.scrollHeight, 140) + "px";
  }

  const buildSystemPrompt = useCallback(() => {
    let sys = SYSTEM_PROMPT;
    if (tokenCtx) {
      sys += `\n\nCURRENT TOKEN CONTEXT (reference these numbers in your analysis):
- Token: ${tokenCtx.name} (${tokenCtx.symbol})
- Chain: ${tokenCtx.chain}
- Price: ${tokenCtx.price}
- 24h Change: ${tokenCtx.change24h}%
- Liquidity: ${fmt(tokenCtx.liquidity)}
- 24h Volume: ${fmt(tokenCtx.volume24h)}
- Risk Score: ${tokenCtx.riskScore}/100 (${tokenCtx.riskLevel} risk)`;
    }
    return sys;
  }, [tokenCtx]);

  const sendMessage = useCallback(async (text?: string) => {
    const content = (text ?? input).trim();
    if (!content || isStreaming) return;

    setInput("");
    setShowStarters(false);
    if (inputRef.current) inputRef.current.style.height = "auto";

    const userMsg: Message = { id: uid(), role: "user", content, status: "done", timestamp: new Date() };
    const asstMsg: Message = { id: uid(), role: "assistant", content: "", status: "streaming", timestamp: new Date() };

    setMessages(prev => [...prev, userMsg, asstMsg]);
    setIsStreaming(true);

    try {
      const history = [...messages, userMsg].map(m => ({ role: m.role, content: m.content }));

      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 1000,
          system: buildSystemPrompt(),
          messages: history,
        }),
      });

      if (!res.ok) throw new Error(`API ${res.status}`);
      const data = await res.json();
      const reply = data.content?.filter((b: { type: string }) => b.type === "text")
        .map((b: { text: string }) => b.text).join("") ?? "";

      // Extract risk tags from reply
      const tags: string[] = [];
      if (/honeypot|scam|rug/i.test(reply))           tags.push("🍯 Honeypot risk");
      if (/liquidity|slippage/i.test(reply))           tags.push("💧 Liquidity risk");
      if (/fomo|emotional|impulse/i.test(reply))       tags.push("🧠 FOMO detected");
      if (/position size|allocation/i.test(reply))     tags.push("📐 Position sizing");
      if (/safe|low risk|solid/i.test(reply))          tags.push("✓ Low risk signal");
      if (/critical|danger|avoid|do not buy/i.test(reply)) tags.push("🚨 Critical warning");

      setMessages(prev => prev.map(m =>
        m.id === asstMsg.id ? { ...m, content: reply, status: "done", tags } : m
      ));
    } catch (err) {
      setMessages(prev => prev.map(m =>
        m.id === asstMsg.id ? {
          ...m,
          content: "Connection error. Please check your network and try again.",
          status: "error",
        } : m
      ));
    } finally {
      setIsStreaming(false);
    }
  }, [input, messages, isStreaming, buildSystemPrompt]);

  function handleKey(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  }

  function clearChat() {
    setMessages([]);
    setShowStarters(true);
  }

  const isEmpty = messages.length === 0;

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Nav */}
      <nav className="sticky top-0 z-50 bg-white border-b border-gray-100">
        <div className="max-w-[1320px] mx-auto px-6 h-14 flex items-center justify-between">
          <a href="/" className="flex items-center gap-2.5">
            <div className="w-7 h-7 bg-emerald-600 rounded-lg flex items-center justify-center flex-shrink-0">
              <ShieldIcon className="w-4 h-4 text-white" />
            </div>
            <span className="font-display font-bold text-gray-900 text-[15px]">TokenShield</span>
          </a>
          <div className="hidden sm:flex items-center gap-1.5">
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            <span className="font-sans text-xs font-medium text-gray-500">AI Trade Advisor · Live</span>
          </div>
          <div className="flex items-center gap-3">
            {messages.length > 0 && (
              <button onClick={clearChat} className="font-sans text-xs text-gray-400 hover:text-gray-600 transition-colors">
                Clear chat
              </button>
            )}
            <a href="/" className="font-sans text-xs font-medium text-gray-400 hover:text-gray-700 transition-colors">← Home</a>
          </div>
        </div>
      </nav>

      {/* Body */}
      <div className="flex-1 max-w-[1320px] mx-auto w-full px-6 py-6 flex gap-6 items-start">

        {/* ─ Chat column ─ */}
        <div className="flex-1 min-w-0 flex flex-col" style={{ height: "calc(100vh - 104px)" }}>

          {/* Chat area */}
          <div className="flex-1 overflow-y-auto pr-1" style={{ scrollbarWidth: "thin", scrollbarColor: "#e5e7eb transparent" }}>

            {/* Empty state */}
            {isEmpty && (
              <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ ease: EASE }}
                className="flex flex-col items-center justify-center h-full text-center px-4 py-12">
                <motion.div animate={{ y: [0, -8, 0] }} transition={{ repeat: Infinity, duration: 4, ease: "easeInOut" as const }}
                  className="w-20 h-20 bg-white border border-gray-100 rounded-3xl flex items-center justify-center mb-6 shadow-sm">
                  <ShieldIcon className="w-10 h-10 text-emerald-500" />
                </motion.div>
                <h2 className="font-display font-bold text-gray-900 text-2xl mb-2">AI Trade Advisor</h2>
                <p className="font-sans text-gray-400 text-sm leading-relaxed max-w-sm mb-8">
                  Ask me anything about a token, trade decision, or crypto risk. I'll give you honest, safety-first analysis — not hype.
                </p>

                {/* Starter prompts */}
                <AnimatePresence>
                  {showStarters && (
                    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                      className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 w-full max-w-xl">
                      {STARTERS.map((s, i) => (
                        <motion.button key={s.label} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: i * 0.07, ease: EASE }}
                          onClick={() => sendMessage(s.msg)}
                          whileHover={{ scale: 1.02, y: -2 }}
                          whileTap={{ scale: 0.97 }}
                          className="flex items-start gap-3 bg-white border border-gray-100 hover:border-emerald-200 hover:shadow-sm rounded-2xl p-4 text-left transition-all group">
                          <span className="text-xl flex-shrink-0">{s.icon}</span>
                          <div>
                            <p className="font-sans text-sm font-semibold text-gray-800 group-hover:text-emerald-700 transition-colors">{s.label}</p>
                            <p className="font-sans text-xs text-gray-400 mt-0.5 leading-relaxed line-clamp-2">{s.msg}</p>
                          </div>
                        </motion.button>
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            )}

            {/* Messages */}
            {!isEmpty && (
              <div className="flex flex-col gap-5 py-4">
                {/* Token context banner */}
                <AnimatePresence>
                  {tokenCtx && (
                    <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}
                      className="flex items-center gap-2.5 bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-2.5 mx-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse flex-shrink-0" />
                      <span className="font-sans text-xs text-emerald-700 flex-1">
                        <strong className="font-semibold">{tokenCtx.name} ({tokenCtx.symbol})</strong> context active — AI is referencing live market data
                      </span>
                      <button onClick={() => setTokenCtx(null)} className="text-emerald-500 hover:text-emerald-700 transition-colors">
                        <svg className="w-3.5 h-3.5" viewBox="0 0 14 14" fill="none"><path d="M3 3l8 8M11 3l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
                      </button>
                    </motion.div>
                  )}
                </AnimatePresence>

                {messages.map(msg => <MessageBubble key={msg.id} msg={msg} />)}
                <div ref={bottomRef} />
              </div>
            )}
          </div>

          {/* Token context card (above input) */}
          <AnimatePresence>
            {tokenCtx && isEmpty && (
              <TokenContextCard token={tokenCtx} onRemove={() => setTokenCtx(null)} />
            )}
          </AnimatePresence>

          {/* Input area */}
          <div className="bg-white border border-gray-200 rounded-2xl p-3 mt-3 shadow-sm">
            {/* Token context pill */}
            <AnimatePresence>
              {tokenCtx && !isEmpty && (
                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }} className="mb-2.5">
                  <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 rounded-xl px-3 py-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 flex-shrink-0" />
                    <span className="font-sans text-xs text-emerald-700 flex-1">Context: {tokenCtx.symbol} · {tokenCtx.riskLevel} risk · Score {tokenCtx.riskScore}/100</span>
                    <button onClick={() => setTokenCtx(null)} className="text-emerald-400 hover:text-emerald-600">
                      <svg className="w-3 h-3" viewBox="0 0 12 12" fill="none"><path d="M2 2l8 8M10 2l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <div className="flex items-end gap-2.5">
              {/* Token context button */}
              <button onClick={() => setShowPicker(true)}
                title="Load token context"
                className={`w-9 h-9 flex-shrink-0 rounded-xl flex items-center justify-center transition-all ${
                  tokenCtx ? "bg-emerald-100 text-emerald-600" : "bg-gray-100 text-gray-500 hover:bg-gray-200"
                }`}>
                <svg className="w-4 h-4" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <circle cx="10" cy="10" r="7"/><path d="M10 7v3l2 2"/>
                </svg>
              </button>

              <textarea
                ref={inputRef}
                value={input}
                onChange={handleInputChange}
                onKeyDown={handleKey}
                placeholder="Describe your trade, ask about a token, or ask why a transaction failed..."
                disabled={isStreaming}
                rows={1}
                className="flex-1 resize-none bg-transparent text-gray-900 font-sans text-sm placeholder:text-gray-300 focus:outline-none disabled:opacity-50 leading-relaxed py-1.5"
                style={{ minHeight: "36px", maxHeight: "140px" }}
              />

              {/* FOMO check button */}
              <a href="/fomo" title="Run FOMO check"
                className="w-9 h-9 flex-shrink-0 rounded-xl flex items-center justify-center bg-amber-50 text-amber-500 hover:bg-amber-100 transition-colors">
                <span className="text-base">⏳</span>
              </a>

              {/* Send button */}
              <motion.button
                onClick={() => sendMessage()}
                disabled={isStreaming || !input.trim()}
                whileHover={!isStreaming && input.trim() ? { scale: 1.05 } : {}}
                whileTap={!isStreaming && input.trim() ? { scale: 0.95 } : {}}
                className={`w-9 h-9 flex-shrink-0 rounded-xl flex items-center justify-center transition-all ${
                  !isStreaming && input.trim()
                    ? "bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm shadow-emerald-100"
                    : "bg-gray-100 text-gray-300 cursor-not-allowed"
                }`}
              >
                {isStreaming
                  ? <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: "linear" as const }}
                      className="w-4 h-4 border-2 border-gray-300 border-t-emerald-500 rounded-full" />
                  : <SendIcon className="w-3.5 h-3.5" />
                }
              </motion.button>
            </div>

            {/* Footer hints */}
            <div className="flex items-center justify-between mt-2 px-0.5">
              <span className="font-sans text-[10px] text-gray-300">Enter to send · Shift+Enter for newline</span>
              <span className="font-sans text-[10px] text-gray-300">Not financial advice</span>
            </div>
          </div>
        </div>

        {/* ─ Sidebar ─ */}
        <div className="hidden xl:flex flex-col gap-4 w-72 flex-shrink-0">

          {/* Context loader */}
          <motion.div initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.15, ease: EASE }}
            className="bg-white border border-gray-100 rounded-2xl p-5">
            <h3 className="font-display font-bold text-gray-900 text-sm mb-3">Token context</h3>
            <AnimatePresence>
              {tokenCtx
                ? <TokenContextCard token={tokenCtx} onRemove={() => setTokenCtx(null)} />
                : (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                    <p className="font-sans text-xs text-gray-400 leading-relaxed mb-3">
                      Load a token so the AI can reference real liquidity, volume, and risk data in its analysis.
                    </p>
                    <button onClick={() => setShowPicker(true)}
                      className="w-full h-9 border border-dashed border-gray-200 hover:border-emerald-300 hover:bg-emerald-50 text-gray-500 hover:text-emerald-600 font-sans font-medium text-xs rounded-xl transition-all flex items-center justify-center gap-1.5">
                      <svg className="w-3.5 h-3.5" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M8 3v10M3 8h10"/></svg>
                      Load token context
                    </button>
                  </motion.div>
                )
              }
            </AnimatePresence>
          </motion.div>

          {/* Capabilities */}
          <motion.div initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.25, ease: EASE }}>
            <SidebarCapabilities />
          </motion.div>

          {/* Quick links */}
          <motion.div initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.35, ease: EASE }}
            className="bg-white border border-gray-100 rounded-2xl p-5">
            <h3 className="font-display font-bold text-gray-900 text-sm mb-3">Other tools</h3>
            <div className="flex flex-col gap-2">
              {[
                { href: "/analyze", icon: "🔍", label: "Token Risk Analyzer",  sub: "Scan any token live" },
                { href: "/fomo",    icon: "⏳", label: "FOMO Guard",            sub: "Emotional check before trading" },
              ].map(l => (
                <a key={l.href} href={l.href}
                  className="flex items-center gap-2.5 p-3 rounded-xl border border-gray-100 hover:border-gray-200 hover:bg-gray-50 transition-all group">
                  <span className="text-base">{l.icon}</span>
                  <div className="flex-1">
                    <p className="font-sans text-xs font-semibold text-gray-700 group-hover:text-gray-900">{l.label}</p>
                    <p className="font-sans text-[10px] text-gray-400">{l.sub}</p>
                  </div>
                  <svg className="w-3.5 h-3.5 text-gray-300 group-hover:text-gray-500 transition-colors" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M3 7h8M7 3l4 4-4 4"/></svg>
                </a>
              ))}
            </div>
          </motion.div>

          {/* Disclaimer */}
          <motion.div initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.45, ease: EASE }}>
            <SidebarDisclaimer />
          </motion.div>
        </div>
      </div>

      {/* Token Picker Modal */}
      <AnimatePresence>
        {showPicker && <TokenPickerModal onSelect={setTokenCtx} onClose={() => setShowPicker(false)} />}
      </AnimatePresence>
    </div>
  );
}