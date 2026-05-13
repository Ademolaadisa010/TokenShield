"use client";

import { useState, useRef } from "react";
import { motion, AnimatePresence, useInView } from "framer-motion";

// ─── Types ────────────────────────────────────────────────────────────────────

type RiskLevel = "Safe" | "Low" | "Medium" | "High" | "Critical";

interface TokenResult {
  symbol: string;
  name: string;
  address: string;
  price: string;
  change: string;
  changePositive: boolean;
  riskLevel: RiskLevel;
  riskScore: number;
  verdict: string;
  metrics: { label: string; value: number; note: string }[];
  flags: { type: "danger" | "warning" | "safe"; text: string }[];
  aiSummary: string;
  holders: number;
  liquidity: string;
  volume: string;
  age: string;
}

// ─── Mock dataset ─────────────────────────────────────────────────────────────

const mockTokens: Record<string, TokenResult> = {
  BTC: {
    symbol: "BTC", name: "Bitcoin", address: "0x2260...F8A2",
    price: "$67,420", change: "+2.4%", changePositive: true,
    riskLevel: "Safe", riskScore: 6,
    verdict: "Institutional-grade asset. No contract risk.",
    metrics: [
      { label: "Liquidity depth", value: 99, note: "$42B+ daily volume" },
      { label: "Contract safety", value: 100, note: "No smart contract" },
      { label: "Holder distribution", value: 94, note: "Highly decentralized" },
      { label: "Volatility index", value: 18, note: "Low-moderate swings" },
      { label: "Market manipulation", value: 4, note: "Near-zero risk" },
      { label: "Regulatory risk", value: 22, note: "ETF approved" },
    ],
    flags: [
      { type: "safe", text: "No smart contract — zero honeypot risk" },
      { type: "safe", text: "Spot ETF approved by SEC in 2024" },
      { type: "safe", text: "Over 50M unique wallets holding BTC" },
      { type: "warning", text: "Macro correlation — moves with risk assets" },
    ],
    aiSummary: "Bitcoin is the safest crypto asset by every measurable standard. It has no smart contract attack surface, near-unlimited liquidity, and global regulatory acceptance. Suitable for long-term holding. Primary risk is macroeconomic, not token-specific.",
    holders: 52000000, liquidity: "$42.1B", volume: "$28.3B", age: "15 yrs",
  },
  ETH: {
    symbol: "ETH", name: "Ethereum", address: "0x0000...0000",
    price: "$3,280", change: "+1.1%", changePositive: true,
    riskLevel: "Low", riskScore: 14,
    verdict: "Blue chip. Minor smart contract exposure.",
    metrics: [
      { label: "Liquidity depth", value: 96, note: "$18B+ daily volume" },
      { label: "Contract safety", value: 88, note: "Audited, battle-tested" },
      { label: "Holder distribution", value: 88, note: "Wide decentralization" },
      { label: "Volatility index", value: 32, note: "Moderate swings" },
      { label: "Market manipulation", value: 8, note: "Low risk" },
      { label: "Regulatory risk", value: 28, note: "ETF pending" },
    ],
    flags: [
      { type: "safe", text: "Smart contract audited by multiple firms" },
      { type: "safe", text: "Proof-of-stake — no miner centralization" },
      { type: "warning", text: "Gas fees can spike unpredictably" },
      { type: "warning", text: "Staking slashing risk on validators" },
    ],
    aiSummary: "Ethereum is a blue-chip asset with minimal platform risk. The main risks are smart contract bugs in DeFi protocols built on top of it — not Ethereum itself. Suitable for most portfolios with a medium time horizon.",
    holders: 24000000, liquidity: "$18.6B", volume: "$14.1B", age: "9 yrs",
  },
  PEPE: {
    symbol: "PEPE", name: "Pepe Coin", address: "0x6982...d9F2",
    price: "$0.0000134", change: "-8.2%", changePositive: false,
    riskLevel: "High", riskScore: 74,
    verdict: "Meme token with significant rug risk.",
    metrics: [
      { label: "Liquidity depth", value: 28, note: "$120M pool only" },
      { label: "Contract safety", value: 44, note: "Unaudited contract" },
      { label: "Holder distribution", value: 22, note: "Top 10 hold 38%" },
      { label: "Volatility index", value: 88, note: "Extreme swings" },
      { label: "Market manipulation", value: 78, note: "Whale activity detected" },
      { label: "Regulatory risk", value: 60, note: "No utility = target" },
    ],
    flags: [
      { type: "danger", text: "Top 10 wallets control 38% of supply" },
      { type: "danger", text: "No utility — pure sentiment-driven pricing" },
      { type: "danger", text: "Extreme volatility — 80%+ drawdowns common" },
      { type: "warning", text: "Contract owner retains mint permissions" },
      { type: "safe", text: "Listed on major CEXs — some exit liquidity" },
    ],
    aiSummary: "PEPE is a high-risk meme token with no fundamental value driver. While it has exchange listings providing some liquidity, whale concentration and no utility make it highly susceptible to coordinated dumps. Only trade with money you can afford to lose entirely.",
    holders: 170000, liquidity: "$122M", volume: "$680M", age: "1 yr",
  },
  SAFEMOON: {
    symbol: "SAFEMOON", name: "SafeMoon", address: "0x8076...e4C8",
    price: "$0.00000021", change: "-34.1%", changePositive: false,
    riskLevel: "Critical", riskScore: 96,
    verdict: "🚨 Honeypot indicators. Do NOT buy.",
    metrics: [
      { label: "Liquidity depth", value: 3, note: "Under $200K pool" },
      { label: "Contract safety", value: 4, note: "Multiple red flags" },
      { label: "Holder distribution", value: 6, note: "Dev wallets dominant" },
      { label: "Volatility index", value: 99, note: "Effectively dead" },
      { label: "Market manipulation", value: 98, note: "Wash trading detected" },
      { label: "Regulatory risk", value: 95, note: "SEC charges filed" },
    ],
    flags: [
      { type: "danger", text: "🚨 Honeypot function detected in contract" },
      { type: "danger", text: "SEC filed charges against founders (2023)" },
      { type: "danger", text: "16% sell tax — impossible to exit profitably" },
      { type: "danger", text: "$200K liquidity — your sell will crash price" },
      { type: "danger", text: "Dev wallet holds 48% of circulating supply" },
    ],
    aiSummary: "SafeMoon is one of the most documented crypto scams. The contract includes a honeypot mechanism, the founders faced SEC fraud charges, and the remaining liquidity is too thin to exit any meaningful position. Do not buy under any circumstances.",
    holders: 2900, liquidity: "$198K", volume: "$1.2M", age: "3 yrs",
  },
  SOL: {
    symbol: "SOL", name: "Solana", address: "So111...1112",
    price: "$178", change: "+5.7%", changePositive: true,
    riskLevel: "Medium", riskScore: 38,
    verdict: "Legitimate L1. Network outage history.",
    metrics: [
      { label: "Liquidity depth", value: 76, note: "$3.8B daily volume" },
      { label: "Contract safety", value: 70, note: "Audited runtime" },
      { label: "Holder distribution", value: 62, note: "VC concentration noted" },
      { label: "Volatility index", value: 54, note: "High beta asset" },
      { label: "Market manipulation", value: 24, note: "Moderate risk" },
      { label: "Regulatory risk", value: 42, note: "SEC scrutiny ongoing" },
    ],
    flags: [
      { type: "warning", text: "Network has experienced 7 major outages" },
      { type: "warning", text: "Heavy VC concentration in early allocations" },
      { type: "warning", text: "SEC named SOL as potential security in filings" },
      { type: "safe", text: "Strong developer ecosystem and DeFi TVL" },
      { type: "safe", text: "High throughput validated by real usage" },
    ],
    aiSummary: "Solana is a legitimate Layer-1 blockchain with real ecosystem traction. Key risks are VC token unlock schedules causing sell pressure, historical network reliability issues, and ongoing SEC scrutiny. Solid for medium-term traders with risk tolerance.",
    holders: 3800000, liquidity: "$3.8B", volume: "$2.9B", age: "4 yrs",
  },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

const riskConfig: Record<RiskLevel, { bg: string; text: string; border: string; bar: string; glow: string }> = {
  Safe:     { bg: "bg-emerald-50",  text: "text-emerald-700", border: "border-emerald-200", bar: "bg-emerald-500", glow: "shadow-emerald-100" },
  Low:      { bg: "bg-teal-50",     text: "text-teal-700",    border: "border-teal-200",    bar: "bg-teal-500",    glow: "shadow-teal-100"   },
  Medium:   { bg: "bg-amber-50",    text: "text-amber-700",   border: "border-amber-200",   bar: "bg-amber-500",   glow: "shadow-amber-100"  },
  High:     { bg: "bg-orange-50",   text: "text-orange-700",  border: "border-orange-200",  bar: "bg-orange-500",  glow: "shadow-orange-100" },
  Critical: { bg: "bg-red-50",      text: "text-red-700",     border: "border-red-200",     bar: "bg-red-500",     glow: "shadow-red-100"    },
};

function scoreColor(val: number, invert = false) {
  const v = invert ? 100 - val : val;
  if (v >= 80) return "bg-emerald-500";
  if (v >= 55) return "bg-teal-500";
  if (v >= 35) return "bg-amber-500";
  if (v >= 15) return "bg-orange-500";
  return "bg-red-500";
}

function ShieldIcon({ className = "" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      <path d="M9 12l2 2 4-4" />
    </svg>
  );
}

// ─── Scan Steps Overlay ───────────────────────────────────────────────────────

const scanSteps = [
  "Fetching on-chain data...",
  "Checking contract bytecode...",
  "Analyzing liquidity pools...",
  "Profiling holder distribution...",
  "Running honeypot simulation...",
  "Querying regulatory databases...",
  "Generating AI risk report...",
];

function ScanOverlay({ token }: { token: string }) {
  const [step, setStep] = useState(0);

  useState(() => {
    const interval = setInterval(() => {
      setStep((s) => (s < scanSteps.length - 1 ? s + 1 : s));
    }, 320);
    return () => clearInterval(interval);
  });

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="flex flex-col items-center justify-center py-20 gap-8"
    >
      {/* Animated shield */}
      <div className="relative">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
          className="w-20 h-20 rounded-full border-2 border-dashed border-emerald-200"
        />
        <motion.div
          animate={{ rotate: -360 }}
          transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
          className="absolute inset-2 rounded-full border-2 border-dashed border-emerald-100"
        />
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-12 h-12 bg-emerald-600 rounded-xl flex items-center justify-center">
            <ShieldIcon className="w-6 h-6 text-white" />
          </div>
        </div>
        {/* Pulse rings */}
        <motion.div
          animate={{ scale: [1, 1.8], opacity: [0.4, 0] }}
          transition={{ duration: 1.5, repeat: Infinity }}
          className="absolute inset-0 rounded-full bg-emerald-400/20"
        />
      </div>

      <div className="text-center">
        <p className="font-display font-bold text-gray-900 text-lg mb-1">Scanning <span className="text-emerald-600">{token.toUpperCase()}</span></p>
        <p className="font-sans text-sm text-gray-400">AI analysis in progress</p>
      </div>

      {/* Steps */}
      <div className="flex flex-col gap-2 w-full max-w-xs">
        {scanSteps.map((s, i) => (
          <motion.div
            key={s}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: i <= step ? 1 : 0.2, x: 0 }}
            transition={{ delay: i * 0.05 }}
            className="flex items-center gap-3"
          >
            <div className={`w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0 transition-all duration-300 ${
              i < step ? "bg-emerald-500" : i === step ? "bg-emerald-200" : "bg-gray-100"
            }`}>
              {i < step && (
                <svg className="w-2.5 h-2.5 text-white" viewBox="0 0 10 10" fill="none">
                  <path d="M2 5l2 2 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                </svg>
              )}
              {i === step && (
                <motion.div animate={{ scale: [0.8, 1.2, 0.8] }} transition={{ repeat: Infinity, duration: 0.8 }}
                  className="w-1.5 h-1.5 rounded-full bg-emerald-600" />
              )}
            </div>
            <span className={`font-sans text-xs transition-colors duration-300 ${i <= step ? "text-gray-700" : "text-gray-300"}`}>{s}</span>
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
}

// ─── Metric Bar ───────────────────────────────────────────────────────────────

function MetricBar({ label, value, note, invert = false, delay = 0 }: {
  label: string; value: number; note: string; invert?: boolean; delay?: number;
}) {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true });
  const color = scoreColor(value, invert);

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 12 }}
      animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.5, delay }}
      className="group"
    >
      <div className="flex justify-between items-baseline mb-1.5">
        <span className="font-sans text-sm text-gray-600">{label}</span>
        <div className="flex items-center gap-2">
          <span className="font-sans text-xs text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity">{note}</span>
          <span className="font-mono text-xs font-bold text-gray-800">{value}</span>
        </div>
      </div>
      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          animate={inView ? { width: `${value}%` } : {}}
          transition={{ duration: 0.9, delay: delay + 0.1, ease: [0.22, 1, 0.36, 1] }}
          className={`h-full rounded-full ${color}`}
        />
      </div>
    </motion.div>
  );
}

// ─── Risk Dial ────────────────────────────────────────────────────────────────

function RiskDial({ score, level }: { score: number; level: RiskLevel }) {
  const rc = riskConfig[level];
  const circumference = 2 * Math.PI * 54;
  const offset = circumference - (score / 100) * circumference * 0.75;

  return (
    <div className="flex flex-col items-center">
      <div className="relative w-36 h-36">
        <svg viewBox="0 0 120 120" className="w-full h-full -rotate-[225deg]">
          <circle cx="60" cy="60" r="54" fill="none" stroke="#f3f4f6" strokeWidth="10"
            strokeDasharray={`${circumference * 0.75} ${circumference}`} strokeLinecap="round" />
          <motion.circle cx="60" cy="60" r="54" fill="none"
            stroke={level === "Safe" ? "#10b981" : level === "Low" ? "#14b8a6" : level === "Medium" ? "#f59e0b" : level === "High" ? "#f97316" : "#ef4444"}
            strokeWidth="10"
            strokeLinecap="round"
            strokeDasharray={`${circumference * 0.75} ${circumference}`}
            initial={{ strokeDashoffset: circumference }}
            animate={{ strokeDashoffset: offset }}
            transition={{ duration: 1.2, ease: [0.22, 1, 0.36, 1], delay: 0.3 }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <motion.span
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5, delay: 0.8 }}
            className="font-display font-bold text-3xl text-gray-900"
          >
            {score}
          </motion.span>
          <span className="font-sans text-xs text-gray-400">/ 100</span>
        </div>
      </div>
      <motion.span
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 1 }}
        className={`font-display font-bold text-sm px-4 py-1.5 rounded-full border mt-2 ${rc.bg} ${rc.text} ${rc.border}`}
      >
        {level} Risk
      </motion.span>
    </div>
  );
}

// ─── Result Panel ─────────────────────────────────────────────────────────────

function ResultPanel({ result }: { result: TokenResult }) {
  const rc = riskConfig[result.riskLevel];

  return (
    <motion.div
      key={result.symbol}
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
      className="flex flex-col gap-6"
    >
      {/* Token header card */}
      <div className={`rounded-3xl border p-6 ${rc.bg} ${rc.border}`}>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className={`w-14 h-14 rounded-2xl flex items-center justify-center font-mono font-bold text-sm border ${rc.border} bg-white ${rc.text}`}>
              {result.symbol.slice(0, 4)}
            </div>
            <div>
              <h2 className="font-display font-bold text-gray-900 text-xl">{result.name}</h2>
              <p className="font-mono text-xs text-gray-400 mt-0.5">{result.address}</p>
            </div>
          </div>
          <div className="text-right sm:text-right">
            <div className="font-display font-bold text-2xl text-gray-900">{result.price}</div>
            <div className={`font-sans text-sm font-semibold ${result.changePositive ? "text-emerald-600" : "text-red-500"}`}>
              {result.change} 24h
            </div>
          </div>
        </div>
      </div>

      {/* Main grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

        {/* Dial + stats */}
        <div className="bg-white border border-gray-100 rounded-3xl p-6 flex flex-col items-center gap-6">
          <RiskDial score={result.riskScore} level={result.riskLevel} />
          <div className="w-full grid grid-cols-2 gap-3">
            {[
              { l: "Holders", v: result.holders.toLocaleString() },
              { l: "Liquidity", v: result.liquidity },
              { l: "24h Volume", v: result.volume },
              { l: "Token age", v: result.age },
            ].map((s, i) => (
              <motion.div
                key={s.l}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5 + i * 0.08 }}
                className="bg-gray-50 rounded-2xl p-3 text-center"
              >
                <div className="font-sans text-xs text-gray-400 mb-0.5">{s.l}</div>
                <div className="font-mono text-xs font-bold text-gray-800">{s.v}</div>
              </motion.div>
            ))}
          </div>
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.9 }}
            className={`font-sans text-xs font-semibold text-center px-3 py-2 rounded-xl w-full ${rc.bg} ${rc.text}`}
          >
            {result.verdict}
          </motion.p>
        </div>

        {/* Metrics */}
        <div className="bg-white border border-gray-100 rounded-3xl p-6 flex flex-col gap-4">
          <h3 className="font-display font-bold text-gray-900 text-sm">Risk metrics</h3>
          <div className="flex flex-col gap-4">
            {result.metrics.map((m, i) => (
              <MetricBar
                key={m.label}
                label={m.label}
                value={m.value}
                note={m.note}
                invert={m.label === "Volatility index" || m.label === "Market manipulation" || m.label === "Regulatory risk"}
                delay={i * 0.07}
              />
            ))}
          </div>
        </div>

        {/* Flags + AI */}
        <div className="flex flex-col gap-5">
          <div className="bg-white border border-gray-100 rounded-3xl p-6 flex flex-col gap-3">
            <h3 className="font-display font-bold text-gray-900 text-sm">Safety signals</h3>
            {result.flags.map((f, i) => (
              <motion.div
                key={f.text}
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.2 + i * 0.08 }}
                className={`flex items-start gap-2.5 rounded-xl p-3 ${
                  f.type === "danger" ? "bg-red-50" : f.type === "warning" ? "bg-amber-50" : "bg-emerald-50"
                }`}
              >
                <span className="text-base mt-0.5 flex-shrink-0">
                  {f.type === "danger" ? "🚨" : f.type === "warning" ? "⚠️" : "✓"}
                </span>
                <span className={`font-sans text-xs leading-relaxed ${
                  f.type === "danger" ? "text-red-700" : f.type === "warning" ? "text-amber-700" : "text-emerald-700"
                }`}>{f.text}</span>
              </motion.div>
            ))}
          </div>

          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6 }}
            className="bg-gray-950 rounded-3xl p-6 flex flex-col gap-3"
          >
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 bg-emerald-600 rounded-lg flex items-center justify-center flex-shrink-0">
                <ShieldIcon className="w-3 h-3 text-white" />
              </div>
              <span className="font-display font-bold text-white text-sm">AI Verdict</span>
            </div>
            <p className="font-sans text-xs text-gray-300 leading-relaxed">{result.aiSummary}</p>
            <p className="font-sans text-xs text-gray-600 mt-1">Not financial advice. Always DYOR.</p>
          </motion.div>
        </div>
      </div>

      {/* Action row */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.8 }}
        className="flex flex-col sm:flex-row gap-3"
      >
        <button className="flex-1 bg-emerald-600 text-white font-sans font-bold text-sm py-3 rounded-2xl hover:bg-emerald-700 transition-colors">
          Add to watchlist
        </button>
        <button className="flex-1 border border-gray-200 text-gray-700 font-sans font-medium text-sm py-3 rounded-2xl hover:bg-gray-50 transition-colors">
          Share this report
        </button>
        <button className="flex-1 border border-gray-200 text-gray-700 font-sans font-medium text-sm py-3 rounded-2xl hover:bg-gray-50 transition-colors">
          Ask AI advisor →
        </button>
      </motion.div>
    </motion.div>
  );
}

// ─── Recent Scans Sidebar ─────────────────────────────────────────────────────

const recentScans = [
  { symbol: "ETH", risk: "Low" as RiskLevel, time: "2m ago" },
  { symbol: "BONK", risk: "High" as RiskLevel, time: "5m ago" },
  { symbol: "BTC", risk: "Safe" as RiskLevel, time: "12m ago" },
  { symbol: "FLOKI", risk: "Critical" as RiskLevel, time: "18m ago" },
  { symbol: "SOL", risk: "Medium" as RiskLevel, time: "31m ago" },
];

// ─── Page ─────────────────────────────────────────────────────────────────────

type PageState = "idle" | "scanning" | "result";

export default function AnalyzePage() {
  const [query, setQuery] = useState("");
  const [state, setState] = useState<PageState>("idle");
  const [result, setResult] = useState<TokenResult | null>(null);
  const [error, setError] = useState("");

  function handleScan(tokenQuery?: string) {
    const q = (tokenQuery ?? query).trim().toUpperCase();
    if (!q) return;
    setError("");
    setState("scanning");
    setResult(null);

    setTimeout(() => {
      const found = mockTokens[q];
      if (found) {
        setResult(found);
        setState("result");
      } else {
        setState("idle");
        setError(`Token "${q}" not found. Try BTC, ETH, SOL, PEPE, or SAFEMOON.`);
      }
    }, 2400);
  }

  function handleKey(e: React.KeyboardEvent) {
    if (e.key === "Enter") handleScan();
  }

  return (
    <div className="min-h-screen bg-white font-sans">

      {/* Top nav */}
      <nav className="sticky top-0 z-40 bg-white/90 backdrop-blur-lg border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <a href="/" className="flex items-center gap-2">
            <div className="w-7 h-7 bg-emerald-600 rounded-lg flex items-center justify-center">
              <ShieldIcon className="w-4 h-4 text-white" />
            </div>
            <span className="font-display font-bold text-gray-900 text-base">TokenShield</span>
          </a>
          <div className="flex items-center gap-3">
            <span className="font-sans text-xs text-gray-400 hidden sm:block">Connected: <span className="text-gray-700 font-semibold">0x7f4a...3E21</span></span>
            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <button className="font-sans text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded-full hover:bg-emerald-100 transition-colors">
              Disconnect
            </button>
          </div>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-6 py-10 grid grid-cols-1 xl:grid-cols-[1fr_280px] gap-8">

        {/* Main column */}
        <div>

          {/* Page header */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
            className="mb-8"
          >
            <p className="font-sans text-xs font-bold text-emerald-600 tracking-widest uppercase mb-2">Token Risk Analyzer</p>
            <h1 className="font-display font-bold text-gray-900 text-3xl md:text-4xl tracking-tight leading-tight">
              Scan any token before you trade
            </h1>
            <p className="font-sans text-gray-400 text-base mt-2">
              Paste a contract address or search by name. AI analysis in under 3 seconds.
            </p>
          </motion.div>

          {/* Search bar */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="mb-4"
          >
            <div className="flex gap-3">
              <div className="relative flex-1">
                <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-300">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/>
                  </svg>
                </div>
                <input
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={handleKey}
                  placeholder="Token name, symbol, or contract address..."
                  disabled={state === "scanning"}
                  className="w-full h-14 pl-12 pr-4 border border-gray-200 rounded-2xl bg-white text-gray-900 font-sans text-sm placeholder:text-gray-300 focus:outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-50 transition-all disabled:opacity-50"
                />
              </div>
              <motion.button
                onClick={() => handleScan()}
                disabled={state === "scanning" || !query.trim()}
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
                className="h-14 px-6 bg-emerald-600 text-white font-sans font-bold text-sm rounded-2xl hover:bg-emerald-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2 whitespace-nowrap"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                  <path d="M5 12h14M12 5l7 7-7 7"/>
                </svg>
                Scan token
              </motion.button>
            </div>

            {/* Error */}
            <AnimatePresence>
              {error && (
                <motion.p
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="font-sans text-xs text-red-500 mt-2 ml-1"
                >{error}</motion.p>
              )}
            </AnimatePresence>
          </motion.div>

          {/* Quick pick chips */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.25 }}
            className="flex flex-wrap gap-2 mb-8"
          >
            <span className="font-sans text-xs text-gray-300 self-center mr-1">Try:</span>
            {["BTC", "ETH", "SOL", "PEPE", "SAFEMOON"].map((t) => (
              <button
                key={t}
                onClick={() => { setQuery(t); handleScan(t); }}
                disabled={state === "scanning"}
                className="font-mono text-xs font-bold text-gray-500 border border-gray-200 px-3 py-1.5 rounded-full hover:border-emerald-300 hover:text-emerald-600 hover:bg-emerald-50 transition-all disabled:opacity-40"
              >
                {t}
              </button>
            ))}
          </motion.div>

          {/* Content area */}
          <AnimatePresence mode="wait">
            {state === "idle" && !result && (
              <motion.div
                key="idle"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="bg-gray-50 rounded-3xl border border-gray-100 border-dashed"
              >
                <div className="flex flex-col items-center justify-center py-24 gap-4 text-center">
                  <motion.div
                    animate={{ y: [0, -6, 0] }}
                    transition={{ repeat: Infinity, duration: 3, ease: "easeInOut" }}
                    className="w-16 h-16 bg-white border border-gray-100 rounded-2xl flex items-center justify-center shadow-sm"
                  >
                    <ShieldIcon className="w-8 h-8 text-emerald-500" />
                  </motion.div>
                  <div>
                    <p className="font-display font-bold text-gray-800 text-lg">No token scanned yet</p>
                    <p className="font-sans text-sm text-gray-400 mt-1">Enter a symbol above or pick a quick example</p>
                  </div>
                </div>
              </motion.div>
            )}

            {state === "scanning" && (
              <motion.div
                key="scanning"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="bg-gray-50 rounded-3xl border border-gray-100"
              >
                <ScanOverlay token={query} />
              </motion.div>
            )}

            {state === "result" && result && (
              <motion.div key="result" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <ResultPanel result={result} />
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Sidebar */}
        <div className="hidden xl:flex flex-col gap-5">

          {/* Portfolio Health */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.3 }}
            className="bg-white border border-gray-100 rounded-3xl p-5"
          >
            <h3 className="font-display font-bold text-gray-900 text-sm mb-4">Portfolio health</h3>
            <div className="flex items-center gap-3 mb-4">
              <div className="relative w-16 h-16">
                <svg viewBox="0 0 64 64" className="w-full h-full -rotate-90">
                  <circle cx="32" cy="32" r="26" fill="none" stroke="#f3f4f6" strokeWidth="8"/>
                  <motion.circle cx="32" cy="32" r="26" fill="none" stroke="#10b981" strokeWidth="8"
                    strokeLinecap="round"
                    strokeDasharray={`${2 * Math.PI * 26}`}
                    initial={{ strokeDashoffset: 2 * Math.PI * 26 }}
                    animate={{ strokeDashoffset: 2 * Math.PI * 26 * (1 - 0.73) }}
                    transition={{ duration: 1.2, delay: 0.5 }}
                  />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="font-display font-bold text-sm text-gray-900">73</span>
                </div>
              </div>
              <div>
                <p className="font-display font-bold text-gray-900 text-lg">Good</p>
                <p className="font-sans text-xs text-gray-400">5 assets tracked</p>
              </div>
            </div>
            {[
              { label: "Low risk", pct: 70, color: "bg-emerald-500" },
              { label: "Medium risk", pct: 15, color: "bg-amber-500" },
              { label: "High risk", pct: 10, color: "bg-orange-500" },
              { label: "Critical", pct: 5, color: "bg-red-500" },
            ].map((r) => (
              <div key={r.label} className="flex items-center gap-2 mb-2">
                <div className={`w-2 h-2 rounded-full flex-shrink-0 ${r.color}`} />
                <span className="font-sans text-xs text-gray-500 flex-1">{r.label}</span>
                <span className="font-mono text-xs font-bold text-gray-700">{r.pct}%</span>
              </div>
            ))}
          </motion.div>

          {/* Recent scans */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.4 }}
            className="bg-white border border-gray-100 rounded-3xl p-5"
          >
            <h3 className="font-display font-bold text-gray-900 text-sm mb-4">Recent scans</h3>
            <div className="flex flex-col gap-2">
              {recentScans.map((s, i) => {
                const rc = riskConfig[s.risk];
                return (
                  <motion.button
                    key={s.symbol + i}
                    initial={{ opacity: 0, x: 10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.5 + i * 0.06 }}
                    onClick={() => { setQuery(s.symbol); handleScan(s.symbol); }}
                    className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-gray-50 transition-colors text-left w-full"
                  >
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-mono text-xs font-bold border ${rc.border} ${rc.bg} ${rc.text}`}>
                      {s.symbol.slice(0, 3)}
                    </div>
                    <div className="flex-1">
                      <p className="font-sans text-xs font-semibold text-gray-800">{s.symbol}</p>
                      <p className="font-sans text-xs text-gray-400">{s.time}</p>
                    </div>
                    <span className={`font-sans text-xs font-semibold px-2 py-0.5 rounded-full ${rc.bg} ${rc.text}`}>{s.risk}</span>
                  </motion.button>
                );
              })}
            </div>
          </motion.div>

          {/* FOMO alert box */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.5 }}
            className="bg-amber-50 border border-amber-200 rounded-3xl p-5"
          >
            <div className="flex items-center gap-2 mb-2">
              <span className="text-base">⏳</span>
              <h3 className="font-display font-bold text-amber-800 text-sm">FOMO Guard</h3>
            </div>
            <p className="font-sans text-xs text-amber-700 leading-relaxed mb-3">
              Are you rushing into a trade? Let us check for emotional signals first.
            </p>
            <button className="w-full bg-amber-600 text-white font-sans font-bold text-xs py-2.5 rounded-xl hover:bg-amber-700 transition-colors">
              Run FOMO check →
            </button>
          </motion.div>
        </div>
      </div>
    </div>
  );
}