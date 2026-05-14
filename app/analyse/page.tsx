"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence, useInView } from "framer-motion";

// ─── Easing ───────────────────────────────────────────────────────────────────
const EASE: [number, number, number, number] = [0.22, 1, 0.36, 1];

// ─── Types ────────────────────────────────────────────────────────────────────
type RiskLevel = "Safe" | "Low" | "Medium" | "High" | "Critical";

interface TokenData {
  // Identity
  name: string;
  symbol: string;
  address: string;
  chainId: string;
  dexId: string;
  pairAddress: string;
  // Price
  priceUsd: number;
  priceChange1h: number;
  priceChange24h: number;
  priceChange7d: number;
  // Market
  liquidity: number;
  volume24h: number;
  fdv: number;
  marketCap: number;
  // Txns
  buys24h: number;
  sells24h: number;
  // Risk derived
  riskLevel: RiskLevel;
  riskScore: number;
  riskMetrics: RiskMetric[];
  flags: Flag[];
  aiSummary: string;
  // Source
  url: string;
  imageUrl?: string;
}

interface RiskMetric {
  label: string;
  value: number; // 0–100 display score
  note: string;
  invert?: boolean; // if true, lower raw = safer
}

interface Flag {
  type: "danger" | "warning" | "safe";
  text: string;
}

interface RecentScan {
  symbol: string;
  name: string;
  riskLevel: RiskLevel;
  riskScore: number;
  timestamp: number;
}

// ─── Risk config ──────────────────────────────────────────────────────────────
const RC: Record<RiskLevel, { bg: string; text: string; border: string; dialColor: string; badge: string; headerBg: string }> = {
  Safe:     { bg: "bg-emerald-50",  text: "text-emerald-700", border: "border-emerald-200", dialColor: "#10b981", badge: "bg-emerald-100 text-emerald-800 border-emerald-200", headerBg: "bg-emerald-50/60" },
  Low:      { bg: "bg-teal-50",     text: "text-teal-700",    border: "border-teal-200",    dialColor: "#14b8a6", badge: "bg-teal-100 text-teal-800 border-teal-200",          headerBg: "bg-teal-50/60"    },
  Medium:   { bg: "bg-amber-50",    text: "text-amber-700",   border: "border-amber-200",   dialColor: "#f59e0b", badge: "bg-amber-100 text-amber-800 border-amber-200",        headerBg: "bg-amber-50/60"   },
  High:     { bg: "bg-orange-50",   text: "text-orange-700",  border: "border-orange-200",  dialColor: "#f97316", badge: "bg-orange-100 text-orange-800 border-orange-200",      headerBg: "bg-orange-50/60"  },
  Critical: { bg: "bg-red-50",      text: "text-red-700",     border: "border-red-200",     dialColor: "#ef4444", badge: "bg-red-100 text-red-800 border-red-200",              headerBg: "bg-red-50/60"     },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
function fmt(n: number, compact = true): string {
  if (!isFinite(n) || n === 0) return "$0";
  if (compact) {
    if (n >= 1e9) return `$${(n / 1e9).toFixed(2)}B`;
    if (n >= 1e6) return `$${(n / 1e6).toFixed(2)}M`;
    if (n >= 1e3) return `$${(n / 1e3).toFixed(2)}K`;
  }
  if (n < 0.000001) return `$${n.toExponential(3)}`;
  if (n < 0.01) return `$${n.toFixed(8)}`;
  if (n < 1) return `$${n.toFixed(6)}`;
  return `$${n.toLocaleString(undefined, { maximumFractionDigits: 4 })}`;
}

function barColor(score: number): string {
  if (score >= 80) return "bg-emerald-500";
  if (score >= 60) return "bg-teal-400";
  if (score >= 40) return "bg-amber-500";
  if (score >= 20) return "bg-orange-500";
  return "bg-red-500";
}

// ─── Risk Engine ─────────────────────────────────────────────────────────────
// Takes raw DexScreener pair data and derives risk scores
function deriveRisk(pair: DexPair): Pick<TokenData, "riskLevel" | "riskScore" | "riskMetrics" | "flags" | "aiSummary"> {
  const liq    = pair.liquidity?.usd   ?? 0;
  const vol    = pair.volume?.h24       ?? 0;
  const fdv    = pair.fdv               ?? 0;
  const buys   = pair.txns?.h24?.buys   ?? 0;
  const sells  = pair.txns?.h24?.sells  ?? 0;
  const change = Math.abs(pair.priceChange?.h24 ?? 0);
  const age    = pair.pairCreatedAt ? (Date.now() - pair.pairCreatedAt) / (1000 * 60 * 60 * 24) : 999;

  // ── Liquidity score (0=dangerous, 100=safe) ──
  let liqScore = 0;
  if      (liq >= 10_000_000) liqScore = 95;
  else if (liq >= 1_000_000)  liqScore = 80;
  else if (liq >= 500_000)    liqScore = 65;
  else if (liq >= 100_000)    liqScore = 45;
  else if (liq >= 10_000)     liqScore = 25;
  else                        liqScore = 8;

  // ── Volume/Liquidity ratio (healthy = 0.2–5x) ──
  const volRatio = liq > 0 ? vol / liq : 0;
  let volScore = 0;
  if      (volRatio >= 0.2 && volRatio <= 5)  volScore = 90;
  else if (volRatio > 0 && volRatio < 0.2)    volScore = 50;
  else if (volRatio > 5  && volRatio < 20)    volScore = 60;
  else if (volRatio >= 20)                     volScore = 20; // wash trading signal
  else                                          volScore = 10;

  // ── Volatility (lower = safer) ──
  let volat = 0;
  if      (change < 3)   volat = 90;
  else if (change < 8)   volat = 72;
  else if (change < 20)  volat = 52;
  else if (change < 50)  volat = 28;
  else                   volat = 8;
  // For display, invert: we show how volatile it is (raw), safer = lower number shown
  const volatDisplay = 100 - volat;

  // ── Buy/Sell ratio ──
  const total = buys + sells;
  const sellRatio = total > 0 ? sells / total : 0.5;
  let bsScore = 0;
  if      (sellRatio < 0.35) bsScore = 88;
  else if (sellRatio < 0.55) bsScore = 72;
  else if (sellRatio < 0.70) bsScore = 48;
  else                        bsScore = 20; // heavy selling = danger

  // ── Age score ──
  let ageScore = 0;
  if      (age > 365)  ageScore = 95;
  else if (age > 90)   ageScore = 78;
  else if (age > 30)   ageScore = 58;
  else if (age > 7)    ageScore = 35;
  else if (age > 1)    ageScore = 15;
  else                 ageScore = 5;

  // ── FDV reasonableness ──
  let fdvScore = 80;
  if (fdv > 0 && liq > 0) {
    const fdvLiqRatio = fdv / liq;
    if      (fdvLiqRatio < 10)   fdvScore = 90;
    else if (fdvLiqRatio < 100)  fdvScore = 70;
    else if (fdvLiqRatio < 1000) fdvScore = 45;
    else                          fdvScore = 15;
  }

  // ── Composite risk score (0=safe, 100=dangerous) ──
  const safetyScore = (
    liqScore    * 0.30 +
    volScore    * 0.15 +
    volat       * 0.15 +
    bsScore     * 0.15 +
    ageScore    * 0.15 +
    fdvScore    * 0.10
  );
  const riskScore = Math.round(Math.max(0, Math.min(100, 100 - safetyScore)));

  // ── Risk level ──
  let riskLevel: RiskLevel;
  if      (riskScore <= 15) riskLevel = "Safe";
  else if (riskScore <= 35) riskLevel = "Low";
  else if (riskScore <= 55) riskLevel = "Medium";
  else if (riskScore <= 75) riskLevel = "High";
  else                       riskLevel = "Critical";

  // ── Metrics for display ──
  const riskMetrics: RiskMetric[] = [
    { label: "Liquidity depth",     value: liqScore,      note: fmt(liq) },
    { label: "Volume health",       value: volScore,      note: `${fmt(vol)} 24h` },
    { label: "Volatility",          value: volatDisplay,  note: `${change.toFixed(1)}% 24h swing`, invert: true },
    { label: "Buy/Sell pressure",   value: bsScore,       note: `${buys} buys · ${sells} sells` },
    { label: "Token age",           value: ageScore,      note: age < 999 ? `${Math.round(age)}d old` : "Unknown" },
    { label: "FDV vs liquidity",    value: fdvScore,      note: fdv > 0 ? `FDV ${fmt(fdv)}` : "Unknown" },
  ];

  // ── Flags ──
  const flags: Flag[] = [];

  if (liq < 10_000)        flags.push({ type: "danger",  text: `Critically low liquidity: ${fmt(liq)} — exits will crash price` });
  else if (liq < 100_000)  flags.push({ type: "warning", text: `Low liquidity pool: ${fmt(liq)} — high slippage risk` });
  else                     flags.push({ type: "safe",    text: `Adequate liquidity: ${fmt(liq)}` });

  if (volRatio > 20)       flags.push({ type: "danger",  text: "Abnormally high volume/liquidity ratio — possible wash trading" });
  else if (volRatio > 5)   flags.push({ type: "warning", text: "Elevated volume relative to liquidity — monitor closely" });

  if (sellRatio > 0.70)    flags.push({ type: "danger",  text: `Heavy sell pressure: ${Math.round(sellRatio * 100)}% of txns are sells` });
  else if (sellRatio > 0.55) flags.push({ type: "warning", text: `Moderate sell pressure: ${Math.round(sellRatio * 100)}% sells` });
  else if (buys > 0)       flags.push({ type: "safe",    text: `Healthy buy activity: ${buys} buys vs ${sells} sells in 24h` });

  if (age < 1)             flags.push({ type: "danger",  text: "Token launched less than 24h ago — extremely high rug pull risk" });
  else if (age < 7)        flags.push({ type: "warning", text: `Very new token: launched ${Math.round(age)} days ago` });
  else if (age > 365)      flags.push({ type: "safe",    text: `Established token: ${Math.round(age / 30)} months old` });

  if (fdv > 0 && liq > 0 && fdv / liq > 1000) flags.push({ type: "danger",  text: `FDV/Liquidity ratio dangerously high (${Math.round(fdv / liq)}x)` });
  else if (fdv > 0 && liq > 0 && fdv / liq > 100) flags.push({ type: "warning", text: `High FDV/Liquidity ratio (${Math.round(fdv / liq)}x)` });

  if (change > 50)         flags.push({ type: "danger",  text: `Extreme 24h price swing: ${pair.priceChange?.h24?.toFixed(1)}%` });
  else if (change < 5 && liq > 500_000) flags.push({ type: "safe", text: "Stable price movement in 24h" });

  // ── AI Summary ──
  const aiSummary = generateSummary(pair, riskLevel, riskScore, liq, vol, age, sellRatio);

  return { riskLevel, riskScore, riskMetrics, flags, aiSummary };
}

function generateSummary(
  pair: DexPair,
  level: RiskLevel,
  score: number,
  liq: number,
  vol: number,
  age: number,
  sellRatio: number
): string {
  const name = pair.baseToken?.name ?? "This token";
  const sym  = pair.baseToken?.symbol ?? "";
  const chain = pair.chainId ?? "unknown chain";

  if (level === "Safe" || level === "Low") {
    return `${name} (${sym}) shows strong safety signals on ${chain}. With ${fmt(liq)} in liquidity and ${fmt(vol)} in 24h volume, the market depth is solid. Risk score is ${score}/100. Suitable for informed traders — always verify contract ownership and check the project's documentation before trading.`;
  }
  if (level === "Medium") {
    return `${name} (${sym}) presents moderate risk on ${chain}. Liquidity of ${fmt(liq)} is adequate but not deep. ${sellRatio > 0.55 ? "Sell pressure is elevated." : "Buy/sell ratio is balanced."} Risk score ${score}/100 suggests proceeding with caution and using conservative position sizing.`;
  }
  if (level === "High") {
    return `${name} (${sym}) carries significant risk. ${age < 30 ? `The token is only ${Math.round(age)} days old. ` : ""}Liquidity of ${fmt(liq)} may be insufficient to exit a large position. ${sellRatio > 0.6 ? "Strong sell pressure is a concern. " : ""}Risk score ${score}/100. Only trade with money you can afford to lose entirely.`;
  }
  return `⚠ ${name} (${sym}) shows critical risk indicators on ${chain}. ${liq < 50_000 ? `Liquidity is dangerously thin at ${fmt(liq)}. ` : ""}${age < 7 ? "The token is extremely new. " : ""}Risk score ${score}/100. This token has multiple red flags consistent with rug pull or scam patterns. Do not buy.`;
}

// ─── DexScreener API ─────────────────────────────────────────────────────────
interface DexPair {
  chainId: string;
  dexId: string;
  url: string;
  pairAddress: string;
  baseToken: { address: string; name: string; symbol: string };
  quoteToken: { address: string; name: string; symbol: string };
  priceNative: string;
  priceUsd?: string;
  txns: { h24: { buys: number; sells: number }; h6: { buys: number; sells: number } };
  volume: { h24: number; h6: number; h1: number };
  priceChange: { h1: number; h6: number; h24: number };
  liquidity?: { usd: number; base: number; quote: number };
  fdv?: number;
  marketCap?: number;
  pairCreatedAt?: number;
  info?: { imageUrl?: string };
}

async function searchDexScreener(query: string): Promise<DexPair[]> {
  // DexScreener free API — no key needed, CORS allowed
  const res = await fetch(
    `https://api.dexscreener.com/latest/dex/search?q=${encodeURIComponent(query)}`,
    { headers: { Accept: "application/json" } }
  );
  if (!res.ok) throw new Error(`DexScreener ${res.status}`);
  const data = await res.json();
  return (data.pairs ?? []) as DexPair[];
}

async function fetchByAddress(address: string): Promise<DexPair[]> {
  const res = await fetch(
    `https://api.dexscreener.com/latest/dex/tokens/${address}`,
    { headers: { Accept: "application/json" } }
  );
  if (!res.ok) throw new Error(`DexScreener ${res.status}`);
  const data = await res.json();
  return (data.pairs ?? []) as DexPair[];
}

// Pick the best pair (highest liquidity on a major chain)
function pickBestPair(pairs: DexPair[]): DexPair | null {
  if (!pairs.length) return null;
  const MAJOR = ["ethereum", "bsc", "solana", "arbitrum", "polygon", "base", "avalanche"];
  const sorted = [...pairs].sort((a, b) => {
    const aScore = (MAJOR.indexOf(a.chainId) >= 0 ? 1000 : 0) + (a.liquidity?.usd ?? 0) / 1000;
    const bScore = (MAJOR.indexOf(b.chainId) >= 0 ? 1000 : 0) + (b.liquidity?.usd ?? 0) / 1000;
    return bScore - aScore;
  });
  return sorted[0];
}

function pairToTokenData(pair: DexPair): TokenData {
  const risk = deriveRisk(pair);
  const priceUsd = parseFloat(pair.priceUsd ?? "0") || 0;
  const age = pair.pairCreatedAt
    ? Math.round((Date.now() - pair.pairCreatedAt) / (1000 * 60 * 60 * 24))
    : null;

  return {
    name:         pair.baseToken.name,
    symbol:       pair.baseToken.symbol.toUpperCase(),
    address:      pair.baseToken.address,
    chainId:      pair.chainId,
    dexId:        pair.dexId,
    pairAddress:  pair.pairAddress,
    priceUsd,
    priceChange1h:  pair.priceChange?.h1 ?? 0,
    priceChange24h: pair.priceChange?.h24 ?? 0,
    priceChange7d:  0,
    liquidity:    pair.liquidity?.usd ?? 0,
    volume24h:    pair.volume?.h24 ?? 0,
    fdv:          pair.fdv ?? 0,
    marketCap:    pair.marketCap ?? 0,
    buys24h:      pair.txns?.h24?.buys ?? 0,
    sells24h:     pair.txns?.h24?.sells ?? 0,
    url:          pair.url,
    imageUrl:     pair.info?.imageUrl,
    ...risk,
  };
}

// ─── Icons ────────────────────────────────────────────────────────────────────
function ShieldIcon({ className = "" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="M9 12l2 2 4-4"/>
    </svg>
  );
}

// ─── Scan Animation ───────────────────────────────────────────────────────────
const SCAN_STEPS = [
  "Connecting to DexScreener...",
  "Fetching on-chain pair data...",
  "Analyzing liquidity pools...",
  "Calculating volume metrics...",
  "Evaluating buy/sell pressure...",
  "Running risk algorithms...",
  "Generating safety report...",
];

function ScanOverlay({ token }: { token: string }) {
  const [step, setStep] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setStep(s => Math.min(s + 1, SCAN_STEPS.length - 1)), 350);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="flex flex-col items-center py-16 px-8 gap-10">
      <div className="relative w-24 h-24 flex items-center justify-center">
        <motion.div animate={{ rotate: 360 }} transition={{ duration: 2.5, repeat: Infinity, ease: "linear" as const }}
          className="absolute inset-0 rounded-full border-2 border-dashed border-emerald-200" />
        <motion.div animate={{ rotate: -360 }} transition={{ duration: 4, repeat: Infinity, ease: "linear" as const }}
          className="absolute inset-3 rounded-full border border-dashed border-emerald-100" />
        <motion.div animate={{ scale: [1, 1.7], opacity: [0.25, 0] }} transition={{ duration: 1.8, repeat: Infinity }}
          className="absolute inset-0 rounded-full bg-emerald-400/20" />
        <div className="relative w-14 h-14 bg-emerald-600 rounded-2xl flex items-center justify-center shadow-lg shadow-emerald-100">
          <ShieldIcon className="w-7 h-7 text-white" />
        </div>
      </div>

      <div className="text-center">
        <p className="font-display font-bold text-gray-900 text-xl mb-1">
          Scanning <span className="text-emerald-600">{token.toUpperCase()}</span>
        </p>
        <p className="font-sans text-sm text-gray-400">Fetching live on-chain data via DexScreener</p>
      </div>

      <div className="w-full max-w-sm flex flex-col gap-2.5">
        {SCAN_STEPS.map((s, i) => (
          <motion.div key={s} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.05 }}
            className="flex items-center gap-3">
            <div className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 transition-all duration-300 ${
              i < step ? "bg-emerald-500" : i === step ? "border-2 border-emerald-400 bg-emerald-50" : "border border-gray-200 bg-white"
            }`}>
              {i < step
                ? <svg className="w-3 h-3 text-white" viewBox="0 0 12 12" fill="none"><path d="M2.5 6l2.5 2.5 4.5-5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
                : i === step
                ? <motion.div animate={{ scale: [0.7, 1.1, 0.7] }} transition={{ repeat: Infinity, duration: 0.9 }} className="w-2 h-2 rounded-full bg-emerald-500" />
                : null}
            </div>
            <span className={`font-sans text-sm transition-colors ${
              i < step ? "text-emerald-600" : i === step ? "text-gray-800 font-medium" : "text-gray-300"
            }`}>{s}</span>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

// ─── Risk Dial ────────────────────────────────────────────────────────────────
function RiskDial({ score, level }: { score: number; level: RiskLevel }) {
  const rc = RC[level];
  const r = 52, circ = 2 * Math.PI * r, arc = circ * 0.75;
  const offset = arc - (score / 100) * arc;

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="relative w-40 h-40">
        <svg viewBox="0 0 120 120" className="w-full h-full" style={{ transform: "rotate(-225deg)" }}>
          <circle cx="60" cy="60" r={r} fill="none" stroke="#f1f5f9" strokeWidth="9"
            strokeDasharray={`${arc} ${circ}`} strokeLinecap="round" />
          <motion.circle cx="60" cy="60" r={r} fill="none" stroke={rc.dialColor} strokeWidth="9"
            strokeLinecap="round" strokeDasharray={`${arc} ${circ}`}
            initial={{ strokeDashoffset: arc }} animate={{ strokeDashoffset: offset }}
            transition={{ duration: 1.4, ease: EASE, delay: 0.2 }} />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <motion.span initial={{ opacity: 0, scale: 0.6 }} animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5, delay: 0.7 }}
            className="font-display font-bold text-4xl text-gray-900 leading-none">{score}</motion.span>
          <span className="font-sans text-xs text-gray-400 mt-0.5">risk score</span>
        </div>
      </div>
      <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 1.1 }}
        className={`px-5 py-1.5 rounded-full border text-sm font-display font-bold ${rc.badge}`}>
        {level} Risk
      </motion.div>
    </div>
  );
}

// ─── Metric Bar ───────────────────────────────────────────────────────────────
function MetricBar({ label, value, note, invert = false, delay = 0 }: {
  label: string; value: number; note: string; invert?: boolean; delay?: number;
}) {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true });
  const displayVal = invert ? 100 - value : value;

  return (
    <motion.div ref={ref} initial={{ opacity: 0, y: 8 }} animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.45, delay }} className="group">
      <div className="flex items-center justify-between mb-1.5">
        <span className="font-sans text-sm text-gray-600">{label}</span>
        <div className="flex items-center gap-2">
          <span className="font-sans text-xs text-gray-300 group-hover:text-gray-400 transition-colors">{note}</span>
          <span className="font-mono text-xs font-bold text-gray-700 w-7 text-right tabular-nums">{value}</span>
        </div>
      </div>
      <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
        <motion.div initial={{ width: 0 }} animate={inView ? { width: `${displayVal}%` } : {}}
          transition={{ duration: 1, delay: delay + 0.1, ease: EASE }}
          className={`h-full rounded-full ${barColor(displayVal)}`} />
      </div>
    </motion.div>
  );
}

// ─── Result Panel ─────────────────────────────────────────────────────────────
function ResultPanel({ token }: { token: TokenData }) {
  const rc = RC[token.riskLevel];
  const ch24 = token.priceChange24h;
  const ch1  = token.priceChange1h;

  return (
    <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.55, ease: EASE }}
      className="flex flex-col gap-5">

      {/* ── Header ── */}
      <div className={`rounded-2xl border p-5 ${rc.border} ${rc.headerBg}`}>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-center gap-4">
            {token.imageUrl
              ? <img src={token.imageUrl} alt={token.symbol} className={`w-12 h-12 rounded-xl border-2 bg-white object-contain ${rc.border}`} />
              : <div className={`w-12 h-12 rounded-xl flex items-center justify-center font-mono font-bold text-sm border-2 bg-white ${rc.border} ${rc.text} flex-shrink-0`}>
                  {token.symbol.slice(0, 4)}
                </div>
            }
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="font-display font-bold text-gray-900 text-xl leading-tight">{token.name}</h2>
                <span className="font-mono text-xs font-bold text-gray-400 bg-white border border-gray-200 px-2 py-0.5 rounded-full">{token.symbol}</span>
                <span className="font-sans text-xs text-gray-400 bg-white border border-gray-200 px-2 py-0.5 rounded-full capitalize">{token.chainId} · {token.dexId}</span>
              </div>
              <p className="font-mono text-xs text-gray-400 mt-1 break-all">{token.address}</p>
            </div>
          </div>
          <div className="text-right flex-shrink-0">
            <p className="font-display font-bold text-2xl text-gray-900">{fmt(token.priceUsd, false)}</p>
            <div className="flex items-center gap-2 justify-end mt-0.5">
              <span className={`font-sans text-xs font-semibold ${ch1 >= 0 ? "text-emerald-600" : "text-red-500"}`}>
                {ch1 >= 0 ? "+" : ""}{ch1.toFixed(2)}% 1h
              </span>
              <span className="text-gray-200">·</span>
              <span className={`font-sans text-xs font-semibold ${ch24 >= 0 ? "text-emerald-600" : "text-red-500"}`}>
                {ch24 >= 0 ? "+" : ""}{ch24.toFixed(2)}% 24h
              </span>
            </div>
            <a href={token.url} target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center gap-1 font-sans text-xs text-emerald-600 hover:text-emerald-700 mt-1.5 transition-colors">
              View on DexScreener ↗
            </a>
          </div>
        </div>
      </div>

      {/* ── 3 columns ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 items-start">

        {/* Col 1 — Dial + stats */}
        <div className="bg-white border border-gray-100 rounded-2xl p-6 flex flex-col items-center gap-5">
          <RiskDial score={token.riskScore} level={token.riskLevel} />

          <div className="w-full grid grid-cols-2 gap-2.5">
            {[
              { label: "Liquidity",  val: fmt(token.liquidity) },
              { label: "24h Volume", val: fmt(token.volume24h) },
              { label: "FDV",        val: token.fdv > 0 ? fmt(token.fdv) : "—" },
              { label: "Buys / Sells", val: `${token.buys24h} / ${token.sells24h}` },
            ].map((s, i) => (
              <motion.div key={s.label} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 + i * 0.08, ease: EASE }}
                className="bg-gray-50 rounded-xl p-3 text-center">
                <p className="font-sans text-[10px] uppercase tracking-wide text-gray-400 mb-0.5">{s.label}</p>
                <p className="font-mono text-xs font-bold text-gray-800 truncate">{s.val}</p>
              </motion.div>
            ))}
          </div>

          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.85 }}
            className={`w-full rounded-xl px-4 py-2.5 text-center text-xs font-sans font-semibold border ${rc.border} ${rc.bg} ${rc.text}`}>
            {token.riskLevel === "Critical"
              ? "🚨 Extreme risk — avoid"
              : token.riskLevel === "High"
              ? "⚠ High risk — trade with caution"
              : token.riskLevel === "Medium"
              ? "Moderate risk — size carefully"
              : token.riskLevel === "Low"
              ? "✓ Low risk — verify contract"
              : "✓ Safe asset — standard DYOR"}
          </motion.div>
        </div>

        {/* Col 2 — Metrics */}
        <div className="bg-white border border-gray-100 rounded-2xl p-6">
          <h3 className="font-display font-semibold text-gray-900 text-sm mb-4">Risk metrics</h3>
          <div className="flex flex-col gap-4">
            {token.riskMetrics.map((m, i) => (
              <MetricBar key={m.label} label={m.label} value={m.value} note={m.note} invert={m.invert} delay={i * 0.06} />
            ))}
          </div>
        </div>

        {/* Col 3 — Flags + AI */}
        <div className="flex flex-col gap-4">
          <div className="bg-white border border-gray-100 rounded-2xl p-5">
            <h3 className="font-display font-semibold text-gray-900 text-sm mb-3">Safety signals</h3>
            <div className="flex flex-col gap-2">
              {token.flags.map((f, i) => (
                <motion.div key={i} initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.15 + i * 0.07, ease: EASE }}
                  className={`flex items-start gap-2.5 rounded-xl p-3 ${
                    f.type === "danger" ? "bg-red-50 border border-red-100"
                    : f.type === "warning" ? "bg-amber-50 border border-amber-100"
                    : "bg-emerald-50 border border-emerald-100"
                  }`}>
                  <div className={`w-4 h-4 rounded-full flex-shrink-0 flex items-center justify-center mt-0.5 ${
                    f.type === "danger" ? "bg-red-500" : f.type === "warning" ? "bg-amber-500" : "bg-emerald-500"
                  }`}>
                    <svg className="w-2.5 h-2.5 text-white" viewBox="0 0 10 10" fill="none">
                      {f.type === "safe"
                        ? <path d="M2 5l2 2 4-4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
                        : f.type === "warning"
                        ? <path d="M5 2v3.5M5 7.5v.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
                        : <path d="M2 2l6 6M8 2l-6 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>}
                    </svg>
                  </div>
                  <span className={`font-sans text-xs leading-relaxed ${
                    f.type === "danger" ? "text-red-800" : f.type === "warning" ? "text-amber-800" : "text-emerald-800"
                  }`}>{f.text}</span>
                </motion.div>
              ))}
            </div>
          </div>

          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5, ease: EASE }}
            className="bg-gray-950 rounded-2xl p-5">
            <div className="flex items-center gap-2.5 mb-3">
              <div className="w-7 h-7 bg-emerald-600 rounded-lg flex items-center justify-center flex-shrink-0">
                <ShieldIcon className="w-4 h-4 text-white" />
              </div>
              <span className="font-display font-bold text-white text-sm">AI Risk Verdict</span>
              <span className="ml-auto font-sans text-xs text-gray-500 bg-gray-800 px-2 py-0.5 rounded-full">Live data</span>
            </div>
            <p className="font-sans text-xs text-gray-300 leading-relaxed">{token.aiSummary}</p>
            <p className="font-sans text-xs text-gray-600 mt-3 pt-3 border-t border-gray-800">
              Data from DexScreener. Not financial advice. Always DYOR.
            </p>
          </motion.div>
        </div>
      </div>

      {/* ── Actions ── */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.75, ease: EASE }}
        className="flex flex-col sm:flex-row gap-3">
        <a href="/advisor-page" target="_blank" rel="noopener noreferrer"
          className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-sans font-bold text-sm h-11 rounded-xl transition-colors flex items-center justify-center gap-1.5">
          AI Advisor ↗
        </a>
        <button onClick={() => navigator.clipboard?.writeText(`${token.name} (${token.symbol}) — Risk score: ${token.riskScore}/100 (${token.riskLevel}) | TokenShield`)}
          className="flex-1 border border-gray-200 hover:bg-gray-50 text-gray-700 font-sans font-medium text-sm h-11 rounded-xl transition-colors">
          Copy report summary
        </button>
        <button onClick={() => window.location.href = "/fomo"}
          className="flex-1 border border-amber-200 hover:bg-amber-50 text-amber-700 font-sans font-medium text-sm h-11 rounded-xl transition-colors">
          ⏳ FOMO check before trading
        </button>
      </motion.div>
    </motion.div>
  );
}

// ─── Sidebar ──────────────────────────────────────────────────────────────────
function Sidebar({ recentScans, onScan }: { recentScans: RecentScan[]; onScan: (q: string) => void }) {
  return (
    <div className="flex flex-col gap-4">

      {/* Tip card */}
      <motion.div initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.2, ease: EASE }}
        className="bg-white border border-gray-100 rounded-2xl p-5">
        <h3 className="font-display font-semibold text-gray-900 text-sm mb-3">How risk is scored</h3>
        <div className="flex flex-col gap-2.5">
          {[
            { label: "0–15",  level: "Safe",     color: "bg-emerald-500" },
            { label: "16–35", level: "Low",      color: "bg-teal-400" },
            { label: "36–55", level: "Medium",   color: "bg-amber-500" },
            { label: "56–75", level: "High",     color: "bg-orange-500" },
            { label: "76+",   level: "Critical", color: "bg-red-500" },
          ].map(r => (
            <div key={r.level} className="flex items-center gap-2.5">
              <div className={`w-2 h-2 rounded-full flex-shrink-0 ${r.color}`} />
              <span className="font-mono text-xs text-gray-400">{r.label}</span>
              <span className="font-sans text-xs font-semibold text-gray-700">{r.level}</span>
            </div>
          ))}
        </div>
        <p className="font-sans text-xs text-gray-400 mt-3 pt-3 border-t border-gray-100 leading-relaxed">
          Scored from liquidity, volume health, volatility, buy/sell pressure, token age, and FDV ratio.
        </p>
      </motion.div>

      {/* Recent scans */}
      {recentScans.length > 0 && (
        <motion.div initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.3, ease: EASE }}
          className="bg-white border border-gray-100 rounded-2xl p-5">
          <h3 className="font-display font-semibold text-gray-900 text-sm mb-3">Recent scans</h3>
          <div className="flex flex-col">
            {recentScans.slice(0, 5).map((s, i) => {
              const rc = RC[s.riskLevel];
              const minsAgo = Math.round((Date.now() - s.timestamp) / 60000);
              return (
                <motion.button key={s.symbol + i} initial={{ opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.35 + i * 0.05, ease: EASE }}
                  onClick={() => onScan(s.symbol)}
                  className="flex items-center gap-3 py-2.5 px-2 rounded-xl hover:bg-gray-50 transition-colors text-left w-full">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-mono text-xs font-bold flex-shrink-0 border ${rc.border} ${rc.bg} ${rc.text}`}>
                    {s.symbol.slice(0, 3)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-sans text-xs font-semibold text-gray-800 truncate">{s.name}</p>
                    <p className="font-sans text-xs text-gray-400">{minsAgo < 1 ? "just now" : `${minsAgo}m ago`}</p>
                  </div>
                  <span className={`font-sans text-xs font-semibold px-2 py-0.5 rounded-full flex-shrink-0 border ${rc.badge} ${rc.border}`}>
                    {s.riskScore}
                  </span>
                </motion.button>
              );
            })}
          </div>
        </motion.div>
      )}

      {/* FOMO Guard */}
      <motion.div initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.4, ease: EASE }}
        className="rounded-2xl border border-amber-200 bg-amber-50 p-5">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-lg">⏳</span>
          <h3 className="font-display font-bold text-amber-900 text-sm">FOMO Guard</h3>
        </div>
        <p className="font-sans text-xs text-amber-700 leading-relaxed mb-3">
          Feeling the urge to buy right now? Run a quick emotional check before executing any trade.
        </p>
        <button className="w-full bg-amber-600 hover:bg-amber-700 text-white font-sans font-bold text-xs h-9 rounded-xl transition-colors">
          Run FOMO check →
        </button>
      </motion.div>

      {/* Data source badge */}
      <div className="flex items-center justify-center gap-2 py-1">
        <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
        <span className="font-sans text-xs text-gray-400">Live data · DexScreener API</span>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────
type PageState = "idle" | "scanning" | "result" | "error";

export default function AnalyzePage() {
  const [query, setQuery]         = useState("");
  const [pageState, setPageState] = useState<PageState>("idle");
  const [token, setToken]         = useState<TokenData | null>(null);
  const [errorMsg, setErrorMsg]   = useState("");
  const [recentScans, setRecentScans] = useState<RecentScan[]>([]);

  const runScan = useCallback(async (q?: string) => {
    const input = (q ?? query).trim();
    if (!input) return;

    setErrorMsg("");
    setPageState("scanning");
    setToken(null);

    try {
      // Detect if it's a contract address (0x... or Solana base58)
      const isAddress = /^0x[a-fA-F0-9]{40}$/.test(input) || /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(input);

      let pairs: DexPair[];
      if (isAddress) {
        pairs = await fetchByAddress(input);
      } else {
        pairs = await searchDexScreener(input);
      }

      const best = pickBestPair(pairs);
      if (!best) {
        setPageState("error");
        setErrorMsg(`No results found for "${input}". Try a contract address or a well-known symbol.`);
        return;
      }

      const tokenData = pairToTokenData(best);
      setToken(tokenData);
      setPageState("result");

      // Save to recent scans
      setRecentScans(prev => {
        const entry: RecentScan = {
          symbol: tokenData.symbol,
          name: tokenData.name,
          riskLevel: tokenData.riskLevel,
          riskScore: tokenData.riskScore,
          timestamp: Date.now(),
        };
        return [entry, ...prev.filter(s => s.symbol !== tokenData.symbol)].slice(0, 8);
      });

    } catch (err) {
      setPageState("error");
      setErrorMsg(`Failed to fetch data. Check your connection and try again. (${(err as Error).message})`);
    }
  }, [query]);

  return (
    <div className="min-h-screen bg-gray-50">

      {/* Nav */}
      <nav className="sticky top-0 z-50 bg-white border-b border-gray-100">
        <div className="max-w-[1320px] mx-auto px-6 h-14 flex items-center justify-between">
          <a href="/" className="flex items-center gap-2.5">
            <div className="w-7 h-7 bg-emerald-600 rounded-lg flex items-center justify-center flex-shrink-0">
              <ShieldIcon className="w-4 h-4 text-white" />
            </div>
            <span className="font-display font-bold text-gray-900 text-[15px]">TokenShield</span>
          </a>
          <div className="flex items-center gap-4">
            <div className="hidden sm:flex items-center gap-1.5">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <span className="font-sans text-xs text-gray-400">Live · DexScreener</span>
            </div>
            <a href="/" className="font-sans text-xs font-medium text-gray-500 hover:text-gray-900 transition-colors">← Back</a>
          </div>
        </div>
      </nav>

      <div className="max-w-[1320px] mx-auto px-6 py-8">
        <div className="flex gap-6 items-start">

          {/* Main */}
          <div className="flex-1 min-w-0">

            {/* Header */}
            <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, ease: EASE }} className="mb-6">
              <p className="font-sans text-xs font-bold text-emerald-600 tracking-widest uppercase mb-1.5">Token Risk Analyzer · Live Data</p>
              <h1 className="font-display font-bold text-gray-900 text-3xl tracking-tight leading-tight">
                Scan any token before you trade
              </h1>
              <p className="font-sans text-gray-400 text-sm mt-1.5">
                Search by name, symbol, or paste a contract address.
              </p>
            </motion.div>

            {/* Search */}
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.08, ease: EASE }} className="mb-3">
              <div className="flex gap-2.5">
                <div className="relative flex-1">
                  <svg className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-300 pointer-events-none"
                    fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/>
                  </svg>
                  <input type="text" value={query} onChange={e => setQuery(e.target.value)}
                    onKeyDown={e => e.key === "Enter" && runScan()}
                    placeholder="e.g. PEPE, SOL, 0x6982508...  or any token name"
                    disabled={pageState === "scanning"}
                    className="w-full h-12 bg-white pl-10 border border-gray-200 rounded-xl text-gray-900 font-sans text-sm placeholder:text-gray-300 focus:outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-50 transition-all disabled:opacity-50" />
                </div>
                <motion.button onClick={() => runScan()} disabled={pageState === "scanning" || !query.trim()}
                  whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
                  className="h-12 px-6 bg-emerald-600 hover:bg-emerald-700 text-white font-sans font-bold text-sm rounded-xl transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2 whitespace-nowrap shadow-sm shadow-emerald-100">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                    <path d="M5 12h14M12 5l7 7-7 7"/>
                  </svg>
                  Scan live
                </motion.button>
              </div>

              <AnimatePresence>
                {(pageState === "error" || errorMsg) && (
                  <motion.p initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                    className="font-sans text-xs text-red-500 mt-1.5 ml-1">{errorMsg}</motion.p>
                )}
              </AnimatePresence>
            </motion.div>

            {/* Quick chips */}
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.18 }}
              className="flex flex-wrap items-center gap-2 mb-6">
              <span className="font-sans text-xs text-gray-300">Try:</span>
              {["PEPE", "SHIB", "WIF", "BONK", "ETH", "BTC", "SOL"].map(t => (
                <button key={t} onClick={() => { setQuery(t); runScan(t); }}
                  disabled={pageState === "scanning"}
                  className="font-mono text-xs font-bold text-gray-500 border border-gray-200 bg-white px-3 py-1.5 rounded-full hover:border-emerald-300 hover:text-emerald-600 hover:bg-emerald-50 transition-all disabled:opacity-40">
                  {t}
                </button>
              ))}
            </motion.div>

            {/* Content */}
            <AnimatePresence mode="wait">
              {pageState === "idle" && (
                <motion.div key="idle" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                  className="bg-white rounded-2xl border border-dashed border-gray-200">
                  <div className="flex flex-col items-center justify-center py-20 gap-4 text-center px-6">
                    <motion.div animate={{ y: [0, -7, 0] }} transition={{ repeat: Infinity, duration: 3, ease: "easeInOut" as const }}
                      className="w-16 h-16 bg-gray-50 border border-gray-200 rounded-2xl flex items-center justify-center">
                      <ShieldIcon className="w-8 h-8 text-emerald-400" />
                    </motion.div>
                    <div>
                      <p className="font-display font-bold text-gray-800 text-lg">Ready to scan any token</p>
                      <p className="font-sans text-sm text-gray-400 mt-1 max-w-sm">
                        Enter a symbol like PEPE or SOL, or paste any EVM / Solana contract address for a live risk report.
                      </p>
                    </div>
                    <div className="flex flex-wrap justify-center gap-3 mt-2">
                      {["Liquidity analysis", "Volume health", "Buy/sell pressure", "Live price data"].map(f => (
                        <span key={f} className="font-sans text-xs text-emerald-700 bg-emerald-50 border border-emerald-100 px-3 py-1 rounded-full">{f}</span>
                      ))}
                    </div>
                  </div>
                </motion.div>
              )}

              {pageState === "scanning" && (
                <motion.div key="scanning" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                  className="bg-white rounded-2xl border border-gray-100">
                  <ScanOverlay token={query} />
                </motion.div>
              )}

              {pageState === "result" && token && (
                <motion.div key="result" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                  <ResultPanel token={token} />
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Sidebar */}
          <div className="hidden xl:block w-72 flex-shrink-0">
            <Sidebar recentScans={recentScans} onScan={q => { setQuery(q); runScan(q); }} />
          </div>
        </div>
      </div>
    </div>
  );
}